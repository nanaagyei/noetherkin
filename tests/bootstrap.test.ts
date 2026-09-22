import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { bindApprovedInit, existingInit, pendingPath, planRecovery, proposeInit, publishInit, recover, verifyBootstrapHistory } from '../core/bootstrap.js';
import { inspectWorkspace } from '../core/commands.js';
import { canonical, encode } from '../core/common.js';
import { parse } from '../core/parsing.js';
import { reclaimDeadLock, runtime, safePath, withLock } from '../core/storage.js';
import { collect, inspectRecords, validateDocument } from '../core/validation.js';

const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));
const worker = fileURLToPath(new URL('./worker.js', import.meta.url));
const repository = fileURLToPath(new URL('../../', import.meta.url));
const request = { display_name: 'Prince', goals: ['Explain and debug a system'], assistance_default_max: 3 };
function workspace(t: { after: (f: () => void) => void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'apprenticeship-test-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root;
}
function init(root: string) {
  const proposal = proposeInit(request);
  const output = publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  return { proposal, output };
}
function execute(root: string, command: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [cli, command, '--workspace', root, '--json', ...args], { encoding: 'utf8' });
  return { ...result, result: JSON.parse(result.stdout) };
}
function tree(root: string): string {
  const files: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full); else files[path.relative(root, full)] = fs.readFileSync(full).toString('base64');
    }
  }; walk(root); return canonical(files);
}
function mutate(root: string, file: string, change: (value: any) => void): void {
  const target = path.join(root, '.apprenticeship', file);
  const value = JSON.parse(fs.readFileSync(target, 'utf8')); change(value); fs.writeFileSync(target, encode(value));
}

test('bootstrap publishes only approved state, complete receipts, and administrative E0', t => {
  const root = workspace(t);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Existing learner instructions\n');
  const { output } = init(root);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), 'Existing learner instructions\n');
  assert.equal(output.output_record_ids.length, 8);
  assert.equal(fs.existsSync(path.join(root, pendingPath)), false);
  for (const command of ['status', 'validate', 'doctor']) {
    const run = execute(root, command); assert.equal(run.status, 0, run.stdout);
    assert.equal(run.result.coverage, 'bootstrap'); assert.equal(run.result.data.standing.effective_level, 'E0');
  }
  const receipt = verifyBootstrapHistory(root);
  assert.equal(receipt.changes.length, 6);
  assert.ok(receipt.changes.every((c: any) => c.old_digest === null && c.old_snapshot === null));
  const petClinic = execute(root, 'projects').result.data.projects.find((item: any) => item.id === 'spring-petclinic-microservices');
  assert.equal(petClinic.live_selection_available, true);
});

test('exact retry and normal repeated init return original IDs without modifying bytes', t => {
  const root = workspace(t); const { output, proposal } = init(root); const before = tree(root);
  assert.deepEqual(existingInit(root, request, proposal.operation_id), output);
  assert.equal(execute(root, 'init').result.outcome, 'no-change');
  assert.equal(tree(root), before);
  assert.throws(() => existingInit(root, { ...request, display_name: 'Other learner' }, proposal.operation_id), /inputs differ/);
  assert.throws(() => existingInit(root, request, runtime.id('OP')), /different initialization operation/);
  assert.equal(tree(root), before);
});

