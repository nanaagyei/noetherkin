import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proposeInit, type InitProposal, type InitRequest } from '../../../core/bootstrap.js';
import { inspectWorkspace } from '../../../core/commands.js';
import { canonical, diagnostic, Failure, requireThat, sha256, validId, type ObjectValue } from '../../../core/common.js';
import { parse } from '../../../core/parsing.js';
import { digest, exists, read, runtime, safePath, statePath, type Runtime } from '../../../core/storage.js';
import { listTracks } from '../../../core/tracks.js';
import type { CapabilityDiagnostic, CapabilityResult, HostCapabilityProfile } from './contract.js';
import { capabilityHostContractVersion } from './contract.js';
import { skillBundleRoot } from './bundles.js';

const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const capabilityId = 'onboarding';
const handoffKeys = ['contract_version', 'capability_id', 'action', 'workspace', 'operation_id', 'proposal_digest', 'expected_state_digests', 'input'];

export interface OnboardingInput {
  display_name?: string;
  goals?: string[];
  assistance_default_max?: number;
  operation_id?: string;
  track_id?: string;
  constraints?: string[];
}

export interface OnboardingHandoff {
  contract_version: '1.0';
  capability_id: 'onboarding';
  action: 'initialize' | 'select-track' | 'complete-onboarding';
  workspace: string;
  operation_id: string;
  proposal_digest: string;
  expected_state_digests: Record<string, string | null>;
  input: ObjectValue;
}

function normalized(host: string, outcome: CapabilityResult['outcome'], confirmed: ObjectValue, unverified: ObjectValue, diagnostics: CapabilityDiagnostic[], nextAction: ObjectValue | null): CapabilityResult {
  return { contract_version: capabilityHostContractVersion, capability_id: capabilityId, host, outcome, confirmed, unverified, diagnostics, next_action: nextAction };
}

function missing(host: string, field: string, message: string): CapabilityResult {
  return normalized(host, 'needs-input', {}, {}, [{ code: 'INPUT_REQUIRED', path: field, message }], { ask: field });
}

function stateDigests(root: string, rt: Runtime): Record<string, string | null> {
  const entries: [string, string][] = [];
  const walk = (directory: string): void => {
    for (const entry of rt.fs.readdirSync(safePath(root, directory, rt), { withFileTypes: true })) {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) walk(relative);
      else if (entry.isFile()) entries.push([relative, digest(root, relative, rt)!]);
    }
  };
  walk('.apprenticeship'); entries.sort(([a], [b]) => a.localeCompare(b));
  return { ...Object.fromEntries(entries), '@state-tree': sha256(canonical(entries)) };
}

function shellQuote(value: string): string { return `'${value.replaceAll("'", "'\\''")}'`; }

function handoff(host: string, root: string, action: OnboardingHandoff['action'], operationId: string, input: ObjectValue, expected: Record<string, string | null>): CapabilityResult {
  const proposal_digest = `sha256:${sha256(canonical({ action, workspace: root, operation_id: operationId, expected_state_digests: expected, input }))}`;
  const payload: OnboardingHandoff = { contract_version: '1.0', capability_id: 'onboarding', action, workspace: root, operation_id: operationId, proposal_digest, expected_state_digests: expected, input };
  const token = Buffer.from(canonical(payload), 'utf8').toString('base64url');
  const command = `noetherkin adapter-handoff --workspace ${shellQuote(root)} --handoff ${token}`;
  return normalized(host, 'consent-required', { workspace: root, operation_id: operationId, proposal_digest, action }, { environment_constraints: input.constraints ?? [] }, [], { kind: 'terminal-handoff', command, token });
}

function initInput(input: OnboardingInput): InitRequest | CapabilityResult {
  if (typeof input.display_name !== 'string' || !input.display_name.trim()) return missing('', 'display_name', 'What name should this apprenticeship workspace use?');
  if (!Array.isArray(input.goals) || input.goals.length === 0) return missing('', 'goals', 'What engineering goal should this apprenticeship support?');
  if (!Number.isInteger(input.assistance_default_max)) return missing('', 'assistance_default_max', 'What assistance ceiling from 0 through 7 should be the default?');
  return { display_name: input.display_name, goals: input.goals, assistance_default_max: input.assistance_default_max! };
}

