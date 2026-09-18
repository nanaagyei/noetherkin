# Skill contract conventions

These eight documents specify future skills; they are not final SKILL.md packages.

- [onboarding](onboarding.md): workspace introduction and profile readiness.
- [projects](projects.md): catalog discovery and learner-approved selection.
- [task-assignment](task-assignment.md): bounded assignment creation.
- [teach](teach.md): conceptual help and teach-back.
- [peer-engineer](peer-engineer.md): collaborative investigation.
- [code-review](code-review.md): review of an identified change.
- [team-lead](team-lead.md): technical assessment and task acceptance.
- [manager](manager.md): patterns, work scope and performance review.

Every invocation receives an identified registered actor, operation ID, workspace location, expected state digests and explicit request. Read-only invocations need no write authorization. Writes obey the role allowlist and transactional state rules. Return an outcome (`completed`, `needs-input`, `blocked`, `no-change`), concise rationale, referenced inputs, proposed or published record IDs, assistance events if any, unresolved gaps and next learner action. These are contract outputs, not a new persisted schema. `completed` describes the invocation, not task completion.

For retries, the caller retains operation ID and prior output IDs in the transaction receipt described by the state model. The same operation with identical inputs returns prior outputs without new records. Same ID with changed inputs is a conflict; a new logical action needs a new ID. If receipt recovery is unavailable, return blocked rather than guessing whether a write succeeded. Identical review input with no new evidence returns the existing current review. New evidence/revisions warrant a new operation and explicit supersession when correcting a prior judgment.

All contracts inherit progressive assistance, attribution, no fabricated evidence, safe path handling and role boundaries from FOUNDATION_V1. They do not restate the full global policy. Missing inputs produce a focused learner question or read-only investigation; malformed state is blocked without repair by guesswork. No contract authorizes remote/destructive actions. The Examples sections are conformance targets, not transcripts of work performed.
