#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { createInterface, type Interface } from 'node:readline/promises';
import { stdin, stderr } from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diagnostic, Failure, requireThat, validId, type ObjectValue, type Result } from '../core/common.js';
import { bindApprovedInit, existingInit, planRecovery, proposeInit, publishInit, recover, type InitRequest } from '../core/bootstrap.js';
import { inspectWorkspace, listProjects } from '../core/commands.js';
import { alignTrack, listTracks, runnablePaths, selectTrack, trackAlignmentProposal } from '../core/tracks.js';
import { migrateTo3, planMigration } from '../core/migration.js';
import { exists, lockStatus, read, reclaimDeadLock, resolveWorkspace, runtime, safePath, statePath, withLock } from '../core/storage.js';
import { advanceNext, assignTask, attestCriterion, beginTask, checkMap, currentTask, investigationScope, mapStatus, nextAction, selectForge, cloneCatalogProject, codeReview, initMap, onboard, performanceReview, requestHelp, selectCatalogProject, submitChange, submitDesign, taskReview, testTask, validateSimulationCandidate } from '../core/simulation.js';
import { coreChecks, toolchainChecks, type EnvironmentCheck } from '../core/environment.js';
import { lazyRoleAdapter, probeRoleHost, roleAdapterNames, roleHostChecks, type LazyRoleAdapter } from '../adapters/runtime/select.js';
import { decodeOnboardingHandoff, prepareOnboarding, validateOnboardingHandoff } from '../adapters/hosts/generic/onboarding.js';
import { GenericCapabilityHostAdapter, installCapabilities, portableSkillIds, portableSkills } from '../adapters/hosts/generic/index.js';
import { CodexCapabilityHostAdapter } from '../adapters/hosts/codex/index.js';
import { ClaudeCodeCapabilityHostAdapter } from '../adapters/hosts/claude-code/index.js';
import { planTransactionRecovery, recoverTransaction } from '../core/transactions.js';
import { competencyGraph, competencyNeighbourhood } from '../core/graph.js';
import { catalogs } from '../core/validation.js';
import { forgePack, upstreamPack } from '../core/packs.js';
import { advisoryFile, refreshAdvisory, taskRemediation } from '../core/advisory.js';
import { parse } from '../core/parsing.js';
import { commandNames, overview, usageOf } from './help.js';
import { render, renderEnvironment, renderNextAction } from './render.js';

const checkout = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const assistanceScale = `Assistance ceiling: the most help the mentoring skills give by default. You can change it per request.
  0 independent        1 docs and navigation   2 conceptual hint      3 investigation guidance
  4 pseudocode         5 isolated example      6 partial implementation 7 full implementation
`;

function usage(command: string): Failure { return new Failure('USAGE', command, usageOf(command), 2); }
function ceiling(input: string): number {
  if (!/^[0-7]$/.test(input.trim())) throw new Failure('INPUT_REQUIRED', 'assistance-max', 'Supply a single integer from 0 to 7.', 2);
  return Number(input.trim());
}
function record(root: string, relative: string): ObjectValue { return parse(read(root, statePath(relative)), statePath(relative)); }

type Values = Record<string, any>;

/** Checks positional structure before any workspace lookup, so a typo reports usage rather than a missing workspace. */
function shapeOk(command: string, p: string[], v: Values): boolean {
  const one = p.length === 1;
  switch (command) {
    case 'init': case 'onboard': case 'status': case 'validate': case 'next': case 'tracks': case 'projects': case 'setup': case 'doctor': return one;
    case 'forges': return one;
    case 'adapter-handoff': return one && v.handoff !== undefined;
    case 'migrate': return one && v.to === '3.0';
    case 'competency': return p[1] === 'show' && p.length === 3;
    case 'track': return (p[1] === 'show' && p.length === 3) || (p[1] === 'align' && p.length === 2) || (p[1] === 'select' && p.length === 3);
    case 'project': return p[1] === 'select' && p.length === 3;
    case 'map': return p.length === 2 && ['init', 'check', 'status'].includes(p[1]!);
    case 'review': return p.length === 2 && ['code', 'task', 'performance'].includes(p[1]!);
    case 'skills': return p.length === 2 && ['list', 'install'].includes(p[1]!);
    case 'task': {
      const action = p[1];
      if (action === 'assign') return p.length === 2 || (p.length === 3 && p[2] === 'pet-type-integrity');
      if (p.length !== 2) return false;
      if (action === 'attest') return Boolean(v.criterion && v.file);
      if (action === 'submit-design') return Boolean(v.file);
      if (action === 'test') return Boolean(v.prediction);
      if (action === 'help') return Boolean(v.question);
      return ['begin', 'scope', 'submit-change'].includes(action ?? '');
    }
    default: return false;
  }
}

/** Options that belong to one command only. Anything else is rejected with that command's usage. */
const ownedOptions: Record<string, string[]> = {
  init: ['name', 'goal', 'assistance-max', 'operation-id'], doctor: ['recover'], skills: ['host', 'skill', 'global'], 'adapter-handoff': ['handoff']
};
function optionsOk(command: string, values: Values): boolean {
  for (const [owner, keys] of Object.entries(ownedOptions)) if (owner !== command && keys.some(key => key in values)) return false;
  return !('target' in values) || ['skills', 'setup'].includes(command);
}

