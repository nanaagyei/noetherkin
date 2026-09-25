import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { selectRoleAdapter } from '../adapters/runtime/select.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));
const terminal = path.join(repo, 'tests/terminal.py');

function temporary(t: { after: (f: () => void) => void }, prefix = 'noetherkin-cli-'): string {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function run(args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: options.cwd, env: { ...process.env, ...options.env } });
  return { ...result, json: args.includes('--json') && result.stdout ? JSON.parse(result.stdout) : undefined };
}
function fakeHost(directory: string, name: string): string {
  const file = path.join(directory, name);
  fs.writeFileSync(file, '#!/bin/sh\necho "fake 1.0"\n'); fs.chmodSync(file, 0o755);
  return file;
}
const noHosts = { NOETHERKIN_CODEX_BIN: '/nonexistent/codex', NOETHERKIN_CLAUDE_BIN: '/nonexistent/claude' };

test('help is scoped to one command and usage errors print only that command', t => {
  const cwd = temporary(t);
  const scoped = run(['track', '--help'], { cwd });
  assert.equal(scoped.status, 0); assert.match(scoped.stdout, /noetherkin track select <track-id>/); assert.doesNotMatch(scoped.stdout, /task submit-design/);
  assert.match(run(['help', 'task'], { cwd }).stdout, /task test --prediction/);
  assert.match(run([], { cwd }).stdout, /New here\? Run `noetherkin setup`/);
  // A malformed subcommand is a usage error even where no workspace exists.
  const malformed = run(['track', '--json'], { cwd });
  assert.equal(malformed.status, 2); assert.equal(malformed.json.diagnostics[0].code, 'USAGE'); assert.match(malformed.json.diagnostics[0].message, /track show <track-id>/);
  const unknownFlag = run(['status', '--bogus', '--json'], { cwd });
  assert.equal(unknownFlag.status, 2); assert.equal(unknownFlag.json.diagnostics[0].code, 'USAGE');
  const unknownCommand = run(['frob', '--json'], { cwd });
  assert.equal(unknownCommand.status, 2); assert.match(unknownCommand.json.diagnostics[0].message, /noetherkin help/);
});

test('state commands name an uninitialized workspace instead of failing on a missing directory', t => {
  const root = temporary(t);
  const status = run(['status', '--workspace', root, '--json']);
  assert.equal(status.status, 1); assert.equal(status.json.diagnostics[0].code, 'WORKSPACE_NOT_INITIALIZED'); assert.match(status.json.diagnostics[0].message, /noetherkin setup/);
  assert.deepEqual(fs.readdirSync(root), [], 'no lock or state is created by a refused inspection');
  const found = run(['status', '--json'], { cwd: root });
  assert.equal(found.json.diagnostics[0].code, 'WORKSPACE_NOT_FOUND');
});

test('doctor reports the environment without a workspace', t => {
  const cwd = temporary(t);
  const doctor = run(['doctor', '--json'], { cwd });
  const checks = doctor.json.data.environment.map((item: { check: string }) => item.check);
  assert.deepEqual(checks, ['node', 'platform', 'git']);
  assert.deepEqual(doctor.json.data.runtime_hosts.map((item: { check: string }) => item.check), ['role-host:codex', 'role-host:claude']);
});

test('role adapter selection prefers explicit choice, then a healthy detected host, and fails before any judgment', t => {
  const directory = temporary(t);
  const claude = fakeHost(directory, 'claude');
  const saved = { ...process.env };
  t.after(() => { for (const key of ['NOETHERKIN_CODEX_BIN', 'NOETHERKIN_CLAUDE_BIN', 'NOETHERKIN_ROLE_ADAPTER']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } });
  delete process.env.NOETHERKIN_ROLE_ADAPTER;
  process.env.NOETHERKIN_CODEX_BIN = '/nonexistent/codex'; process.env.NOETHERKIN_CLAUDE_BIN = claude;
  assert.equal(selectRoleAdapter({}).name, 'claude', 'codex is unavailable, so the working claude host is detected');
  assert.equal(selectRoleAdapter({ codex_bin: claude }).name, 'codex', 'a binary override names its adapter');
  assert.throws(() => selectRoleAdapter({ name: 'codex' }), { code: 'ROLE_ADAPTER_UNAVAILABLE' });
  process.env.NOETHERKIN_CLAUDE_BIN = '/nonexistent/claude';
  assert.throws(() => selectRoleAdapter({}), { code: 'ROLE_ADAPTER_UNAVAILABLE' });
  assert.throws(() => selectRoleAdapter({ name: 'bogus' }), { code: 'USAGE' });
});