test('untrusted bindings, changed approved input, and denied consent cannot publish', t => {
  const root = workspace(t); const proposal = proposeInit(request);
  assert.throws(() => publishInit(root, proposal, { actor: proposal.principals[1] }), /direct controller/);
  assert.throws(() => bindApprovedInit(root, proposal, false), /not approved/);
  const capability = bindApprovedInit(root, proposal, true);
  proposal.principals[1]!.role = 'learner';
  assert.throws(() => publishInit(root, proposal, capability), /direct controller/);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('noninteractive init is proposal-only; missing or malformed inputs are usage failures', t => {
  const root = workspace(t);
  const run = execute(root, 'init', '--name', 'Prince', '--goal', 'Learn', '--assistance-max', '3');
  assert.equal(run.status, 3); assert.equal(run.result.outcome, 'proposal'); assert.deepEqual(fs.readdirSync(root), []);
  assert.equal(execute(root, 'init').status, 2);
  assert.equal(execute(root, 'init', '--yes').status, 2);
  assert.equal(execute(root, 'init', '--actor', 'ACTOR-forged').status, 2);
  assert.equal(execute(root, 'init', '--operation-id', 'invalid').status, 2);
  assert.equal(execute(root, 'status', '--name', 'ignored').status, 2);
  assert.equal(execute(root, 'init', '--name', 'Prince', '--goal', 'Learn', '--assistance-max', '9').status, 2);
  assert.deepEqual(fs.readdirSync(root), []);
});

test('nested inspection discovers the nearest workspace; explicit path takes precedence', t => {
  const root = workspace(t); init(root); fs.mkdirSync(path.join(root, 'source/nested'), { recursive: true });
  const run = spawnSync(process.execPath, [cli, 'status', '--json'], { cwd: path.join(root, 'source/nested'), encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout); assert.equal(JSON.parse(run.stdout).data.workspace, root);
  const other = workspace(t);
  const explicit = spawnSync(process.execPath, [cli, 'status', '--workspace', other, '--json'], { cwd: root, encoding: 'utf8' });
  assert.equal(explicit.status, 1);
});

for (const [name, specimen] of Object.entries({
  // Reinterpretation and aliasing hazards.
  duplicate: 'a: 1\na: 2', flowDuplicate: '{"a": 1, "a": 2}', nestedDuplicate: '{"o": {"a": 1, "a": 2}}',
  alias: 'a: &a hello\nb: *a', tag: 'a: !!str hello', key: '1: value', complexKey: '? [a, b]\n: value',
  multidoc: 'a: 1\n---\nb: 2', invalidUtf8: Buffer.from([0xff]),
  // Numbers outside the JSON syntax and exact-integer range the state model permits.
  infinity: 'a: .inf', nan: 'a: .nan', unsafeInteger: 'a: 123456789012345678901234567890',
  hexNumber: 'a: 0x1F', octalNumber: 'a: 0o17',
  // A record is a mapping; every other document shape is refused rather than coerced.
  sequenceRoot: '[1, 2, 3]', scalarRoot: '"just a string"', nullRoot: 'null', emptyDocument: '',
})) {
  test(`strict parser rejects ${name}`, () => assert.throws(() => parse(specimen, name), { code: 'YAML_INVALID' }));
}
test('YAML 1.2 and canonical JSON preserve strings, Unicode, booleans and timestamps', () => {
  const value = { on: 'on', off: 'off', number: '012', timestamp: '2026-09-13T00:00:00Z', enabled: true, unknown: null, learner: 'Agyei 日本' };
  assert.deepEqual(parse(encode(value), 'canonical'), value);
  assert.deepEqual(parse('on: on\noff: off\n"012": "012"\ntimestamp: 2026-09-13T00:00:00Z\nflag: true', 'yaml'), { on: 'on', off: 'off', '012': '012', timestamp: '2026-09-13T00:00:00Z', flag: true });
  // 1.2 core schema leaves an underscored digit group a string; a 1.1 loader would read it as the integer 1000.
  assert.deepEqual(parse('grouped: 1_000', 'yaml'), { grouped: '1_000' });
});

test('all workspace schemas reject unknown fields and unsupported versions without coercion', () => {
  const example = path.join(repository, 'examples/spring-petclinic');
  const records = collect(example);
  const schemaNames = new Set<string>();
  const names: Record<string, string> = { 'config.yaml': 'apprenticeship-config', 'profile.yaml': 'learner-profile', 'current-project.yaml': 'current-project', 'current-track.yaml': 'current-track', 'competencies.yaml': 'competency-state', projects: 'project', work: 'task', evidence: 'evidence', assessments: 'assessment', reviews: 'review' };
  for (const [file, value] of records) {
    const schema = names[file] ?? names[file.split('/')[0]!]!; schemaNames.add(schema);
    const original = canonical(value); validateDocument(value, schema, file);
    assert.throws(() => validateDocument({ ...value, unknown: true }, schema, file));
    assert.throws(() => validateDocument({ ...value, schema_version: '1.0' }, schema, file));
    assert.equal(canonical(value), original);
  }
  assert.equal(schemaNames.size, 10);
});

test('later fixture state receives incomplete semantics and no computed standing', () => {
  const root = path.join(repository, 'examples/spring-petclinic');
  // Inspect in memory: the specification fixture is never changed by this test.
  const report = inspectRecords(collect(root), root);
  assert.deepEqual(report.diagnostics, []);
  assert.equal(report.advanced, true);
});

test('cache edits, missing receipts, and learner conflicts are detected without repair', t => {
  const root = workspace(t); init(root);
  mutate(root, 'competencies.yaml', value => { value.effective_level = 'E5'; });
  const before = tree(root); const run = execute(root, 'status');
  assert.equal(run.status, 1); assert.ok(run.result.diagnostics.some((d: any) => d.code === 'CACHE_MISMATCH'));
  assert.equal(run.result.data.standing, undefined); assert.equal(tree(root), before);
  const other = workspace(t); init(other);
  const receipts = path.join(other, '.apprenticeship/operations'); fs.unlinkSync(path.join(receipts, fs.readdirSync(receipts)[0]!));
  assert.equal(execute(other, 'doctor').status, 1);
  mutate(other, 'profile.yaml', value => { value.learner_id = runtime.id('LEARNER'); });
  assert.ok(execute(other, 'validate').result.diagnostics.some((d: any) => d.code === 'IDENTITY_MISMATCH'));
});

test('unsupported manual onboarding is invalid rather than an invented standing', t => {
  const root = workspace(t); init(root);
  mutate(root, 'profile.yaml', value => { value.onboarding = 'complete'; });
  const before = tree(root); const run = execute(root, 'status');
  assert.equal(run.status, 1); assert.equal(run.result.coverage, 'simulation');
  assert.equal(run.result.data.standing, undefined); assert.equal(tree(root), before);
});

test('reference types, fixture/live isolation, ID uniqueness, and catalog membership are checked', () => {
  const root = path.join(repository, 'examples/spring-petclinic');
  for (const [code, alter] of [
    ['REFERENCE_INVALID', (r: Map<string, any>) => { r.get('profile.yaml').baseline_assessment_id = 'missing'; }],
    ['DATA_CLASS_MISMATCH', (r: Map<string, any>) => { r.get('profile.yaml').data_class = 'live'; }],
    ['DUPLICATE_ID', (r: Map<string, any>) => { const p = r.get('config.yaml').principals; p[1].id = p[0].id; }],
    ['COMPETENCY_INVALID', (r: Map<string, any>) => { r.get('profile.yaml').specialization_competencies = ['not-real']; }]
  ] as const) {
    const records = collect(root); alter(records);
    assert.ok(inspectRecords(records, root).diagnostics.some(d => d.code === code), code);
  }
});

test('traversal, symlink state, and receipt path injection are rejected', t => {
  const root = workspace(t); const outside = workspace(t);
  assert.throws(() => safePath(root, '../outside'), /without traversal/);
  fs.symlinkSync(outside, path.join(root, 'escape')); assert.throws(() => safePath(root, 'escape/file'), /symbolic links/);
  init(root);
  fs.symlinkSync(outside, path.join(root, '.apprenticeship/knowledge'));
  assert.equal(execute(root, 'validate').status, 1);
  fs.unlinkSync(path.join(root, '.apprenticeship/knowledge'));
  const receiptDir = path.join(root, '.apprenticeship/operations');
  const receiptFile = `operations/${fs.readdirSync(receiptDir)[0]}`;
  mutate(root, receiptFile, value => { value.changes[0].path = '../outside'; });
  assert.equal(execute(root, 'doctor').status, 1);
});

test('stale reads and lost locks stop publication', t => {
  const root = workspace(t); const proposal = proposeInit(request);
  const rt = { ...runtime, boundary: (name: string) => { if (name === 'validated') { fs.mkdirSync(path.join(root, '.apprenticeship')); fs.writeFileSync(path.join(root, '.apprenticeship/config.yaml'), 'unexpected'); } } };
  assert.throws(() => publishInit(root, proposal, bindApprovedInit(root, proposal, true), rt), /appeared after validation/);
  assert.equal(fs.readFileSync(path.join(root, '.apprenticeship/config.yaml'), 'utf8'), 'unexpected');
  const other = workspace(t); const p = proposeInit(request);
  const lost = { ...runtime, boundary: (name: string) => { if (name === 'prepared') fs.writeFileSync(path.join(other, '.apprenticeship.lock/owner.json'), '{"token":"someone-else"}'); } };
  assert.throws(() => publishInit(other, p, bindApprovedInit(other, p, true), lost), /Lock ownership changed/);
  assert.equal(fs.existsSync(path.join(other, '.apprenticeship/config.yaml')), false);
});

test('unavailable durability primitives preserve proposal-only state while inspection still works', t => {
  const root = workspace(t); const proposal = proposeInit(request);
  const rt = { ...runtime, fs: { ...fs, fsyncSync: () => { throw new Error('unsupported fsync'); } } as typeof fs };
  assert.throws(() => publishInit(root, proposal, bindApprovedInit(root, proposal, true), rt), /fsync is unavailable/);
  assert.deepEqual(fs.readdirSync(root), []);
  init(root);
  assert.equal(inspectWorkspace('validate', root, rt).outcome, 'success');
});

test('a file appearing at the final publication syscall is never clobbered', t => {
  const root = workspace(t); const proposal = proposeInit(request);
  const rt = { ...runtime, fs: { ...fs, linkSync: (old: fs.PathLike, target: fs.PathLike) => {
    if (String(target).endsWith('/config.yaml')) fs.writeFileSync(target, 'concurrent external content');
    fs.linkSync(old, target);
  } } as typeof fs };
  assert.throws(() => publishInit(root, proposal, bindApprovedInit(root, proposal, true), rt), /not overwritten/);
  assert.equal(fs.readFileSync(path.join(root, '.apprenticeship/config.yaml'), 'utf8'), 'concurrent external content');
  assert.equal(fs.existsSync(path.join(root, '.apprenticeship/operations')), false);
  assert.throws(() => planRecovery(root), /differ from/);
});

test('an I/O failure during publication leaves a pending transaction and no false receipt', t => {
  const root = workspace(t); const proposal = proposeInit(request);
  let publishing = false;
  const rt = { ...runtime, boundary: (name: string) => { if (name === 'prepared') publishing = true; }, fs: { ...fs, fsyncSync: (fd: number) => {
    if (publishing) { publishing = false; throw new Error('injected disk failure'); }
    fs.fsyncSync(fd);
  } } as typeof fs };
  assert.throws(() => publishInit(root, proposal, bindApprovedInit(root, proposal, true), rt), /disk failure/);
  assert.equal(fs.existsSync(path.join(root, pendingPath)), true);
  assert.equal(fs.existsSync(path.join(root, '.apprenticeship/operations')), false);
  // Depending on the failed syscall, leftover temporary files conservatively block recovery.
  const status = execute(root, 'status'); assert.equal(status.status, 3);
});

// These are actual process deaths, not caught exceptions that run lock cleanup.
for (let boundary = 1; boundary <= 16; boundary++) {
  test(`SIGKILL at publication boundary ${boundary} preserves recoverable or explicitly blocked state`, t => {
    const root = workspace(t);
    const run = spawnSync(process.execPath, [worker, root, 'kill', String(boundary)], { encoding: 'utf8' });
    assert.equal(run.signal, 'SIGKILL', run.stderr);
    assert.equal(execute(root, 'status').status, 3);
    reclaimDeadLock(root);
    if (boundary === 1) { assert.equal(fs.existsSync(path.join(root, '.apprenticeship')), false); return; }
    if (boundary <= 7) {
      // No durable manifest means intent cannot be authenticated; do not guess or erase staging.
      const before = tree(root); assert.equal(execute(root, 'doctor').status, 1); assert.equal(tree(root), before); return;
    }
    if (boundary < 16) {
      assert.equal(execute(root, 'status').status, 3);
      const recovery = withLock(root, () => planRecovery(root));
      assert.equal(recovery.action, boundary === 15 ? 'cleanup' : 'complete');
      recover(root, recovery);
    }
    assert.equal(execute(root, 'validate').status, 0);
  });
}

test('damaged staged snapshot rolls back only unpublished creations, including after interrupted rollback', t => {
  const root = workspace(t);
  spawnSync(process.execPath, [worker, root, 'kill', '9']); reclaimDeadLock(root);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, pendingPath), 'utf8'));
  const snapshot = manifest.changes[0].new_snapshot.uri.slice('workspace:/'.length);
  fs.writeFileSync(path.join(root, snapshot), 'damaged');
  assert.equal(planRecovery(root).action, 'rollback');
  const killed = spawnSync(process.execPath, [worker, root, 'recover-kill', '0']); assert.equal(killed.signal, 'SIGKILL');
  reclaimDeadLock(root); const plan = planRecovery(root); assert.equal(plan.action, 'rollback'); recover(root, plan);
  assert.equal(fs.existsSync(path.join(root, '.apprenticeship')), false);
  init(root); assert.equal(execute(root, 'validate').status, 0);
});