function capabilityHosts(): Record<string, () => GenericCapabilityHostAdapter> {
  return { generic: () => new GenericCapabilityHostAdapter(), codex: () => new CodexCapabilityHostAdapter(), 'claude-code': () => new ClaudeCodeCapabilityHostAdapter() };
}
/** Agents present on this machine, for skill installation. A broken wrapper does not count. */
function detectedAgents(values: Values): string[] {
  const agents: string[] = [];
  if (probeRoleHost('claude', { claude_bin: values['claude-bin'] }).healthy) agents.push('claude-code');
  if (probeRoleHost('codex', { codex_bin: values['codex-bin'] }).healthy) agents.push('codex');
  return agents;
}
const agentLabel: Record<string, string> = { 'claude-code': 'Claude Code', codex: 'Codex', generic: 'a generic host' };

function environment(values: Values, root?: string): { checks: EnvironmentCheck[]; hosts: EnvironmentCheck[] } {
  const checks = coreChecks();
  if (root && exists(safePath(root, '.apprenticeship/current-project.yaml'))) {
    const selection = record(root, 'current-project.yaml');
    const { projects, forges } = catalogs();
    const project = [...projects, ...forges].find(item => item.id === selection.project_id);
    if (project) checks.push(...toolchainChecks(project));
  }
  return { checks, hosts: roleHostChecks({ codex_bin: values['codex-bin'], claude_bin: values['claude-bin'] }) };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  let command = args[0] ?? 'help'; let json = args.includes('--json');
  const emit = (result: Result, override?: number): void => {
    if (json) process.stdout.write(JSON.stringify(result) + '\n');
    else (result.outcome === 'invalid' ? process.stderr : process.stdout).write(render(result) + '\n');
    process.exitCode = override ?? (result.outcome === 'invalid' ? 1 : ['incomplete', 'proposal', 'recovery-required'].includes(result.outcome) ? 3 : 0);
  };
  const say = (text: string): void => { if (!json) stderr.write(text); };
  try {
    let parsed;
    try {
      parsed = parseArgs({ args, options: {
        workspace: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
        name: { type: 'string' }, goal: { type: 'string', multiple: true }, 'assistance-max': { type: 'string' }, 'operation-id': { type: 'string' }, recover: { type: 'boolean' },
        constraint: { type: 'string', multiple: true }, source: { type: 'string' }, 'clone-to': { type: 'string' }, revision: { type: 'string' },
        track: { type: 'string' }, stage: { type: 'string' }, to: { type: 'string' }, 'dry-run': { type: 'boolean' },
        file: { type: 'string' }, prediction: { type: 'string' }, question: { type: 'string' }, model: { type: 'string' }, 'codex-bin': { type: 'string' }, 'claude-bin': { type: 'string' }, 'role-adapter': { type: 'string' },
        handoff: { type: 'string' }, command: { type: 'string' }, criterion: { type: 'string' }, host: { type: 'string' }, skill: { type: 'string', multiple: true }, target: { type: 'string' }, global: { type: 'boolean' }
      }, allowPositionals: true, strict: true });
    } catch (error) {
      const known = commandNames.includes(command) ? command : 'help';
      throw new Failure('USAGE', known, `${error instanceof Error ? error.message.split('\n')[0] : String(error)}\n\n${usageOf(known)}`, 2);
    }
    const { values, positionals } = parsed; json = values.json ?? false; command = positionals[0] ?? 'help';
    if (command === 'help' || values.help) {
      const topic = command === 'help' ? positionals[1] : command;
      const text = topic && commandNames.includes(topic) ? usageOf(topic) : overview();
      json ? emit({ command: 'help', outcome: 'success', coverage: 'none', data: { help: text }, diagnostics: [] }) : process.stdout.write(text);
      return;
    }
    requireThat(Number(process.versions.node.split('.')[0]) >= 24, 'RUNTIME_UNSUPPORTED', '', 'Node.js 24 or newer is required.');
    if (!commandNames.includes(command)) throw new Failure('USAGE', command, `Unknown command '${command}'. Run \`noetherkin help\` to see every command, or \`noetherkin setup\` to get started.`, 2);
    if (!optionsOk(command, values) || !shapeOk(command, positionals, values)) throw usage(command);
    // A mistyped adapter name is a usage error for any command that may ask for a judgment, even before a workspace
    // exists. Whether the named host actually runs is checked only when a judgment is needed.
    const requestedAdapter = values['role-adapter'] ?? process.env.NOETHERKIN_ROLE_ADAPTER;
    const judgmentCommands = ['onboard', 'next', 'review', 'setup', 'adapter-handoff'].includes(command) || (command === 'track' && positionals[1] === 'align') || (command === 'task' && ['submit-design', 'help'].includes(positionals[1] ?? ''));
    if (judgmentCommands && requestedAdapter !== undefined && !roleAdapterNames.includes(requestedAdapter as never)) throw new Failure('USAGE', 'role-adapter', 'Choose --role-adapter codex or claude.', 2);

    const interactive = Boolean(stdin.isTTY && stderr.isTTY);
    // Selected only when a judgment actually runs; `resolve()` is called before any confirmation that precedes one.
    const adapter: LazyRoleAdapter = lazyRoleAdapter({ name: values['role-adapter'], codex_bin: values['codex-bin'], claude_bin: values['claude-bin'], model: values.model }, json ? undefined : message => stderr.write(`${message}\n`));

    if (command === 'skills') {
      if (positionals[1] === 'list') { if (['host', 'skill', 'global', 'target'].some(key => key in values)) throw usage(command); emit({ command, outcome: 'success', coverage: 'catalog', data: { skills: portableSkills() }, diagnostics: [] }); return; }
      emit({ command, outcome: 'success', coverage: 'none', data: installSkills(values), diagnostics: [] });
      return;
    }
    if (command === 'competency') {
      const catalog = catalogs(); const id = positionals[2]!;
      if (!catalog.competencyIds.has(id)) throw new Failure('COMPETENCY_INVALID', id, 'Unknown competency ID. `noetherkin track show <track-id>` lists the competencies a track requires.', 2);
      // With a workspace, honour its pinned catalog: a 3.0 pin predates the graph and shows no edges.
      const pinned = values.workspace ? parse(read(resolveWorkspace(values.workspace), statePath('config.yaml')), 'config.yaml').competency_catalog_version : '4.0';
      emit({ command, outcome: 'success', coverage: 'catalog', data: { competency_catalog_version: pinned, advisory: 'Edges suggest where to look; they never award or remove credit.', ...competencyNeighbourhood(competencyGraph(catalog.competencies, pinned), id) }, diagnostics: [] });
      return;
    }
    if (command === 'forges') {
      if (values.track) listTracks(values.track);
      const forges = catalogs().forges.filter(forge => !values.track || forge.track_alignment.includes(values.track));
      emit({ command, outcome: 'success', coverage: 'catalog', data: { forges: forges.map(({ id, name, status, description, track_alignment, recommended_minimum_level, ideal_level, primary_languages, task_packs, context_budget }) => ({ id, name, status, description, track_alignment, recommended_minimum_level, ideal_level, primary_languages, task_packs, context_budget })) }, diagnostics: [] });
      return;
    }
    if (command === 'tracks') { emit({ command, outcome: 'success', coverage: 'catalog', data: listTracks(), diagnostics: [] }); return; }
    if (command === 'track' && positionals[1] === 'show') { emit({ command, outcome: 'success', coverage: 'catalog', data: listTracks(positionals[2]), diagnostics: [] }); return; }
    if (command === 'projects') { if (values.workspace) resolveWorkspace(values.workspace); emit(listProjects(values.track, values.stage)); return; }
    if (command === 'setup') { emit(await setup(values, interactive, adapter, say)); return; }
    if (command === 'doctor' && !values.recover) {
      let root: string | undefined;
      try { root = resolveWorkspace(values.workspace); } catch (error) { if (!(error instanceof Failure && error.code === 'WORKSPACE_NOT_FOUND')) throw error; }
      const env = environment(values, root && exists(safePath(root, '.apprenticeship')) ? root : undefined);
      if (!root || !exists(safePath(root, '.apprenticeship')) && !exists(safePath(root, '.apprenticeship.lock'))) {
        const missing = env.checks.some(check => check.status === 'missing') || env.hosts.every(check => check.status !== 'ok');
        emit({ command, outcome: missing ? 'incomplete' : 'success', coverage: 'none', data: { environment: env.checks, runtime_hosts: env.hosts, summary: `Environment:\n${renderEnvironment(env.checks)}\n\nRole judgment hosts:\n${renderEnvironment(env.hosts)}\n\nNo workspace found here. Run \`noetherkin setup\` to create one.` }, diagnostics: [] });
        return;
      }
      if (exists(safePath(root, '.apprenticeship.lock'))) { emit({ command, outcome: 'recovery-required', coverage: 'none', data: { workspace: root, lock: lockStatus(root) }, diagnostics: [{ code: 'LOCK_BUSY', path: '.apprenticeship.lock', message: 'Canonical state was not read while a retained lock exists. Run `noetherkin doctor --recover` if no other noetherkin process is running.' }] }); return; }
      const result = inspectWorkspace('doctor', root);
      emit({ ...result, data: { ...result.data, environment: env.checks, runtime_hosts: env.hosts } });
      return;
    }

    const root = resolveWorkspace(values.workspace, command === 'init' || command === 'adapter-handoff');
    if (!['init', 'adapter-handoff', 'doctor'].includes(command) && !exists(safePath(root, '.apprenticeship')) && !exists(safePath(root, '.apprenticeship.lock')))
      throw new Failure('WORKSPACE_NOT_INITIALIZED', root, `${root} is not a Noetherkin workspace yet. Run \`noetherkin setup\` or \`noetherkin init --workspace ${root}\` first.`);

    if (command === 'adapter-handoff') {
      const payload = decodeOnboardingHandoff(values.handoff!);
      validateOnboardingHandoff(root, payload);
      if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: { action: payload.action, operation_id: payload.operation_id, proposal_digest: payload.proposal_digest }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run this handoff in a direct learner-controlled terminal. The token is not authorization.' }] }); return; }
      if (payload.action === 'complete-onboarding') adapter.resolve();
      const rl = createInterface({ input: stdin, output: stderr });
      try {
        stderr.write(`Your agent prepared this for ${root}\nAction:   ${payload.action}\nProposal: ${payload.proposal_digest}\n`);
        if (payload.action === 'initialize') {
          const proposal = payload.input.proposal;
          stderr.write(initSummary(root, proposal));
          if (await rl.question('Type "initialize" to approve: ') !== 'initialize') throw new Failure('CONSENT_REQUIRED', root, 'Initialization was not approved.', 2);
          validateOnboardingHandoff(root, payload);
          const data = publishInit(root, proposal, bindApprovedInit(root, proposal, true));
          emit({ command, outcome: 'success', coverage: 'bootstrap', data: { outcome: 'completed', action: payload.action, proposal_digest: payload.proposal_digest, ...data, next_action: nextAction(root) }, diagnostics: [] }); return;
        }
        if (payload.action === 'select-track') {
          stderr.write(`Track:    ${payload.input.track_id}\n`);
          if (await rl.question('Type "select" to approve: ') !== 'select') throw new Failure('CONSENT_REQUIRED', root, 'Track selection was not approved.', 2);
          validateOnboardingHandoff(root, payload);
          const data = selectTrack(root, payload.input.track_id, files => validateSimulationCandidate(root, files));
          emit({ command, outcome: 'success', coverage: 'simulation', data: { outcome: 'completed', action: payload.action, handoff_operation_id: payload.operation_id, proposal_digest: payload.proposal_digest, publication: data, next_action: nextAction(root) }, diagnostics: [] }); return;
        }
        stderr.write(onboardSummary(root, payload.input.constraints ?? []));
        if (await rl.question('Type "onboard" to approve: ') !== 'onboard') throw new Failure('CONSENT_REQUIRED', root, 'Onboarding was not approved.', 2);
        validateOnboardingHandoff(root, payload);
        const data = await onboard(root, payload.input.constraints ?? [], true, adapter);
        emit({ command, outcome: 'success', coverage: 'simulation', data: { outcome: 'completed', action: payload.action, handoff_operation_id: payload.operation_id, proposal_digest: payload.proposal_digest, publication: data, next_action: nextAction(root) }, diagnostics: [] }); return;
      } finally { rl.close(); }
    }

    if (command === 'init') { emit(await initFlow(root, values, interactive)); return; }
    if (command === 'onboard') { emit(await onboardFlow(root, values.constraint ?? [], interactive, adapter)); return; }
    if (command === 'track' && positionals[1] === 'select') { emit(await trackSelectFlow(root, positionals[2]!, interactive)); return; }
    if (command === 'track') {
      if (!interactive) { const data = trackAlignmentProposal(root); emit({ command, outcome: data.outcome, coverage: 'simulation', data, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run track align in a direct learner-controlled terminal to authorize the new evaluation scope.' }] }); return; }
      const proposal = trackAlignmentProposal(root);
      if (proposal.outcome !== 'no-change') adapter.resolve();
      const rl = createInterface({ input: stdin, output: stderr });
      try { stderr.write(`${JSON.stringify(proposal, null, 2)}\n`); if (await rl.question('Type "align" to authorize this scope evaluation: ') !== 'align') throw new Failure('CONSENT_REQUIRED', root, 'Track alignment was not authorized.', 2); const data = await alignTrack(root, true, adapter, files => validateSimulationCandidate(root, files)); emit({ command, outcome: data.outcome, coverage: 'simulation', data, diagnostics: [] }); }
      finally { rl.close(); }
      return;
    }
    if (command === 'migrate') {
      const proposal = planMigration(root); if (values['dry-run'] || proposal.outcome === 'no-change') { emit({ command, outcome: proposal.outcome, coverage: 'structural', data: proposal, diagnostics: [] }); return; }
      if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: proposal, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run migrate in a direct learner-controlled terminal after reviewing the dry-run.' }] }); return; }
      const rl = createInterface({ input: stdin, output: stderr });
      try { stderr.write(`${JSON.stringify(proposal, null, 2)}\n`); if (await rl.question('Type "migrate" to authorize: ') !== 'migrate') throw new Failure('CONSENT_REQUIRED', root, 'Migration was not authorized.', 2); const data = migrateTo3(root, files => validateSimulationCandidate(root, files)); emit({ command, outcome: data.outcome, coverage: 'structural', data, diagnostics: [] }); }
      finally { rl.close(); }
      return;
    }
    if (command === 'project') {
      const projectId = positionals[2]!;
      requireThat(Boolean(values.source) !== Boolean(values['clone-to']), 'INPUT_REQUIRED', 'project', 'Supply exactly one of --source or --clone-to.');
      if (catalogs().forges.some(forge => forge.id === projectId)) {
        // FR-44: a forge project has no upstream to clone or fetch; the learner writes it into an empty directory.
        requireThat(!values['clone-to'] && !values.revision, 'FORGE_NOT_CLONABLE', projectId, 'A forge project has nothing upstream to clone. Use --source <new or empty directory>.');
        const data = selectForge(root, projectId, values.source!);
        emit({ command, outcome: 'success', coverage: 'simulation', data: { ...data, next_action: nextAction(root) }, diagnostics: [] }); return;
      }
      let source = values.source;
      if (values['clone-to']) {
        if (!interactive) { emit({ command, outcome: 'proposal', coverage: 'none', data: { destination: values['clone-to'], revision: values.revision ?? 'v3.4.1' }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: 'Run this clone in a direct learner-controlled terminal.' }] }); return; }
        const rl = createInterface({ input: stdin, output: stderr });
        try { stderr.write(`Clone ${projectId}${values.revision ? ` at ${values.revision}` : ''} into ${values['clone-to']}?\n`); if (await rl.question('Type "clone" to authorize: ') !== 'clone') throw new Failure('CONSENT_REQUIRED', root, 'Clone was not authorized.', 2); source = cloneCatalogProject(root, projectId, values['clone-to'], values.revision ?? (projectId === 'spring-petclinic-microservices' ? 'v3.4.1' : undefined)).source_path; }
        finally { rl.close(); }
      }
      const data = selectCatalogProject(root, projectId, source!);
      emit({ command, outcome: 'success', coverage: 'simulation', data: { ...data, next_action: nextAction(root) }, diagnostics: [] }); return;
    }
    if (command === 'map') { emit({ command, outcome: 'success', coverage: 'simulation', data: positionals[1] === 'init' ? initMap(root) : positionals[1] === 'status' ? mapStatus(root) : checkMap(root), diagnostics: [] }); return; }
    if (command === 'task') {
      const action = positionals[1]; let data: any;
      if (action === 'assign') data = assignTask(root);
      else if (action === 'attest') data = attestCriterion(root, values.criterion!, values.file!);
      else if (action === 'begin') data = beginTask(root);
      else if (action === 'scope') data = investigationScope(root);
      else if (action === 'submit-design') data = await submitDesign(root, values.file!, adapter);
      else if (action === 'submit-change') data = submitChange(root);
      else if (action === 'test') data = testTask(root, values.prediction!, runtime, values.command);
      else data = await requestHelp(root, values.question!, adapter);
      emit({ command, outcome: data.outcome === 'rework' ? 'incomplete' : 'success', coverage: 'simulation', data: withRemediation(root, data), diagnostics: [] }); return;
    }
    if (command === 'review') {
      const data = positionals[1] === 'code' ? await codeReview(root, adapter) : positionals[1] === 'task' ? await taskReview(root, adapter) : await performanceReview(root, adapter);
      emit({ command, outcome: data.outcome === 'rework' ? 'incomplete' : 'success', coverage: 'simulation', data: withRemediation(root, data), diagnostics: [] }); return;
    }
    if (command === 'next') { const data = await advanceNext(root, adapter); emit({ command, outcome: 'success', coverage: 'simulation', data: { ...data, advisory: advisorySummary(root) }, diagnostics: [] }); return; }
    if (command === 'doctor') {
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
    emit(inspectWorkspace(command as 'status' | 'validate', root));
  } catch (error) {
    const d = diagnostic(error); const code = error instanceof Failure ? (['INPUT_REQUIRED', 'USAGE'].includes(error.code) ? 2 : error.exitCode) : 1;
    emit({ command, outcome: code === 3 ? 'recovery-required' : 'invalid', coverage: 'none', data: {}, diagnostics: [d] }, code);
  }
}

function installSkills(values: Values): ObjectValue {
  const hosts = capabilityHosts();
  if (values.global && values.target) throw new Failure('USAGE', 'skills', 'Choose --global or --target, not both.', 2);
  if (values.host !== undefined && !hosts[values.host]) throw new Failure('USAGE', 'host', 'Choose --host claude-code, codex or generic.', 2);
  if (values.global && values.host === 'generic') throw new Failure('USAGE', 'host', 'A generic host has no user-level skill directory; pass --target <directory>.', 2);
  const target = values.global ? os.homedir() : values.target ?? process.cwd();
  if (!values.global && !values.target && realpathSync(target) === checkout) throw new Failure('INSTALL_TARGET_CHECKOUT', target, 'This is the Noetherkin checkout itself. Install with --global for your user account, or --target <your project directory>.', 2);
  const chosen: string[] = values.host ? [values.host] : detectedAgents(values);
  if (!chosen.length) throw new Failure('NO_AGENT_DETECTED', 'host', 'Neither Claude Code nor Codex was found. Pass --host claude-code, codex or generic to install anyway.', 2);
  const reports = chosen.map(host => installCapabilities(hosts[host]!(), target, values.skill ?? portableSkillIds()));
  // One host keeps the original report shape; several are listed.
  return reports.length === 1 ? reports[0]! as unknown as ObjectValue : { installs: reports };
}

/** CF-40: a rework outcome names the specific prerequisite competencies to revisit (ACP-014 remediation). */
function withRemediation(root: string, data: ObjectValue): ObjectValue {
  if (data.outcome !== 'rework') return data;
  const task = currentTask(root);
  return task ? { ...data, remediation: taskRemediation(root, task) } : data;
}

/** Forges and curated packs whose tasks exercise a competency, so the advisory can point at runnable work. */
function exercisedBy(competencyId: string): string[] {
  const { forges, projects } = catalogs();
  const exercises = (templates: ObjectValue[]) => templates.some(template => [...template.primary_competencies, ...template.secondary_competencies].includes(competencyId));
  return [
    ...forges.filter(forge => forge.status !== 'deprecated' && exercises(forge.task_packs.flatMap((pack: string) => forgePack(pack)))).map(forge => forge.id),
    ...projects.filter(project => project.support?.task_packs?.length && exercises(project.support.task_packs.flatMap((pack: string) => upstreamPack(pack)))).map(project => project.id),
  ];
}

/** ACP-014: the labeled advisory block `next` adds. The full view is the derived file; this is its head. */
function advisorySummary(root: string): ObjectValue {
  const refreshed = refreshAdvisory(root);
  const view = refreshed.view;
  const top = (view?.attention ?? []).filter((item: ObjectValue) => item.rank === 1);
  return {
    label: 'Advisory only: derived from your competency cache and graph. Not evidence; it gates nothing; the cache wins any disagreement.',
    file: refreshed.written ? advisoryFile : null,
    top: top.slice(0, 5).map((item: ObjectValue) => ({ competency_id: item.competency_id, position: item.position, reasons: item.reasons, exercised_by: exercisedBy(item.competency_id) })),
    tied_at_top: top.length,
    blocked: (view?.blocked ?? []).slice(0, 5),
    remediation: view?.remediation ?? [],
    contradictions: refreshed.contradictions,
    diagnostics: refreshed.diagnostics,
  };
}

function initSummary(root: string, proposal: ObjectValue): string {
  const request = proposal.request as InitRequest;
  return `
Workspace:          ${root}
Learner:            ${request.display_name}
Goals:              ${request.goals.join('; ')}
Assistance ceiling: ${request.assistance_default_max}
Operation:          ${proposal.operation_id}

This creates .apprenticeship/ here, with you as the learner and five simulated roles that review your
work: onboarding coordinator, project curator, peer engineer, team lead and manager. You start at
administrative level E0 with no demonstrated competency. Nothing else is changed and nothing is cloned.
`;
}

function onboardSummary(root: string, constraints: string[]): string {
  const current = record(root, 'current-track.yaml');
  const track = current.track_id ? catalogs().tracks.find(item => item.id === current.track_id) : undefined;
  return `
Track:  ${track ? `${track.name} (${track.id})` : 'not selected'}
Scope:  universal core competencies plus ${track ? track.required_competencies.join(', ') : 'the selected track'}
${constraints.length ? `Constraints: ${constraints.join('; ')}\n` : ''}
This records a baseline where every competency starts "unassessed" and agrees this evaluation scope.
A simulated team lead reviews it, which asks a model for one judgment.
`;
}

/** Noninteractive onboarding steps return the exact terminal command an agent should hand to the learner. */
function handoffFor(root: string, input: ObjectValue, action: string): ObjectValue | null {
  const prepared = prepareOnboarding('cli', root, input);
  return prepared.next_action?.kind === 'terminal-handoff' && prepared.confirmed.action === action ? prepared.next_action : null;
}

async function initFlow(root: string, values: Values, interactive: boolean, shared?: Interface): Promise<Result> {
  const command = 'init';
  if (values['operation-id'] !== undefined && !validId(values['operation-id'], 'OP')) throw new Failure('ID_INVALID', 'operation-id', 'Operation ID must be OP-UUID.', 2);
  if (values['assistance-max'] !== undefined) ceiling(values['assistance-max']);
  const hasInputs = values.name !== undefined || values.goal !== undefined || values['assistance-max'] !== undefined;
  const completeInputs = values.name !== undefined && values.goal !== undefined && values['assistance-max'] !== undefined;
  let request: InitRequest | undefined = completeInputs ? { display_name: values.name!, goals: values.goal!, assistance_default_max: Number(values['assistance-max']) } : undefined;
  if (exists(safePath(root, '.apprenticeship'), runtime)) {
    if (hasInputs && !completeInputs) throw new Failure('INPUT_REQUIRED', 'init', 'For input comparison, provide name, goal, and assistance-max together.', 2);
    return { command, outcome: 'no-change', coverage: 'bootstrap', data: { ...existingInit(root, request, values['operation-id'])!, next_action: nextAction(root) }, diagnostics: [] };
  }
  if (!request && !interactive) throw new Failure('INPUT_REQUIRED', 'init', 'Noninteractive proposals require --name, --goal, and --assistance-max.', 2);
  const rl = shared ?? (interactive ? createInterface({ input: stdin, output: stderr }) : undefined);
  try {
    if (!request) {
      const display_name = values.name ?? (await rl!.question('Your name: ')).trim();
      const goals = values.goal ?? [(await rl!.question('What do you want to get better at? ')).trim()];
      if (values['assistance-max'] === undefined) stderr.write(assistanceScale);
      request = { display_name, goals, assistance_default_max: ceiling(values['assistance-max'] ?? await rl!.question('Assistance ceiling (0-7, 3 is a common start): ')) };
    }
    if (!interactive || !['darwin', 'linux'].includes(process.platform)) {
      const handoff = handoffFor(root, { display_name: request.display_name, goals: request.goals, assistance_default_max: request.assistance_default_max, operation_id: values['operation-id'] }, 'initialize');
      const proposal = handoff ? decodeOnboardingHandoff(handoff.token).input.proposal : proposeInit(request, values['operation-id']);
      return { command, outcome: 'proposal', coverage: 'none', data: { workspace: root, proposal, next_action: handoff }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: `Run init in a direct learner-controlled terminal to review and bind this operation${handoff ? ', or give the learner the handoff command in next_action' : ''}.` }] };
    }
    const proposal = proposeInit(request, values['operation-id']);
    stderr.write(initSummary(root, proposal));
    if ((await rl!.question('Type "initialize" to approve: ')).trim() !== 'initialize') throw new Failure('CONSENT_REQUIRED', root, 'Consent was not granted; no state was published.', 2);
    return { command, outcome: 'success', coverage: 'bootstrap', data: { ...publishInit(root, proposal, bindApprovedInit(root, proposal, true)), next_action: nextAction(root) }, diagnostics: [] };
  } finally { if (!shared) rl?.close(); }
}

