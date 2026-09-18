import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import { parse } from './parsing.js';
import { canonical, diagnostic, encode, requireThat, sha256, validId, type Diagnostic, type ObjectValue } from './common.js';
import { exists, read, runtime, safePath, statePath, type Runtime } from './storage.js';

const assets = fileURLToPath(new URL('../../', import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: true, coerceTypes: false, useDefaults: false, removeAdditional: false });
const addFormats = addFormatsImport as unknown as (instance: Ajv2020) => void;
addFormats(ajv);
const validators = new Map(fs.readdirSync(path.join(assets, 'schemas')).filter(f => f.endsWith('.schema.json')).map(file => {
  const schema = JSON.parse(fs.readFileSync(path.join(assets, 'schemas', file), 'utf8'));
  return [file.replace('.schema.json', ''), ajv.compile(schema)];
}));
export function validateDocument(value: ObjectValue, schema: string, file: string): void {
  const validator = validators.get(schema);
  requireThat(validator, 'UNKNOWN_RECORD', file, 'No protocol schema exists for this record location.');
  requireThat(validator(value), 'SCHEMA_INVALID', file, ajv.errorsText(validator.errors, { separator: '; ' }));
}
export function catalogs(): { projects: ObjectValue[]; tracks: ObjectValue[]; competencyIds: Set<string>; coreCompetencyIds: Set<string> } {
  const competencies = parse(fs.readFileSync(path.join(assets, 'catalog/competencies.yaml')), 'catalog/competencies.yaml');
  const levels = parse(fs.readFileSync(path.join(assets, 'catalog/levels.yaml')), 'catalog/levels.yaml');
  requireThat(competencies.catalog_version === '3.0' && levels.catalog_version === '2.0', 'CATALOG_INVALID', 'catalog', 'Expected competency catalog 3.0 and level catalog 2.0.');
  const competencyIds = new Set<string>(competencies.competencies.map((c: ObjectValue) => c.id));
  const coreCompetencyIds = new Set<string>(competencies.competencies.filter((c: ObjectValue) => c.required_core).map((c: ObjectValue) => c.id));
  requireThat(competencyIds.size === competencies.competencies.length, 'CATALOG_INVALID', 'catalog/competencies.yaml', 'Duplicate competency IDs.');
  const projects = fs.readdirSync(path.join(assets, 'catalog/projects')).filter(f => f.endsWith('.yaml')).sort().map(file => {
    const project = parse(fs.readFileSync(path.join(assets, 'catalog/projects', file)), file);
    validateDocument(project, 'project', file);
    requireThat(project.id === file.replace('.yaml', '') && project.competencies.every((id: string) => competencyIds.has(id)), 'CATALOG_INVALID', file, 'Project ID or competency references do not match the catalog.');
    if (project.schema_version === '3.0') {
      requireThat(Array.isArray(project.metadata_gaps) && project.support && typeof project.support.attachable === 'boolean' && project.contribution_readiness && ['verified', 'conditional', 'unverified'].includes(project.contribution_readiness.status), 'CATALOG_INVALID', file, 'Protocol 3.0 projects require explicit metadata gaps, entry costs, contribution readiness, and support capabilities.');
      if (project.status === 'supported') requireThat(project.metadata_gaps.length === 0 && project.difficulty !== null && project.onboarding_cost !== null && project.feedback_loop !== null && project.contribution_readiness.status === 'verified' && project.deployment !== null && project.contribution !== null && project.recommended_minimum_level !== null && project.ideal_level !== null, 'CATALOG_INVALID', file, 'Supported projects require complete verified metadata.');
    }
    return project;
  });
  const projectIds = new Set(projects.map(project => project.id));
  const tracks = fs.readdirSync(path.join(assets, 'catalog/tracks')).filter(f => f.endsWith('.yaml')).sort().map(file => {
    const track = parse(fs.readFileSync(path.join(assets, 'catalog/tracks', file)), file);
    validateDocument(track, 'track', file);
    const recommendations = [...track.recommended_projects.early, ...track.recommended_projects.intermediate, ...track.recommended_projects.advanced];
    requireThat(track.id === file.replace('.yaml', '') && track.required_competencies.every((id: string) => competencyIds.has(id) && !coreCompetencyIds.has(id)), 'CATALOG_INVALID', file, 'Track identity or required competency references are invalid.');
    requireThat(recommendations.every((id: string) => projectIds.has(id) && projects.find(project => project.id === id)?.status !== 'deprecated'), 'CATALOG_INVALID', file, 'Track project references must resolve to non-deprecated catalog entries.');
    return track;
  });
  return { projects, tracks, competencyIds, coreCompetencyIds };
}
export const bootstrapFiles = ['config.yaml', 'profile.yaml', 'current-project.yaml', 'current-track.yaml', 'competencies.yaml'];
export function schemaFor(file: string): string | undefined {
  const roots: Record<string, string> = { 'config.yaml': 'apprenticeship-config', 'profile.yaml': 'learner-profile', 'current-project.yaml': 'current-project', 'current-track.yaml': 'current-track', 'competencies.yaml': 'competency-state' };
  if (roots[file]) return roots[file];
  if (/^projects\/[^/]+\.yaml$/.test(file)) return 'project';
  if (/^work\/[^/]+\.yaml$/.test(file)) return 'task';
  if (/^evidence\/[^/]+\.yaml$/.test(file)) return 'evidence';
  if (/^assessments\/[^/]+\.yaml$/.test(file)) return 'assessment';
  if (/^reviews\/(code|task|performance|promotion)\/[^/]+\.yaml$/.test(file)) return 'review';
  return undefined;
}
export interface Inspection { records: Map<string, ObjectValue>; diagnostics: Diagnostic[]; advanced: boolean; }
export function collect(root: string, rt = runtime): Map<string, ObjectValue> {
  const records = new Map<string, ObjectValue>();
  const walk = (relative: string): void => {
    for (const entry of rt.fs.readdirSync(safePath(root, relative ? statePath(relative) : '.apprenticeship', rt), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      const target = safePath(root, statePath(name), rt);
      if (entry.isDirectory()) { if (!['snapshots', 'authorizations', 'operations'].includes(name)) walk(name); continue; }
      requireThat(entry.isFile(), 'UNSAFE_PATH', statePath(name), 'Workspace state must contain regular files or directories.');
      if (name.endsWith('.yaml') || name.endsWith('.yml')) {
        requireThat(schemaFor(name), 'UNKNOWN_RECORD', statePath(name), 'Unknown structured state location; preserve it and inspect the producer.');
        records.set(name, parse(read(root, statePath(name), rt), statePath(name)));
      } else {
        // Transaction artifacts and literal learner notes are the only non-record files recognized here.
        requireThat(/^knowledge\/.+\.md$/.test(name) || name === 'evidence/resume-evidence.md' || name === 'pending.json', 'UNKNOWN_RECORD', statePath(name), 'Unrecognized state file prevents complete validation.');
      }
      void target;
    }
  };
  requireThat(exists(safePath(root, '.apprenticeship', rt), rt), 'WORKSPACE_NOT_FOUND', root, 'Run init to create a workspace.');
  walk('');
  return records;
}

export function inspectRecords(records: Map<string, ObjectValue>, root?: string, rt: Runtime = runtime): Inspection {
  const diagnostics: Diagnostic[] = [];
  const check = (fn: () => void) => { try { fn(); } catch (e) { diagnostics.push(diagnostic(e)); } };
  for (const [file, value] of records) check(() => validateDocument(value, schemaFor(file)!, statePath(file)));
  for (const file of bootstrapFiles) check(() => requireThat(records.has(file), 'MISSING_RECORD', statePath(file), 'Required bootstrap file is missing; use doctor rather than overwrite it.'));
  const profile = records.get('profile.yaml');
  const config = records.get('config.yaml');
  const selection = records.get('current-project.yaml');
  const trackSelection = records.get('current-track.yaml');
  const advanced = [...records.keys()].some(k => !bootstrapFiles.includes(k)) || profile?.onboarding !== 'pending' || profile?.baseline_assessment_id !== null || selection?.project_id !== null || trackSelection?.track_id !== null || config?.mode !== 'active';
  if (diagnostics.length || !config || !profile || !selection || !trackSelection) return { records, diagnostics, advanced };
  const { competencyIds, tracks } = catalogs();
  const objects = new Map<string, { value: ObjectValue; schema: string }>();
  const used = new Set<string>();
  const register = (id: string, file: string, prefix?: string): void => {
    requireThat(!used.has(id), 'DUPLICATE_ID', file, `Duplicate identity ${id}.`);
    if (config.data_class === 'live' && prefix) requireThat(validId(id, prefix), 'ID_INVALID', file, `Expected ${prefix}-UUID for live identity.`);
    used.add(id);
  };
  check(() => {
    if (config.schema_version === '3.0') requireThat(config.competency_catalog_version === '3.0' && config.level_catalog_version === '2.0' && ['1.0', '1.1'].includes(config.track_catalog_version), 'CATALOG_BINDING_INVALID', 'config.yaml', 'Protocol 3.0 workspaces must pin competency 3.0, level 2.0, and a supported track catalog.');
    register(config.workspace_id, 'config.yaml', 'WS'); register(config.learner_id, 'config.yaml', 'LEARNER');
    requireThat(profile.learner_id === config.learner_id, 'IDENTITY_MISMATCH', 'profile.yaml', 'Profile and config must identify the same learner.');
    for (const principal of config.principals) register(principal.id, 'config.yaml', 'ACTOR');
    const learners = config.principals.filter((p: ObjectValue) => p.role === 'learner');
    requireThat(learners.length === 1 && learners[0].id === config.learner_principal_id && learners[0].retired_at === null, 'REGISTRY_INVALID', 'config.yaml', 'Exactly one non-retired learner must match learner_principal_id.');
    for (const p of config.principals) requireThat(p.retired_at === null || Date.parse(p.granted_at) < Date.parse(p.retired_at), 'REGISTRY_INVALID', 'config.yaml', 'Retirement must follow the immutable grant.');
  });
  const prefixes: Record<string, string> = { task: 'TASK', evidence: 'EVID', assessment: 'ASM', review: 'REV' };
  for (const [file, value] of records) check(() => {
    const schema = schemaFor(file)!;
    requireThat(value.data_class === config.data_class, 'DATA_CLASS_MISMATCH', file, 'Fixture and live records cannot share a workspace.');
    if (value.id) {
      register(value.id, file, prefixes[schema]);
      requireThat(path.posix.basename(file, '.yaml') === value.id, 'FILENAME_MISMATCH', file, 'Record filename must match its ID.');
      if (schema === 'review') requireThat(file.split('/')[1] === value.kind, 'FILENAME_MISMATCH', file, 'Review directory must match kind.');
      objects.set(value.id, { value, schema });
    }
  });
  const single: Record<string, string> = { task_id: 'task', project_id: 'project', baseline_assessment_id: 'assessment', design_assessment_id: 'assessment', recommendation_review_id: 'review', readiness_assessment_id: 'assessment', previous_promotion_id: 'review' };
  const lists: Record<string, string> = { evidence_ids: 'evidence', completion_evidence_ids: 'evidence', assessment_ids: 'assessment', source_assessment_ids: 'assessment', source_review_ids: 'review' };
  for (const [file, value] of records) check(() => {
    const ref = (id: string, schema: string): void => requireThat(schema === 'learner' ? id === config.learner_id : objects.get(id)?.schema === schema, 'REFERENCE_INVALID', file, `${id} must resolve to a ${schema} in this workspace.`);
    const walk = (item: any): void => {
      if (!item || typeof item !== 'object') return;
      if (Array.isArray(item)) { item.forEach(walk); return; }
      if (item.id && item.role) requireThat(config.principals.some((p: ObjectValue) => p.id === item.id && p.role === item.role), 'ACTOR_INVALID', file, 'Actor ID and role must match the retained registry.');
      for (const [key, child] of Object.entries(item)) {
        if (single[key] && child !== null) ref(child as string, single[key]!);
        if (lists[key] && Array.isArray(child)) child.forEach(id => ref(id, lists[key]!));
        if (key === 'stale_record_ids' && Array.isArray(child)) requireThat(child.every(id => ['evidence', 'assessment', 'review'].includes(objects.get(id)?.schema ?? '')), 'REFERENCE_INVALID', file, 'Stale record IDs must resolve to evidence, assessments, or reviews.');
        if (key === 'principal_id' && child !== null) requireThat(config.principals.some((p: ObjectValue) => p.id === child), 'ACTOR_INVALID', file, 'Provider principal must be registered.');
        if (key === 'technical_reviewer_id' && child !== null) requireThat(config.principals.some((p: ObjectValue) => p.id === child && p.role === 'team-lead'), 'ACTOR_INVALID', file, 'Technical reviewer must be a registered team lead.');
        if (key === 'learner_id') requireThat(child === config.learner_id, 'IDENTITY_MISMATCH', file, 'Learner reference must match this workspace.');
        if (key === 'competency_id') requireThat(competencyIds.has(child as string), 'COMPETENCY_INVALID', file, `Unknown competency ${child}.`);
        if (['competencies', 'primary_competencies', 'secondary_competencies', 'specialization_competencies'].includes(key) && Array.isArray(child)) requireThat(child.every(id => competencyIds.has(id)), 'COMPETENCY_INVALID', file, 'Unknown competency reference.');
        if (key === 'uri' && typeof child === 'string') {
          requireThat(config.data_class !== 'live' || !child.startsWith('fixture:'), 'DATA_CLASS_MISMATCH', file, 'Live state cannot cite fixture artifacts.');
          if (child.startsWith('workspace:')) {
            requireThat(/^workspace:\/[^/]/.test(child), 'UNSAFE_PATH', file, 'Use workspace:/relative/path artifact URIs.');
            const relative = decodeURIComponent(child.slice('workspace:/'.length).split(/[?#]/)[0]!);
            safePath(root ?? '/', relative, rt);
          }
        }
        walk(child);
      }
    };
    walk(value);
    if (value.baseline_assessment_id) requireThat(objects.get(value.baseline_assessment_id)?.value.kind === 'baseline', 'REFERENCE_INVALID', file, 'Baseline pointer must reference a baseline assessment.');
    if (value.supersedes) ref(value.supersedes, schemaFor(file)!);
    if (schemaFor(file) === 'review') ref(value.subject_id, ['code', 'task'].includes(value.kind) ? 'task' : 'learner');
  });
  if (selection.source_path !== null) check(() => {
    requireThat(selection.source_path !== '.apprenticeship' && !selection.source_path.startsWith('.apprenticeship/'), 'UNSAFE_PATH', 'current-project.yaml', 'Source must be outside state.');
    safePath(root ?? '/', selection.source_path, rt);
  });
  check(() => {
    if (trackSelection.track_id === null) requireThat(trackSelection.alignment_status === 'unselected' && trackSelection.adopted_competencies.length === 0, 'TRACK_BINDING_INVALID', 'current-track.yaml', 'An unselected track cannot carry an aligned scope.');
    else {
      const track = tracks.find(item => item.id === trackSelection.track_id);
      requireThat(track && config.track_catalog_version === track.catalog_version && trackSelection.track_catalog_version === track.catalog_version && trackSelection.definition_digest === `sha256:${sha256(encode(track))}`, 'TRACK_BINDING_INVALID', 'current-track.yaml', 'Track selection and workspace config must pin the current catalog definition.');
      if (trackSelection.alignment_status === 'aligned') requireThat(canonical(trackSelection.adopted_competencies) === canonical(track.required_competencies) && canonical(profile.specialization_competencies) === canonical(track.required_competencies), 'TRACK_SCOPE_DRIFT', 'current-track.yaml', 'Aligned track competencies must match the pinned track and learner profile.');
    }
  });
  if (!advanced) check(() => {
    const cache = records.get('competencies.yaml')!;
    requireThat(cache.effective_level === 'E0' && cache.last_awarded_level === 'E0' && cache.standing === 'current' && ['entries', 'source_assessment_ids', 'source_review_ids', 'stale_record_ids'].every(k => canonical(cache[k]) === '[]'), 'CACHE_MISMATCH', 'competencies.yaml', 'Bootstrap cache must describe administrative E0 with no competency claims.');
    requireThat(profile.specialization_competencies.length === 0 && profile.self_report.length === 0, 'BOOTSTRAP_MISMATCH', 'profile.yaml', 'This initializer does not author self-report or specialization findings.');
    requireThat(canonical(config.principals.map((p: ObjectValue) => p.role)) === canonical(['learner', 'onboarding-coordinator', 'project-curator', 'peer-engineer', 'team-lead', 'manager']) && config.principals.every((p: ObjectValue) => p.retired_at === null), 'REGISTRY_INVALID', 'config.yaml', 'Bootstrap requires the six reviewed Phase 6 principals.');
  });
  return { records, diagnostics, advanced };
}
