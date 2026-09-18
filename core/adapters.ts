import { canonical, closed, requireThat, sha256, type ObjectValue } from './common.js';
import type { BoundActor } from './transactions.js';

export interface RoleInvocation {
  workspace: string;
  operation_id: string;
  actor: BoundActor;
  skill: 'onboarding' | 'task-assignment' | 'peer-engineer' | 'code-review' | 'team-lead' | 'manager';
  objective: string;
  context: ObjectValue;
  context_digest: string;
  output_keys: string[];
}
export interface RoleInvocationResult {
  output: ObjectValue;
  transcript: string;
  model: string | null;
  context_digest: string;
}
export interface RoleAdapter {
  readonly name: string;
  invoke(request: RoleInvocation): Promise<RoleInvocationResult>;
}

export function validateRoleOutput(result: RoleInvocationResult, expectedKeys: string[]): void {
  closed(result.output, expectedKeys, 'role-output');
  requireThat(typeof result.transcript === 'string' && result.transcript.length > 0, 'ADAPTER_INVALID', 'transcript', 'Role adapter must retain a nonempty transcript.');
}

export function contextDigest(context: ObjectValue): string {
  return sha256(canonical(context));
}

export class ScriptedRoleAdapter implements RoleAdapter {
  readonly name = 'scripted';
  constructor(private readonly responses: ObjectValue[]) {}
  async invoke(request: RoleInvocation): Promise<RoleInvocationResult> {
    requireThat(request.context_digest === contextDigest(request.context), 'CONTEXT_CHANGED', request.skill, 'Role context no longer matches its bound digest.');
    const output = this.responses.shift();
    requireThat(output, 'ADAPTER_EMPTY', request.skill, 'Scripted adapter has no response for this invocation.');
    const result = { output, transcript: canonical({ request: request.objective, output }), model: 'scripted', context_digest: contextDigest(request.context) };
    validateRoleOutput(result, request.output_keys);
    return result;
  }
}
