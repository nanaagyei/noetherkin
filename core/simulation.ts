import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonical, encode, Failure, requireThat, sha256, type ObjectValue } from './common.js';
import { parse } from './parsing.js';
import { catalogs, collect, inspectRecords, schemaFor } from './validation.js';
import { digest, durable, exists, read, runtime, safePath, statePath, type Runtime } from './storage.js';
import { bindApprovedTransaction, makeTransaction, publishTransaction, type ActorRole, type BoundActor } from './transactions.js';
import { contextDigest, validateRoleOutput, type RoleAdapter, type RoleInvocationResult } from './adapters.js';
import { inspectSimulationSemantics, safeInvestigationGlob } from './semantics.js';
import { forgePack, packOnlyFields, upstreamPack } from './packs.js';

const assets = fileURLToPath(new URL('../../', import.meta.url));
const common = { schema_version: '3.0', data_class: 'live' };
const coreCompetencies = ['core.codebase-navigation', 'core.implementation', 'core.debugging', 'core.testing', 'core.technical-communication', 'core.ownership', 'core.git'];
const mapPath = statePath('knowledge/codebase-map.md');
const scopePath = statePath('knowledge/evaluation-scope.md');
const artifact = (relative: string, bytes: string | Buffer, description: string) => ({ uri: `workspace:/${relative}`, revision: `sha256:${sha256(bytes)}`, description });

function record(root: string, relative: string, rt: Runtime = runtime): ObjectValue {
  return parse(read(root, statePath(relative), rt), statePath(relative));
}
function actor(root: string, role: ActorRole, rt: Runtime = runtime): BoundActor {
  const config = record(root, 'config.yaml', rt);
  const principal = config.principals.find((item: ObjectValue) => item.role === role && item.retired_at === null);
  requireThat(principal, 'AUTHORITY_INVALID', role, `No active ${role} principal is registered.`);
  return { id: principal.id, role };
}
function publish(root: string, role: ActorRole, action: string, target: string, request: ObjectValue, writes: Map<string, string>, outputIds: string[], rt: Runtime = runtime): ObjectValue {
  const expected = Object.fromEntries([...writes.keys()].map(file => [file, digest(root, file, rt)]));
  const plan = makeTransaction(root, { operation_id: rt.id('OP'), actor: actor(root, role, rt), action, target, request, expected_read_digests: expected, output_record_ids: outputIds, writes, authorization_description: `Bound ${role} authorization for ${action}` }, rt);
  return publishTransaction(root, plan, bindApprovedTransaction(root, plan, true), files => validateSimulationCandidate(root, files, rt), rt);
}
export function validateSimulationCandidate(root: string, files: Map<string, string>, rt: Runtime = runtime): void {
  const records = collect(root, rt);
  for (const [file, bytes] of files) {
    if (!file.startsWith('.apprenticeship/')) continue;
    const relative = file.slice('.apprenticeship/'.length);
    if (schemaFor(relative)) records.set(relative, parse(bytes, file));
  }
  const result = inspectRecords(records, root, rt);
  const diagnostics = [...result.diagnostics, ...(result.advanced ? inspectSimulationSemantics(records, root, rt) : [])];
  requireThat(diagnostics.length === 0, 'CANDIDATE_INVALID', root, diagnostics.map(item => `${item.path}: ${item.message}`).join('; '));
}
function writeArtifact(root: string, category: string, bytes: string, description: string, rt: Runtime = runtime): ObjectValue {
  const hash = sha256(bytes);
  const relative = `apprenticeship-artifacts/${category}/${hash}.json`;
  if (!exists(safePath(root, relative, rt), rt)) durable(root, relative, bytes, rt, true);
  return artifact(relative, bytes, description);
}
function transition(task: ObjectValue, to: string, by: BoundActor, reason: string, at: string): void {
  task.transitions.push({ from: task.status, to, at, actor: by, reason });
  task.status = to;
  task.blocked_reason = null;
}
function taskFiles(root: string, rt: Runtime = runtime): string[] {
  const dir = safePath(root, statePath('work'), rt);
  if (!exists(dir, rt)) return [];
  return rt.fs.readdirSync(dir).filter(name => name.endsWith('.yaml')).sort();
}
export function currentTask(root: string, rt: Runtime = runtime): ObjectValue | undefined {
  const tasks = taskFiles(root, rt).map(file => record(root, `work/${file}`, rt));
  return tasks.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || String(a.id).localeCompare(String(b.id))).at(-1);
}

export async function onboard(root: string, constraints: string[], confirmed: boolean, adapter: RoleAdapter, rt: Runtime = runtime): Promise<ObjectValue> {
  requireThat(confirmed, 'CONSENT_REQUIRED', 'onboard', 'Learner confirmation is required to complete onboarding and agree the evaluation scope.');
  const profile = record(root, 'profile.yaml', rt);
  if (profile.onboarding === 'complete') return { outcome: 'no-change', baseline_assessment_id: profile.baseline_assessment_id };
  const teamLead = actor(root, 'team-lead', rt);
  const currentTrack = record(root, 'current-track.yaml', rt);
  requireThat(currentTrack.track_id && currentTrack.alignment_status === 'pending', 'TRACK_REQUIRED', 'current-track.yaml', 'Select a track before completing onboarding.');
  const track = catalogs().tracks.find(item => item.id === currentTrack.track_id);
  requireThat(track && currentTrack.definition_digest === `sha256:${sha256(encode(track))}`, 'TRACK_BINDING_INVALID', 'current-track.yaml', 'The selected track definition is unavailable or changed.');
  const competencies = [...coreCompetencies, ...track.required_competencies];
  const scopeText = `# Evaluation scope agreement\n\nLearner: ${profile.learner_id}\nTeam lead: ${teamLead.id}\nTrack: ${track.id} (${track.catalog_version})\nAgreed before the first review period: ${competencies.join(', ')}.\nEnvironment constraints: ${constraints.length ? constraints.join('; ') : 'none reported'}.\n`;
  let assessment = recordsByPrefix(root, 'assessments/', rt).find(item => item.kind === 'baseline' && item.learner_id === profile.learner_id && item.supersedes === null);
  let baselinePublication: ObjectValue | undefined;
  if (!assessment) {
    const result = await invoke(adapter, root, 'team-lead', 'team-lead', 'Establish the pre-task baseline and evaluation scope. There is no inspected learner work, so every listed competency must remain unassessed. Explain that limitation without inferring capability.', { learner_id: profile.learner_id, goals: profile.goals, environment_constraints: constraints, competencies }, ['rationale'], rt);
    requireThat(typeof result.output.rationale === 'string' && result.output.rationale.trim().length > 0, 'ADAPTER_INVALID', 'baseline', 'The team-lead baseline requires a rationale.');
    const assessmentId = rt.id('ASM'); const at = rt.now();
    assessment = { ...common, id: assessmentId, created_at: at, author: teamLead, kind: 'baseline', learner_id: profile.learner_id, project_id: null, evidence_ids: [], findings: competencies.map(competency_id => ({ competency_id, status: 'unassessed', demonstrated_level: null, evidence_ids: [], rationale: result.output.rationale })), supersedes: null, scope: 'longitudinal', task_id: null, design: null };
    const transcript = writeArtifact(root, 'role-transcripts', result.transcript, 'Bound team-lead baseline transcript', rt);
    const cache = record(root, 'competencies.yaml', rt);
    cache.generated_at = at; cache.source_assessment_ids = [assessmentId]; cache.entries = assessment.findings.map((finding: ObjectValue) => ({ competency_id: finding.competency_id, status: 'unassessed', demonstrated_level: null, evidence_ids: [], assessment_ids: [assessmentId] }));
    baselinePublication = publish(root, 'team-lead', 'establish-baseline', profile.learner_id, { constraints, transcript, evaluation_scope: competencies }, new Map([[statePath(`assessments/${assessmentId}.yaml`), encode(assessment)], [statePath('competencies.yaml'), encode(cache)], [scopePath, scopeText]]), [assessmentId], rt);
  }
  profile.specialization_competencies = track.required_competencies; profile.onboarding = 'complete'; profile.baseline_assessment_id = assessment.id;
  Object.assign(currentTrack, { alignment_status: 'aligned', adopted_competencies: track.required_competencies, scope_agreement: artifact(scopePath, scopeText, 'Learner and team-lead evaluation-scope agreement'), aligned_at: rt.now() });
  const completion = publish(root, 'onboarding-coordinator', 'complete-onboarding', profile.learner_id, { constraints, baseline_assessment_id: assessment.id, track_id: track.id }, new Map([[statePath('profile.yaml'), encode(profile)], [statePath('current-track.yaml'), encode(currentTrack)]]), [profile.learner_id, track.id], rt);
  return { outcome: 'success', baseline_publication: baselinePublication ?? null, ...completion, baseline_assessment_id: assessment.id };
}

