import fs from 'node:fs';
import path from 'node:path';
import { Failure, requireThat, sha256 } from '../../../core/common.js';
import { exists, safePath } from '../../../core/storage.js';
import type { CapabilityHostAdapter } from './contract.js';

export interface InstalledCapability { capability_id: string; target_root: string; invocation_surfaces: string[]; written: number; unchanged: number }
export interface InstallReport { host: string; target: string; capabilities: InstalledCapability[] }

// Copies projected bundles into a host's skill directory. Nothing is overwritten: an identical file is left alone,
// and any differing file, directory or symlink in the way fails the whole install before a single byte is written.
export function installCapabilities(adapter: CapabilityHostAdapter, target: string, capabilityIds: string[]): InstallReport {
  requireThat(capabilityIds.length > 0, 'INPUT_REQUIRED', 'skill', 'Name at least one capability to install.');
  const root = fs.realpathSync(path.resolve(target));
  requireThat(fs.statSync(root).isDirectory(), 'NOT_DIRECTORY', target, 'Install target must be an existing directory.');
  const projections = [...new Set(capabilityIds)].map(id => adapter.project(id));
  const plan: { destination: string; source: string; sha256: string; write: boolean; capability: string }[] = [];
  const conflicts: string[] = [];
  for (const projection of projections) {
    for (const file of projection.files) {
      const destination = safePath(root, file.target);
      let write = true;
      if (exists(destination)) {
        const stat = fs.lstatSync(destination);
        if (stat.isFile() && sha256(fs.readFileSync(destination)) === file.sha256) write = false;
        else conflicts.push(file.target);
      }
      plan.push({ destination, source: file.source, sha256: file.sha256, write, capability: projection.capability_id });
    }
  }
  if (conflicts.length) throw new Failure('CONFLICT', conflicts[0]!, `Refusing to overwrite ${conflicts.length} existing file(s) that differ from the bundle, starting with ${conflicts[0]}. Move them aside or install into another directory.`);
  for (const item of plan.filter(item => item.write)) {
    const bytes = fs.readFileSync(item.source);
    requireThat(sha256(bytes) === item.sha256, 'BUNDLE_CHANGED', item.source, 'Source bundle changed during installation.');
    fs.mkdirSync(path.dirname(item.destination), { recursive: true });
    fs.writeFileSync(item.destination, bytes, { flag: 'wx' });
  }
  for (const item of plan) requireThat(sha256(fs.readFileSync(item.destination)) === item.sha256, 'INSTALL_MISMATCH', item.destination, 'Installed file does not match its bundle digest.');
  return {
    host: adapter.profile.host, target: root,
    capabilities: projections.map(projection => ({
      capability_id: projection.capability_id, target_root: projection.target_root, invocation_surfaces: projection.invocation_surfaces,
      written: plan.filter(item => item.capability === projection.capability_id && item.write).length,
      unchanged: plan.filter(item => item.capability === projection.capability_id && !item.write).length
    }))
  };
}
