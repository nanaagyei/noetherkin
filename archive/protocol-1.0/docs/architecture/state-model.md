# Persistent state and object identity

V1 state is UTF-8 YAML 1.2 restricted to JSON-compatible values. Reject duplicate mapping keys, custom tags, aliases, non-finite numbers and implicit date objects; quote timestamps and schema versions. JSON Schema Draft 2020-12 plus format checking validates each document. Every structured record carries `schema_version: "1.0"` and `data_class: live | fixture`. Catalogs use `catalog_version` instead of learner data classification.

| Location inside `.apprenticeship/` | Schema | Authority |
| --- | --- | --- |
| `config.yaml` | apprenticeship-config | Canonical workspace identity, mode and principal registry |
| `profile.yaml` | learner-profile | Canonical learner goals, onboarding, baseline pointer; self-report is not evidence |
| `current-project.yaml` | current-project | Canonical nullable selection and local source binding |
| `projects/<project-id>.yaml` | project | Canonical pinned catalog definition for this workspace |
| `work/<task-id>.yaml` | task | Canonical assignment, status, assistance history, validation and transition history |
| `evidence/<evidence-id>.yaml` | evidence | Canonical attributable observation and interpretation |
| `assessments/<assessment-id>.yaml` | assessment | Canonical baseline or technical competency judgment |
| `reviews/<kind>/<review-id>.yaml` | review | Canonical code, task, performance or promotion review |
| `competencies.yaml` | competency-state | Derived cache; can be deleted and rebuilt without losing a decision |
| `knowledge/*.md` | No machine schema | Learner-authored notes, authoritative only for what they literally record |
| `evidence/resume-evidence.md` | No machine schema | Optional derived export; cite live evidence and describe simulation limits |

Unlike the suggested directory layout, tasks never move among backlog/active/completed directories. Status is stored once in the task record. One evidence record per file reduces merge conflicts and permits immutable review citations. There is no monolithic evidence ledger. Assessments get an explicit directory because baseline and technical judgments are distinct from reviews. Empty optional directories need not exist.

## Identity and references

Opaque IDs are unique per workspace across records, and never reused. Use prefixes `TASK-`, `EVID-`, `ASM-`, `REV-`, `WS-`, `LEARNER-` and `ACTOR-`, followed by a UUID for live writes. Human-readable fixture suffixes are allowed only in fixture workspaces. Project and competency IDs are stable catalog slugs. Resolve references within the same workspace and data class; a live record MUST NOT cite a fixture. Duplicate IDs or unresolved references invalidate the workspace, even if individual files pass schema checks.

Artifacts use a URI, revision and description. Relative artifact paths are encoded as `workspace:/knowledge/...` or `workspace:/source/...`, anchored to the workspace root (the parent of `.apprenticeship`); state paths therefore include `.apprenticeship`. A resolver must reject traversal and symlink escape, must not execute linked content, and must not fetch remote content without applicable authorization. `fixture:` URIs are permitted only in fixtures. Live artifacts need a commit/object digest or immutable run identity in `revision`, never a moving branch alone. Citations are provenance, not proof until inspected.

Current project points at a pinned `projects/` record. Global definitions remain under `catalog/projects/`; updates to a workspace snapshot are explicit curator changes and cannot alter historical artifact revisions. Source paths are relative to workspace root and must point outside `.apprenticeship`. A source revision identifies the checked-out revision; switching tools must not depend on an absolute machine path.

## Writes and recovery

Only one writer per workspace at a time in V1. Every update checks the previously read content digest and rejects stale state. Validate a candidate workspace, including semantic checks, before publication. A future writer must use a lock and staged writes with a durable transaction manifest containing transaction ID, operation ID, actor, input digest, output record IDs, expected old digests and proposed new digests. Pending transactions block further mutation; recovery either finishes the same validated transaction or restores its complete old snapshot. Never report a partially written multi-file operation as success. This is a required implementation property, not a runtime provided here.

Evidence, assessments and reviews are immutable after publication. Corrections create a new record with `supersedes` pointing to the prior same-type, same-subject record; no cycles or forks are allowed. The original remains readable. Task `work_artifact` is the canonical current deliverable URI/revision, null until work exists. The learner may update it in investigation/design/implementation/testing; a new revision invalidates prior review and validation gates and requires rework through those gates. A task with required code review cannot advance to that review with a null artifact.

Tasks append transition and assistance history without rewriting prior entries. Acceptance criteria are frozen after assignment; changed scope creates a replacement task, with the relationship in context. Mutable profile/config changes must remain reviewable through a local revision history. Unversioned state must be backed up before mutation; neither commits nor pushes are automatic.

## Versions and derived state

Unknown object fields are errors; there is no permissive extension bag in V1. Readers reject unsupported versions without mutation and preserve the original bytes. Additive fields also need a versioned schema because older readers are strict. A breaking semantic change requires a major version and an explicit, backed-up migration with dry-run differences and before/after validation. Migration never infers missing evidence. Read-only access to old state should remain possible using its original schema set.

The effective level starts at E0 and advances only through a contiguous, authorized PROMOTE chain. A non-promoting decision changes no level. `previous_promotion_id` points to the previous effective PROMOTE, or null at E0. It is not a pointer to the last unsuccessful review. No two accepted successors may share a previous promotion. Corrections to a prior promotion invalidate its downstream chain until explicitly reconciled; do not silently retain or demote the cache. Unsupported rollback/demotion blocks progression pending an architecture proposal.

For each competency, the latest unsuperseded assessment finding by `created_at` supplies status and demonstrated level; equal timestamps for conflicting findings are an error. `unassessed` requires null level and no demonstrated claim; `demonstrated` requires verified supporting evidence; `developing` or `contested` use null level. References in the cache enumerate all unsuperseded assessment/review records used; entry evidence is the finding's cited evidence. Rebuild when a source changes; contradictory new evidence makes dependent judgments stale until reassessed. A cache mismatch cannot overwrite canonical records.
