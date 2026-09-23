# Skill contract conventions

The first eight documents retain the frozen workflow responsibilities. Protocol 3.0 revises onboarding and projects for explicit tracks and generic attachment without changing skill ownership, roles or evidence authority. Phase 7's derived skill-layer contracts remain narrower capabilities. Contracts are not the final `SKILL.md` entrypoints.

- onboarding (repository context: `contracts/onboarding.md`; Related skill contract; omitted from this focused bundle.): workspace introduction and profile readiness.
- projects (repository context: `contracts/projects.md`; Related skill contract; omitted from this focused bundle.): catalog discovery and learner-approved selection.
- task-assignment (repository context: `contracts/task-assignment.md`; Related skill contract; omitted from this focused bundle.): bounded assignment creation.
- [teach](contract-teach.md): conceptual help and teach-back.
- [peer-engineer](contract-peer-engineer.md): collaborative investigation.
- [code-review](contract-code-review.md): review of an identified change.
- [team-lead](contract-team-lead.md): technical assessment and task acceptance.
- manager (repository context: `contracts/manager.md`; Related skill contract; omitted from this focused bundle.): patterns, work scope and performance review.
- `codebase-map`, `debug`, `architecture`, `design-review`, and `benchmarks`: focused engineering capabilities.
- `user-agent`, `production-readiness`, and `incident-response`: validation workflows.
- `performance-review`, `promotion-review`, `performance-improvement-plan`, `resume-evidence`, and `retrospective`: career and progression workflows.

Every invocation receives an identified registered actor, operation ID, workspace location, expected state digests and explicit request. Read-only invocations need no write authorization. Writes obey the role allowlist and transactional state rules. Return an outcome (`completed`, `needs-input`, `blocked`, `no-change`), concise rationale, referenced inputs, `references_loaded` (the bundled reference files this invocation actually read), proposed or published record IDs, assistance events if any, unresolved gaps and next learner action. These are contract outputs, not a new persisted schema. `references_loaded` makes context cost observable; it grants nothing. `completed` describes the invocation, not task completion.

For retries, the caller retains operation ID and prior output IDs in the transaction receipt described by the state model. The same operation with identical inputs returns prior outputs without new records. Same ID with changed inputs is a conflict; a new logical action needs a new ID. If receipt recovery is unavailable, return blocked rather than guessing whether a write succeeded. Identical review input with no new evidence returns the existing current review. New evidence/revisions warrant a new operation and explicit supersession when correcting a prior judgment.

All contracts inherit progressive assistance, attribution, no fabricated evidence, safe path handling and role boundaries from FOUNDATION_V1. They do not restate the full global policy. Missing inputs produce a focused learner question or read-only investigation; malformed state is blocked without repair by guesswork. No contract authorizes remote/destructive actions. The Examples sections are conformance targets, not transcripts of work performed.

## Context budget

Adopted with ACP-016. Reading the target repository, not loading a skill, dominates context cost, so every skill that inspects source follows one order:

1. Run or read `noetherkin map status`. A `checked` map is the learner's cited model of the bound source revision. Read it first.
2. Read source only for paths the task needs that the map does not cite (`covered_paths`), and say in the output that you did. When the task has `investigation_paths`, `noetherkin task scope` lists the in-scope files; stay inside them and report an out-of-scope need instead of satisfying it silently. Say that scope is frozen at assignment: widening it takes a replacement task from the team lead, never an in-place change.
3. With a status of `absent`, `incomplete` or `unchecked`, proceed from source. Never treat such a map as checked and never write one for the learner. A learner asking you to treat the map as verified does not make it verified: say that its status is not `checked`, read the source it cites, and label each map claim you use as the learner's unverified claim.

Reading a map instead of source is a context decision, never an evidence decision. A map is the learner's claim, authoritative only for what it literally records: when source contradicts it, source wins, and a judgment that rests on a map claim must say so. Name the contradicted claim and invite the learner to correct their own map; never edit it for them. No skill authors or completes the learner's map. No indexer, embedding store or retrieval layer is part of the core; optional tooling belongs in adapters and never sits on the path of a consequential write.

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