export function prepareOnboarding(host: string, workspace: string, rawInput: ObjectValue, rt: Runtime = runtime): CapabilityResult {
  const root = fs.realpathSync(workspace);
  const input = rawInput as OnboardingInput;
  try {
    if (!exists(safePath(root, '.apprenticeship', rt), rt)) {
      const request = initInput(input);
      if ('outcome' in request) return { ...request, host };
      const proposal = proposeInit(request, input.operation_id, rt);
      return handoff(host, root, 'initialize', proposal.operation_id, { proposal }, { '.apprenticeship': null });
    }
    const inspection = inspectWorkspace('validate', root, rt);
    if (inspection.outcome !== 'success') return normalized(host, 'blocked', {}, {}, inspection.diagnostics, { command: 'noetherkin doctor' });
    const profile = parse(read(root, statePath('profile.yaml'), rt), statePath('profile.yaml'));
    if (profile.onboarding === 'complete') return normalized(host, 'no-change', { workspace: root, onboarding: 'complete', baseline_assessment_id: profile.baseline_assessment_id, readiness: 'ready' }, {}, [], inspection.data.next_action ?? null);
    const currentTrack = parse(read(root, statePath('current-track.yaml'), rt), statePath('current-track.yaml'));
    if (!currentTrack.track_id) {
      if (typeof input.track_id !== 'string' || !input.track_id) return missing(host, 'track_id', 'Which catalog track do you want to select?');
      listTracks(input.track_id);
      return handoff(host, root, 'select-track', input.operation_id ?? rt.id('OP'), { track_id: input.track_id }, stateDigests(root, rt));
    }
    return handoff(host, root, 'complete-onboarding', input.operation_id ?? rt.id('OP'), { constraints: input.constraints ?? [] }, stateDigests(root, rt));
  } catch (error) {
    return normalized(host, 'blocked', {}, {}, [diagnostic(error)], null);
  }
}

export function decodeOnboardingHandoff(token: string): OnboardingHandoff {
  let payload: ObjectValue;
  try { payload = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')); }
  catch { throw new Failure('HANDOFF_INVALID', 'handoff', 'The onboarding handoff is not valid base64url JSON.'); }
  requireThat(payload && typeof payload === 'object' && !Array.isArray(payload) && canonical(Object.keys(payload).sort()) === canonical([...handoffKeys].sort()), 'HANDOFF_INVALID', 'handoff', 'The onboarding handoff envelope is not closed.');
  requireThat(payload.contract_version === '1.0' && payload.capability_id === 'onboarding' && ['initialize', 'select-track', 'complete-onboarding'].includes(payload.action), 'HANDOFF_INVALID', 'handoff', 'Unsupported onboarding handoff version, capability, or action.');
  requireThat(typeof payload.workspace === 'string' && validId(payload.operation_id, 'OP') && /^sha256:[a-f0-9]{64}$/.test(payload.proposal_digest), 'HANDOFF_INVALID', 'handoff', 'Malformed onboarding handoff identity.');
  const expected = `sha256:${sha256(canonical({ action: payload.action, workspace: payload.workspace, operation_id: payload.operation_id, expected_state_digests: payload.expected_state_digests, input: payload.input }))}`;
  requireThat(expected === payload.proposal_digest, 'HANDOFF_CHANGED', 'handoff', 'The onboarding handoff content does not match its proposal digest.');
  return payload as OnboardingHandoff;
}

export function validateOnboardingHandoff(root: string, payload: OnboardingHandoff, rt: Runtime = runtime): void {
  requireThat(fs.realpathSync(root) === payload.workspace, 'HANDOFF_CHANGED', root, 'The handoff belongs to a different workspace.');
  for (const [file, expected] of Object.entries(payload.expected_state_digests)) {
    if (file === '.apprenticeship') requireThat(!exists(safePath(root, file, rt), rt) && expected === null, 'STALE_READ', file, 'The workspace appeared after the onboarding proposal.');
    else if (file === '@state-tree') requireThat(stateDigests(root, rt)['@state-tree'] === expected, 'STALE_READ', file, 'The workspace file set changed after the onboarding proposal. Prepare a fresh handoff.');
    else requireThat(digest(root, file, rt) === expected, 'STALE_READ', file, 'Workspace state changed after the onboarding proposal. Prepare a fresh handoff.');
  }
  if (payload.action === 'initialize') {
    const proposal = payload.input.proposal as InitProposal;
    requireThat(proposal?.operation_id === payload.operation_id, 'HANDOFF_CHANGED', 'operation_id', 'Initialization proposal and handoff operation differ.');
  }
}

export function onboardingBundleRoot(): string { return skillBundleRoot(capabilityId); }
