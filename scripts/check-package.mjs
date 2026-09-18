import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = process.argv[2];
let raw;

if (manifestPath) {
  raw = fs.readFileSync(path.resolve(root, manifestPath), 'utf8');
} else {
  const cache = process.env.NOETHERKIN_NPM_CACHE || path.join(os.tmpdir(), 'noetherkin-package-check-npm-cache');
  const packed = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json', '--cache', cache], {
    cwd: root,
    encoding: 'utf8',
  });
  if (packed.status !== 0) {
    process.stderr.write(packed.stderr || packed.stdout);
    process.exit(packed.status ?? 1);
  }
  raw = packed.stdout;
}

let report;
try {
  [report] = JSON.parse(raw);
} catch (error) {
  console.error(`Package manifest is not valid JSON: ${error.message}`);
  process.exit(1);
}

if (!report || !Array.isArray(report.files)) {
  console.error('Package manifest has no files array.');
  process.exit(1);
}

const names = report.files.map(file => file.path);
const requiredFiles = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'SECURITY.md',
  'noetherkin-logo.png',
  'dist/cli/main.js',
  'dist/adapters/hosts/generic/index.js',
  'dist/adapters/hosts/codex/index.js',
  'dist/adapters/hosts/claude-code/index.js',
  'FOUNDATION_V1.md',
  'PROJECT_CHARTER.md',
];
const requiredPrefixes = ['dist/core/', 'schemas/', 'catalog/', 'tasks/', 'skills/onboarding/'];
const forbiddenPrefixes = [
  '.github/',
  '.apprenticeship/',
  'adapters/',
  'apprenticeship-artifacts/',
  'apprenticeship-drafts/',
  'cli/',
  'core/',
  'evaluations/',
  'examples/',
  'reviews/',
  'scripts/',
  'tests/',
];

const missing = requiredFiles.filter(file => !names.includes(file));
for (const prefix of requiredPrefixes) {
  if (!names.some(file => file.startsWith(prefix))) missing.push(`${prefix}*`);
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.name !== 'noetherkin' || pkg.bin?.noetherkin !== 'dist/cli/main.js') {
  console.error('Package identity must expose noetherkin from dist/cli/main.js.');
  process.exit(1);
}
if (pkg.license && pkg.license !== 'UNLICENSED' && !names.includes('LICENSE')) missing.push('LICENSE');

const forbidden = names.filter(file =>
  forbiddenPrefixes.some(prefix => file.startsWith(prefix)) ||
  file === '.env' ||
  file.startsWith('.env.') ||
  file.endsWith('.tgz') ||
  file.endsWith('.ts'),
);

if (missing.length || forbidden.length) {
  if (missing.length) console.error(`Missing required package files:\n${missing.map(file => `- ${file}`).join('\n')}`);
  if (forbidden.length) console.error(`Forbidden package files:\n${forbidden.map(file => `- ${file}`).join('\n')}`);
  process.exit(1);
}

console.log(`Package contents verified: ${report.entryCount} files, ${report.unpackedSize} unpacked bytes.`);
