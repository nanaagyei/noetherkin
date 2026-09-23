import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { bindApprovedInit, publishInit } from '../core/bootstrap.js';
import { ScriptedRoleAdapter } from '../core/adapters.js';
import { selectTrack } from '../core/tracks.js';
import { onboard, validateSimulationCandidate } from '../core/simulation.js';
import { GenericCapabilityHostAdapter } from '../adapters/hosts/generic/index.js';
import { CodexCapabilityHostAdapter } from '../adapters/hosts/codex/index.js';
import { ClaudeCodeCapabilityHostAdapter } from '../adapters/hosts/claude-code/index.js';
import { decodeOnboardingHandoff, validateOnboardingHandoff } from '../adapters/hosts/generic/onboarding.js';
import { installCapabilities, portableSkillIds } from '../adapters/hosts/generic/index.js';
import { sha256 } from '../core/common.js';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));
const input = { display_name: 'Prince', goals: ['Learn portable engineering workflows'], assistance_default_max: 3 };
type Harness = { profile: { host: string }; project: GenericCapabilityHostAdapter['project']; invoke: GenericCapabilityHostAdapter['invoke'] };

function workspace(t: { after: (fn: () => void) => void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'apprenticeship-host-adapter-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function token(result: Awaited<ReturnType<Harness['invoke']>>): string {
  assert.equal(result.outcome, 'consent-required');
  assert.equal(result.next_action?.kind, 'terminal-handoff');
  return result.next_action!.token;
}

async function exercise(adapter: Harness, root: string): Promise<string[]> {
  const outcomes: string[] = [];
  let result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input: {} });
  outcomes.push(result.outcome); assert.equal(result.diagnostics[0]?.path, 'display_name');
  result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input: { display_name: 'Prince' } });
  outcomes.push(result.outcome); assert.equal(result.diagnostics[0]?.path, 'goals');
  result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input });
  outcomes.push(result.outcome); assert.deepEqual(fs.readdirSync(root), []);
  const initHandoff = decodeOnboardingHandoff(token(result)); validateOnboardingHandoff(root, initHandoff);
  const proposal = initHandoff.input.proposal;
  publishInit(root, proposal, bindApprovedInit(root, proposal, true));

  result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input: {} });
  outcomes.push(result.outcome); assert.equal(result.diagnostics[0]?.path, 'track_id');
  result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input: { track_id: 'backend-engineering' } });
  outcomes.push(result.outcome);
  const trackHandoff = decodeOnboardingHandoff(token(result)); validateOnboardingHandoff(root, trackHandoff);
  selectTrack(root, trackHandoff.input.track_id, files => validateSimulationCandidate(root, files));

  result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input: { constraints: ['Offline tests only'] } });
  outcomes.push(result.outcome);
  const completionHandoff = decodeOnboardingHandoff(token(result)); validateOnboardingHandoff(root, completionHandoff);
  await onboard(root, completionHandoff.input.constraints, true, new ScriptedRoleAdapter([{ rationale: 'No inspected learner work exists, so every baseline finding remains unassessed.' }]));

  result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input: {} });
  outcomes.push(result.outcome); assert.equal(result.confirmed.readiness, 'ready'); assert.equal(result.confirmed.onboarding, 'complete');
  return outcomes;
}

test('generic, Codex, and Claude expose one conforming onboarding capability', async t => {
  const adapters: Harness[] = [new GenericCapabilityHostAdapter(), new CodexCapabilityHostAdapter('missing-codex-for-test'), new ClaudeCodeCapabilityHostAdapter('missing-claude-for-test')];
  const sequences: string[][] = [];
  for (const adapter of adapters) sequences.push(await exercise(adapter, workspace(t)));
  assert.deepEqual(sequences[1], sequences[0]); assert.deepEqual(sequences[2], sequences[0]);
  assert.deepEqual(sequences[0], ['needs-input', 'needs-input', 'consent-required', 'needs-input', 'consent-required', 'consent-required', 'no-change']);
});

