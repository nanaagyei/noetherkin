import { canonical, closed, encode, Failure, requireThat, sha256, validId, type ObjectValue } from './common.js';
import { parse } from './parsing.js';
import { assertLock, digest, durable, exists, read, remove, runtime, safePath, statePath, syncDirectory, withLock, type Runtime } from './storage.js';

export type ActorRole = 'learner' | 'onboarding-coordinator' | 'project-curator' | 'peer-engineer' | 'team-lead' | 'manager' | 'user-agent' | 'promotion-reviewer';
export interface BoundActor { id: string; role: ActorRole }
export interface TransactionRequest {
  operation_id: string;
  actor: BoundActor;
  action: string;
  target: string;
  request: ObjectValue;
  expected_read_digests: Record<string, string | null>;
  output_record_ids: string[];
  writes: Map<string, string>;
  authorization_description: string;
}
export interface TransactionPlan {
  receipt: ObjectValue;
  files: Map<string, string>;
}
export interface TransactionRecoveryPlan {
  action: 'complete' | 'rollback' | 'cleanup';
  operation_id: string;
  paths: string[];
  observed_checkpoint: Array<{ path: string; state: 'old' | 'new' | 'absent' }>;
  fingerprint: string;
}

const transactionApprovals = new WeakMap<object, { root: string; receipt: string }>();
export function bindApprovedTransaction(root: string, plan: TransactionPlan, confirmed: boolean): object {
  requireThat(confirmed, 'CONSENT_REQUIRED', root, 'The transaction was not approved.');
  const capability = Object.freeze({});
  transactionApprovals.set(capability, { root, receipt: canonical(plan.receipt) });
  return capability;
}

const roles = new Set<ActorRole>(['learner', 'onboarding-coordinator', 'project-curator', 'peer-engineer', 'team-lead', 'manager', 'user-agent', 'promotion-reviewer']);
const receiptKeys = ['schema_version', 'operation_id', 'transaction_id', 'actor', 'authorized_at', 'authorization', 'input_digest', 'output_record_ids', 'changes'];
const artifact = (relative: string, bytes: string | Buffer, description: string) => ({ uri: `workspace:/${relative}`, revision: `sha256:${sha256(bytes)}`, description });
const receiptPath = (id: string) => statePath(`operations/${id}.json`);
export const transactionPendingPath = statePath('pending.json');

export function transactionArtifactPath(value: ObjectValue, directory: 'snapshots' | 'authorizations'): string {
  closed(value, ['uri', 'revision', 'description'], directory);
  requireThat(typeof value.description === 'string' && value.description.length > 0 && /^sha256:[a-f0-9]{64}$/.test(value.revision), 'RECEIPT_INVALID', directory, 'Expected a SHA-256 immutable artifact.');
  const relative = statePath(`${directory}/${value.revision.slice(7)}.json`);
  requireThat(value.uri === `workspace:/${relative}`, 'RECEIPT_INVALID', directory, 'Artifact URI must match its content digest and retention directory.');
  return relative;
}