function git(root: string, source: string, args: string[]): string {
  const run = spawnSync('git', ['-C', source, ...args], { cwd: root, encoding: 'utf8' });
  requireThat(run.status === 0, 'SOURCE_INVALID', source, (run.stderr || run.stdout || `git ${args[0]} failed`).trim());
  return run.stdout.trim();
}
function relativeSource(root: string, source: string): string {
  const resolved = fs.realpathSync(path.resolve(root, source));
  const relative = path.relative(root, resolved).split(path.sep).join('/');
  requireThat(relative && !relative.startsWith('../') && relative !== '.apprenticeship' && !relative.startsWith('.apprenticeship/'), 'UNSAFE_PATH', source, 'Source checkout must be inside the workspace and outside .apprenticeship.');
  return relative;
}
function normalizedRemote(value: string): string { return value.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '').replace(/\/$/, ''); }
export function inspectPetClinic(root: string, sourceInput: string, rt: Runtime = runtime): { source_path: string; revision: string } {
  return inspectCatalogProject(root, 'spring-petclinic-microservices', sourceInput, rt);
}
export function inspectCatalogProject(root: string, projectId: string, sourceInput: string, rt: Runtime = runtime): { source_path: string; revision: string } {
  const snapshot = statePath(`projects/${projectId}.yaml`);
  const project = exists(safePath(root, snapshot, rt), rt) ? parse(read(root, snapshot, rt), snapshot) : catalogs().projects.find(item => item.id === projectId);
  requireThat(project?.support?.attachable, 'PROJECT_UNAVAILABLE', projectId, 'The catalog project is not attachable.');
  const source_path = relativeSource(root, sourceInput);
  const source = safePath(root, source_path, rt);
  const remote = normalizedRemote(git(root, source, ['remote', 'get-url', 'origin']));
  requireThat(remote === normalizedRemote(project.repository_url), 'SOURCE_IDENTITY_MISMATCH', source_path, `Origin must match ${project.repository_url}.`);
  requireThat(git(root, source, ['status', '--porcelain']) === '', 'SOURCE_DIRTY', source_path, 'Attach or select a clean checkout; learner changes start after assignment.');
  const revision = git(root, source, ['rev-parse', 'HEAD']);
  requireThat(/^[a-f0-9]{40}$/.test(revision), 'SOURCE_INVALID', source_path, 'Git HEAD must resolve to a full commit SHA.');
  for (const packId of project.support.task_packs) for (const template of upstreamPack(packId)) assertTaskCompatibleSource(source, template);
  return { source_path, revision };
}
export function clonePetClinic(root: string, destination: string, revision = 'v3.4.1'): { source_path: string; revision: string } {
  return cloneCatalogProject(root, 'spring-petclinic-microservices', destination, revision);
}
export function cloneCatalogProject(root: string, projectId: string, destination: string, revision?: string): { source_path: string; revision: string } {
  const project = catalogs().projects.find(item => item.id === projectId);
  requireThat(project?.support?.attachable, 'PROJECT_UNAVAILABLE', projectId, 'The catalog project is not attachable.');
  const target = path.resolve(root, destination);
  requireThat(!fs.existsSync(target), 'SOURCE_CONFLICT', destination, 'Clone destination must be absent; partial clones are preserved for inspection.');
  const relative = path.relative(root, target).split(path.sep).join('/');
  requireThat(relative && !relative.startsWith('../'), 'UNSAFE_PATH', destination, 'Clone destination must be inside the workspace.');
  const args = ['clone', '--depth', '1']; if (revision) args.push('--branch', revision); args.push(project.repository_url, target);
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  requireThat(run.status === 0, 'CLONE_FAILED', relative, `${(run.stderr || run.stdout).trim()} Partial clone contents, if any, were preserved.`);
  return inspectCatalogProject(root, projectId, relative);
}
export function selectPetClinic(root: string, sourceInput: string, rt: Runtime = runtime): ObjectValue {
  return selectCatalogProject(root, 'spring-petclinic-microservices', sourceInput, rt);
}
export function selectCatalogProject(root: string, projectId: string, sourceInput: string, rt: Runtime = runtime): ObjectValue {
  const profile = record(root, 'profile.yaml', rt);
  requireThat(profile.onboarding === 'complete' && profile.baseline_assessment_id, 'PREREQUISITE_MISSING', 'profile.yaml', 'Complete onboarding and its baseline before selection.');
  const inspected = inspectCatalogProject(root, projectId, sourceInput, rt);
  const selection = record(root, 'current-project.yaml', rt);
  if (selection.project_id === projectId && selection.source_path === inspected.source_path && selection.source_revision === inspected.revision) return { outcome: 'no-change', selection };
  if (selection.project_id !== null) {
    const active = taskFiles(root, rt).map(file => record(root, `work/${file}`, rt)).filter(task => task.project_id === selection.project_id && !['completed', 'cancelled'].includes(task.status));
    requireThat(active.length === 0, 'PROJECT_SWITCH_BLOCKED', 'current-project.yaml', 'Complete or cancel active work before changing the selected project or checkout.');
  }
  const project = catalogs().projects.find(item => item.id === projectId);
  requireThat(project?.data_class === 'live' && project.support?.attachable && project.status !== 'deprecated', 'PROJECT_UNAVAILABLE', 'catalog', 'Project is not an attachable live catalog entry.');
  const at = rt.now();
  Object.assign(selection, { project_id: project.id, source_path: inspected.source_path, source_revision: inspected.revision, selected_at: at });
  if (selection.kind) selection.kind = 'upstream';
  const projectFile = statePath(`projects/${project.id}.yaml`); const writes = new Map<string, string>([[statePath('current-project.yaml'), encode(selection)]]);
  if (!exists(safePath(root, projectFile, rt), rt)) writes.set(projectFile, encode(project));
  return { outcome: 'success', ...publish(root, 'project-curator', 'select-project', project.id, inspected, writes, [project.id], rt), selection };
}

