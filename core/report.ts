import { diagnostic, type Diagnostic, type ObjectValue } from './common.js';
import { assertNoPending } from './bootstrap.js';
import { runtime, type Runtime } from './storage.js';
import { catalogs, collect, inspectRecords } from './validation.js';
import { inspectSimulationSemantics } from './semantics.js';

/**
 * A shareable progress report (issue #16): a read-only view derived from canonical records and the competency cache,
 * like `map status`. It takes no lock and writes nothing into the workspace, never reads the ACP-014 advisory view
 * (FR-38: it is not evidence), and carries no score or percentage (FR-40). The honesty rules follow the
 * resume-evidence contract: every non-learner role is simulated, forge work is learner-authored software built in a
 * simulated process, stale records are shown as stale, and nothing claims users, production or outside validation.
 */

export const reportVersion = 1;
export const findings = ['demonstrated', 'developing', 'contested', 'unassessed'] as const;

export interface Actor { role: string; simulated: boolean }
export interface ReportEvidence {
  id: string; competency_id: string; task_id: string | null; project_id: string | null; observation: string; observed_at: string | null;
  artifacts: { uri: string; revision: string | null; description: string }[]; highest_assistance: number | null; independence: string; direction: string;
  target_level: string; strength: string; verification: string; recorded_by: Actor; stale: boolean;
}
export interface ReportCompetency { competency_id: string; name: string; finding: typeof findings[number]; demonstrated_level: string | null; evidence_ids: string[]; assessment_ids: string[]; stale: boolean }
export interface ReportReview { id: string; kind: string; outcome: string | null; created_at: string; author: Actor; findings: string[]; stale: boolean }
export interface ReportTask { id: string; title: string; project_id: string; project_kind: 'forge' | 'upstream'; assigned_at: string; completed_at: string | null; highest_assistance: number | null; evidence_ids: string[]; reviews: ReportReview[]; stale: boolean }
export interface TimelineEntry { at: string; kind: 'transition' | 'review'; subject_id: string; description: string; actor: Actor }
export interface Report {
  report_version: number; generated_at: string; include_drafts: boolean;
  workspace: { workspace_id: string | null; data_class: string; fixture: boolean; mode: string | null; validation: { valid: boolean; problems: Diagnostic[] } };
  identity: { display_name: string | null; track_id: string | null; track_alignment: string | null; project_id: string | null; project_kind: 'forge' | 'upstream' | null; effective_level: string | null; last_awarded_level: string | null; standing: string | null };
  competencies: Record<typeof findings[number], ReportCompetency[]>;
  evidence: ReportEvidence[];
  tasks: ReportTask[];
  timeline: TimelineEntry[];
  limits: string[];
}

const actor = (author: ObjectValue | undefined): Actor => ({ role: String(author?.role ?? 'unknown'), simulated: author?.role !== 'learner' });
const maxLevel = (levels: unknown[]): number | null => { const known = levels.filter((level): level is number => typeof level === 'number'); return known.length ? Math.max(...known) : null; };
const byTime = <T extends { at: string }>(a: T, b: T): number => a.at.localeCompare(b.at);