export function validateTransactionEnvelope(receipt: ObjectValue, pending = false): void {
  closed(receipt, pending ? [...receiptKeys, 'phase'] : receiptKeys, 'receipt');
  requireThat(!pending || receipt.phase === 'prepared', 'RECEIPT_INVALID', transactionPendingPath, 'Only prepared transactions are supported.');
  requireThat(receipt.schema_version === '2.0' && validId(receipt.operation_id, 'OP') && validId(receipt.transaction_id, 'TX') && /^[a-f0-9]{64}$/.test(receipt.input_digest), 'RECEIPT_INVALID', 'receipt', 'Unsupported or malformed receipt identity or digest.');
  requireThat(typeof receipt.authorized_at === 'string' && Number.isFinite(Date.parse(receipt.authorized_at)), 'RECEIPT_INVALID', 'receipt', 'Authorization time must be a valid timestamp.');
  closed(receipt.actor, ['id', 'role'], 'receipt.actor');
  requireThat(validId(receipt.actor.id, 'ACTOR') && roles.has(receipt.actor.role), 'AUTHORITY_INVALID', 'receipt.actor', 'Receipt actor must be a registered protocol role.');
  transactionArtifactPath(receipt.authorization, 'authorizations');
  requireThat(Array.isArray(receipt.output_record_ids) && new Set(receipt.output_record_ids).size === receipt.output_record_ids.length, 'RECEIPT_INVALID', 'receipt.output_record_ids', 'Output record IDs must be unique.');
  requireThat(Array.isArray(receipt.changes) && receipt.changes.length > 0, 'RECEIPT_INVALID', 'receipt.changes', 'A transaction must change at least one file.');
  const paths = new Set<string>();
  for (const change of receipt.changes) {
    closed(change, ['path', 'old_digest', 'new_digest', 'old_snapshot', 'new_snapshot'], 'receipt.changes');
    requireThat(typeof change.path === 'string' && !paths.has(change.path), 'RECEIPT_INVALID', 'receipt.changes', 'Transaction paths must be unique.');
    requireThat(change.path.startsWith('.apprenticeship/') && !['.apprenticeship/pending.json'].includes(change.path), 'RECEIPT_INVALID', change.path, 'Transactions may write only recognized apprenticeship state paths.');
    requireThat(change.old_digest === null || /^[a-f0-9]{64}$/.test(change.old_digest), 'RECEIPT_INVALID', change.path, 'Old digest must be null or SHA-256.');
    requireThat(/^[a-f0-9]{64}$/.test(change.new_digest), 'RECEIPT_INVALID', change.path, 'New digest must be SHA-256.');
    requireThat((change.old_digest === null) === (change.old_snapshot === null), 'RECEIPT_INVALID', change.path, 'Old snapshots are required exactly for existing files.');
    if (change.old_snapshot) {
      requireThat(change.old_snapshot.revision === `sha256:${change.old_digest}`, 'RECEIPT_INVALID', change.path, 'Old snapshot digest does not match.');
      transactionArtifactPath(change.old_snapshot, 'snapshots');
    }
    requireThat(change.new_snapshot.revision === `sha256:${change.new_digest}`, 'RECEIPT_INVALID', change.path, 'New snapshot digest does not match.');
    transactionArtifactPath(change.new_snapshot, 'snapshots');
    paths.add(change.path);
  }
}

export function makeTransaction(root: string, input: TransactionRequest, rt: Runtime = runtime): TransactionPlan {
  requireThat(validId(input.operation_id, 'OP'), 'ID_INVALID', 'operation-id', 'Operation ID must be OP-UUID.');
  requireThat(validId(input.actor.id, 'ACTOR') && roles.has(input.actor.role), 'AUTHORITY_INVALID', 'actor', 'A bound registered protocol actor is required.');
  requireThat(typeof input.action === 'string' && input.action.length > 0 && typeof input.target === 'string' && input.target.length > 0, 'INPUT_REQUIRED', 'transaction', 'Action and target are required.');
  requireThat(input.writes.size > 0, 'INPUT_REQUIRED', 'transaction', 'At least one state write is required.');
  const at = rt.now();
  const transactionId = rt.id('TX');
  const authorization = { schema_version: '2.0', action: input.action, target: input.target, operation_id: input.operation_id, actor: input.actor, authorized_at: at, request: input.request, expected_read_digests: input.expected_read_digests };
  const authBytes = encode(authorization);
  const authPath = statePath(`authorizations/${sha256(authBytes)}.json`);
  const files = new Map(input.writes);
  files.set(authPath, authBytes);
  const changes = [...files].flatMap(([file, bytes]) => {
    const expected = Object.hasOwn(input.expected_read_digests, file) ? input.expected_read_digests[file]! : digest(root, file, rt);
    const actual = digest(root, file, rt);
    requireThat(actual === expected, 'STALE_READ', file, 'Current bytes differ from the caller\'s expected digest.');
    const oldSnapshot = actual === null ? null : artifact(statePath(`snapshots/${actual}.json`), read(root, file, rt), `Pre-transaction snapshot of ${file}`);
    const nextDigest = sha256(bytes);
    if (actual === nextDigest) return [];
    return [{ path: file, old_digest: actual, new_digest: nextDigest, old_snapshot: oldSnapshot, new_snapshot: artifact(statePath(`snapshots/${nextDigest}.json`), bytes, `Post-transaction snapshot of ${file}`) }];
  });
  const receipt = { schema_version: '2.0', operation_id: input.operation_id, transaction_id: transactionId, actor: input.actor, authorized_at: at, authorization: artifact(authPath, authBytes, input.authorization_description), input_digest: sha256(canonical({ request: input.request, bound_actor: input.actor, expected_read_digests: input.expected_read_digests })), output_record_ids: input.output_record_ids, changes };
  validateTransactionEnvelope(receipt);
  return { receipt, files };
}

