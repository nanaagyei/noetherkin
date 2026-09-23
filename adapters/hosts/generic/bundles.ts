import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Failure } from '../../../core/common.js';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));

export interface PortableSkill { name: string; description: string }

// The skill manifest is the single list of portable capabilities; hosts project exactly these and nothing else.
export function portableSkillIds(): string[] {
  const manifest = JSON.parse(fs.readFileSync(path.join(repository, 'skill-pack/manifest.json'), 'utf8'));
  return manifest.skills.map((skill: { name: string }) => skill.name);
}

export function skillBundleRoot(capabilityId: string): string {
  if (!portableSkillIds().includes(capabilityId)) throw new Failure('UNSUPPORTED_CAPABILITY', capabilityId, `Unsupported capability: ${capabilityId}`);
  return path.join(repository, 'skills', capabilityId);
}

export function portableSkills(): PortableSkill[] {
  return portableSkillIds().map(name => {
    const entry = fs.readFileSync(path.join(skillBundleRoot(name), 'SKILL.md'), 'utf8');
    const description = /^description: (.*)$/m.exec(entry.split('\n---\n')[0] ?? '')?.[1] ?? '';
    return { name, description };
  });
}
