import { spawnSync } from 'node:child_process';
import { Failure } from '../../core/common.js';
import type { RoleAdapter } from '../../core/adapters.js';
import { CodexRoleAdapter } from './codex.js';
import { ClaudeRoleAdapter } from './claude.js';
import { resolveCodexBinary, type CodexLookup } from './codex-binary.js';

export type RoleAdapterName = 'codex' | 'claude';
export const roleAdapterNames: RoleAdapterName[] = ['codex', 'claude'];

export interface RoleAdapterRequest {
  name?: string;
  codex_bin?: string;
  claude_bin?: string;
  model?: string;
}

/**
 * `spawnable`: the binary starts at all. `healthy`: it also answered `--version` successfully. `source` says why this
 * binary was chosen; `alternatives` names other installed binaries for the same host that were not chosen.
 */
export interface RoleHostProbe { adapter: RoleAdapterName; binary: string; source: string; alternatives: string[]; spawnable: boolean; healthy: boolean; version: string | null }

/** The binary each adapter would run, resolved exactly as the adapter constructors resolve it, and why. */
function resolveRoleBinary(name: RoleAdapterName, request: RoleAdapterRequest, lookup: CodexLookup): { binary: string; source: string; alternatives: string[] } {
  if (name === 'codex') return resolveCodexBinary(request.codex_bin, lookup);
  const env = lookup.env ?? process.env;
  if (request.claude_bin) return { binary: request.claude_bin, source: 'flag', alternatives: [] };
  if (env.NOETHERKIN_CLAUDE_BIN) return { binary: env.NOETHERKIN_CLAUDE_BIN, source: 'env', alternatives: [] };
  return { binary: 'claude', source: 'default', alternatives: [] };
}

export function roleBinary(name: RoleAdapterName, request: RoleAdapterRequest = {}): string {
  return resolveRoleBinary(name, request, {}).binary;
}

/**
 * An explicitly chosen host only has to start: a nonzero `--version` exit is left for the real invocation to report
 * in the host's own words. Auto-detection is stricter and uses `healthy`.
 */
export function probeRoleHost(name: RoleAdapterName, request: RoleAdapterRequest = {}, lookup: CodexLookup = {}): RoleHostProbe {
  const { binary, source, alternatives } = resolveRoleBinary(name, request, lookup);
  const result = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 5_000 });
  // A timeout means the process started, so only a failure to launch at all marks the host unavailable.
  const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
  const spawnable = !result.error || !['ENOENT', 'EACCES', 'ENOTDIR'].includes(String(code));
  const version = spawnable && result.status === 0 ? (result.stdout || result.stderr || '').trim().split('\n')[0] || null : null;
  return { adapter: name, binary, source, alternatives, spawnable, healthy: spawnable && result.status === 0, version };
}

function unavailable(detail: string): Failure {
  return new Failure('ROLE_ADAPTER_UNAVAILABLE', 'role-adapter',
    `${detail} Role judgments need Codex or Claude Code installed and signed in. Install one, or point at it with --codex-bin or --claude-bin, or choose explicitly with --role-adapter codex|claude.`, 2);
}

/**
 * Chooses the role adapter. Precedence: --role-adapter, then NOETHERKIN_ROLE_ADAPTER, then a binary override flag
 * (which names its adapter), then the first spawnable host in the order codex, claude. The chosen binary is checked
 * before any learner confirmation is requested, so a missing host fails early instead of after consent.
 */
export function selectRoleAdapter(request: RoleAdapterRequest): RoleAdapter {
  const explicit = request.name ?? process.env.NOETHERKIN_ROLE_ADAPTER;
  let name: RoleAdapterName | undefined;
  if (explicit !== undefined) {
    if (!roleAdapterNames.includes(explicit as RoleAdapterName)) throw new Failure('USAGE', 'role-adapter', 'Choose --role-adapter codex or claude.', 2);
    name = explicit as RoleAdapterName;
  } else if (request.codex_bin && !request.claude_bin) name = 'codex';
  else if (request.claude_bin && !request.codex_bin) name = 'claude';
  if (name) {
    const probe = probeRoleHost(name, request);
    if (!probe.spawnable) throw unavailable(`The ${name} role adapter cannot start '${probe.binary}'.`);
  } else {
    // Auto-detection demands a healthy host, so a broken wrapper on PATH does not win over a working alternative.
    name = roleAdapterNames.find(candidate => probeRoleHost(candidate, request).healthy);
    if (!name) throw unavailable('Neither codex nor claude answered --version.');
  }
  return name === 'claude'
    ? new ClaudeRoleAdapter({ binary: request.claude_bin, model: request.model })
    : new CodexRoleAdapter({ binary: request.codex_bin, model: request.model });
}

export interface LazyRoleAdapter extends RoleAdapter {
  /** Selects and checks the host now. Call before any learner confirmation that precedes a judgment. */
  resolve(): RoleAdapter;
}

/**
 * Defers selection until a judgment is actually needed, so commands that may not need one (such as `next`) never
 * fail on host configuration. `notify` receives a one-line progress message before each judgment.
 */
export function lazyRoleAdapter(request: RoleAdapterRequest, notify?: (message: string) => void): LazyRoleAdapter {
  let selected: RoleAdapter | undefined;
  const resolve = (): RoleAdapter => (selected ??= selectRoleAdapter(request));
  return {
    get name() { return resolve().name; },
    resolve,
    async invoke(invocation) {
      const adapter = resolve();
      notify?.(`Asking the ${invocation.actor.role.replaceAll('-', ' ')} for a judgment through ${adapter.name}. This can take a few minutes.`);
      return adapter.invoke(invocation);
    }
  };
}

const sourceLabels: Record<RoleAdapterName, Record<string, string>> = {
  codex: { flag: 'from --codex-bin', env: 'from NOETHERKIN_CODEX_BIN', path: 'from PATH', bundled: 'bundled with the ChatGPT app', default: 'default command' },
  claude: { flag: 'from --claude-bin', env: 'from NOETHERKIN_CLAUDE_BIN', default: 'default command' }
};

/** Why a probe used its binary, plus any other installed binary for that host, for setup and doctor output. */
function provenance(probe: RoleHostProbe): string {
  const also = probe.alternatives.length ? `; also found ${probe.alternatives.join(', ')}` : '';
  return `${sourceLabels[probe.adapter][probe.source] ?? probe.source}${also}`;
}

/** Role hosts as environment checks, for `setup` and `doctor`. `lookup` exists for tests. */
export function roleHostChecks(request: RoleAdapterRequest = {}, lookup: CodexLookup = {}): { check: string; status: 'ok' | 'missing' | 'warn'; detail: string; remedy: string | null }[] {
  const probes = roleAdapterNames.map(name => probeRoleHost(name, request, lookup));
  const any = probes.some(probe => probe.healthy);
  return probes.map(probe => ({
    check: `role-host:${probe.adapter}`,
    status: probe.healthy ? 'ok' : any ? 'warn' : 'missing',
    detail: probe.healthy ? `${probe.version ?? 'available'} (${probe.binary}, ${provenance(probe)})` : probe.spawnable ? `${probe.binary} started but did not answer --version (${provenance(probe)})` : `${probe.binary} not found (${provenance(probe)})`,
    remedy: probe.healthy ? null : any ? 'Optional: another role host is available.' : 'Install Codex or Claude Code and sign in; role judgments need one of them.'
  }));
}