function snapshotBytes(root: string, value: ObjectValue, expected: string, rt: Runtime): string {
  const bytes = read(root, transactionArtifactPath(value, 'snapshots'), rt);
  requireThat(sha256(bytes) === expected, 'SNAPSHOT_INVALID', value.uri, 'Retained snapshot digest does not match.');
  return bytes.toString('utf8');
}

function assertCurrentIsOldOrNew(root: string, receipt: ObjectValue, rt: Runtime): void {
  for (const change of receipt.changes) {
    const current = digest(root, change.path, rt);
    requireThat(current === change.old_digest || current === change.new_digest, 'STATE_CONFLICT', change.path, 'Current bytes are neither side of the retained transaction.');
  }
}

function recoveryFingerprint(root: string, receipt: ObjectValue, rt: Runtime): string {
  const paths = [transactionPendingPath, receiptPath(receipt.operation_id), ...receipt.changes.flatMap((change: ObjectValue) => [change.path, transactionArtifactPath(change.new_snapshot, 'snapshots'), ...(change.old_snapshot ? [transactionArtifactPath(change.old_snapshot, 'snapshots')] : [])])];
  return sha256(canonical(paths.map(path => [path, digest(root, path, rt)])));
}

function completeTransaction(root: string, receipt: ObjectValue, files: Map<string, string>, rt: Runtime): void {
  assertCurrentIsOldOrNew(root, receipt, rt);
  for (const change of receipt.changes) {
    assertLock(root, rt);
    if (digest(root, change.path, rt) !== change.new_digest) durable(root, change.path, files.get(change.path)!, rt, change.old_digest === null);
    rt.boundary(`published:${change.path}`);
  }
  assertLock(root, rt);
  durable(root, receiptPath(receipt.operation_id), encode(receipt), rt, true);
  rt.boundary('committed');
  assertLock(root, rt);
  remove(root, transactionPendingPath, rt);
  rt.boundary('finished');
}

function retainSnapshot(root: string, snapshot: ObjectValue, bytes: string | Buffer, rt: Runtime): void {
  const file = transactionArtifactPath(snapshot, 'snapshots');
  if (exists(safePath(root, file, rt), rt)) {
    requireThat(sha256(read(root, file, rt)) === snapshot.revision.slice(7), 'SNAPSHOT_INVALID', file, 'Existing retained snapshot has different bytes.');
    return;
  }
  durable(root, file, bytes, rt, true);
}

export function publishTransaction(root: string, plan: TransactionPlan, capability: object, validateCandidate: (files: Map<string, string>) => void, rt: Runtime = runtime): ObjectValue {
  const binding = transactionApprovals.get(capability);
  requireThat(binding?.root === root && binding.receipt === canonical(plan.receipt), 'BINDING_REQUIRED', root, 'The trusted controller must bind this exact transaction and actor.');
  transactionApprovals.delete(capability);
  return withLock(root, () => {
    requireThat(!exists(safePath(root, transactionPendingPath, rt), rt), 'RECOVERY_REQUIRED', transactionPendingPath, 'A prior publication requires recovery.');
    validateTransactionEnvelope(plan.receipt);
    for (const change of plan.receipt.changes) requireThat(digest(root, change.path, rt) === change.old_digest, 'STALE_READ', change.path, 'State changed after the transaction was prepared.');
    validateCandidate(plan.files);
    rt.boundary('validated');
    for (const change of plan.receipt.changes) {
      if (change.old_snapshot) retainSnapshot(root, change.old_snapshot, read(root, change.path, rt), rt);
      retainSnapshot(root, change.new_snapshot, plan.files.get(change.path)!, rt);
    }
    const authPath = transactionArtifactPath(plan.receipt.authorization, 'authorizations');
    if (!exists(safePath(root, authPath, rt), rt)) durable(root, authPath, plan.files.get(authPath)!, rt, true);
    assertLock(root, rt);
    durable(root, transactionPendingPath, encode({ ...plan.receipt, phase: 'prepared' }), rt, true);
    rt.boundary('prepared');
    completeTransaction(root, plan.receipt, plan.files, rt);
    return { operation_id: plan.receipt.operation_id, output_record_ids: plan.receipt.output_record_ids };
  }, rt);
}

