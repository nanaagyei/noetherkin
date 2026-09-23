import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { ScriptedRoleAdapter } from '../core/adapters.js';
import { inspectWorkspace } from '../core/commands.js';
import { selectTrack } from '../core/tracks.js';
import { catalogs } from '../core/validation.js';
import { safeInvestigationGlob } from '../core/semantics.js';
import { assignTask, checkMap, initMap, investigationScope, mapStatus, onboard, selectCatalogProject, selectPetClinic, validateSimulationCandidate } from '../core/simulation.js';

// ACP-016 deterministic conformance: CF-48, FR-50, FR-51 and the map status pointer. The agent-behavior cases
// (CF-46, CF-47, CF-49, FR-47 to FR-49) are behavioral evaluation cases, not Node tests.

const customers = 'spring-petclinic-customers-service/src/main/java/org/springframework/samples/petclinic/customers';

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
async function workspace(t: { after: (fn: () => void) => void }, origin: string, files: Record<string, string>): Promise<string> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-context-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  for (const [file, content] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(source, file)), { recursive: true }); fs.writeFileSync(path.join(source, file), content, { mode: file === 'mvnw' ? 0o755 : 0o644 }); }
  git(source, 'init'); git(source, 'config', 'user.email', 'learner@example.invalid'); git(source, 'config', 'user.name', 'Learner');
  git(source, 'remote', 'add', 'origin', origin); git(source, 'add', '.'); git(source, 'commit', '-m', 'fixture base');
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Learn a real codebase'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  selectTrack(root, 'backend-engineering', candidate => validateSimulationCandidate(root, candidate));
  await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No inspected learner work exists.' }]));
  return root;
}
const petClinicFiles = {
  'pom.xml': '<module>spring-petclinic-customers-service</module>\n',
  'mvnw': '#!/bin/sh\nexit 0\n',
  [`${customers}/web/PetResource.java`]: 'class PetResource { void save(){ findPetTypeById(); } void findPetTypeById(){} }\n',
  [`${customers}/model/PetType.java`]: 'class PetType {}\n',
  'spring-petclinic-customers-service/src/test/java/PetResourceTest.java': 'class PetResourceTest {}\n',
};
function writeMap(root: string, extra = ''): void {
  fs.writeFileSync(path.join(root, '.apprenticeship/knowledge/codebase-map.md'), `# My map

## Service boundaries
Customers owns pet writes in \`source/${customers}/web/PetResource.java\`.
## Startup order
Build first with \`source/mvnw\`.
## One request path
The resource delegates to persistence; see \`source/pom.xml\`.
## Tests and feedback loop
Focused module tests run through the wrapper.
## Unknowns and risks
The exact HTTP failure mapping needs investigation.${extra}
`);
}

test('CF-48: a map template for a non-PetClinic project carries no PetClinic identifier', async t => {
  const project = catalogs().projects.find(item => item.data_class === 'live' && item.support?.attachable && item.status !== 'deprecated' && !item.support.task_packs.includes('pet-type-integrity'));
  assert.ok(project, 'catalog needs an attachable project without a curated pack');
  const root = await workspace(t, project.repository_url, { 'README.md': '# fixture\n' });
  selectCatalogProject(root, project.id, 'source');
  assert.equal(initMap(root).outcome, 'success');
  const template = fs.readFileSync(path.join(root, '.apprenticeship/knowledge/codebase-map.md'), 'utf8');
  assert.match(template, new RegExp(`^# ${project.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} codebase map`));
  assert.doesNotMatch(template, /petclinic/i);
  for (const section of ['Service boundaries', 'Startup order', 'One request path', 'Tests and feedback loop', 'Unknowns and risks']) assert.match(template, new RegExp(`## ${section}\\n\\[PROMPT:`));
  assert.equal(mapStatus(root).status, 'incomplete');
  assert.equal(inspectWorkspace('validate', root).outcome, 'success');
});

