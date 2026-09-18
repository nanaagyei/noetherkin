# Persistent state and object identity

State is UTF-8 YAML 1.2 restricted to JSON-compatible values. Reject duplicate mapping keys, custom tags, aliases, non-finite numbers and implicit date objects; quote timestamps and schema versions. JSON Schema Draft 2020-12 plus format checking validates each document. Protocol 3.0 mutable workspace records carry `schema_version: "3.0"`; migrated immutable evidence, assessments, reviews, project snapshots and task history retain `schema_version: "2.0"`. Every record carries `data_class: live | fixture`. The competency catalog is 3.0, the expanded track catalog is 1.1, and the unchanged level catalog remains 2.0.

| Location inside `.apprenticeship/` | Schema | Authority |
| --- | --- | --- |
| `config.yaml` | apprenticeship-config | Canonical workspace identity, mode and principal registry |
| `profile.yaml` | learner-profile | Canonical learner goals, onboarding, baseline pointer; self-report is not evidence |
| `current-project.yaml` | current-project | Canonical nullable selection and local source binding |
| `current-track.yaml` | current-track | Canonical nullable advisory track, pinned definition digest and scope-alignment state |
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

Current project points at a pinned `projects/` record. Global definitions remain under `catalog/projects/`. Once imported, `projects/<project-id>.yaml` is immutable for the workspace lifetime, even before assignment. The stable project slug is therefore also an unambiguous workspace snapshot reference. A refresh under that slug MUST be rejected; use a new workspace to adopt a changed definition. No catalog update or source rebind may overwrite that snapshot. Source paths are relative to workspace root and must point outside `.apprenticeship`. A source revision identifies the checked-out revision; switching tools must not depend on an absolute machine path.

## Writes and recovery

Only one writer per workspace at a time in V1. Every update checks the previously read content digest and rejects stale state. Validate a candidate workspace, including semantic checks, before publication. A future writer must use a lock and staged writes with a durable transaction manifest containing transaction ID, operation ID, actor, input digest, output record IDs, expected old digests and proposed new digests. Pending transactions block further mutation; recovery either finishes the same validated transaction or restores its complete old snapshot. Never report a partially written multi-file operation as success. This is a required implementation property, not a runtime provided here.

Evidence, assessments and reviews are immutable after publication. Corrections create a new record with `supersedes` pointing to the prior same-type, same-subject record; no cycles or forks are allowed. The original remains readable. Task `work_artifact` is the canonical current deliverable URI/revision, null until work exists. The learner may update it in investigation/design/implementation/testing; a new revision invalidates prior review and validation gates and requires rework through those gates. A task with required code review cannot advance to that review with a null artifact.

Tasks append transition and assistance history without rewriting prior entries. The entire assignment contract is frozen after assignment, as enumerated below; changed scope creates a replacement task, with the relationship in context. Mutable profile/config changes must remain reviewable through a local revision history. Unversioned state must be backed up before mutation; neither commits nor pushes are automatic.

## Versions and derived state

Unknown object fields are errors; there is no permissive extension bag in V1. Readers reject unsupported versions without mutation and preserve the original bytes. Additive fields also need a versioned schema because older readers are strict. A breaking semantic change requires a major version and an explicit, backed-up migration with dry-run differences and before/after validation. Migration never infers missing evidence. Read-only access to old state should remain possible using its original schema set.

Standing, historical awards, dependency closure and reconciliation follow [judgment validity](judgment-validity.md). E0 is initial administrative placement only. A cache mismatch cannot overwrite canonical records.

For each competency, use only unsuperseded **longitudinal** assessment findings, ordered by `created_at`. Equal-time conflicting findings are an error. Checkpoints never enter this selection. A stale selected finding yields `contested`, null demonstrated level, and its original evidence/assessment references; do not fall back to a flattering older finding. An unassessed finding has null level. A demonstrated finding requires verified support. The cache source lists contain selected longitudinal assessments and all current review heads consulted for standing, including stale heads; `stale_record_ids` includes the complete derived stale closure of canonical evidence/assessment/review IDs, excluding artifact URIs and help event IDs; report those causes separately in read output. Fresh evidence must not silently produce an aggregate finding.

## Complete assignment freeze

