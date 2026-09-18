import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const failures = [];
const requiredFiles = ['README.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md'];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}.`);
}
if (!pkg.license || pkg.license === 'UNLICENSED') failures.push('package.json must declare the selected SPDX license.');
if (pkg.name !== 'noetherkin') failures.push('package.json package name must be noetherkin.');
if (pkg.bin?.noetherkin !== 'dist/cli/main.js' || Object.keys(pkg.bin ?? {}).length !== 1) failures.push('package.json must expose only the noetherkin executable.');
if (!pkg.repository?.url) failures.push('package.json must declare repository.url.');
const repositoryMatch = pkg.repository?.url?.match(/^git\+https:\/\/github\.com\/([^/]+\/[^/]+)\.git$/);
if (pkg.repository?.url && (pkg.repository.type !== 'git' || !repositoryMatch)) failures.push('package.json repository must identify the exact public GitHub Git repository.');
if (!pkg.homepage) failures.push('package.json must declare homepage.');
else if (!/^https:\/\/github\.com\/[^/]+\/[^/]+(?:#readme)?$/.test(pkg.homepage)) failures.push('package.json homepage must identify the public GitHub repository.');
if (!pkg.bugs?.url) failures.push('package.json must declare bugs.url.');
else if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues$/.test(pkg.bugs.url)) failures.push('package.json bugs.url must identify the public GitHub issue tracker.');
if (repositoryMatch) {
  const repositoryBase = `https://github.com/${repositoryMatch[1]}`;
  if (pkg.homepage && pkg.homepage !== `${repositoryBase}#readme`) failures.push('package.json homepage does not match repository.url.');
  if (pkg.bugs?.url && pkg.bugs.url !== `${repositoryBase}/issues`) failures.push('package.json bugs.url does not match repository.url.');
}
if (pkg.private === true) failures.push('package.json is marked private.');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version ?? '')) failures.push('package.json version is not a publishable semantic version.');
const readmePath = path.join(root, 'README.md');
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf8');
  if (!readme.includes('noetherkin-logo.png')) failures.push('README.md does not display the Noetherkin logo.');
  if (readme.includes('<repository-url>')) failures.push('README.md still contains the repository URL placeholder.');
}
if (failures.length) {
  console.error('Release readiness failed:\n' + failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}
console.log(`Release metadata is complete for ${pkg.name}@${pkg.version}.`);
