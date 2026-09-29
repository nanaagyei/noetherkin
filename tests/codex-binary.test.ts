import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveCodexBinary } from '../adapters/runtime/codex-binary.js';
import { probeRoleHost, roleHostChecks } from '../adapters/runtime/select.js';

// Fake binaries only: nothing here runs a real Codex. The bundled path is injected so the tests never depend on
// whether the ChatGPT app is installed on the machine running them.
function sandbox(t: { after: (fn: () => void) => void }) {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-codex-bin-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const make = (relative: string, mode = 0o755): string => {
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '#!/bin/sh\necho "codex-cli 0.0.0-fake"\n', { mode });
    return file;
  };
  return { directory, make };
}

test('codex on PATH wins over the bundled app binary, which is reported as an alternative', t => {
  const { directory, make } = sandbox(t);
  const onPath = make('bin/codex');
  const bundled = make('ChatGPT.app/codex');
  const resolution = resolveCodexBinary(undefined, { env: { PATH: [path.join(directory, 'empty'), path.dirname(onPath)].join(path.delimiter) }, bundled });
  assert.deepEqual(resolution, { binary: onPath, source: 'path', alternatives: [bundled] });
});

test('the bundled app binary is the fallback when PATH has no codex', t => {
  const { directory, make } = sandbox(t);
  const bundled = make('ChatGPT.app/codex');
  fs.mkdirSync(path.join(directory, 'bin'));
  assert.deepEqual(resolveCodexBinary(undefined, { env: { PATH: path.join(directory, 'bin') }, bundled }), { binary: bundled, source: 'bundled', alternatives: [] });
});

test('NOETHERKIN_CODEX_BIN overrides PATH and the bundle, and --codex-bin overrides the environment', t => {
  const { make } = sandbox(t);
  const onPath = make('bin/codex');
  const bundled = make('ChatGPT.app/codex');
  const chosen = make('custom/codex');
  const env = { PATH: path.dirname(onPath), NOETHERKIN_CODEX_BIN: chosen };
  assert.deepEqual(resolveCodexBinary(undefined, { env, bundled }), { binary: chosen, source: 'env', alternatives: [onPath, bundled] });
  const flag = make('flag/codex');
  assert.equal(resolveCodexBinary(flag, { env, bundled }).source, 'flag');
  assert.equal(resolveCodexBinary(flag, { env, bundled }).binary, flag);
});

test('with no candidate the plain command name is returned, and non-executable files on PATH are skipped', t => {
  const { directory, make } = sandbox(t);
  make('bin/codex', 0o644);
  assert.deepEqual(resolveCodexBinary(undefined, { env: { PATH: path.join(directory, 'bin') }, bundled: path.join(directory, 'missing') }), { binary: 'codex', source: 'default', alternatives: [] });
});

test('a PATH entry that is a symlink to the bundled binary is not listed as a separate alternative', t => {
  const { directory, make } = sandbox(t);
  const bundled = make('ChatGPT.app/codex');
  fs.mkdirSync(path.join(directory, 'bin'));
  fs.symlinkSync(bundled, path.join(directory, 'bin/codex'));
  assert.deepEqual(resolveCodexBinary(undefined, { env: { PATH: path.join(directory, 'bin') }, bundled }).alternatives, []);
});

test('setup and doctor detection name the chosen codex, why it was chosen, and the other candidate', t => {
  const { make } = sandbox(t);
  const onPath = make('bin/codex');
  const bundled = make('ChatGPT.app/codex');
  const lookup = { env: { PATH: path.dirname(onPath) }, bundled };
  const probe = probeRoleHost('codex', {}, lookup);
  assert.equal(probe.binary, onPath); assert.equal(probe.source, 'path'); assert.deepEqual(probe.alternatives, [bundled]);
  assert.equal(probe.healthy, true); assert.equal(probe.version, 'codex-cli 0.0.0-fake');
  const codex = roleHostChecks({ claude_bin: path.join(path.dirname(onPath), 'no-claude') }, lookup).find(check => check.check === 'role-host:codex');
  assert.equal(codex?.status, 'ok');
  assert.equal(codex?.detail, `codex-cli 0.0.0-fake (${onPath}, from PATH; also found ${bundled})`);
  const fallback = roleHostChecks({}, { env: { PATH: '' }, bundled }).find(check => check.check === 'role-host:codex');
  assert.match(fallback?.detail ?? '', /bundled with the ChatGPT app\)$/);
});
