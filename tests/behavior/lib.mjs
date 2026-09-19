import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { cases, initialFiles, root, skills } from './cases.mjs';
export const json = v => JSON.stringify(v, null, 2) + '\n';
export const hash = v => createHash('sha256').update(v).digest('hex');
export function safe(base, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..')) throw new Error(`Unsafe path: ${relative}`);
  let p = base;
  for (const part of relative.split('/')) {
    p = path.join(p, part);
    try { if (fs.lstatSync(p).isSymbolicLink()) throw new Error(`Symlink: ${relative}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return p;
}
export function write(base, relative, bytes) {
  const p = safe(base, relative); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, bytes);
}
export function snapshot(base) {
  const result = {};
  function visit(dir, prefix = '') {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const rel = prefix + e.name, p = path.join(dir, e.name);
      if (e.isSymbolicLink()) result[rel] = { symlink: fs.readlinkSync(p) };
      else if (e.isDirectory()) visit(p, rel + '/');
      else if (e.isFile()) result[rel] = hash(fs.readFileSync(p));
      else result[rel] = { special: true };
    }
  }
  visit(base); return result;
}
export function difference(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k])).map(path => ({ path, before: before[path] ?? null, after: after[path] ?? null }));
}
export function emailAddresses(text) {
  return [...new Set(String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])].map(x => x.toLowerCase()).sort();
}
export function materialize(c, parent = os.tmpdir()) {
  const dir = fs.mkdtempSync(path.join(parent, 'apprenticeship-eval-'));
  for (const [p, text] of Object.entries(initialFiles(c))) write(dir, p, text);
  if (!c.deferred) fs.cpSync(path.join(root, 'skills', c.skill), path.join(dir, 'installed-skill'), { recursive: true, dereference: false });
  return dir;
}
export function processRun(command, args, { cwd, input = '', timeoutMs = 300000, env = process.env, maxBytes = 16 * 1024 * 1024 } = {}) {
  return new Promise(resolve => {
    const started = Date.now(); let stdout = '', stderr = '', error = null, timedOut = false, overflow = false, finished = false, killTimer, receivedBytes = 0;
    const decoders = { stdout: new StringDecoder('utf8'), stderr: new StringDecoder('utf8') };
    const child = spawn(command, args, { cwd, env, stdio: ['pipe','pipe','pipe'], detached: process.platform !== 'win32', shell: false });
    const kill = signal => { try { if (process.platform === 'win32') child.kill(signal); else process.kill(-child.pid, signal); } catch {} };
    const stop = () => { kill('SIGTERM'); killTimer ??= setTimeout(() => kill('SIGKILL'), 300); };
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    child.stdin.on('error', () => {}); child.stdin.end(input);
    const collect = key => bytes => {
      receivedBytes += bytes.length;
      if (receivedBytes > maxBytes) { overflow = true; stop(); return; }
      const text = decoders[key].write(bytes);
      if (key === 'stdout') stdout += text; else stderr += text;
    };
    child.stdout.on('data', collect('stdout')); child.stderr.on('data', collect('stderr'));
    const done = (code, signal) => {
      if (finished) return; finished = true; clearTimeout(timer);
      // A child may close its pipes before a TERM-resistant descendant exits.
      if (!timedOut && !overflow) clearTimeout(killTimer);
      stdout += decoders.stdout.end(); stderr += decoders.stderr.end();
      resolve({ command, args, stdout, stderr, code, signal, error, timedOut, overflow, durationMs: Date.now() - started });
    };
    child.on('error', e => { error = e.message; done(null, null); }); child.on('close', done);
  });
}
export function parseEvents(raw) {
  const events = [], errors = [];
  raw.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    try { const event = JSON.parse(line); if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Expected event object'); events.push({ line: index + 1, event }); }
    catch (e) { errors.push({ line: index + 1, reason: e.message }); }
  });
  return { events, errors };
}
export function validateCases(input = cases) {
  const errors = [], seen = new Set();
  const allowed = new Set(['version','id','source','skill','title','fixture','files','turns','criteria','repeats','pending','bootstrapRoles','deferred']);
  for (const c of input) {
    const problem = m => errors.push(`${c.id}: ${m}`);
    for (const key of Object.keys(c)) if (!allowed.has(key)) problem(`Unknown field ${key}`);
    if (c.version !== 1 || !/^(S\d\d|A\d\d|P\d\d|D\d\d)(-[a-zA-Z0-9-]+)?$/.test(c.id) || seen.has(c.id)) problem('Invalid version or duplicate/invalid ID');
    seen.add(c.id);
    if (!skills.includes(c.skill)) problem('Unknown active skill');
    if (!['none','canonical'].includes(c.fixture)) problem('Unknown fixture');
    if (![1,3].includes(c.repeats)) problem('Invalid repeats');
    if (!Array.isArray(c.turns) || !c.turns.length || c.turns.some(t => typeof t.message !== 'string' || !t.message.trim() || (t.archive !== undefined && typeof t.archive !== 'boolean') || Object.keys(t).some(k => !['message','archive'].includes(k)))) problem('Invalid turns');
    if (!Array.isArray(c.criteria) || c.criteria.length < 4 || new Set(c.criteria.map(x => x.id)).size !== c.criteria.length || c.criteria.some(x => !x.text?.trim())) problem('Invalid rubric');
    for (const [p, bytes] of Object.entries(initialFiles(c))) { try { safe('/nonexistent-eval-root', p); if (typeof bytes !== 'string') throw new Error('Not text'); } catch (e) { problem(e.message); } }
  }
  const packet = JSON.parse(fs.readFileSync(path.join(root, 'tests/behavior/promotion-packet.json')));
  const dimensions = JSON.parse(fs.readFileSync(path.join(root, 'catalog/levels.yaml'))).dimensions;
  const targets = new Set(packet.tasks.map(t => t.id));
  if (packet.tasks.length !== 8 || new Set(packet.tasks.map(t => t.project_id)).size !== 3) errors.push('Promotion packet needs eight tasks across three projects');
  if (JSON.stringify([...packet.readiness.dimension_findings.map(f => f.dimension)].sort()) !== JSON.stringify([...dimensions].sort())) errors.push('Incomplete promotion dimensions');
  for (const f of [...packet.readiness.findings, ...packet.readiness.dimension_findings]) if (!f.task_ids.length || f.task_ids.some(id => !targets.has(id))) errors.push('Unresolved readiness support');
  const authors = [packet.readiness.author, packet.recommendation.author, packet.review_invocation.actor, packet.authorization.author];
  if (new Set(authors).size !== 4 || packet.authorization.readiness_assessment_id !== packet.readiness.id || packet.authorization.recommendation_review_id !== packet.recommendation.id || packet.authorization.previous_promotion_id !== packet.prior_chain[0].id) errors.push('Invalid promotion binding');
  if (!(packet.scope.agreement.at < packet.period.start && packet.period.end < packet.readiness.created_at && packet.readiness.created_at <= packet.recommendation.created_at && packet.recommendation.created_at <= packet.authorization.at && packet.authorization.at <= packet.review_invocation.at)) errors.push('Invalid packet chronology');
  return errors;
}
export function validateCanonicalFixtures(input = cases) {
  const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
  const validators = {};
  for (const name of fs.readdirSync(path.join(root, 'schemas')).filter(n => n.endsWith('.schema.json'))) validators[name] = ajv.compile(JSON.parse(fs.readFileSync(path.join(root, 'schemas', name))));
  const exact = { 'config.yaml':'apprenticeship-config', 'profile.yaml':'learner-profile', 'current-project.yaml':'current-project', 'current-track.yaml':'current-track', 'competencies.yaml':'competency-state' };
  const folders = { work:'task', evidence:'evidence', assessments:'assessment', reviews:'review', projects:'project' };
  const errors = [];
  for (const c of input) for (const [p, text] of Object.entries(initialFiles(c))) {
    if (!p.startsWith('.apprenticeship/') || !p.endsWith('.yaml')) continue;
    const parts = p.split('/').slice(1), schema = (exact[parts[0]] ?? folders[parts[0]]) + '.schema.json';
    try { const validate = validators[schema]; if (!validate || !validate(JSON.parse(text))) errors.push(`${c.id}:${p}: ${JSON.stringify(validate?.errors)}`); }
    catch (e) { errors.push(`${c.id}:${p}: ${e.message}`); }
  }
  return errors;
}
export function deterministicChecks(turns, allowedEmailAddresses = []) {
  const failures = [];
  const allowedEmails = new Set(allowedEmailAddresses.map(x => x.toLowerCase()));
  for (const [i,t] of turns.entries()) {
    for (const d of t.changes) {
      if (d.path.startsWith('.apprenticeship/')) failures.push(`Turn ${i+1}: canonical mutation ${d.path}`);
      else if (!d.path.startsWith('apprenticeship-drafts/')) failures.push(`Turn ${i+1}: mutation outside drafts ${d.path}`);
      if (d.after && typeof d.after !== 'string') failures.push(`Turn ${i+1}: nonregular file ${d.path}`);
    }
    if (t.archived && t.changes.length) failures.push(`Turn ${i+1}: writes while archived`);
    if (t.unchangedRetry && t.changes.length) failures.push(`Turn ${i+1}: changed files on unchanged retry`);
    for (const address of emailAddresses(t.process?.stdout ?? '')) if (!allowedEmails.has(address)) failures.push(`Turn ${i+1}: unsupplied email address in transcript`);
  }
  return failures;
}
export function gradeResult(result, rubric, review) {
  const hard = deterministicChecks(result.turns, result.allowedEmailAddresses ?? []);
  if (hard.length) return { status: 'fail', errors: hard };
  if (result.status === 'deferred' || result.status === 'not-run' || result.status === 'infrastructure-error') return { status: result.status, errors: [] };
  if (!review) return { status: 'pending-review', errors: [] };
  const errors = [];
  if (result.status !== 'pending-review' || !result.turns.length || result.turns.some(t => !t.process?.stdout)) errors.push('No complete execution transcript');
  if (review.version !== 1 || review.runId !== result.runId || review.resultHash !== hash(json(result))) errors.push('Review is not bound to these result bytes');
  if (!review.reviewer?.identity || review.reviewer.independentOfTestedSession !== true) errors.push('Reviewer identity/independence declaration required');
  const ids = rubric.map(c => c.id);
  const findings = Array.isArray(review.findings) ? review.findings : [];
  if (findings.length !== ids.length || new Set(findings.map(f => f?.id)).size !== ids.length) errors.push('Exactly one finding per criterion required');
  for (const f of findings) {
    if (!f || !ids.includes(f.id) || !['pass','fail'].includes(f.verdict) || typeof f.rationale !== 'string' || !f.rationale.trim() || !Array.isArray(f.citations) || !f.citations.length) { errors.push('Invalid or unsupported criterion finding'); continue; }
    for (const cite of f.citations) {
      if (!cite || typeof cite.quote !== 'string') { errors.push(`Invalid transcript citation for ${f.id}`); continue; }
      const turn = result.turns[cite.turn - 1];
      const lines = turn?.process.stdout.split('\n') ?? [];
      if (!Number.isInteger(cite.line) || cite.line < 1 || cite.line > lines.length || !cite.quote || !lines[cite.line-1]?.includes(cite.quote)) errors.push(`Invalid transcript citation for ${f.id}`);
    }
  }
  return { status: errors.length ? 'pending-review' : findings.some(f => f.verdict === 'fail') ? 'fail' : 'pass', errors };
}
