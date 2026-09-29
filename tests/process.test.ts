import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnCommand, spawnCommandSync } from '../core/process.js';
import { isWindows, writeProgram } from './support.js';

// On Windows these programs are .cmd shims, so every argument crosses cmd.exe's parser twice (once for the command
// line, once for the shim's %*). The same arguments must arrive byte for byte on every platform.
const hostile = [
  'plain', 'with space', '', 'quote"inside', 'back\\slash', 'trailing\\', '{"mcpServers":{}}', 'approval_policy="never"',
  '%PATH%', '!bang!', '^caret', 'a&b|c<d>e', '(paren)', 'semi;colon,comma', 'star*question?', 'tab\there'
];

function echoProgram(t: { after: (fn: () => void) => void }): string {
  const directory = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-process-')));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return writeProgram(path.join(directory, 'echo-args'), "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");
}

test('arguments reach a started program intact, including through a Windows .cmd shim', t => {
  const program = echoProgram(t);
  const run = spawnCommandSync(program, hostile, { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), hostile);
});

test('the asynchronous form pipes stdin and passes the same arguments', async t => {
  const program = writeProgram(path.join(path.dirname(echoProgram(t)), 'cat-args'),
    "let input = ''; process.stdin.on('data', c => { input += c; }); process.stdin.on('end', () => process.stdout.write(JSON.stringify({ args: process.argv.slice(2), input })));\n");
  const child = spawnCommand(program, hostile);
  let stdout = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stdin.end('prompt text');
  const code = await new Promise(resolve => child.on('close', resolve));
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(stdout), { args: hostile, input: 'prompt text' });
});

test('a program whose path contains cmd metacharacters still starts with its arguments intact', t => {
  // Every character here is legal in a Windows directory name and special to cmd.exe, so the program path itself must
  // be escaped, not just the arguments.
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-process-')));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const program = writeProgram(path.join(parent, 'a&b (c) %PATH% !x! ^d;e,f=g', 'echo-args'), "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");
  const run = spawnCommandSync(program, hostile, { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), hostile);
});

test('a missing program fails to start rather than running something else', () => {
  const run = spawnCommandSync(path.join(os.tmpdir(), 'noetherkin-no-such-program'), ['--version'], { encoding: 'utf8' });
  assert.equal((run.error as NodeJS.ErrnoException | undefined)?.code, 'ENOENT', isWindows ? 'Windows must not fall back to a shell lookup' : undefined);
});
