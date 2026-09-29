import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync, type ChildProcess, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from 'node:child_process';

/**
 * Starting external programs the same way on every platform.
 *
 * On macOS and Linux this is plain `spawn`. On Windows, tools installed through npm (codex, claude, tsc) are `.cmd`
 * shims, which Node refuses to start without a shell, and a bare command name must be resolved against PATHEXT.
 * A `.cmd` or `.bat` file is run through `cmd.exe` with every argument escaped for cmd's parser, following the
 * rules cross-spawn uses, so arguments such as JSON configuration reach the program intact and are never
 * interpreted as shell syntax.
 */

const isWindows = process.platform === 'win32';
const metaCharacters = /([()\][%!^"`<>&|;, *?])/g;

function isFile(file: string): boolean {
  try { return fs.statSync(file).isFile(); } catch { return false; }
}

/** The file Windows would run for `command`, searching PATH and PATHEXT the way cmd does. POSIX returns it unchanged. */
export function resolveCommand(command: string, env: NodeJS.ProcessEnv = process.env): string {
  if (!isWindows) return command;
  const extensions = (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const candidates = (base: string): string[] => (path.extname(base) ? [base] : []).concat(extensions.map(extension => base + extension.toLowerCase()));
  if (command.includes('/') || command.includes('\\') || path.isAbsolute(command)) return candidates(command).find(isFile) ?? command;
  for (const directory of [process.cwd(), ...(env.PATH ?? env.Path ?? '').split(path.delimiter)].filter(Boolean)) {
    const found = candidates(path.join(directory, command)).find(isFile);
    if (found) return found;
  }
  return command;
}

function escapeArgument(argument: string, doubleEscape: boolean): string {
  // Double every backslash run that precedes a quote or the end, escape quotes, wrap in quotes, then caret-escape
  // cmd metacharacters. A shim that re-expands %* parses the line a second time, so it needs a second escape.
  let escaped = argument.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
  escaped = `"${escaped}"`.replace(metaCharacters, '^$1');
  return doubleEscape ? escaped.replace(metaCharacters, '^$1') : escaped;
}

/** An npm cmd-shim forwards `%*` to node, which makes cmd parse the arguments twice. */
function forwardsArguments(file: string): boolean {
  try { return /%\*/.test(fs.readFileSync(file, 'utf8').slice(0, 4_000)); } catch { return false; }
}

/** The program, arguments and options that actually start `command` on this platform. */
export function commandLine(command: string, args: readonly string[]): { file: string; args: string[]; windowsVerbatimArguments?: boolean } {
  if (!isWindows) return { file: command, args: [...args] };
  const resolved = resolveCommand(command);
  if (!/\.(cmd|bat)$/i.test(resolved)) return { file: resolved, args: [...args] };
  const doubleEscape = forwardsArguments(resolved);
  // The unquoted program path also ends at `=`, a cmd delimiter that cross-spawn's set leaves out; arguments are quoted.
  const line = [resolved.replace(metaCharacters, '^$1').replace(/=/g, '^='), ...args.map(argument => escapeArgument(argument, doubleEscape))].join(' ');
  return { file: process.env.comspec ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`], windowsVerbatimArguments: true };
}

/** Starts `command` with piped stdin, stdout and stderr. */
export function spawnCommand(command: string, args: readonly string[], options: SpawnOptionsWithoutStdio = {}): ChildProcessWithoutNullStreams {
  const line = commandLine(command, args);
  return spawn(line.file, line.args, { ...options, ...(line.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}) });
}

export function spawnCommandSync(command: string, args: readonly string[], options: SpawnSyncOptionsWithStringEncoding): SpawnSyncReturns<string> {
  const line = commandLine(command, args);
  return spawnSync(line.file, line.args, { ...options, ...(line.windowsVerbatimArguments ? { windowsVerbatimArguments: true } : {}) });
}

/**
 * Stops a child and everything it started. On Windows a `.cmd` host runs under cmd.exe, and killing cmd.exe alone
 * would leave the host itself running, so the whole tree is ended with taskkill.
 */
export function terminate(child: ChildProcess): void {
  if (isWindows && child.pid !== undefined) {
    const result = spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    if (result.status === 0) return;
  }
  child.kill('SIGTERM');
}
