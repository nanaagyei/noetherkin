import { stringify } from 'yaml';
import type { Diagnostic, ObjectValue, Result } from '../core/common.js';
import { runnablePaths } from '../core/tracks.js';

/**
 * Human-readable output. `--json` bypasses this module entirely, so these views may change freely; anything a
 * script depends on belongs in the JSON result.
 */
const mark = (status: string): string => status === 'ok' ? '[ok]  ' : status === 'warn' ? '[warn]' : '[miss]';

function table(rows: string[][]): string {
  const widths = rows[0]!.map((_, column) => Math.max(...rows.map(row => (row[column] ?? '').length)));
  return rows.map(row => row.map((cell, column) => column === row.length - 1 ? cell : cell.padEnd(widths[column]!)).join('  ').trimEnd()).join('\n');
}

export function renderNextAction(next: ObjectValue | null | undefined): string {
  if (!next) return '';
  if (next.kind === 'terminal-handoff') return `Next: the learner approves this in their own terminal (the token is not authorization)\n  Run:  ${next.command}`;
  const lines = [`Next: ${next.phase}`];
  if (next.explanation) lines.push(`  ${next.explanation}`);
  if (next.handoff) lines.push(`  ${next.handoff}`);
  if (next.run) lines.push(`  Run:  ${next.run}`);
  else if (next.command) lines.push(`  Run:  noetherkin ${next.command}`);
  const options = (next.candidates ?? next.alternatives ?? []) as ObjectValue[];
  if (options.length > 1 || (options.length === 1 && !next.run)) {
    lines.push('  Runnable options:');
    for (const option of options) lines.push(`    ${option.name} (${option.kind}${option.status === 'draft' ? ', draft' : ''}; ${(option.languages ?? []).join(', ')}): noetherkin ${option.command}`);
  }
  if (next.optional) lines.push(`  Optional: noetherkin ${next.optional}`);
  return lines.join('\n');
}

export function renderEnvironment(checks: ObjectValue[]): string {
  return checks.map(check => `  ${mark(check.status)} ${check.check.padEnd(22)} ${check.detail}${check.remedy ? `\n         ${check.remedy}` : ''}`).join('\n');
}

function renderStatus(data: ObjectValue): string {
  const track = data.track?.track_id ? `${data.track.track_id} (${data.track.alignment_status})` : 'not selected';
  const selection = data.selection?.project_id ? `${data.selection.project_id}${data.selection.kind === 'forge' ? ' (forge)' : ''}` : 'none';
  const lines = [
    `Workspace:  ${data.workspace}`,
    `Onboarding: ${data.onboarding ?? 'unknown'}`,
    `Track:      ${track}`,
    `Project:    ${selection}`
  ];
  if (data.standing) lines.push(`Level:      ${data.standing.effective_level} (${data.standing.basis})`);
  if (data.metadata_verified === false) lines.push('State:      NOT verified; see the problems below.');
  if (data.environment) lines.push('', 'Environment:', renderEnvironment(data.environment));
  if (data.runtime_hosts) lines.push('', 'Role judgment hosts:', renderEnvironment(data.runtime_hosts));
  if (data.lock) lines.push(`Lock:       ${JSON.stringify(data.lock)}`);
  if (data.next_action) lines.push('', renderNextAction(data.next_action));
  return lines.join('\n');
}

function renderTracks(data: ObjectValue): string {
  const rows = [['TRACK', 'RUNNABLE IN THE CLI']];
  for (const track of data.tracks) {
    const paths = runnablePaths(track.id);
    rows.push([track.id, paths.length ? paths.map(path => `${path.name}${path.status === 'draft' ? ' (draft)' : ''}`).join(', ') : 'portable skill only']);
  }
  return `${table(rows)}\n\nDetails: noetherkin track show <track-id>    Choose: noetherkin track select <track-id>`;
}

function renderTrack(track: ObjectValue): string {
  const paths = runnablePaths(track.id);
  const lines = [`${track.name} (${track.id})`, track.description, '', 'Outcomes:', ...track.outcomes.map((item: string) => `  - ${item}`), '', `Required competencies: ${track.required_competencies.join(', ')}`, '', 'Recommended projects:'];
  for (const [stage, projects] of Object.entries(track.recommended_projects) as [string, ObjectValue[]][]) {
    lines.push(`  ${stage}:`);
    for (const project of projects) lines.push(`    ${project.id.padEnd(34)} ${project.name}${project.task_packs.length ? '  [curated task pack]' : ''}`);
  }
  lines.push('', paths.length ? `Runnable in the CLI: ${paths.map(path => `${path.name} (${path.kind}${path.status === 'draft' ? ', draft' : ''})`).join(', ')}` : 'Runnable in the CLI: none yet. Attach a project and use the portable task-assignment skill, or pick a forge from `noetherkin forges`.');
  lines.push(`Choose it: noetherkin track select ${track.id}`);
  return lines.join('\n');
}

function renderProjects(data: ObjectValue): string {
  const rows = [['PROJECT', 'STAGE', 'LANGUAGES', 'LEVEL', 'SUPPORT']];
  for (const project of data.projects) rows.push([project.id, project.track_stages.join(',') || '-', (project.primary_languages ?? []).join(','), project.recommended_minimum_level ?? '?', project.support?.task_packs?.length ? 'curated pack' : project.support?.attachable ? 'attachable' : 'browse only']);
  return `${table(rows)}\n\n${data.projects.length} project(s). Attach one: noetherkin project select <project-id> --clone-to source/<project-id>`;
}

