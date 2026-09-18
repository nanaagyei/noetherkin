import type { ObjectValue } from '../../../core/common.js';

export const capabilityHostContractVersion = '1.0' as const;

export type CapabilityOutcome = 'needs-input' | 'proposal' | 'consent-required' | 'completed' | 'no-change' | 'blocked';

export interface CapabilityDiagnostic {
  code: string;
  path: string;
  message: string;
}

export interface HostCapabilityProfile {
  contract_version: typeof capabilityHostContractVersion;
  host: string;
  installation: string[];
  discovery: { automatic: boolean; explicit: string[] };
  arguments: 'conversation' | 'command-tail' | 'both';
  workspace_context: 'working-directory' | 'explicit-path' | 'both';
  tools: { configurable: boolean; isolation: string };
  structured_results: boolean;
  session_continuation: boolean;
  consent: 'terminal-handoff';
  degradation: string;
}

export interface HostProbe {
  host: string;
  available: boolean;
  version: string | null;
  limitations: string[];
}

export interface CapabilityProjectionFile {
  source: string;
  target: string;
  sha256: string;
}

export interface CapabilityProjection {
  capability_id: string;
  protocol_version: string;
  source_manifest_sha256: string;
  target_root: string;
  invocation_surfaces: string[];
  files: CapabilityProjectionFile[];
}

export interface CapabilityInvocation {
  capability_id: string;
  workspace: string;
  input: ObjectValue;
}

export interface CapabilityResult {
  contract_version: typeof capabilityHostContractVersion;
  capability_id: string;
  host: string;
  outcome: CapabilityOutcome;
  confirmed: ObjectValue;
  unverified: ObjectValue;
  diagnostics: CapabilityDiagnostic[];
  next_action: ObjectValue | null;
}

export interface CapabilityHostAdapter {
  readonly profile: HostCapabilityProfile;
  probe(): HostProbe;
  project(capabilityId: string): CapabilityProjection;
  invoke(request: CapabilityInvocation): Promise<CapabilityResult>;
}
