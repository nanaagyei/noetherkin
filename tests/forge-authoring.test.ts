import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkForgeDirectory, scaffoldForge, type AuthoringProblem } from '../core/authoring.js';
import { catalogs } from '../core/validation.js';

// Issue #17: forge check applies the existing forge rules to an authored directory and reports all of them at once.

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));

function temporary(t: { after: (fn: () => void) => void }): string {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-authoring-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
const errors = (problems: AuthoringProblem[]) => problems.filter(problem => problem.severity === 'error');
const codes = (problems: AuthoringProblem[], severity = 'error') => [...new Set(problems.filter(problem => problem.severity === severity).map(problem => problem.code))].sort();

type Authored = { record: Record<string, any>; task: Record<string, any>; root: string };
/** A scaffold with every TODO replaced by real text, which passes clean; `mutate` seeds exactly one defect. */
function authored(t: { after: (fn: () => void) => void }, mutate: (forge: Authored) => void = () => {}): string {
  const root = temporary(t);
  const { files } = scaffoldForge('water-ledger', root, 'ml-engineering');
  const [recordFile, taskFile] = files.map(file => path.join(root, file)) as [string, string];
  const load = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8').replaceAll('TODO: ', ''));
  const forge = { record: load(recordFile), task: load(taskFile), root };
  mutate(forge);
  fs.rmSync(recordFile);
  fs.writeFileSync(path.join(root, 'catalog/forge', `${forge.record.id}.yaml`), JSON.stringify(forge.record, null, 2));
  fs.writeFileSync(taskFile, JSON.stringify(forge.task, null, 2));
  return root;
}

test('forge check passes on each shipped forge copied into a temporary directory', t => {
  for (const forge of catalogs().forges) {
    const root = temporary(t);
    fs.cpSync(path.join(repository, 'catalog/forge', `${forge.id}.yaml`), path.join(root, 'catalog/forge', `${forge.id}.yaml`), { recursive: true });
    for (const pack of forge.task_packs) fs.cpSync(path.join(repository, 'tasks/forge', pack), path.join(root, 'tasks/forge', pack), { recursive: true });
    const check = checkForgeDirectory(root);
    assert.deepEqual(errors(check.problems), [], `${forge.id}: ${JSON.stringify(check.problems)}`);
    assert.deepEqual(codes(check.problems, 'warning'), [], forge.id);
    assert.deepEqual(codes(check.problems, 'note'), ['UPDATES_SHIPPED_FORGE'], 'a shipped ID is checked as an edit, not a collision');
  }
});

test('forge new output fails forge check only on TODO markers, and passes once they are replaced', t => {
  const root = temporary(t);
  scaffoldForge('water-ledger', root, 'ml-engineering');
  const check = checkForgeDirectory(root);
  assert.deepEqual(codes(check.problems), ['TODO_MARKER']);
  assert.equal(errors(check.problems).length, 2, 'one TODO problem per file');
  assert.deepEqual(check.problems.filter(problem => problem.severity !== 'error'), []);
  assert.deepEqual(checkForgeDirectory(authored(t)).problems, [], 'the scaffold is otherwise complete');
  assert.throws(() => scaffoldForge('water-ledger', root, 'ml-engineering'), { code: 'SOURCE_CONFLICT' }, 'never overwrites');
  assert.throws(() => scaffoldForge('eval-ledger', temporary(t), 'ml-engineering'), { code: 'ID_COLLISION' });
  assert.throws(() => scaffoldForge('Water Ledger', temporary(t), 'ml-engineering'), { code: 'INPUT_INVALID' });
  assert.throws(() => scaffoldForge('water-ledger', temporary(t), 'no-such-track'), { code: 'TRACK_UNKNOWN' });
});

// Each rule in the issue, seeded alone into an otherwise clean forge, produces its own diagnostic.
const seeded: [string, string, (forge: Authored) => void, string?][] = [
  ['record schema', 'FORGE_SCHEMA', ({ record }) => { delete record.problem; }],
  ['task template schema', 'TASK_SCHEMA', ({ task }) => { delete task.title; }],
  ['a field assigned at runtime in a template', 'TASK_SCHEMA', ({ task }) => { task.status = 'assigned'; }],
  ['an unknown competency', 'COMPETENCY_UNKNOWN', ({ record, task }) => { record.competencies.push('core.telepathy'); task.secondary_competencies.push('core.telepathy'); }],
  ['an unknown track', 'TRACK_UNKNOWN', ({ record }) => { record.track_alignment.push('no-such-track'); }],
  ['an aligned track the forge does not exercise', 'TRACK_NOT_EXERCISED', ({ record }) => { record.track_alignment.push('frontend-engineering'); }],
  ['competencies that are not the union of the tasks', 'COMPETENCY_MISMATCH', ({ record }) => { record.competencies.push('ml.evaluation'); }],
  ['a sequence gap', 'SEQUENCE_INVALID', ({ task }) => { task.sequence = 2; }],
  ['a task naming another pack', 'TASK_OWNER_MISMATCH', ({ task }) => { task.pack_id = 'water-ledger-extra'; }],
  ['a non-JSON file in the pack', 'FORGE_SOLUTION_SHIPPED', ({ root }) => { fs.writeFileSync(path.join(root, 'tasks/forge/water-ledger-core/solution.py'), 'def run(): ...\n'); }],
  ['a pack with no tasks', 'PACK_MISSING', ({ record }) => { record.task_packs.push('water-ledger-extra'); }],
  ['an ID taken by a catalog project', 'ID_COLLISION', ({ record, task }) => { record.id = 'spring-petclinic-microservices'; task.forge_id = record.id; }],
  ['a task ID taken by another forge', 'ID_COLLISION', ({ task }) => { task.id = 'eval-ledger-01-case-set'; }],
  ['an attested criterion that does not exist', 'ATTESTATION_UNKNOWN', ({ task }) => { task.attested_criteria = ['AC-nope']; }],
  ['constraints that allow pushing', 'PUSH_NOT_FORBIDDEN', ({ task }) => { task.constraints = ['Standard library only.']; }],
  ['constraints that allow publishing', 'PUBLISH_NOT_FORBIDDEN', ({ task }) => { task.constraints = ['Do not push to a remote or open a pull request as part of this task.']; }],
  ['a new forge that is not draft', 'STATUS_NOT_DRAFT', ({ record }) => { record.status = 'supported'; }],
  ['an ID that differs from the file name', 'FORGE_ID_MISMATCH', () => {}],
  ['a criterion needing another person with no attestation', 'ATTESTATION_MISSING', ({ task }) => { task.acceptance_criteria[0].criterion = 'Someone other than the learner runs the quickstart and the result is recorded.'; }, 'warning'],
  ['a task with no explanation criterion', 'EXPLANATION_MISSING', ({ task }) => { task.acceptance_criteria = task.acceptance_criteria.filter((item: { id: string }) => item.id !== 'AC-explanation'); }, 'warning'],
  ['a pack no record lists', 'PACK_UNREFERENCED', ({ root }) => { fs.mkdirSync(path.join(root, 'tasks/forge/stray-pack')); }, 'warning']
];
for (const [rule, code, mutate, severity = 'error'] of seeded) test(`forge check reports ${code} for ${rule}`, t => {
  const root = code === 'FORGE_ID_MISMATCH' ? idMismatch(t) : authored(t, mutate);
  const check = checkForgeDirectory(root);
  assert.ok(check.problems.some(problem => problem.code === code && problem.severity === severity), `${rule}: ${JSON.stringify(check.problems)}`);
  for (const problem of check.problems) assert.ok(problem.try.length > 0, 'every problem carries a remedy');
});

/** The record's ID and file name disagree, which `authored` cannot express because it names the file after the ID. */
function idMismatch(t: { after: (fn: () => void) => void }): string {
  const root = authored(t);
  const file = path.join(root, 'catalog/forge/water-ledger.yaml');
  fs.renameSync(file, path.join(root, 'catalog/forge/water-log.yaml'));
  return root;
}

test('forge check reports syntax errors and a missing record instead of stopping', t => {
  assert.deepEqual(codes(checkForgeDirectory(temporary(t)).problems), ['FORGE_MISSING']);
  const root = authored(t);
  fs.writeFileSync(path.join(root, 'tasks/forge/water-ledger-core/02-broken.json'), '{ "id": ');
  fs.writeFileSync(path.join(root, 'catalog/forge/broken.yaml'), 'id: [unclosed\n');
  const found = codes(checkForgeDirectory(root).problems);
  assert.ok(found.includes('JSON_INVALID') && found.includes('YAML_INVALID'), JSON.stringify(found));
});

test('forge check reports every problem in one run', t => {
  const root = authored(t, ({ record, task }) => { record.status = 'supported'; task.sequence = 3; task.constraints = ['Standard library only.']; });
  assert.deepEqual(codes(checkForgeDirectory(root).problems), ['PUBLISH_NOT_FORBIDDEN', 'PUSH_NOT_FORBIDDEN', 'SEQUENCE_INVALID', 'STATUS_NOT_DRAFT']);
});

test('the CLI exits nonzero on errors, zero on a clean forge, and needs no workspace', t => {
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd: os.tmpdir() });
  const root = temporary(t);
  const created = run('forge', 'new', 'water-ledger', root, '--track', 'ml-engineering', '--json');
  assert.equal(created.status, 0, created.stderr);
  assert.deepEqual(JSON.parse(created.stdout).data.files, ['catalog/forge/water-ledger.yaml', 'tasks/forge/water-ledger-core/01-first-task.json']);
  const failing = run('forge', 'check', root);
  assert.equal(failing.status, 1);
  assert.match(failing.stderr, /TODO_MARKER[\s\S]*Try: /);
  const passing = run('forge', 'check', authored(t), '--json');
  assert.equal(passing.status, 0, passing.stdout);
  assert.equal(JSON.parse(passing.stdout).outcome, 'success');
  assert.equal(run('forge', 'new', 'water-ledger').status, 2, '--track is required');
  assert.equal(run('forge', 'check').status, 2);
});
