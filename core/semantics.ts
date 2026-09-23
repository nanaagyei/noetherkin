import { spawnSync } from 'node:child_process';
import { canonical, diagnostic, requireThat, sha256, type Diagnostic, type ObjectValue } from './common.js';
import { parse } from './parsing.js';
import { exists, read, runtime, safePath, statePath, type Runtime } from './storage.js';
import { transactionArtifactPath, validateTransactionEnvelope } from './transactions.js';

const roles = ['learner', 'onboarding-coordinator', 'project-curator', 'peer-engineer', 'team-lead', 'manager'];
const allowed: Record<string, string[]> = {
  absent: ['backlog'], backlog: ['assigned', 'cancelled'], assigned: ['investigating', 'cancelled'],
  investigating: ['designing', 'implementing', 'cancelled'], designing: ['implementing', 'investigating', 'cancelled'],
  implementing: ['testing', 'investigating', 'cancelled'], testing: ['code-review', 'validating', 'implementing', 'cancelled'],
  'code-review': ['validating', 'implementing', 'investigating', 'cancelled'], validating: ['task-review', 'implementing', 'investigating', 'cancelled'],
  'task-review': ['evidence-recording', 'implementing', 'investigating', 'cancelled'], 'evidence-recording': ['completed', 'task-review', 'cancelled'], completed: [], cancelled: []
};
const roleForEdge = (from: string, to: string): string[] => {
  if (from === 'absent' || from === 'backlog') return ['team-lead'];
  if (['validating', 'task-review', 'evidence-recording'].includes(from) || to === 'validating') return ['team-lead'];
  if (from === 'designing' && to === 'implementing') return ['team-lead'];
  if (from === 'code-review' && ['implementing', 'investigating'].includes(to)) return ['peer-engineer', 'team-lead'];
  return ['learner', 'team-lead'];
};
const frozen = ['id', 'created_at', 'author', 'assigned_by', 'title', 'project_id', 'type', 'problem', 'context', 'impact', 'acceptance_criteria', 'constraints', 'primary_competencies', 'secondary_competencies', 'recommended_level', 'scope', 'difficulty', 'investigation_areas', 'investigation_paths', 'testing_expectations', 'documentation_requirements', 'design_required', 'code_review_required'];

export function safeInvestigationGlob(glob: string): boolean {
  return typeof glob === 'string' && glob.length > 0 && !glob.startsWith('/') && !glob.startsWith('~') && !/[\\\0]/.test(glob) && glob.split('/').every(part => part !== '..' && part !== '');
}

function verifyArtifact(root: string, value: ObjectValue, file: string, rt: Runtime): void {
  requireThat(value && /^workspace:\/[^/]/.test(value.uri) && /^sha256:[a-f0-9]{64}$/.test(value.revision), 'ARTIFACT_INVALID', file, 'Artifact must use a content-addressed workspace reference.');
  const relative = value.uri.slice('workspace:/'.length);
  requireThat(exists(safePath(root, relative, rt), rt), 'ARTIFACT_MISSING', file, `Artifact ${relative} is missing.`);
  requireThat(`sha256:${sha256(read(root, relative, rt))}` === value.revision, 'ARTIFACT_CHANGED', file, `Artifact ${relative} no longer matches its recorded revision.`);
}

