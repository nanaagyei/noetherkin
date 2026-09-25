import { canonical, encode, requireThat, sha256, type ObjectValue } from './common.js';
import { parse } from './parsing.js';
import { catalogs, collect } from './validation.js';
import { digest, durable, exists, read, runtime, safePath, statePath, type Runtime } from './storage.js';
import { bindApprovedTransaction, makeTransaction, publishTransaction, type ActorRole, type BoundActor } from './transactions.js';
import { contextDigest, validateRoleOutput, type RoleAdapter } from './adapters.js';

function record(root: string, relative: string, rt: Runtime): ObjectValue {
  return parse(read(root, statePath(relative), rt), statePath(relative));
}
function learner(root: string, rt: Runtime): BoundActor {
  const config = record(root, 'config.yaml', rt);
  const principal = config.principals.find((item: ObjectValue) => item.id === config.learner_principal_id && item.role === 'learner' && item.retired_at === null);
  requireThat(principal, 'AUTHORITY_INVALID', 'learner', 'No active learner principal is registered.');
  return { id: principal.id, role: 'learner' };
}
function actor(root: string, role: ActorRole, rt: Runtime): BoundActor {
  const config = record(root, 'config.yaml', rt);
  const principal = config.principals.find((item: ObjectValue) => item.role === role && item.retired_at === null);
  requireThat(principal, 'AUTHORITY_INVALID', role, `No active ${role} principal is registered.`);
  return { id: principal.id, role };
}
function publish(root: string, by: ActorRole, action: string, target: string, request: ObjectValue, writes: Map<string, string>, outputIds: string[], validate: (files: Map<string, string>) => void, rt: Runtime): ObjectValue {
  const expected = Object.fromEntries([...writes.keys()].map(file => [file, digest(root, file, rt)]));
  const plan = makeTransaction(root, { operation_id: rt.id('OP'), actor: actor(root, by, rt), action, target, request, expected_read_digests: expected, output_record_ids: outputIds, writes, authorization_description: `Bound ${by} authorization for ${action}` }, rt);
  return publishTransaction(root, plan, bindApprovedTransaction(root, plan, true), validate, rt);
}
function artifact(relative: string, bytes: string, description: string): ObjectValue { return { uri: `workspace:/${relative}`, revision: `sha256:${sha256(bytes)}`, description }; }
function records(root: string, prefix: string, rt: Runtime): ObjectValue[] { return [...collect(root, rt)].filter(([file]) => file.startsWith(prefix)).map(([, value]) => value); }
async function invoke(adapter: RoleAdapter, root: string, role: ActorRole, objective: string, context: ObjectValue, keys: string[], rt: Runtime): Promise<{ output: ObjectValue; transcript: string }> {
  const context_digest = contextDigest(context);
  const result = await adapter.invoke({ workspace: root, operation_id: rt.id('OP'), actor: actor(root, role, rt), skill: role === 'team-lead' ? 'team-lead' : 'manager', objective, context, context_digest, output_keys: keys });
  requireThat(result.context_digest === context_digest, 'CONTEXT_CHANGED', role, 'Role result is not bound to the supplied alignment context.');
  validateRoleOutput(result, keys);
  return { output: result.output, transcript: result.transcript };
}
export function listTracks(trackId?: string): ObjectValue {
  const { tracks, projects } = catalogs();
  const selected = trackId ? tracks.filter(track => track.id === trackId) : tracks;
  requireThat(!trackId || selected.length === 1, 'TRACK_NOT_FOUND', trackId ?? '', 'Unknown track ID.');
  return { tracks: selected.map(track => ({ ...track, recommended_projects: Object.fromEntries(Object.entries(track.recommended_projects).map(([stage, ids]) => [stage, (ids as string[]).map(id => {
    const project = projects.find(item => item.id === id)!;
    return { id, name: project.name, status: project.status, difficulty: project.difficulty, onboarding_cost: project.onboarding_cost, feedback_loop: project.feedback_loop, contribution_readiness: project.contribution_readiness, level_fit: { minimum: project.recommended_minimum_level, ideal: project.ideal_level }, prerequisites: project.prerequisites, attachable: project.support?.attachable ?? false, task_packs: project.support?.task_packs ?? [], metadata_gaps: project.metadata_gaps ?? [] };
  })])) })) };
}
export function selectTrack(root: string, trackId: string, validate: (files: Map<string, string>) => void, rt: Runtime = runtime): ObjectValue {
  const track = catalogs().tracks.find(item => item.id === trackId);
  requireThat(track, 'TRACK_NOT_FOUND', trackId, 'Unknown track ID.');
  const current = record(root, 'current-track.yaml', rt);
  const config = record(root, 'config.yaml', rt);
  const definitionDigest = `sha256:${sha256(encode(track))}`;
  if (current.track_id === trackId && current.definition_digest === definitionDigest && config.track_catalog_version === track.catalog_version) return { outcome: 'no-change', track: current };
  const profile = record(root, 'profile.yaml', rt);
  const at = rt.now();
  Object.assign(current, { track_id: trackId, track_catalog_version: track.catalog_version, definition_digest: definitionDigest, selected_at: at, alignment_status: 'pending', adopted_competencies: profile.specialization_competencies, scope_agreement: null, aligned_at: null });
  config.track_catalog_version = track.catalog_version;
  const file = statePath('current-track.yaml'); const configFile = statePath('config.yaml');
  const plan = makeTransaction(root, { operation_id: rt.id('OP'), actor: learner(root, rt), action: 'select-track', target: trackId, request: { track_id: trackId, definition_digest: definitionDigest, track_catalog_version: track.catalog_version }, expected_read_digests: { [file]: digest(root, file, rt), [configFile]: digest(root, configFile, rt) }, output_record_ids: [trackId], writes: new Map([[file, encode(current)], [configFile, encode(config)]]), authorization_description: 'Learner-authorized track selection and catalog pin update' }, rt);
  return { outcome: 'success', ...publishTransaction(root, plan, bindApprovedTransaction(root, plan, true), validate, rt), track: current };
}
export function trackAlignmentProposal(root: string, rt: Runtime = runtime): ObjectValue {
  const current = record(root, 'current-track.yaml', rt);
  requireThat(current.track_id, 'TRACK_REQUIRED', 'current-track.yaml', 'Select a track before alignment.');
  if (current.alignment_status === 'aligned') return { outcome: 'no-change', track: current };
  const track = catalogs().tracks.find(item => item.id === current.track_id)!;
  return { outcome: 'proposal', track_id: track.id, required_competencies: track.required_competencies, current_competencies: record(root, 'profile.yaml', rt).specialization_competencies, required_steps: ['Learner and team lead agree the new scope.', 'Team lead publishes a fresh longitudinal assessment.', 'Manager publishes a performance review pinned to that scope.', 'A supported publisher atomically aligns profile.yaml and current-track.yaml.'] };
}