// ACP-015: a forge project binds an empty, learner-authored source directory. Nothing is cloned or fetched, and no
// commit is pinned because no code exists yet; the learner's own repository appears as they build it.
export function selectForge(root: string, forgeId: string, sourceInput: string, rt: Runtime = runtime): ObjectValue {
  const profile = record(root, 'profile.yaml', rt);
  requireThat(profile.onboarding === 'complete' && profile.baseline_assessment_id, 'PREREQUISITE_MISSING', 'profile.yaml', 'Complete onboarding and its baseline before selection.');
  const forge = catalogs().forges.find(item => item.id === forgeId);
  requireThat(forge && forge.data_class === 'live' && forge.status !== 'deprecated', 'PROJECT_UNAVAILABLE', forgeId, 'Not a selectable forge specification.');
  const target = path.resolve(root, sourceInput);
  const source_path = path.relative(root, target).split(path.sep).join('/');
  requireThat(source_path && !source_path.startsWith('../') && !path.isAbsolute(source_path) && source_path !== '.apprenticeship' && !source_path.startsWith('.apprenticeship/'), 'UNSAFE_PATH', sourceInput, 'Forge source must be inside the workspace and outside .apprenticeship.');
  const selection = record(root, 'current-project.yaml', rt);
  if (selection.kind === 'forge' && selection.project_id === forgeId && selection.source_path === source_path) return { outcome: 'no-change', selection };
  requireThat(!fs.existsSync(target) || (fs.lstatSync(target).isDirectory() && fs.readdirSync(target).length === 0), 'SOURCE_CONFLICT', source_path, 'A forge project starts from an empty directory; choose a new or empty path.');
  if (selection.project_id !== null) {
    const active = taskFiles(root, rt).map(file => record(root, `work/${file}`, rt)).filter(task => task.project_id === selection.project_id && !['completed', 'cancelled'].includes(task.status));
    requireThat(active.length === 0, 'PROJECT_SWITCH_BLOCKED', 'current-project.yaml', 'Complete or cancel active work before changing the selected project.');
  }
  fs.mkdirSync(target, { recursive: true });
  Object.assign(selection, { kind: 'forge', project_id: forge.id, source_path, source_revision: null, selected_at: rt.now() });
  const snapshot = statePath(`forge/${forge.id}.yaml`); const writes = new Map<string, string>([[statePath('current-project.yaml'), encode(selection)]]);
  if (!exists(safePath(root, snapshot, rt), rt)) writes.set(snapshot, encode(forge));
  return { outcome: 'success', ...publish(root, 'project-curator', 'select-forge', forge.id, { source_path, forge_status: forge.status }, writes, [forge.id], rt), selection, status_note: forge.status === 'draft' ? 'This forge specification is a draft: it has not yet been built end to end against its own task pack.' : null };
}

