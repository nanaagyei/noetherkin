import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildReport } from '../core/report.js';
import { renderReportHtml, renderReportMarkdown } from '../cli/report-render.js';
import { compileSchema } from '../core/schema.js';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { ScriptedRoleAdapter } from '../core/adapters.js';
import { selectTrack } from '../core/tracks.js';
import { assignTask, beginTask, codeReview, onboard, selectForge, submitChange, submitDesign, taskReview, testTask, validateSimulationCandidate } from '../core/simulation.js';
import { runtime } from '../core/storage.js';

// Issue #16: a read-only, shareable progress report derived from workspace records.

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));
const example = path.join(repository, 'examples/spring-petclinic');
const validateReport = compileSchema(JSON.parse(fs.readFileSync(path.join(repository, 'tests/fixtures/report.schema.json'), 'utf8')));

function temporary(t: { after: (fn: () => void) => void }, prefix = 'noetherkin-report-'): string {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
/** A copy of the fixture example whose records `edit` may change, to seed stale, contested or paused states. */
function exampleCopy(t: { after: (fn: () => void) => void }, edit: (state: string) => void = () => {}): string {
  const root = temporary(t);
  fs.cpSync(example, root, { recursive: true });
  edit(path.join(root, '.apprenticeship'));
  return root;
}
const editRecord = (file: string, change: (value: Record<string, any>) => void): void => {
  const value = JSON.parse(fs.readFileSync(file, 'utf8')); change(value); fs.writeFileSync(file, JSON.stringify(value, null, 2));
};
/** Every file under `root` with its digest, so a test can prove a command wrote nothing there. */
function snapshot(root: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
    const full = path.join(entry.parentPath, entry.name);
    if (entry.isFile()) files.set(path.relative(root, full), createHash('sha256').update(fs.readFileSync(full)).digest('hex'));
    else if (entry.isDirectory()) files.set(`${path.relative(root, full)}/`, 'dir');
  }
  return files;
}
const section = (html: string, id: string): string => html.slice(html.indexOf(`<section id="${id}">`), html.indexOf('</section>', html.indexOf(`<section id="${id}">`)));

test('the example workspace renders every section as self-contained HTML with no network requests', () => {
  const report = buildReport(example);
  const html = renderReportHtml(report);
  for (const id of ['identity', 'competencies', 'evidence', 'tasks', 'timeline', 'limits']) assert.match(html, new RegExp(`id="${id}"`), id);
  const attributes = [...html.matchAll(/\b(?:src|href)\s*=\s*"([^"]*)"/g)].map(match => match[1]!);
  assert.ok(attributes.length > 0, 'the report links its claims to its evidence');
  for (const value of attributes) assert.ok(value.startsWith('#'), `only in-page links are allowed: ${value}`);
  assert.doesNotMatch(html, /<script|<link|<img|<iframe|@import|url\(/i, 'nothing is fetched or executed');
  assert.doesNotMatch(section(html, 'competencies'), /%/, 'no percentages in the competency section');
  assert.equal(new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])).size, [...html.matchAll(/\bid="([^"]+)"/g)].length, 'anchors are unique');
});

test('each demonstrated competency links to evidence the cache entry cites', () => {
  const report = buildReport(example);
  const cache = JSON.parse(fs.readFileSync(path.join(example, '.apprenticeship/competencies.yaml'), 'utf8'));
  const html = renderReportHtml(report);
  assert.ok(report.competencies.demonstrated.length > 0);
  for (const item of report.competencies.demonstrated) {
    const entry = cache.entries.find((candidate: { competency_id: string }) => candidate.competency_id === item.competency_id);
    const linked = item.evidence_ids.filter(id => report.evidence.some(evidence => evidence.id === id));
    assert.ok(linked.length > 0 && linked.every(id => entry.evidence_ids.includes(id)), item.competency_id);
    for (const id of linked) assert.match(section(html, 'competencies'), new RegExp(`href="#r-${id}"`));
  }
});

