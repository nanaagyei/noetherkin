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
import { selectTrack } from '../core/tracks.js';
import { catalogs, collect, inspectRecords, validateDocument } from '../core/validation.js';
import { competencyGraph } from '../core/graph.js';
import { attentionAdvisory, contradictions, remediationFor } from '../core/frontier.js';
import { advisoryFile, deriveAdvisory, refreshAdvisory, taskRemediation, writeAdvisory } from '../core/advisory.js';
import { assignTask, beginTask, currentTask, onboard, selectForge, submitDesign, validateSimulationCandidate } from '../core/simulation.js';

// ACP-014 conformance: CF-38 to CF-41 and FR-37 to FR-41.

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));
const example = path.join(repository, 'examples/spring-petclinic');
const at = '2026-09-24T00:00:00Z';

const graph = { prerequisites: { 'x.b': ['x.a'], 'x.c': ['x.b'], 'x.d': ['x.a'], 'x.f': ['x.e'] }, encompasses: {} };
const entry = (competency_id: string, status: string, evidence_ids: string[] = []) => ({ competency_id, status, demonstrated_level: status === 'demonstrated' ? 'E0' : null, evidence_ids, assessment_ids: [] });
const cacheOf = (entries: object[], stale: string[] = []) => ({ schema_version: '3.0', data_class: 'live', generated_at: at, source_assessment_ids: [], source_review_ids: [], effective_level: 'E0', entries, last_awarded_level: 'E0', standing: 'current', stale_record_ids: stale });
const evidence = (id: string, competency_id: string, observed_at: string, project_id: string) => ({ id, competency_id, project_id, supersedes: null, fact: { observed_at } });
const view = (cache: object, evidenceRecords: object[] = [], scope = ['x.a', 'x.b', 'x.c', 'x.d', 'x.e', 'x.f']) => attentionAdvisory({ graph, scope, cache, evidence: evidenceRecords, catalogVersion: '4.0', generatedAt: at });

async function forgeWorkspace(t: { after: (fn: () => void) => void }): Promise<string> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-frontier-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Build accessible interfaces'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  selectTrack(root, 'frontend-engineering', files => validateSimulationCandidate(root, files));
  await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No inspected learner work exists.' }]));
  selectForge(root, 'accessible-data-table', 'source');
  return root;
}

test('CF-38: the frontier is exactly the in-scope competencies with demonstrated prerequisites and an open finding', () => {
  // x.a demonstrated; x.b developing on x.a; x.c needs undemonstrated x.b; x.d unassessed on x.a; x.e contested; x.f needs contested x.e.
  const result = view(cacheOf([entry('x.a', 'demonstrated', ['E1']), entry('x.b', 'developing'), entry('x.e', 'contested')]), [evidence('E1', 'x.a', at, 'p1')]);
  const frontier = result.attention.filter((item: { position: string }) => item.position === 'frontier').map((item: { competency_id: string }) => item.competency_id).sort();
  assert.deepEqual(frontier, ['x.b', 'x.d']);
  assert.deepEqual(result.attention.filter((item: { position: string }) => item.position === 'demonstrated').map((item: { competency_id: string }) => item.competency_id), ['x.a']);
  assert.deepEqual(result.blocked, [{ competency_id: 'x.c', finding: 'unassessed', missing_prerequisites: ['x.b'] }, { competency_id: 'x.f', finding: 'unassessed', missing_prerequisites: ['x.e'] }]);
  assert.deepEqual(result.remediation.map((item: { competency_id: string }) => item.competency_id), ['x.e'], 'contested goes to remediation, not the frontier');
  assert.doesNotThrow(() => validateDocument(result, 'attention-advisory', 'view'));
  const unedged = attentionAdvisory({ graph: { prerequisites: {}, encompasses: {} }, scope: ['x.b', 'x.c'], cache: cacheOf([]), evidence: [], catalogVersion: '3.0', generatedAt: at });
  assert.deepEqual(unedged.attention.map((item: { position: string }) => item.position), ['frontier', 'frontier'], 'a graph with no edges puts everything on the frontier');
});

