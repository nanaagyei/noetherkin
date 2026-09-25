import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireThat, type ObjectValue } from './common.js';
import { parse } from './parsing.js';

// Task packs are data. An upstream pack is `tasks/<file>.json` whose `id` is the pack ID named in a project's
// `support.task_packs`; a forge pack is the ordered directory `tasks/forge/<pack-id>/`. Nothing here branches on
// a particular project or forge ID (FR-46).

const assets = fileURLToPath(new URL('../../', import.meta.url));

// Pack-only fields describe how to run or sequence a template. They are stripped before a task record is written.
export const packOnlyFields = ['compatibility', 'next_task_preview', 'version', 'id', 'sequence', 'pack_id', 'forge_id', 'focused_test', 'investigation_prompt', 'attested_criteria'];

export function upstreamPack(packId: string, base = assets): ObjectValue[] {
  const directory = path.join(base, 'tasks');
  const matches = fs.readdirSync(directory).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'))).filter(template => template.id === packId);
  requireThat(matches.length === 1, 'TASK_PACK_MISSING', packId, `Task pack ${packId} must resolve to exactly one template.`);
  return matches;
}

export function forgePack(packId: string, base = assets): ObjectValue[] {
  const directory = path.join(base, 'tasks/forge', packId);
  requireThat(fs.existsSync(directory) && fs.statSync(directory).isDirectory(), 'TASK_PACK_MISSING', packId, `Forge task pack ${packId} does not exist.`);
  const files = fs.readdirSync(directory).sort();
  // FR-45: a forge pack ships specification and tasks only. Any other file is treated as possible solution code.
  const stray = files.filter(file => !file.endsWith('.json'));
  requireThat(stray.length === 0, 'FORGE_SOLUTION_SHIPPED', `tasks/forge/${packId}`, `A forge pack ships task specifications only, never implementation; remove ${stray.join(', ')}.`);
  const templates = files.map(file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')));
  requireThat(templates.length > 0, 'TASK_PACK_MISSING', packId, `Forge task pack ${packId} is empty.`);
  templates.sort((a, b) => a.sequence - b.sequence);
  requireThat(templates.every((template, index) => template.pack_id === packId && template.sequence === index + 1), 'CATALOG_INVALID', `tasks/forge/${packId}`, 'Forge pack tasks must name their pack and number their sequence from 1 without gaps.');
  return templates;
}

/** Every shipped task template, upstream or forge, by template ID. Used to check a task against its origin. */
export function templateById(id: string, base = assets): ObjectValue | undefined {
  const upstream = fs.readdirSync(path.join(base, 'tasks')).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(base, 'tasks', file), 'utf8')));
  const forgeRoot = path.join(base, 'tasks/forge');
  const forge = fs.existsSync(forgeRoot) ? fs.readdirSync(forgeRoot).flatMap(pack => fs.readdirSync(path.join(forgeRoot, pack)).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(forgeRoot, pack, file), 'utf8')))) : [];
  return [...upstream, ...forge].find(template => template.id === id);
}

export interface ForgeContext { competencyIds: Set<string>; coreCompetencyIds: Set<string>; tracks: ObjectValue[]; base?: string }

export function validateForgeRecord(record: ObjectValue, file: string, context: ForgeContext): void {
  requireThat(record.id === path.basename(file, '.yaml'), 'CATALOG_INVALID', file, 'Forge ID must match its file name.');
  requireThat(Array.isArray(record.task_packs) && record.task_packs.length > 0, 'CATALOG_INVALID', file, 'A forge record needs at least one authored task pack.');
  requireThat(record.competencies.every((id: string) => context.competencyIds.has(id)), 'CATALOG_INVALID', file, 'Forge competencies must resolve in the competency catalog.');
  const tracks = record.track_alignment.map((id: string) => context.tracks.find(track => track.id === id));
  requireThat(tracks.every(Boolean), 'CATALOG_INVALID', file, 'Forge track alignment must resolve to catalog tracks.');
  requireThat(tracks.some((track: ObjectValue) => track.required_competencies.some((id: string) => record.competencies.includes(id))), 'CATALOG_INVALID', file, 'A forge project must exercise the required competencies of at least one aligned track.');
  const exercised = new Set<string>();
  for (const packId of record.task_packs) for (const template of forgePack(packId, context.base)) {
    requireThat(template.forge_id === record.id, 'CATALOG_INVALID', `tasks/forge/${packId}`, `Task ${template.id} belongs to ${template.forge_id}, not ${record.id}.`);
    for (const id of [...template.primary_competencies, ...template.secondary_competencies]) exercised.add(id);
  }
  // The record neither over-claims nor under-declares what its tasks exercise.
  requireThat([...exercised].sort().join() === [...record.competencies].sort().join(), 'CATALOG_INVALID', file, 'Forge competencies must equal the union of its task competencies.');
}

export function loadForgeRecords(context: ForgeContext, validate: (value: ObjectValue, file: string) => void): ObjectValue[] {
  const directory = path.join(context.base ?? assets, 'catalog/forge');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(file => file.endsWith('.yaml')).sort().map(file => {
    const record = parse(fs.readFileSync(path.join(directory, file)), file);
    validate(record, file);
    validateForgeRecord(record, file, context);
    return record;
  });
}
