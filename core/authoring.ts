import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Failure, diagnostic, requireThat, type ObjectValue } from './common.js';
import { parse } from './parsing.js';
import { compileSchema, type SchemaError } from './schema.js';
import { catalogs, schemaErrors } from './validation.js';
import { forgePack, packOnlyFields } from './packs.js';

/**
 * Forge authoring (issue #17). `checkForgeDirectory` applies the rules the catalog loader and
 * `evaluations/validate_foundation.py` already enforce, but reports every problem at once with a remedy instead of
 * throwing on the first. It adds no protocol rule: warnings flag authoring smells, never block a load.
 *
 * An authored directory mirrors the repository, `catalog/forge/<id>.yaml` beside `tasks/forge/<pack-id>/NN-*.json`,
 * so it can be copied into a checkout unchanged, and `forge check` at a checkout root checks every shipped forge.
 */

const assets = fileURLToPath(new URL('../../', import.meta.url));

export type Severity = 'error' | 'warning' | 'note';
export interface AuthoringProblem { severity: Severity; code: string; path: string; message: string; try: string }
export interface ForgeCheck { directory: string; forges: string[]; problems: AuthoringProblem[] }

// A task template is a task record before assignment: the fields assignTask fills are absent, and the pack-only
// fields are present. The template schema is derived from the task schema so the two cannot drift.
const assignedFields = ['schema_version', 'data_class', 'created_at', 'author', 'project_id', 'status', 'assigned_by', 'assistance_history', 'blocked_reason', 'completion_evidence_ids', 'validation', 'transitions', 'work_artifact', 'design_artifact', 'design_assessment_id'];
const slug = '^[a-z0-9]+(-[a-z0-9]+)*$';
const packOnlySchemas: Record<string, ObjectValue> = {
  version: { type: 'integer', minimum: 1 },
  id: { type: 'string', pattern: slug },
  sequence: { type: 'integer', minimum: 1 },
  pack_id: { type: 'string', pattern: slug },
  forge_id: { type: 'string', pattern: slug },
  compatibility: { type: 'object' },
  // The last task of a pack previews nothing.
  next_task_preview: { anyOf: [{ type: 'null' }, { type: 'object', required: ['title', 'summary'], properties: { title: { type: 'string', minLength: 1 }, summary: { type: 'string', minLength: 1 } }, additionalProperties: false }] },
  focused_test: { type: 'object' },
  investigation_prompt: { type: 'string', minLength: 1 },
  attested_criteria: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, uniqueItems: true }
};
function templateValidator(): (value: unknown) => SchemaError[] {
  const task = JSON.parse(fs.readFileSync(path.join(assets, 'schemas/task.schema.json'), 'utf8'));
  const properties = Object.fromEntries(Object.entries(task.properties as ObjectValue).filter(([key]) => !assignedFields.includes(key)));
  for (const key of packOnlyFields) properties[key] = packOnlySchemas[key] ?? {};
  const { $id: _id, ...base } = task;
  return compileSchema({ ...base, required: [...task.required.filter((key: string) => !assignedFields.includes(key)), 'version', 'sequence', 'pack_id', 'forge_id'], properties });
}