test('CF-41: identical evidence dates and context counts are reported as a tie with no synthetic tiebreak', () => {
  const cache = cacheOf([entry('x.a', 'demonstrated', ['E1']), entry('x.e', 'demonstrated', ['E2'])]);
  const tied = view(cache, [evidence('E1', 'x.a', at, 'p1'), evidence('E2', 'x.e', at, 'p2')], ['x.a', 'x.e']);
  assert.deepEqual(tied.attention.map((item: { rank: number; tied_with: string[] }) => [item.rank, item.tied_with]), [[1, ['x.e']], [1, ['x.a']]]);
  const apart = view(cache, [evidence('E1', 'x.a', '2026-01-01T00:00:00Z', 'p1'), evidence('E2', 'x.e', at, 'p2')], ['x.a', 'x.e']);
  assert.deepEqual(apart.attention.map((item: { competency_id: string; rank: number }) => [item.competency_id, item.rank]), [['x.a', 1], ['x.e', 2]], 'older evidence comes first when dates differ');
  const contexts = view(cache, [evidence('E1', 'x.a', at, 'p1'), evidence('E2', 'x.e', at, 'p2'), { ...evidence('E3', 'x.e', at, 'p3') }], ['x.a', 'x.e']);
  void contexts; // x.e cites only E2 in the cache, so an uncited record changes nothing.
  assert.deepEqual(contexts.attention.map((item: { rank: number }) => item.rank), [1, 1]);
});

test('attention puts a stale or contested prerequisite first', () => {
  const cache = cacheOf([entry('x.a', 'demonstrated', ['E1']), entry('x.b', 'demonstrated', ['E2']), entry('x.e', 'demonstrated', ['E3'])], ['E1']);
  const result = view(cache, [evidence('E1', 'x.a', '2026-01-01T00:00:00Z', 'p1'), evidence('E2', 'x.b', at, 'p1'), evidence('E3', 'x.e', '2025-01-01T00:00:00Z', 'p1')], ['x.a', 'x.b', 'x.e']);
  assert.equal(result.attention[0].competency_id, 'x.b', 'x.b rests on stale x.a, so it outranks the older x.e');
  assert.match(result.attention[0].reasons[0], /x\.a is stale/);
});

test('FR-40: the advisory never presents a percentage, mastery value, decay coefficient or due date', async t => {
  const forbidden = /%|\bdue\b|mastery|decay|probability|\bscore\b|half-life/i;
  const result = view(cacheOf([entry('x.a', 'demonstrated', ['E1'])]), [evidence('E1', 'x.a', at, 'p1')]);
  assert.doesNotMatch(JSON.stringify(result), forbidden);
  assert.throws(() => validateDocument({ ...result, attention: [{ ...result.attention[0], mastery: 0.8 }] }, 'attention-advisory', 'view'), { code: 'SCHEMA_INVALID' });
  const root = await forgeWorkspace(t);
  const human = spawnSync(process.execPath, [cli, 'next', '--workspace', root], { encoding: 'utf8', env: { ...process.env, NOETHERKIN_ROLE_ADAPTER: 'codex' } });
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /Advisory \(derived; not evidence; gates nothing\)/);
  assert.doesNotMatch(human.stdout.slice(human.stdout.indexOf('Advisory')), forbidden);
});

test('FR-37: a stored advisory that disagrees with the cache is reported and replaced, never reconciled', async t => {
  const root = await forgeWorkspace(t);
  const first = refreshAdvisory(root);
  assert.equal(first.written, true); assert.deepEqual(first.contradictions, []);
  const stored = JSON.parse(fs.readFileSync(path.join(root, advisoryFile), 'utf8'));
  stored.attention[0].finding = 'demonstrated'; stored.source.cache_digest = `sha256:${'0'.repeat(64)}`;
  fs.writeFileSync(path.join(root, advisoryFile), JSON.stringify(stored));
  const second = refreshAdvisory(root);
  assert.ok(second.contradictions.some(text => /different competency cache/.test(text)));
  assert.ok(second.contradictions.some(text => text.includes(`${stored.attention[0].competency_id}: advisory says demonstrated, the cache says unassessed`)));
  assert.deepEqual(contradictions(JSON.parse(fs.readFileSync(path.join(root, advisoryFile), 'utf8')), JSON.parse(fs.readFileSync(path.join(root, '.apprenticeship/competencies.yaml'), 'utf8'))), [], 'the regenerated file agrees with the cache');
});

test('CF-39: deleting the advisory file blocks nothing, and its presence fails no validation', async t => {
  const root = await forgeWorkspace(t);
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args, '--workspace', root, '--json'], { encoding: 'utf8', env: { ...process.env, NOETHERKIN_ROLE_ADAPTER: 'codex' } });
  assert.equal(run('next').status, 0);
  assert.ok(fs.existsSync(path.join(root, advisoryFile)), 'next writes the derived view');
  for (const command of ['validate', 'status', 'doctor']) assert.equal(run(command).status, 0, `${command} with the advisory present`);
  fs.rmSync(path.join(root, '.apprenticeship/advisory'), { recursive: true });
  for (const command of ['validate', 'status', 'doctor']) assert.equal(run(command).status, 0, `${command} with the advisory deleted`);
  assert.equal(beginTask(root).outcome, 'success', 'a lifecycle publish never needs the view');
  const next = run('next'); assert.equal(next.status, 0);
  assert.equal(JSON.parse(next.stdout).data.advisory.file, advisoryFile, 'next regenerates it on the next use');
});