// ACP-016: the template is derived from the bound project. The five section headings are unchanged, so a map
// written under the earlier PetClinic template still passes the same check.
const mapSections = ['Service boundaries', 'Startup order', 'One request path', 'Tests and feedback loop', 'Unknowns and risks'];
function mapTemplate(projectName: string, sourcePath: string): string {
  return `# ${projectName} codebase map\n\nReplace every prompt below with your own source-backed explanation. Use at least three \`${sourcePath}/...\` citations.\n\n## Service boundaries\n[PROMPT: Which components or services own which responsibilities?]\n\n## Startup order\n[PROMPT: What must build or start first, and why?]\n\n## One request path\n[PROMPT: Trace one request or data flow across concrete source files.]\n\n## Tests and feedback loop\n[PROMPT: Where are the focused tests and how will you run them?]\n\n## Unknowns and risks\n[PROMPT: What remains uncertain, and how would you investigate it?]\n`;
}
export function initMap(root: string, rt: Runtime = runtime): ObjectValue {
  const selection = record(root, 'current-project.yaml', rt);
  requireThat(selection.project_id, 'PREREQUISITE_MISSING', 'current-project.yaml', 'Select a project before creating its map.');
  if (exists(safePath(root, mapPath, rt), rt)) return { outcome: 'no-change', path: mapPath };
  const project = record(root, `projects/${selection.project_id}.yaml`, rt);
  return { outcome: 'success', ...publish(root, 'learner', 'initialize-codebase-map', selection.project_id, {}, new Map([[mapPath, mapTemplate(project.name, selection.source_path)]]), [], rt), path: mapPath };
}
function evaluateMap(root: string, rt: Runtime): { text: string; selection: ObjectValue; missing: string[]; citations: string[]; complete: boolean } {
  const text = read(root, mapPath, rt).toString('utf8');
  const selection = record(root, 'current-project.yaml', rt);
  const missing = mapSections.filter(section => !new RegExp(`## ${section}\\n(?!\\[PROMPT:)`, 'm').test(text));
  const cited = [...text.matchAll(/`([^`]+)`/g)].map(match => match[1]!).filter(value => value.startsWith(`${selection.source_path}/`));
  const citations = [...new Set(cited)].filter(value => { try { return fs.statSync(safePath(root, value, rt)).isFile(); } catch { return false; } });
  return { text, selection, missing, citations, complete: !text.includes('[PROMPT:') && missing.length === 0 && citations.length >= 3 };
}
// The checked artifact binds the map text to the source revision it was checked against, so a moved checkout or an
// edited map is detectable without any new canonical field.
function mapArtifactBytes(text: string, sourceRevision: string | null): string { return encode({ source_path: mapPath, source_revision: sourceRevision, content: text }); }
export function checkMap(root: string, rt: Runtime = runtime): ObjectValue {
  const { text, selection, citations, complete } = evaluateMap(root, rt);
  requireThat(complete, 'MAP_INCOMPLETE', mapPath, `Replace every prompt and cite at least three existing ${selection.source_path}/... files.`);
  const mapArtifact = writeArtifact(root, 'maps', mapArtifactBytes(text, selection.source_revision), 'Immutable learner-authored codebase map', rt);
  return { outcome: 'success', path: mapPath, revision: `sha256:${sha256(text)}`, source_revision: selection.source_revision, artifact: mapArtifact, citations };
}
// Read-only pointer for skills (ACP-016). "checked" means this exact text was checked at the current source revision;
// "unchecked" means it would pass but has not been checked here, including after the checkout moved. A map is the
// learner's claim, never verified fact: its citations tell a skill what the map covers, and source wins on conflict.
export function mapStatus(root: string, rt: Runtime = runtime): ObjectValue {
  const selection = record(root, 'current-project.yaml', rt);
  const base = { path: mapPath, project_id: selection.project_id, source_revision: selection.source_revision };
  if (!selection.project_id || !exists(safePath(root, mapPath, rt), rt)) return { ...base, status: 'absent', covered_paths: [] };
  const { text, missing, citations, complete } = evaluateMap(root, rt);
  if (!complete) return { ...base, status: 'incomplete', missing_sections: missing, covered_paths: citations };
  const artifactPath = `apprenticeship-artifacts/maps/${sha256(mapArtifactBytes(text, selection.source_revision))}.json`;
  const checked = exists(safePath(root, artifactPath, rt), rt);
  return { ...base, status: checked ? 'checked' : 'unchecked', revision: `sha256:${sha256(text)}`, artifact: checked ? artifact(artifactPath, mapArtifactBytes(text, selection.source_revision), 'Immutable learner-authored codebase map') : null, covered_paths: citations };
}
// Resolves the current task's frozen investigation globs inside the bound source (ACP-016). Matches that resolve
// outside the source root, including through a symlink, are reported as rejected and never returned as in scope.
export function investigationScope(root: string, rt: Runtime = runtime): ObjectValue {
  const task = currentTask(root, rt);
  requireThat(task, 'PREREQUISITE_MISSING', 'work', 'No active task has an investigation scope.');
  const globs: string[] = task.investigation_paths ?? [];
  if (!globs.length) return { task_id: task.id, investigation_areas: task.investigation_areas, investigation_paths: [], paths: [], rejected: [], scoped: false };
  const selection = record(root, 'current-project.yaml', rt);
  const source = fs.realpathSync(safePath(root, selection.source_path, rt));
  const paths = new Set<string>(); const rejected = new Set<string>();
  for (const glob of globs) {
    requireThat(safeInvestigationGlob(glob), 'UNSAFE_PATH', glob, 'Investigation path must be relative to the source root without traversal.');
    for (const match of fs.globSync(glob, { cwd: source })) {
      const resolved = fs.realpathSync(path.join(source, match));
      if (resolved !== source && !resolved.startsWith(source + path.sep)) rejected.add(match);
      else if (fs.statSync(resolved).isFile()) paths.add(match.split(path.sep).join('/'));
    }
  }
  return { task_id: task.id, investigation_areas: task.investigation_areas, investigation_paths: globs, paths: [...paths].sort(), rejected: [...rejected].sort(), scoped: true };
}
// The ordered templates available to the current selection: a forge pack in sequence, or an upstream project's
// curated packs. Empty means the project has no bundled content and uses portable task assignment.
function packTemplates(root: string, rt: Runtime): ObjectValue[] {
  const selection = record(root, 'current-project.yaml', rt);
  if (!selection.project_id) return [];
  if (selection.kind === 'forge') return record(root, `forge/${selection.project_id}.yaml`, rt).task_packs.flatMap((packId: string) => forgePack(packId));
  return (catalogs().projects.find(item => item.id === selection.project_id)?.support?.task_packs ?? []).flatMap((packId: string) => upstreamPack(packId));
}
function projectTasks(root: string, projectId: string, rt: Runtime): ObjectValue[] {
  return taskFiles(root, rt).map(file => record(root, `work/${file}`, rt)).filter(task => task.project_id === projectId).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
// Tasks are assigned from a pack in order, one at a time, so a task's position among its project's tasks names its template.
function templateForTask(root: string, task: ObjectValue, rt: Runtime): ObjectValue {
  const position = projectTasks(root, task.project_id, rt).findIndex(item => item.id === task.id);
  const template = packTemplates(root, rt)[position];
  requireThat(template, 'TASK_PACK_MISSING', task.id, 'The task no longer resolves to a template in the bound pack.');
  return template;
}
function nextTaskPreview(root: string, task: ObjectValue, rt: Runtime): unknown {
  return templateForTask(root, task, rt).next_task_preview ?? null;
}
function assertTaskCompatibleSource(source: string, template: ObjectValue): void {
  for (const file of template.compatibility.required_files) requireThat(fs.existsSync(path.join(source, file)), 'TASK_INCOMPATIBLE', file, 'Selected revision does not contain the Phase 6 task surface.');
  const combined = template.compatibility.required_files.map((file: string) => fs.readFileSync(path.join(source, file), 'utf8')).join('\n');
  for (const fragment of template.compatibility.required_fragments) requireThat(combined.includes(fragment), 'TASK_INCOMPATIBLE', fragment, 'Selected revision does not match the task compatibility contract.');
}
function assertTaskCompatible(root: string, template: ObjectValue, rt: Runtime): void {
  const selection = record(root, 'current-project.yaml', rt);
  if (selection.kind === 'forge') return; // A forge layout is the learner's design; path probes would dictate it.
  assertTaskCompatibleSource(safePath(root, selection.source_path, rt), template);
}
export function assignTask(root: string, rt: Runtime = runtime): ObjectValue {
  const selection = record(root, 'current-project.yaml', rt);
  requireThat(selection.project_id, 'PREREQUISITE_MISSING', 'current-project.yaml', 'Select a project before assigning a task.');
  const prior = currentTask(root, rt);
  if (prior && prior.status !== 'completed') return { outcome: 'no-change', task_id: prior.id, status: prior.status };
  const templates = packTemplates(root, rt);
  requireThat(templates.length, 'TASK_PACK_MISSING', selection.project_id, 'This project has no bundled task pack; use the portable task-assignment skill.');
  const template = templates[projectTasks(root, selection.project_id, rt).length];
  if (!template) return { outcome: 'no-change', task_id: prior?.id ?? null, status: prior?.status ?? null, pack_complete: true };
  // An upstream codebase is mapped before the first task; a forge project has nothing to map yet (ACP-015).
  const checkedMap = selection.kind === 'forge' ? null : checkMap(root, rt);
  assertTaskCompatible(root, template, rt);
  const id = rt.id('TASK'); const at = rt.now(); const teamLead = actor(root, 'team-lead', rt);
  const assignment = Object.fromEntries(Object.entries(template).filter(([key]) => !packOnlyFields.includes(key)));
  const task = { ...common, id, created_at: at, author: teamLead, ...assignment, project_id: selection.project_id, status: 'assigned', assigned_by: teamLead, assistance_history: [], blocked_reason: null, completion_evidence_ids: [], validation: [], transitions: [{ from: 'absent', to: 'backlog', at, actor: teamLead, reason: `Instantiated curated template ${template.id}.` }, { from: 'backlog', to: 'assigned', at, actor: teamLead, reason: 'Team lead assigned the learner-local training task.' }], work_artifact: null, design_artifact: null, design_assessment_id: null };
  return { outcome: 'success', ...publish(root, 'team-lead', 'assign-task', id, { template: template.id, map: checkedMap?.artifact ?? null }, new Map([[statePath(`work/${id}.yaml`), encode(task)]]), [id], rt), task_id: id, investigation_prompt: template.investigation_prompt ?? `Read the specification and task "${template.title}", predict how you will know it works, and design before writing code.` };
}
export function beginTask(root: string, rt: Runtime = runtime): ObjectValue {
  const task = currentTask(root, rt); requireThat(task?.status === 'assigned', 'TASK_STATE_INVALID', 'task', 'The current task must be assigned.');
  const learner = actor(root, 'learner', rt); const at = rt.now(); transition(task, 'investigating', learner, 'Learner began source investigation.', at); transition(task, 'designing', learner, 'The assignment requires a learner-authored design.', at);
  return { outcome: 'success', ...publish(root, 'learner', 'begin-task', task.id, {}, new Map([[statePath(`work/${task.id}.yaml`), encode(task)]]), [task.id], rt), task_id: task.id };
}

async function invoke(adapter: RoleAdapter, root: string, role: ActorRole, skill: any, objective: string, context: ObjectValue, outputKeys: string[], rt: Runtime): Promise<RoleInvocationResult> {
  const result = await adapter.invoke({ workspace: root, operation_id: rt.id('OP'), actor: actor(root, role, rt), skill, objective, context, context_digest: contextDigest(context), output_keys: outputKeys });
  requireThat(result.context_digest === contextDigest(context), 'CONTEXT_CHANGED', skill, 'Role result is not bound to the supplied context packet.');
  validateRoleOutput(result, outputKeys);
  return result;
}
export async function submitDesign(root: string, designInput: string, adapter: RoleAdapter, rt: Runtime = runtime): Promise<ObjectValue> {
  const task = currentTask(root, rt);
  if (task?.status === 'implementing' && task.design_assessment_id) return { outcome: 'no-change', task_id: task.id, design_assessment_id: task.design_assessment_id };
  requireThat(task?.status === 'designing', 'TASK_STATE_INVALID', 'task', 'The task must be in designing.');
  const relative = path.relative(root, fs.realpathSync(path.resolve(root, designInput))).split(path.sep).join('/');
  requireThat(relative && !relative.startsWith('../'), 'UNSAFE_PATH', designInput, 'Design artifact must be inside the workspace.');
  const bytes = fs.readFileSync(path.join(root, relative));
  const designArtifact = writeArtifact(root, 'designs', encode({ source_path: relative, content: bytes.toString('utf8') }), 'Immutable learner-authored design for the pet-type integrity task', rt);
  const existing = task.design_assessment_id ? record(root, `assessments/${task.design_assessment_id}.yaml`, rt) : undefined;
  let decision: string; let rationale: string; let risks: unknown[]; let reviewPublication: ObjectValue | undefined;
  if (existing && canonical(existing.design?.artifact) === canonical(designArtifact)) {
    decision = existing.design.decision; rationale = existing.findings[0].rationale; risks = [];
  } else {
    const result = await invoke(adapter, root, 'team-lead', 'team-lead', 'Review this learner-authored design. Approve only if it states an observable contract, a concrete alternative and trade-off, tests, and a first likely failure case.', { task: frozenTask(task), design: bytes.toString('utf8'), artifact: designArtifact }, ['decision', 'rationale', 'risks'], rt);
    requireThat(['approve', 'rework', 'insufficient-evidence'].includes(result.output.decision) && typeof result.output.rationale === 'string' && Array.isArray(result.output.risks), 'ADAPTER_INVALID', 'design', 'Invalid design decision output.');
    decision = result.output.decision; rationale = result.output.rationale; risks = result.output.risks;
    const transcript = writeArtifact(root, 'role-transcripts', result.transcript, 'Bound team-lead design-review transcript', rt);
    const assessmentId = rt.id('ASM'); const at = rt.now();
    const assessment = { ...common, id: assessmentId, created_at: at, author: actor(root, 'team-lead', rt), kind: 'technical', learner_id: record(root, 'profile.yaml', rt).learner_id, project_id: task.project_id, evidence_ids: [], findings: [{ competency_id: 'core.implementation', status: 'unassessed', demonstrated_level: null, evidence_ids: [], rationale }], supersedes: null, scope: 'checkpoint', task_id: task.id, design: { artifact: designArtifact, decision } };
    task.design_artifact = designArtifact; task.design_assessment_id = assessmentId;
    if (decision !== 'approve') task.blocked_reason = `Design ${decision}: ${rationale}`;
    reviewPublication = publish(root, 'team-lead', 'review-design', task.id, { design: designArtifact, transcript }, new Map([[statePath(`assessments/${assessmentId}.yaml`), encode(assessment)], [statePath(`work/${task.id}.yaml`), encode(task)]]), [assessmentId, task.id], rt);
  }
  if (decision === 'approve') {
    const reviewedTask = currentTask(root, rt)!;
    transition(reviewedTask, 'implementing', actor(root, 'team-lead', rt), 'Exact learner design received team-lead approval.', rt.now());
    const gatePublication = publish(root, 'team-lead', 'open-implementation-gate', reviewedTask.id, { design_assessment_id: reviewedTask.design_assessment_id }, new Map([[statePath(`work/${reviewedTask.id}.yaml`), encode(reviewedTask)]]), [reviewedTask.id], rt);
    return { outcome: 'success', review_publication: reviewPublication ?? null, ...gatePublication, decision, rationale, risks };
  }
  return { outcome: 'rework', ...(reviewPublication ?? {}), decision, rationale, risks };
}
function frozenTask(task: ObjectValue): ObjectValue {
  const copy = structuredClone(task); delete copy.assistance_history; delete copy.transitions; delete copy.validation; return copy;
}
function gitDiff(root: string, source: string): string {
  const diff = spawnSync('git', ['-C', source, 'diff', '--binary', 'HEAD'], { encoding: 'utf8' });
  requireThat(diff.status === 0, 'SOURCE_INVALID', source, diff.stderr);
  const untracked = git(root, source, ['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  let output = diff.stdout;
  for (const file of untracked) {
    const extra = spawnSync('git', ['-C', source, 'diff', '--no-index', '--binary', '--', '/dev/null', file], { encoding: 'utf8' });
    requireThat(extra.status === 0 || extra.status === 1, 'SOURCE_INVALID', file, extra.stderr); output += extra.stdout;
  }
  return output;
}
// A forge learner wrote the whole system, so its snapshot is every non-ignored file rather than a diff against an
// upstream base. The learner's own Git repository supplies the ignore rules; no commit is required.
function forgeTree(root: string, source: string): ObjectValue[] {
  requireThat(fs.existsSync(path.join(source, '.git')), 'SOURCE_INVALID', source, 'Initialize your own Git repository in the forge source directory (git init) before submitting.');
  const listed = spawnSync('git', ['-C', source, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' });
  requireThat(listed.status === 0, 'SOURCE_INVALID', source, listed.stderr);
  return [...new Set(listed.stdout.split('\0').filter(Boolean))].sort().filter(file => fs.lstatSync(path.join(source, file)).isFile()).map(file => {
    const bytes = fs.readFileSync(path.join(source, file)); const text = bytes.toString('utf8');
    return Buffer.from(text, 'utf8').equals(bytes) ? { path: file, encoding: 'utf8', content: text } : { path: file, encoding: 'base64', content: bytes.toString('base64') };
  });
}
function changeManifest(root: string, task: ObjectValue, rt: Runtime): string {
  const selection = record(root, 'current-project.yaml', rt); const source = safePath(root, selection.source_path, rt);
  if (selection.kind === 'forge') return encode({ task_id: task.id, kind: 'forge', files: forgeTree(root, source) });
  requireThat(git(root, source, ['rev-parse', 'HEAD']) === selection.source_revision, 'SOURCE_REVISION_CHANGED', selection.source_path, 'Base commit changed after project selection.');
  return encode({ task_id: task.id, base_revision: selection.source_revision, diff: gitDiff(root, source) });
}
export function submitChange(root: string, rt: Runtime = runtime): ObjectValue {
  const task = currentTask(root, rt); requireThat(task?.status === 'implementing', 'TASK_STATE_INVALID', 'task', 'The task must have an approved design and be implementing.');
  const selection = record(root, 'current-project.yaml', rt);
  const manifest = changeManifest(root, task, rt); const parsed = JSON.parse(manifest);
  requireThat(selection.kind === 'forge' ? parsed.files.length > 0 : parsed.diff.trim().length > 0, 'CHANGE_MISSING', selection.source_path, 'No learner change is available to submit.');
  const change = writeArtifact(root, 'changes', manifest, 'Immutable learner change snapshot', rt);
  task.work_artifact = change; transition(task, 'testing', actor(root, 'learner', rt), 'Learner submitted a content-addressed change snapshot.', rt.now());
  return { outcome: 'success', ...publish(root, 'learner', 'submit-change', task.id, { change }, new Map([[statePath(`work/${task.id}.yaml`), encode(task)]]), [task.id], rt), task_id: task.id, change };
}

function assertCurrentWork(root: string, task: ObjectValue, rt: Runtime): void {
  const selection = record(root, 'current-project.yaml', rt);
  const expected = changeManifest(root, task, rt);
  requireThat(`sha256:${sha256(expected)}` === task.work_artifact.revision, 'WORK_REVISION_CHANGED', selection.source_path, 'Working tree changed after the submitted snapshot; submit and test the new revision.');
}

function latestArtifact(root: string, category: string, rt: Runtime = runtime): ObjectValue | undefined {
  const dir = safePath(root, `apprenticeship-artifacts/${category}`, rt); if (!exists(dir, rt)) return undefined;
  const files = fs.readdirSync(dir).filter(file => file.endsWith('.json')).map(file => ({ file, at: fs.statSync(path.join(dir, file)).mtimeMs })).sort((a, b) => b.at - a.at);
  if (!files[0]) return undefined; const bytes = fs.readFileSync(path.join(dir, files[0].file)); return artifact(`apprenticeship-artifacts/${category}/${files[0].file}`, bytes, `Captured ${category} artifact`);
}
// A curated upstream template fixes its focused command. A forge learner chose the runner and layout, so they
// declare the command they already named in their design; it is recorded verbatim with its output.
export function testTask(root: string, prediction: string, rt: Runtime = runtime, command?: string): ObjectValue {
  const task = currentTask(root, rt); requireThat(task?.status === 'testing' && task.work_artifact, 'TASK_STATE_INVALID', 'task', 'Submit the change before testing.');
  requireThat(prediction.trim().length > 0, 'INPUT_REQUIRED', 'prediction', 'State your predicted result before the run.');
  assertCurrentWork(root, task, rt);
  const selection = record(root, 'current-project.yaml', rt); const source = safePath(root, selection.source_path, rt);
  const fixed = templateForTask(root, task, rt).focused_test;
  requireThat(fixed ? command === undefined : typeof command === 'string' && command.trim().length > 0, 'INPUT_REQUIRED', 'command', fixed ? 'This curated task fixes its focused test command.' : 'Declare the test command your design names with --command.');
  const started = rt.now();
  const run = fixed ? spawnSync(path.join(source, fixed.program), fixed.args, { cwd: source, encoding: 'utf8', timeout: 900_000, maxBuffer: 20 * 1024 * 1024 })
    : spawnSync('/bin/sh', ['-c', command!], { cwd: source, encoding: 'utf8', timeout: 900_000, maxBuffer: 20 * 1024 * 1024 });
  const observed = { task_id: task.id, work_revision: task.work_artifact.revision, base_revision: selection.source_revision, command: fixed ? [fixed.program, ...fixed.args].join(' ') : command, prediction, started_at: started, completed_at: rt.now(), exit_code: run.status, signal: run.signal, stdout: run.stdout, stderr: run.stderr };
  const testArtifact = writeArtifact(root, 'test-runs', encode(observed), 'Observed focused test run', rt);
  if (run.status === 0) transition(task, 'code-review', actor(root, 'learner', rt), `Focused tests passed; artifact ${testArtifact.uri}.`, observed.completed_at);
  else transition(task, 'implementing', actor(root, 'learner', rt), `Focused tests did not pass; artifact ${testArtifact.uri}.`, observed.completed_at);
  return { outcome: run.status === 0 ? 'success' : 'rework', ...publish(root, 'learner', 'record-test-run', task.id, { test_artifact: testArtifact, exit_code: run.status }, new Map([[statePath(`work/${task.id}.yaml`), encode(task)]]), [task.id], rt), test_artifact: testArtifact, exit_code: run.status };
}

// Some criteria can only be met by another person, such as an outside quickstart. The controller cannot observe
// that, so the learner records what happened against the exact work revision; task review requires the record and
// cites it. A recorded attestation is the learner's attributable claim, and a false one is fabricated evidence.
export function attestCriterion(root: string, criterionId: string, notesFile: string, rt: Runtime = runtime): ObjectValue {
  const task = currentTask(root, rt); requireThat(task?.work_artifact && ['testing', 'code-review'].includes(task.status), 'TASK_STATE_INVALID', 'task', 'Attest against a submitted work revision.');
  requireThat((templateForTask(root, task, rt).attested_criteria ?? []).includes(criterionId), 'INPUT_INVALID', criterionId, 'This criterion does not take an attestation.');
  const notes = fs.readFileSync(path.resolve(notesFile), 'utf8');
  requireThat(notes.trim().length >= 40, 'INPUT_REQUIRED', notesFile, 'Record who performed the check, what they did and where they got stuck.');
  const attestation = writeArtifact(root, 'attestations', encode({ task_id: task.id, criterion_id: criterionId, work_revision: task.work_artifact.revision, recorded_by: actor(root, 'learner', rt), notes }), `Learner-recorded attestation for ${criterionId}`, rt);
  return { outcome: 'success', task_id: task.id, criterion_id: criterionId, attestation };
}
function attestationFor(root: string, task: ObjectValue, criterionId: string, rt: Runtime): ObjectValue | undefined {
  const dir = safePath(root, 'apprenticeship-artifacts/attestations', rt); if (!exists(dir, rt)) return undefined;
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const bytes = fs.readFileSync(path.join(dir, file)); const value = JSON.parse(bytes.toString('utf8'));
    if (value.task_id === task.id && value.criterion_id === criterionId && value.work_revision === task.work_artifact.revision) return artifact(`apprenticeship-artifacts/attestations/${file}`, bytes, `Learner-recorded attestation for ${criterionId}`);
  }
  return undefined;
}

export async function requestHelp(root: string, question: string, adapter: RoleAdapter, rt: Runtime = runtime): Promise<ObjectValue> {
  const task = currentTask(root, rt); requireThat(task && !['completed', 'cancelled'].includes(task.status), 'TASK_STATE_INVALID', 'task', 'Help requires an active task.');
  const result = await invoke(adapter, root, 'peer-engineer', 'peer-engineer', 'Give the smallest useful investigation help. Separate facts from hypotheses, suggest one discriminator, and do not implement the task.', { task: frozenTask(task), question }, ['response', 'assistance_level', 'competencies'], rt);
  requireThat(typeof result.output.response === 'string' && Number.isInteger(result.output.assistance_level) && result.output.assistance_level >= 1 && result.output.assistance_level <= 7 && Array.isArray(result.output.competencies), 'ADAPTER_INVALID', 'help', 'Invalid peer-help output.');
  const transcript = writeArtifact(root, 'role-transcripts', result.transcript, 'Bound peer-help transcript', rt); const at = rt.now(); const peer = actor(root, 'peer-engineer', rt);
  task.assistance_history.push({ at, level: result.output.assistance_level, competencies: result.output.competencies, description: result.output.response, artifact: transcript, id: rt.id('HELP'), recorder: peer, provider: { kind: 'registered', principal_id: peer.id, label: 'Phase 6 peer engineer' }, recorded_at: at, supersedes: null });
  return { outcome: 'success', ...publish(root, 'peer-engineer', 'record-help', task.id, { question, transcript }, new Map([[statePath(`work/${task.id}.yaml`), encode(task)]]), [task.id], rt), response: result.output.response, assistance_level: result.output.assistance_level };
}

function readArtifact(root: string, value: ObjectValue): string { return read(root, value.uri.slice('workspace:/'.length)).toString('utf8'); }
export async function codeReview(root: string, adapter: RoleAdapter, rt: Runtime = runtime): Promise<ObjectValue> {
  const task = currentTask(root, rt); requireThat(task?.status === 'code-review' && task.work_artifact, 'TASK_STATE_INVALID', 'task', 'A tested submitted change is required for code review.');
  assertCurrentWork(root, task, rt);
  const testArtifact = latestArtifact(root, 'test-runs', rt); requireThat(testArtifact, 'EVIDENCE_MISSING', 'test-runs', 'No captured test run exists.');
  const observedTest = JSON.parse(readArtifact(root, testArtifact));
  requireThat(observedTest.task_id === task.id && observedTest.work_revision === task.work_artifact.revision && observedTest.exit_code === 0, 'EVIDENCE_STALE', 'test-runs', 'The latest focused test must pass for the exact submitted work revision.');
  const result = await invoke(adapter, root, 'peer-engineer', 'code-review', 'Review the exact change against every criterion and the observed test run. Approve only when evidence supports the current revision.', { task: frozenTask(task), design: readArtifact(root, task.design_artifact), change: readArtifact(root, task.work_artifact), test_run: readArtifact(root, testArtifact), assistance: task.assistance_history }, ['outcome', 'findings'], rt);
  requireThat(['approve', 'changes-requested', 'insufficient-evidence'].includes(result.output.outcome) && Array.isArray(result.output.findings) && result.output.findings.length, 'ADAPTER_INVALID', 'code-review', 'Invalid code review output.');
  const peer = actor(root, 'peer-engineer', rt); const at = rt.now(); const evidenceId = rt.id('EVID'); const reviewId = rt.id('REV');
  const highest = task.assistance_history.length ? Math.max(...task.assistance_history.map((item: ObjectValue) => item.level)) : 0;
  const evidence = { ...common, id: evidenceId, created_at: at, author: peer, project_id: task.project_id, task_id: task.id, competency_id: 'core.implementation', fact: { observation: 'Peer inspected the submitted change and captured focused test artifact.', observed_at: at, artifacts: [task.work_artifact, testArtifact] }, scope: task.scope, difficulty: task.difficulty, assistance: { known: true, highest_level: highest, events: task.assistance_history }, verification: { status: 'unverified', method: 'Peer inspection; formal team-lead verification remains pending.', reviewer: peer, checked_at: at }, interpretation: { independence: highest === 0 ? 'independent' : 'guided', direction: result.output.outcome === 'approve' ? 'supporting' : 'neutral', target_level: 'E1', strength: 'weak', rationale: 'A single peer-reviewed task is provisional and cannot establish longitudinal capability.' }, supersedes: null };
  const review = { ...common, id: reviewId, created_at: at, author: peer, kind: 'code', subject_id: task.id, evidence_ids: [evidenceId], assessment_ids: [], period: { start: task.created_at, end: at }, findings: result.output.findings, outcome: result.output.outcome, supersedes: null, change: task.work_artifact };
  if (result.output.outcome !== 'approve') transition(task, 'implementing', peer, `Code review outcome: ${result.output.outcome}.`, at);
  const transcript = writeArtifact(root, 'role-transcripts', result.transcript, 'Bound code-review transcript', rt);
  const writes = new Map([[statePath(`evidence/${evidenceId}.yaml`), encode(evidence)], [statePath(`reviews/code/${reviewId}.yaml`), encode(review)], [statePath(`work/${task.id}.yaml`), encode(task)]]);
  return { outcome: result.output.outcome === 'approve' ? 'success' : 'rework', ...publish(root, 'peer-engineer', 'code-review', task.id, { change: task.work_artifact, test: testArtifact, transcript }, writes, [evidenceId, reviewId, task.id], rt), review_id: reviewId, review_outcome: result.output.outcome, findings: result.output.findings };
}

function recordsByPrefix(root: string, prefix: string, rt: Runtime): ObjectValue[] { return [...collect(root, rt)].filter(([file]) => file.startsWith(prefix)).map(([, value]) => value); }
export async function taskReview(root: string, adapter: RoleAdapter, rt: Runtime = runtime): Promise<ObjectValue> {
  const task = currentTask(root, rt);
  if (task?.status === 'completed') {
    const existing = recordsByPrefix(root, 'reviews/task/', rt).filter(item => item.subject_id === task.id && item.outcome === 'accepted').at(-1);
    return { outcome: 'no-change', task_id: task.id, review_id: existing?.id ?? null, evidence_ids: task.completion_evidence_ids, next_task_preview: nextTaskPreview(root, task, rt) };
  }
  requireThat(task?.status === 'code-review' && task.work_artifact, 'TASK_STATE_INVALID', 'task', 'Task review requires a current approved code review.');
  assertCurrentWork(root, task, rt);
  const code = recordsByPrefix(root, 'reviews/code/', rt).filter(item => item.subject_id === task.id).at(-1);
  requireThat(code?.outcome === 'approve' && canonical(code.change) === canonical(task.work_artifact), 'REVIEW_MISSING', 'code-review', 'Current work revision lacks an approved code review.');
  const provisional = recordsByPrefix(root, 'evidence/', rt).filter(item => item.task_id === task.id).at(-1); const testArtifact = latestArtifact(root, 'test-runs', rt); requireThat(provisional && testArtifact, 'EVIDENCE_MISSING', 'task', 'Task review inputs are incomplete.');
  const attestations = Object.fromEntries((templateForTask(root, task, rt).attested_criteria ?? []).map((criterionId: string) => [criterionId, attestationFor(root, task, criterionId, rt)]));
  const unattested = Object.entries(attestations).filter(([, value]) => !value).map(([criterionId]) => criterionId);
  requireThat(unattested.length === 0, 'ATTESTATION_MISSING', 'task', `Record ${unattested.join(', ')} with task attest before task review; the controller cannot observe another person's check.`);
  const result = await invoke(adapter, root, 'team-lead', 'team-lead', 'Validate every frozen criterion, inspect the exact code review and test observation, and return accepted only if all are supported.', { task: frozenTask(task), design: readArtifact(root, task.design_artifact), change: readArtifact(root, task.work_artifact), code_review: code, provisional_evidence: provisional, test_run: JSON.parse(readArtifact(root, testArtifact)), attestations: Object.fromEntries(Object.entries(attestations).map(([criterionId, value]) => [criterionId, JSON.parse(readArtifact(root, value!))])) }, ['outcome', 'findings', 'evidence_rationale'], rt);
  requireThat(['accepted', 'rework', 'insufficient-evidence'].includes(result.output.outcome) && Array.isArray(result.output.findings) && typeof result.output.evidence_rationale === 'string', 'ADAPTER_INVALID', 'task-review', 'Invalid task review output.');
  if (result.output.outcome !== 'accepted') {
    transition(task, 'implementing', actor(root, 'team-lead', rt), `Task review outcome: ${result.output.outcome}.`, rt.now());
    return { outcome: 'rework', ...publish(root, 'team-lead', 'task-review-rework', task.id, { outcome: result.output.outcome }, new Map([[statePath(`work/${task.id}.yaml`), encode(task)]]), [task.id], rt), findings: result.output.findings };
  }
  const lead = actor(root, 'team-lead', rt); const at = rt.now(); const implementationId = rt.id('EVID'); const testingId = rt.id('EVID'); const reviewId = rt.id('REV');
  const highest = task.assistance_history.length ? Math.max(...task.assistance_history.map((item: ObjectValue) => item.level)) : 0;
  const baseEvidence = { ...common, created_at: at, author: lead, project_id: task.project_id, task_id: task.id, scope: task.scope, difficulty: task.difficulty, assistance: { known: true, highest_level: highest, events: task.assistance_history }, verification: { status: 'verified', method: 'Team lead inspected the exact change, code review, and captured test result.', reviewer: lead, checked_at: at } };
  const implementation = { ...baseEvidence, id: implementationId, competency_id: 'core.implementation', fact: { observation: `Learner submitted the reviewed change satisfying the bounded implementation contract of ${task.title}.`, observed_at: at, artifacts: [task.work_artifact] }, interpretation: { independence: highest === 0 ? 'independent' : 'guided', direction: 'supporting', target_level: 'E1', strength: 'moderate', rationale: result.output.evidence_rationale }, supersedes: provisional.id };
  const testing = { ...baseEvidence, id: testingId, competency_id: 'core.testing', fact: { observation: 'The focused test run completed successfully for the submitted work revision.', observed_at: at, artifacts: [testArtifact] }, interpretation: { independence: highest === 0 ? 'independent' : 'guided', direction: 'supporting', target_level: 'E1', strength: 'moderate', rationale: 'Observed focused tests support bounded testing behavior in one context only.' }, supersedes: null };
  task.validation = task.acceptance_criteria.map((criterion: ObjectValue) => ({ criterion_id: criterion.id, result: 'pass', artifact: attestations[criterion.id] ?? (criterion.id === 'AC-tests' ? testArtifact : criterion.id === 'AC-explanation' ? task.design_artifact : task.work_artifact), checked_at: at, work_revision: task.work_artifact.revision }));
  transition(task, 'validating', lead, 'Approved code review matched the current work revision.', at); transition(task, 'task-review', lead, 'Every frozen criterion had a current inspected artifact.', at);
  const review = { ...common, id: reviewId, created_at: at, author: lead, kind: 'task', subject_id: task.id, evidence_ids: [implementationId, testingId], assessment_ids: [], period: { start: task.created_at, end: at }, findings: result.output.findings, outcome: 'accepted', supersedes: null, change: task.work_artifact };
  transition(task, 'evidence-recording', lead, 'Team lead accepted the exact reviewed change.', at); task.completion_evidence_ids = [implementationId, testingId]; transition(task, 'completed', lead, 'Verified completion evidence was reconciled atomically.', at);
  const transcript = writeArtifact(root, 'role-transcripts', result.transcript, 'Bound task-review transcript', rt);
  const writes = new Map([[statePath(`evidence/${implementationId}.yaml`), encode(implementation)], [statePath(`evidence/${testingId}.yaml`), encode(testing)], [statePath(`reviews/task/${reviewId}.yaml`), encode(review)], [statePath(`work/${task.id}.yaml`), encode(task)]]);
  return { outcome: 'success', ...publish(root, 'team-lead', 'complete-task', task.id, { code_review_id: code.id, transcript }, writes, [implementationId, testingId, reviewId, task.id], rt), task_id: task.id, review_id: reviewId, evidence_ids: [implementationId, testingId], next_task_preview: nextTaskPreview(root, task, rt) };
}