function verifyReceipts(root: string, config: ObjectValue, rt: Runtime): void {
  const actionRoles: Record<string, string> = { init: 'onboarding-coordinator', 'migrate-protocol': 'learner', 'select-track': 'learner', 'assess-track-alignment': 'team-lead', 'review-track-alignment': 'manager', 'align-track': 'learner', 'establish-baseline': 'team-lead', 'complete-onboarding': 'onboarding-coordinator', 'select-project': 'project-curator', 'initialize-codebase-map': 'learner', 'assign-task': 'team-lead', 'begin-task': 'learner', 'review-design': 'team-lead', 'open-implementation-gate': 'team-lead', 'submit-change': 'learner', 'record-test-run': 'learner', 'record-help': 'peer-engineer', 'code-review': 'peer-engineer', 'task-review-rework': 'team-lead', 'complete-task': 'team-lead', 'performance-review': 'manager' };
  const directory = safePath(root, statePath('operations'), rt);
  if (!exists(directory, rt)) return;
  const history = new Map<string, ObjectValue[]>();
  for (const name of rt.fs.readdirSync(directory).filter(item => item.endsWith('.json')).sort()) {
    const file = statePath(`operations/${name}`); const receipt = parse(read(root, file, rt), file);
    validateTransactionEnvelope(receipt);
    requireThat(name === `${receipt.operation_id}.json`, 'RECEIPT_INVALID', file, 'Receipt filename must match operation ID.');
    const authorization = transactionArtifactPath(receipt.authorization, 'authorizations'); const authorizationBytes = read(root, authorization, rt);
    requireThat(sha256(authorizationBytes) === receipt.authorization.revision.slice(7), 'AUTHORIZATION_INVALID', authorization, 'Authorization artifact digest does not match.');
    const grant = config.principals.find((item: ObjectValue) => item.id === receipt.actor.id && item.role === receipt.actor.role);
    requireThat(grant && grant.granted_at <= receipt.authorized_at && (grant.retired_at === null || receipt.authorized_at < grant.retired_at), 'AUTHORITY_INVALID', file, 'Receipt actor lacked an active matching grant at publication.');
    const authorized = parse(authorizationBytes, authorization);
    requireThat(canonical(authorized.actor) === canonical(receipt.actor) && authorized.operation_id === receipt.operation_id && authorized.authorized_at === receipt.authorized_at, 'AUTHORIZATION_INVALID', authorization, 'Authorization artifact is not bound to the receipt.');
    requireThat(actionRoles[authorized.action] === receipt.actor.role, 'AUTHORITY_INVALID', file, `${receipt.actor.role} cannot publish ${authorized.action}.`);
    const inspectArtifacts = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if (!Array.isArray(value) && typeof (value as ObjectValue).uri === 'string' && typeof (value as ObjectValue).revision === 'string' && typeof (value as ObjectValue).description === 'string') verifyArtifact(root, value as ObjectValue, authorization, rt);
      for (const child of Object.values(value)) inspectArtifacts(child);
    };
    inspectArtifacts(authorized.request);
    for (const change of receipt.changes) {
      const chain = history.get(change.path) ?? []; chain.push(change); history.set(change.path, chain);
      for (const snapshot of [change.old_snapshot, change.new_snapshot].filter(Boolean)) {
        const snapshotPath = transactionArtifactPath(snapshot, 'snapshots');
        requireThat(sha256(read(root, snapshotPath, rt)) === snapshot.revision.slice(7), 'SNAPSHOT_INVALID', snapshotPath, 'Retained snapshot digest does not match.');
      }
    }
  }
  for (const [file, changes] of history) {
    const oldDigests = new Set(changes.map(item => item.old_digest).filter(Boolean));
    const tips = changes.filter(item => !oldDigests.has(item.new_digest));
    requireThat(tips.length === 1, 'RECEIPT_INVALID', file, 'Transaction history must have one current tip.');
    if (file !== statePath('knowledge/codebase-map.md')) requireThat(sha256(read(root, file, rt)) === tips[0]!.new_digest, 'STATE_CHANGED', file, 'Current canonical bytes do not match the latest committed transaction snapshot.');
  }
}

function originalTask(root: string, id: string, rt: Runtime): ObjectValue | undefined {
  const directory = safePath(root, statePath('operations'), rt); if (!exists(directory, rt)) return undefined;
  const taskPath = statePath(`work/${id}.yaml`);
  for (const name of rt.fs.readdirSync(directory).filter(item => item.endsWith('.json')).sort()) {
    const receipt = parse(read(root, statePath(`operations/${name}`), rt), name);
    const change = receipt.changes.find((item: ObjectValue) => item.path === taskPath && item.old_digest === null);
    if (change) return parse(read(root, transactionArtifactPath(change.new_snapshot, 'snapshots'), rt), change.new_snapshot.uri);
  }
  return undefined;
}

