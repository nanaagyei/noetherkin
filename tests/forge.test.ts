import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { ScriptedRoleAdapter } from '../core/adapters.js';
import { inspectWorkspace } from '../core/commands.js';
import { runtime } from '../core/storage.js';
import { runnablePaths, selectTrack } from '../core/tracks.js';
import { catalogs, validateDocument } from '../core/validation.js';
import { forgePack, validateForgeRecord } from '../core/packs.js';
import { assignTask, attestCriterion, beginTask, codeReview, currentTask, nextAction, onboard, selectCatalogProject, selectForge, submitChange, submitDesign, taskReview, testTask, validateSimulationCandidate } from '../core/simulation.js';

// ACP-015 conformance: CF-42, CF-43, CF-45 and FR-42 to FR-46. CF-44 (resume-evidence wording) is a behavioral case.

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
async function workspace(t: { after: (fn: () => void) => void }, trackId = 'ml-engineering'): Promise<string> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-forge-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Build an evaluation harness'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  selectTrack(root, trackId, files => validateSimulationCandidate(root, files));
  await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No inspected learner work exists.' }]));
  return root;
}
const forgeRecord = () => structuredClone(catalogs().forges.find(item => item.id === 'eval-ledger')!);
const context = () => { const { competencyIds, coreCompetencyIds, tracks } = catalogs(); return { competencyIds, coreCompetencyIds, tracks }; };

test('CF-42: selecting a forge project binds an empty learner directory with no clone and no commit pin', async t => {
  const root = await workspace(t);
  const result = selectForge(root, 'eval-ledger', 'source');
  assert.equal(result.outcome, 'success');
  assert.deepEqual(fs.readdirSync(path.join(root, 'source')), [], 'nothing is cloned or written into source');
  const selection = JSON.parse(fs.readFileSync(path.join(root, '.apprenticeship/current-project.yaml'), 'utf8'));
  assert.deepEqual({ kind: selection.kind, project_id: selection.project_id, source_path: selection.source_path, source_revision: selection.source_revision }, { kind: 'forge', project_id: 'eval-ledger', source_path: 'source', source_revision: null });
  assert.ok(fs.existsSync(path.join(root, '.apprenticeship/forge/eval-ledger.yaml')), 'the specification is pinned in the workspace');
  assert.match(String(result.status_note), /draft/);
  assert.equal(inspectWorkspace('validate', root).outcome, 'success');
  assert.equal(selectForge(root, 'eval-ledger', 'source').outcome, 'no-change');
  assert.deepEqual(nextAction(root), { phase: 'ASSIGN FIRST TASK', command: 'task assign', run: `noetherkin task assign --workspace ${root}` }, 'no codebase map is required before the first forge task');
});

test('FR-44: a forge selection is never cloned and never lands on existing code', async t => {
  const root = await workspace(t);
  const clone = spawnSync(process.execPath, [cli, 'project', 'select', 'eval-ledger', '--clone-to', 'elsewhere', '--workspace', root, '--json'], { encoding: 'utf8' });
  assert.notEqual(clone.status, 0);
  assert.equal(JSON.parse(clone.stdout).diagnostics[0].code, 'FORGE_NOT_CLONABLE');
  assert.ok(!fs.existsSync(path.join(root, 'elsewhere')));
  fs.mkdirSync(path.join(root, 'occupied')); fs.writeFileSync(path.join(root, 'occupied/main.py'), 'print(1)\n');
  assert.throws(() => selectForge(root, 'eval-ledger', 'occupied'), { code: 'SOURCE_CONFLICT' });
  assert.throws(() => selectForge(root, 'eval-ledger', '../outside'), { code: 'UNSAFE_PATH' });
});