test('simulated roles are labeled simulated and a fixture workspace is labeled prominently', () => {
  const report = buildReport(example);
  assert.equal(report.workspace.fixture, true);
  assert.match(report.limits[0]!, /^FIXTURE DATA/);
  const html = renderReportHtml(report);
  assert.match(html, /class="banner">FIXTURE DATA/);
  assert.match(html, /simulated team-lead/);
  assert.doesNotMatch(html, /by the team-lead/, 'a non-learner role is never shown unqualified');
  for (const item of [...report.evidence.map(evidence => evidence.recorded_by), ...report.timeline.map(entry => entry.actor)]) assert.equal(item.simulated, item.role !== 'learner');
  assert.match(renderReportMarkdown(report), /\*\*FIXTURE DATA\.\*\*/);
});

test('stale records are marked stale and unresolved standing never shows a current level', t => {
  const root = exampleCopy(t, state => editRecord(path.join(state, 'competencies.yaml'), cache => {
    cache.stale_record_ids = ['EVID-map-demo', 'REV-task-demo']; cache.standing = 'unresolved'; cache.effective_level = null;
    cache.entries[0].status = 'contested'; cache.entries[0].demonstrated_level = null;
  }));
  const report = buildReport(root);
  assert.deepEqual(report.competencies.demonstrated, []);
  assert.equal(report.competencies.contested[0]!.stale, true);
  assert.equal(report.evidence.find(item => item.id === 'EVID-map-demo')!.stale, true);
  assert.equal(report.tasks[0]!.reviews.find(review => review.id === 'REV-task-demo')!.stale, true);
  const html = renderReportHtml(report);
  assert.match(html, /<span class="tag">stale<\/span>/);
  assert.match(html, /Effective level: none while standing is unresolved \(last awarded E0\)/);
  assert.ok(report.limits.some(limit => /2 record\(s\) are stale/.test(limit)));
  assert.deepEqual(validateReport(JSON.parse(JSON.stringify(report))), []);
});

test('drafts are omitted by default and labeled when included', t => {
  const root = exampleCopy(t, state => editRecord(path.join(state, 'evidence/EVID-map-demo.yaml'), evidence => { evidence.verification.status = 'unverified'; }));
  assert.deepEqual(buildReport(root).evidence, []);
  assert.match(renderReportHtml(buildReport(root)), /EVID-map-demo <span class="tag">not shown<\/span>/, 'a cited but unshown record is disclosed, never silently dropped');
  const drafts = buildReport(root, { includeDrafts: true });
  assert.equal(drafts.evidence[0]!.verification, 'unverified');
  assert.match(renderReportHtml(drafts), /<span class="tag">unverified<\/span>/);
});

for (const mode of ['paused', 'archived']) test(`a ${mode} workspace renders and says so`, t => {
  const root = exampleCopy(t, state => editRecord(path.join(state, 'config.yaml'), config => { config.mode = mode; }));
  const report = buildReport(root);
  assert.equal(report.workspace.mode, mode);
  assert.ok(report.limits.includes(`The workspace is ${mode}.`));
  assert.match(renderReportHtml(report), new RegExp(`<dt>Workspace</dt><dd>${mode}</dd>`));
});

test('the advisory view is never read into the report', t => {
  const root = exampleCopy(t, state => fs.writeFileSync(path.join(state, 'advisory/attention.yaml'), '{"marker": "ADVISORY-SENTINEL"}\n'));
  const report = buildReport(root);
  assert.doesNotMatch(JSON.stringify(report), /ADVISORY-SENTINEL/);
  assert.doesNotMatch(renderReportHtml(report), /ADVISORY-SENTINEL/);
});

test('record text is escaped, so a report cannot inject markup', t => {
  const root = exampleCopy(t, state => editRecord(path.join(state, 'evidence/EVID-map-demo.yaml'), evidence => { evidence.fact.observation = '<img src="https://example.invalid/x.png"> & <script>alert(1)</script>'; }));
  const html = renderReportHtml(buildReport(root));
  assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /&lt;img src=&quot;https:\/\/example\.invalid\/x\.png&quot;&gt; &amp; &lt;script&gt;/);
});

