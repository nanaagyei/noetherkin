# Skill discovery check

`noetherkin skills install` copies the 21 skill bundles into the folder each agent reads and verifies every file by
digest. A verified copy does not show that the agent actually finds the skill and uses it. This check does. It
exercises each supported host at user level and project level, with a request that does not name the skill.

The behavioral evaluations deliberately bypass discovery: they place one bundle at `installed-skill/` and name it
in the prompt. So this check is separate from them.

## Where each host looks

| Host | User level | Project level | Explicit invocation |
| --- | --- | --- | --- |
| Claude Code | `~/.claude/skills/<id>/` | `<project>/.claude/skills/<id>/` | `/<id>` |
| Codex | `~/.agents/skills/<id>/` | `<project>/.agents/skills/<id>/` | `$<id>` |

## The three prompts

Each case asks three questions. Together, the answers separate a path problem from a routing problem:

| Prompt | Text | What it tests |
| --- | --- | --- |
| P1 | `I want to start an engineering apprenticeship workspace in this directory. What should I do first?` | Automatic routing from the skill's `description`. |
| P2 | `Use the onboarding skill to start a Noetherkin workspace here.` | Discovery when the skill is named. |
| P3 | `Without doing anything else, list the names of the skills available to you in this session.` | Whether the host sees the skill at all. |

Reading the results:
- **P1 loads `onboarding`:** routing works.
- **P1 fails but P2 or P3 succeeds:** the host can see the skill, but the `description` text didn't match the request. Fix the description.
- **All three fail:** the host never looked in that folder. Fix the install path.

## What counts as evidence

- **Claude Code** loads a skill through its `Skill` tool. In `--output-format stream-json` output, that appears as a `tool_use` with `"name":"Skill"` and `"input":{"skill":"onboarding"}`. A call whose permission was denied still proves discovery.
- **Codex** loads a skill by reading its `SKILL.md` with a shell command. In `codex exec --json` output, that appears as a `command_execution` item such as `cat …/onboarding/SKILL.md`.
- **A file listing that merely prints `SKILL.md` paths is not a load.** An example is `rg --files .agents`, which prints every installed skill's path.

The agent's own skill list (`/skills` in either host) is a secondary indicator.

## Automated probe

```sh
npm run evals:discovery -- --out <new private directory outside the checkout>
# options: --host claude-code,codex   --scope project,user   --codex-bin <path>   --claude-bin <path>
#          --keep-user-install true   --park-user-install true
```

It runs the project-level cases first, because a user-level install would mask a project-level failure. For each
case it does the following:

1. Creates a scratch Git workspace.
2. Installs with `noetherkin skills install`.
3. Runs the three prompts headlessly.
4. Writes the raw transcripts beside the workspace, not inside it. In the manual run, Codex listed its workspace and read its own transcript file there.
5. Records a verdict per case in `results.json`.

At user level, it removes only the skills it added and never touches skills the learner already had. A project-level case is marked inconclusive when user-level Noetherkin skills already exist, because they could answer instead. `--park-user-install true` moves them into the run directory for those cases and always moves them back. It uses real,
signed-in hosts and calls models, so it never runs in CI. `npm test` covers only its classifier, using synthetic
events (`tests/skill-discovery.test.mjs`). Raw outputs contain host paths and account context: keep them private and
never commit them.

## Manual procedure

Run this in a scratch folder, for example `~/Documents/Codes/Projects/nk-discovery`. Do the project-level cases
before any user-level install.

```sh
export NKROOT=~/Documents/Codes/Projects/nk-discovery; mkdir -p "$NKROOT"
P1='I want to start an engineering apprenticeship workspace in this directory. What should I do first?'
P2='Use the onboarding skill to start a Noetherkin workspace here.'
P3='Without doing anything else, list the names of the skills available to you in this session.'

# Project level (C: Claude Code, D: Codex)
mkdir -p "$NKROOT/C" && cd "$NKROOT/C" && git init -q && noetherkin skills install --host claude-code --target . --json > install.json
claude -p "$P1" --output-format stream-json --verbose --max-turns 4 > p1.jsonl
claude -p "$P2" --output-format stream-json --verbose --max-turns 4 > p2.jsonl
claude -p "$P3" --output-format stream-json --verbose --max-turns 2 > p3.jsonl
mkdir -p "$NKROOT/D" && cd "$NKROOT/D" && git init -q && noetherkin skills install --host codex --target . --json > install.json
codex exec --json --sandbox read-only "$P1" > p1.jsonl
codex exec --json --sandbox read-only "$P2" > p2.jsonl
codex exec --json --sandbox read-only "$P3" > p3.jsonl

# User level (A: Claude Code, B: Codex): the same prompts in fresh empty folders, after
noetherkin skills install --host claude-code --global
noetherkin skills install --host codex --global

# Evidence, in each case folder
grep -o '"name":"Skill"[^}]*}' p1.jsonl p2.jsonl
grep -o '[^" ]*onboarding/SKILL\.md' p1.jsonl p2.jsonl
```

Also start each host interactively once and
note whether `/skills` lists `onboarding`.

## Recorded results

| Date | Host and version | Scope | P1 routed | P2 loaded | P3 listed | `/skills` | Other skills loaded | Method |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-09-28 | Claude Code 2.1.284 | user | yes | yes | yes | yes | none | manual (maintainer) |
| 2026-09-28 | Codex 0.158.0 | user | yes | yes | yes | yes | none | manual (maintainer) |
| 2026-09-28 | Claude Code 2.1.284 | project | yes | yes | yes | yes | none | manual (maintainer) |
| 2026-09-28 | Codex 0.158.0 | project | yes | yes | yes | yes | none | manual (maintainer) |
| 2026-09-28 | Claude Code 2.1.284 | project | yes | yes | yes | not checked | none | `evals:discovery`, user-level skills parked |
| 2026-09-28 | Codex 0.158.0 | project | yes | yes | yes | not checked | none | `evals:discovery`, user-level skills parked |
| 2026-09-28 | Claude Code 2.1.284 | user | yes | yes | yes | not checked | none | `evals:discovery` |
| 2026-09-28 | Codex 0.158.0 | user | yes | yes | yes | not checked | none | `evals:discovery` |

All four manual cases and all four probe cases routed the unnamed request to `onboarding`, on macOS. The first probe run's project-level cases were not isolated, because the manual user-level install was still present; that is why the probe now marks such cases inconclusive. The project-level probe rows above come from a second, isolated run. In the Codex project-level case, the
agent also listed the workspace with `rg --files -uuu .agents`, which printed other skills' paths. It read no other
skill's `SKILL.md`, so no other skill was loaded. Both hosts noted that `noetherkin` was not on `PATH`, because the
check ran the CLI from a checkout, and then gave the learner a correct first step.

These results cover discovery and first routing for `onboarding` only. They do not show that the other 20 skills
route correctly, that routing holds for other phrasings, or that hosts other than these two versions behave the
same way. Rerun this check after a host upgrade or any change to a skill's `description`.
