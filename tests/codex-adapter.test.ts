import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CodexRoleAdapter, roleOutputContract } from '../adapters/runtime/codex.js';
import { contextDigest, type RoleInvocation } from '../core/adapters.js';
import { diagnostic } from '../core/common.js';
import { render } from '../cli/render.js';

// A fake codex that writes canned stdout and stderr and exits. It never calls a model.
function fakeCodex(t: { after: (fn: () => void) => void }, output: { stdout?: string; stderr?: string; exit: number }): string {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-fake-codex-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const binary = path.join(directory, 'codex');
  fs.writeFileSync(binary, `#!${process.execPath}
process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write(${JSON.stringify(output.stdout ?? '')});
  process.stderr.write(${JSON.stringify(output.stderr ?? '')});
  process.exitCode = ${output.exit};
});
`, { mode: 0o755 });
  return binary;
}

function request(workspace: string): RoleInvocation {
  const context = { task: 'TASK-001' };
  return { workspace, operation_id: 'OP-test', actor: { id: 'ACT-reviewer', role: 'peer-engineer' }, skill: 'code-review', objective: 'Review the change.', context, context_digest: contextDigest(context), output_keys: ['outcome', 'findings'] };
}

const websocket401 = [
  'ERROR: stream error: exceeded retry limit, last status: 401 Unauthorized, request id: abc123',
  'websocket connection to wss://example.invalid/backend-api/codex/responses failed',
  '  caused by: HTTP error: 401 Unauthorized'
].join('\n');

test('a Codex that is not signed in fails with a short sign-in hint; the raw output is JSON-only detail', async t => {
  const binary = fakeCodex(t, { stderr: websocket401, exit: 1 });
  const error = await new CodexRoleAdapter({ binary }).invoke(request(os.tmpdir())).then(() => assert.fail('expected a failure'), (caught: unknown) => caught);
  const item = diagnostic(error);
  assert.equal(item.code, 'ADAPTER_AUTH_REQUIRED');
  assert.equal(item.message, `Codex at ${binary} is not signed in. Run \`codex login\`, or choose another with --codex-bin or --role-adapter claude.`);
  assert.equal(item.detail, websocket401);
  const human = render({ command: 'onboard', outcome: 'invalid', coverage: 'none', data: {}, diagnostics: [item] });
  assert.match(human, /codex login/);
  assert.doesNotMatch(human, /websocket|Unauthorized|request id/);
  assert.equal(human.split('\n').length, 1);
  assert.equal(JSON.parse(JSON.stringify({ diagnostics: [item] })).diagnostics[0].detail, websocket401);
});

test('a Codex error event reporting 401 is also classified as a sign-in failure', async t => {
  const binary = fakeCodex(t, { stdout: `${JSON.stringify({ type: 'thread.started' })}\n${JSON.stringify({ type: 'error', message: 'unexpected status 401 Unauthorized' })}\n`, exit: 0 });
  await assert.rejects(new CodexRoleAdapter({ binary }).invoke(request(os.tmpdir())), { code: 'ADAPTER_AUTH_REQUIRED' });
});

test('other Codex failures stay ADAPTER_FAILED with a one-line message, and agent text never triggers the sign-in hint', async t => {
  const agent = JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'The handler should return 401 Unauthorized.' } });
  const binary = fakeCodex(t, { stdout: `${agent}\n`, stderr: 'thread panicked\nerror: model overloaded.\n', exit: 2 });
  const item = diagnostic(await new CodexRoleAdapter({ binary }).invoke(request(os.tmpdir())).then(() => assert.fail('expected a failure'), (caught: unknown) => caught));
  assert.equal(item.code, 'ADAPTER_FAILED');
  assert.equal(item.message, `Codex at ${binary} failed (exit 2): error: model overloaded. Run with --json for the full output.`);
  assert.equal(item.detail, 'thread panicked\nerror: model overloaded.');
});

test('Codex role output contracts specify the constrained code-review shape', () => {
  assert.equal(
    roleOutputContract(['outcome', 'findings']),
    '{"outcome":"approve, changes-requested, or insufficient-evidence","findings":["one or more concrete finding strings"]}'
  );
});

test('Codex role output contracts are independent of requested key order', () => {
  assert.equal(
    roleOutputContract(['risks', 'decision', 'rationale']),
    '{"decision":"approve or rework","rationale":"non-empty string","risks":["zero or more concrete risk strings"]}'
  );
});

test('Codex role output contracts reject unregistered shapes', () => {
  assert.throws(() => roleOutputContract(['unknown']), /No closed role output contract is registered/);
});

test('canonical review contracts require at least one finding', () => {
  assert.match(roleOutputContract(['outcome', 'findings', 'evidence_rationale']), /one or more concrete finding strings/);
  assert.match(roleOutputContract(['outcome', 'findings', 'next_task_adjustment']), /one or more concrete finding strings/);
});
