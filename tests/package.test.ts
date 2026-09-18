import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const terminal = path.join(repo, 'tests/terminal.py');
test('packed npm executable installs offline and supports the complete terminal PetClinic journey', t => {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-package-')));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const activeCache = process.env.npm_config_cache ?? process.env.NPM_CONFIG_CACHE;
  const npmEnv = { ...process.env, ...(activeCache ? { NPM_CONFIG_CACHE: activeCache } : {}) };
  const packed = spawnSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: repo, encoding: 'utf8', env: npmEnv });
  assert.equal(packed.status, 0, packed.stderr);
  const info = JSON.parse(packed.stdout)[0];
  assert.ok(info.files.some((f: any) => f.path === 'schemas/task.schema.json'));
  assert.ok(info.files.some((f: any) => f.path === 'catalog/levels.yaml'));
  assert.ok(info.files.some((f: any) => f.path === 'tasks/petclinic-pet-type-integrity.json'));
  assert.ok(info.files.some((f: any) => f.path === 'dist/core/simulation.js'));
  assert.ok(info.files.some((f: any) => f.path === 'dist/adapters/runtime/codex.js'));
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'skill-pack/manifest.json'), 'utf8'));
  for (const skill of manifest.skills.map((entry: any) => entry.name)) {
    for (const resource of ['SKILL.md', 'references/bundle.json', 'references/runtime.md', 'references/proposals.md', 'assets/proposal.md']) {
      assert.ok(info.files.some((f: any) => f.path === `skills/${skill}/${resource}`), `${skill}/${resource} missing from tarball`);
    }
  }
  assert.ok(!info.files.some((f: any) => f.path.startsWith('dist/tests/') || f.path.startsWith('archive/')));
  const prefix = path.join(temporary, 'installation');
  const installed = spawnSync('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--prefix', prefix, path.join(temporary, info.filename)], { encoding: 'utf8', env: npmEnv });
  assert.equal(installed.status, 0, `${installed.stderr}\nPopulate this npm cache with npm install/ci before running the offline package test.`);
  const executable = path.join(prefix, 'node_modules/.bin/noetherkin');
  const root = path.join(temporary, 'learner-workspace'); fs.mkdirSync(root);
  const denied = spawnSync('python3', [terminal, process.execPath, executable, root, 'cancel'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(denied.status, 0, denied.stderr);
  assert.equal(JSON.parse(denied.stdout).output.diagnostics[0].code, 'CONSENT_REQUIRED');
  assert.deepEqual(fs.readdirSync(root), []);
  const approved = spawnSync('python3', [terminal, process.execPath, executable, root, 'initialize'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(approved.status, 0, approved.stderr);
  const initialized = JSON.parse(approved.stdout);
  assert.equal(initialized.prompt_seen, true); assert.equal(initialized.exit, 0, approved.stdout);
  const trackSelected = spawnSync('python3', [terminal, process.execPath, executable, root, 'select', 'track'], { encoding: 'utf8', timeout: 20000 });
  assert.equal(trackSelected.status, 0, trackSelected.stderr); assert.equal(JSON.parse(trackSelected.stdout).exit, 0, trackSelected.stdout);
  const fakeCodex = path.join(temporary, 'fake-codex.mjs');
  fs.writeFileSync(fakeCodex, `#!/usr/bin/env node
let input = ''; for await (const chunk of process.stdin) input += chunk;
let output;
if (input.includes('pre-task baseline')) output = {rationale:'No inspected learner work exists, so capability remains unknown.'};
else if (input.includes('Validate every frozen criterion')) output = {outcome:'accepted',findings:['Every frozen criterion has a current artifact.'],evidence_rationale:'One bounded implementation was reviewed with focused tests.'};
else if (input.includes('Review the exact change')) output = {outcome:'approve',findings:['The exact bounded change and focused run support review.']};
else if (input.includes('Synthesize this single completed task')) output = {outcome:'continue',findings:['One task is not longitudinal evidence.'],next_task_adjustment:'Keep the next task bounded.'};
else output = {decision:'approve',rationale:'The design states behavior, trade-off, tests, and failure behavior.',risks:['HTTP mapping']};
process.stdout.write(JSON.stringify({type:'thread.started',model:'fake'})+'\\n');
process.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(output)}})+'\\n');
`); fs.chmodSync(fakeCodex, 0o755);
  const onboarded = spawnSync('python3', [terminal, process.execPath, executable, root, 'onboard', 'onboard', fakeCodex], { encoding: 'utf8', timeout: 20000 });
  assert.equal(onboarded.status, 0, onboarded.stderr); assert.equal(JSON.parse(onboarded.stdout).exit, 0, onboarded.stdout);
  const source = path.join(root, 'source'); const resource = path.join(source, 'spring-petclinic-customers-service/src/main/java/org/springframework/samples/petclinic/customers/web'); fs.mkdirSync(resource, { recursive: true });
  fs.writeFileSync(path.join(source, 'pom.xml'), '<module>spring-petclinic-customers-service</module>\n');
  fs.writeFileSync(path.join(resource, 'PetResource.java'), 'class PetResource { void save(){ findPetTypeById(); } void findPetTypeById(){} }\n');
  fs.writeFileSync(path.join(source, 'mvnw'), '#!/bin/sh\necho focused-tests-pass\nexit 0\n', { mode: 0o755 });
  const git = (...args: string[]) => { const run = spawnSync('git', args, { cwd: source, encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr); };
  git('init'); git('config', 'user.email', 'learner@example.invalid'); git('config', 'user.name', 'Learner'); git('remote', 'add', 'origin', 'https://github.com/spring-petclinic/spring-petclinic-microservices.git'); git('add', '.'); git('commit', '-m', 'base');
  const cli = (...args: string[]) => { const run = spawnSync(executable, [...args, '--workspace', root, '--json'], { cwd: temporary, encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr + run.stdout); return JSON.parse(run.stdout); };
  cli('project', 'select', 'spring-petclinic-microservices', '--source', 'source'); cli('map', 'init');
  fs.writeFileSync(path.join(root, '.apprenticeship/knowledge/codebase-map.md'), '# PetClinic codebase map\n\n## Service boundaries\n`source/spring-petclinic-customers-service/src/main/java/org/springframework/samples/petclinic/customers/web/PetResource.java` owns writes.\n## Startup order\n`source/pom.xml` describes modules.\n## One request path\n`source/mvnw` drives the build.\n## Tests and feedback loop\nFocused wrapper test.\n## Unknowns and risks\nHTTP mapping.\n');
  cli('map', 'check'); cli('task', 'assign', 'pet-type-integrity'); cli('task', 'begin');
  const design = path.join(root, 'design.md'); fs.writeFileSync(design, '# Contract\nReject unknown types.\n# Alternative\nNullable values weaken integrity.\n# Tests\nValid and invalid paths.\n# First failure\nHTTP mapping.\n');
  cli('task', 'submit-design', '--file', design, '--codex-bin', fakeCodex);
  fs.appendFileSync(path.join(resource, 'PetResource.java'), '// learner change\n'); cli('task', 'submit-change'); cli('task', 'test', '--prediction', 'focused tests pass');
  cli('review', 'code', '--codex-bin', fakeCodex); cli('review', 'task', '--codex-bin', fakeCodex); cli('review', 'performance', '--codex-bin', fakeCodex);
  const validated = cli('validate'); assert.equal(validated.coverage, 'simulation'); assert.equal(validated.data.next_action.phase, 'COMPLETE');
  for (const command of ['status', 'projects', 'validate', 'doctor']) {
    const result = spawnSync(executable, [command, '--workspace', root, '--json'], { cwd: temporary, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.equal(JSON.parse(result.stdout).command, command);
  }
});