async function trackSelectFlow(root: string, trackId: string, interactive: boolean, shared?: Interface): Promise<Result> {
  const command = 'track';
  const track = listTracks(trackId).tracks[0];
  if (!interactive) {
    const handoff = handoffFor(root, { track_id: trackId }, 'select-track');
    return { command, outcome: 'proposal', coverage: 'none', data: { track_id: trackId, next_action: handoff }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: `Run track select in a direct learner-controlled terminal${handoff ? ', or give the learner the handoff command in next_action' : ''}.` }] };
  }
  const rl = shared ?? createInterface({ input: stdin, output: stderr });
  try {
    const paths = runnablePaths(trackId);
    stderr.write(`\nTrack: ${track.name} (${trackId})\nRequired competencies: ${track.required_competencies.join(', ')}\nRunnable in the CLI: ${paths.length ? paths.map(item => item.name).join(', ') : 'none yet (portable task-assignment skill)'}\nA track guides recommendations; it never grants capability.\n`);
    if ((await rl.question('Type "select" to authorize: ')).trim() !== 'select') throw new Failure('CONSENT_REQUIRED', root, 'Track selection was not authorized.', 2);
    const data = selectTrack(root, trackId, files => validateSimulationCandidate(root, files));
    return { command, outcome: data.outcome, coverage: 'simulation', data: { ...data, next_action: nextAction(root) }, diagnostics: [] };
  } finally { if (!shared) rl.close(); }
}

