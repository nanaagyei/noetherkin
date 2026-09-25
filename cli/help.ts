/** Per-command usage. The CLI prints only the relevant entry on a usage error, and the overview on `help`. */
export interface CommandHelp { group: string; summary: string; usage: string[]; notes?: string[] }

const judgment = 'Asks a model for one bounded role judgment (see "Role judgments" below).';

export const commandHelp: Record<string, CommandHelp> = {
  setup: { group: 'Start here', summary: 'Check your machine, install the agent skills, and start a workspace, one confirmed step at a time.', usage: ['setup [--target <directory>] [--workspace <directory>]'], notes: ['Safe to rerun: completed steps are skipped.', 'Without a terminal it only reports and never writes.'] },
  next: { group: 'Start here', summary: 'Show the next step and run it when it needs no input or confirmation.', usage: ['next'], notes: ['Runs map init, task assign and task begin by itself, and code, task and performance reviews. Reviews ask a model.'] },
  status: { group: 'Start here', summary: 'Show the workspace, current track and project, standing, and the next step.', usage: ['status'] },
  help: { group: 'Start here', summary: 'Show this overview, or the help for one command.', usage: ['help [<command>]', '<command> --help'] },
  init: { group: 'Workspace', summary: 'Create a workspace after you review and type "initialize".', usage: ['init [--name <display name>] [--goal <goal> ...] [--assistance-max <0-7>] [--operation-id <OP-UUID>]'], notes: ['Prompts for any missing input when run in a terminal.'] },
  validate: { group: 'Workspace', summary: 'Validate every record, schema, reference and catalog pin.', usage: ['validate'] },
  doctor: { group: 'Workspace', summary: 'Check the machine and the workspace, including locks and interrupted writes.', usage: ['doctor', 'doctor --recover'] },
  migrate: { group: 'Workspace', summary: 'Migrate a protocol 2.0 workspace to 3.0.', usage: ['migrate --to 3.0 --dry-run', 'migrate --to 3.0'] },
  tracks: { group: 'Tracks and projects', summary: 'List the learning tracks and what you can run on each.', usage: ['tracks'] },
  track: { group: 'Tracks and projects', summary: 'Show, select or align a track.', usage: ['track show <track-id>', 'track select <track-id>', 'track align'], notes: [`track align: ${judgment}`] },
  projects: { group: 'Tracks and projects', summary: 'Browse catalog projects, optionally for one track and stage.', usage: ['projects [--track <track-id>] [--stage <early|intermediate|advanced>]'] },
  forges: { group: 'Tracks and projects', summary: 'List forge projects: specifications you build from an empty directory.', usage: ['forges [--track <track-id>]'] },
  competency: { group: 'Tracks and projects', summary: 'Show a competency and its advisory graph neighbours.', usage: ['competency show <competency-id>'] },
  onboard: { group: 'Journey', summary: 'Confirm your evaluation scope and record an all-unassessed baseline.', usage: ['onboard [--constraint <text> ...]'], notes: [judgment] },
  project: { group: 'Journey', summary: 'Attach a catalog project or start a forge project.', usage: ['project select <project-id> --source <path>', 'project select <project-id> --clone-to <path> [--revision <ref>]', 'project select <forge-id> --source <new or empty directory>'], notes: ['Paths are resolved inside the workspace.'] },
  map: { group: 'Journey', summary: 'Create, check, or report the status of your codebase map.', usage: ['map init', 'map check', 'map status'] },
  task: { group: 'Journey', summary: 'Work through the current task.', usage: ['task assign', 'task begin', 'task scope', 'task submit-design --file <path>', 'task submit-change', 'task test --prediction <text> [--command <cmd>]', 'task attest --criterion <id> --file <notes>', 'task help --question <text>'], notes: [`task submit-design, task help: ${judgment}`, 'Forge tasks declare their own test command with --command.'] },
  review: { group: 'Journey', summary: 'Request a peer code review, team-lead task review, or manager performance review.', usage: ['review code', 'review task', 'review performance'], notes: [judgment] },
  skills: { group: 'Agent integration', summary: 'List or install the portable agent skills.', usage: ['skills list', 'skills install [--host <claude-code|codex|generic>] [--global | --target <directory>] [--skill <id> ...]'], notes: ['Without --host, installs for every detected agent (Claude Code, Codex).', '--global installs for your user account: ~/.claude/skills or ~/.agents/skills.'] },
  'adapter-handoff': { group: 'Agent integration', summary: 'Review and approve an action an agent prepared for you.', usage: ['adapter-handoff --handoff <token>'] }
};

export const commandNames = Object.keys(commandHelp);

const shared = `Role judgments (onboard, track align, task submit-design, task help, review, next):
  --role-adapter <codex|claude>  default: $NOETHERKIN_ROLE_ADAPTER, else the first working one of codex, claude
  --model <model> [--codex-bin <path>] [--claude-bin <path>]

All commands: --workspace <directory> (default: nearest workspace above the current directory), --json`;

export function overview(): string {
  const groups = new Map<string, string[]>();
  for (const [name, entry] of Object.entries(commandHelp)) groups.set(entry.group, [...(groups.get(entry.group) ?? []), `  ${name.padEnd(16)}${entry.summary}`]);
  return `noetherkin: an engineering apprenticeship you run from your terminal and your AI agent.

New here? Run \`noetherkin setup\`.

${[...groups].map(([group, lines]) => `${group}:\n${lines.join('\n')}`).join('\n\n')}

${shared}

Run \`noetherkin help <command>\` for the usage of one command.
`;
}

export function usageOf(command: string): string {
  const entry = commandHelp[command];
  if (!entry) return overview();
  return `${entry.summary}\n\nUsage:\n${entry.usage.map(line => `  noetherkin ${line}`).join('\n')}${entry.notes?.length ? `\n\n${entry.notes.join('\n')}` : ''}\n`;
}