export async function alignTrack(root: string, confirmed: boolean, adapter: RoleAdapter, validate: (files: Map<string, string>) => void, rt: Runtime = runtime): Promise<ObjectValue> {
  requireThat(confirmed, 'CONSENT_REQUIRED', 'track align', 'Learner confirmation is required to align a changed evaluation scope.');
  const current = record(root, 'current-track.yaml', rt);
  requireThat(current.track_id, 'TRACK_REQUIRED', 'current-track.yaml', 'Select a track before alignment.');
  if (current.alignment_status === 'aligned') return { outcome: 'no-change', track: current };
  const profile = record(root, 'profile.yaml', rt);
  requireThat(profile.onboarding === 'complete', 'PREREQUISITE_MISSING', 'profile.yaml', 'Complete initial onboarding before aligning a switched track.');
  const track = catalogs().tracks.find(item => item.id === current.track_id);
  requireThat(track && current.definition_digest === `sha256:${sha256(encode(track))}`, 'TRACK_BINDING_INVALID', 'current-track.yaml', 'The selected track definition is unavailable or changed.');
  const core = [...catalogs().coreCompetencyIds];
  const scope = [...core, ...track.required_competencies];
  const selectedAt = Date.parse(current.selected_at);
  const scopeText = `# Evaluation scope agreement\n\nLearner: ${profile.learner_id}\nTeam lead: ${actor(root, 'team-lead', rt).id}\nTrack: ${track.id} (${track.catalog_version})\nAgreed scope: ${scope.join(', ')}.\nSelected at: ${current.selected_at}\n`;
  const scopeRelative = `apprenticeship-artifacts/scope-agreements/${sha256(scopeText)}.md`;
  const exactScope = (assessment: ObjectValue): boolean => assessment.kind === 'technical' && assessment.scope === 'longitudinal' && assessment.learner_id === profile.learner_id && Date.parse(assessment.created_at) >= selectedAt && canonical(assessment.findings.map((item: ObjectValue) => item.competency_id).sort()) === canonical([...scope].sort());
  let assessment = records(root, 'assessments/', rt).filter(exactScope).at(-1);
  let assessmentPublication: ObjectValue | null = null;
  if (!assessment) {
    const evidence = records(root, 'evidence/', rt);
    const result = await invoke(adapter, root, 'team-lead', 'Assess the exact proposed track scope longitudinally. Return one finding per supplied competency, cite only supplied evidence IDs, and use unassessed when evidence is absent.', { track_id: track.id, prior_specialization: profile.specialization_competencies, proposed_scope: scope, evidence }, ['findings'], rt);
    requireThat(Array.isArray(result.output.findings), 'ADAPTER_INVALID', 'track-alignment', 'Team lead must return findings.');
    const findings = result.output.findings as ObjectValue[];
    requireThat(canonical(findings.map(item => item.competency_id).sort()) === canonical([...scope].sort()) && new Set(findings.map(item => item.competency_id)).size === scope.length, 'ADAPTER_INVALID', 'track-alignment', 'Alignment assessment must cover the exact proposed scope once.');
    const evidenceIds = new Set(evidence.map(item => item.id));
    for (const finding of findings) {
      requireThat(['unassessed','developing','demonstrated','contested'].includes(finding.status) && Array.isArray(finding.evidence_ids) && typeof finding.rationale === 'string' && finding.rationale.length > 0, 'ADAPTER_INVALID', 'track-alignment', 'Each alignment finding needs a valid status, evidence list, and rationale.');
      requireThat(finding.evidence_ids.every((id: string) => evidenceIds.has(id)), 'EVIDENCE_MISSING', finding.competency_id, 'Alignment findings may cite only existing evidence.');
      if (finding.status === 'unassessed') requireThat(finding.demonstrated_level === null && finding.evidence_ids.length === 0, 'ADAPTER_INVALID', finding.competency_id, 'Unassessed findings cannot claim a level or evidence.');
    }
    if (!exists(safePath(root, scopeRelative, rt), rt)) durable(root, scopeRelative, scopeText, rt, true);
    const id = rt.id('ASM'); const at = rt.now();
    assessment = { schema_version:'3.0', data_class:'live', id, created_at:at, author:actor(root,'team-lead',rt), kind:'technical', learner_id:profile.learner_id, project_id:null, evidence_ids:[...new Set(findings.flatMap(item => item.evidence_ids))], findings, supersedes:null, scope:'longitudinal', task_id:null, design:null };
    const cache = record(root, 'competencies.yaml', rt);
    const byCompetency = new Map(cache.entries.map((item: ObjectValue) => [item.competency_id, item]));
    for (const finding of findings) byCompetency.set(finding.competency_id, { competency_id:finding.competency_id, status:finding.status, demonstrated_level:finding.demonstrated_level, evidence_ids:finding.evidence_ids, assessment_ids:[id] });
    cache.generated_at = at; cache.source_assessment_ids = [...new Set([...cache.source_assessment_ids, id])]; cache.entries = [...byCompetency.values()];
    const transcriptRelative = `apprenticeship-artifacts/role-transcripts/${sha256(result.transcript)}.json`;
    if (!exists(safePath(root, transcriptRelative, rt), rt)) durable(root, transcriptRelative, result.transcript, rt, true);
    assessmentPublication = publish(root, 'team-lead', 'assess-track-alignment', profile.learner_id, { track_id:track.id, evaluation_scope:scope, transcript:artifact(transcriptRelative, result.transcript, 'Bound team-lead track-alignment transcript') }, new Map([[statePath(`assessments/${id}.yaml`),encode(assessment)],[statePath('competencies.yaml'),encode(cache)],[scopeRelative,scopeText]]), [id], validate, rt);
  }
  const scopeArtifact = artifact(scopeRelative, scopeText, 'Learner and team-lead track scope agreement');
  let review = records(root, 'reviews/performance/', rt).filter(item => item.subject_id === profile.learner_id && item.assessment_ids.includes(assessment.id) && Date.parse(item.created_at) >= selectedAt).at(-1);
  let reviewPublication: ObjectValue | null = null;
  if (!review) {
    const result = await invoke(adapter, root, 'manager', 'Review whether the newly assessed track scope is coherent and ready to govern future evaluations. Return continue only when the exact scope can be adopted; otherwise return adjust-scope or insufficient-evidence.', { track_id:track.id, assessment, evaluation_scope:scope }, ['outcome','findings'], rt);
    requireThat(['continue','adjust-scope','insufficient-evidence'].includes(result.output.outcome) && Array.isArray(result.output.findings) && result.output.findings.length > 0, 'ADAPTER_INVALID', 'track-alignment-review', 'Manager must return a valid alignment outcome and findings.');
    const id = rt.id('REV'); const at = rt.now();
    review = { schema_version:'3.0', data_class:'live', id, created_at:at, author:actor(root,'manager',rt), kind:'performance', subject_id:profile.learner_id, evidence_ids:assessment.evidence_ids, assessment_ids:[assessment.id], period:{start:current.selected_at,end:at}, findings:result.output.findings, outcome:result.output.outcome, supersedes:null, evaluation_scope:{core_competencies:core,specialization_competencies:track.required_competencies,competency_catalog_version:'3.0',level_catalog_version:'2.0',scope_agreement:scopeArtifact} };
    const transcriptRelative = `apprenticeship-artifacts/role-transcripts/${sha256(result.transcript)}.json`;
    if (!exists(safePath(root, transcriptRelative, rt), rt)) durable(root, transcriptRelative, result.transcript, rt, true);
    reviewPublication = publish(root, 'manager', 'review-track-alignment', profile.learner_id, { track_id:track.id, assessment_id:assessment.id, transcript:artifact(transcriptRelative, result.transcript, 'Bound manager track-alignment transcript') }, new Map([[statePath(`reviews/performance/${id}.yaml`),encode(review)]]), [id], validate, rt);
  }
  if (review.outcome !== 'continue') return { outcome:'incomplete', alignment_status:'pending', assessment_id:assessment.id, review_id:review.id, review_outcome:review.outcome, findings:review.findings, assessment_publication:assessmentPublication, review_publication:reviewPublication };
  profile.specialization_competencies = track.required_competencies;
  Object.assign(current, { alignment_status:'aligned', adopted_competencies:track.required_competencies, scope_agreement:scopeArtifact, aligned_at:rt.now() });
  const finalization = publish(root, 'learner', 'align-track', track.id, { assessment_id:assessment.id, review_id:review.id, scope_agreement:scopeArtifact }, new Map([[statePath('profile.yaml'),encode(profile)],[statePath('current-track.yaml'),encode(current)]]), [track.id], validate, rt);
  return { outcome:'success', assessment_id:assessment.id, review_id:review.id, assessment_publication:assessmentPublication, review_publication:reviewPublication, finalization, track:current };
}

