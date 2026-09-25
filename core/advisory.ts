import { diagnostic, encode, requireThat, type Diagnostic, type ObjectValue } from './common.js';
import { parse } from './parsing.js';
import { advisoryDirectory, exists, read, runtime, safePath, statePath, type Runtime } from './storage.js';
import { catalogs, collect, validateDocument } from './validation.js';
import { competencyGraph, type CompetencyGraph } from './graph.js';
import { attentionAdvisory, contradictions, remediationFor } from './frontier.js';

// ACP-014 workspace I/O for the advisory view. Only the CLI imports this module; nothing that publishes canonical
// state or derives the competency cache may (FR-36 guard in tests/competency-graph.test.ts). Every function here is
// best-effort: a missing, unreadable or unwritable advisory never blocks a command (CF-39).

export const advisoryFile = `${advisoryDirectory}/attention.yaml`;

function state(root: string, relative: string, rt: Runtime): ObjectValue { return parse(read(root, statePath(relative), rt), statePath(relative)); }

function workspaceGraph(root: string, rt: Runtime): CompetencyGraph {
  return competencyGraph(catalogs().competencies, state(root, 'config.yaml', rt).competency_catalog_version);
}

/** Derive the view from canonical state without writing anything. */
export function deriveAdvisory(root: string, rt: Runtime = runtime): ObjectValue {
  const config = state(root, 'config.yaml', rt); const profile = state(root, 'profile.yaml', rt); const cache = state(root, 'competencies.yaml', rt);
  const { competencies, competencyIds, coreCompetencyIds } = catalogs();
  const scope = [...coreCompetencyIds, ...(profile.specialization_competencies ?? []), ...(cache.entries ?? []).map((entry: ObjectValue) => entry.competency_id)].filter(id => competencyIds.has(id));
  const evidence = [...collect(root, rt)].filter(([file]) => file.startsWith('evidence/')).map(([, value]) => value);
  const view = attentionAdvisory({ graph: competencyGraph(competencies, config.competency_catalog_version), scope, cache, evidence, catalogVersion: config.competency_catalog_version, generatedAt: rt.now(), dataClass: config.data_class });
  validateDocument(view, 'attention-advisory', advisoryFile);
  return view;
}

/** FR-39: the advisory writer can only ever write inside the advisory directory. */
export function writeAdvisory(root: string, view: ObjectValue, rt: Runtime = runtime, target: string = advisoryFile): void {
  const normalized = target.split('/').filter(part => part && part !== '.');
  requireThat(target.startsWith(`${advisoryDirectory}/`) && !normalized.includes('..') && normalized.length === advisoryDirectory.split('/').length + 1, 'ADVISORY_CANONICAL_WRITE', target, 'The advisory view may only be written inside .apprenticeship/advisory/; it never writes canonical state.');
  validateDocument(view, 'attention-advisory', target);
  const directory = safePath(root, advisoryDirectory, rt);
  if (!exists(directory, rt)) rt.fs.mkdirSync(directory, { recursive: true });
  const temporary = safePath(root, `${target}.tmp-${process.pid}`, rt);
  rt.fs.writeFileSync(temporary, encode(view));
  rt.fs.renameSync(temporary, safePath(root, target, rt));
}

export interface AdvisoryRefresh { view: ObjectValue | null; written: boolean; contradictions: string[]; diagnostics: Diagnostic[] }

/**
 * Regenerate the view for `next`. A previous file that disagrees with the cache is reported and replaced, never
 * reconciled (FR-37). Writes happen only in active mode; paused and archived workspaces get the view in the output only.
 */
export function refreshAdvisory(root: string, rt: Runtime = runtime): AdvisoryRefresh {
  const result: AdvisoryRefresh = { view: null, written: false, contradictions: [], diagnostics: [] };
  try {
    const cache = state(root, 'competencies.yaml', rt);
    const location = safePath(root, advisoryFile, rt);
    if (exists(location, rt)) {
      try { result.contradictions = contradictions(parse(rt.fs.readFileSync(location), advisoryFile), cache); }
      catch { result.contradictions = ['The stored advisory could not be read; it was regenerated.']; }
    }
    result.view = deriveAdvisory(root, rt);
    if (state(root, 'config.yaml', rt).mode === 'active') { writeAdvisory(root, result.view, rt); result.written = true; }
  } catch (error) {
    result.diagnostics.push({ ...diagnostic(error), code: 'ADVISORY_UNAVAILABLE' });
  }
  return result;
}

/** CF-40: prerequisite competencies to revisit after a rework outcome on the current task. */
export function taskRemediation(root: string, task: ObjectValue, rt: Runtime = runtime): ObjectValue[] {
  try { return remediationFor(workspaceGraph(root, rt), state(root, 'competencies.yaml', rt), task.primary_competencies ?? []); }
  catch { return []; }
}
