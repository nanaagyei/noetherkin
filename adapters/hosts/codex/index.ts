import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { GenericCapabilityHostAdapter, type HostProbe } from '../generic/index.js';

export class CodexCapabilityHostAdapter extends GenericCapabilityHostAdapter {
  constructor(private readonly binary = fs.existsSync('/Applications/ChatGPT.app/Contents/Resources/codex') ? '/Applications/ChatGPT.app/Contents/Resources/codex' : 'codex') {
    super({
      host: 'codex', installation: ['Agent Skills directory'],
      discovery: { automatic: true, explicit: ['$onboarding'] }, arguments: 'both', workspace_context: 'both',
      tools: { configurable: true, isolation: 'Host controls tools; canonical writes remain behind the local controller.' }, structured_results: true, session_continuation: true,
      degradation: 'If skill discovery or isolation is unavailable, return the generic proposal and terminal handoff.'
    });
  }
  protected override targetRoot(): string { return '.codex/skills/onboarding'; }
  override probe(): HostProbe {
    const result = spawnSync(this.binary, ['--version'], { encoding: 'utf8', timeout: 5_000 });
    return { host: this.profile.host, available: result.status === 0, version: result.status === 0 ? (result.stdout || result.stderr).trim() || null : null, limitations: [this.profile.degradation] };
  }
}
