import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { competencyGraph, competencyNeighbourhood, validateCompetencyGraph } from '../core/graph.js';
import { catalogs, collect, inspectRecords } from '../core/validation.js';

// ACP-013 conformance: CF-35 to CF-37 and FR-32 to FR-34 and FR-36. FR-35 is reviewer behavior and lives in the
// behavioral cases.

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));
const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, domain: id.split('.')[0], name: id, observable_behavior: 'Observable.', required_core: id.startsWith('core.'), ...extra });

function workspace(t: { after: (fn: () => void) => void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-graph-'))); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Learn'], assistance_default_max: 3 }); publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  return root;
}

test('CF-35: the shipped catalog is an acyclic graph exposed to a 4.0 workspace', () => {
  const { competencies } = catalogs();
  assert.doesNotThrow(() => validateCompetencyGraph(competencies));
  const graph = competencyGraph(competencies, '4.0');
  assert.deepEqual(graph.prerequisites['core.debugging'], ['core.codebase-navigation', 'core.testing']);
  assert.deepEqual(competencyNeighbourhood(graph, 'core.testing').required_by, ['backend.authentication-authorization', 'backend.concurrency', 'core.debugging', 'core.ownership', 'data.quality', 'frontend.accessibility', 'python.testing']);
});

test('CF-36: an unedged competency is always reachable and shows no edges', () => {
  const graph = competencyGraph(catalogs().competencies, '4.0');
  assert.deepEqual(competencyNeighbourhood(graph, 'game.rendering'), { competency_id: 'game.rendering', prerequisites: [], required_by: [], encompasses: [], encompassed_by: [] });
  assert.doesNotThrow(() => validateCompetencyGraph([node('core.a'), node('backend.b')]));
});

test('CF-37: a workspace pinned to catalog 3.0 stays valid and gets no synthesized edges', t => {
  const root = workspace(t);
  const records = collect(root);
  assert.equal(records.get('config.yaml')!.competency_catalog_version, '4.0', 'new workspaces pin the graph catalog');
  records.get('config.yaml')!.competency_catalog_version = '3.0';
  assert.deepEqual(inspectRecords(records, root).diagnostics, []);
  records.get('config.yaml')!.competency_catalog_version = '5.0';
  assert.notDeepEqual(inspectRecords(records, root).diagnostics, []);
  const graph = competencyGraph(catalogs().competencies, '3.0');
  assert.deepEqual(graph, { prerequisites: {}, encompasses: {} });
  const shown = spawnSync(process.execPath, [cli, 'competency', 'show', 'core.debugging', '--json'], { encoding: 'utf8' });
  assert.equal(shown.status, 0, shown.stderr);
  assert.deepEqual(JSON.parse(shown.stdout).data.prerequisites, ['core.codebase-navigation', 'core.testing']);
});

test('FR-32: a cycle is rejected with the cycle named, never broken arbitrarily', () => {
  assert.throws(() => validateCompetencyGraph([node('core.a', { prerequisites: ['core.b'] }), node('core.b', { encompasses: ['core.c'] }), node('core.c', { prerequisites: ['core.a'] })]),
    { code: 'CATALOG_INVALID', message: /cycle: core\.a -> core\.b -> core\.c -> core\.a/ });
});

test('FR-33: a dangling or self edge is rejected by name', () => {
  assert.throws(() => validateCompetencyGraph([node('core.a', { prerequisites: ['core.missing'] })]), { code: 'CATALOG_INVALID', message: /Unknown competency core\.missing/ });
  assert.throws(() => validateCompetencyGraph([node('core.a', { encompasses: ['core.a'] })]), { code: 'CATALOG_INVALID', message: /cannot list itself/ });
  assert.throws(() => validateCompetencyGraph([node('core.a', { prerequisites: ['core.b', 'core.b'] }), node('core.b')]), { code: 'CATALOG_INVALID' });
});

test('FR-34: a core competency cannot require a non-core prerequisite', () => {
  assert.throws(() => validateCompetencyGraph([node('core.a', { prerequisites: ['backend.b'] }), node('backend.b')]), { code: 'CATALOG_INVALID', message: /cannot require non-core backend\.b/ });
  assert.doesNotThrow(() => validateCompetencyGraph([node('core.a', { encompasses: ['backend.b'] }), node('backend.b')]), 'encompassing is not requiring');
});

test('FR-36: no code that derives standing or the competency cache can read the graph', () => {
  // Only the graph module, the catalog validator and the read-only CLI may mention edges or import the graph.
  // ACP-014 adds the advisory modules, which read edges but write only the derived advisory file.
  const allowed = new Set(['core/graph.ts', 'core/validation.ts', 'cli/main.ts', 'core/frontier.ts', 'core/advisory.ts']);
  const sources = ['core', 'cli', 'adapters/runtime', 'adapters/hosts'].flatMap(directory => fs.readdirSync(path.join(repository, directory), { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.ts')).map(file => `${directory}/${file}`));
  for (const file of sources.filter(file => !allowed.has(file))) {
    const text = fs.readFileSync(path.join(repository, file), 'utf8');
    // The track listing copies a project's own `prerequisites` field, unrelated to competency edges; nothing else may.
    const edgeAccess = text.replaceAll('prerequisites: project.prerequisites', '');
    assert.doesNotMatch(edgeAccess, /\bprerequisites\b|\bencompasses\b|from '[./]*graph\.js'/, `${file} must not read competency edges`);
  }
  // Nothing but the CLI may import the advisory modules, so no publisher or cache derivation can reach them.
  for (const file of sources.filter(file => !['cli/main.ts', 'core/advisory.ts'].includes(file))) {
    assert.doesNotMatch(fs.readFileSync(path.join(repository, file), 'utf8'), /from '[./]*(advisory|frontier)\.js'/, `${file} must not import the advisory view`);
  }
  const validation = fs.readFileSync(path.join(repository, 'core/validation.ts'), 'utf8');
  assert.deepEqual([...validation.matchAll(/\b(prerequisites|encompasses|validateCompetencyGraph)\b/g)].map(match => match[1]).filter(name => name !== 'validateCompetencyGraph'), ['prerequisites', 'encompasses'], 'validation.ts may only name the fields in its allowed-key list');
});