async function onboardFlow(root: string, constraints: string[], interactive: boolean, adapter: LazyRoleAdapter, shared?: Interface): Promise<Result> {
  const command = 'onboard';
  if (!interactive) {
    const handoff = handoffFor(root, { constraints }, 'complete-onboarding');
    return { command, outcome: 'proposal', coverage: 'none', data: { constraints, next_action: handoff }, diagnostics: [{ code: 'DIRECT_CONSENT_REQUIRED', path: root, message: `Run onboard in a direct learner-controlled terminal to confirm the baseline and evaluation scope${handoff ? ', or give the learner the handoff command in next_action' : ''}.` }] };
  }
  const current = record(root, 'current-track.yaml');
  requireThat(current.track_id, 'PREREQUISITE_MISSING', 'current-track.yaml', 'Select a track before onboarding: `noetherkin tracks`, then `noetherkin track select <track-id>`.');
  adapter.resolve();
  const rl = shared ?? createInterface({ input: stdin, output: stderr });
  try {
    stderr.write(onboardSummary(root, constraints));
    if ((await rl.question('Type "onboard" to confirm: ')).trim() !== 'onboard') throw new Failure('CONSENT_REQUIRED', root, 'Onboarding was not confirmed.', 2);
    const data = await onboard(root, constraints, true, adapter);
    return { command, outcome: 'success', coverage: 'simulation', data: { ...data, next_action: nextAction(root) }, diagnostics: [] };
  } finally { if (!shared) rl.close(); }
}

