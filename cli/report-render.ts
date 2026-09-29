import { findings, type Actor, type Report, type ReportCompetency, type ReportEvidence } from '../core/report.js';

/**
 * Renderers for `noetherkin report`. The HTML is one self-contained file: inline CSS, no scripts, no external
 * requests, light and dark themes, and a print stylesheet. Every record value is escaped, and artifact URIs are
 * shown as text, never as links, so opening the file fetches nothing.
 */

export const generatorMarker = 'noetherkin report';

const escape = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const anchor = (id: string): string => `r-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
const who = (actor: Actor): string => actor.simulated ? `simulated ${actor.role}` : actor.role;
const date = (value: string | null): string => value ? value.slice(0, 10) : 'unknown';
const assistance = (level: number | null): string => level === null ? 'not recorded' : `level ${level} of 7`;
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const findingLabel: Record<string, string> = { demonstrated: 'Demonstrated', developing: 'Developing', contested: 'Contested', unassessed: 'Unassessed' };
const level = (identity: Report['identity']): string => identity.standing === 'unresolved'
  ? `Effective level: none while standing is unresolved (last awarded ${identity.last_awarded_level ?? 'none'})`
  : `Effective level ${identity.effective_level ?? 'E0'}, last awarded ${identity.last_awarded_level ?? 'none'}, standing ${identity.standing ?? 'unknown'}`;

const css = `
:root { color-scheme: light dark; --bg: #fbfaf7; --fg: #1d1c1a; --muted: #5f5b54; --line: #dcd7cd; --card: #ffffff; --accent: #2f5d8a; --warn-bg: #fff1d6; --warn-fg: #6b4300; --stale-bg: #eeeae2; }
@media (prefers-color-scheme: dark) { :root { --bg: #141312; --fg: #ece8e1; --muted: #a8a197; --line: #34312d; --card: #1c1b19; --accent: #8fb6de; --warn-bg: #3a2c10; --warn-fg: #f3d49a; --stale-bg: #2a2825; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 52rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
h1 { font-size: 1.9rem; margin: 0 0 .25rem; } h2 { font-size: 1.3rem; margin: 2.5rem 0 .75rem; padding-bottom: .35rem; border-bottom: 1px solid var(--line); } h3 { font-size: 1.05rem; margin: 1.5rem 0 .5rem; }
p, li { margin: .25rem 0; } ul, ol { padding-left: 1.25rem; } code { font: .88em ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.muted { color: var(--muted); } .banner { background: var(--warn-bg); color: var(--warn-fg); border-radius: 8px; padding: .75rem 1rem; font-weight: 600; margin: 1rem 0; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: .8rem 1rem; margin: .6rem 0; break-inside: avoid; }
.tag { display: inline-block; font-size: .78rem; border: 1px solid var(--line); border-radius: 999px; padding: 0 .5rem; margin-left: .35rem; color: var(--muted); }
.stale { background: var(--stale-bg); } a { color: var(--accent); } .plain { list-style: none; padding: 0; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: .2rem 1rem; margin: 1rem 0; } dt { color: var(--muted); } dd { margin: 0; }
@media print { body { background: #fff; color: #000; font-size: 11pt; } main { max-width: none; padding: 0; } .card { border-color: #bbb; } a { color: #000; text-decoration: none; } h2 { break-after: avoid; } }
`;

function evidenceLinks(ids: string[], shown: Set<string>): string {
  if (!ids.length) return '<span class="muted">no evidence cited</span>';
  return ids.map(id => shown.has(id) ? `<a href="#${anchor(id)}">${escape(id)}</a>` : `${escape(id)} <span class="tag">not shown</span>`).join(', ');
}

function competencyHtml(item: ReportCompetency, shown: Set<string>): string {
  return `<li class="card${item.stale ? ' stale' : ''}"><strong>${escape(item.name)}</strong> <code>${escape(item.competency_id)}</code>${item.demonstrated_level ? `<span class="tag">${escape(item.demonstrated_level)}</span>` : ''}${item.stale ? '<span class="tag">stale</span>' : ''}<br><span class="muted">Evidence:</span> ${evidenceLinks(item.evidence_ids, shown)}</li>`;
}

function evidenceHtml(item: ReportEvidence): string {
  const artifacts = item.artifacts.map(artifact => `<li><code>${escape(artifact.uri)}</code>${artifact.revision ? ` at <code>${escape(artifact.revision)}</code>` : ''}: ${escape(artifact.description)}</li>`).join('');
  return `<article class="card${item.stale ? ' stale' : ''}" id="${anchor(item.id)}"><h3>${escape(item.id)} <code>${escape(item.competency_id)}</code>${item.stale ? '<span class="tag">stale</span>' : ''}${item.verification !== 'verified' ? `<span class="tag">${escape(item.verification)}</span>` : ''}</h3>
<p>${escape(item.observation)}</p>
<p class="muted">Observed ${escape(date(item.observed_at))}${item.task_id ? ` in task <code>${escape(item.task_id)}</code>` : ''}${item.project_id ? ` on <code>${escape(item.project_id)}</code>` : ''}. Recorded by the ${escape(who(item.recorded_by))}; ${escape(item.verification)}. ${escape(capital(item.direction))} evidence toward ${escape(item.target_level)}, ${escape(item.strength)}, ${escape(item.independence)}; highest assistance ${escape(assistance(item.highest_assistance))}.</p>
${artifacts ? `<ul>${artifacts}</ul>` : ''}</article>`;
}

export function renderReportHtml(report: Report): string {
  const { identity, workspace } = report;
  const shown = new Set(report.evidence.map(item => item.id));
  const name = identity.display_name ?? 'Unnamed learner';
  const competencies = findings.map(finding => `<h3>${findingLabel[finding]} <span class="muted">(${report.competencies[finding].length})</span></h3>${report.competencies[finding].length ? `<ul class="plain">${report.competencies[finding].map(item => competencyHtml(item, shown)).join('')}</ul>` : '<p class="muted">None.</p>'}`).join('\n');
  const tasks = report.tasks.length ? report.tasks.map(task => `<div class="card${task.stale ? ' stale' : ''}" id="${anchor(task.id)}"><strong>${escape(task.title)}</strong>${task.stale ? '<span class="tag">stale</span>' : ''}<br><span class="muted"><code>${escape(task.project_id)}</code> (${task.project_kind === 'forge' ? 'forge project: learner-authored software, simulated process' : 'upstream project'}), assigned ${escape(date(task.assigned_at))}, completed ${escape(date(task.completed_at))}, highest assistance ${escape(assistance(task.highest_assistance))}.</span>${task.evidence_ids.length ? `<br><span class="muted">Evidence:</span> ${evidenceLinks(task.evidence_ids, shown)}` : ''}${task.reviews.length ? `<ul>${task.reviews.map(review => `<li>${escape(review.kind)} review by the ${escape(who(review.author))}: <strong>${escape(review.outcome ?? 'no outcome')}</strong> (${escape(date(review.created_at))})${review.stale ? '<span class="tag">stale</span>' : ''}</li>`).join('')}</ul>` : ''}</div>`).join('\n') : '<p class="muted">No completed tasks yet.</p>';
  const timeline = report.timeline.length ? `<ol>${report.timeline.map(item => `<li><code>${escape(item.at.slice(0, 16).replace('T', ' '))}</code> ${escape(item.description)} <span class="muted">(${escape(who(item.actor))})</span></li>`).join('')}</ol>` : '<p class="muted">No transitions or reviews yet.</p>';
  const problems = workspace.validation.problems.length ? `<h3>Validation problems</h3><ul>${workspace.validation.problems.map(problem => `<li><code>${escape(problem.code)}</code> ${escape(problem.path)}: ${escape(problem.message)}</li>`).join('')}</ul>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="${generatorMarker} ${report.report_version}">
<title>${escape(name)}: engineering progress</title>
<style>${css}</style>
</head>
<body>
<main>
<header id="identity">
<h1>${escape(name)}</h1>
<p class="muted">Engineering apprenticeship progress, generated ${escape(date(report.generated_at))} by Noetherkin from workspace records.</p>
${workspace.fixture ? '<p class="banner">FIXTURE DATA. This workspace is a fixture: the learner, work and reviews shown did not occur.</p>' : ''}
<dl>
<dt>Track</dt><dd>${identity.track_id ? `<code>${escape(identity.track_id)}</code> (${escape(identity.track_alignment)})` : 'not selected'}</dd>
<dt>Project</dt><dd>${identity.project_id ? `<code>${escape(identity.project_id)}</code> (${escape(identity.project_kind)})` : 'none'}</dd>
<dt>Level</dt><dd>${escape(level(identity))}</dd>
${workspace.mode && workspace.mode !== 'active' ? `<dt>Workspace</dt><dd>${escape(workspace.mode)}</dd>` : ''}
</dl>
</header>
<section id="competencies"><h2>Competencies</h2>
${competencies}
</section>
<section id="evidence"><h2>Evidence</h2>
${report.evidence.length ? report.evidence.map(evidenceHtml).join('\n') : '<p class="muted">No evidence shown.</p>'}
</section>
<section id="tasks"><h2>Completed tasks</h2>
${tasks}
</section>
<section id="timeline"><h2>Timeline</h2>
${timeline}
</section>
<section id="limits"><h2>Limits</h2>
<ul>${report.limits.map(limit => `<li>${escape(limit)}</li>`).join('')}</ul>
${problems}
</section>
</main>
</body>
</html>
`;
}

export function renderReportMarkdown(report: Report): string {
  const { identity, workspace } = report;
  const shown = new Set(report.evidence.map(item => item.id));
  const ref = (ids: string[]): string => ids.length ? ids.map(id => shown.has(id) ? `[${id}](#${id.toLowerCase()})` : `${id} (not shown)`).join(', ') : 'no evidence cited';
  const lines = [`<!-- ${generatorMarker} ${report.report_version} -->`, `# ${identity.display_name ?? 'Unnamed learner'}`, '', `Engineering apprenticeship progress, generated ${date(report.generated_at)} by Noetherkin from workspace records.`, ''];
  if (workspace.fixture) lines.push('> **FIXTURE DATA.** This workspace is a fixture: the learner, work and reviews shown did not occur.', '');
  lines.push(`- **Track:** ${identity.track_id ? `\`${identity.track_id}\` (${identity.track_alignment})` : 'not selected'}`, `- **Project:** ${identity.project_id ? `\`${identity.project_id}\` (${identity.project_kind})` : 'none'}`, `- **Level:** ${level(identity)}`);
  if (workspace.mode && workspace.mode !== 'active') lines.push(`- **Workspace:** ${workspace.mode}`);
  lines.push('', '## Competencies');
  for (const finding of findings) {
    lines.push('', `### ${findingLabel[finding]} (${report.competencies[finding].length})`, '');
    if (!report.competencies[finding].length) lines.push('None.');
    for (const item of report.competencies[finding]) lines.push(`- **${item.name}** \`${item.competency_id}\`${item.demonstrated_level ? ` ${item.demonstrated_level}` : ''}${item.stale ? ' _(stale)_' : ''}. Evidence: ${ref(item.evidence_ids)}`);
  }
  lines.push('', '## Evidence');
  if (!report.evidence.length) lines.push('', 'No evidence shown.');
  for (const item of report.evidence) {
    lines.push('', `### ${item.id}`, '', `\`${item.competency_id}\`${item.stale ? ' _(stale)_' : ''}${item.verification !== 'verified' ? ` _(${item.verification})_` : ''}`, '', item.observation, '',
      `Observed ${date(item.observed_at)}${item.task_id ? ` in task \`${item.task_id}\`` : ''}${item.project_id ? ` on \`${item.project_id}\`` : ''}. Recorded by the ${who(item.recorded_by)}; ${item.verification}. ${capital(item.direction)} evidence toward ${item.target_level}, ${item.strength}, ${item.independence}; highest assistance ${assistance(item.highest_assistance)}.`);
    for (const artifact of item.artifacts) lines.push(`- \`${artifact.uri}\`${artifact.revision ? ` at \`${artifact.revision}\`` : ''}: ${artifact.description}`);
  }
  lines.push('', '## Completed tasks', '');
  if (!report.tasks.length) lines.push('No completed tasks yet.');
  for (const task of report.tasks) {
    lines.push(`- **${task.title}**${task.stale ? ' _(stale)_' : ''}: \`${task.project_id}\` (${task.project_kind === 'forge' ? 'forge project: learner-authored software, simulated process' : 'upstream project'}), completed ${date(task.completed_at)}, highest assistance ${assistance(task.highest_assistance)}.${task.evidence_ids.length ? ` Evidence: ${ref(task.evidence_ids)}` : ''}`);
    for (const review of task.reviews) lines.push(`  - ${review.kind} review by the ${who(review.author)}: **${review.outcome ?? 'no outcome'}** (${date(review.created_at)})${review.stale ? ' _(stale)_' : ''}`);
  }
  lines.push('', '## Timeline', '');
  if (!report.timeline.length) lines.push('No transitions or reviews yet.');
  for (const item of report.timeline) lines.push(`- \`${item.at.slice(0, 16).replace('T', ' ')}\` ${item.description} (${who(item.actor)})`);
  lines.push('', '## Limits', '', ...report.limits.map(limit => `- ${limit}`));
  if (workspace.validation.problems.length) lines.push('', '### Validation problems', '', ...workspace.validation.problems.map(problem => `- \`${problem.code}\` ${problem.path}: ${problem.message}`));
  return `${lines.join('\n')}\n`;
}
