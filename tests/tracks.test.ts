import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { ScriptedRoleAdapter } from '../core/adapters.js';
import { listProjects } from '../core/commands.js';
import { migrateTo3, planMigration } from '../core/migration.js';
import { parse } from '../core/parsing.js';
import { nextAction, onboard, selectCatalogProject, validateSimulationCandidate } from '../core/simulation.js';
import { alignTrack, listTracks, selectTrack } from '../core/tracks.js';
import { catalogs, collect, inspectRecords, schemaFor, validateDocument } from '../core/validation.js';

const repository = fileURLToPath(new URL('../../', import.meta.url));
function workspace(t: { after: (f: () => void) => void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'apprenticeship-tracks-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Choose a track'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true)); return root;
}

test('track and candidate catalogs are closed, referentially valid, and broad enough', () => {
  const catalog = catalogs(); assert.equal(catalog.tracks.length, 34); assert.equal(catalog.projects.length, 87); assert.equal(catalog.competencyIds.size, 151); assert.equal(catalog.coreCompetencyIds.size, 7);
  for (const track of catalog.tracks) {
    assert.ok(track.required_competencies.every((id: string) => !catalog.coreCompetencyIds.has(id)));
    for (const stage of ['early', 'intermediate', 'advanced']) assert.equal(track.recommended_projects[stage].length, 2);
  }
  assert.equal(listTracks('ml-engineering').tracks[0].recommended_projects.advanced[1].id, 'sample-eks-inference-platform');
  for (const project of catalog.projects) {
    assert.ok(project.difficulty && project.onboarding_cost && project.feedback_loop);
    assert.ok(project.recommended_minimum_level && project.ideal_level);
    assert.ok(['verified', 'conditional', 'unverified'].includes(project.contribution_readiness.status));
  }
});

test('Phase 9 candidates are globally discoverable without changing track recommendations', () => {
  const expected = new Map([
    ['online-boutique', { repository_url: 'https://github.com/GoogleCloudPlatform/microservices-demo', competencies: ['backend.networking', 'platform.kubernetes', 'production.observability'] }],
    ['opentelemetry-cpp', { repository_url: 'https://github.com/open-telemetry/opentelemetry-cpp', competencies: ['cpp.build-tooling', 'observability.instrumentation', 'production.tracing'] }],
    ['triton-inference-server', { repository_url: 'https://github.com/triton-inference-server/server', competencies: ['ml.serving', 'llm.batching', 'llm.latency-throughput', 'gpu.profiling'] }]
  ]);
  const result = listProjects();
  assert.equal(result.outcome, 'success');
  for (const [id, wanted] of expected) {
    const project = result.data.projects.find((item: any) => item.id === id);
    assert.ok(project);
    assert.equal(project.repository_url, wanted.repository_url);
    assert.ok(wanted.competencies.every(competency => project.competencies.includes(competency)));
    assert.equal(project.status, 'candidate');
    assert.equal(project.support.attachable, true);
    assert.deepEqual(project.support.task_packs, []);
    assert.deepEqual(project.metadata_gaps, ['contribution_readiness', 'deployment', 'contribution']);
    assert.deepEqual(project.track_stages, []);
  }
  const compiler = result.data.projects.find((item: any) => item.id === 'triton');
  const server = result.data.projects.find((item: any) => item.id === 'triton-inference-server');
  assert.equal(compiler.repository_url, 'https://github.com/triton-lang/triton');
  assert.notEqual(compiler.repository_url, server.repository_url);
  assert.deepEqual(listTracks('ml-engineering').tracks[0].recommended_projects.advanced.map((item: any) => item.id), ['vllm', 'sample-eks-inference-platform']);
});

test('project schema distinguishes truthful candidates from complete supported records', () => {
  const candidate = structuredClone(catalogs().projects.find(item => item.id === 'ruff')!);
  candidate.difficulty = null; candidate.metadata_gaps = candidate.metadata_gaps.filter((item: string) => item !== 'difficulty');
  assert.throws(() => validateDocument(candidate, 'project', 'ruff.yaml'), /metadata_gaps/);
  const supported = structuredClone(catalogs().projects.find(item => item.id === 'spring-petclinic-microservices')!);
  supported.contribution_readiness.status = 'unverified';
  assert.throws(() => validateDocument(supported, 'project', 'spring-petclinic-microservices.yaml'), /constant/);
});

