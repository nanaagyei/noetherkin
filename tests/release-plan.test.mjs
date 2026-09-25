import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bumpFromCommits, bumpFromLabels, latestTag, nextVersion, plan } from '../scripts/release-plan.mjs';

test('exactly one release label decides the bump', () => {
  assert.equal(bumpFromLabels(['documentation', 'release:minor']), 'minor');
  assert.equal(bumpFromLabels(['release:none']), 'none');
  assert.throws(() => bumpFromLabels(['documentation']), /exactly one release label/);
  assert.throws(() => bumpFromLabels(['release:minor', 'release:patch']), /found release:minor, release:patch/);
});

test('commit messages imply the largest bump among them', () => {
  assert.equal(bumpFromCommits(['docs: tidy', 'chore: bump']), 'none');
  assert.equal(bumpFromCommits(['fix(cli): usage', 'docs: tidy']), 'patch');
  assert.equal(bumpFromCommits(['fix: a', 'feat(forge): b']), 'minor');
  assert.equal(bumpFromCommits(['feat!: drop protocol 2.0']), 'major');
  assert.equal(bumpFromCommits(['feat: x\n\nBREAKING CHANGE: state layout moved']), 'major');
  assert.equal(bumpFromCommits(['Merge pull request #12 from x/y']), 'none');
});

test('versions bump by semantic versioning and tags are ordered numerically', () => {
  assert.equal(nextVersion('0.1.0', 'patch'), '0.1.1');
  assert.equal(nextVersion('0.1.9', 'minor'), '0.2.0');
  assert.equal(nextVersion('0.9.3', 'major'), '1.0.0');
  assert.equal(latestTag(['v0.9.0', 'v0.10.0', 'v0.2.1', 'nightly']), '0.10.0');
  assert.equal(latestTag([]), null);
});

test('the first release uses package.json, later releases follow the label, and none skips', () => {
  assert.deepEqual(plan({ packageVersion: '0.1.0', tags: [], labels: ['release:major'], commits: [] }).version, '0.1.0');
  assert.deepEqual(plan({ packageVersion: '0.1.0', tags: ['v0.1.0'], labels: ['release:minor'], commits: ['fix: x'] }), { release: true, version: '0.2.0', bump: 'minor', source: 'pull request label' });
  assert.equal(plan({ packageVersion: '0.1.0', tags: ['v0.1.0'], labels: ['release:none'], commits: ['feat: x'] }).release, false);
  assert.deepEqual(plan({ packageVersion: '0.1.0', tags: ['v0.1.0'], labels: undefined, commits: ['fix: x'] }).version, '0.1.1');
  assert.deepEqual(plan({ packageVersion: '0.1.0', tags: ['v0.1.0'], labels: undefined, commits: [], override: 'major' }).version, '1.0.0');
  assert.throws(() => plan({ packageVersion: '0.1.0', tags: ['v0.1.0'], labels: [], commits: [] }), /exactly one release label/);
});