for (const forge of catalogs().forges) test(`CF-43 and CF-45: the whole ${forge.id} pack runs with no upstream, then an upstream switch keeps forge evidence valid`, async t => {
  const root = await workspace(t, forge.track_alignment[0]);
  selectForge(root, forge.id, 'source');
  const source = path.join(root, 'source');
  git(source, 'init'); git(source, 'config', 'user.email', 'learner@example.invalid'); git(source, 'config', 'user.name', 'Learner');
  const design = path.join(root, 'design.md');
  fs.writeFileSync(design, '# Contract\nCases live in a data file.\n# Alternative\nHard-coded cases were rejected.\n# Tests\npython -m pytest\n# First failure\nA malformed case file.\n');
  const templates = forge.task_packs.flatMap((pack: string) => forgePack(pack));
  for (const [index, template] of templates.entries()) {
    const adapter = new ScriptedRoleAdapter([
      { decision: 'approve', rationale: 'The design names behavior, a rejected alternative, tests and a failure case.', risks: [] },
      { outcome: 'approve', findings: ['The change satisfies the bounded task.'] },
      { outcome: 'accepted', findings: ['Every criterion has a current artifact.'], evidence_rationale: 'One reviewed bounded change with a passing test run.' },
    ]);
    const assigned = assignTask(root);
    assert.equal(assigned.outcome, 'success', JSON.stringify(assigned));
    const task = currentTask(root)!;
    assert.equal(task.project_id, forge.id); assert.equal(task.title, template.title);
    for (const key of ['forge_id', 'pack_id', 'sequence', 'attested_criteria', 'compatibility']) assert.ok(!(key in task), `${key} is pack-only`);
    beginTask(root); await submitDesign(root, design, adapter);
    fs.writeFileSync(path.join(source, `step_${index + 1}.py`), `STEP = ${index + 1}\n`);
    submitChange(root);
    assert.throws(() => testTask(root, 'Tests pass.'), { code: 'INPUT_REQUIRED' }, 'a forge task declares its own test command');
    assert.equal(testTask(root, 'Tests pass.', runtime, 'test -f step_1.py').outcome, 'success');
    assert.equal((await codeReview(root, adapter)).review_outcome, 'approve');
    for (const criterion of template.attested_criteria ?? []) {
      await assert.rejects(taskReview(root, adapter), { code: 'ATTESTATION_MISSING' });
      const notes = path.join(root, `${criterion}.md`);
      fs.writeFileSync(notes, 'A colleague who had not seen the code followed the README alone. They stalled once on the input format.\n');
      attestCriterion(root, criterion, notes);
    }
    const review = await taskReview(root, adapter);
    assert.equal(review.outcome, 'success', JSON.stringify(review));
    const completed = currentTask(root)!;
    for (const criterion of template.attested_criteria ?? []) assert.match(completed.validation.find((item: { criterion_id: string }) => item.criterion_id === criterion).artifact.uri, /attestations/);
    git(source, 'add', '.'); git(source, 'commit', '-m', `step ${index + 1}`);
    assert.equal(nextAction(root).command, index + 1 < templates.length ? 'task assign' : 'review performance');
  }
  assert.equal(assignTask(root).pack_complete, true);
  assert.equal(inspectWorkspace('validate', root).outcome, 'success', JSON.stringify(inspectWorkspace('validate', root).diagnostics));

  // CF-45: move to an upstream project. The forge evidence stays valid and citable; nothing is re-baselined.
  const upstream = path.join(root, 'upstream');
  const customers = 'spring-petclinic-customers-service/src/main/java/org/springframework/samples/petclinic/customers/web';
  fs.mkdirSync(path.join(upstream, customers), { recursive: true });
  fs.writeFileSync(path.join(upstream, 'pom.xml'), '<module>spring-petclinic-customers-service</module>\n');
  fs.writeFileSync(path.join(upstream, 'mvnw'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(upstream, customers, 'PetResource.java'), 'class PetResource { void findPetTypeById(){} }\n');
  git(upstream, 'init'); git(upstream, 'config', 'user.email', 'learner@example.invalid'); git(upstream, 'config', 'user.name', 'Learner');
  git(upstream, 'remote', 'add', 'origin', 'https://github.com/spring-petclinic/spring-petclinic-microservices.git'); git(upstream, 'add', '.'); git(upstream, 'commit', '-m', 'base');
  const evidenceBefore = fs.readdirSync(path.join(root, '.apprenticeship/evidence')).sort();
  assert.equal(selectCatalogProject(root, 'spring-petclinic-microservices', 'upstream').outcome, 'success');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.apprenticeship/current-project.yaml'), 'utf8')).kind, 'upstream');
  assert.deepEqual(fs.readdirSync(path.join(root, '.apprenticeship/evidence')).sort(), evidenceBefore);
  assert.equal(inspectWorkspace('validate', root).outcome, 'success', JSON.stringify(inspectWorkspace('validate', root).diagnostics));
});

test('every forge is routed from each track it aligns to, and exercises a required competency of each', () => {
  const { forges, tracks } = catalogs();
  for (const forge of forges) for (const trackId of forge.track_alignment) {
    const track = tracks.find(item => item.id === trackId)!;
    assert.ok(track.required_competencies.some((id: string) => forge.competencies.includes(id)), `${forge.id} exercises nothing ${trackId} requires`);
    assert.ok(runnablePaths(trackId).some(item => item.kind === 'forge' && item.id === forge.id), `${trackId} does not route to ${forge.id}`);
  }
  const listed = spawnSync(process.execPath, [cli, 'forges', '--track', 'frontend-engineering', '--json'], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(listed.stdout).data.forges.map((item: { id: string }) => item.id), ['accessible-data-table']);
});

test('FR-42 and FR-43: an empty task pack or an upstream identity is rejected', () => {
  const empty = forgeRecord(); empty.task_packs = [];
  assert.throws(() => validateDocument(empty, 'forge', 'eval-ledger.yaml'), { code: 'SCHEMA_INVALID' });
  assert.throws(() => validateForgeRecord(empty, 'eval-ledger.yaml', context()), { code: 'CATALOG_INVALID' });
  for (const field of ['repository_url', 'upstream_organization']) {
    const upstream = { ...forgeRecord(), [field]: 'https://github.com/example/eval-ledger' };
    assert.throws(() => validateDocument(upstream, 'forge', 'eval-ledger.yaml'), { code: 'SCHEMA_INVALID' });
  }
  const overclaim = forgeRecord(); overclaim.competencies = [...overclaim.competencies, 'backend.databases'];
  assert.throws(() => validateForgeRecord(overclaim, 'eval-ledger.yaml', context()), /union of its task competencies/);
});

test('FR-45: a forge pack that ships anything but task specifications is rejected', t => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-forge-pack-'))); t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  fs.cpSync(path.join(repository, 'tasks/forge/eval-ledger-core'), path.join(base, 'tasks/forge/eval-ledger-core'), { recursive: true });
  assert.equal(forgePack('eval-ledger-core', base).length, 4);
  fs.writeFileSync(path.join(base, 'tasks/forge/eval-ledger-core/solution.py'), 'def run(): ...\n');
  assert.throws(() => forgePack('eval-ledger-core', base), { code: 'FORGE_SOLUTION_SHIPPED' });
});

test('FR-46: no runtime code branches on a forge project ID', () => {
  const ids = catalogs().forges.flatMap(forge => [forge.id, ...forge.task_packs]);
  const sources = ['core', 'cli', 'adapters/runtime', 'adapters/hosts'].flatMap(directory => fs.readdirSync(path.join(repository, directory), { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.ts')).map(file => `${directory}/${file}`));
  for (const file of sources) {
    const text = fs.readFileSync(path.join(repository, file), 'utf8');
    for (const id of ids) assert.ok(!text.includes(id), `${file} names forge identifier ${id}`);
  }
});
