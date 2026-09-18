import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { ScriptedRoleAdapter, type RoleAdapter, type RoleInvocation } from '../core/adapters.js';
import { inspectWorkspace } from '../core/commands.js';
import { selectTrack } from '../core/tracks.js';
import { advanceNext, assignTask, checkMap, codeReview, initMap, nextAction, onboard, performanceReview, selectPetClinic, submitChange, submitDesign, taskReview, testTask, validateSimulationCandidate } from '../core/simulation.js';

function run(cwd: string, command: string, args: string[]) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
}
function setup(t: { after: (fn: () => void) => void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'apprenticeship-simulation-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'); fs.mkdirSync(path.join(source, 'spring-petclinic-customers-service/src/main/java/org/springframework/samples/petclinic/customers/web'), { recursive: true });
  fs.writeFileSync(path.join(source, 'pom.xml'), '<module>spring-petclinic-customers-service</module>\n');
  fs.writeFileSync(path.join(source, 'spring-petclinic-customers-service/src/main/java/org/springframework/samples/petclinic/customers/web/PetResource.java'), 'class PetResource { void save(){ findPetTypeById(); } void findPetTypeById(){} }\n');
  fs.writeFileSync(path.join(source, 'mvnw'), '#!/bin/sh\necho "focused tests passed"\nexit 0\n', { mode: 0o755 });
  run(source, 'git', ['init']); run(source, 'git', ['config', 'user.email', 'learner@example.invalid']); run(source, 'git', ['config', 'user.name', 'Learner']);
  run(source, 'git', ['remote', 'add', 'origin', 'https://github.com/spring-petclinic/spring-petclinic-microservices.git']); run(source, 'git', ['add', '.']); run(source, 'git', ['commit', '-m', 'fixture base']);
  const proposal = proposeInit({ display_name: 'Prince', goals: ['Learn Spring systems'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  selectTrack(root, 'backend-engineering', files => validateSimulationCandidate(root, files));
  return root;
}
function finishMap(root: string) {
  const file = path.join(root, '.apprenticeship/knowledge/codebase-map.md');
  fs.writeFileSync(file, `# PetClinic codebase map

## Service boundaries
Customers owns pet writes in \`source/spring-petclinic-customers-service/src/main/java/org/springframework/samples/petclinic/customers/web/PetResource.java\`.
## Startup order
Configuration precedes clients; see \`source/mvnw\`.
## One request path
The resource delegates to persistence; see \`source/pom.xml\`.
## Tests and feedback loop
Focused module tests run through the wrapper.
## Unknowns and risks
The exact HTTP failure mapping requires investigation.
`);
}

test('one model-light PetClinic journey reaches evidence and performance review', async t => {
  const root = setup(t);
  const scripted = new ScriptedRoleAdapter([
    { rationale: 'No inspected learner work exists, so capability remains unknown.' },
    { decision: 'approve', rationale: 'The design states behavior, trade-off, tests, and a failure case.', risks: ['HTTP error mapping'] },
    { outcome: 'approve', findings: ['The bounded change and captured focused tests satisfy the frozen task.'] },
    { outcome: 'accepted', findings: ['All four criteria have current artifacts.'], evidence_rationale: 'The learner supplied one reviewed bounded implementation with focused tests.' },
    { outcome: 'continue', findings: ['One bounded task is useful but not longitudinal evidence.'], next_task_adjustment: 'Keep the preview focused on one gateway boundary.' }
  ]);
  const requests: RoleInvocation[] = [];
  const adapter: RoleAdapter = { name: 'capturing-scripted', invoke: async request => { requests.push(request); return scripted.invoke(request); } };
  await onboard(root, ['Java 17 available'], true, adapter); selectPetClinic(root, 'source'); assert.equal((await advanceNext(root, adapter)).command, 'map init'); finishMap(root); assert.equal(checkMap(root).outcome, 'success');
  const assigned = await advanceNext(root, adapter); assert.ok(assigned.result.task_id); assert.equal((await advanceNext(root, adapter)).command, 'task begin');
  const design = path.join(root, 'design.md'); fs.writeFileSync(design, '# Contract\nReject unknown types before persistence.\n# Alternative\nNullable type was rejected because it weakens integrity.\n# Tests\nValid and invalid create/update.\n# First failure\nHTTP mapping may differ.\n');
  await submitDesign(root, design, adapter);
  const sourceFile = path.join(root, 'source/spring-petclinic-customers-service/src/main/java/org/springframework/samples/petclinic/customers/web/PetResource.java'); fs.appendFileSync(sourceFile, '// learner change\n');
  submitChange(root);
  const submittedBytes = fs.readFileSync(sourceFile); fs.appendFileSync(sourceFile, '// changed after submission\n');
  assert.throws(() => testTask(root, 'Focused tests should pass.'), /Working tree changed/); fs.writeFileSync(sourceFile, submittedBytes);
  assert.equal(testTask(root, 'Focused tests should pass.').outcome, 'success'); assert.equal((await codeReview(root, adapter)).review_outcome, 'approve');
  const codeRequest = requests.find(request => request.skill === 'code-review');
  assert.match(String(codeRequest?.context.design), /Reject unknown types before persistence/);
  assert.equal(nextAction(root).command, 'review task');
  const completed = await taskReview(root, adapter); assert.equal(completed.outcome, 'success'); assert.equal(completed.evidence_ids.length, 2);
  const taskReviewRequest = requests.find(request => request.output_keys.includes('evidence_rationale'));
  assert.match(String(taskReviewRequest?.context.design), /Reject unknown types before persistence/);
  assert.match(String(taskReviewRequest?.context.change), /learner change/);
  assert.equal(nextAction(root).command, 'review performance');
  const performance = await performanceReview(root, adapter); assert.equal(performance.review_outcome, 'continue'); assert.equal(nextAction(root).phase, 'COMPLETE');
  const validation = inspectWorkspace('validate', root); assert.equal(validation.outcome, 'success', JSON.stringify(validation.diagnostics)); assert.equal(validation.coverage, 'simulation');
  assert.equal((await taskReview(root, adapter)).outcome, 'no-change');
  assert.equal((await performanceReview(root, adapter)).outcome, 'no-change');
});

test('selection rejects a wrong remote and assignment rejects an unfinished map', async t => {
  const root = setup(t); await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No inspected work exists.' }]));
  run(path.join(root, 'source'), 'git', ['remote', 'set-url', 'origin', 'https://github.com/example/not-petclinic.git']);
  assert.throws(() => selectPetClinic(root, 'source'), /Origin must match/);
  run(path.join(root, 'source'), 'git', ['remote', 'set-url', 'origin', 'https://github.com/spring-petclinic/spring-petclinic-microservices.git']);
  selectPetClinic(root, 'source'); initMap(root); assert.throws(() => assignTask(root), /Replace every prompt/);
});

test('malformed or context-unbound role output cannot publish onboarding', async t => {
  const malformed = setup(t);
  await assert.rejects(() => onboard(malformed, [], true, new ScriptedRoleAdapter([{ rationale: 'Unknown', extra: true }])), /Unexpected or missing envelope fields/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(malformed, '.apprenticeship/profile.yaml'), 'utf8')).onboarding, 'pending');
  const unbound = setup(t);
  const adapter = { name: 'unbound', invoke: async () => ({ output: { rationale: 'Unknown' }, transcript: 'unbound', model: null, context_digest: 'wrong' }) };
  await assert.rejects(() => onboard(unbound, [], true, adapter), /not bound to the supplied context/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(unbound, '.apprenticeship/profile.yaml'), 'utf8')).onboarding, 'pending');
});