test('a live forge workspace reports verified work as learner-authored in a simulated process', async t => {
  const root = temporary(t, 'noetherkin-report-live-');
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Build an evaluation harness'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  selectTrack(root, 'ml-engineering', files => validateSimulationCandidate(root, files));
  await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No inspected learner work exists.' }]));
  selectForge(root, 'eval-ledger', 'source');
  const source = path.join(root, 'source');
  for (const args of [['init'], ['config', 'user.email', 'learner@example.invalid'], ['config', 'user.name', 'Learner']]) spawnSync('git', args, { cwd: source });
  const design = path.join(root, 'design.md'); fs.writeFileSync(design, '# Contract\nCases live in a data file.\n# Alternative\nHard-coded cases were rejected.\n# Tests\npython -m pytest\n# First failure\nA malformed case file.\n');
  const adapter = new ScriptedRoleAdapter([
    { decision: 'approve', rationale: 'The design names behavior, a rejected alternative, tests and a failure case.', risks: [] },
    { outcome: 'approve', findings: ['The change satisfies the bounded task.'] },
    { outcome: 'accepted', findings: ['Every criterion has a current artifact.'], evidence_rationale: 'One reviewed bounded change with a passing test run.' }
  ]);
  assignTask(root); beginTask(root); await submitDesign(root, design, adapter);
  fs.writeFileSync(path.join(source, 'cases.py'), 'CASES = []\n'); submitChange(root);
  testTask(root, 'Tests pass.', runtime, `node -e "require('fs').accessSync('cases.py')"`);
  await codeReview(root, adapter);
  assert.equal((await taskReview(root, adapter)).outcome, 'success');

  const report = buildReport(root);
  assert.equal(report.workspace.validation.valid, true, JSON.stringify(report.workspace.validation.problems));
  assert.equal(report.workspace.fixture, false);
  assert.deepEqual({ track: report.identity.track_id, project: report.identity.project_id, kind: report.identity.project_kind }, { track: 'ml-engineering', project: 'eval-ledger', kind: 'forge' });
  assert.equal(report.tasks.length, 1);
  assert.equal(report.tasks[0]!.project_kind, 'forge');
  assert.deepEqual(report.tasks[0]!.reviews.map(review => [review.kind, review.author.simulated]).sort(), [['code', true], ['task', true]]);
  assert.ok(report.timeline.some(entry => entry.actor.role === 'learner' && !entry.actor.simulated), 'the learner is never labeled simulated');
  const html = renderReportHtml(report);
  assert.match(html, /forge project: learner-authored software, simulated process/);
  // The limits section disclaims production use; nothing outside it may claim any.
  const claims = html.replace(section(html, 'limits'), '');
  assert.doesNotMatch(claims, /production|deployed|released|users rely/i, 'no claim of production use');
  assert.deepEqual(validateReport(JSON.parse(JSON.stringify(report))), []);
});

test('report writes only its --out file, refuses the workspace state and never clobbers another file', t => {
  const root = exampleCopy(t);
  const outside = temporary(t, 'noetherkin-report-out-');
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, 'report', '--workspace', root, ...args], { encoding: 'utf8', cwd: outside });
  const before = snapshot(root);
  const html = run('--json');
  assert.equal(html.status, 0, html.stderr + html.stdout);
  assert.equal(JSON.parse(html.stdout).data.out, path.join(outside, 'noetherkin-report.html'));
  const out = path.join(root, 'progress.md');
  assert.equal(run('--format', 'md', '--out', out).status, 0);
  const after = snapshot(root); after.delete('progress.md');
  assert.deepEqual(after, before, 'nothing but the --out file changed in the workspace');
  assert.equal(run('--format', 'md', '--out', out).status, 0, 'an earlier report is replaced');

  const json = path.join(outside, 'report.json');
  assert.equal(run('--format', 'json', '--out', json).status, 0);
  assert.deepEqual(validateReport(JSON.parse(fs.readFileSync(json, 'utf8'))), []);

  const refused = run('--out', path.join(root, '.apprenticeship/knowledge/report.html'), '--json');
  assert.equal(refused.status, 1);
  assert.equal(JSON.parse(refused.stdout).diagnostics[0].code, 'UNSAFE_PATH');
  const mine = path.join(outside, 'notes.html'); fs.writeFileSync(mine, '<p>my notes</p>\n');
  const clobber = run('--out', mine, '--json');
  assert.equal(JSON.parse(clobber.stdout).diagnostics[0].code, 'OUTPUT_EXISTS');
  assert.equal(fs.readFileSync(mine, 'utf8'), '<p>my notes</p>\n');
  assert.equal(run('--format', 'pdf').status, 2, 'unknown formats are a usage error');
  assert.deepEqual(fs.readdirSync(outside).filter(file => file.endsWith('.tmp')), [], 'no temporary file is left behind');
});

