// Windows counterpart of tests/terminal.py: exercises the real CLI terminal controller in an isolated test workspace.
// This harness supplies test consent only, never consent for a user's workspace.
//
// ConPTY attaches stdin, stdout and stderr to one console, so the CLI runs under cmd.exe with stdout redirected to a
// file: stdin and stderr stay on the console (the CLI's direct-terminal check), and the JSON result is read back
// intact instead of being scraped from rendered console output. node-pty is not a project dependency; the Windows CI
// job installs it with `npm install --no-save --ignore-scripts node-pty@1.1.0`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let pty;
try { pty = (await import('node-pty')).default; }
catch { console.error('node-pty is required for terminal tests on Windows: npm install --no-save --ignore-scripts node-pty@1.1.0'); process.exit(2); }

const [node, executable, workspace, answer, ...extra] = process.argv.slice(2);
const mode = extra[0] ?? 'init';
let args; let marker;
if (mode === 'onboard') { args = ['onboard', '--workspace', workspace, '--constraint', 'Java 17 available', '--codex-bin', extra[1], '--json']; marker = 'Type "onboard"'; }
else if (mode === 'handoff') { args = ['adapter-handoff', '--workspace', workspace, '--handoff', extra[1], '--json']; marker = 'to approve: '; }
else if (mode === 'track') { args = ['track', 'select', 'backend-engineering', '--workspace', workspace, '--json']; marker = 'Type "select"'; }
else { args = ['init', '--workspace', workspace, '--name', 'Test learner', '--goal', 'Understand initialization', '--assistance-max', '3', '--json']; marker = 'Type "initialize"'; }

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-terminal-'));
const out = path.join(scratch, 'stdout.json');
// No argument here contains a double quote, so quoting each one is enough for cmd.exe.
const quote = value => `"${value}"`;
const line = `${[node, executable, ...args].map(quote).join(' ')} > ${quote(out)}`;
const child = pty.spawn(process.env.comspec ?? 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], { cols: 4000, rows: 50, cwd: scratch, env: process.env });

let transcript = '';
let sent = false;
const plain = text => text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[()][0-9A-Za-z]/g, '');
const deadline = setTimeout(() => child.kill(), 20_000);
child.onData(data => {
  transcript += data;
  if (!sent && plain(transcript).includes(marker)) { sent = true; child.write(`${answer}\r`); }
});
child.onExit(({ exitCode }) => {
  clearTimeout(deadline);
  let output = null;
  try { output = JSON.parse(fs.readFileSync(out, 'utf8')); } catch { output = null; }
  fs.rmSync(scratch, { recursive: true, force: true });
  process.stdout.write(JSON.stringify({ exit: exitCode, prompt_seen: sent, output, terminal: plain(transcript) }) + '\n');
  process.exit(0);
});
