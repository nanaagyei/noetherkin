import { Failure, requireThat, type ObjectValue } from './common.js';

// ACP-013 competency graph. Edges change where a human looks, never what a human concludes: this module is the only
// runtime reader of `prerequisites` and `encompasses`, and nothing that derives the competency cache imports it.

export interface CompetencyGraph {
  prerequisites: Record<string, string[]>;
  encompasses: Record<string, string[]>;
}

const edgeKinds = ['prerequisites', 'encompasses'] as const;

export function validateCompetencyGraph(competencies: ObjectValue[]): void {
  const ids = new Set(competencies.map(item => item.id as string));
  const core = new Set(competencies.filter(item => item.required_core).map(item => item.id as string));
  const edges = new Map<string, string[]>();
  for (const item of competencies) {
    const out: string[] = [];
    for (const kind of edgeKinds) {
      const targets = item[kind] ?? [];
      requireThat(Array.isArray(targets) && targets.every((id: unknown) => typeof id === 'string') && new Set(targets).size === targets.length, 'CATALOG_INVALID', `${item.id}.${kind}`, 'Edges must be a list of distinct competency IDs.');
      for (const target of targets) {
        requireThat(target !== item.id, 'CATALOG_INVALID', `${item.id}.${kind}`, `${item.id} cannot list itself.`);
        requireThat(ids.has(target), 'CATALOG_INVALID', `${item.id}.${kind}`, `Unknown competency ${target}.`);
        out.push(target);
      }
    }
    // Core must stay reachable from an empty profile, so a core competency may only depend on core.
    if (item.required_core) for (const target of item.prerequisites ?? []) requireThat(core.has(target), 'CATALOG_INVALID', `${item.id}.prerequisites`, `Core competency ${item.id} cannot require non-core ${target}.`);
    edges.set(item.id, out);
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, trail: string[]): void => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      const cycle = [...trail.slice(trail.indexOf(id)), id];
      throw new Failure('CATALOG_INVALID', 'catalog/competencies.yaml', `Competency graph contains a cycle: ${cycle.join(' -> ')}.`);
    }
    state.set(id, 'visiting');
    for (const next of edges.get(id) ?? []) visit(next, [...trail, id]);
    state.set(id, 'done');
  };
  for (const id of ids) visit(id, []);
}

// A workspace pinned to competency catalog 3.0 predates the graph and gets none; edges are never synthesized.
export function competencyGraph(competencies: ObjectValue[], pinnedCatalogVersion: string): CompetencyGraph {
  const graph: CompetencyGraph = { prerequisites: {}, encompasses: {} };
  if (pinnedCatalogVersion !== '4.0') return graph;
  for (const item of competencies) for (const kind of edgeKinds) if (item[kind]?.length) graph[kind][item.id] = [...item[kind]];
  return graph;
}

// Read-only view for one competency, including the derived reverse directions. Advisory data for a human reader.
export function competencyNeighbourhood(graph: CompetencyGraph, id: string): ObjectValue {
  const reverse = (kind: keyof CompetencyGraph) => Object.entries(graph[kind]).filter(([, targets]) => targets.includes(id)).map(([source]) => source).sort();
  return { competency_id: id, prerequisites: graph.prerequisites[id] ?? [], required_by: reverse('prerequisites'), encompasses: graph.encompasses[id] ?? [], encompassed_by: reverse('encompasses') };
}