test('onboarding checks the role host before asking for confirmation', t => {
  const root = temporary(t);
  const init = spawnSync('python3', [terminal, process.execPath, cli, root, 'initialize'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(JSON.parse(init.stdout).exit, 0, init.stdout);
  const track = spawnSync('python3', [terminal, process.execPath, cli, root, 'select', 'track'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(JSON.parse(track.stdout).exit, 0, track.stdout);
  const onboard = spawnSync('python3', [terminal, process.execPath, cli, root, 'onboard', 'onboard', path.join(root, 'missing-codex')], { encoding: 'utf8', timeout: 20000 });
  const result = JSON.parse(onboard.stdout);
  assert.equal(result.prompt_seen, false, 'no confirmation is requested when no judgment can run');
  assert.equal(result.output.diagnostics[0].code, 'ROLE_ADAPTER_UNAVAILABLE');
});

test('a noninteractive agent receives a handoff the learner approves in a terminal', t => {
  const root = temporary(t);
  const proposal = run(['init', '--workspace', root, '--name', 'Ada', '--goal', 'Learn', '--assistance-max', '3', '--json']);
  assert.equal(proposal.status, 3); assert.equal(proposal.json.outcome, 'proposal');
  const handoff = proposal.json.data.next_action;
  assert.equal(handoff.kind, 'terminal-handoff'); assert.match(handoff.command, /^noetherkin adapter-handoff --workspace /);
  assert.deepEqual(fs.readdirSync(root), [], 'a proposal writes nothing');
  const approved = spawnSync('python3', [terminal, process.execPath, cli, root, 'initialize', 'handoff', handoff.token], { encoding: 'utf8', timeout: 20000 });
  const result = JSON.parse(approved.stdout);
  assert.equal(result.exit, 0, approved.stdout); assert.equal(result.output.data.action, 'initialize');
  assert.equal(result.output.data.next_action.phase, 'TRACK SELECTION');
  const select = run(['track', 'select', 'ml-engineering', '--workspace', root, '--json']);
  assert.equal(select.json.data.next_action.kind, 'terminal-handoff', 'track selection is handed off the same way');
});

test('skills install detects agents, supports a user-level install, and refuses the checkout', t => {
  const home = temporary(t);
  const directory = temporary(t);
  const global = run(['skills', 'install', '--host', 'claude-code', '--global', '--skill', 'teach', '--json'], { env: { HOME: home } });
  assert.equal(global.status, 0, global.stdout); assert.ok(fs.existsSync(path.join(home, '.claude/skills/teach/SKILL.md')));
  const none = run(['skills', 'install', '--target', directory, '--json'], { env: noHosts });
  assert.equal(none.json.diagnostics[0].code, 'NO_AGENT_DETECTED');
  const detected = run(['skills', 'install', '--target', directory, '--skill', 'teach', '--json'], { env: { ...noHosts, NOETHERKIN_CLAUDE_BIN: fakeHost(directory, 'claude') } });
  assert.equal(detected.status, 0, detected.stdout); assert.equal(detected.json.data.host, 'claude-code');
  assert.ok(fs.existsSync(path.join(directory, '.claude/skills/teach/SKILL.md')));
  assert.ok(!fs.existsSync(path.join(directory, '.agents')), 'an undetected agent gets nothing');
  const checkout = run(['skills', 'install', '--host', 'generic', '--json'], { cwd: repo });
  assert.equal(checkout.json.diagnostics[0].code, 'INSTALL_TARGET_CHECKOUT');
  assert.equal(run(['skills', 'install', '--host', 'generic', '--global', '--json'], { env: { HOME: home } }).status, 2);
});

test('noninteractive setup reports and writes nothing', t => {
  const cwd = temporary(t); const home = temporary(t);
  // Real host binaries may create their own dot-directories when probed, so none are reachable here.
  const setup = run(['setup', '--json'], { cwd, env: { ...noHosts, HOME: home } });
  assert.ok([0, 3].includes(setup.status ?? -1), setup.stdout);
  assert.equal(setup.json.data.workspace, null);
  assert.equal(setup.json.diagnostics[0].code, 'DIRECT_CONSENT_REQUIRED');
  assert.deepEqual(fs.readdirSync(cwd), []); assert.deepEqual(fs.readdirSync(home), []);
});