From first transition to assigned, only these task fields may change: `status`, `blocked_reason`, `work_artifact`, `design_artifact`, `design_assessment_id`, `validation`, `completion_evidence_ids`, `transitions`, and `assistance_history`. Every other field is frozen, including identity, author, assigned_by, title, project, type, problem, context, impact, criteria, constraints, competency targets, recommended level, scope, difficulty, investigation areas, testing expectations, documentation requirements and both review flags. No in-place amendments exist in V1. Team lead creates a replacement task for changed requirements; retained context identifies the replaced task and reason.

Mutable execution fields still require their role and lifecycle gate. Learner owns design/work artifacts in investigation, design, implementation and testing; team lead owns design-assessment pointer, validation and completion references. A changed design clears its pointer and blocks forward advancement until a new approval; return through investigation/design as needed. Terminal tasks permit only append-only assistance disclosure/correction, no other field change. Reassessment of a terminal task creates formal records without reopening it. Receipt snapshots preserve every overwritten execution value.

## Durable receipts and reader consistency

Persist `.apprenticeship/operations/<operation-id>.json` permanently, indexed by operation ID. The canonical receipt envelope is a closed object with `schema_version` (2.0), `operation_id`, `transaction_id`, `actor` (ID/role), `authorized_at` (UTC timestamp), `authorization` (immutable artifact of the request/consent binding operation, actor, action and target), `input_digest`, `output_record_ids`, and `changes`. Each change contains exactly `path`, `old_digest`, `new_digest`, `old_snapshot`, `new_snapshot`; absent old files use null old digest/snapshot. Digests use SHA-256 of exact bytes. Snapshots are immutable local artifact references (URI, revision, description); paths are safe workspace-relative state paths. The input digest covers the canonical JSON encoding (sorted keys, compact separators, UTF-8) of request, bound actor and expected read digests. Operation IDs use `OP-` plus UUID for live work.

A pending manifest has those fields plus `phase: prepared`; it is staging metadata, not a committed receipt. Publish the receipt as the final commit marker under the lock only after all new records and snapshots are durable. Retain the complete old snapshot until recovery completes. A reader takes the same lock or reads the last complete committed snapshot; it MUST NOT enumerate partially published files. Recovery verifies proposed digests and either completes publication and receipt or restores every old file and removes unpublished creations. Never expose a receipt for rolled-back work. A completed receipt survives caller/harness loss; exact retry returns its IDs, while same operation ID with different input digest conflicts. Missing or ambiguous receipt/manifest state blocks writes pending recovery.

Receipts provide the audit envelope for every mutable update, registry grant and retirement, including authenticated invoker attribution and authorization time. Preserve immutable grants and prior snapshots for historical checks. This is a normative file envelope, validated semantically, not an additional learner-record schema or an implemented transaction service.

## Canonical YAML emission subset

Writers emit JSON-compatible YAML with every string and mapping key double-quoted, lowercase true/false, null, and JSON number syntax only. A JSON document is a permitted YAML 1.2 subset and the recommended canonical emission. Reject aliases, tags, duplicate keys and non-JSON scalars. Input outside this canonical subset requires a YAML 1.2-aware parser; a YAML 1.1 loader must not silently reinterpret it. Quoted "on", "012" and timestamps remain strings; Unicode round-trips as UTF-8. The artifact checker validates the subset, not arbitrary YAML portability.

Historical artifact resolution uses the cited repository identity and immutable revision/digest, independently of current-project and the current source directory. Resolve from an authorized retained object or exact snapshot when available; otherwise return unavailable and seed staleness. Never substitute the new checkout's file at the same path. Source rebinding requires inspected repository identity to match the immutable project definition and explicit learner selection; it cannot change that definition.
## Protocol 3.0 track state

One active track may guide project discovery. Selection pins the track ID, track-catalog version and exact definition digest. It creates no evidence and does not alter a completed evaluation window. Initial onboarding aligns the profile specialization set to the selected track. A later switch is `pending`: recommendations change, while the prior specialization set remains canonical until a fresh learner/team-lead scope agreement, longitudinal assessment and manager performance review support alignment. Pending alignment blocks promotion, not existing task work.

Protocol 2.0 migration creates an unselected current-track record and never infers a track from goals or historical Java/project state. Immutable 2.0 records remain byte-preserved and are read with their original schemas; new mutable envelopes and records use 3.0.
