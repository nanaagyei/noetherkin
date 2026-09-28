// Live skill-discovery probe (issue #24). It installs the skills the way a learner does, with `noetherkin skills
// install`, then asks each real agent three questions in a scratch workspace and records whether the host found and
// loaded the `onboarding` skill on its own. It never runs in CI: `npm test` only exercises the offline classifier.
//
//   npm run evals:discovery -- --out <new private directory> [--host claude-code,codex] [--scope project,user]
//                               [--codex-bin <path>] [--claude-bin <path>] [--keep-user-install true]
//                               [--park-user-install true]
//
// Raw transcripts contain host paths and account context: keep --out private and never commit it. Transcripts are
// written outside the scratch workspace, because an agent listing its workspace would otherwise read its own log.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnCommand, terminate } from '../../dist/core/process.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const cli = path.join(repo, 'dist/cli/main.js');

export const prompts = {
  p1: 'I want to start an engineering apprenticeship workspace in this directory. What should I do first?',
  p2: 'Use the onboarding skill to start a Noetherkin workspace here.',
  p3: 'Without doing anything else, list the names of the skills available to you in this session.'
};
export const hosts = {
  'claude-code': { directory: '.claude/skills', args: (prompt, turns) => ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--max-turns', String(turns)], binary: 'claude' },
  codex: { directory: '.agents/skills', args: prompt => ['exec', '--json', '--sandbox', 'read-only', '--skip-git-repo-check', prompt], binary: 'codex' }
};

function events(jsonl) {
  return jsonl.split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}

/**
 * The skills a transcript shows the host loading. Claude Code loads a skill through its `Skill` tool, and a denied
 * call still proves discovery. Codex reads the skill's SKILL.md with a shell command. A file listing that merely
 * prints SKILL.md paths is not a load, so only commands that read a file count.
 */
export function loadedSkills(jsonl) {
  const loaded = new Set();
  for (const event of events(jsonl)) {
    for (const part of event.message?.content ?? []) if (part?.type === 'tool_use' && part.name === 'Skill' && typeof part.input?.skill === 'string') loaded.add(part.input.skill);
    const item = event.item;
    if (event.type === 'item.completed' && item?.type === 'command_execution' && /\b(cat|sed|head|tail|less|nl|bat)\b/.test(item.command ?? '')) {
      for (const match of item.command.matchAll(/skills\/([\w-]+)\/SKILL\.md/g)) loaded.add(match[1]);
    }
  }
  return [...loaded].sort();
}

/** The agent's final text, for the inventory prompt. */
export function finalText(jsonl) {
  let text = '';
  for (const event of events(jsonl)) {
    if (event.type === 'result' && typeof event.result === 'string') text = event.result;
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') text = event.item.text ?? text;
  }
  return text;
}

/**
 * One case's verdict. `discovered`: the host can see the skill (it loaded it when named, or listed it).
 * `routed`: an unnamed request loaded it. `unexpected`: other skills loaded for the onboarding prompts.
 */
export function classify(transcripts) {
  const p1 = loadedSkills(transcripts.p1 ?? ''), p2 = loadedSkills(transcripts.p2 ?? '');
  const listed = /\bonboarding\b/.test(finalText(transcripts.p3 ?? ''));
  const unexpected = [...new Set([...p1, ...p2])].filter(skill => skill !== 'onboarding');
  const discovered = p2.includes('onboarding') || listed;
  const routed = p1.includes('onboarding');
  const diagnosis = routed ? 'ok' : discovered ? 'routing: the skill is visible but its description did not match the request' : 'discovery: the host did not see the installed skill; check the install path';
  return { routed, discovered, listed, p1_loaded: p1, p2_loaded: p2, unexpected, diagnosis };
}

function run(binary, args, cwd, timeoutMs = 300_000) {
  return new Promise(resolve => {
    const child = spawnCommand(binary, args, { cwd });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => terminate(child), timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.stdin.end();
    child.on('error', error => { clearTimeout(timer); resolve({ code: null, stdout, stderr: `${stderr}${error.message}` }); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}

function skillNames() {
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'skill-pack/manifest.json'), 'utf8'));
  return manifest.skills.map(entry => entry.name);
}

async function probe(host, scope, out, options) {
  const spec = hosts[host];
  const binary = options[`${host === 'codex' ? 'codex' : 'claude'}-bin`] ?? spec.binary;
  const caseDir = path.join(out, `${host}-${scope}`);
  const workspace = path.join(caseDir, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  await run('git', ['init', '-q'], workspace);
  const home = os.homedir();
  const userRoot = path.join(home, spec.directory);
  // A project-level case is only isolated when no user-level copy could answer instead. With --park-user-install,
  // existing user-level Noetherkin skills are moved into the run directory for this case and always moved back.
  const parked = path.join(caseDir, 'parked-user-skills');
  const toPark = scope === 'project' && options['park-user-install'] === 'true'
    ? skillNames().filter(name => fs.existsSync(path.join(userRoot, name))) : [];
  const moved = [];
  /** @type {Set<string> | null} null until known; nothing is removed while it is unknown. */
  let preexisting = null;
  let install = { stdout: '' }; let version = null;
  const transcripts = {};
  try {
    for (const name of toPark) { fs.mkdirSync(parked, { recursive: true }); fs.renameSync(path.join(userRoot, name), path.join(parked, name)); moved.push(name); }
    preexisting = new Set(skillNames().filter(name => fs.existsSync(path.join(userRoot, name))));
    install = await run(process.execPath, [cli, 'skills', 'install', '--host', host, ...(scope === 'user' ? ['--global'] : ['--target', workspace]), '--json'], workspace);
    fs.writeFileSync(path.join(caseDir, 'install.json'), install.stdout);
    version = (await run(binary, ['--version'], workspace, 30_000)).stdout.trim().split('\n')[0] || null;
    for (const [id, prompt] of Object.entries(prompts)) {
      const result = await run(binary, spec.args(prompt, id === 'p3' ? 2 : 4), workspace);
      transcripts[id] = result.stdout;
      fs.writeFileSync(path.join(caseDir, `${id}.jsonl`), result.stdout);
      fs.writeFileSync(path.join(caseDir, `${id}.stderr.txt`), result.stderr);
    }
  } finally {
    // Remove only the user-level skills this probe added, never ones the learner already had, then restore any
    // skills that were parked, including after a partial failure.
    if (scope === 'user' && preexisting && options['keep-user-install'] !== 'true') for (const name of skillNames()) if (!preexisting.has(name)) fs.rmSync(path.join(userRoot, name), { recursive: true, force: true });
    for (const name of moved) fs.renameSync(path.join(parked, name), path.join(userRoot, name));
  }
  const isolated = scope === 'user' || preexisting?.size === 0;
  return { host, scope, host_version: version, install_target: scope === 'user' ? userRoot : path.join(workspace, spec.directory), install_ok: JSON.parse(install.stdout || '{}').outcome === 'success', isolated, parked_user_skills: moved.length, preexisting_user_skills: [...(preexisting ?? [])], ...classify(transcripts) };
}

export async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) { if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) throw new Error('Options are --name value pairs.'); options[argv[i].slice(2)] = argv[i + 1]; }
  if (!options.out) throw new Error('Pass --out <new directory>, outside the checkout.');
  const out = path.resolve(options.out);
  if (fs.existsSync(out)) throw new Error(`${out} already exists; use a new directory so runs never mix.`);
  // On Windows a path on another drive has no relative form: path.relative returns it absolute, and it is outside.
  const relative = path.relative(repo, out);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) throw new Error('Write probe output outside the checkout; raw transcripts must never be committed.');
  const chosenHosts = (options.host ?? 'claude-code,codex').split(',');
  const scopes = (options.scope ?? 'project,user').split(',');
  for (const host of chosenHosts) if (!hosts[host]) throw new Error(`Unknown host ${host}; choose claude-code or codex.`);
  for (const scope of scopes) if (!['project', 'user'].includes(scope)) throw new Error(`Unknown scope ${scope}; choose project or user.`);
  fs.mkdirSync(out, { recursive: true });
  // Project scope runs first: a user-level install would otherwise mask a project-level failure.
  const results = [];
  for (const scope of ['project', 'user'].filter(item => scopes.includes(item))) for (const host of chosenHosts) {
    process.stderr.write(`Probing ${host} at ${scope} level...\n`);
    results.push(await probe(host, scope, out, options));
  }
  const report = { date: new Date().toISOString(), platform: process.platform, prompts, results };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  for (const result of results) process.stdout.write(`${result.host.padEnd(12)} ${result.scope.padEnd(8)} ${result.host_version ?? 'unknown version'}: ${result.diagnosis}${result.isolated ? '' : ' (inconclusive: a user-level install was present; rerun with --park-user-install true)'}${result.unexpected.length ? `; also loaded ${result.unexpected.join(', ')}` : ''}\n`);
  process.exitCode = results.every(result => result.routed && result.install_ok && result.isolated && !result.unexpected.length) ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(error => { console.error(error.message); process.exitCode = 2; });
