import { canonical, closed, encode, Failure, requireThat, sha256, validId, type ObjectValue } from './common.js';
import { parse } from './parsing.js';
import { bootstrapFiles, collect, inspectRecords } from './validation.js';
import { assertLock, digest, durable, exists, read, remove, runtime, safePath, statePath, syncDirectory, withLock, type Runtime } from './storage.js';

export interface InitRequest { display_name: string; goals: string[]; assistance_default_max: number }
export interface InitProposal {
  request: InitRequest;
  operation_id: string;
  workspace_id: string;
  learner_id: string;
  principals: { id: string; role: 'learner' | 'onboarding-coordinator' | 'project-curator' | 'peer-engineer' | 'team-lead' | 'manager' }[];
}
export function validateRequest(request: InitRequest): void {
  closed(request, ['display_name', 'goals', 'assistance_default_max'], 'init');
  requireThat(typeof request.display_name === 'string' && request.display_name.trim().length > 0 && Array.isArray(request.goals) && request.goals.length > 0 && request.goals.every(g => typeof g === 'string' && g.trim().length > 0) && new Set(request.goals).size === request.goals.length && Number.isInteger(request.assistance_default_max) && request.assistance_default_max >= 0 && request.assistance_default_max <= 7, 'INPUT_REQUIRED', 'init', 'Supply a display name, unique nonempty goals, and an integer assistance ceiling from 0 to 7.');
}
export function proposeInit(request: InitRequest, operationId?: string, rt = runtime): InitProposal {
  validateRequest(request);
  const operation_id = operationId ?? rt.id('OP');
  requireThat(validId(operation_id, 'OP'), 'ID_INVALID', 'operation-id', 'Operation ID must be OP-UUID.');
  return { request: structuredClone(request), operation_id, workspace_id: rt.id('WS'), learner_id: rt.id('LEARNER'), principals: ['learner', 'onboarding-coordinator', 'project-curator', 'peer-engineer', 'team-lead', 'manager'].map(role => ({ id: rt.id('ACTOR'), role })) as InitProposal['principals'] };
}

// Process-local capability issued by the direct controller only after consent.
// No actor fields, JSON file, environment variable, or model output can deserialize this binding.
const approvals = new WeakMap<object, { root: string; proposal: string }>();
export function bindApprovedInit(root: string, proposal: InitProposal, confirmed: boolean): object {
  requireThat(confirmed, 'CONSENT_REQUIRED', root, 'Initialization was not approved; no state was published.');
  const capability = Object.freeze({});
  approvals.set(capability, { root, proposal: canonical(proposal) });
  return capability;
}
const artifact = (relative: string, bytes: string | Buffer, description: string) => ({ uri: `workspace:/${relative}`, revision: `sha256:${sha256(bytes)}`, description });
const expectedReads = () => Object.fromEntries(bootstrapFiles.map(f => [statePath(f), null]));
const receiptKeys = ['schema_version', 'operation_id', 'transaction_id', 'actor', 'authorized_at', 'authorization', 'input_digest', 'output_record_ids', 'changes'];
const authKeys = ['schema_version', 'action', 'target', 'operation_id', 'actor', 'authorized_at', 'request', 'expected_read_digests', 'learner_id', 'principals', 'consent'];
const receiptPath = (id: string) => statePath(`operations/${id}.json`);
export const pendingPath = statePath('pending.json');

