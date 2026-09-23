# Protocol 3.0 CLI

The executable requires Node.js 24+. Build with `npm ci` and `npm run build`, then run `node dist/cli/main.js` from the repository. Noetherkin is not published to a package registry and, under ACP-012, will not be: the capabilities install into an agent, and the controller is built from source.

## Commands

| Command | Behavior |
| --- | --- |
| `init` | Propose and, in a direct terminal after consent, publish bootstrap state. |
| `status` | Show identity, mode, onboarding, current selection, record counts, and validation coverage. |
| `tracks` | List the 34 versioned advisory tracks and their required competency scopes. |
| `track show <track-id>` | Show outcomes and all editorial project tiers with transparent support metadata. |
| `track select <track-id>` | Explicitly select or switch the active track; a switch creates pending alignment. |
| `track align` | In noninteractive use, report the exact alignment proposal. In a direct terminal, authorize an exact-scope longitudinal assessment and manager review, then adopt the scope only after a `continue` outcome. |
| `projects --track <track-id> [--stage early\|intermediate\|advanced]` | Browse track recommendations without treating tiers as level gates. |
| `validate` | Validate parsing, eleven schema types, references, catalog pins and supported state integrity. |
| `migrate --to 3.0 --dry-run` | Report every proposed protocol migration change without writing. |
| `migrate --to 3.0` | After interactive learner authorization, publish the transactional 2.0 to 3.0 migration. |
| `doctor` | Diagnose retained locks, pending publication, receipts, snapshots, and invalid state. |
| `doctor --recover` | Review and explicitly authorize bootstrap or lifecycle recovery. |
| `onboard` | Confirm scope, obtain a bound all-unassessed baseline, and complete onboarding. |
| `project select <project-id> --source <path>` | Attach any attachable catalog project after origin, cleanliness, revision and path checks. |
| `project select <project-id> --clone-to <path>` | Explicitly clone and attach a catalog project after interactive consent. |
| `map init`, `map check`, `map status` | Create a project-derived template, check the learner-authored map, and report read-only whether this exact map was checked at the current source revision (`absent`, `incomplete`, `unchecked`, `checked`) with the paths it cites. |
| `task assign`, `task begin` | Assign and start the curated `pet-type-integrity` task. |
| `task scope` | List the files the current task's frozen `investigation_paths` globs select inside the bound source; matches that resolve outside it are reported as rejected. |
| `task submit-design`, `task submit-change`, `task test`, `task help` | Gate design, snapshot learner work, run focused tests, or request attributed help. |
| `review code`, `review task`, `review performance` | Publish bound peer, team-lead and manager judgments. |
| `next` | Derive the phase and invoke safe no-input handlers; otherwise report the explicit command needing learner input or confirmation. |

## Role judgments

`onboard`, `track align`, `task submit-design`, `task help`, `review *` and `next` ask a model for one bounded role judgment. Choose the model host with `--role-adapter codex|claude`, or set `NOETHERKIN_ROLE_ADAPTER`; the default is `codex`. `--model` pins a model for either adapter, and `--codex-bin` or `--claude-bin` (or `NOETHERKIN_CODEX_BIN`, `NOETHERKIN_CLAUDE_BIN`) points at a specific binary.

Both adapters send the same prompt and closed output contract, run with tools disabled and without user or project settings, and return output the controller validates again before anything is published. The Claude adapter runs `claude --print --output-format json` in safe and restricted mode with `--tools ""`, an empty MCP configuration and no saved session. A role judgment is never consent and never publishes by itself.

Every command accepts `--workspace <existing-directory>` and `--json`. Init defaults to the current directory. Inspection walks upward to the nearest workspace; an explicit path takes precedence. Track and project catalog browsing can run without a workspace.

Initialization creates an unselected `current-track.yaml`. Onboarding refuses to complete until the learner explicitly selects a track. Initial onboarding aligns universal core plus the track's required competencies. Switching later updates recommendations immediately but leaves evaluation scope pending; existing tasks remain valid and promotion is blocked until a fresh scope agreement, longitudinal assessment and manager performance review support alignment.

For initialization, inputs can be entered interactively or supplied as flags:

```sh
noetherkin init --workspace /absolute/workspace \
  --name "Your name" --goal "Understand and debug a backend" \
  --assistance-max 3
```

Repeat `--goal` for multiple goals. The assistance ceiling is an explicit integer from 0 through 7, not an inferred learner level. The terminal displays the proposed workspace identity and six principals: learner, onboarding coordinator, project curator, peer engineer, team lead and manager. Typing `initialize` grants consent to that registry and bound operation. Any other response publishes nothing. There is no `--yes` or actor override.

Without a terminal on stdin and stderr, complete inputs produce a proposal and exit 3; missing inputs exit 2. A terminal is a direct local-user interface, not a way for an agent harness to impersonate the learner. Unenforceable harnesses must retain the proposal for review. This release has no unattended adapter publishing API.