test('track selection is pinned and switching remains pending without rewriting profile scope', t => {
  const root = workspace(t); const validate = (files: Map<string, string>) => validateSimulationCandidate(root, files);
  assert.equal(selectTrack(root, 'backend-engineering', validate).outcome, 'success');
  assert.equal(selectTrack(root, 'backend-engineering', validate).outcome, 'no-change');
  assert.equal(selectTrack(root, 'ml-engineering', validate).outcome, 'success');
  const records = collect(root); const track = records.get('current-track.yaml')!; const profile = records.get('profile.yaml')!;
  assert.equal(track.track_id, 'ml-engineering'); assert.equal(track.alignment_status, 'pending'); assert.deepEqual(profile.specialization_competencies, []); assert.deepEqual(inspectRecords(records, root).diagnostics, []);
  track.definition_digest = `sha256:${'0'.repeat(64)}`; assert.ok(inspectRecords(records, root).diagnostics.some(item => item.code === 'TRACK_BINDING_INVALID'));
});

test('onboarding fails safely until a learner selects a track', async t => {
  const root = workspace(t);
  await assert.rejects(() => onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No evidence.' }])), /Select a track/);
  assert.equal(collect(root).get('profile.yaml')!.onboarding, 'pending');
});

test('track alignment publishes a fresh exact assessment and manager review before adopting scope', async t => {
  const root = workspace(t); const validate = (files: Map<string, string>) => validateSimulationCandidate(root, files);
  selectTrack(root, 'backend-engineering', validate);
  await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No observed work exists.' }]));
  selectTrack(root, 'data-engineering', validate);
  const catalog = catalogs(); const selected = catalog.tracks.find(item => item.id === 'data-engineering')!;
  const scope = [...catalog.coreCompetencyIds, ...selected.required_competencies];
  const findings = scope.map(competency_id => ({ competency_id, status: 'unassessed', demonstrated_level: null, evidence_ids: [], rationale: 'No attributable evidence exists for the changed scope.' }));
  const aligned = await alignTrack(root, true, new ScriptedRoleAdapter([{ findings }, { outcome: 'continue', findings: ['The exact changed scope is suitable for future evaluation.'] }]), validate);
  assert.equal(aligned.outcome, 'success');
  const records = collect(root); assert.equal(records.get('current-track.yaml')!.alignment_status, 'aligned');
  assert.deepEqual(records.get('profile.yaml')!.specialization_competencies, selected.required_competencies);
  const assessment = records.get(`assessments/${aligned.assessment_id}.yaml`)!; assert.deepEqual(new Set(assessment.findings.map((item: any) => item.competency_id)), new Set(scope));
  const review = records.get(`reviews/performance/${aligned.review_id}.yaml`)!; assert.equal(review.outcome, 'continue'); assert.deepEqual(review.assessment_ids, [assessment.id]);
  assert.equal((await alignTrack(root, true, new ScriptedRoleAdapter([]), validate)).outcome, 'no-change');
});

test('manager scope objection leaves a switched track pending', async t => {
  const root = workspace(t); const validate = (files: Map<string, string>) => validateSimulationCandidate(root, files);
  selectTrack(root, 'backend-engineering', validate); await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No observed work exists.' }])); selectTrack(root, 'security-engineering', validate);
  const catalog = catalogs(); const selected = catalog.tracks.find(item => item.id === 'security-engineering')!; const scope = [...catalog.coreCompetencyIds, ...selected.required_competencies];
  const findings = scope.map(competency_id => ({ competency_id, status: 'unassessed', demonstrated_level: null, evidence_ids: [], rationale: 'No evidence.' }));
  const result = await alignTrack(root, true, new ScriptedRoleAdapter([{ findings }, { outcome: 'adjust-scope', findings: ['Narrow the proposed scope before adoption.'] }]), validate);
  assert.equal(result.outcome, 'incomplete'); assert.equal(collect(root).get('current-track.yaml')!.alignment_status, 'pending'); assert.notDeepEqual(collect(root).get('profile.yaml')!.specialization_competencies, selected.required_competencies);
});

test('project recommendations preserve stages and expose support instead of a fit score', () => {
  const result = listProjects('gpu-engineering', 'advanced'); assert.equal(result.outcome, 'success'); assert.equal(result.data.projects.length, 2);
  assert.ok(result.data.projects.every((project: any) => project.live_selection_available && !Object.hasOwn(project, 'fit_score')));
  assert.ok(result.data.projects.every((project: any) => project.track_stages.length === 1 && project.track_stages[0] === 'advanced' && project.difficulty));
  assert.deepEqual(new Set(result.data.projects.map((project: any) => project.id)), new Set(['vllm', 'pytorch']));
});

test('generic attachment verifies a Phase 9 candidate and never exposes PetClinic task commands', async t => {
  const root = workspace(t); const validate = (files: Map<string, string>) => validateSimulationCandidate(root, files);
  selectTrack(root, 'backend-engineering', validate);
  await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No observed work exists.' }]));
  const source = path.join(root, 'online-boutique-source'); fs.mkdirSync(source); fs.writeFileSync(path.join(source, 'README.md'), 'candidate\n');
  for (const args of [['init'], ['config', 'user.email', 'learner@example.invalid'], ['config', 'user.name', 'Learner'], ['remote', 'add', 'origin', 'https://github.com/GoogleCloudPlatform/microservices-demo.git'], ['add', '.'], ['commit', '-m', 'base']]) {
    const run = spawnSync('git', ['-C', source, ...args], { encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr);
  }
  const attached = selectCatalogProject(root, 'online-boutique', 'online-boutique-source'); assert.equal(attached.outcome, 'success');
  assert.equal(attached.selection.project_id, 'online-boutique');
  assert.equal(nextAction(root).phase, 'PORTABLE TASK ASSIGNMENT'); assert.equal(nextAction(root).command, null);
  fs.appendFileSync(path.join(source, 'README.md'), 'dirty\n'); assert.throws(() => selectCatalogProject(root, 'online-boutique', 'online-boutique-source'), /clean checkout/);
});

test('protocol 2.0 migration dry-run is explicit and byte-preserving', () => {
  const root = path.join(repository, 'examples/spring-petclinic'); const before = fs.readFileSync(path.join(root, '.apprenticeship/config.yaml'));
  const plan = planMigration(root); assert.equal(plan.outcome, 'proposal'); assert.equal(plan.from, '2.0'); assert.equal(plan.to, '3.0'); assert.deepEqual(plan.preserved, ['projects', 'work', 'evidence', 'assessments', 'reviews']);
  assert.deepEqual(fs.readFileSync(path.join(root, '.apprenticeship/config.yaml')), before);
});

test('authorized protocol migration publishes atomically and is idempotent', t => {
  const root = workspace(t); const state = path.join(root, '.apprenticeship');
  for (const directory of ['operations', 'snapshots', 'authorizations']) fs.rmSync(path.join(state, directory), { recursive: true, force: true });
  for (const file of ['config.yaml', 'profile.yaml', 'current-project.yaml', 'competencies.yaml']) {
    const target = path.join(state, file); const value = JSON.parse(fs.readFileSync(target, 'utf8')); value.schema_version = '2.0';
    if (file === 'config.yaml') { value.competency_catalog_version = '2.0'; delete value.track_catalog_version; }
    fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
  }
  fs.rmSync(path.join(state, 'current-track.yaml'));
  const validate = (files: Map<string, string>) => {
    const records = collect(root);
    for (const [file, bytes] of files) {
      if (!file.startsWith('.apprenticeship/')) continue;
      const relative = file.slice('.apprenticeship/'.length); if (schemaFor(relative)) records.set(relative, parse(bytes, file));
    }
    assert.deepEqual(inspectRecords(records, root).diagnostics, []);
  };
  assert.equal(migrateTo3(root, validate).outcome, 'success');
  const migrated = collect(root); assert.equal(migrated.get('config.yaml')!.schema_version, '3.0'); assert.equal(migrated.get('current-track.yaml')!.track_id, null);
  assert.equal(migrateTo3(root, validate).outcome, 'no-change');
});