export function buildReport(root: string, options: { includeDrafts?: boolean } = {}, rt: Runtime = runtime): Report {
  // A pending publication may leave records half-written; the learner recovers it first, exactly as status requires.
  assertNoPending(root, rt);
  const records = collect(root, rt);
  const inspection = inspectRecords(records, root, rt);
  const problems = [...inspection.diagnostics];
  if (inspection.advanced && problems.length === 0) { try { problems.push(...inspectSimulationSemantics(records, root, rt)); } catch (error) { problems.push(diagnostic(error)); } }

  const config = records.get('config.yaml') ?? {};
  const profile = records.get('profile.yaml') ?? {};
  const selection = records.get('current-project.yaml') ?? {};
  const track = records.get('current-track.yaml') ?? {};
  const cache = records.get('competencies.yaml') ?? {};
  const stale = new Set<string>(cache.stale_record_ids ?? []);
  const group = (prefix: string): ObjectValue[] => [...records].filter(([file]) => file.startsWith(prefix)).map(([, value]) => value);
  const evidenceRecords = group('evidence/');
  const tasks = group('work/');
  const reviews = group('reviews/');
  const names = new Map<string, string>(catalogs().competencies.map(item => [item.id, item.name]));
  const forgeIds = new Set<string>([...catalogs().forges.map(forge => forge.id), ...group('forge/').map(forge => forge.id)]);
  const kind = (projectId: unknown): 'forge' | 'upstream' => forgeIds.has(String(projectId)) ? 'forge' : 'upstream';

  // Drafts are evidence not (or no longer) verified. By default the report shows verified evidence only.
  const shown = evidenceRecords.filter(item => options.includeDrafts || item.verification?.status === 'verified');
  const evidence: ReportEvidence[] = shown.map(item => ({
    id: item.id, competency_id: item.competency_id, task_id: item.task_id ?? null, project_id: item.project_id ?? null,
    observation: item.fact?.observation ?? '', observed_at: item.fact?.observed_at ?? null,
    artifacts: (item.fact?.artifacts ?? []).map((artifact: ObjectValue) => ({ uri: artifact.uri, revision: artifact.revision ?? null, description: artifact.description })),
    highest_assistance: item.assistance?.known ? item.assistance.highest_level ?? null : null,
    independence: item.interpretation?.independence ?? 'unknown', direction: item.interpretation?.direction ?? 'neutral', target_level: item.interpretation?.target_level ?? '',
    strength: item.interpretation?.strength ?? '', verification: item.verification?.status ?? 'unverified', recorded_by: actor(item.author), stale: stale.has(item.id)
  })).sort((a, b) => a.id.localeCompare(b.id));

  const competencies = Object.fromEntries(findings.map(finding => [finding, [] as ReportCompetency[]])) as Report['competencies'];
  for (const entry of cache.entries ?? []) {
    const finding = findings.includes(entry.status) ? entry.status as typeof findings[number] : 'unassessed';
    competencies[finding].push({ competency_id: entry.competency_id, name: names.get(entry.competency_id) ?? entry.competency_id, finding, demonstrated_level: entry.demonstrated_level ?? null, evidence_ids: entry.evidence_ids ?? [], assessment_ids: entry.assessment_ids ?? [], stale: [...(entry.evidence_ids ?? []), ...(entry.assessment_ids ?? [])].some((id: string) => stale.has(id)) });
  }
  for (const finding of findings) competencies[finding].sort((a, b) => a.competency_id.localeCompare(b.competency_id));

  const reviewOf = (review: ObjectValue): ReportReview => ({ id: review.id, kind: review.kind, outcome: review.outcome ?? null, created_at: review.created_at, author: actor(review.author), findings: review.findings ?? [], stale: stale.has(review.id) });
  const reportTasks: ReportTask[] = tasks.filter(task => task.status === 'completed').map(task => {
    const transitions: ObjectValue[] = task.transitions ?? [];
    return {
      id: task.id, title: task.title, project_id: task.project_id, project_kind: kind(task.project_id), assigned_at: task.created_at,
      completed_at: transitions.find(item => item.to === 'completed')?.at ?? null,
      highest_assistance: maxLevel((task.assistance_history ?? []).map((item: ObjectValue) => item.level)),
      evidence_ids: task.completion_evidence_ids ?? [],
      reviews: reviews.filter(review => review.subject_id === task.id).map(reviewOf).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      stale: stale.has(task.id)
    };
  }).sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));

  const timeline: TimelineEntry[] = [
    ...tasks.flatMap(task => (task.transitions ?? []).map((item: ObjectValue) => ({ at: item.at, kind: 'transition' as const, subject_id: task.id, description: `${task.title}: ${item.from} to ${item.to}`, actor: actor(item.actor) }))),
    ...reviews.map(review => ({ at: review.created_at, kind: 'review' as const, subject_id: review.subject_id ?? review.id, description: `${review.kind} review: ${review.outcome}`, actor: actor(review.author) }))
  ].sort(byTime);

  const fixture = config.data_class === 'fixture';
  const projectKind = selection.project_id ? (selection.kind === 'forge' ? 'forge' : kind(selection.project_id)) : null;
  const limits = [
    'Every role other than the learner (peer engineer, team lead, manager, promotion reviewer and the others) is simulated. Reviews and verification by those roles are judgments made inside a simulated engineering process, not by a real employer, team or maintainer.',
    'Work on a forge project is learner-authored software built from a first-party specification inside a simulated process. It has no users, production deployment, release or upstream acceptance unless a record here says so.',
    'This report is derived from the workspace records for sharing. It is not a credential, is not signed, and is not canonical evidence.',
    'The advisory attention view is excluded: it is derived, not evidence, and gates nothing (FR-38).',
    options.includeDrafts ? 'Unverified and refuted evidence is included and labeled; only verified evidence supports a finding.' : 'Only verified evidence is shown. Unverified and refuted evidence is omitted.'
  ];
  if (fixture) limits.unshift('FIXTURE DATA: this workspace is a fixture. The learner, work and reviews shown did not occur.');
  if (stale.size) limits.push(`${stale.size} record(s) are stale and are marked stale where they appear. A stale record cannot support a new decision.`);
  if (cache.standing === 'unresolved') limits.push('Standing is unresolved: the last awarded level is historical and is not shown as currently demonstrated.');
  if (problems.length) limits.push(`\`noetherkin validate\` reports ${problems.length} problem(s) with this workspace, listed below. Records are shown as found and have not been verified as a whole.`);
  if (config.mode && config.mode !== 'active') limits.push(`The workspace is ${config.mode}.`);

  return {
    report_version: reportVersion, generated_at: rt.now(), include_drafts: Boolean(options.includeDrafts),
    workspace: { workspace_id: config.workspace_id ?? null, data_class: config.data_class ?? 'unknown', fixture, mode: config.mode ?? null, validation: { valid: problems.length === 0, problems } },
    identity: {
      display_name: profile.display_name ?? null, track_id: track.track_id ?? null, track_alignment: track.alignment_status ?? null,
      project_id: selection.project_id ?? null, project_kind: projectKind,
      effective_level: cache.effective_level ?? null, last_awarded_level: cache.last_awarded_level ?? null, standing: cache.standing ?? null
    },
    competencies, evidence, tasks: reportTasks, timeline, limits
  };
}
