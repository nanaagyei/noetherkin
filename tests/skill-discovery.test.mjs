import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { classify, loadedSkills, main } from './behavior/discovery.mjs';

// Synthetic events in the shapes Claude Code (stream-json) and Codex (exec --json) emit. No model is called.
const lines = (...events) => events.map(event => JSON.stringify(event)).join('\n') + '\n';
const claudeSkill = skill => ({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill } }] } });
const claudeResult = text => ({ type: 'result', subtype: 'success', result: text });
const codexCommand = command => ({ type: 'item.completed', item: { type: 'command_execution', command, exit_code: 0 } });
const codexMessage = text => ({ type: 'item.completed', item: { type: 'agent_message', text } });

test('a Claude Skill call and a Codex read of SKILL.md both count as loading the skill', () => {
  assert.deepEqual(loadedSkills(lines(claudeSkill('onboarding'))), ['onboarding']);
  assert.deepEqual(loadedSkills(lines(codexCommand("/bin/zsh -lc 'cat /home/me/.agents/skills/onboarding/SKILL.md'"))), ['onboarding']);
});

test('a file listing that prints other skills\' SKILL.md paths is not a load', () => {
  assert.deepEqual(loadedSkills(lines(codexCommand("/bin/zsh -lc 'rg --files -uuu .agents | head -100'"))), []);
  assert.deepEqual(loadedSkills(lines(codexCommand("/bin/zsh -lc 'find .agents/skills/debug/SKILL.md'"))), []);
});

test('all three prompts passing is ok; a visible but unrouted skill is a routing problem', () => {
  const ok = classify({ p1: lines(claudeSkill('onboarding')), p2: lines(claudeSkill('onboarding')), p3: lines(claudeResult('onboarding, teach, debug')) });
  assert.equal(ok.diagnosis, 'ok'); assert.deepEqual(ok.unexpected, []);
  const routing = classify({ p1: lines(codexMessage('Run git init first.')), p2: lines(codexCommand("cat .agents/skills/onboarding/SKILL.md")), p3: lines(codexMessage('onboarding')) });
  assert.equal(routing.routed, false); assert.equal(routing.discovered, true); assert.match(routing.diagnosis, /^routing/);
});

test('a host that never sees the skill is a discovery problem, and a wrong skill is reported', () => {
  const missing = classify({ p1: lines(claudeResult('Sure.')), p2: lines(claudeResult('I have no such skill.')), p3: lines(claudeResult('frontend-design')) });
  assert.equal(missing.discovered, false); assert.match(missing.diagnosis, /^discovery/);
  const wrong = classify({ p1: lines(claudeSkill('debug'), claudeSkill('onboarding')), p2: lines(claudeSkill('onboarding')), p3: '' });
  assert.deepEqual(wrong.unexpected, ['debug']);
});

test('the probe refuses to write raw transcripts inside the checkout or into an existing directory', async () => {
  const repo = fileURLToPath(new URL('../', import.meta.url));
  await assert.rejects(main(['--out', path.join(repo, 'tests/behavior/observed/discovery-x')]), /outside the checkout/);
  await assert.rejects(main(['--out', os.tmpdir()]), /already exists/);
  await assert.rejects(main(['--out', path.join(os.tmpdir(), 'nk-discovery-never-created'), '--host', 'cursor']), /Unknown host/);
});