const forbids = (verb: RegExp) => (constraint: string): boolean => /\b(do not|don't|never|must not)\b/i.test(constraint) && verb.test(constraint);
const forbidsPush = forbids(/\bpush/i);
const forbidsPublish = forbids(/\b(publish|deploy)/i);
const needsAnotherPerson = /\b(someone other than the learner|another person|a colleague|someone who did not write)\b/i;
const todo = /\bTODO\b/;

/** Every string in `value` that still carries a TODO marker, as a JSON pointer. */
function todoPointers(value: unknown, pointer = ''): string[] {
  if (typeof value === 'string') return todo.test(value) ? [pointer || '/'] : [];
  if (Array.isArray(value)) return value.flatMap((item, index) => todoPointers(item, `${pointer}/${index}`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => todoPointers(item, `${pointer}/${key}`));
  return [];
}
const list = (value: unknown): any[] => Array.isArray(value) ? value : [];

export function checkForgeDirectory(directory: string): ForgeCheck {
  const root = path.resolve(directory);
  const problems: AuthoringProblem[] = [];
  const report = (severity: Severity, code: string, file: string, message: string, remedy: string): void => { problems.push({ severity, code, path: file, message, try: remedy }); };
  // One problem per file, listing every field that still holds a marker, so a fresh scaffold reads as a to-do list.
  const reportTodos = (file: string, value: unknown): void => {
    const pointers = todoPointers(value);
    if (pointers.length) report('error', 'TODO_MARKER', file, `${pointers.length} field(s) still hold a TODO marker: ${pointers.join(', ')}.`, 'Replace each marker with the real content; see docs/forge-authoring.md.');
  };
  const recordDirectory = path.join(root, 'catalog/forge');
  const files = fs.existsSync(recordDirectory) ? fs.readdirSync(recordDirectory).filter(file => file.endsWith('.yaml')).sort() : [];
  if (!files.length) {
    report('error', 'FORGE_MISSING', 'catalog/forge', `No forge record found under ${recordDirectory}.`, 'Scaffold one with `noetherkin forge new <id> <directory> --track <track-id>`, or point forge check at the directory that holds catalog/forge/.');
    return { directory: root, forges: [], problems };
  }

  const catalog = catalogs();
  const projectIds = new Set(catalog.projects.map(project => project.id));
  const shipped = new Map(catalog.forges.map(forge => [forge.id, forge]));
  // Which shipped forge owns each pack and task ID, so an author cannot take one that belongs to another forge.
  const packOwner = new Map<string, string>(); const taskOwner = new Map<string, string>();
  for (const forge of catalog.forges) for (const pack of forge.task_packs) {
    packOwner.set(pack, forge.id);
    for (const template of forgePack(pack)) taskOwner.set(template.id, forge.id);
  }
  const validateTemplate = templateValidator();
  const referencedPacks = new Set<string>(); const seenTasks = new Map<string, string>(); const forges: string[] = [];

  for (const file of files) {
    const relative = `catalog/forge/${file}`;
    let record: ObjectValue;
    try { record = parse(fs.readFileSync(path.join(recordDirectory, file)), relative); } catch (error) { report('error', 'YAML_INVALID', relative, diagnostic(error).message, 'Fix the syntax; the record is JSON or YAML.'); continue; }
    const id = String(record.id ?? path.basename(file, '.yaml')); forges.push(id);
    for (const error of schemaErrors(record, 'forge')) report('error', 'FORGE_SCHEMA', `${relative}#${error.path || '/'}`, error.message, 'Compare the field with schemas/forge.schema.json and the annotated example in docs/forge-authoring.md.');
    reportTodos(relative, record);
    if (record.id !== path.basename(file, '.yaml')) report('error', 'FORGE_ID_MISMATCH', relative, `Forge ID ${record.id} does not match its file name.`, `Rename the file to ${record.id}.yaml or change the id.`);

    const isNew = !shipped.has(id);
    if (projectIds.has(id)) report('error', 'ID_COLLISION', relative, `${id} is already a catalog project ID; forges and projects share one selection namespace.`, 'Choose a different forge ID.');
    if (!isNew) report('note', 'UPDATES_SHIPPED_FORGE', relative, `${id} is a shipped forge, so this is checked as an edit of it.`, 'Choose a new ID if you meant to author a separate forge.');
    if (isNew && record.status !== 'draft') report('error', 'STATUS_NOT_DRAFT', `${relative}#/status`, `A new forge starts as draft, not ${record.status}.`, 'Set "status": "draft". Maintainers promote a forge to supported after review.');

    const competencies = list(record.competencies);
    const unknown = competencies.filter(item => !catalog.competencyIds.has(item));
    if (unknown.length) report('error', 'COMPETENCY_UNKNOWN', `${relative}#/competencies`, `Unknown competency IDs: ${unknown.join(', ')}.`, 'Use IDs from catalog/competencies.yaml; `noetherkin track show <track-id>` lists a track\'s required ones.');
    for (const trackId of list(record.track_alignment)) {
      const track = catalog.tracks.find(item => item.id === trackId);
      if (!track) { report('error', 'TRACK_UNKNOWN', `${relative}#/track_alignment`, `Unknown track ${trackId}.`, 'Use a track ID from `noetherkin tracks`.'); continue; }
      if (!track.required_competencies.some((item: string) => competencies.includes(item))) report('error', 'TRACK_NOT_EXERCISED', `${relative}#/track_alignment`, `The forge exercises none of the competencies ${trackId} requires (${track.required_competencies.join(', ')}).`, `Have a task genuinely exercise one of them, or drop ${trackId} from track_alignment.`);
    }

    const exercised = new Set<string>(); let forbidsPublishing = false;
    for (const packId of list(record.task_packs)) {
      referencedPacks.add(packId);
      const packPath = `tasks/forge/${packId}`;
      if (packOwner.has(packId) && packOwner.get(packId) !== id) report('error', 'ID_COLLISION', packPath, `Pack ${packId} belongs to the shipped forge ${packOwner.get(packId)}.`, `Name the pack after this forge, for example ${id}-core.`);
      const packDirectory = path.join(root, packPath);
      const entries = fs.existsSync(packDirectory) ? fs.readdirSync(packDirectory).sort() : [];
      const stray = entries.filter(entry => !entry.endsWith('.json'));
      if (stray.length) report('error', 'FORGE_SOLUTION_SHIPPED', packPath, `A forge pack ships task specifications only; found ${stray.join(', ')}.`, 'Remove every file that is not a task template. No solution or starter code is shipped (FR-45).');
      const taskFiles = entries.filter(entry => entry.endsWith('.json'));
      if (!taskFiles.length) { report('error', 'PACK_MISSING', packPath, `Pack ${packId} has no task templates.`, `Add ${packPath}/01-<slug>.json; \`noetherkin forge new\` scaffolds one.`); continue; }

      const templates: { file: string; template: ObjectValue }[] = [];
      for (const taskFile of taskFiles) {
        const taskPath = `${packPath}/${taskFile}`;
        try { templates.push({ file: taskPath, template: JSON.parse(fs.readFileSync(path.join(packDirectory, taskFile), 'utf8')) }); } catch (error) { report('error', 'JSON_INVALID', taskPath, error instanceof Error ? error.message : String(error), 'Fix the JSON syntax.'); }
      }
      templates.sort((a, b) => Number(a.template.sequence) - Number(b.template.sequence));
      templates.forEach(({ file: taskPath, template }, index) => {
        for (const error of validateTemplate(template)) report('error', 'TASK_SCHEMA', `${taskPath}#${error.path || '/'}`, error.message, 'Compare the field with schemas/task.schema.json and the annotated example in docs/forge-authoring.md.');
        reportTodos(taskPath, template);
        if (template.pack_id !== packId || template.forge_id !== id) report('error', 'TASK_OWNER_MISMATCH', taskPath, `The task names pack ${template.pack_id} and forge ${template.forge_id}, not ${packId} and ${id}.`, `Set "pack_id": "${packId}" and "forge_id": "${id}".`);
        const prefix = String(index + 1).padStart(2, '0');
        if (template.sequence !== index + 1 || !path.basename(taskPath).startsWith(`${prefix}-`)) report('error', 'SEQUENCE_INVALID', taskPath, `Task at position ${index + 1} has sequence ${template.sequence} in ${path.basename(taskPath)}.`, `Number tasks 1..n with no gaps or repeats, and prefix each file with its two-digit sequence (${prefix}-).`);
        const taskId = String(template.id);
        if (seenTasks.has(taskId)) report('error', 'ID_COLLISION', taskPath, `Task ID ${taskId} is also used by ${seenTasks.get(taskId)}.`, 'Give every task a unique ID, conventionally <forge-id>-<NN>-<slug>.');
        else if (taskOwner.has(taskId) && taskOwner.get(taskId) !== id) report('error', 'ID_COLLISION', taskPath, `Task ID ${taskId} belongs to the shipped forge ${taskOwner.get(taskId)}.`, 'Use an ID prefixed with this forge ID.');
        seenTasks.set(taskId, taskPath);

        const taskCompetencies = [...list(template.primary_competencies), ...list(template.secondary_competencies)];
        const unknownTask = taskCompetencies.filter(item => !catalog.competencyIds.has(item));
        if (unknownTask.length) report('error', 'COMPETENCY_UNKNOWN', taskPath, `Unknown competency IDs: ${unknownTask.join(', ')}.`, 'Use IDs from catalog/competencies.yaml.');
        taskCompetencies.forEach(item => exercised.add(item));

        const criteria = list(template.acceptance_criteria);
        const criterionIds = criteria.map(item => item?.id);
        const attested = list(template.attested_criteria);
        for (const criterion of attested) if (!criterionIds.includes(criterion)) report('error', 'ATTESTATION_UNKNOWN', `${taskPath}#/attested_criteria`, `${criterion} is not an acceptance criterion of this task.`, 'List only IDs from acceptance_criteria.');
        for (const criterion of criteria) if (needsAnotherPerson.test(String(criterion?.criterion)) && !attested.includes(criterion.id)) report('warning', 'ATTESTATION_MISSING', `${taskPath}#/acceptance_criteria`, `${criterion.id} needs someone other than the learner, but nothing attests it, so no artifact can satisfy it.`, `Add "attested_criteria": ["${criterion.id}"] so the learner records the outside check with \`noetherkin task attest\`.`);
        if (!criterionIds.includes('AC-explanation')) report('warning', 'EXPLANATION_MISSING', `${taskPath}#/acceptance_criteria`, 'The task has no AC-explanation criterion.', 'Add one asking the learner to explain the choice they made, one rejected alternative, and what breaks first.');
        const constraints = list(template.constraints).map(String);
        if (!constraints.some(forbidsPush)) report('error', 'PUSH_NOT_FORBIDDEN', `${taskPath}#/constraints`, 'No constraint forbids pushing to a remote.', 'Add "Do not push to a remote or open a pull request as part of this task."');
        if (constraints.some(forbidsPublish)) forbidsPublishing = true;
        for (const key of Object.keys(template)) if (assignedFields.includes(key)) report('error', 'TASK_SCHEMA', `${taskPath}#/${key}`, `${key} is filled in at assignment and must not appear in a template.`, `Remove ${key}.`);
      });
    }
    if (list(record.task_packs).length && !forbidsPublishing) report('error', 'PUBLISH_NOT_FORBIDDEN', `catalog/forge/${file}`, 'No task in the forge forbids publishing or deploying what the learner builds.', 'Add "Do not push to a remote, publish a package or deploy anything as part of this task." to the task where the work first becomes shippable, usually the last.');
    const missing = [...exercised].filter(item => !competencies.includes(item)).sort();
    const unused = competencies.filter(item => !exercised.has(item)).sort();
    if (missing.length || unused.length) report('error', 'COMPETENCY_MISMATCH', `${relative}#/competencies`, `Forge competencies must equal what its tasks exercise.${missing.length ? ` Exercised but not declared: ${missing.join(', ')}.` : ''}${unused.length ? ` Declared but no task exercises: ${unused.join(', ')}.` : ''}`, 'Make the list the union of every task\'s primary and secondary competencies (FR-41: claim only what a task genuinely exercises).');
  }

  const packRoot = path.join(root, 'tasks/forge');
  if (fs.existsSync(packRoot)) for (const pack of fs.readdirSync(packRoot).sort()) if (!referencedPacks.has(pack)) report('warning', 'PACK_UNREFERENCED', `tasks/forge/${pack}`, `No forge record lists pack ${pack}.`, 'Add it to a record\'s task_packs or remove it.');
  return { directory: root, forges, problems };
}

/** The first-party caveats every forge carries; an author adds problem-specific ones. */
const standardCaveats = [
  'This is a first-party specification, not an upstream project. Completing it establishes no upstream contribution, maintainer relationship or endorsement.',
  'The specification is owned by this repository. No solution, reference implementation or partial source is shipped with it.',
  'Evidence derived from this work describes learner-authored software produced inside a simulated engineering process. The surrounding review, assignment and incident workflows are simulated and must be qualified as such.',
  'The context budget is an authoring constraint on this specification and an advisory target for the learner. It is not an acceptance criterion and no task fails for exceeding it.'
];

/**
 * Writes a forge record and a first task template in which every required field is present. Content the author must
 * write is a TODO marker that `forge check` rejects; everything else already passes, so the first check lists only
 * the work left to do.
 */
export function scaffoldForge(id: string, directory: string, trackId: string, now = new Date()): { directory: string; files: string[] } {
  requireThat(new RegExp(slug).test(id), 'INPUT_INVALID', id, 'A forge ID is lowercase words joined by hyphens, for example water-ledger.');
  const catalog = catalogs();
  requireThat(!catalog.forges.some(forge => forge.id === id) && !catalog.projects.some(project => project.id === id), 'ID_COLLISION', id, `${id} is already a forge or catalog project ID.`);
  const track = catalog.tracks.find(item => item.id === trackId);
  requireThat(track, 'TRACK_UNKNOWN', trackId, 'Unknown track ID. `noetherkin tracks` lists them.');
  const root = path.resolve(directory);
  const pack = `${id}-core`;
  const recordFile = path.join(root, 'catalog/forge', `${id}.yaml`);
  const taskFile = path.join(root, 'tasks/forge', pack, '01-first-task.json');
  for (const file of [recordFile, taskFile]) if (fs.existsSync(file)) throw new Failure('SOURCE_CONFLICT', file, 'The file already exists; forge new never overwrites. Choose another directory.');
  // The scaffold exercises one competency the track requires plus testing and git, so every structural rule holds
  // from the start. The author replaces them with what the tasks genuinely exercise.
  const primary = [track.required_competencies[0] as string];
  const secondary = ['core.testing', 'core.git'].filter(item => !primary.includes(item));
  const record = {
    schema_version: '1.0', data_class: 'live', id, name: 'TODO: a short name', description: 'TODO: one sentence saying what the finished system does.',
    status: 'draft', track_alignment: [trackId], competencies: [...primary, ...secondary],
    recommended_minimum_level: 'E0', ideal_level: 'E1', primary_languages: ['TODO: language'], technologies: [], external_services: [],
    problem: 'TODO: what is wrong in the world without this system, stated as a situation rather than a feature list.',
    users: [{ who: 'TODO: who runs it', needs: 'TODO: what they are trying to accomplish' }],
    success_criteria: [{ id: 'SC-1', criterion: 'TODO: an observable property of the finished system.', verifiable_by: 'TODO: the action an outside reviewer takes to confirm it without trusting a claim.' }],
    non_goals: ['TODO: something a reader might expect that is explicitly out of scope.'],
    operational_requirements: {
      failure_modes: [{ failure: 'TODO: a failure the system must handle.', required_behavior: 'TODO: what it must do instead of failing silently.' }],
      observability: ['TODO: what an operator can see.'],
      rollback: 'TODO: the actual procedure for undoing a bad change. "Not applicable" is not accepted.',
      documentation: ['TODO: a README with a quickstart that someone else can follow.']
    },
    context_budget: { source_tokens_target: 15000, excludes: ['tests', 'lockfiles', 'generated files'], rationale: 'TODO: why this size forces the right scope.' },
    prerequisites: ['TODO: something the learner must already be able to do.'],
    task_packs: [pack], caveats: standardCaveats, sources: [], checked_at: now.toISOString().replace(/\.\d{3}Z$/, 'Z')
  };
  const task = {
    version: 1, id: `${id}-01-first-task`, forge_id: id, pack_id: pack, sequence: 1, type: 'PRODUCT',
    title: 'TODO: the first task, usually inspecting the input or defining the contract',
    problem: 'TODO: what goes wrong if this part is missing or done carelessly.',
    context: 'This is the first task of a learner-authored forge project. No source exists yet. The learner creates the repository, chooses its structure, and owns every design decision inside the specification\'s constraints.',
    impact: 'TODO: what later tasks build on here.',
    acceptance_criteria: [
      { id: 'AC-behavior', criterion: 'TODO: an observable criterion a reviewer can check against an artifact.' },
      { id: 'AC-tests', criterion: 'Automated tests cover the behavior above and pass at the submitted revision.' },
      { id: 'AC-explanation', criterion: 'TODO: the learner explains the choice they made, one rejected alternative, and what breaks first.' }
    ],
    constraints: ['TODO: a constraint that keeps this task bounded.', 'Do not push to a remote, publish a package or deploy anything as part of this task.'],
    primary_competencies: primary, secondary_competencies: secondary, recommended_level: 'E0',
    scope: { classification: 'component', components: ['TODO: component'], description: 'TODO: the boundary of this task.' },
    difficulty: 'bounded', investigation_areas: ['TODO: a question the learner should answer before designing.'],
    testing_expectations: ['Run the project\'s own test suite. State the exact command in the design; the learner chooses the runner and the layout.'],
    documentation_requirements: ['TODO: what the learner records in the design.'],
    design_required: true, code_review_required: true, compatibility: { required_files: [], required_fragments: [] }
  };
  fs.mkdirSync(path.dirname(recordFile), { recursive: true }); fs.mkdirSync(path.dirname(taskFile), { recursive: true });
  fs.writeFileSync(recordFile, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(taskFile, JSON.stringify(task, null, 2) + '\n', { flag: 'wx' });
  return { directory: root, files: [path.relative(root, recordFile), path.relative(root, taskFile)].map(file => file.split(path.sep).join('/')) };
}