export function planTransactionRecovery(root: string, rt: Runtime = runtime): TransactionRecoveryPlan {
  const pending = parse(read(root, transactionPendingPath, rt), transactionPendingPath);
  validateTransactionEnvelope(pending, true);
  const { phase: _phase, ...receipt } = pending;
  assertCurrentIsOldOrNew(root, receipt, rt);
  let action: TransactionRecoveryPlan['action'];
  if (exists(safePath(root, receiptPath(receipt.operation_id), rt), rt)) {
    requireThat(canonical(parse(read(root, receiptPath(receipt.operation_id), rt), 'receipt')) === canonical(receipt), 'RECEIPT_INVALID', 'receipt', 'Committed receipt conflicts with pending transaction.');
    requireThat(receipt.changes.every((change: ObjectValue) => digest(root, change.path, rt) === change.new_digest), 'STATE_CONFLICT', 'receipt', 'Committed state is incomplete.');
    action = 'cleanup';
  } else {
    try {
      for (const change of receipt.changes) snapshotBytes(root, change.new_snapshot, change.new_digest, rt);
      action = 'complete';
    } catch {
      for (const change of receipt.changes) if (change.old_snapshot) snapshotBytes(root, change.old_snapshot, change.old_digest, rt);
      action = 'rollback';
    }
  }
  const observed_checkpoint = receipt.changes.map((change: ObjectValue) => {
    const current = digest(root, change.path, rt);
    return { path: change.path, state: (current === change.new_digest ? 'new' : current === null ? 'absent' : 'old') as 'old' | 'new' | 'absent' };
  });
  return { action, operation_id: receipt.operation_id, paths: receipt.changes.map((change: ObjectValue) => change.path), observed_checkpoint, fingerprint: recoveryFingerprint(root, receipt, rt) };
}

export function recoverTransaction(root: string, approved: TransactionRecoveryPlan, validateCandidate: (files: Map<string, string>) => void, rt: Runtime = runtime): ObjectValue {
  return withLock(root, () => {
    const current = planTransactionRecovery(root, rt);
    requireThat(canonical(current) === canonical(approved), 'STALE_READ', transactionPendingPath, 'Recovery inputs changed after review.');
    const { phase: _phase, ...receipt } = parse(read(root, transactionPendingPath, rt), transactionPendingPath);
    if (current.action === 'complete') {
      const files = new Map<string, string>();
      for (const change of receipt.changes) files.set(change.path, snapshotBytes(root, change.new_snapshot, change.new_digest, rt));
      validateCandidate(files);
      completeTransaction(root, receipt, files, rt);
    } else if (current.action === 'cleanup') {
      remove(root, transactionPendingPath, rt);
    } else {
      for (const change of [...receipt.changes].reverse()) {
        assertLock(root, rt);
        if (change.old_snapshot) durable(root, change.path, snapshotBytes(root, change.old_snapshot, change.old_digest, rt), rt);
        else if (digest(root, change.path, rt) === change.new_digest) remove(root, change.path, rt);
        rt.boundary(`rollback:${change.path}`);
      }
      remove(root, transactionPendingPath, rt);
    }
    return { operation_id: receipt.operation_id, recovery: current.action, output_record_ids: current.action === 'rollback' ? [] : receipt.output_record_ids };
  }, rt);
}

export function existingTransaction(root: string, operationId: string, inputDigest: string, rt: Runtime = runtime): ObjectValue | undefined {
  const file = receiptPath(operationId);
  if (!exists(safePath(root, file, rt), rt)) return undefined;
  const receipt = parse(read(root, file, rt), file);
  validateTransactionEnvelope(receipt);
  requireThat(receipt.input_digest === inputDigest, 'INPUT_CONFLICT', 'operation-id', 'Operation ID was already used with different inputs.');
  return { operation_id: operationId, output_record_ids: receipt.output_record_ids };
}

export function assertNoTransactionPending(root: string, rt: Runtime = runtime): void {
  if (exists(safePath(root, transactionPendingPath, rt), rt)) throw new Failure('RECOVERY_REQUIRED', transactionPendingPath, 'Publication is pending. Run doctor, then explicitly recover it.', 3);
}