function makeCandidate(proposal: InitProposal, at: string, transactionId: string): { receipt: ObjectValue; files: Map<string, string> } {
  const actor = proposal.principals[1]!;
  const authorization = { schema_version: '2.0', action: 'init', target: proposal.workspace_id, operation_id: proposal.operation_id, actor, authorized_at: at, request: proposal.request, expected_read_digests: expectedReads(), learner_id: proposal.learner_id, principals: proposal.principals, consent: 'Learner approved this initial registry and coordinator invocation for workspace initialization.' };
  const authBytes = encode(authorization);
  const authPath = statePath(`authorizations/${sha256(authBytes)}.json`);
  const authArtifact = artifact(authPath, authBytes, 'Learner consent to the initial registry and bound initialization request');
  const common = { schema_version: '3.0', data_class: 'live' };
  const files = new Map<string, string>([
    [authPath, authBytes],
    [statePath('config.yaml'), encode({ ...common, workspace_id: proposal.workspace_id, created_at: at, mode: 'active', competency_catalog_version: '4.0', track_catalog_version: '1.1', forge_catalog_version: '1.0', level_catalog_version: '2.0', assistance_default_max: proposal.request.assistance_default_max, learner_id: proposal.learner_id, learner_principal_id: proposal.principals[0]!.id, principals: proposal.principals.map(p => ({ ...p, granted_at: at, retired_at: null, authorization: authArtifact })) })],
    [statePath('profile.yaml'), encode({ ...common, learner_id: proposal.learner_id, display_name: proposal.request.display_name, goals: proposal.request.goals, specialization_competencies: [], onboarding: 'pending', baseline_assessment_id: null, self_report: [] })],
    [statePath('current-project.yaml'), encode({ ...common, project_id: null, source_path: null, source_revision: null, selected_at: null })],
    [statePath('current-track.yaml'), encode({ ...common, track_id: null, track_catalog_version: null, definition_digest: null, selected_at: null, alignment_status: 'unselected', adopted_competencies: [], scope_agreement: null, aligned_at: null })],
    [statePath('competencies.yaml'), encode({ ...common, generated_at: at, source_assessment_ids: [], source_review_ids: [], effective_level: 'E0', entries: [], last_awarded_level: 'E0', standing: 'current', stale_record_ids: [] })]
  ]);
  const receipt = {
    schema_version: '2.0', operation_id: proposal.operation_id, transaction_id: transactionId, actor, authorized_at: at, authorization: authArtifact,
    input_digest: sha256(canonical({ request: proposal.request, bound_actor: actor, expected_read_digests: expectedReads() })),
    output_record_ids: [proposal.workspace_id, proposal.learner_id, ...proposal.principals.map(p => p.id)],
    changes: [...files].map(([file, bytes]) => ({ path: file, old_digest: null, new_digest: sha256(bytes), old_snapshot: null, new_snapshot: artifact(statePath(`snapshots/${sha256(bytes)}.json`), bytes, `Initialization snapshot of ${file}`) }))
  };
  return { receipt, files };
}

