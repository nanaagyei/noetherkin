import { encode, requireThat, type ObjectValue } from './common.js';
import { parse } from './parsing.js';
import { digest, exists, read, runtime, safePath, statePath, type Runtime } from './storage.js';
import { bindApprovedTransaction, makeTransaction, publishTransaction, type BoundActor } from './transactions.js';

const mutable = ['config.yaml', 'profile.yaml', 'current-project.yaml', 'competencies.yaml'];
function load(root: string, file: string, rt: Runtime): ObjectValue { return parse(read(root, statePath(file), rt), statePath(file)); }
function actor(config: ObjectValue): BoundActor {
  const value = config.principals.find((item: ObjectValue) => item.id === config.learner_principal_id && item.role === 'learner' && item.retired_at === null);
  requireThat(value, 'AUTHORITY_INVALID', 'config.yaml', 'Migration requires the active learner principal.'); return { id: value.id, role: 'learner' };
}
export function planMigration(root: string, rt: Runtime = runtime): ObjectValue {
  const config = load(root, 'config.yaml', rt);
  if (config.schema_version === '3.0' && exists(safePath(root, statePath('current-track.yaml'), rt), rt)) return { outcome: 'no-change', from: '3.0', to: '3.0', changes: [] };
  requireThat(config.schema_version === '2.0', 'MIGRATION_UNSUPPORTED', 'config.yaml', 'Only protocol 2.0 workspaces can migrate to 3.0.');
  return { outcome: 'proposal', from: '2.0', to: '3.0', changes: [...mutable.map(file => ({ path: statePath(file), change: 'Update mutable envelope to protocol 3.0; preserve semantic content.' })), { path: statePath('current-track.yaml'), change: 'Create an explicitly unselected track binding; do not infer a track.' }], preserved: ['projects', 'work', 'evidence', 'assessments', 'reviews'] };
}
export function migrateTo3(root: string, validate: (files: Map<string, string>) => void, rt: Runtime = runtime): ObjectValue {
  const proposal = planMigration(root, rt); if (proposal.outcome === 'no-change') return proposal;
  const config = load(root, 'config.yaml', rt); const writes = new Map<string, string>();
  for (const file of mutable) { const value = load(root, file, rt); value.schema_version = '3.0'; if (file === 'config.yaml') { value.competency_catalog_version = '3.0'; value.track_catalog_version = '1.1'; } writes.set(statePath(file), encode(value)); }
  writes.set(statePath('current-track.yaml'), encode({ schema_version: '3.0', data_class: config.data_class, track_id: null, track_catalog_version: null, definition_digest: null, selected_at: null, alignment_status: 'unselected', adopted_competencies: [], scope_agreement: null, aligned_at: null }));
  const expected = Object.fromEntries([...writes.keys()].map(file => [file, digest(root, file, rt)]));
  const plan = makeTransaction(root, { operation_id: rt.id('OP'), actor: actor(config), action: 'migrate-protocol', target: config.workspace_id, request: { from: '2.0', to: '3.0', inference: 'none' }, expected_read_digests: expected, output_record_ids: [config.workspace_id], writes, authorization_description: 'Learner-authorized protocol 2.0 to 3.0 migration' }, rt);
  return { outcome: 'success', from: '2.0', to: '3.0', ...publishTransaction(root, plan, bindApprovedTransaction(root, plan, true), validate, rt) };
}
