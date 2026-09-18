import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { encode } from '../core/common.js';
import { digest, reclaimDeadLock, runtime } from '../core/storage.js';
import { bindApprovedTransaction, existingTransaction, makeTransaction, planTransactionRecovery, publishTransaction, recoverTransaction } from '../core/transactions.js';

const request = { display_name: 'Prince', goals: ['Learn PetClinic'], assistance_default_max: 3 };
function workspace(t: { after: (fn: () => void) => void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'apprenticeship-transaction-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const proposal = proposeInit(request);
  publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  return root;
}
function updatePlan(root: string) {
  const profilePath = '.apprenticeship/profile.yaml';
  const profile = JSON.parse(fs.readFileSync(path.join(root, profilePath), 'utf8'));
  profile.onboarding = 'complete';
  const actor = profileActor(root);
  return makeTransaction(root, {
    operation_id: runtime.id('OP'), actor, action: 'onboard', target: profile.learner_id,
    request: { onboarding: 'complete' }, expected_read_digests: { [profilePath]: digest(root, profilePath) },
    output_record_ids: [], authorization_description: 'Test onboarding authorization',
    writes: new Map([[profilePath, encode(profile)], ['.apprenticeship/knowledge/onboarding.md', '# Confirmed constraints\n']])
  });
}
function profileActor(root: string) {
  const config = JSON.parse(fs.readFileSync(path.join(root, '.apprenticeship/config.yaml'), 'utf8'));
  const actor = config.principals.find((principal: any) => principal.role === 'onboarding-coordinator');
  return { id: actor.id, role: actor.role };
}

test('generic transaction atomically publishes an update and a creation', t => {
  const root = workspace(t);
  const plan = updatePlan(root);
  publishTransaction(root, plan, bindApprovedTransaction(root, plan, true), () => {});
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.apprenticeship/profile.yaml'), 'utf8')).onboarding, 'complete');
  assert.equal(fs.readFileSync(path.join(root, '.apprenticeship/knowledge/onboarding.md'), 'utf8'), '# Confirmed constraints\n');
  assert.equal(fs.existsSync(path.join(root, '.apprenticeship/pending.json')), false);
  assert.deepEqual(existingTransaction(root, plan.receipt.operation_id, plan.receipt.input_digest), { operation_id: plan.receipt.operation_id, output_record_ids: [] });
  assert.throws(() => existingTransaction(root, plan.receipt.operation_id, '0'.repeat(64)), /different inputs/);
});

test('a crash checkpoint stays private and recovery completes the whole transaction', t => {
  const root = workspace(t);
  const plan = updatePlan(root);
  let publications = 0;
  const crashing = { ...runtime, boundary: (name: string) => {
    if (name.startsWith('published:') && ++publications === 1) throw new Error('simulated crash');
  } };
  assert.throws(() => publishTransaction(root, plan, bindApprovedTransaction(root, plan, true), () => {}, crashing), /simulated crash/);
  assert.equal(fs.existsSync(path.join(root, '.apprenticeship/pending.json')), true);
  const recovery = planTransactionRecovery(root);
  assert.equal(recovery.action, 'complete');
  assert.ok(recovery.observed_checkpoint.some(item => item.state === 'new'));
  assert.ok(recovery.observed_checkpoint.some(item => item.state !== 'new'));
  recoverTransaction(root, recovery, () => {});
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.apprenticeship/profile.yaml'), 'utf8')).onboarding, 'complete');
  assert.equal(fs.readFileSync(path.join(root, '.apprenticeship/knowledge/onboarding.md'), 'utf8'), '# Confirmed constraints\n');
});

test('manual edits to a half-written checkpoint are rejected as a recovery conflict', t => {
  const root = workspace(t);
  const plan = updatePlan(root);
  let publications = 0;
  const crashing = { ...runtime, boundary: (name: string) => {
    if (name.startsWith('published:') && ++publications === 1) throw new Error('simulated crash');
  } };
  assert.throws(() => publishTransaction(root, plan, bindApprovedTransaction(root, plan, true), () => {}, crashing));
  fs.writeFileSync(path.join(root, '.apprenticeship/profile.yaml'), '{"manual":"conflict"}\n');
  assert.throws(() => planTransactionRecovery(root), /neither side of the retained transaction/);
});

test('rollback restores the prior complete snapshot when a proposed snapshot is damaged', t => {
  const root = workspace(t);
  const before = fs.readFileSync(path.join(root, '.apprenticeship/profile.yaml'), 'utf8');
  const plan = updatePlan(root);
  let publications = 0;
  const crashing = { ...runtime, boundary: (name: string) => {
    if (name.startsWith('published:') && ++publications === 1) throw new Error('simulated crash');
  } };
  assert.throws(() => publishTransaction(root, plan, bindApprovedTransaction(root, plan, true), () => {}, crashing));
  const pending = JSON.parse(fs.readFileSync(path.join(root, '.apprenticeship/pending.json'), 'utf8'));
  const proposed = pending.changes[0].new_snapshot.uri.slice('workspace:/'.length);
  fs.writeFileSync(path.join(root, proposed), 'damaged');
  const recovery = planTransactionRecovery(root);
  assert.equal(recovery.action, 'rollback');
  recoverTransaction(root, recovery, () => {});
  assert.equal(fs.readFileSync(path.join(root, '.apprenticeship/profile.yaml'), 'utf8'), before);
  assert.equal(fs.existsSync(path.join(root, '.apprenticeship/knowledge/onboarding.md')), false);
});
