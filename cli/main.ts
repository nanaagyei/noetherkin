#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import { diagnostic, Failure, requireThat, validId, type Result } from '../core/common.js';
import { bindApprovedInit, existingInit, planRecovery, proposeInit, publishInit, recover, type InitRequest } from '../core/bootstrap.js';
import { inspectWorkspace, listProjects } from '../core/commands.js';
import { alignTrack, listTracks, selectTrack, trackAlignmentProposal } from '../core/tracks.js';
import { migrateTo3, planMigration } from '../core/migration.js';
import { exists, lockStatus, read, reclaimDeadLock, resolveWorkspace, runtime, safePath, statePath, withLock } from '../core/storage.js';
import { advanceNext, assignTask, beginTask, checkMap, investigationScope, mapStatus, cloneCatalogProject, codeReview, initMap, onboard, performanceReview, requestHelp, selectCatalogProject, submitChange, submitDesign, taskReview, testTask, validateSimulationCandidate } from '../core/simulation.js';
import { CodexRoleAdapter } from '../adapters/runtime/codex.js';
import { ClaudeRoleAdapter } from '../adapters/runtime/claude.js';
import type { RoleAdapter } from '../core/adapters.js';
import { decodeOnboardingHandoff, validateOnboardingHandoff } from '../adapters/hosts/generic/onboarding.js';
import { GenericCapabilityHostAdapter, installCapabilities, portableSkillIds, portableSkills } from '../adapters/hosts/generic/index.js';
import { CodexCapabilityHostAdapter } from '../adapters/hosts/codex/index.js';
import { ClaudeCodeCapabilityHostAdapter } from '../adapters/hosts/claude-code/index.js';
import { planTransactionRecovery, recoverTransaction } from '../core/transactions.js';
import { competencyGraph, competencyNeighbourhood } from '../core/graph.js';
import { catalogs } from '../core/validation.js';
import { parse } from '../core/parsing.js';

