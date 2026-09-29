import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { ScriptedRoleAdapter } from '../core/adapters.js';
import { inspectWorkspace } from '../core/commands.js';
import { upstreamPack } from '../core/packs.js';
import { runnablePaths, selectTrack } from '../core/tracks.js';
import { catalogs } from '../core/validation.js';
import { assignTask, beginTask, checkMap, codeReview, currentTask, initMap, nextAction, onboard, performanceReview, selectCatalogProject, submitChange, submitDesign, taskReview, testTask, validateSimulationCandidate } from '../core/simulation.js';
import { writeProgram } from './support.js';

// Issue #19: every curated upstream pack runs the whole journey against a minimal fixture checkout built from its own
// compatibility probes. Nothing here names a project: the packs are data (FR-46). PetClinic keeps its own journey in
// tests/simulation.test.ts and tests/package.test.ts.

type Pack = { project: Record<string, any>; template: Record<string, any>; track: string };
const packs: Pack[] = catalogs().projects.flatMap(project => (project.support?.task_packs ?? []).flatMap((packId: string) => upstreamPack(packId).map(template => ({ project, template, track: catalogs().tracks.find(track => Object.values(track.recommended_projects).flat().includes(project.id))?.id }))))
  .filter(pack => pack.project.id !== 'spring-petclinic-microservices');

function git(cwd: string, ...args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr);
}
/** A checkout holding exactly the pack's required files, each carrying every required fragment, at its upstream origin. */
function fixture(t: { after: (fn: () => void) => void }, pack: Pack, omit?: string): { root: string; source: string } {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-upstream-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const fragments = pack.template.compatibility.required_fragments.filter((fragment: string) => fragment !== omit).join('\n');
  for (const file of pack.template.compatibility.required_files) { fs.mkdirSync(path.dirname(path.join(source, file)), { recursive: true }); fs.writeFileSync(path.join(source, file), `${fragments}\n`); }
  git(source, 'init'); git(source, 'config', 'user.email', 'learner@example.invalid'); git(source, 'config', 'user.name', 'Learner');
  git(source, 'remote', 'add', 'origin', `${pack.project.repository_url}.git`); git(source, 'add', '.'); git(source, 'commit', '-m', 'fixture base');
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Contribute to open source'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  selectTrack(root, pack.track, files => validateSimulationCandidate(root, files));
  return { root, source };
}
/** The focused test program, as a stand-in that passes: inside the checkout for a path, on PATH for a bare name. */
function focusedProgram(t: { after: (fn: () => void) => void }, pack: Pack, source: string): void {
  const program: string = pack.template.focused_test.program;
  if (/[\\/]/.test(program)) { writeProgram(path.join(source, program), "console.log('focused tests passed');\n"); return; }
  const bin = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-bin-')));
  writeProgram(path.join(bin, program), "console.log(JSON.stringify(process.argv.slice(2)));\n");
  const previous = process.env.PATH; process.env.PATH = `${bin}${path.delimiter}${previous}`;
  t.after(() => { process.env.PATH = previous; fs.rmSync(bin, { recursive: true, force: true }); });
}
function writeMap(root: string, pack: Pack): void {
  const cite = (file: string) => `\`source/${file}\``;
  const [first, second = first, third = second] = pack.template.compatibility.required_files as string[];
  fs.writeFileSync(path.join(root, '.apprenticeship/knowledge/codebase-map.md'), `# ${pack.project.name} codebase map\n\n## Service boundaries\nThe task surface lives in ${cite(third!)}.\n## Startup order\nThe project is configured by ${cite(first!)}.\n## One request path\nThe behavior under change flows through ${cite(third!)}.\n## Tests and feedback loop\nFocused tests run with the pack's command; see ${cite(second!)}.\n## Unknowns and risks\nHow callers report the new failure needs investigation.\n`);
}