test('map status reports checked only for the exact map at the current source revision', async t => {
  const root = await workspace(t, 'https://github.com/spring-petclinic/spring-petclinic-microservices.git', petClinicFiles);
  assert.equal(mapStatus(root).status, 'absent');
  selectPetClinic(root, 'source'); assert.equal(mapStatus(root).status, 'absent');
  initMap(root); assert.deepEqual(mapStatus(root).missing_sections, ['Service boundaries', 'Startup order', 'One request path', 'Tests and feedback loop', 'Unknowns and risks']);
  writeMap(root);
  const before = fs.readdirSync(root, { recursive: true }).length;
  assert.equal(mapStatus(root).status, 'unchecked');
  assert.equal(fs.readdirSync(root, { recursive: true }).length, before, 'status is read-only');
  const checked = checkMap(root);
  const status = mapStatus(root);
  assert.equal(status.status, 'checked');
  assert.deepEqual(status.artifact, checked.artifact);
  assert.deepEqual(status.covered_paths, [`source/${customers}/web/PetResource.java`, 'source/mvnw', 'source/pom.xml']);

  writeMap(root, '\nA later note.'); assert.equal(mapStatus(root).status, 'unchecked', 'an edited map is no longer the checked text');
  writeMap(root); assert.equal(mapStatus(root).status, 'checked');
  fs.writeFileSync(path.join(root, 'source/NOTES.md'), 'moved\n'); git(path.join(root, 'source'), 'add', '.'); git(path.join(root, 'source'), 'commit', '-m', 'move');
  selectPetClinic(root, 'source');
  assert.equal(mapStatus(root).status, 'unchecked', 'a moved checkout makes the map stale');
});

test('task scope resolves frozen investigation globs inside the source and rejects escapes', async t => {
  const root = await workspace(t, 'https://github.com/spring-petclinic/spring-petclinic-microservices.git', petClinicFiles);
  selectPetClinic(root, 'source'); initMap(root); writeMap(root);
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'secret.java'), 'class Secret {}\n');
  assignTask(root);
  const scope = investigationScope(root);
  assert.equal(scope.scoped, true);
  assert.deepEqual(scope.paths, [`${customers}/model/PetType.java`, `${customers}/web/PetResource.java`, 'spring-petclinic-customers-service/src/test/java/PetResourceTest.java']);
  assert.ok(!scope.paths.includes('pom.xml'), 'files outside the globs are not in scope');
  fs.symlinkSync(outside, path.join(root, `source/${customers}/web/escape`));
  const escaped = investigationScope(root);
  assert.ok(escaped.rejected.some((item: string) => item.includes('escape')), JSON.stringify(escaped));
  assert.ok(escaped.paths.every((item: string) => !item.includes('escape')));
});

test('FR-50: unsafe investigation globs are rejected', () => {
  for (const glob of ['../outside/**', '/etc/**', '~/notes', 'a/../../b', 'a//b', 'a\\b', '']) assert.equal(safeInvestigationGlob(glob), false, glob);
  for (const glob of ['src/**', 'module/src/test/java/**', '*.md']) assert.equal(safeInvestigationGlob(glob), true, glob);
});

test('FR-50 and FR-51: publishing an unsafe or widened investigation scope is rejected', async t => {
  const root = await workspace(t, 'https://github.com/spring-petclinic/spring-petclinic-microservices.git', petClinicFiles);
  selectPetClinic(root, 'source'); initMap(root); writeMap(root);
  const { task_id: id } = assignTask(root);
  const key = `.apprenticeship/work/${id}.yaml`;
  const task = JSON.parse(fs.readFileSync(path.join(root, key), 'utf8'));
  const candidate = (paths: string[]) => new Map([[key, JSON.stringify({ ...task, investigation_paths: paths }) + '\n']]);
  assert.throws(() => validateSimulationCandidate(root, candidate([...task.investigation_paths, 'spring-petclinic-api-gateway/**'])), /Frozen task field investigation_paths changed/);
  assert.throws(() => validateSimulationCandidate(root, candidate(['../outside/**'])), /must be relative to the source root/);
  assert.doesNotThrow(() => validateSimulationCandidate(root, candidate(task.investigation_paths)));
});