export async function performanceReview(root: string, adapter: RoleAdapter, rt: Runtime = runtime): Promise<ObjectValue> {
  const task = currentTask(root, rt); requireThat(task?.status === 'completed', 'TASK_STATE_INVALID', 'task', 'Complete the first task before performance review.');
  const profile = record(root, 'profile.yaml', rt);
  const existing = recordsByPrefix(root, 'reviews/performance/', rt).filter(item => item.subject_id === profile.learner_id && item.period.start === task.created_at && item.assessment_ids.includes(profile.baseline_assessment_id)).at(-1);
  if (existing) return { outcome: 'no-change', review_id: existing.id, review_outcome: existing.outcome, findings: existing.findings, next_task_preview: nextTaskPreview(root, task, rt) };
  const evidence = recordsByPrefix(root, 'evidence/', rt).filter(item => item.task_id === task.id && item.verification.status === 'verified');
  const taskReviews = recordsByPrefix(root, 'reviews/task/', rt).filter(item => item.subject_id === task.id); const baseline = record(root, `assessments/${profile.baseline_assessment_id}.yaml`, rt);
  const result = await invoke(adapter, root, 'manager', 'manager', 'Synthesize this single completed task. Do not recommend or grant promotion because one context cannot establish repeated next-level behavior. Return continue, adjust-scope, or insufficient-evidence.', { goals: profile.goals, baseline, task: frozenTask(task), evidence, task_reviews: taskReviews, next_task_preview: nextTaskPreview(root, task, rt) }, ['outcome', 'findings', 'next_task_adjustment'], rt);
  requireThat(['continue', 'adjust-scope', 'insufficient-evidence'].includes(result.output.outcome) && Array.isArray(result.output.findings) && typeof result.output.next_task_adjustment === 'string', 'ADAPTER_INVALID', 'performance-review', 'Invalid performance review output or prohibited promotion recommendation.');
  const id = rt.id('REV'); const at = rt.now(); const scopeBytes = read(root, scopePath, rt); const review = { ...common, id, created_at: at, author: actor(root, 'manager', rt), kind: 'performance', subject_id: profile.learner_id, evidence_ids: evidence.map(item => item.id), assessment_ids: [baseline.id], period: { start: task.created_at, end: at }, findings: [...result.output.findings, `Next-task adjustment: ${result.output.next_task_adjustment}`], outcome: result.output.outcome, supersedes: null, evaluation_scope: { core_competencies: coreCompetencies, specialization_competencies: profile.specialization_competencies, competency_catalog_version: '3.0', level_catalog_version: '2.0', scope_agreement: artifact(scopePath, scopeBytes, 'Learner and team-lead evaluation-scope agreement') } };
  const transcript = writeArtifact(root, 'role-transcripts', result.transcript, 'Bound manager performance-review transcript', rt);
  return { outcome: 'success', ...publish(root, 'manager', 'performance-review', profile.learner_id, { task_id: task.id, transcript }, new Map([[statePath(`reviews/performance/${id}.yaml`), encode(review)]]), [id], rt), review_id: id, review_outcome: result.output.outcome, findings: review.findings, next_task_preview: nextTaskPreview(root, task, rt) };
}

