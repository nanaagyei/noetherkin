import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../cli/render.js';

// Compact human views for project selection and the design gate. `--json` bypasses the renderer, so these views may
// change freely; they must stay short and must never drop the honesty notes the result carries.

test('project select shows what was selected and keeps the draft note, without internal identifiers', () => {
  const text = render({ command: 'project', outcome: 'success', coverage: 'simulation', diagnostics: [], data: {
    operation_id: 'OP-1', output_record_ids: ['accessible-data-table'],
    selection: { project_id: 'accessible-data-table', kind: 'forge', source_path: 'accessible-data-table', source_revision: null },
    status_note: 'This forge specification is a draft: it has not yet been built end to end against its own task pack.',
    next_action: { phase: 'ASSIGN FIRST TASK', run: 'noetherkin task assign' } } });
  assert.match(text, /^Selected accessible-data-table \(forge: you build it from an empty directory\) at accessible-data-table\./);
  assert.match(text, /draft: it has not yet been built end to end/);
  assert.match(text, /Next: ASSIGN FIRST TASK/);
  assert.doesNotMatch(text, /OP-1|output_record_ids/);
  const upstream = render({ command: 'project', outcome: 'success', coverage: 'simulation', diagnostics: [], data: { selection: { project_id: 'pytest', kind: 'upstream', source_path: 'source/pytest', source_revision: 'cf470ec0bf7eb89cd97dd56df4859eae5db46447' } } });
  assert.match(upstream, /upstream checkout\) at source\/pytest, pinned to cf470ec0bf7e\./);
});

test('the design gate names the simulated reviewer, the verdict, every risk and the next command', () => {
  const rework = render({ command: 'task', outcome: 'incomplete', coverage: 'simulation', diagnostics: [], data: {
    outcome: 'rework', decision: 'rework', rationale: 'State the exact test command.', risks: ['No exact test command is stated.', 'A falsy check would blank 0.'] } });
  assert.match(rework, /Design review by the simulated team lead: rework/);
  assert.match(rework, /- No exact test command is stated\.\n  - A falsy check would blank 0\./);
  assert.match(rework, /The simulated team lead asked for rework\. Revise the design and resubmit: noetherkin task submit-design/);
  const approved = render({ command: 'task', outcome: 'success', coverage: 'simulation', diagnostics: [], data: { outcome: 'success', decision: 'approve', rationale: 'Clear contract.', risks: [] } });
  assert.match(approved, /simulated team lead: approved/);
  assert.match(approved, /Design approved by the simulated team lead\. Implement the change, then: noetherkin task submit-change$/);
  assert.doesNotMatch(approved, /Risks to address/);
});