test('the advisory file neither stales nor blocks an onboarding handoff', async t => {
  const { GenericCapabilityHostAdapter } = await import('../adapters/hosts/generic/index.js');
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-frontier-handoff-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Learn'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  writeAdvisory(root, deriveAdvisory(root));
  const result = await new GenericCapabilityHostAdapter().invoke({ capability_id: 'onboarding', workspace: root, input: { track_id: 'frontend-engineering' } });
  assert.equal(result.outcome, 'consent-required', JSON.stringify(result.diagnostics));
});

test('CF-40: a failed design gate names specific prerequisite competencies to revisit', async t => {
  const root = await forgeWorkspace(t);
  assignTask(root); beginTask(root);
  const design = path.join(root, 'design.md'); fs.writeFileSync(design, '# Design\nRender rows.\n');
  const gate = await submitDesign(root, design, new ScriptedRoleAdapter([{ decision: 'rework', rationale: 'The design never says how headers relate to cells.', risks: ['Inaccessible structure.'] }]));
  assert.equal(gate.outcome, 'rework');
  const task = currentTask(root)!;
  assert.deepEqual(task.primary_competencies, ['core.implementation', 'frontend.web-platform']);
  const named = taskRemediation(root, task).map(item => item.competency_id);
  assert.ok(named.length > 0 && named.every(id => catalogs().competencyIds.has(id)), 'every named item is a catalog competency');
  assert.ok(named.includes('core.implementation') && named.includes('core.codebase-navigation'), `names the prerequisites of the task's competencies: ${named.join(', ')}`);
  assert.deepEqual(remediationFor(competencyGraph(catalogs().competencies, '4.0'), { entries: [] }, ['frontend.accessibility']).map(item => item.competency_id).slice(0, 2), ['frontend.web-platform', 'core.testing']);
});

test('FR-38: no record may cite the advisory view', () => {
  const records = collect(example);
  const [file, record] = [...records].find(([name]) => name.startsWith('evidence/'))!;
  for (const uri of ['workspace:/.apprenticeship/advisory/attention.yaml', 'workspace:/.apprenticeship/advisory']) {
    const cited = structuredClone(record); cited.fact.artifacts[0].uri = uri;
    const diagnostics = inspectRecords(new Map([...records, [file, cited]]), example).diagnostics;
    assert.ok(diagnostics.some(item => item.code === 'ADVISORY_CITED'), `${uri} is rejected: ${JSON.stringify(diagnostics)}`);
  }
  assert.ok(!inspectRecords(records, example).diagnostics.some(item => item.code === 'ADVISORY_CITED'));
});

test('FR-39: advisory generation cannot write a canonical record', async t => {
  const root = await forgeWorkspace(t);
  const cache = fs.readFileSync(path.join(root, '.apprenticeship/competencies.yaml'));
  const derived = deriveAdvisory(root);
  for (const target of ['.apprenticeship/competencies.yaml', '.apprenticeship/advisory/../competencies.yaml', '.apprenticeship/advisory/nested/attention.yaml']) {
    assert.throws(() => writeAdvisory(root, derived, undefined, target), { code: 'ADVISORY_CANONICAL_WRITE' }, target);
  }
  assert.deepEqual(fs.readFileSync(path.join(root, '.apprenticeship/competencies.yaml')), cache);
  assert.equal(inspectWorkspace('validate', root).outcome, 'success');
});

test('FR-41: a task may not claim a competency its template does not exercise', async t => {
  const root = await forgeWorkspace(t);
  assignTask(root);
  const file = path.join(root, '.apprenticeship/work', fs.readdirSync(path.join(root, '.apprenticeship/work'))[0]!);
  const task = JSON.parse(fs.readFileSync(file, 'utf8'));
  task.secondary_competencies = [...task.secondary_competencies, 'frontend.performance'];
  fs.writeFileSync(file, JSON.stringify(task));
  const result = inspectWorkspace('validate', root);
  assert.ok(result.diagnostics.some(item => item.code === 'SCOPE_FABRICATED'), JSON.stringify(result.diagnostics));
});
