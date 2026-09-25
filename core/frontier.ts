import { canonical, sha256, type ObjectValue } from './common.js';
import type { CompetencyGraph } from './graph.js';

// ACP-014 advisory attention view (docs/architecture/selection-model.md). Pure functions over the competency cache,
// published evidence and the ACP-013 graph. The output orders competencies for a human to look at; it is never
// evidence, never gates anything and never feeds the cache. There is deliberately no percentage, mastery value,
// decay coefficient or due date anywhere in this module, and no invented constant: ordering uses only observed
// dates and observed context counts, and equal keys are reported as ties rather than broken.

type Finding = 'unassessed' | 'developing' | 'demonstrated' | 'contested';

export interface AttentionInputs {
  graph: CompetencyGraph;
  /** Competency IDs in the learner's evaluation scope. */
  scope: string[];
  /** The derived competency cache, `.apprenticeship/competencies.yaml`. It is authoritative over this view. */
  cache: ObjectValue;
  /** Published evidence records. Only those the cache cites are read. */
  evidence: ObjectValue[];
  catalogVersion: string;
  generatedAt: string;
  dataClass?: 'live' | 'fixture';
}

export const advisoryNotice = 'Advisory ordering derived from the competency cache, cited evidence and the competency graph. It establishes nothing, is not evidence, gates nothing, and loses to .apprenticeship/competencies.yaml on any disagreement. Delete it at any time.';

export function cacheDigest(cache: ObjectValue): string { return `sha256:${sha256(canonical(cache))}`; }

function findings(cache: ObjectValue): Map<string, ObjectValue> {
  return new Map((cache.entries ?? []).map((entry: ObjectValue) => [entry.competency_id as string, entry]));
}

function findingOf(entries: Map<string, ObjectValue>, id: string): Finding { return (entries.get(id)?.status ?? 'unassessed') as Finding; }

/** A finding is stale when the cache marks any record it rests on as stale. */
function isStale(entries: Map<string, ObjectValue>, cache: ObjectValue, id: string): boolean {
  const entry = entries.get(id); if (!entry) return false;
  const stale = new Set<string>(cache.stale_record_ids ?? []);
  return [...entry.evidence_ids, ...entry.assessment_ids].some((record: string) => stale.has(record));
}

/** The cached evidence for one competency, minus anything a later evidence record superseded. */
function citedEvidence(entries: Map<string, ObjectValue>, evidence: ObjectValue[], id: string): ObjectValue[] {
  const superseded = new Set(evidence.map(item => item.supersedes).filter(Boolean));
  const cited = new Set<string>(entries.get(id)?.evidence_ids ?? []);
  return evidence.filter(item => cited.has(item.id) && !superseded.has(item.id) && item.competency_id === id);
}

/** Every competency that transitively requires `id` through prerequisite edges, restricted to `within`. */
function dependents(graph: CompetencyGraph, id: string, within: Set<string>): string[] {
  const found = new Set<string>(); const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const [source, targets] of Object.entries(graph.prerequisites)) if (targets.includes(current) && !found.has(source)) { found.add(source); queue.push(source); }
  }
  return [...found].filter(item => within.has(item)).sort();
}

/** Every prerequisite reachable backwards from `id`, nearest first. */
function ancestors(graph: CompetencyGraph, id: string): { competency_id: string; via: string }[] {
  const seen = new Set<string>(); const out: { competency_id: string; via: string }[] = []; const queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const prerequisite of graph.prerequisites[current] ?? []) if (!seen.has(prerequisite)) { seen.add(prerequisite); out.push({ competency_id: prerequisite, via: current }); queue.push(prerequisite); }
  }
  return out;
}

interface Candidate { id: string; finding: Finding; position: 'frontier' | 'demonstrated'; shaky: string[]; last: string | null; contexts: number; reasons: string[] }

// Priority: a shaky foundation first, then the oldest most-recent evidence (never observed is oldest), then the
// fewest distinct project contexts. The competency ID is not a key; it only fixes the display order inside a tie.
function compare(a: Candidate, b: Candidate): number {
  if ((a.shaky.length > 0) !== (b.shaky.length > 0)) return a.shaky.length > 0 ? -1 : 1;
  if (a.last !== b.last) { if (a.last === null) return -1; if (b.last === null) return 1; return Date.parse(a.last) - Date.parse(b.last); }
  return a.contexts - b.contexts;
}