function renderForges(data: ObjectValue): string {
  if (!data.forges.length) return 'No forge projects match.';
  return data.forges.map((forge: ObjectValue) => `${forge.id} (${forge.status}): ${forge.name}\n  ${forge.description}\n  Tracks: ${forge.track_alignment.join(', ')}  Languages: ${forge.primary_languages.join(', ')}  Level: ${forge.recommended_minimum_level}-${forge.ideal_level}\n  Start: noetherkin project select ${forge.id} --source ${forge.id}`).join('\n\n');
}

function renderSkills(data: ObjectValue): string {
  if (data.skills) return `${data.skills.map((skill: ObjectValue) => `${skill.name.padEnd(28)} ${skill.description.split('. ')[0]}.`).join('\n')}\n\nInstall: noetherkin skills install --global`;
  const reports = (data.installs ?? [data]) as ObjectValue[];
  return reports.map(report => {
    const written = report.capabilities.reduce((sum: number, item: ObjectValue) => sum + item.written, 0);
    const unchanged = report.capabilities.reduce((sum: number, item: ObjectValue) => sum + item.unchanged, 0);
    return `Installed ${report.capabilities.length} skill(s) for ${report.host} under ${report.target} (${written} file(s) written, ${unchanged} already present).\nInvoke them as ${report.capabilities[0]?.invocation_surfaces[0] ?? ''} and so on, or just ask your agent.`;
  }).join('\n');
}

function renderAdvisory(advisory: ObjectValue | undefined): string {
  if (!advisory) return '';
  const lines = ['', 'Advisory (derived; not evidence; gates nothing):'];
  if (advisory.top.length) {
    const names = advisory.top.map((item: ObjectValue) => item.competency_id).join(', ');
    lines.push(advisory.tied_at_top > 1 ? `  Tied for first attention (${advisory.tied_at_top}): ${names}${advisory.tied_at_top > advisory.top.length ? ', ...' : ''}` : `  First attention: ${names}`);
    const first = advisory.top[0];
    lines.push(`  Why: ${first.reasons.join(' ')}`);
    const runnable = [...new Set(advisory.top.flatMap((item: ObjectValue) => item.exercised_by))];
    if (runnable.length) lines.push(`  Exercised by: ${runnable.join(', ')}`);
  }
  for (const item of advisory.remediation) lines.push(`  Explain before practicing: ${item.competency_id} (${item.reason})`);
  if (advisory.blocked.length) lines.push(`  Waiting on a prerequisite: ${advisory.blocked.map((item: ObjectValue) => `${item.competency_id} (needs ${item.missing_prerequisites.join(', ')})`).join('; ')}`);
  for (const text of advisory.contradictions) lines.push(`  Replaced a stale advisory: ${text}`);
  for (const item of advisory.diagnostics) lines.push(`  Advisory unavailable: ${item.message}`);
  if (advisory.file) lines.push(`  Full view: ${advisory.file} (safe to delete)`);
  return `\n${lines.join('\n')}`;
}

function renderNext(data: ObjectValue): string {
  return renderNextBody(data) + renderAdvisory(data.advisory);
}

function renderNextBody(data: ObjectValue): string {
  if (!data.invoked) return renderNextAction(data);
  const result = data.result as ObjectValue;
  const summary = result.review_outcome ?? result.outcome ?? 'done';
  const lines = [`Ran: noetherkin ${data.command} (${summary})`];
  for (const finding of (result.findings ?? []) as string[]) lines.push(`  - ${finding}`);
  if (data.next) lines.push('', renderNextAction(data.next));
  return lines.join('\n');
}

function renderDiagnostics(diagnostics: Diagnostic[]): string {
  return diagnostics.map(item => item.code === 'USAGE' ? item.message.trimEnd() : `${item.code}${item.path && !item.message.includes(item.path) ? ` [${item.path}]` : ''}: ${item.message}`).join('\n');
}

export function render(result: Result): string {
  const { command, data } = result;
  let body: string;
  if (command === 'help' && typeof data.help === 'string') return data.help;
  if (result.outcome === 'invalid' && Object.keys(data).length === 0) return renderDiagnostics(result.diagnostics);
  if (['status', 'validate', 'doctor'].includes(command) && data.workspace !== undefined) body = renderStatus(data);
  else if (command === 'doctor' || command === 'setup') body = data.summary ?? renderStatus(data);
  else if (command === 'tracks') body = renderTracks(data);
  else if (command === 'track' && data.tracks?.length === 1 && !data.outcome) body = renderTrack(data.tracks[0]);
  else if (command === 'projects' && data.projects) body = renderProjects(data);
  else if (command === 'forges') body = renderForges(data);
  else if (command === 'skills') body = renderSkills(data);
  else if (command === 'next') body = renderNext(data);
  else { const { next_action: _next, summary: _summary, ...rest } = data; body = stringify(rest, { lineWidth: 0 }).trimEnd(); }
  if (data.next_action && !data.summary && !['status', 'validate', 'doctor', 'next'].includes(command)) body += `\n\n${renderNextAction(data.next_action)}`;
  const header = result.outcome === 'success' || result.outcome === 'no-change' ? '' : `${command}: ${result.outcome}\n`;
  return `${header}${body}${result.diagnostics.length ? `\n\n${renderDiagnostics(result.diagnostics)}` : ''}`;
}
