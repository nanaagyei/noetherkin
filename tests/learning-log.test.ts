import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bindApprovedInit, proposeInit, publishInit } from '../core/bootstrap.js';
import { latestLearningEntry } from '../core/learning-log.js';

// Issue #20: the learner writes session wrap-ups; the next session reads the latest one back as a learner claim.

const repository = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('../cli/main.js', import.meta.url));

function workspace(t: { after: (fn: () => void) => void }): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noetherkin-log-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const proposal = proposeInit({ display_name: 'Learner', goals: ['Understand retries'], assistance_default_max: 3 });
  publishInit(root, proposal, bindApprovedInit(root, proposal, true));
  return root;
}
const writeLog = (root: string, text: string): void => {
  fs.mkdirSync(path.join(root, '.apprenticeship/knowledge'), { recursive: true });
  fs.writeFileSync(path.join(root, '.apprenticeship/knowledge/learning-log.md'), text);
};

test('the latest dated entry is read back, wherever it sits in the file', t => {
  const root = workspace(t);
  assert.equal(latestLearningEntry(root), null, 'no log, no entry');
  writeLog(root, '# Learning Log\n\nUndated notes.\n');
  assert.equal(latestLearningEntry(root), null, 'only dated headings are wrap-up entries');
  writeLog(root, '# Learning Log\n\n## 2026-09-28\n\n### What I learned\nIdempotency keys make retries safe.\n\n## 2026-09-12\nGateway routing.\n');
  assert.deepEqual(latestLearningEntry(root), { path: '.apprenticeship/knowledge/learning-log.md', date: '2026-09-28', first_line: 'Idempotency keys make retries safe.' });
  writeLog(root, '## 2026-09-28 morning\nFirst.\n\n## 2026-09-28 afternoon\nSecond.\n');
  assert.equal(latestLearningEntry(root)!.first_line, 'Second.', 'a later entry on the same date wins');
  writeLog(root, `## 2026-09-29\n${'x'.repeat(500)}\n`);
  assert.equal(latestLearningEntry(root)!.first_line.length, 200);
});

test('next shows the last wrap-up read-only, and the log stays a valid learner note', t => {
  const root = workspace(t);
  writeLog(root, '# Learning Log\n\n## 2026-09-28\nNext I want to understand who owns retries.\n');
  const before = fs.readFileSync(path.join(root, '.apprenticeship/knowledge/learning-log.md'));
  const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args, '--workspace', root], { encoding: 'utf8' });
  const json = run('next', '--json');
  assert.equal(json.status, 0, json.stderr + json.stdout);
  assert.deepEqual(JSON.parse(json.stdout).data.learning_log, { path: '.apprenticeship/knowledge/learning-log.md', date: '2026-09-28', first_line: 'Next I want to understand who owns retries.' });
  assert.match(run('next').stdout, /Last wrap-up \(2026-09-28, your own words\): Next I want to understand who owns retries\./);
  assert.deepEqual(fs.readFileSync(path.join(root, '.apprenticeship/knowledge/learning-log.md')), before, 'the log is never rewritten');
  assert.equal(run('validate').status, 0, 'a learning log is an ordinary learner-authored knowledge note');
});

test('the teach contract and skills keep the wrap-up authorship and evidence rules', async () => {
  const { cases } = await import(pathToFileURL(path.join(repository, 'tests/behavior/cases.mjs')).href) as { cases: { id: string; skill: string }[] };
  const contract = fs.readFileSync(path.join(repository, 'contracts/teach.md'), 'utf8');
  assert.match(contract, /## Session wrap-up/);
  assert.match(contract, /Draft, complete, rewrite or write down the learner's session reflection, including on request/);
  assert.match(contract, /A wrap-up is not evidence for any technical competency;[^\n]*\(FR-49\)/);
  assert.match(contract, /learner's claim, not a verified fact[^.]*\(CF-47\)/);
  assert.match(fs.readFileSync(path.join(repository, 'skills/teach/SKILL.md'), 'utf8'), /Never draft, complete or write the entry, even on request/);
  assert.match(fs.readFileSync(path.join(repository, 'skill-pack/runtime.md'), 'utf8'), /latest dated entry in `\.apprenticeship\/knowledge\/learning-log\.md`/);
  // Each rule has a behavioral case: the positive controls, the ghostwriting request and a wrong claim in the log.
  assert.deepEqual(['P22', 'P23', 'A24', 'A25'].map(id => cases.find(item => item.id === id)?.skill), ['teach', 'onboarding', 'teach', 'teach']);
});