/**
 * What a learner on a track can run end to end in the CLI today: forges aligned to the track, then the track's
 * recommended projects that carry a curated task pack. Derived from catalog data only; there is no per-track or
 * per-project branch. An empty list means the track relies on the portable task-assignment skill.
 */
export function runnablePaths(trackId: string): ObjectValue[] {
  const { tracks, projects, forges } = catalogs();
  const track = tracks.find(item => item.id === trackId);
  requireThat(track, 'TRACK_NOT_FOUND', trackId, 'Unknown track ID.');
  const aligned = forges.filter(forge => forge.status !== 'deprecated' && forge.track_alignment.includes(trackId))
    .map(forge => ({ kind: 'forge', id: forge.id, name: forge.name, status: forge.status, stage: null, languages: forge.primary_languages, minimum_level: forge.recommended_minimum_level, task_packs: forge.task_packs }));
  const curated: ObjectValue[] = [];
  for (const stage of ['early', 'intermediate', 'advanced']) for (const id of track.recommended_projects[stage] as string[]) {
    const project = projects.find(item => item.id === id)!;
    if (project.support?.attachable && project.support?.task_packs?.length && !curated.some(item => item.id === id)) curated.push({ kind: 'project', id, name: project.name, status: project.status, stage, languages: project.primary_languages, minimum_level: project.recommended_minimum_level, task_packs: project.support.task_packs });
  }
  return [...aligned, ...curated];
}
