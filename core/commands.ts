import { diagnostic, type ObjectValue, type Result } from './common.js';
import { assertNoPending, pendingPath, planRecovery, verifyBootstrapHistory } from './bootstrap.js';
import { catalogs, collect, inspectRecords } from './validation.js';
import { exists, safePath, withLock, runtime, type Runtime } from './storage.js';
import { inspectSimulationSemantics } from './semantics.js';
import { nextAction, runnableCommand } from './simulation.js';

export function inspectWorkspace(command: 'status' | 'validate' | 'doctor', root: string, rt: Runtime = runtime): Result {
  return withLock(root, () => {
    if (command === 'doctor' && exists(safePath(root, pendingPath, rt), rt)) {
      return { command, outcome: 'recovery-required', coverage: 'none', data: { workspace: root, pending: true, recovery_proposal: planRecovery(root, rt) }, diagnostics: [{ code: 'RECOVERY_REQUIRED', path: pendingPath, message: 'Run doctor --recover to review and explicitly authorize this recovery. No learner state was exposed or changed.' }] };
    }
    assertNoPending(root, rt);
    const inspection = inspectRecords(collect(root, rt), root, rt);
    const { records, diagnostics, advanced } = inspection;
    if (!advanced && diagnostics.length === 0) {
      try { verifyBootstrapHistory(root, rt); } catch (e) { diagnostics.push(diagnostic(e)); }
    }
    if (advanced && diagnostics.length === 0) diagnostics.push(...inspectSimulationSemantics(records, root, rt));
    const config = records.get('config.yaml');
    const profile = records.get('profile.yaml');
    const counts: Record<string, number> = {};
    for (const file of records.keys()) { const group = file.includes('/') ? file.split('/')[0]! : 'bootstrap'; counts[group] = (counts[group] ?? 0) + 1; }
    const invalid = diagnostics.length > 0;
    const certified = !invalid;
    const cache = records.get('competencies.yaml');
    return {
      command, outcome: invalid ? 'invalid' : 'success', coverage: advanced ? 'simulation' : 'bootstrap',
      data: { workspace: root, workspace_id: config?.workspace_id ?? null, mode: config?.mode ?? null, onboarding: profile?.onboarding ?? null, track: records.get('current-track.yaml') ?? null, selection: records.get('current-project.yaml') ?? null, record_counts: counts, metadata_verified: certified,
        ...(certified ? { standing: { last_awarded_level: cache?.last_awarded_level ?? 'E0', effective_level: cache?.effective_level ?? 'E0', standing: cache?.standing ?? 'current', basis: advanced ? 'Derived from canonical assessment cache; one completed task cannot grant promotion.' : 'Administrative placement only; no demonstrated competency.' }, next_action: advanced ? nextAction(root, rt) : bootstrapNext(root, rt) } : {}),
        ...(command === 'doctor' ? { runtime: process.version, platform: process.platform, publication_supported_platform: ['darwin', 'linux'].includes(process.platform), filesystem_assumption: 'Single user, local filesystem with durable fsync and atomic rename; network filesystems are unsupported.', lock: 'acquired', pending: false, receipt_history: invalid ? 'not-verified' : 'verified' } : {}) }, diagnostics
    };
  }, rt);
}
// Before simulation records exist the same navigation applies, but an older bootstrap without track state still
// resolves to track selection rather than failing inspection.
function bootstrapNext(root: string, rt: Runtime): ObjectValue {
  try { return nextAction(root, rt); }
  catch { return { phase: 'TRACK SELECTION', command: 'tracks', run: runnableCommand(root, 'tracks') }; }
}
export function listProjects(trackId?: string, stage?: string): Result {
  const catalog = catalogs();
  let projects = catalog.projects;
  let recommendation: ObjectValue | undefined;
  const stagesByProject = new Map<string, string[]>();
  if (trackId) {
    const track = catalog.tracks.find(item => item.id === trackId);
    if (!track) return { command: 'projects', outcome: 'invalid', coverage: 'catalog', data: {}, diagnostics: [{ code: 'TRACK_NOT_FOUND', path: trackId, message: 'Unknown track ID.' }] };
    if (stage && !['early', 'intermediate', 'advanced'].includes(stage)) return { command: 'projects', outcome: 'invalid', coverage: 'catalog', data: {}, diagnostics: [{ code: 'STAGE_INVALID', path: stage, message: 'Stage must be early, intermediate, or advanced.' }] };
    const groups = stage ? { [stage]: track.recommended_projects[stage] } : track.recommended_projects;
    for (const [stageName, ids] of Object.entries(groups)) for (const id of ids as string[]) stagesByProject.set(id, [...(stagesByProject.get(id) ?? []), stageName]);
    const ids = new Set<string>(Object.values(groups).flat() as string[]); projects = projects.filter(item => ids.has(item.id)); recommendation = { track_id: track.id, stages: groups };
  }
  return { command: 'projects', outcome: 'success', coverage: 'catalog', data: { recommendation, projects: projects.map(p => ({ ...p, track_stages: stagesByProject.get(p.id) ?? [], level_fit: { minimum: p.recommended_minimum_level, ideal: p.ideal_level }, live_selection_available: p.data_class === 'live' && p.status !== 'deprecated' && Boolean(p.support?.attachable), classification: p.support?.task_packs?.length ? 'Attachable with curated task-pack support.' : p.support?.attachable ? 'Attachable catalog candidate; use the portable task-assignment workflow.' : 'Browse-only catalog entry.' })) }, diagnostics: [] };
}