test('host projections preserve exact portable bundle bytes and only change target paths', () => {
  const adapters = [new GenericCapabilityHostAdapter(), new CodexCapabilityHostAdapter('missing'), new ClaudeCodeCapabilityHostAdapter('missing')];
  const projections = adapters.map(adapter => adapter.project('onboarding'));
  assert.equal(new Set(projections.map(item => item.source_manifest_sha256)).size, 1);
  assert.equal(new Set(projections.map(item => item.protocol_version)).size, 1);
  assert.deepEqual(projections[0]!.files.map(file => file.sha256), projections[1]!.files.map(file => file.sha256));
  assert.deepEqual(projections[0]!.files.map(file => file.sha256), projections[2]!.files.map(file => file.sha256));
  for (const projection of projections) for (const file of projection.files) assert.ok(fs.existsSync(file.source));
  assert.ok(projections[0]!.files.some(file => file.source === path.join(repository, 'skills/onboarding/SKILL.md')));
  assert.deepEqual(projections.map(item => item.invocation_surfaces[0]), ['capability:onboarding', '$onboarding', '/onboarding']);
});

test('unavailable hosts degrade truthfully without affecting generic invocation', async t => {
  const codex = new CodexCapabilityHostAdapter('definitely-not-a-real-codex-binary');
  const claude = new ClaudeCodeCapabilityHostAdapter('definitely-not-a-real-claude-binary');
  assert.equal(codex.probe().available, false); assert.equal(claude.probe().available, false);
  assert.match(codex.probe().limitations[0]!, /proposal/); assert.match(claude.probe().limitations[0]!, /proposal/);
  assert.equal((await codex.invoke({ capability_id: 'onboarding', workspace: workspace(t), input })).outcome, 'consent-required');
});

test('handoffs reject tampering, workspace changes, and mismatched roots without mutation', async t => {
  const adapter = new GenericCapabilityHostAdapter(); const root = workspace(t); const other = workspace(t);
  const result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input });
  const original = token(result); const decoded = JSON.parse(Buffer.from(original, 'base64url').toString('utf8'));
  decoded.input.proposal.request.display_name = 'Forged';
  assert.throws(() => decodeOnboardingHandoff(Buffer.from(JSON.stringify(decoded)).toString('base64url')), /proposal digest/);
  const handoff = decodeOnboardingHandoff(original);
  assert.throws(() => validateOnboardingHandoff(other, handoff), /different workspace/);
  fs.mkdirSync(path.join(root, '.apprenticeship'));
  assert.throws(() => validateOnboardingHandoff(root, handoff), /appeared after/);
  assert.deepEqual(fs.readdirSync(path.join(root, '.apprenticeship')), []);

  const initialized = workspace(t); const prepared = await adapter.invoke({ capability_id: 'onboarding', workspace: initialized, input });
  const init = decodeOnboardingHandoff(token(prepared)); const proposal = init.input.proposal;
  publishInit(initialized, proposal, bindApprovedInit(initialized, proposal, true));
  const track = decodeOnboardingHandoff(token(await adapter.invoke({ capability_id: 'onboarding', workspace: initialized, input: { track_id: 'backend-engineering' } })));
  fs.mkdirSync(path.join(initialized, '.apprenticeship/knowledge')); fs.writeFileSync(path.join(initialized, '.apprenticeship/knowledge/note.md'), 'new fact\n');
  assert.throws(() => validateOnboardingHandoff(initialized, track), /file set changed/);
});

