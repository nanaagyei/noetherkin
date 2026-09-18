import { bindApprovedInit, proposeInit, publishInit, planRecovery, recover } from '../core/bootstrap.js';
import { runtime } from '../core/storage.js';
const [root, mode, target] = process.argv.slice(2) as [string, string, string];
let boundary = 0;
const rt = { ...runtime, boundary: (name: string) => {
  boundary++;
  if (mode === 'kill' && boundary === Number(target)) process.kill(process.pid, 'SIGKILL');
  if (mode === 'hold' && name === 'prepared') {
    process.stdout.write('prepared\n');
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);
  }
  if (mode === 'recover-kill' && name.startsWith('rollback:')) process.kill(process.pid, 'SIGKILL');
} };
if (mode === 'recover-kill') recover(root, planRecovery(root), rt);
else {
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Understand the codebase'], assistance_default_max: 3 });
  publishInit(root, proposal, bindApprovedInit(root, proposal, true), rt);
}
