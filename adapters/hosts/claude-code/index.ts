import { spawnSync } from 'node:child_process';
import { GenericCapabilityHostAdapter, type HostProbe } from '../generic/index.js';

export class ClaudeCodeCapabilityHostAdapter extends GenericCapabilityHostAdapter {
  constructor(private readonly binary = 'claude') {
    super({
      host: 'claude-code', installation: ['project skill directory', 'personal skill directory', 'plugin skill directory'],
      arguments: 'both', workspace_context: 'both',
      tools: { configurable: true, isolation: 'Host permissions control tools; canonical writes remain behind the local controller.' }, structured_results: true, session_continuation: true,
      degradation: 'If skill discovery or permissions cannot be verified, return the generic proposal and terminal handoff.'
    });
  }
  protected override targetRoot(capabilityId: string): string { return `.claude/skills/${capabilityId}`; }
  protected override invocationSurface(capabilityId: string): string { return `/${capabilityId}`; }
  override probe(): HostProbe {
    const result = spawnSync(this.binary, ['--version'], { encoding: 'utf8', timeout: 5_000 });
    return { host: this.profile.host, available: result.status === 0, version: result.status === 0 ? (result.stdout || result.stderr).trim() || null : null, limitations: [this.profile.degradation] };
  }
}