test('a handoff token is proposal-only outside a direct terminal', async t => {
  const root = workspace(t); const adapter = new GenericCapabilityHostAdapter();
  const result = await adapter.invoke({ capability_id: 'onboarding', workspace: root, input });
  const run = spawnSync(process.execPath, [cli, 'adapter-handoff', '--workspace', root, '--handoff', token(result), '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 3, run.stderr); const output = JSON.parse(run.stdout);
  assert.equal(output.outcome, 'proposal'); assert.equal(output.diagnostics[0].code, 'DIRECT_CONSENT_REQUIRED');
  assert.deepEqual(fs.readdirSync(root), []);
});

test('invalid existing state blocks onboarding and reports the exact validation path', async t => {
  const root = workspace(t); fs.mkdirSync(path.join(root, '.apprenticeship')); fs.writeFileSync(path.join(root, '.apprenticeship/config.yaml'), '{}\n');
  const result = await new GenericCapabilityHostAdapter().invoke({ capability_id: 'onboarding', workspace: root, input });
  assert.equal(result.outcome, 'blocked'); assert.ok(result.diagnostics.length > 0); assert.ok(result.diagnostics.some(item => item.path.includes('config.yaml')));
});

test('every portable skill projects with identical bytes into each host location', () => {
  const ids = portableSkillIds();
  const manifest = JSON.parse(fs.readFileSync(path.join(repository, 'skill-pack/manifest.json'), 'utf8'));
  assert.equal(ids.length, manifest.skills.length);
  const adapters = [new GenericCapabilityHostAdapter(), new CodexCapabilityHostAdapter('missing'), new ClaudeCodeCapabilityHostAdapter('missing')];
  const roots = ['skills', '.codex/skills', '.claude/skills'];
  const surfaces = ['capability:', '$', '/'];
  for (const id of ids) {
    const projections = adapters.map(adapter => adapter.project(id));
    projections.forEach((projection, index) => {
      assert.equal(projection.target_root, `${roots[index]}/${id}`);
      assert.deepEqual(projection.invocation_surfaces, [`${surfaces[index]}${id}`]);
      assert.ok(projection.files.every(file => file.target.startsWith(`${projection.target_root}/`)));
      assert.ok(projection.files.some(file => file.target === `${projection.target_root}/SKILL.md`));
    });
    assert.deepEqual(projections[1]!.files.map(file => file.sha256), projections[0]!.files.map(file => file.sha256));
    assert.deepEqual(projections[2]!.files.map(file => file.sha256), projections[0]!.files.map(file => file.sha256));
  }
  assert.deepEqual(adapters[2]!.profile.discovery.explicit, ids.map(id => `/${id}`));
  assert.throws(() => adapters[0]!.project('not-a-skill'), { code: 'UNSUPPORTED_CAPABILITY' });
});

test('capabilities without a host bridge report blocked instead of pretending to run', async t => {
  const result = await new ClaudeCodeCapabilityHostAdapter('missing').invoke({ capability_id: 'debug', workspace: workspace(t), input: {} });
  assert.equal(result.outcome, 'blocked'); assert.equal(result.diagnostics[0]?.code, 'NO_CONTROLLER_BRIDGE'); assert.equal(result.next_action, null);
  await assert.rejects(new GenericCapabilityHostAdapter().invoke({ capability_id: 'not-a-skill', workspace: workspace(t), input: {} }), { code: 'UNSUPPORTED_CAPABILITY' });
});

test('install copies verified bundles, is idempotent, and never overwrites a differing file', t => {
  const target = workspace(t);
  const adapter = new ClaudeCodeCapabilityHostAdapter('missing');
  const first = installCapabilities(adapter, target, portableSkillIds());
  assert.equal(first.capabilities.length, portableSkillIds().length);
  assert.ok(first.capabilities.every(item => item.written > 0 && item.unchanged === 0));
  for (const file of adapter.project('teach').files) assert.equal(sha256(fs.readFileSync(path.join(target, file.target))), file.sha256);
  const again = installCapabilities(adapter, target, ['teach']);
  assert.equal(again.capabilities[0]!.written, 0); assert.ok(again.capabilities[0]!.unchanged > 0);

  const conflicted = workspace(t);
  const entry = path.join(conflicted, '.claude/skills/debug/SKILL.md');
  fs.mkdirSync(path.dirname(entry), { recursive: true }); fs.writeFileSync(entry, 'someone else\'s debug skill\n');
  assert.throws(() => installCapabilities(adapter, conflicted, ['teach', 'debug']), { code: 'CONFLICT' });
  assert.deepEqual(fs.readdirSync(path.join(conflicted, '.claude/skills')), ['debug'], 'a conflict writes nothing, including other skills');
  assert.equal(fs.readFileSync(entry, 'utf8'), "someone else's debug skill\n");
});

test('skills CLI lists capabilities and installs them for a named host', t => {
  const target = workspace(t);
  const list = spawnSync(process.execPath, [cli, 'skills', 'list', '--json'], { encoding: 'utf8' });
  assert.equal(list.status, 0, list.stderr);
  const skills = JSON.parse(list.stdout).data.skills;
  assert.deepEqual(skills.map((skill: { name: string }) => skill.name), portableSkillIds());
  assert.ok(skills.every((skill: { description: string }) => skill.description.length > 0));
  const install = spawnSync(process.execPath, [cli, 'skills', 'install', '--host', 'codex', '--skill', 'teach', '--target', target, '--json'], { encoding: 'utf8' });
  assert.equal(install.status, 0, install.stdout);
  assert.ok(fs.existsSync(path.join(target, '.codex/skills/teach/SKILL.md')));
  assert.equal(spawnSync(process.execPath, [cli, 'skills', 'install', '--host', 'cursor', '--target', target, '--json'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(process.execPath, [cli, 'status', '--host', 'codex', '--json'], { encoding: 'utf8', cwd: target }).status, 2);
});
