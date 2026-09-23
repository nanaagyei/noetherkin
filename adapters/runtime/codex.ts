import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { contextDigest, validateRoleOutput, type RoleAdapter, type RoleInvocation, type RoleInvocationResult } from '../../core/adapters.js';
import { Failure, requireThat, type ObjectValue } from '../../core/common.js';
import { rolePrompt } from './output-contract.js';

export { roleOutputContract } from './output-contract.js';

export interface CodexAdapterOptions { binary?: string; model?: string; timeout_ms?: number }

function extractOutput(stdout: string): { output: ObjectValue; model: string | null } {
  let text: string | undefined;
  let model: string | null = null;
  for (const line of stdout.split('\n').filter(Boolean)) {
    let event: any;
    try { event = JSON.parse(line); } catch { continue; }
    if (event.type === 'thread.started') model = event.model ?? model;
    if (event.type === 'item.completed' && event.item?.type === 'agent_message') text = event.item.text;
    if (event.type === 'turn.failed' || event.type === 'error') throw new Failure('ADAPTER_FAILED', 'codex', JSON.stringify(event));
  }
  requireThat(text, 'ADAPTER_INVALID', 'codex', 'Codex returned no completed agent message.');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  try { return { output: JSON.parse(fenced.trim()), model }; }
  catch { throw new Failure('ADAPTER_INVALID', 'codex', 'Codex must return exactly one JSON object matching the requested keys.'); }
}

export class CodexRoleAdapter implements RoleAdapter {
  readonly name = 'codex';
  private readonly binary: string;
  private readonly model?: string;
  private readonly timeout: number;
  constructor(options: CodexAdapterOptions = {}) {
    const bundled = '/Applications/ChatGPT.app/Contents/Resources/codex';
    this.binary = options.binary ?? process.env.NOETHERKIN_CODEX_BIN ?? (fs.existsSync(bundled) ? bundled : 'codex');
    this.model = options.model;
    this.timeout = options.timeout_ms ?? 300_000;
  }
  async invoke(request: RoleInvocation): Promise<RoleInvocationResult> {
    requireThat(request.context_digest === contextDigest(request.context), 'CONTEXT_CHANGED', request.skill, 'Role context no longer matches its bound digest.');
    const prompt = rolePrompt(request);
    const config: Record<string, unknown> = {
      approval_policy: 'never', sandbox_mode: 'read-only', project_doc_max_bytes: 0, web_search: 'disabled',
      'features.shell_tool': false, 'features.hooks': false, 'features.multi_agent': false,
      'features.plugins': false, 'features.skill_search': false, 'features.skip_host_skill_discovery': true,
      'features.memories': false, 'features.browser_use': false, 'features.browser_use_external': false,
      'features.in_app_browser': false, 'features.image_generation': false, 'features.view_image': false,
      'apps._default.enabled': false
    };
    const args = ['exec', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--json', ...Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${JSON.stringify(value)}`]), ...(this.model ? ['--model', this.model] : []), '-'];
    const transcript = await new Promise<string>((resolve, reject) => {
      const child = spawn(this.binary, args, { cwd: request.workspace, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Failure('ADAPTER_TIMEOUT', 'codex', 'Codex role invocation exceeded its deadline.')); }, this.timeout);
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout) : reject(new Failure('ADAPTER_FAILED', 'codex', stderr || `Codex exited ${code}.`)); });
      child.stdin.end(prompt);
    });
    const parsed = extractOutput(transcript);
    const result = { ...parsed, transcript, context_digest: contextDigest(request.context) };
    validateRoleOutput(result, request.output_keys);
    return result;
  }
}