test('every curated upstream pack is well formed, pinned, and routed from a recommending track', () => {
  assert.ok(packs.length >= 2, 'at least two upstream packs beyond PetClinic');
  for (const { project, template, track } of packs) {
    assert.equal(template.project_id, project.id);
    assert.equal(template.type, 'TRAINING');
    assert.match(template.context, /not an upstream issue or contribution request/);
    assert.ok(template.acceptance_criteria.some((item: { id: string }) => item.id === 'AC-explanation'), `${template.id} has AC-explanation`);
    assert.ok(template.constraints.some((item: string) => /Do not push/.test(item) && /publish/.test(item)));
    assert.ok(template.investigation_paths.length && template.focused_test.program && template.investigation_prompt);
    assert.equal(project.contribution_readiness.status, 'verified');
    assert.ok(project.sources.some((source: { revision: string }) => /^[0-9a-f]{40}$/.test(source.revision)), `${project.id} records the pinned commit`);
    assert.ok(track, `${project.id} is recommended by a track`);
    assert.ok(runnablePaths(track).some(item => item.kind === 'project' && item.id === project.id), `${track} routes to ${project.id}`);
  }
});

for (const pack of packs) {
  test(`${pack.project.id} ${pack.template.id}: the whole pack journey runs against a fixture checkout`, async t => {
    const { root, source } = fixture(t, pack);
    focusedProgram(t, pack, source);
    const adapter = new ScriptedRoleAdapter([
      { rationale: 'No inspected learner work exists, so capability remains unknown.' },
      { decision: 'approve', rationale: 'The design states behavior, a rejected alternative, tests and a failure case.', risks: [] },
      { outcome: 'approve', findings: ['The bounded change and captured focused tests satisfy the frozen task.'] },
      { outcome: 'accepted', findings: ['Every criterion has a current artifact.'], evidence_rationale: 'One reviewed bounded change with focused tests.' },
      { outcome: 'continue', findings: ['One bounded task is not longitudinal evidence.'], next_task_adjustment: 'Keep the next task to one boundary.' }
    ]);
    await onboard(root, [], true, adapter);
    assert.equal(selectCatalogProject(root, pack.project.id, 'source').outcome, 'success');
    initMap(root); writeMap(root, pack); assert.equal(checkMap(root).outcome, 'success');
    assert.equal(assignTask(root).outcome, 'success');
    assert.equal(currentTask(root)!.title, pack.template.title);
    beginTask(root);
    const design = path.join(root, 'design.md'); fs.writeFileSync(design, '# Contract\nReport the failure by name.\n# Alternative\nA silent default was rejected.\n# Tests\nValid, invalid and mixed cases.\n# First failure\nCallers that relied on the silence.\n');
    await submitDesign(root, design, adapter);
    fs.appendFileSync(path.join(source, pack.template.compatibility.required_files.at(-1)), 'learner change\n');
    submitChange(root);
    const run = testTask(root, 'Focused tests pass.');
    assert.equal(run.outcome, 'success', JSON.stringify(run));
    assert.equal((await codeReview(root, adapter)).review_outcome, 'approve');
    assert.equal((await taskReview(root, adapter)).outcome, 'success');
    assert.equal((await performanceReview(root, adapter)).review_outcome, 'continue');
    assert.equal(nextAction(root).phase, 'COMPLETE');
    const validation = inspectWorkspace('validate', root);
    assert.equal(validation.outcome, 'success', JSON.stringify(validation.diagnostics));
    assert.equal(validation.coverage, 'simulation');
    const testRun = fs.readdirSync(path.join(root, 'apprenticeship-artifacts/test-runs')).map(file => JSON.parse(fs.readFileSync(path.join(root, 'apprenticeship-artifacts/test-runs', file), 'utf8')))[0];
    assert.equal(testRun.command, [pack.template.focused_test.program, ...pack.template.focused_test.args].join(' '));
    if (!/[\\/]/.test(pack.template.focused_test.program)) assert.deepEqual(JSON.parse(testRun.stdout), pack.template.focused_test.args, 'a bare program runs from PATH with the pack arguments');
  });

  test(`${pack.project.id} ${pack.template.id}: a checkout without a required fragment is refused`, async t => {
    const fragment = pack.template.compatibility.required_fragments.at(-1);
    const { root } = fixture(t, pack, fragment);
    await onboard(root, [], true, new ScriptedRoleAdapter([{ rationale: 'No inspected work exists.' }]));
    assert.throws(() => selectCatalogProject(root, pack.project.id, 'source'), { code: 'TASK_INCOMPATIBLE' });
  });
}
