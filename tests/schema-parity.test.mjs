/**
 * Differential test: the in-repo Draft 2020-12 subset validator (core/schema.ts) must agree with ajv
 * on accept/reject for every protocol schema, over the real corpus plus systematic mutations of it.
 *
 * ajv is retained as a devDependency purely to be the oracle here. If this test ever fails, the
 * replacement is not equivalent and must not ship.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { compileSchema, errorsText } from '../dist/core/schema.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
addFormats(ajv);

const schemaFiles = fs.readdirSync(path.join(root, 'schemas')).filter(f => f.endsWith('.schema.json')).sort();
const pairs = new Map(schemaFiles.map(file => {
  const schema = JSON.parse(fs.readFileSync(path.join(root, 'schemas', file), 'utf8'));
  return [file.replace('.schema.json', ''), { ajv: ajv.compile(schema), mine: compileSchema(schema) }];
}));

const canonicalJoin = list => list.join('\u0000');
const agree = (name, value) => {
  const { ajv: oracle, mine } = pairs.get(name);
  return oracle(value) === (mine(value).length === 0);
};

/* Corpus ------------------------------------------------------------------------------------- */
const stateRoot = path.join(root, 'examples/spring-petclinic/.apprenticeship');
const stateSchema = file => ({
  'config.yaml': 'apprenticeship-config', 'profile.yaml': 'learner-profile', 'current-project.yaml': 'current-project',
  'current-track.yaml': 'current-track', 'competencies.yaml': 'competency-state',
}[path.basename(file)] ?? { projects: 'project', work: 'task', evidence: 'evidence', assessments: 'assessment', reviews: 'review' }[path.basename(path.dirname(file))]
  ?? (path.basename(path.dirname(path.dirname(file))) === 'reviews' ? 'review' : null));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const corpus = [];
for (const file of walk(stateRoot)) {
  const name = stateSchema(file);
  if (!name || !file.endsWith('.yaml') || !pairs.has(name)) continue;
  corpus.push({ name, label: path.relative(root, file), value: JSON.parse(fs.readFileSync(file, 'utf8')) });
}
// The promotion branch of the review oneOf has no fixture on disk, and it is the most complex branch
// in the largest schema. Build the packet the same way evaluations/validate_freeze.py:142 does, so the
// oneOf's fourth arm is exercised by an accepting document rather than only by rejections.
{
  const load = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  const recommendation = load('examples/spring-petclinic/.apprenticeship/reviews/performance/REV-performance-demo.yaml');
  const readiness = load('examples/spring-petclinic/.apprenticeship/assessments/ASM-navigation-demo.yaml');
  const scope = recommendation.evaluation_scope;
  readiness.findings = [...scope.core_competencies, ...scope.specialization_competencies].map(competency_id => ({ ...readiness.findings[0], competency_id }));
  recommendation.assessment_ids = [readiness.id];
  recommendation.outcome = 'recommend-promotion-review';
  const promotion = {
    ...structuredClone(recommendation),
    id: 'REV-shape-promotion', kind: 'promotion', outcome: 'INSUFFICIENT EVIDENCE',
    author: { id: 'ACTOR-demo-promotion-reviewer', role: 'promotion-reviewer' },
    from_level: 'E0', target_level: 'E1', previous_promotion_id: null,
    technical_reviewer_id: readiness.author.id, recommendation_review_id: recommendation.id, readiness_assessment_id: readiness.id,
    authorization: { learner_id: readiness.learner_id, at: recommendation.created_at, artifact: { uri: 'fixture:authorization', revision: 'fixture-v2', description: 'Shape only.' } },
    dimension_findings: load('catalog/levels.yaml').dimensions.map(dimension => ({ dimension, evidence_ids: [], judgment: 'unknown', rationale: 'Shape only.' })),
    quality_analysis: Object.fromEntries(['repetition', 'recency', 'diversity', 'scope', 'independence', 'contrary_evidence'].map(k => [k, 'Shape only.'])),
  };
  corpus.push({ name: 'review', label: 'derived promotion review', value: promotion });
  corpus.push({ name: 'review', label: 'derived promotion recommendation', value: recommendation });
  corpus.push({ name: 'assessment', label: 'derived readiness assessment', value: readiness });
}
for (const [dir, name] of [['catalog/projects', 'project'], ['catalog/tracks', 'track'], ['catalog/forge', 'forge']]) {
  for (const file of fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.yaml'))) {
    corpus.push({ name, label: `${dir}/${file}`, value: JSON.parse(fs.readFileSync(path.join(root, dir, file), 'utf8')) });
  }
}