export function attentionAdvisory(input: AttentionInputs): ObjectValue {
  const entries = findings(input.cache);
  const scope = [...new Set(input.scope)].sort();
  const within = new Set(scope);
  const candidates: Candidate[] = []; const blocked: ObjectValue[] = []; const remediation: ObjectValue[] = [];
  for (const id of scope) {
    const finding = findingOf(entries, id);
    const prerequisites = input.graph.prerequisites[id] ?? [];
    if (finding === 'contested') { remediation.push({ competency_id: id, reason: 'The finding is contested. A contradiction in the evidence needs explaining before more practice on it.' }); continue; }
    const missing = prerequisites.filter(item => findingOf(entries, item) !== 'demonstrated');
    if (finding !== 'demonstrated' && missing.length) { blocked.push({ competency_id: id, finding, missing_prerequisites: missing }); continue; }
    const shaky = prerequisites.filter(item => findingOf(entries, item) === 'contested' || isStale(entries, input.cache, item));
    const cited = citedEvidence(entries, input.evidence, id);
    const last = cited.map(item => item.fact.observed_at as string).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;
    const contexts = new Set(cited.map(item => item.project_id ?? '')).size;
    const reasons = [
      ...shaky.map(item => `Prerequisite ${item} is ${findingOf(entries, item) === 'contested' ? 'contested' : 'stale'}; a shaky foundation comes first.`),
      last === null ? 'No cited evidence yet.' : `Most recent cited evidence was observed at ${last}.`,
      ...(last === null ? [] : [`Cited evidence comes from ${contexts} distinct project context${contexts === 1 ? '' : 's'}.`]),
      ...(finding !== 'demonstrated' ? [prerequisites.length ? `Every prerequisite (${prerequisites.join(', ')}) is demonstrated.` : 'It has no prerequisites in the graph.'] : []),
    ];
    candidates.push({ id, finding, position: finding === 'demonstrated' ? 'demonstrated' : 'frontier', shaky, last, contexts, reasons });
  }
  candidates.sort((a, b) => compare(a, b) || a.id.localeCompare(b.id));
  let rank = 0;
  const ranked = candidates.map((item, index) => { if (index === 0 || compare(candidates[index - 1]!, item) !== 0) rank += 1; return { item, rank }; });
  const attention = ranked.map(({ item, rank: position }) => ({
    competency_id: item.id, finding: item.finding, position: item.position, rank: position,
    tied_with: ranked.filter(other => other.rank === position && other.item.id !== item.id).map(other => other.item.id),
    last_observed_at: item.last, contexts: item.contexts, reasons: item.reasons,
  }));
  // Baseline probing (ACP-014 2.4): probe where one observation constrains the most of the scope. With no edges this
  // degenerates to no candidates, and the onboarding contract falls back to the core competencies.
  const probe_candidates = scope.map(id => ({ competency_id: id, constrains: dependents(input.graph, id, within) }))
    .filter(item => item.constrains.length > 0 && findingOf(entries, item.competency_id) !== 'demonstrated')
    .sort((a, b) => b.constrains.length - a.constrains.length || a.competency_id.localeCompare(b.competency_id));
  const evidenceIds = [...new Set([...entries.values()].flatMap(entry => entry.evidence_ids as string[]))].sort();
  return {
    schema_version: '1.0', data_class: input.dataClass ?? 'live', canonical: false, generated_at: input.generatedAt,
    source: { competency_catalog_version: input.catalogVersion, cache_generated_at: input.cache.generated_at, cache_digest: cacheDigest(input.cache), evidence_ids: evidenceIds },
    notice: advisoryNotice, attention, blocked, remediation, probe_candidates,
  };
}

/**
 * FR-37: where a stored view disagrees with the cache, the cache wins. Returns each disagreement so it can be reported;
 * the caller regenerates rather than reconciling.
 */
export function contradictions(view: ObjectValue, cache: ObjectValue): string[] {
  const entries = findings(cache); const out: string[] = [];
  if (view.source?.cache_digest !== cacheDigest(cache)) out.push('The stored advisory was computed from a different competency cache.');
  for (const item of view.attention ?? []) if (findingOf(entries, item.competency_id) !== item.finding) out.push(`${item.competency_id}: advisory says ${item.finding}, the cache says ${findingOf(entries, item.competency_id)}.`);
  for (const item of view.remediation ?? []) if (findingOf(entries, item.competency_id) !== 'contested') out.push(`${item.competency_id}: advisory lists it for remediation, the cache says ${findingOf(entries, item.competency_id)}.`);
  return out;
}

/**
 * CF-40: after a rework outcome, name the specific prerequisites of the task's primary competencies to revisit.
 * Undemonstrated, contested or stale prerequisites come first; if every prerequisite is demonstrated, the direct
 * prerequisites are still named, so the learner gets a specific claim to argue with rather than "study more".
 */
export function remediationFor(graph: CompetencyGraph, cache: ObjectValue, primary: string[]): ObjectValue[] {
  const entries = findings(cache); const out: ObjectValue[] = []; const seen = new Set<string>();
  for (const competency of primary) for (const { competency_id, via } of ancestors(graph, competency)) {
    if (seen.has(competency_id)) continue;
    const finding = findingOf(entries, competency_id); const stale = isStale(entries, cache, competency_id);
    const direct = (graph.prerequisites[competency] ?? []).includes(competency_id);
    if (finding === 'demonstrated' && !stale && !direct) continue;
    seen.add(competency_id);
    const reason = finding === 'demonstrated' && !stale ? `Demonstrated, but it is a direct prerequisite of ${competency}; check this foundation first.`
      : `${finding === 'demonstrated' ? 'Its evidence is stale' : `Its finding is ${finding}`}, and ${via} depends on it${via === competency ? '' : ` on the way to ${competency}`}.`;
    out.push({ competency_id, for: competency, finding, reason, weak: finding !== 'demonstrated' || stale });
  }
  return out.sort((a, b) => Number(b.weak) - Number(a.weak)).map(({ weak, ...rest }) => { void weak; return rest; });
}
