import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from '../../../core/common.js';
import { onboardingBundleRoot, prepareOnboarding } from './onboarding.js';
import { capabilityHostContractVersion, type CapabilityHostAdapter, type CapabilityProjection, type HostCapabilityProfile, type HostProbe } from './contract.js';

export class GenericCapabilityHostAdapter implements CapabilityHostAdapter {
  readonly profile: HostCapabilityProfile;
  constructor(profile: Partial<HostCapabilityProfile> & Pick<HostCapabilityProfile, 'host'> = { host: 'generic' }) {
    this.profile = {
      contract_version: capabilityHostContractVersion,
      host: profile.host,
      installation: profile.installation ?? ['copy an Agent Skills directory'],
      discovery: profile.discovery ?? { automatic: true, explicit: ['capability:onboarding'] },
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
    if (capabilityId !== 'onboarding') throw new Error(`Unsupported capability: ${capabilityId}`);
    const root = onboardingBundleRoot();
    const bundle = JSON.parse(fs.readFileSync(path.join(root, 'references/bundle.json'), 'utf8'));
    const files: CapabilityProjection['files'] = [];
    const walk = (directory: string): void => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const source = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(source);
        else if (entry.isFile()) {
          const relative = path.relative(root, source).split(path.sep).join('/');
          files.push({ source, target: `${this.targetRoot()}/${relative}`, sha256: sha256(fs.readFileSync(source)) });
        }
      }
    };
    walk(root);
    return { capability_id: capabilityId, protocol_version: bundle.protocol_version, source_manifest_sha256: bundle.manifest_sha256, target_root: this.targetRoot(), invocation_surfaces: this.profile.discovery.explicit, files: files.sort((a, b) => a.target.localeCompare(b.target)) };
  }
  protected targetRoot(): string { return 'skills/onboarding'; }
  async invoke(request: { capability_id: string; workspace: string; input: Record<string, any> }) {
    if (request.capability_id !== 'onboarding') throw new Error(`Unsupported capability: ${request.capability_id}`);
    return prepareOnboarding(this.profile.host, request.workspace, request.input);
  }
}

export * from './contract.js';
export * from './onboarding.js';
