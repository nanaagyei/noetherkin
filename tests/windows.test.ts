import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectCatalogProject } from '../core/simulation.js';
import { durable, publicationSupported, retryTransient, safePath } from '../core/storage.js';
import { isWindows } from './support.js';

// Windows-specific guarantees behind ACP-018. They are skipped elsewhere; the POSIX equivalents live in the
// bootstrap and transaction suites, which also run on Windows in CI.
const windowsOnly = { skip: !isWindows && 'Windows-only behavior' };

function workspace(t: { after: (fn: () => void) => void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-windows-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('publication is supported on macOS, Linux and Windows only', () => {
  assert.equal(publicationSupported('win32'), true);
  assert.equal(publicationSupported('darwin'), true);
  assert.equal(publicationSupported('linux'), true);
  assert.equal(publicationSupported('freebsd'), false);
});

test('FR-62: a directory junction in a state path is rejected like a symbolic link', windowsOnly, t => {
  const root = workspace(t);
  const outside = workspace(t);
  fs.symlinkSync(outside, path.join(root, 'escape'), 'junction');
  assert.throws(() => safePath(root, 'escape/file'), /symbolic links/);
});

test('FR-63: a source checkout on another drive is refused, not treated as inside the workspace', windowsOnly, t => {
  const root = workspace(t);
  const otherDrive = ['C:\\', 'D:\\'].find(drive => fs.existsSync(drive) && path.parse(root).root.toUpperCase() !== drive);
  if (!otherDrive) { t.skip('no second drive on this machine'); return; }
  assert.throws(() => inspectCatalogProject(root, 'spring-petclinic-microservices', otherDrive), { code: 'UNSAFE_PATH' });
});

test('durable replacement works without directory fsync and replaces an existing file', windowsOnly, t => {
  const root = workspace(t);
  durable(root, 'state/record.json', 'first');
  durable(root, 'state/record.json', 'second');
  assert.equal(fs.readFileSync(path.join(root, 'state', 'record.json'), 'utf8'), 'second');
  assert.deepEqual(fs.readdirSync(path.join(root, 'state')), ['record.json'], 'no temporary file is left behind');
});

test('a transient sharing violation is retried, and a persistent one is reported', windowsOnly, () => {
  let attempts = 0;
  assert.equal(retryTransient(() => { if (++attempts < 3) throw Object.assign(new Error('busy'), { code: 'EPERM' }); return 'done'; }), 'done');
  assert.equal(attempts, 3);
  assert.throws(() => retryTransient(() => { throw Object.assign(new Error('busy'), { code: 'EBUSY' }); }), /busy/);
  assert.throws(() => retryTransient(() => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); }), /gone/);
});