/**
 * Guided first run. Each step reuses the same command flow and its typed confirmation; setup adds no authority and
 * skips any step already done, so rerunning it resumes where the learner stopped.
 */
async function setup(values: Values, interactive: boolean, adapter: LazyRoleAdapter, say: (text: string) => void): Promise<Result> {
  const command = 'setup';
  const env = environment(values);
  const agents = detectedAgents(values);
  let root: string | undefined;
  try { root = resolveWorkspace(values.workspace); } catch (error) { if (!(error instanceof Failure && ['WORKSPACE_NOT_FOUND'].includes(error.code))) throw error; }
  const initialized = Boolean(root && exists(safePath(root, '.apprenticeship')));
  const blocking = env.checks.filter(check => check.status === 'missing');
  const hostReady = env.hosts.some(check => check.status === 'ok');
  const report = { environment: env.checks, runtime_hosts: env.hosts, detected_agents: agents, workspace: initialized ? root : null };
  const lines = [`1. Your machine\n${renderEnvironment(env.checks)}\n${renderEnvironment(env.hosts)}`];
  if (!interactive || blocking.length) {
    const next = blocking.length ? null : initialized ? nextAction(root!) : { phase: 'CREATE WORKSPACE', command: 'setup', run: 'noetherkin setup', explanation: 'Run setup in a terminal to create a workspace, or run init with --name, --goal and --assistance-max.' };
    lines.push(blocking.length ? '\nFix the missing items above, then rerun `noetherkin setup`.' : '', renderNextAction(next));
    return { command, outcome: blocking.length ? 'incomplete' : 'success', coverage: 'none', data: { ...report, next_action: next, summary: lines.filter(Boolean).join('\n') }, diagnostics: interactive ? [] : [{ code: 'DIRECT_CONSENT_REQUIRED', path: '', message: 'Setup makes changes only in a direct learner-controlled terminal; this run only reported.' }] };
  }
  say(`${lines[0]}\n\n`);
  if (!hostReady) say('No role judgment host works yet. You can continue; onboarding and reviews will need Codex or Claude Code.\n\n');
  const rl = createInterface({ input: stdin, output: stderr });
  const steps: string[] = [];
  const yes = async (question: string): Promise<boolean> => ['', 'y', 'yes'].includes((await rl.question(`${question} [Y/n] `)).trim().toLowerCase());
  try {
    say('2. Agent skills\n');
    if (!agents.length) say('  No Claude Code or Codex found. Later: noetherkin skills install --host generic --target <directory>\n');
    for (const agent of agents) {
      const target = values.target ?? os.homedir();
      const where = values.target ? target : `${agent === 'claude-code' ? '~/.claude/skills' : '~/.agents/skills'}`;
      if (!await yes(`  Install the Noetherkin skills for ${agentLabel[agent]} in ${where}?`)) { steps.push(`skills for ${agent}: skipped`); continue; }
      try {
        const installed = installCapabilities(capabilityHosts()[agent]!(), target, portableSkillIds());
        const written = installed.capabilities.reduce((sum, item) => sum + item.written, 0);
        say(`  ${written ? `Installed ${installed.capabilities.length} skills.` : 'Already installed.'}\n`); steps.push(`skills for ${agent}: ${written ? 'installed' : 'already present'}`);
      } catch (error) { say(`  ${diagnostic(error).message}\n`); steps.push(`skills for ${agent}: conflict`); }
    }
    say('\n3. Workspace\n');
    if (!initialized) {
      const suggested = values.workspace ?? process.cwd();
      const answer = (await rl.question(`  Create your workspace in ${suggested}? Press Enter, or type another existing directory: `)).trim();
      root = resolveWorkspace(answer || suggested, true);
      await initFlow(root, {}, true, rl);
      steps.push('workspace: created'); say(`  Created ${root}.\n`);
    } else say(`  Using ${root}.\n`);
    const workspace = root!;
    const current = record(workspace, 'current-track.yaml');
    if (!current.track_id) {
      say(`\n4. Track\n${listTracks().tracks.map((track: ObjectValue) => `  ${track.id}${runnablePaths(track.id).length ? '  *' : ''}`).join('\n')}\n  (* has a runnable task pack in the CLI today)\n`);
      const trackId = (await rl.question('  Track to follow (Enter to decide later): ')).trim();
      if (trackId) { await trackSelectFlow(workspace, trackId, true, rl); steps.push(`track: ${trackId}`); }
    }
    const profile = record(workspace, 'profile.yaml');
    if (record(workspace, 'current-track.yaml').track_id && profile.onboarding !== 'complete') {
      say('\n5. Onboarding\n');
      if (!hostReady) say('  Skipped: onboarding needs Codex or Claude Code. Install one, then run `noetherkin onboard`.\n');
      else if (await yes('  Onboard now? A simulated team lead records your baseline.')) { await onboardFlow(workspace, [], true, adapter, rl); steps.push('onboarding: complete'); }
    }
    const next = nextAction(workspace);
    return { command, outcome: 'success', coverage: 'none', data: { ...report, workspace, steps, next_action: next, summary: `Setup finished for ${workspace}.\n${steps.map(step => `  - ${step}`).join('\n')}\n\n${renderNextAction(next)}\n\nOpen this folder in your agent and ask it to use the Noetherkin skills, or keep going with \`noetherkin next\`.` }, diagnostics: [] };
  } finally { rl.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