test('external edits, malformed manifests, and altered committed snapshots block recovery', t => {
  const root = workspace(t); spawnSync(process.execPath, [worker, root, 'kill', '10']); reclaimDeadLock(root);
  fs.writeFileSync(path.join(root, '.apprenticeship/config.yaml'), 'external edit');
  const before = tree(root); assert.throws(() => planRecovery(root), /differ from/); assert.equal(tree(root), before);
  const other = workspace(t); spawnSync(process.execPath, [worker, other, 'kill', '15']); reclaimDeadLock(other);
  const manifest = JSON.parse(fs.readFileSync(path.join(other, pendingPath), 'utf8'));
  fs.writeFileSync(path.join(other, manifest.changes[0].new_snapshot.uri.slice('workspace:/'.length)), 'damage');
  assert.throws(() => planRecovery(other), /snapshot digest/);
  mutate(other, 'pending.json', value => { value.unknown = true; }); assert.throws(() => planRecovery(other), /envelope fields/);
});

test('recovery rechecks the reviewed snapshot and noninteractive recovery is proposal-only', t => {
  const root = workspace(t); spawnSync(process.execPath, [worker, root, 'kill', '8']); reclaimDeadLock(root);
  const plan = planRecovery(root); const before = tree(root);
  const run = execute(root, 'doctor', '--recover'); assert.equal(run.status, 3); assert.equal(run.result.outcome, 'proposal'); assert.equal(tree(root), before);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, pendingPath), 'utf8'));
  fs.writeFileSync(path.join(root, manifest.changes[0].new_snapshot.uri.slice('workspace:/'.length)), 'damage');
  assert.throws(() => recover(root, plan), /changed after review/);
});

test('concurrent initializer and reader cannot enter a held publication lock', async t => {
  const root = workspace(t);
  const child = spawn(process.execPath, [worker, root, 'hold', '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill('SIGKILL'); });
  await once(child.stdout, 'data');
  assert.equal(execute(root, 'status').status, 3);
  assert.throws(() => reclaimDeadLock(root), /alive or unverifiable/);
  const second = spawnSync(process.execPath, [worker, root, 'normal', '0'], { encoding: 'utf8' });
  assert.notEqual(second.status, 0); assert.match(second.stderr, /locked/);
  child.kill('SIGKILL'); await once(child, 'exit');
  reclaimDeadLock(root); recover(root, planRecovery(root));
  assert.equal(execute(root, 'validate').status, 0);
});
