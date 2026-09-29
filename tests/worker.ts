import { bindApprovedInit, proposeInit, publishInit, planRecovery, recover } from '../core/bootstrap.js';
import fs from 'node:fs';
import { runtime } from '../core/storage.js';
const [root, mode, target] = process.argv.slice(2) as [string, string, string];
// Windows has no signals, so the kill point is announced for tests/support.ts assertKilled.
const die = (): never => { fs.writeSync(1, 'killing\n'); process.kill(process.pid, 'SIGKILL'); throw new Error('unreachable'); };
let boundary = 0;
const rt = { ...runtime, boundary: (name: string) => {
  boundary++;
  if (mode === 'kill' && boundary === Number(target)) die();
  if (mode === 'hold' && name === 'prepared') {
    process.stdout.write('prepared\n');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);
  }
  if (mode === 'recover-kill' && name.startsWith('rollback:')) die();
} };
if (mode === 'recover-kill') recover(root, planRecovery(root), rt);
else {
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Understand the codebase'], assistance_default_max: 3 });
  publishInit(root, proposal, bindApprovedInit(root, proposal, true), rt);
}
