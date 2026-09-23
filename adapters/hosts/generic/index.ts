import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../../core/common.js';
import { portableSkillIds, skillBundleRoot } from './bundles.js';
import { prepareOnboarding } from './onboarding.js';
import { capabilityHostContractVersion, type CapabilityHostAdapter, type CapabilityInvocation, type CapabilityProjection, type CapabilityResult, type HostCapabilityProfile, type HostProbe } from './contract.js';

export class GenericCapabilityHostAdapter implements CapabilityHostAdapter {
  readonly profile: HostCapabilityProfile;
  constructor(profile: Partial<HostCapabilityProfile> & Pick<HostCapabilityProfile, 'host'> = { host: 'generic' }) {
    this.profile = {
      contract_version: capabilityHostContractVersion,
      host: profile.host,
      installation: profile.installation ?? ['copy an Agent Skills directory'],
      discovery: profile.discovery ?? { automatic: true, explicit: portableSkillIds().map(id => this.invocationSurface(id)) },
      arguments: profile.arguments ?? 'conversation',
      workspace_context: profile.workspace_context ?? 'both',
      tools: profile.tools ?? { configurable: false, isolation: 'Host-dependent; unsupported enforcement degrades to proposals.' },
      structured_results: profile.structured_results ?? true,
      session_continuation: profile.session_continuation ?? false,
      consent: 'terminal-handoff',
      degradation: profile.degradation ?? 'Return a reviewable proposal and terminal handoff; never claim canonical publication.'
    };
  }
  probe(): HostProbe { return { host: this.profile.host, available: true, version: capabilityHostContractVersion, limitations: [this.profile.degradation] }; }
  project(capabilityId: string): CapabilityProjection {
    const root = skillBundleRoot(capabilityId);
    const bundle = JSON.parse(fs.readFileSync(path.join(root, 'references/bundle.json'), 'utf8'));
    const files: CapabilityProjection['files'] = [];
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const source = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(source);
        else if (entry.isFile()) {
          const relative = path.relative(root, source).split(path.sep).join('/');
          files.push({ source, target: `${this.targetRoot(capabilityId)}/${relative}`, sha256: sha256(fs.readFileSync(source)) });
        }
      }
    };
    walk(root);
    return { capability_id: capabilityId, protocol_version: bundle.protocol_version, source_manifest_sha256: bundle.manifest_sha256, target_root: this.targetRoot(capabilityId), invocation_surfaces: [this.invocationSurface(capabilityId)], files: files.sort((a, b) => a.target.localeCompare(b.target)) };
  }
  protected targetRoot(capabilityId: string): string { return `skills/${capabilityId}`; }
  protected invocationSurface(capabilityId: string): string { return `capability:${capabilityId}`; }
  async invoke(request: CapabilityInvocation): Promise<CapabilityResult> {
    skillBundleRoot(request.capability_id);
    if (request.capability_id === 'onboarding') return prepareOnboarding(this.profile.host, request.workspace, request.input);
    // Only onboarding has a host bridge. Every other capability runs through its SKILL.md procedure and the CLI
    // commands it names, so the adapter reports that plainly instead of pretending to execute it.
    return {
      contract_version: capabilityHostContractVersion, capability_id: request.capability_id, host: this.profile.host, outcome: 'blocked',
      confirmed: {}, unverified: {},
      diagnostics: [{ code: 'NO_CONTROLLER_BRIDGE', path: request.capability_id, message: `No host bridge exists for ${request.capability_id}. Follow its installed SKILL.md; canonical writes go through the noetherkin CLI commands it names.` }],
      next_action: null
    };
  }
}

export * from './contract.js';
export * from './bundles.js';
export * from './onboarding.js';
export * from './install.js';