const help = `noetherkin <command>

Bootstrap: init | status | tracks | projects | competency show <competency-id> | validate | migrate --to 3.0 [--dry-run] | doctor [--recover]
Adapter bridge: adapter-handoff --handoff <token>
Capabilities: skills list | skills install --host <generic|codex|claude-code> [--skill <id> ...] [--target <directory>]
Journey:
  track show <track-id>
  track select <track-id>
  track align
  onboard [--constraint <text> ...]
  projects [--track <track-id>] [--stage <early|intermediate|advanced>]
  project select <project-id> (--source <path> | --clone-to <path> [--revision <ref>])
  map <init|check|status>
  task assign pet-type-integrity
  task begin
  task scope
  task submit-design --file <path>
  task submit-change
  task test --prediction <text>
  task help --question <text>
  review <code|task|performance>
  next

Role judgments (onboard, track align, task submit-design, task help, review, next):
  --role-adapter <codex|claude>   default: $NOETHERKIN_ROLE_ADAPTER, else codex
  --model <model> [--codex-bin <path>] [--claude-bin <path>]

All commands: --workspace <existing directory> --json
init: --name <display name> --goal <goal> (repeatable) --assistance-max <0..7> [--operation-id <OP-UUID>]
`;
function ceiling(input: string): number {
  if (!/^[0-7]$/.test(input)) throw new Failure('INPUT_REQUIRED', 'assistance-max', 'Supply a single integer from 0 to 7.', 2);
  return Number(input);
}
export async function main(args = process.argv.slice(2)): Promise<void> {
  let command = args[0] ?? 'help'; let json = args.includes('--json');
  const emit = (result: Result, override?: number): void => {
    if (json) process.stdout.write(JSON.stringify(result) + '\n');
    else { process.stdout.write(`${result.command}: ${result.outcome} (coverage: ${result.coverage})\n${JSON.stringify(result.data, null, 2)}\n`); for (const d of result.diagnostics) process.stdout.write(`${d.code}${d.path ? ` [${d.path}]` : ''}: ${d.message}\n`); }
    process.exitCode = override ?? (result.outcome === 'invalid' ? 1 : ['incomplete', 'proposal', 'recovery-required'].includes(result.outcome) ? 3 : 0);
  };
  try {
    const parsed = parseArgs({ args, options: {
      workspace: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
      name: { type: 'string' }, goal: { type: 'string', multiple: true }, 'assistance-max': { type: 'string' }, 'operation-id': { type: 'string' }, recover: { type: 'boolean' },
      constraint: { type: 'string', multiple: true }, source: { type: 'string' }, 'clone-to': { type: 'string' }, revision: { type: 'string' },
      track: { type: 'string' }, stage: { type: 'string' }, to: { type: 'string' }, 'dry-run': { type: 'boolean' },
      file: { type: 'string' }, prediction: { type: 'string' }, question: { type: 'string' }, model: { type: 'string' }, 'codex-bin': { type: 'string' }, 'claude-bin': { type: 'string' }, 'role-adapter': { type: 'string' },
      handoff: { type: 'string' }, host: { type: 'string' }, skill: { type: 'string', multiple: true }, target: { type: 'string' }
    }, allowPositionals: true, strict: true });
    const { values, positionals } = parsed; json = values.json ?? false; command = positionals[0] ?? 'help';
    if (values.help || command === 'help') { json ? emit({ command: 'help', outcome: 'success', coverage: 'none', data: { help }, diagnostics: [] }) : process.stdout.write(help); return; }
    requireThat(Number(process.versions.node.split('.')[0]) >= 24, 'RUNTIME_UNSUPPORTED', '', 'Node.js 24 or newer is required.');
    if (!['init', 'onboard', 'adapter-handoff', 'track', 'tracks', 'migrate', 'project', 'map', 'task', 'review', 'next', 'status', 'projects', 'validate', 'doctor', 'skills', 'competency'].includes(command)) throw new Failure('USAGE', '', help, 2);
    const initOptions = ['name', 'goal', 'assistance-max', 'operation-id'];
    if ((command !== 'init' && initOptions.some(key => key in values)) || (values.recover && command !== 'doctor')) throw new Failure('USAGE', '', help, 2);
    const skillOptions = ['host', 'skill', 'target'];
    if (command !== 'skills' && skillOptions.some(key => key in values)) throw new Failure('USAGE', '', help, 2);
    if (command === 'skills') {
      if (positionals[1] === 'list' && positionals.length === 2 && !skillOptions.some(key => key in values)) { emit({ command, outcome: 'success', coverage: 'catalog', data: { skills: portableSkills() }, diagnostics: [] }); return; }
      if (positionals[1] !== 'install' || positionals.length !== 2) throw new Failure('USAGE', '', help, 2);
      const hosts: Record<string, () => GenericCapabilityHostAdapter> = { generic: () => new GenericCapabilityHostAdapter(), codex: () => new CodexCapabilityHostAdapter(), 'claude-code': () => new ClaudeCodeCapabilityHostAdapter() };
      const host = hosts[values.host ?? ''];
      if (!host) throw new Failure('USAGE', 'host', 'Choose --host generic, codex or claude-code.', 2);
      emit({ command, outcome: 'success', coverage: 'none', data: installCapabilities(host(), values.target ?? process.cwd(), values.skill ?? portableSkillIds()), diagnostics: [] });
      return;
    }
    if (command === 'competency') {
      if (positionals[1] !== 'show' || positionals.length !== 3) throw new Failure('USAGE', '', help, 2);
      const catalog = catalogs(); const id = positionals[2]!;
      if (!catalog.competencyIds.has(id)) throw new Failure('COMPETENCY_INVALID', id, 'Unknown competency ID.', 2);
      // With a workspace, honour its pinned catalog: a 3.0 pin predates the graph and shows no edges.
      const pinned = values.workspace ? parse(read(resolveWorkspace(values.workspace), statePath('config.yaml')), 'config.yaml').competency_catalog_version : '4.0';
      emit({ command, outcome: 'success', coverage: 'catalog', data: { competency_catalog_version: pinned, advisory: 'Edges suggest where to look; they never award or remove credit.', ...competencyNeighbourhood(competencyGraph(catalog.competencies, pinned), id) }, diagnostics: [] });
      return;
    }
    if (command === 'tracks') { if (positionals.length !== 1) throw new Failure('USAGE', '', help, 2); emit({ command, outcome: 'success', coverage: 'catalog', data: listTracks(), diagnostics: [] }); return; }
    if (command === 'projects') { if (positionals.length !== 1) throw new Failure('USAGE', '', help, 2); if (values.workspace) resolveWorkspace(values.workspace); emit(listProjects(values.track, values.stage)); return; }
    if ((command === 'adapter-handoff') !== (values.handoff !== undefined)) throw new Failure('USAGE', '', help, 2);
    const root = resolveWorkspace(values.workspace, command === 'init' || command === 'adapter-handoff'); const interactive = Boolean(stdin.isTTY && stderr.isTTY);
    const roleAdapterName = values['role-adapter'] ?? process.env.NOETHERKIN_ROLE_ADAPTER ?? 'codex';
    // Resolved only when a command actually needs a role judgment, so a stale environment value cannot break status.
    const adapter = (): RoleAdapter => {
      if (roleAdapterName === 'claude') return new ClaudeRoleAdapter({ binary: values['claude-bin'], model: values.model });
      if (roleAdapterName === 'codex') return new CodexRoleAdapter({ binary: values['codex-bin'], model: values.model });
      throw new Failure('USAGE', 'role-adapter', 'Choose --role-adapter codex or claude.', 2);
    };

    if (command === 'adapter-handoff') {
      if (positionals.length !== 1) throw new Failure('USAGE', '', help, 2);
      const payload = decodeOnboardingHandoff(values.handoff!);
      validateOnboardingHandoff(root, payload);
      if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: { action: payload.action, operation_id: payload.operation_id, proposal_digest: payload.proposal_digest }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run this handoff in a direct learner-controlled terminal. The token is not authorization.' }] }); return; }
      const rl = createInterface({ input: stdin, output: stderr });
      try {
        stderr.write(`Onboarding handoff for ${root}\nAction: ${payload.action}\nProposal: ${payload.proposal_digest}\n${JSON.stringify(payload.input, null, 2)}\n`);
        if (payload.action === 'initialize') {
          if (await rl.question('Type "initialize" to approve: ') !== 'initialize') throw new Failure('CONSENT_REQUIRED', root, 'Initialization was not approved.', 2);
          validateOnboardingHandoff(root, payload);
          const proposal = payload.input.proposal;
          const data = publishInit(root, proposal, bindApprovedInit(root, proposal, true));
          emit({ command, outcome: 'success', coverage: 'bootstrap', data: { outcome: 'completed', action: payload.action, proposal_digest: payload.proposal_digest, ...data }, diagnostics: [] }); return;
        }
        if (payload.action === 'select-track') {
          if (await rl.question('Type "select" to approve: ') !== 'select') throw new Failure('CONSENT_REQUIRED', root, 'Track selection was not approved.', 2);
          validateOnboardingHandoff(root, payload);
          const data = selectTrack(root, payload.input.track_id, files => validateSimulationCandidate(root, files));
          emit({ command, outcome: 'success', coverage: 'simulation', data: { outcome: 'completed', action: payload.action, handoff_operation_id: payload.operation_id, proposal_digest: payload.proposal_digest, publication: data }, diagnostics: [] }); return;
        }
        if (await rl.question('Type "onboard" to approve: ') !== 'onboard') throw new Failure('CONSENT_REQUIRED', root, 'Onboarding was not approved.', 2);
        validateOnboardingHandoff(root, payload);
        const data = await onboard(root, payload.input.constraints ?? [], true, adapter());
        emit({ command, outcome: 'success', coverage: 'simulation', data: { outcome: 'completed', action: payload.action, handoff_operation_id: payload.operation_id, proposal_digest: payload.proposal_digest, publication: data }, diagnostics: [] }); return;
      } finally { rl.close(); }
    }

    if (command === 'init') {
      if (positionals.length !== 1) throw new Failure('USAGE', '', help, 2);
      if (values['operation-id'] !== undefined && !validId(values['operation-id'], 'OP')) throw new Failure('ID_INVALID', 'operation-id', 'Operation ID must be OP-UUID.', 2);
      if (values['assistance-max'] !== undefined) ceiling(values['assistance-max']);
      const hasInputs = values.name !== undefined || values.goal !== undefined || values['assistance-max'] !== undefined;
      const completeInputs = values.name !== undefined && values.goal !== undefined && values['assistance-max'] !== undefined;
      let request: InitRequest | undefined = completeInputs ? { display_name: values.name!, goals: values.goal!, assistance_default_max: Number(values['assistance-max']) } : undefined;
      if (exists(safePath(root, '.apprenticeship'), runtime)) {
        if (hasInputs && !completeInputs) throw new Failure('INPUT_REQUIRED', 'init', 'For input comparison, provide name, goal, and assistance-max together.', 2);
        emit({ command, outcome: 'no-change', coverage: 'bootstrap', data: existingInit(root, request, values['operation-id'])!, diagnostics: [] }); return;
      }
      if (!request && !interactive) throw new Failure('INPUT_REQUIRED', 'init', 'Noninteractive proposals require --name, --goal, and --assistance-max.', 2);
      const rl = interactive ? createInterface({ input: stdin, output: stderr }) : undefined;
      try {
        request ??= { display_name: values.name ?? await rl!.question('Display name: '), goals: values.goal ?? [await rl!.question('Your learning goal: ')], assistance_default_max: ceiling(values['assistance-max'] ?? await rl!.question('Assistance ceiling (0–7): ')) };
        const proposal = proposeInit(request, values['operation-id']);
        if (!interactive || !['darwin', 'linux'].includes(process.platform)) { emit({ command, outcome: 'proposal', coverage: 'none', data: { workspace: root, proposal }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run init in a direct learner-controlled terminal to review and bind this operation.' }] }); return; }
        stderr.write(`Workspace: ${root}\n${JSON.stringify(proposal, null, 2)}\nThis creates pending onboarding and administrative E0 with six reviewed Phase 6 principals.\n`);
        if (await rl!.question('Type "initialize" to approve: ') !== 'initialize') throw new Failure('CONSENT_REQUIRED', root, 'Consent was not granted; no state was published.', 2);
        emit({ command, outcome: 'success', coverage: 'bootstrap', data: publishInit(root, proposal, bindApprovedInit(root, proposal, true)), diagnostics: [] });
      } finally { rl?.close(); }
      return;
    }
    if (command === 'onboard') {
      if (positionals.length !== 1) throw new Failure('USAGE', '', help, 2);
      if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: { constraints: values.constraint ?? [] }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run onboard in a direct learner-controlled terminal to confirm the baseline and evaluation scope.' }] }); return; }
      const rl = createInterface({ input: stdin, output: stderr });
      try { stderr.write('This records an all-unassessed baseline and Java/Spring evaluation scope.\n'); if (await rl.question('Type "onboard" to confirm: ') !== 'onboard') throw new Failure('CONSENT_REQUIRED', root, 'Onboarding was not confirmed.', 2); emit({ command, outcome: 'success', coverage: 'simulation', data: await onboard(root, values.constraint ?? [], true, adapter()), diagnostics: [] }); }
      finally { rl.close(); }
      return;
    }
    if (command === 'track') {
      if (positionals[1] === 'show' && positionals[2] && positionals.length === 3) { emit({ command, outcome: 'success', coverage: 'catalog', data: listTracks(positionals[2]), diagnostics: [] }); return; }
      if (positionals[1] === 'align' && positionals.length === 2) {
        if (!interactive) { const data = trackAlignmentProposal(root); emit({ command, outcome: data.outcome, coverage: 'simulation', data, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run track align in a direct learner-controlled terminal to authorize the new evaluation scope.' }] }); return; }
        const rl = createInterface({ input: stdin, output: stderr });
        try { const proposal = trackAlignmentProposal(root); stderr.write(`${JSON.stringify(proposal, null, 2)}\n`); if (await rl.question('Type "align" to authorize this scope evaluation: ') !== 'align') throw new Failure('CONSENT_REQUIRED', root, 'Track alignment was not authorized.', 2); const data = await alignTrack(root, true, adapter(), files => validateSimulationCandidate(root, files)); emit({ command, outcome: data.outcome, coverage: 'simulation', data, diagnostics: [] }); }
        finally { rl.close(); }
        return;
      }
      if (!(positionals[1] === 'select' && positionals[2] && positionals.length === 3)) throw new Failure('USAGE', '', help, 2);
      if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: { track_id: positionals[2] }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run track select in a direct learner-controlled terminal.' }] }); return; }
      const rl = createInterface({ input: stdin, output: stderr });
      try { stderr.write(`Select ${positionals[2]} as the active advisory track?\n`); if (await rl.question('Type "select" to authorize: ') !== 'select') throw new Failure('CONSENT_REQUIRED', root, 'Track selection was not authorized.', 2); const data = selectTrack(root, positionals[2], files => validateSimulationCandidate(root, files)); emit({ command, outcome: data.outcome, coverage: 'simulation', data, diagnostics: [] }); }
      finally { rl.close(); }
      return;
    }
    if (command === 'migrate') {
      if (!(positionals.length === 1 && values.to === '3.0')) throw new Failure('USAGE', '', help, 2);
      const proposal = planMigration(root); if (values['dry-run'] || proposal.outcome === 'no-change') { emit({ command, outcome: proposal.outcome, coverage: 'structural', data: proposal, diagnostics: [] }); return; }
      if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: proposal, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run migrate in a direct learner-controlled terminal after reviewing the dry-run.' }] }); return; }
      const rl = createInterface({ input: stdin, output: stderr });
      try { stderr.write(`${JSON.stringify(proposal, null, 2)}\n`); if (await rl.question('Type "migrate" to authorize: ') !== 'migrate') throw new Failure('CONSENT_REQUIRED', root, 'Migration was not authorized.', 2); const data = migrateTo3(root, files => validateSimulationCandidate(root, files)); emit({ command, outcome: data.outcome, coverage: 'structural', data, diagnostics: [] }); }
      finally { rl.close(); }
      return;
    }
    if (command === 'project') {
      if (!(positionals[1] === 'select' && positionals[2] && positionals.length === 3)) throw new Failure('USAGE', '', help, 2);
      const projectId = positionals[2];
      requireThat(Boolean(values.source) !== Boolean(values['clone-to']), 'INPUT_REQUIRED', 'project', 'Supply exactly one of --source or --clone-to.');
      let source = values.source;
      if (values['clone-to']) {
        if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: { destination: values['clone-to'], revision: values.revision ?? 'v3.4.1' }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run this clone in a direct learner-controlled terminal.' }] }); return; }
        const rl = createInterface({ input: stdin, output: stderr });
        try { stderr.write(`Clone ${projectId}${values.revision ? ` at ${values.revision}` : ''} into ${values['clone-to']}?\n`); if (await rl.question('Type "clone" to authorize: ') !== 'clone') throw new Failure('CONSENT_REQUIRED', root, 'Clone was not authorized.', 2); source = cloneCatalogProject(root, projectId, values['clone-to'], values.revision ?? (projectId === 'spring-petclinic-microservices' ? 'v3.4.1' : undefined)).source_path; }
        finally { rl.close(); }
      }
      emit({ command, outcome: 'success', coverage: 'simulation', data: selectCatalogProject(root, projectId, source!), diagnostics: [] }); return;
    }
    if (command === 'map') { if (!(positionals.length === 2 && ['init', 'check', 'status'].includes(positionals[1]!))) throw new Failure('USAGE', '', help, 2); emit({ command, outcome: 'success', coverage: 'simulation', data: positionals[1] === 'init' ? initMap(root) : positionals[1] === 'status' ? mapStatus(root) : checkMap(root), diagnostics: [] }); return; }
    if (command === 'task') {
      const action = positionals[1]; let data: any;
      if (action === 'assign' && positionals[2] === 'pet-type-integrity' && positionals.length === 3) data = assignTask(root);
      else if (action === 'begin' && positionals.length === 2) data = beginTask(root);
      else if (action === 'scope' && positionals.length === 2) data = investigationScope(root);
      else if (action === 'submit-design' && positionals.length === 2 && values.file) data = await submitDesign(root, values.file, adapter());
      else if (action === 'submit-change' && positionals.length === 2) data = submitChange(root);
      else if (action === 'test' && positionals.length === 2 && values.prediction) data = testTask(root, values.prediction);
      else if (action === 'help' && positionals.length === 2 && values.question) data = await requestHelp(root, values.question, adapter());
      else throw new Failure('USAGE', '', help, 2);
      emit({ command, outcome: data.outcome === 'rework' ? 'incomplete' : 'success', coverage: 'simulation', data, diagnostics: [] }); return;
    }
    if (command === 'review') {
      if (!(positionals.length === 2 && ['code', 'task', 'performance'].includes(positionals[1]!))) throw new Failure('USAGE', '', help, 2);
      const data = positionals[1] === 'code' ? await codeReview(root, adapter()) : positionals[1] === 'task' ? await taskReview(root, adapter()) : await performanceReview(root, adapter());
      emit({ command, outcome: data.outcome === 'rework' ? 'incomplete' : 'success', coverage: 'simulation', data, diagnostics: [] }); return;
    }
    if (command === 'next') { if (positionals.length !== 1) throw new Failure('USAGE', '', help, 2); emit({ command, outcome: 'success', coverage: 'simulation', data: await advanceNext(root, adapter()), diagnostics: [] }); return; }
    if (command === 'doctor' && values.recover) {
      if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: { workspace: root }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run doctor --recover in a direct learner-controlled terminal.' }] }); return; }
      const rl = createInterface({ input: stdin, output: stderr });
      try {
        if (exists(safePath(root, '.apprenticeship.lock'))) { stderr.write('A retained lock exists.\n'); if (await rl.question('Type "reclaim" to authorize checking a dead lock: ') !== 'reclaim') throw new Failure('CONSENT_REQUIRED', root, 'Lock reclamation was not approved.', 2); reclaimDeadLock(root); }
        if (!exists(safePath(root, '.apprenticeship/pending.json'))) { emit(inspectWorkspace('doctor', root)); return; }
        let generic = false; let plan: any; try { plan = withLock(root, () => planRecovery(root)); } catch { generic = true; plan = withLock(root, () => planTransactionRecovery(root)); }
        stderr.write(JSON.stringify(plan, null, 2) + '\n'); if (await rl.question(`Type "${plan.action}" to authorize recovery: `) !== plan.action) throw new Failure('CONSENT_REQUIRED', root, 'Recovery was not approved.', 2);
        emit({ command, outcome: 'success', coverage: generic ? 'simulation' : 'bootstrap', data: generic ? recoverTransaction(root, plan, files => validateSimulationCandidate(root, files)) : recover(root, plan), diagnostics: [] });
      } finally { rl.close(); }
      return;
    }
    if (!(positionals.length === 1 && ['status', 'validate', 'doctor'].includes(command))) throw new Failure('USAGE', '', help, 2);
    if (command === 'doctor' && exists(safePath(root, '.apprenticeship.lock'))) { emit({ command, outcome: 'recovery-required', coverage: 'none', data: { workspace: root, lock: lockStatus(root) }, diagnostics: [{ code: 'LOCK_BUSY', path: '.apprenticeship.lock', message: 'Canonical state was not read while a retained lock exists.' }] }); return; }
    emit(inspectWorkspace(command as 'status' | 'validate' | 'doctor', root));
  } catch (error) {
    const d = diagnostic(error); const code = error instanceof Failure ? (['INPUT_REQUIRED', 'USAGE'].includes(error.code) ? 2 : error.exitCode) : (String((error as NodeJS.ErrnoException).code).startsWith('ERR_PARSE_ARGS') ? 2 : 1);
    emit({ command, outcome: code === 3 ? 'recovery-required' : 'invalid', coverage: 'none', data: {}, diagnostics: [d] }, code);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
