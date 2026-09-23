import assert from 'node:assert/strict';
import test from 'node:test';
import { roleOutputContract } from '../adapters/runtime/codex.js';

test('Codex role output contracts specify the constrained code-review shape', () => {
  assert.equal(
    roleOutputContract(['outcome', 'findings']),
    '{"outcome":"approve, changes-requested, or insufficient-evidence","findings":["one or more concrete finding strings"]}'
  );
});

test('Codex role output contracts are independent of requested key order', () => {
  assert.equal(
    roleOutputContract(['risks', 'decision', 'rationale']),
    '{"decision":"approve or rework","rationale":"non-empty string","risks":["zero or more concrete risk strings"]}'
  );
});

test('Codex role output contracts reject unregistered shapes', () => {
  assert.throws(() => roleOutputContract(['unknown']), /No closed role output contract is registered/);
});

test('canonical review contracts require at least one finding', () => {
  assert.match(roleOutputContract(['outcome', 'findings', 'evidence_rationale']), /one or more concrete finding strings/);
  assert.match(roleOutputContract(['outcome', 'findings', 'next_task_adjustment']), /one or more concrete finding strings/);
});