function artifactPath(value: ObjectValue, directory: 'snapshots' | 'authorizations'): string {
  closed(value, ['uri', 'revision', 'description'], directory);
  requireThat(typeof value.description === 'string' && value.description.length > 0 && /^sha256:[a-f0-9]{64}$/.test(value.revision), 'RECEIPT_INVALID', directory, 'Expected a SHA-256 immutable artifact.');
  const relative = statePath(`${directory}/${value.revision.slice(7)}.json`);
  requireThat(value.uri === `workspace:/${relative}`, 'RECEIPT_INVALID', directory, 'Artifact URI must match its content digest and retention directory.');
  return relative;
}
export function validateEnvelope(receipt: ObjectValue, pending = false): void {
  closed(receipt, pending ? [...receiptKeys, 'phase'] : receiptKeys, 'receipt');
  requireThat(!pending || receipt.phase === 'prepared', 'RECEIPT_INVALID', pendingPath, 'Only prepared transactions are supported.');
  requireThat(receipt.schema_version === '2.0' && validId(receipt.operation_id, 'OP') && validId(receipt.transaction_id, 'TX') && /^[a-f0-9]{64}$/.test(receipt.input_digest) && typeof receipt.authorized_at === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(receipt.authorized_at) && Number.isFinite(Date.parse(receipt.authorized_at)), 'RECEIPT_INVALID', 'receipt', 'Unsupported or malformed receipt identity, timestamp, or digest.');
  closed(receipt.actor, ['id', 'role'], 'receipt.actor');
  requireThat(validId(receipt.actor.id, 'ACTOR') && receipt.actor.role === 'onboarding-coordinator', 'AUTHORITY_INVALID', 'receipt.actor', 'Only an onboarding coordinator can publish this initialization.');
  const authPath = artifactPath(receipt.authorization, 'authorizations');
  requireThat(Array.isArray(receipt.changes) && receipt.changes.length === bootstrapFiles.length + 1, 'RECEIPT_INVALID', 'receipt.changes', 'Initialization must publish exactly its bootstrap records and authorization.');
  const paths: string[] = [];
  for (const change of receipt.changes) {
    closed(change, ['path', 'old_digest', 'new_digest', 'old_snapshot', 'new_snapshot'], 'receipt.changes');
    requireThat(typeof change.path === 'string' && change.old_digest === null && change.old_snapshot === null && /^[a-f0-9]{64}$/.test(change.new_digest), 'RECEIPT_INVALID', 'receipt.changes', 'Bootstrap may create absent files only.');
    requireThat(change.new_snapshot.revision === `sha256:${change.new_digest}`, 'RECEIPT_INVALID', change.path, 'Snapshot and proposed digest disagree.');
    artifactPath(change.new_snapshot, 'snapshots');
    paths.push(change.path);
  }
  requireThat(canonical(paths.sort()) === canonical([...bootstrapFiles.map(statePath), authPath].sort()), 'RECEIPT_INVALID', 'receipt.changes', 'Unexpected or duplicate initialization paths.');
  requireThat(Array.isArray(receipt.output_record_ids) && receipt.output_record_ids.length === 8 && new Set(receipt.output_record_ids).size === 8 && ['WS', 'LEARNER', 'ACTOR', 'ACTOR', 'ACTOR', 'ACTOR', 'ACTOR', 'ACTOR'].every((p, i) => validId(receipt.output_record_ids[i], p)), 'RECEIPT_INVALID', 'receipt.output_record_ids', 'Expected original workspace, learner, and six principal IDs.');
}

function validateCandidate(receipt: ObjectValue, files: Map<string, string>, root: string, rt: Runtime): void {
  const authPath = artifactPath(receipt.authorization, 'authorizations');
  const auth = parse(files.get(authPath)!, authPath);
  closed(auth, authKeys, authPath);
  validateRequest(auth.request);
  const proposal: InitProposal = { request: auth.request, operation_id: auth.operation_id, workspace_id: auth.target, learner_id: auth.learner_id, principals: auth.principals };
  requireThat(Array.isArray(proposal.principals) && canonical(proposal.principals.map(p => p.role)) === canonical(['learner', 'onboarding-coordinator', 'project-curator', 'peer-engineer', 'team-lead', 'manager']), 'AUTHORITY_INVALID', authPath, 'Initial consent must register the six Phase 6 principals in order.');
  const expected = makeCandidate(proposal, receipt.authorized_at, receipt.transaction_id);
  requireThat(canonical(receipt) === canonical(expected.receipt), 'RECEIPT_INVALID', 'receipt', 'Receipt does not match the approved initialization request.');
  for (const [file, bytes] of expected.files) requireThat(files.get(file) === bytes, 'SNAPSHOT_INVALID', file, 'Snapshot does not match the initialization consent or canonical emission.');
  const records = new Map(bootstrapFiles.map(f => [f, parse(files.get(statePath(f))!, f)]));
  const result = inspectRecords(records, root, rt);
  requireThat(!result.advanced && result.diagnostics.length === 0, 'CANDIDATE_INVALID', root, result.diagnostics.map(d => `${d.path}: ${d.message}`).join('; '));
}
function snapshots(root: string, receipt: ObjectValue, rt = runtime): Map<string, string> {
  const files = new Map<string, string>();
  for (const change of receipt.changes) {
    const bytes = read(root, artifactPath(change.new_snapshot, 'snapshots'), rt);
    requireThat(sha256(bytes) === change.new_digest, 'SNAPSHOT_INVALID', change.path, 'Retained snapshot digest does not match.');
    files.set(change.path, bytes.toString('utf8'));
  }
  validateCandidate(receipt, files, root, rt);
  return files;
}

