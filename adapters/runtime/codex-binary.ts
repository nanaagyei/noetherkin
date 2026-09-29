import fs from 'node:fs';
import path from 'node:path';

/** The Codex binary the ChatGPT desktop app bundles. It is only a last resort: it is often not signed in for the CLI. */
export const bundledCodexPath = '/Applications/ChatGPT.app/Contents/Resources/codex';

export type CodexSource = 'flag' | 'env' | 'path' | 'bundled' | 'default';
/** `alternatives` lists other Codex binaries that exist but were not chosen, so detection can name them. */
export interface CodexResolution { binary: string; source: CodexSource; alternatives: string[] }
/** Overrides for tests. The CLI always uses the real environment and bundle path. */
export interface CodexLookup { env?: NodeJS.ProcessEnv; bundled?: string }

function executable(file: string): boolean {
  try {
    if (!fs.statSync(file).isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch { return false; }
}

function realpath(file: string): string {
  try { return fs.realpathSync(file); } catch { return file; }
}

/**
 * The first executable named `name` on PATH, resolved the way a shell would. On Windows only PATHEXT names count
 * (`codex.cmd`, `codex.exe`): npm also writes an extensionless POSIX shell script there, which Windows cannot run.
 */
export function findOnPath(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const extensions = process.platform === 'win32' ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean).map(extension => extension.toLowerCase()) : [''];
  for (const directory of (env.PATH ?? env.Path ?? '').split(path.delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = path.join(directory, name + extension);
      if (executable(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * Resolves the Codex binary. Precedence: an explicit `--codex-bin`, then `NOETHERKIN_CODEX_BIN`, then `codex` on
 * PATH, then the ChatGPT app's bundled binary. When nothing is found it returns plain `codex`, so the spawn error
 * names the missing command.
 */
export function resolveCodexBinary(explicit?: string, lookup: CodexLookup = {}): CodexResolution {
  const env = lookup.env ?? process.env;
  const onPath = findOnPath('codex', env);
  const bundledPath = lookup.bundled ?? bundledCodexPath;
  const bundled = executable(bundledPath) ? bundledPath : null;
  const choose = (binary: string, source: CodexSource): CodexResolution => {
    const chosen = realpath(binary);
    const seen = new Set<string>([chosen]);
    const alternatives: string[] = [];
    for (const candidate of [onPath, bundled]) {
      if (candidate === null || seen.has(realpath(candidate))) continue;
      seen.add(realpath(candidate));
      alternatives.push(candidate);
    }
    return { binary, source, alternatives };
  };
  if (explicit) return choose(explicit, 'flag');
  if (env.NOETHERKIN_CODEX_BIN) return choose(env.NOETHERKIN_CODEX_BIN, 'env');
  if (onPath) return choose(onPath, 'path');
  if (bundled) return choose(bundled, 'bundled');
  return { binary: 'codex', source: 'default', alternatives: [] };
}
