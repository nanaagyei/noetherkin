import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Cross-platform helpers for tests that start programs, fake a host binary or drive a real terminal.

export const isWindows = process.platform === 'win32';
const repo = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Writes a Node program at `file` and returns the path to run it by. On macOS and Linux the file itself is made
 * executable with a shebang. On Windows, which cannot run a shebang script, a `<file>.cmd` shim beside it forwards to
 * Node, exactly like the shims npm installs for codex and claude, and the shim is returned.
 */
export function writeProgram(file: string, source: string): string {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `#!${process.execPath}\n${source}`, { mode: 0o755 });
  if (!isWindows) return file;
  // %~dp0 is the shim's own directory, so a path containing % or ! is never re-expanded inside the batch file.
  fs.writeFileSync(`${file}.cmd`, `@"${process.execPath}" "%~dp0${path.basename(file)}" %*\r\n`);
  return `${file}.cmd`;
}

/** Runs npm with this Node, so the `.cmd` shim is never involved. `npm_execpath` is set under `npm test`. */
export function npm(args: string[], options: SpawnSyncOptionsWithStringEncoding): SpawnSyncReturns<string> {
  return process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], options)
    : spawnSync('npm', args, { ...options, shell: isWindows });
}

/**
 * Drives the real CLI terminal controller in a pseudo-terminal and answers its consent prompt. POSIX uses the Python
 * `pty` harness; Windows uses ConPTY through node-pty (installed by the Windows CI job). Both print the same JSON.
 */
export function inTerminal(node: string, executable: string, workspace: string, answer: string, ...extra: string[]): SpawnSyncReturns<string> {
  const harness = isWindows ? [process.execPath, path.join(repo, 'tests/terminal-win.mjs')] : ['python3', path.join(repo, 'tests/terminal.py')];
  return spawnSync(harness[0]!, [harness[1]!, node, executable, workspace, answer, ...extra], { encoding: 'utf8', timeout: 30_000 });
}

/**
 * Asserts that a worker died abruptly at its kill point. POSIX reports SIGKILL. Windows has no signals: the worker's
 * self-kill is TerminateProcess with exit code 1, so the worker announces the kill point first and the test checks it.
 */
export function assertKilled(run: SpawnSyncReturns<string>): void {
  if (!isWindows) { assert.equal(run.signal, 'SIGKILL', run.stderr); return; }
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stdout, /killing\n?$/, 'the worker reached its kill point');
}