export function nextAction(root: string, rt: Runtime = runtime): ObjectValue {
  const profile = record(root, 'profile.yaml', rt); const track = record(root, 'current-track.yaml', rt);
  if (!track.track_id) return { phase: 'TRACK SELECTION', command: 'tracks' };
  if (profile.onboarding !== 'complete') return { phase: 'ONBOARD', command: 'onboard' };
  if (track.alignment_status !== 'aligned') return { phase: 'TRACK ALIGNMENT', command: 'track align' };
  const selection = record(root, 'current-project.yaml', rt); if (!selection.project_id) return { phase: 'PROJECT SELECTION', command: `projects --track ${track.track_id}` };
  const templates = packTemplates(root, rt);
  if (!templates.length) return { phase: 'PORTABLE TASK ASSIGNMENT', command: null, project_id: selection.project_id, handoff: 'Use the portable task-assignment skill; this project has no bundled curated task pack.' };
  // An upstream codebase is mapped before its first task. A forge project starts empty, so there is nothing to map.
  if (selection.kind !== 'forge' && !exists(safePath(root, mapPath, rt), rt)) return { phase: 'CREATE CODEBASE MAP', command: 'map init' };
  if (selection.kind !== 'forge' && mapStatus(root, rt).status === 'incomplete') return { phase: 'CREATE CODEBASE MAP', command: 'map check' };
  const task = currentTask(root, rt); if (!task) return { phase: 'ASSIGN FIRST TASK', command: 'task assign' };
  const fixedTest = templateForTask(root, task, rt).focused_test;
  const commands: Record<string, string> = { assigned: 'task begin', investigating: 'task begin', designing: 'task submit-design --file <path>', implementing: 'task submit-change', testing: fixedTest ? 'task test --prediction <text>' : 'task test --prediction <text> --command <your test command>' };
  if (commands[task.status]) return { phase: task.status.toUpperCase(), command: commands[task.status], task_id: task.id };
  if (task.status === 'code-review') {
    const approved = recordsByPrefix(root, 'reviews/code/', rt).some(item => item.subject_id === task.id && item.outcome === 'approve' && canonical(item.change) === canonical(task.work_artifact));
    return { phase: approved ? 'TASK REVIEW' : 'CODE REVIEW', command: approved ? 'review task' : 'review code', task_id: task.id };
  }
  if (task.status === 'completed') {
    const performance = recordsByPrefix(root, 'reviews/performance/', rt).filter(item => item.period.start === task.created_at);
    const remaining = templates.length > projectTasks(root, selection.project_id, rt).length;
    // A per-task performance review is optional (FR-27); the next pack task can be assigned either way.
    if (remaining) return { phase: 'NEXT TASK', command: 'task assign', task_id: task.id, optional: performance.length ? null : 'review performance', next_task_preview: nextTaskPreview(root, task, rt) };
    if (!performance.length) return { phase: 'NEXT TASK / PERFORMANCE REVIEW', command: 'review performance', next_task_preview: nextTaskPreview(root, task, rt) };
    return { phase: 'COMPLETE', command: null, task_id: task.id, performance_review_id: performance.at(-1)!.id };
  }
  return { phase: task.status.toUpperCase(), command: 'review task', task_id: task.id };
}

export async function advanceNext(root: string, adapter: RoleAdapter, rt: Runtime = runtime): Promise<ObjectValue> {
  const navigation = nextAction(root, rt); let result: ObjectValue | undefined;
  if (navigation.command === 'map init') result = initMap(root, rt);
  else if (navigation.command === 'task assign') result = assignTask(root, rt);
  else if (navigation.command === 'task begin') result = beginTask(root, rt);
  else if (navigation.command === 'review code') result = await codeReview(root, adapter, rt);
  else if (navigation.command === 'review task') result = await taskReview(root, adapter, rt);
  else if (navigation.command === 'review performance') result = await performanceReview(root, adapter, rt);
  if (!result) return { ...navigation, invoked: false, explanation: 'This step needs learner input or explicit confirmation; run the shown command.' };
  return { phase: navigation.phase, command: navigation.command, invoked: true, result, next: nextAction(root, rt) };
}