export function inspectSimulationSemantics(records: Map<string, ObjectValue>, root: string, rt: Runtime = runtime): Diagnostic[] {
  const diagnostics: Diagnostic[] = []; const check = (fn: () => void) => { try { fn(); } catch (error) { diagnostics.push(diagnostic(error)); } };
  const config = records.get('config.yaml'); const profile = records.get('profile.yaml'); const selection = records.get('current-project.yaml'); const trackSelection = records.get('current-track.yaml');
  if (!config || !profile || !selection) return diagnostics;
  const byId = new Map<string, ObjectValue>(); for (const value of records.values()) if (value.id) byId.set(value.id, value);
  check(() => requireThat(canonical(config.principals.map((item: ObjectValue) => item.role)) === canonical(roles), 'REGISTRY_INVALID', 'config.yaml', 'Phase 6 requires exactly the six reviewed role grants.'));
  check(() => verifyReceipts(root, config, rt));
  const baseline = profile.baseline_assessment_id ? byId.get(profile.baseline_assessment_id) : undefined;
  if (profile.onboarding === 'complete') check(() => {
    requireThat(baseline?.kind === 'baseline' && baseline.author.role === 'team-lead' && baseline.scope === 'longitudinal', 'ONBOARDING_INVALID', 'profile.yaml', 'Completed onboarding requires a team-lead longitudinal baseline.');
    requireThat(baseline.findings.length > 0 && baseline.findings.every((item: ObjectValue) => item.status === 'unassessed' && item.evidence_ids.length === 0), 'BASELINE_INVALID', `assessments/${baseline.id}.yaml`, 'The pre-task baseline must honestly remain all-unassessed.');
    requireThat(exists(safePath(root, statePath('knowledge/evaluation-scope.md'), rt), rt), 'SCOPE_MISSING', 'knowledge/evaluation-scope.md', 'The agreed evaluation scope is missing.');
  });
  if (selection.project_id) check(() => {
    const project = byId.get(selection.project_id);
    requireThat(profile.onboarding === 'complete' && project?.data_class === 'live' && project.status !== 'deprecated' && project.support?.attachable, 'PROJECT_BINDING_INVALID', 'current-project.yaml', 'Selection must bind an attachable live catalog project after onboarding.');
    requireThat(/^[a-f0-9]{40}$/.test(selection.source_revision), 'PROJECT_BINDING_INVALID', 'current-project.yaml', 'Selection must retain a full commit SHA.');
    const source = safePath(root, selection.source_path, rt); const head = spawnSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
    requireThat(head.status === 0 && head.stdout.trim() === selection.source_revision, 'SOURCE_REVISION_CHANGED', selection.source_path, 'Selected checkout moved away from its immutable base commit.');
  });
  for (const [file, value] of records) check(() => {
    if (file.startsWith('assessments/')) requireThat(value.author.role === 'team-lead', 'AUTHORITY_INVALID', file, 'Assessments require team-lead authorship.');
    if (file.startsWith('evidence/')) requireThat(value.verification.status === 'verified' ? value.author.role === 'team-lead' : value.author.role === 'peer-engineer', 'AUTHORITY_INVALID', file, 'Verified evidence requires team lead; provisional evidence requires peer engineer.');
    if (file.startsWith('reviews/code/')) requireThat(value.author.role === 'peer-engineer', 'AUTHORITY_INVALID', file, 'Code review requires peer-engineer authorship.');
    if (file.startsWith('reviews/task/')) requireThat(value.author.role === 'team-lead', 'AUTHORITY_INVALID', file, 'Task review requires team-lead authorship.');
    if (file.startsWith('reviews/performance/')) requireThat(value.author.role === 'manager' && !String(value.outcome).includes('promotion'), 'AUTHORITY_INVALID', file, 'One-task performance review requires manager authorship and cannot promote.');
    if (file.startsWith('reviews/promotion/') && trackSelection?.alignment_status === 'pending') requireThat(Date.parse(value.created_at) < Date.parse(trackSelection.selected_at), 'TRACK_ALIGNMENT_PENDING', file, 'A track scope change blocks new promotion decisions until alignment completes.');
    if (!file.startsWith('work/')) return;
    requireThat(value.author.role === 'team-lead' && value.assigned_by.role === 'team-lead', 'AUTHORITY_INVALID', file, 'Task creation and assignment require the team lead.');
    // ACP-016 FR-50: investigation globs are source-relative and may not climb out of the source root.
    for (const glob of value.investigation_paths ?? []) requireThat(safeInvestigationGlob(glob), 'UNSAFE_PATH', file, `Investigation path ${JSON.stringify(glob)} must be relative to the source root without traversal.`);
    const original = originalTask(root, value.id, rt); if (original) for (const key of frozen) requireThat(canonical(value[key]) === canonical(original[key]), 'TASK_MUTATED', file, `Frozen task field ${key} changed after assignment.`);
    let previous = 'absent'; let previousAt = 0;
    for (const item of value.transitions) {
      requireThat(item.from === previous && allowed[item.from]?.includes(item.to), 'TRANSITION_INVALID', file, `Illegal task transition ${item.from} -> ${item.to}.`);
      requireThat(roleForEdge(item.from, item.to).includes(item.actor.role), 'AUTHORITY_INVALID', file, `${item.actor.role} cannot publish ${item.from} -> ${item.to}.`);
      requireThat(Date.parse(item.at) >= previousAt, 'TRANSITION_INVALID', file, 'Task transition timestamps must not decrease.');
      previous = item.to; previousAt = Date.parse(item.at);
    }
    requireThat(previous === value.status, 'TRANSITION_INVALID', file, 'Task status must equal the final transition.');
    for (const event of value.assistance_history) {
      requireThat(event.recorder.role === 'peer-engineer' && event.provider.kind === 'registered' && event.provider.principal_id === event.recorder.id, 'ASSISTANCE_INVALID', file, 'Phase 6 peer help must be attributed to its bound registered peer.');
      if (event.artifact) verifyArtifact(root, event.artifact, file, rt);
    }
    const implementing = value.transitions.some((item: ObjectValue) => item.to === 'implementing');
    if (implementing && value.design_required) {
      const assessment = byId.get(value.design_assessment_id);
      requireThat(assessment?.kind === 'technical' && assessment.design?.decision === 'approve' && canonical(assessment.design.artifact) === canonical(value.design_artifact), 'DESIGN_GATE_INVALID', file, 'Implementation requires an exact team-lead design approval.');
      verifyArtifact(root, value.design_artifact, file, rt);
    }
    if (value.work_artifact) verifyArtifact(root, value.work_artifact, file, rt);
    if (value.status === 'completed') {
      requireThat(value.validation.length === value.acceptance_criteria.length && value.validation.every((item: ObjectValue) => item.result === 'pass' && item.work_revision === value.work_artifact.revision), 'COMPLETION_INVALID', file, 'Every frozen criterion needs a passing current-revision validation.');
      for (const validation of value.validation) verifyArtifact(root, validation.artifact, file, rt);
      const completionEvidence = value.completion_evidence_ids.map((id: string) => byId.get(id));
      requireThat(completionEvidence.length > 0 && completionEvidence.every((item: ObjectValue) => item?.task_id === value.id && item.verification.status === 'verified'), 'COMPLETION_INVALID', file, 'Completion requires verified evidence for this task.');
      const taskReviews = [...records.entries()].filter(([name, item]) => name.startsWith('reviews/task/') && item.subject_id === value.id && item.outcome === 'accepted' && canonical(item.change) === canonical(value.work_artifact));
      const codeReviews = [...records.entries()].filter(([name, item]) => name.startsWith('reviews/code/') && item.subject_id === value.id && item.outcome === 'approve' && canonical(item.change) === canonical(value.work_artifact));
      requireThat(taskReviews.length > 0 && (!value.code_review_required || codeReviews.length > 0), 'COMPLETION_INVALID', file, 'Completion requires current accepted task and code reviews.');
    }
  });
  return diagnostics;
}
