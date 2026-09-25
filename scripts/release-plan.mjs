// Decides whether a push to main releases, and at which version (ADR-018).
//
// The bump comes from the merged pull request's release label: release:major (breaking), release:minor (feature),
// release:patch (bug fix) or release:none. A push with no pull request falls back to Conventional Commit subjects
// since the last tag. Git tags `v<semver>` are the version source of truth; with no tag yet, the first release is
// package.json's version as-is.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const releaseLabels = { 'release:major': 'major', 'release:minor': 'minor', 'release:patch': 'patch', 'release:none': 'none' };
const order = ['none', 'patch', 'minor', 'major'];
const semver = /^(\d+)\.(\d+)\.(\d+)$/;

/** Exactly one release label decides the bump. Zero or several is an error the author must fix. */
export function bumpFromLabels(labels) {
  const found = [...new Set(labels.filter(label => label in releaseLabels))];
  if (found.length !== 1) throw new Error(`Expected exactly one release label (${Object.keys(releaseLabels).join(', ')}); found ${found.length ? found.join(', ') : 'none'}.`);
  return releaseLabels[found[0]];
}

/** The largest bump any commit message implies: breaking > feat > fix/perf > nothing. */
export function bumpFromCommits(messages) {
  let bump = 'none';
  for (const message of messages) {
    const [subject = ''] = message.split('\n');
    const level = /^\w+(\([^)]*\))?!:/.test(subject) || /^BREAKING[ -]CHANGE:/m.test(message) ? 'major'
      : /^feat(\([^)]*\))?:/.test(subject) ? 'minor'
      : /^(fix|perf)(\([^)]*\))?:/.test(subject) ? 'patch' : 'none';
    if (order.indexOf(level) > order.indexOf(bump)) bump = level;
  }
  return bump;
}

export function nextVersion(current, bump) {
  const match = semver.exec(current);
  if (!match) throw new Error(`Not a release version: ${current}`);
  const [major, minor, patch] = match.slice(1).map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  return current;
}

/** The highest `v<semver>` tag, or null before the first release. */
export function latestTag(tags) {
  const versions = tags.map(tag => /^v(\d+\.\d+\.\d+)$/.exec(tag)?.[1]).filter(Boolean);
  versions.sort((a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; });
  return versions.at(-1) ?? null;
}

/** The whole decision, from already-gathered facts. */
export function plan({ packageVersion, tags, labels, commits, override }) {
  const last = latestTag(tags);
  if (last === null) {
    if (!semver.test(packageVersion)) throw new Error(`package.json version ${packageVersion} is not a release version.`);
    return { release: true, version: packageVersion, bump: 'initial', source: 'first release uses package.json' };
  }
  const bump = override ?? (labels ? bumpFromLabels(labels) : bumpFromCommits(commits));
  const source = override ? 'manual dispatch' : labels ? 'pull request label' : 'commit messages';
  return bump === 'none' ? { release: false, version: last, bump, source } : { release: true, version: nextVersion(last, bump), bump, source };
}

function git(...args) { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }

// CLI: run in the release workflow with GITHUB_SHA, GITHUB_REPOSITORY and GH_TOKEN; writes GITHUB_OUTPUT.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const packageVersion = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
  const tags = git('tag', '--list', 'v*').split('\n').filter(Boolean);
  const last = latestTag(tags);
  const override = process.env.RELEASE_BUMP && process.env.RELEASE_BUMP !== 'auto' ? process.env.RELEASE_BUMP : undefined;
  let labels;
  if (!override && last !== null && process.env.GITHUB_REPOSITORY) {
    const pulls = JSON.parse(execFileSync('gh', ['api', `repos/${process.env.GITHUB_REPOSITORY}/commits/${process.env.GITHUB_SHA}/pulls`], { encoding: 'utf8' }));
    const merged = pulls.find(pull => pull.merged_at && pull.base.ref === 'main');
    if (merged) labels = merged.labels.map(label => label.name);
  }
  const commits = last === null ? [] : git('log', '--format=%B%x00', `v${last}..HEAD`).split('\0').map(item => item.trim()).filter(Boolean);
  const result = plan({ packageVersion, tags, labels, commits, override });
  console.log(`Release plan: ${JSON.stringify(result)}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `release=${result.release}\nversion=${result.version}\nbump=${result.bump}\n`);
}