/* Mutations ---------------------------------------------------------------------------------- */
const clone = value => JSON.parse(JSON.stringify(value));
const REPLACEMENTS = [null, 0, 1.5, '', 'xxx', true, false, [], {}, [null], { a: 1 }, '2026-13-45T99:99:99Z', 'not a uri', '  '];

function paths(value, prefix = []) {
  const found = [prefix];
  if (Array.isArray(value)) value.forEach((item, index) => found.push(...paths(item, [...prefix, index])));
  else if (value && typeof value === 'object') for (const key of Object.keys(value)) found.push(...paths(value[key], [...prefix, key]));
  return found;
}
const at = (value, where) => where.reduce((node, key) => node?.[key], value);
function setAt(value, where, next) {
  if (where.length === 0) return next;
  const copy = clone(value);
  const parent = where.slice(0, -1).reduce((node, key) => node[key], copy);
  parent[where.at(-1)] = next;
  return copy;
}
function deleteAt(value, where) {
  if (where.length === 0) return undefined;
  const copy = clone(value);
  const parent = where.slice(0, -1).reduce((node, key) => node[key], copy);
  if (Array.isArray(parent)) parent.splice(where.at(-1), 1); else delete parent[where.at(-1)];
  return copy;
}

function* mutations(document) {
  const places = paths(document);
  for (const where of places) {
    if (where.length > 0) yield deleteAt(document, where);
    for (const replacement of REPLACEMENTS) yield setAt(document, where, replacement);
    const node = at(document, where);
    if (node && typeof node === 'object' && !Array.isArray(node)) yield setAt(document, where, { ...node, unexpected_field: 'x' });
    if (Array.isArray(node)) {
      yield setAt(document, where, []);
      if (node.length > 0) yield setAt(document, where, [node[0], clone(node[0])]);
    }
    if (typeof node === 'string') { yield setAt(document, where, node + 'X'); yield setAt(document, where, node.toUpperCase()); }
  }
}

test('the corpus reaches every schema and every review kind', () => {
  const bySchema = {};
  for (const { name } of corpus) bySchema[name] = (bySchema[name] ?? 0) + 1;
  const missing = [...pairs.keys()].filter(name => !bySchema[name]);
  assert.deepEqual(missing, [], `schemas with no accepting document in the corpus: ${missing.join(', ')}`);
  const kinds = new Set(corpus.filter(entry => entry.name === 'review').map(entry => entry.value.kind));
  assert.deepEqual([...kinds].sort(), ['code', 'performance', 'promotion', 'task'], 'review oneOf branches not all exercised');
  console.log(`      corpus: ${corpus.length} documents across ${Object.keys(bySchema).length} schemas`);
});

test('subset validator agrees with ajv on the real corpus', () => {
  assert.ok(corpus.length >= 100, `corpus too small: ${corpus.length}`);
  for (const { name, label, value } of corpus) {
    assert.ok(pairs.get(name).ajv(value), `fixture ${label} does not validate against ${name}; corpus assumption broken`);
    assert.ok(agree(name, value), `disagreement on unmutated ${label} against ${name}`);
  }
});

