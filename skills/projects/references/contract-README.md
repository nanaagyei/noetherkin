# Skill contract conventions

The first eight documents retain the frozen workflow responsibilities. Protocol 3.0 revises onboarding and projects for explicit tracks and generic attachment without changing skill ownership, roles or evidence authority. Phase 7's derived skill-layer contracts remain narrower capabilities. Contracts are not the final `SKILL.md` entrypoints.

- [onboarding](contract-onboarding.md): workspace introduction and profile readiness.
- [projects](contract-projects.md): catalog discovery and learner-approved selection.
- [task-assignment](contract-task-assignment.md): bounded assignment creation.
- teach (repository context: `contracts/teach.md`; Related skill contract; omitted from this focused bundle.): conceptual help and teach-back.
- peer-engineer (repository context: `contracts/peer-engineer.md`; Related skill contract; omitted from this focused bundle.): collaborative investigation.
- code-review (repository context: `contracts/code-review.md`; Related skill contract; omitted from this focused bundle.): review of an identified change.
- team-lead (repository context: `contracts/team-lead.md`; Related skill contract; omitted from this focused bundle.): technical assessment and task acceptance.
- manager (repository context: `contracts/manager.md`; Related skill contract; omitted from this focused bundle.): patterns, work scope and performance review.
- `codebase-map`, `debug`, `architecture`, `design-review`, and `benchmarks`: focused engineering capabilities.
- `user-agent`, `production-readiness`, and `incident-response`: validation workflows.
- `performance-review`, `promotion-review`, `performance-improvement-plan`, `resume-evidence`, and `retrospective`: career and progression workflows.

Every invocation receives an identified registered actor, operation ID, workspace location, expected state digests and explicit request. Read-only invocations need no write authorization. Writes obey the role allowlist and transactional state rules. Return an outcome (`completed`, `needs-input`, `blocked`, `no-change`), concise rationale, referenced inputs, proposed or published record IDs, assistance events if any, unresolved gaps and next learner action. These are contract outputs, not a new persisted schema. `completed` describes the invocation, not task completion.

For retries, the caller retains operation ID and prior output IDs in the transaction receipt described by the state model. The same operation with identical inputs returns prior outputs without new records. Same ID with changed inputs is a conflict; a new logical action needs a new ID. If receipt recovery is unavailable, return blocked rather than guessing whether a write succeeded. Identical review input with no new evidence returns the existing current review. New evidence/revisions warrant a new operation and explicit supersession when correcting a prior judgment.

All contracts inherit progressive assistance, attribution, no fabricated evidence, safe path handling and role boundaries from FOUNDATION_V1. They do not restate the full global policy. Missing inputs produce a focused learner question or read-only investigation; malformed state is blocked without repair by guesswork. No contract authorizes remote/destructive actions. The Examples sections are conformance targets, not transcripts of work performed.

## Capability routing

A harness selects a capability from its `SKILL.md` description alone. Noetherkin does not implement selection
and must not: dispatch belongs to the host, and implementing it would require harness-specific behavior in the
core, against the charter's agent-independence principle. What this project controls is the routing signal.

Every skill description MUST state both the condition that selects it and a boundary: the adjacent work it does
not own, or the sibling capability that owns it. A description that only says what a skill does gives a harness
no way to rule it out, which is how a learner ends up in `promotion-review` when they wanted `teach`. The
boundary is enforced structurally by `validateInstalled` in `scripts/package-skills.mjs`; a description without
one fails packaging.

A skill's declared handoffs remain prose inside its own contract. They are deliberately not collected into a
second table here, because a duplicate would drift from the contracts and INV-009 requires one canonical source
per critical fact. Naming a successor is not evidence that the successor acted, and a handoff never transfers
authority: roles are not created by skill installation.

## Retained protocol requirements

All contracts inherit the trusted invoker binding, retained grants, assistance recorder/provider rules, full assignment freeze, immutable workspace project snapshots, checkpoint/longitudinal distinction and judgment-validity repair procedure. Pending staleness is a readable valid state, not malformed state. Durable operation lookup belongs to the workspace receipt store and survives loss of caller memory. Review reuse must match author, role, task/period, artifact revision, frozen assignment/scope, evidence, assessments and effective assistance inputs; a retired actor cannot publish a retry as new work.