## Capability adapter handoff

Generic, Codex and Claude Code capability adapters may return an exact command of the form:

```sh
noetherkin adapter-handoff --workspace <workspace> --handoff <token>
```

The handoff token binds the proposal to the resolved workspace and expected canonical state. It is transparent proposal data, not authorization. Run it in a direct learner-controlled terminal, review the displayed action and proposal digest, then type the requested confirmation. Noninteractive execution never publishes. If state changed since preparation, the controller rejects the stale handoff and the host must prepare a new one.

Initialization writes only `.apprenticeship/` records and transaction artifacts. It does not edit AGENTS.md, clone a repository, create evidence or choose a project. Repeating intact commands returns no-change where the lifecycle already records the result. Conflicting identities, inputs, revisions or operation IDs are errors. Later state is never reset by init.

The focused command is fixed to `./mvnw -pl spring-petclinic-customers-service test`. Its exact output, exit status, timestamps, selected base commit and submitted change revision are retained under `apprenticeship-artifacts/test-runs/`. Docker Compose and full-stack startup are outside TASK-001.

## Output and validation coverage

JSON output is one object on stdout with `command`, `outcome`, `coverage`, `data`, and `diagnostics`. Interactive prompts use stderr. Diagnostics contain `code`, `path`, and `message`.

| Exit | Meaning |
| --- | --- |
| 0 | Success or no-change for the stated coverage. |
| 1 | Invalid state or operational failure. |
| 2 | Invalid command, missing input, or denied consent. |
| 3 | Proposal only, a held lock, or recovery required. |

`coverage: bootstrap` verifies initialized live records against the original consent, immutable snapshots, and initialization receipt. Administrative E0 appears only when that validation succeeds. Cache mismatch is an error; reads do not repair it.

`coverage: simulation` applies to the supported PetClinic journey. It checks publication history, role permissions, immutable task fields, legal transitions, design/review revision binding, assistance attribution, content-addressed artifacts, evidence verification and completion gates. Standing is read from the validated cache; Phase 6 remains administrative E0/all-unassessed because one task does not automatically create a longitudinal assessment.

`coverage: catalog` identifies bundled catalog browsing only. Candidate metadata gaps are displayed rather than inferred, and no opaque fit score is calculated. PetClinic remains the only bundled curated task pack; other attached projects hand off to portable task assignment and never expose PetClinic commands.

## Recovery

Run `doctor` first. A live lock owner must finish or be investigated; time elapsed never authorizes lock removal. `doctor --recover` can reclaim a provably dead process on the same host after explicit consent. Unknown owners, malformed owner metadata, and interrupted lock reclamation remain blocked for manual inspection.

A durable prepared manifest exposes an `observed_checkpoint` showing whether each path is on its old, new or absent side. It allows doctor to propose one of three actions:

- **complete:** all retained candidate snapshots validate, and each current file is absent or exactly the proposed bytes;
- **cleanup:** the exact committed receipt and all files verify, so only the pending marker needs removal;
- **rollback:** a candidate cannot be recovered and no receipt committed. Restore existing files byte-for-byte from retained old snapshots and remove only transaction-created files that still match the proposed side.

Recovery rechecks the reviewed checkpoint fingerprint under the lock. Manual edits to a half-written path make it neither side and stop recovery as a conflict. Rollback reads retained old snapshot bytes; it never rebuilds or normalizes them. External edits, unknown state files, conflicting receipts and ambiguous metadata are preserved and block recovery. Corruption after a committed receipt never triggers rollback.

A crash before a durable manifest may leave staging snapshots or temporary files. Their intended operation cannot be established reliably. The CLI preserves them and reports invalid/ambiguous state; it does not fabricate a manifest or recursively erase the directory. Interrupted cleanup can likewise leave empty staging directories requiring inspection.

## Filesystem limits

Publication targets single-user local macOS/Linux filesystems supporting file and directory fsync and atomic hard-link creation. The runtime checks required primitives and fails closed on errors. A missing durability primitive produces an initialization proposal before canonical records are written. Filesystem type cannot be proven portably; network/distributed filesystems are unsupported even when their calls appear to succeed.

The development run exercised macOS only. Linux follows the same implementation path but still needs an actual Linux test run. Other platforms support inspection/proposals where Node and temporary locking are available.

The workspace directory must permit temporary sibling lock metadata. State paths and inspected local artifact paths reject symlinks, traversal, and root rebinding. Local artifacts are never executed or remotely fetched. JSON-compatible YAML is accepted with strict duplicate/tag/alias rejection; numeric input must use finite JSON number syntax, with integers inside JavaScript's exact integer range. Writers emit canonical UTF-8 JSON into `.yaml` files.