export function assertNoPending(root: string, rt = runtime): void {
  if (exists(safePath(root, pendingPath, rt), rt)) throw new Failure('RECOVERY_REQUIRED', pendingPath, 'Publication is pending. Run doctor, then explicitly recover it.', 3);
}
function assertCurrent(root: string, receipt: ObjectValue, rt: Runtime, allowAbsent: boolean): void {
  for (const change of receipt.changes) {
    const current = digest(root, change.path, rt);
    requireThat(current === change.new_digest || (allowAbsent && current === null), 'STATE_CONFLICT', change.path, 'Current bytes differ from the retained transaction. Preserve them and inspect the conflict.');
  }
}
function assertOnlyTransactionFiles(root: string, receipt: ObjectValue, rt: Runtime): void {
  const allowed = new Set<string>([pendingPath, ...receipt.changes.map((c: ObjectValue) => c.path), ...receipt.changes.map((c: ObjectValue) => artifactPath(c.new_snapshot, 'snapshots')), receiptPath(receipt.operation_id)]);
  const walk = (dir: string): void => {
    for (const entry of rt.fs.readdirSync(safePath(root, dir, rt), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`;
      safePath(root, relative, rt);
      if (entry.isDirectory()) { walk(relative); continue; }
      requireThat(entry.isFile() && allowed.has(relative), 'STATE_CONFLICT', relative, 'Unexpected file blocks bootstrap publication/recovery. Preserve it for inspection.');
    }
  };
  walk('.apprenticeship');
}

export function verifyBootstrapHistory(root: string, rt = runtime): ObjectValue {
  assertNoPending(root, rt);
  const dir = safePath(root, statePath('operations'), rt);
  requireThat(exists(dir, rt), 'RECEIPT_MISSING', statePath('operations'), 'Bootstrap receipt is missing. Do not reconstruct consent from records.');
  const names = rt.fs.readdirSync(dir);
  requireThat(names.length === 1 && /^OP-.+\.json$/.test(names[0]!), 'RECEIPT_INVALID', statePath('operations'), 'Bootstrap requires exactly one initialization receipt.');
  const receipt = parse(read(root, statePath(`operations/${names[0]}`), rt), names[0]!);
  validateEnvelope(receipt);
  requireThat(names[0] === `${receipt.operation_id}.json`, 'RECEIPT_INVALID', names[0]!, 'Receipt filename must match operation ID.');
  snapshots(root, receipt, rt);
  assertCurrent(root, receipt, rt, false);
  // Notes are allowed after initialization; transaction retention files themselves must remain exact.
  for (const directory of ['snapshots', 'authorizations']) {
    const expected = directory === 'snapshots' ? receipt.changes.map((c: ObjectValue) => artifactPath(c.new_snapshot, 'snapshots').split('/').at(-1)) : [artifactPath(receipt.authorization, 'authorizations').split('/').at(-1)];
    requireThat(canonical(rt.fs.readdirSync(safePath(root, statePath(directory), rt)).sort()) === canonical([...new Set(expected)].sort()), 'RECEIPT_INVALID', statePath(directory), 'Unexpected or missing retained transaction artifacts.');
  }
  return receipt;
}

export function existingInit(root: string, request?: InitRequest, operationId?: string, rt = runtime): ObjectValue | undefined {
  if (!exists(safePath(root, '.apprenticeship', rt), rt)) return undefined;
  return withLock(root, () => {
    assertNoPending(root, rt);
    const inspection = inspectRecords(collect(root, rt), root, rt);
    requireThat(!inspection.advanced && inspection.diagnostics.length === 0, 'EXISTING_STATE', root, 'Existing state cannot be initialized or reset. Inspect it with validate/doctor.');
    const receipt = verifyBootstrapHistory(root, rt);
    const auth = parse(read(root, artifactPath(receipt.authorization, 'authorizations'), rt), 'authorization');
    requireThat(!operationId || operationId === receipt.operation_id, 'OPERATION_CONFLICT', 'operation-id', 'Workspace already has a different initialization operation.');
    requireThat(!request || canonical(request) === canonical(auth.request), 'INPUT_CONFLICT', 'init', 'Existing learner inputs differ. Initialization never overwrites them.');
    return { operation_id: receipt.operation_id, output_record_ids: receipt.output_record_ids };
  }, rt);
}

export function publishInit(root: string, proposal: InitProposal, capability: object, rt = runtime): ObjectValue {
  const binding = approvals.get(capability);
  requireThat(binding?.root === root && binding.proposal === canonical(proposal), 'BINDING_REQUIRED', root, 'A direct controller must bind the reviewed request; declared actor fields are insufficient.');
  approvals.delete(capability);
  requireThat(['darwin', 'linux'].includes(process.platform), 'DURABILITY_UNSUPPORTED', root, 'Publication is supported only on tested macOS/Linux local filesystems.');
  return withLock(root, () => {
    requireThat(!exists(safePath(root, '.apprenticeship', rt), rt), 'STATE_CONFLICT', root, 'Workspace appeared since the proposal; inspect it before retrying.');
    try {
      syncDirectory(root, rt);
      const fd = rt.fs.openSync(safePath(root, '.apprenticeship.lock/owner.json', rt), 'r');
      try { rt.fs.fsyncSync(fd); } finally { rt.fs.closeSync(fd); }
      const probe = safePath(root, '.apprenticeship.lock/link-probe', rt);
      try { rt.fs.linkSync(safePath(root, '.apprenticeship.lock/owner.json', rt), probe); }
      finally { if (exists(probe, rt)) rt.fs.unlinkSync(probe); }
    } catch { throw new Failure('DURABILITY_UNSUPPORTED', root, 'File/directory fsync is unavailable. No state was published; retain a proposal instead.', 3); }
    const { receipt, files } = makeCandidate(proposal, rt.now(), rt.id('TX'));
    validateEnvelope(receipt); validateCandidate(receipt, files, root, rt);
    rt.boundary('validated');
    assertLock(root, rt);
    requireThat(!exists(safePath(root, '.apprenticeship', rt), rt), 'STALE_READ', root, 'Workspace appeared after validation.');
    for (const change of receipt.changes) requireThat(digest(root, change.path, rt) === null, 'STALE_READ', change.path, 'Expected an absent file; initialization refuses to overwrite.');
    for (const change of receipt.changes) {
      assertLock(root, rt);
      durable(root, artifactPath(change.new_snapshot, 'snapshots'), files.get(change.path)!, rt, true);
      rt.boundary(`snapshot:${change.path}`);
    }
    assertLock(root, rt); durable(root, pendingPath, encode({ ...receipt, phase: 'prepared' }), rt, true);
    rt.boundary('prepared');
    complete(root, receipt, files, rt);
    return { operation_id: receipt.operation_id, output_record_ids: receipt.output_record_ids };
  }, rt);
}

function complete(root: string, receipt: ObjectValue, files: Map<string, string>, rt: Runtime): void {
  assertOnlyTransactionFiles(root, receipt, rt);
  assertCurrent(root, receipt, rt, true);
  for (const change of receipt.changes) {
    assertLock(root, rt);
    const old = digest(root, change.path, rt);
    requireThat(old === null || old === change.new_digest, 'STALE_READ', change.path, 'File changed during publication; recovery is required.');
    if (old === null) durable(root, change.path, files.get(change.path)!, rt, true);
    rt.boundary(`published:${change.path}`);
  }
  assertCurrent(root, receipt, rt, false);
  assertLock(root, rt); durable(root, receiptPath(receipt.operation_id), encode(receipt), rt, true);
  rt.boundary('committed');
  assertLock(root, rt); remove(root, pendingPath, rt);
  rt.boundary('finished');
}

export interface RecoveryPlan { action: 'complete' | 'rollback' | 'cleanup'; operation_id: string; paths: string[]; fingerprint: string }
export function planRecovery(root: string, rt = runtime): RecoveryPlan {
  const pending = parse(read(root, pendingPath, rt), pendingPath);
  validateEnvelope(pending, true);
  const { phase: _phase, ...receipt } = pending;
  assertOnlyTransactionFiles(root, receipt, rt);
  assertCurrent(root, receipt, rt, true);
  let action: RecoveryPlan['action'];
  if (exists(safePath(root, receiptPath(receipt.operation_id), rt), rt)) {
    requireThat(canonical(parse(read(root, receiptPath(receipt.operation_id), rt), 'receipt')) === canonical(receipt), 'RECEIPT_INVALID', 'receipt', 'Committed receipt conflicts with pending transaction.');
    snapshots(root, receipt, rt); assertCurrent(root, receipt, rt, false); action = 'cleanup';
  } else {
    try { snapshots(root, receipt, rt); action = 'complete'; }
    catch { action = 'rollback'; }
  }
  return { action, operation_id: receipt.operation_id, paths: receipt.changes.map((c: ObjectValue) => c.path), fingerprint: recoveryFingerprint(root, receipt, rt) };
}
function recoveryFingerprint(root: string, receipt: ObjectValue, rt: Runtime): string {
  const paths = [pendingPath, receiptPath(receipt.operation_id), ...receipt.changes.map((c: ObjectValue) => c.path), ...receipt.changes.map((c: ObjectValue) => artifactPath(c.new_snapshot, 'snapshots'))];
  return sha256(canonical(paths.map(p => [p, digest(root, p, rt)])));
}
export function recover(root: string, approved: RecoveryPlan, rt = runtime): ObjectValue {
  return withLock(root, () => {
    const current = planRecovery(root, rt);
    requireThat(canonical(current) === canonical(approved), 'STALE_READ', pendingPath, 'Recovery inputs changed after review; inspect and approve a fresh plan.');
    const { phase: _phase, ...receipt } = parse(read(root, pendingPath, rt), pendingPath);
    if (current.action === 'complete') complete(root, receipt, snapshots(root, receipt, rt), rt);
    else if (current.action === 'cleanup') { assertLock(root, rt); remove(root, pendingPath, rt); }
    else {
      // The bootstrap old snapshot is entirely absent. Only exact unpublished creations may be removed.
      for (const change of receipt.changes) {
        assertLock(root, rt);
        if (digest(root, change.path, rt) !== null) remove(root, change.path, rt);
        rt.boundary(`rollback:${change.path}`);
      }
      // Keep pending until all canonical creations have been removed. Retained snapshots are private staging.
      for (const change of receipt.changes) {
        assertLock(root, rt);
        const file = artifactPath(change.new_snapshot, 'snapshots');
        if (exists(safePath(root, file, rt), rt)) remove(root, file, rt);
      }
      assertLock(root, rt); remove(root, pendingPath, rt);
      // Empty state directories are deliberately retained; no recursive deletion of unknown content.
      for (const dir of ['authorizations', 'operations', 'snapshots']) {
        const target = safePath(root, statePath(dir), rt);
        if (exists(target, rt) && rt.fs.readdirSync(target).length === 0) { rt.fs.rmdirSync(target); syncDirectory(safePath(root, '.apprenticeship', rt), rt); }
      }
      if (rt.fs.readdirSync(safePath(root, '.apprenticeship', rt)).length === 0) { rt.fs.rmdirSync(safePath(root, '.apprenticeship', rt)); syncDirectory(root, rt); }
    }
    return { operation_id: receipt.operation_id, recovery: current.action, output_record_ids: current.action === 'rollback' ? [] : receipt.output_record_ids };
  }, rt);
}
