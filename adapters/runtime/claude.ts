import { spawn } from 'node:child_process';
import { contextDigest, validateRoleOutput, type RoleAdapter, type RoleInvocation, type RoleInvocationResult } from '../../core/adapters.js';
import { Failure, requireThat, type ObjectValue } from '../../core/common.js';
import { rolePrompt } from './output-contract.js';

export interface ClaudeAdapterOptions { binary?: string; model?: string; timeout_ms?: number }

// A role judgment needs no tools, no project instructions and no session history. Safe and restricted modes drop
// customizations and settings files, the empty MCP config and `--tools ""` remove every tool, and nothing is saved.
export function claudeRoleArgs(model?: string): string[] {
  return ['--print', '--output-format', 'json', '--safe-mode', '--restricted', '--disable-slash-commands',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-chrome', '--no-session-persistence',
    '--permission-mode', 'dontAsk', ...(model ? ['--model', model] : []), '--tools', ''];
}

export function extractClaudeOutput(stdout: string): { output: ObjectValue; model: string | null } {
  let envelope: any;
  try { envelope = JSON.parse(stdout.trim()); }
  catch { throw new Failure('ADAPTER_INVALID', 'claude', 'Claude returned no JSON result envelope.'); }
  if (envelope?.is_error === true || envelope?.subtype !== 'success') throw new Failure('ADAPTER_FAILED', 'claude', JSON.stringify({ subtype: envelope?.subtype ?? null, result: envelope?.result ?? null }));
  const text = envelope.result;
  requireThat(typeof text === 'string' && text.trim().length > 0, 'ADAPTER_INVALID', 'claude', 'Claude returned no result text.');
  const models = envelope.modelUsage && typeof envelope.modelUsage === 'object' ? Object.keys(envelope.modelUsage) : [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  try { return { output: JSON.parse(fenced.trim()), model: models[0] ?? null }; }
  catch { throw new Failure('ADAPTER_INVALID', 'claude', 'Claude must return exactly one JSON object matching the requested keys.'); }
}

export class ClaudeRoleAdapter implements RoleAdapter {
  readonly name = 'claude';
  private readonly binary: string;
  private readonly model?: string;
  private readonly timeout: number;
  constructor(options: ClaudeAdapterOptions = {}) {
    this.binary = options.binary ?? process.env.NOETHERKIN_CLAUDE_BIN ?? 'claude';
    this.model = options.model;
    this.timeout = options.timeout_ms ?? 300_000;
  }
  async invoke(request: RoleInvocation): Promise<RoleInvocationResult> {
    requireThat(request.context_digest === contextDigest(request.context), 'CONTEXT_CHANGED', request.skill, 'Role context no longer matches its bound digest.');
    const transcript = await new Promise<string>((resolve, reject) => {
      const child = spawn(this.binary, claudeRoleArgs(this.model), { cwd: request.workspace, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Failure('ADAPTER_TIMEOUT', 'claude', 'Claude role invocation exceeded its deadline.')); }, this.timeout);
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Failure('ADAPTER_FAILED', 'claude', stderr || stdout.slice(0, 2_000) || `Claude exited ${code}.`)); });
      child.stdin.end(rolePrompt(request));
    });
    const parsed = extractClaudeOutput(transcript);
    const result = { ...parsed, transcript, context_digest: contextDigest(request.context) };
    validateRoleOutput(result, request.output_keys);
    return result;
  }
}