test('subset validator agrees with ajv on systematic mutations of every corpus document', () => {
  let cases = 0, rejected = 0;
  const disagreements = [], textMismatches = [];
  for (const { name, label, value } of corpus) {
    for (const mutated of mutations(value)) {
      if (mutated === undefined) continue;
      cases++;
      const { ajv: oracle, mine: subset } = pairs.get(name);
      const oracleValid = oracle(mutated);
      const errors = subset(mutated);
      if (!oracleValid) rejected++;
      if (oracleValid !== (errors.length === 0) && disagreements.length < 10) {
        disagreements.push({ kind: 'verdict', label, name, oracleValid, mine: errors.length === 0, mutated: JSON.stringify(mutated).slice(0, 200) });
      } else if (!oracleValid) {
        // Compare the error multiset, not the sequence. ajv's emission order is an artifact of its
        // codegen keyword scheduling (it emits allOf/if results before the object's own required and
        // properties errors). Nothing in this codebase or the protocol depends on that order, so
        // reproducing it would couple the subset validator to an ajv implementation detail forever.
        // Same errors, same wording, same paths, same count is the guarantee; sequence is not.
        const expected = ajv.errorsText(oracle.errors, { separator: '; ' }).split('; ').sort();
        const actual = errorsText(errors).split('; ').sort();
        if (canonicalJoin(expected) !== canonicalJoin(actual) && textMismatches.length < 10) {
          textMismatches.push({ label, name, expected: expected.join(' | ').slice(0, 300), actual: actual.join(' | ').slice(0, 300) });
        }
      }
    }
  }
  assert.deepEqual(disagreements, [], `validators disagree on accept/reject for ${disagreements.length}+ mutated documents`);
  assert.deepEqual(textMismatches, [], `validators agree on verdict but report a different set of errors for ${textMismatches.length}+ documents`);
  assert.ok(cases > 20000, `too few mutation cases to be meaningful: ${cases}`);
  assert.ok(rejected / cases > 0.3, `mutations are not discriminating: only ${rejected}/${cases} rejected`);
  console.log(`      parity over ${cases} mutated documents (${rejected} rejected by both)`);
});

test('subset validator agrees with ajv on date-time and uri edge cases', () => {
  const probe = format => ({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', additionalProperties: false, required: ['v'], properties: { v: { type: 'string', format } } });
  const samples = [
    '2026-09-17T12:00:00Z', '2026-09-17t12:00:00z', '2026-09-17 12:00:00Z', '2026-09-17T12:00:00+05:00', '2026-09-17T12:00:00+0500',
    '2026-09-17T12:00:00', '2026-09-17T12:00:00.123456Z', '2026-02-29T00:00:00Z', '2024-02-29T00:00:00Z', '2026-02-30T00:00:00Z',
    '2026-13-01T00:00:00Z', '2026-00-10T00:00:00Z', '2026-09-00T00:00:00Z', '2026-09-31T00:00:00Z', '2026-04-31T00:00:00Z',
    '2026-12-31T23:59:60Z', '2026-12-31T23:59:61Z', '2026-09-17T24:00:00Z', '2026-09-17T12:60:00Z', '2026-09-17T12:00:60Z',
    '2026-09-17T12:00:00+24:00', '2026-09-17T12:00:00+23:60', '', '2026-09-17', 'T12:00:00Z', 'now', '20260917T120000Z',
    'https://github.com/x/y', 'http://a.b', 'workspace:/knowledge/notes.md', 'workspace:/source/a/b.java', 'fixture:registry-consent',
    'urn:uuid:0d8f2b1a-0000-4000-8000-000000000000', 'mailto:a@b.c', '/relative/path', 'relative', '//host/path', 'a b:c',
    'https://example.com/a?b=c#d', 'HTTPS://EXAMPLE.COM', 'x:', ':', 'https://', 'file:///tmp/x', 'sha256:abc',
  ];
  for (const format of ['date-time', 'uri']) {
    const oracle = ajv.compile(probe(format));
    const mine = compileSchema(probe(format));
    for (const sample of samples) {
      const value = { v: sample };
      assert.equal(oracle(value), mine(value).length === 0, `${format} disagreement on ${JSON.stringify(sample)}: ajv=${oracle(value)}`);
    }
  }
});

test('unsupported schema keywords fail at compile time rather than validating less than claimed', () => {
  assert.throws(() => compileSchema({ type: 'object', properties: { a: { patternProperties: { '^x': { type: 'string' } } } } }), /Unsupported schema keyword "patternProperties"/);
  assert.throws(() => compileSchema({ type: 'object', properties: { a: { type: 'string', format: 'email' } } }), /Unsupported format "email"/);
  assert.throws(() => compileSchema({ allOf: [{ type: 'object' }, { unevaluatedProperties: false }] }), /Unsupported schema keyword "unevaluatedProperties"/);
});
