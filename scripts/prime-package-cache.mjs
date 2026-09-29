import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// npm is a .cmd shim on Windows, which Node will not start without a shell. Under an npm script, run npm's own CLI
// with this Node instead; otherwise fall back to the shell (the arguments here are fixed strings).
function npm(args, options) {
  return process.env.npm_execpath
    ? spawnSync(process.execPath, [process.env.npm_execpath, ...args], options)
    : spawnSync('npm', args, { ...options, shell: process.platform === 'win32' });
}

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-package-cache-'));
const args = ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'];

try {
  fs.writeFileSync(path.join(staging, 'package.json'), JSON.stringify({ private: true, dependencies: pkg.dependencies }, null, 2));
  const options = { cwd: staging, encoding: 'utf8', timeout: 30_000 };
  let result = npm([...args, '--offline'], options);
  if (result.status !== 0) result = npm(args, options);
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }
  console.log(`Prepared offline package-test cache for ${Object.keys(pkg.dependencies ?? {}).length} declared production dependencies.`);
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
