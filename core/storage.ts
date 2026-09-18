import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { Failure, requireThat, encode, sha256 } from './common.js';

export interface Runtime {
  fs: typeof fs;
  now: () => string;
  id: (prefix: string) => string;
  /** Test-only fault boundary; production never reads fault instructions from environment or state. */
  boundary: (name: string) => void;
}
export const runtime: Runtime = { fs, now: () => new Date().toISOString(), id: p => `${p}-${randomUUID()}`, boundary: () => {} };
export const statePath = (relative: string): string => `.apprenticeship/${relative}`;
const heldLocks = new Map<string, string>();
export function assertLock(root: string, rt = runtime): void {
  const token = heldLocks.get(root);
  requireThat(token && JSON.parse(read(root, '.apprenticeship.lock/owner.json', rt).toString()).token === token, 'LOCK_LOST', root, 'Lock ownership changed; stop publication and inspect recovery state.');
}

/** Reject symlinks in state paths, including existing parent components of absent targets. */
export function safePath(root: string, relative: string, rt = runtime): string {
  requireThat(rt.fs.realpathSync(root) === root && rt.fs.lstatSync(root).isDirectory(), 'UNSAFE_PATH', root, 'Workspace root must remain the resolved directory approved by the caller.');
  requireThat(relative.length > 0 && !path.isAbsolute(relative) && !relative.includes('\\') && !relative.includes('\0') && relative.split('/').every(p => p !== '..' && p !== '.' && p !== ''), 'UNSAFE_PATH', relative, 'Use a workspace-relative path without traversal.');
  let current = root;
  for (const component of relative.split('/')) {
    current = path.join(current, component);
    try { requireThat(!rt.fs.lstatSync(current).isSymbolicLink(), 'UNSAFE_PATH', relative, 'State paths must not contain symbolic links.'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
  return current;
}
export function exists(file: string, rt = runtime): boolean {
  try { rt.fs.lstatSync(file); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
}
export function read(root: string, relative: string, rt = runtime): Buffer {
  const file = safePath(root, relative, rt);
  requireThat(rt.fs.lstatSync(file).isFile(), 'NOT_FILE', relative, 'Expected a regular file.');
  return rt.fs.readFileSync(file);
}
export function digest(root: string, relative: string, rt = runtime): string | null {
  return exists(safePath(root, relative, rt), rt) ? sha256(read(root, relative, rt)) : null;
}
export function syncDirectory(directory: string, rt = runtime): void {
  const fd = rt.fs.openSync(directory, 'r');
  try { rt.fs.fsyncSync(fd); } finally { rt.fs.closeSync(fd); }
}
export function mkdir(root: string, relative: string, rt = runtime): void {
  const components = relative.split('/');
  for (let i = 1; i <= components.length; i++) {
    const target = safePath(root, components.slice(0, i).join('/'), rt);
    if (!exists(target, rt)) { rt.fs.mkdirSync(target, { mode: 0o700 }); syncDirectory(path.dirname(target), rt); }
    requireThat(rt.fs.lstatSync(target).isDirectory(), 'NOT_DIRECTORY', target, 'Expected a directory.');
  }
}
/** Atomic replacement is used only for private metadata, never unchecked canonical files. */
export function durable(root: string, relative: string, bytes: string | Buffer, rt = runtime, createOnly = false): void {
  mkdir(root, path.posix.dirname(relative), rt);
  const target = safePath(root, relative, rt);
  const temp = `${target}.tmp-${randomUUID()}`;
  const fd = rt.fs.openSync(temp, 'wx', 0o600);
  try { rt.fs.writeFileSync(fd, bytes); rt.fs.fsyncSync(fd); } finally { rt.fs.closeSync(fd); }
  if (createOnly) {
    // Atomic no-clobber publication: a file appearing after the digest check wins.
    try { rt.fs.linkSync(temp, target); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') { rt.fs.unlinkSync(temp); throw new Failure('STALE_READ', relative, 'A file appeared during publication; it was not overwritten.'); } throw e; }
    rt.fs.unlinkSync(temp);
  } else rt.fs.renameSync(temp, target);
  syncDirectory(path.dirname(target), rt);
}
export function remove(root: string, relative: string, rt = runtime): void {
  rt.fs.unlinkSync(safePath(root, relative, rt));
  syncDirectory(path.dirname(safePath(root, relative, rt)), rt);
}

export function resolveWorkspace(input: string | undefined, initialize = false, rt = runtime): string {
  let directory = rt.fs.realpathSync(path.resolve(input ?? process.cwd()));
  requireThat(rt.fs.statSync(directory).isDirectory(), 'NOT_DIRECTORY', directory, 'Choose an existing workspace directory.');
  if (input || initialize) return directory;
  while (true) {
    if (exists(path.join(directory, '.apprenticeship'), rt) || exists(path.join(directory, '.apprenticeship.lock'), rt)) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) throw new Failure('WORKSPACE_NOT_FOUND', process.cwd(), 'Run init in an existing workspace directory or pass --workspace.');
    directory = parent;
  }
}

export function withLock<T>(root: string, action: () => T, rt = runtime): T {
  const lock = safePath(root, '.apprenticeship.lock', rt);
  if (exists(safePath(root, '.apprenticeship.reclaim', rt), rt)) throw new Failure('LOCK_BUSY', lock, 'Lock recovery is in progress; retry after it finishes.', 3);
  try { rt.fs.mkdirSync(lock, { mode: 0o700 }); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new Failure('LOCK_BUSY', lock, 'Workspace is locked. Use doctor; never remove a lock based on age.', 3); throw e; }
  const token = randomUUID();
  try {
    // Locks coordinate live processes. Only publication data needs durability; readers must
    // still work on platforms without directory fsync support.
    rt.fs.writeFileSync(safePath(root, '.apprenticeship.lock/owner.json', rt), encode({ pid: process.pid, host: os.hostname(), token }), { flag: 'wx', mode: 0o600 });
    heldLocks.set(root, token);
    return action();
  } finally {
    // Losing the lock must never cause us to remove someone else's lock.
    const owner = JSON.parse(read(root, '.apprenticeship.lock/owner.json', rt).toString());
    requireThat(owner.token === token, 'LOCK_LOST', lock, 'Lock ownership changed; inspect pending publication.');
    heldLocks.delete(root);
    rt.fs.unlinkSync(safePath(root, '.apprenticeship.lock/owner.json', rt));
    rt.fs.rmdirSync(lock);
  }
}

/** Only an explicit recovery invocation may reclaim a provably dead local owner. */
export function reclaimDeadLock(root: string, rt = runtime): void {
  const lock = safePath(root, '.apprenticeship.lock', rt);
  if (!exists(lock, rt)) return;
  const guard = safePath(root, '.apprenticeship.reclaim', rt);
  try { rt.fs.mkdirSync(guard, { mode: 0o700 }); }
  catch { throw new Failure('LOCK_AMBIGUOUS', guard, 'Another recovery or an interrupted reclamation requires inspection.', 3); }
  try {
    const owner = JSON.parse(read(root, '.apprenticeship.lock/owner.json', rt).toString());
    requireThat(owner.host === os.hostname() && Number.isInteger(owner.pid) && owner.pid > 0 && typeof owner.token === 'string', 'LOCK_AMBIGUOUS', lock, 'Cannot establish a local owner; preserve the lock.');
    let dead = false;
    try { process.kill(owner.pid, 0); } catch (e) { dead = (e as NodeJS.ErrnoException).code === 'ESRCH'; }
    requireThat(dead, 'LOCK_BUSY', lock, 'Owner is alive or unverifiable; do not reclaim this lock.');
    requireThat(rt.fs.readdirSync(lock).length === 1, 'LOCK_AMBIGUOUS', lock, 'Unexpected lock contents require inspection.');
    remove(root, '.apprenticeship.lock/owner.json', rt);
    rt.fs.rmdirSync(lock);
    syncDirectory(root, rt);
  } finally { rt.fs.rmdirSync(guard); syncDirectory(root, rt); }
}

export function lockStatus(root: string, rt = runtime): Record<string, unknown> {
  const file = '.apprenticeship.lock/owner.json';
  try {
    const owner = JSON.parse(read(root, file, rt).toString());
    let status = 'unverifiable';
    if (owner.host === os.hostname() && Number.isInteger(owner.pid) && owner.pid > 0) {
      try { process.kill(owner.pid, 0); status = 'alive'; }
      catch (e) { if ((e as NodeJS.ErrnoException).code === 'ESRCH') status = 'dead'; }
    }
    return { owner_pid: owner.pid, owner_host: owner.host, owner_status: status, next_action: status === 'dead' ? 'Run doctor --recover to review dead-lock reclamation and pending recovery.' : 'Wait for the active owner, or inspect an unverifiable owner manually. Age alone never permits reclamation.' };
  } catch { return { owner_status: 'ambiguous', next_action: 'Preserve the lock. Missing or malformed owner metadata requires manual inspection.' }; }
}
