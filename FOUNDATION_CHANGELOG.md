# Foundation changelog

## Phase 9 additive project catalog expansion, 2026-09-17 (America/Chicago)

Phase 9 adds Google Online Boutique, OpenTelemetry C++, and NVIDIA Triton Inference Server as attachable project candidates, raising the global project catalog from 84 to 87 records. OpenAI Triton remains a separate compiler project. The additions carry explicit unverified contribution, deployment, and contribution-policy metadata gaps and provide no curated task packs.

This is an additive project-catalog change, not an architecture change proposal. Track catalog 1.1 and all 34 pinned track definitions remain byte-identical, so existing track digests and recommendation tiers retain their meaning. The Stage A–F sketch is illustrative rather than persisted sequencing; repositories remain globally discoverable and selectable without becoming project-completion or promotion gates. A future recommendation change requires a separately versioned track catalog and compatibility plan.

## Phase 8.1 track and project expansion, 2026-09-17 (America/Chicago)

### ACP-11: explicit entry characteristics and alignment finalization

Track catalog 1.1 adds 15 technology paths and raises the advisory catalog to 34 tracks and 84 projects. Track stage remains editorial sequencing for a particular competency path. It is not repository difficulty, an E-level gate, or a promise that an upstream issue is available. Project records now expose repository difficulty, onboarding cost, feedback-loop cost, level fit, and contribution readiness independently. Unknown upstream contribution readiness remains `unverified` and a named metadata gap; it is never inferred from popularity or track placement.

The earlier proposal-only `track align` boundary is replaced by a canonical, learner-authorized workflow. A team lead must publish a fresh longitudinal assessment covering the exact universal-core plus selected-track scope, then a manager must publish a performance review pinned to that assessment and scope agreement. Only a `continue` outcome permits an atomic learner publication updating `profile.yaml` and `current-track.yaml`. Scope objections leave alignment pending, historical assessments and reviews are unchanged, and promotion remains blocked.

Rejected alternatives were treating early/intermediate/advanced as difficulty, silently reusing the onboarding baseline after a switch, treating repository popularity as contribution readiness, and aligning on learner consent alone. Existing selected track digests remain immutable; a 1.0 selection does not silently become a 1.1 selection. New and migrated workspaces pin 1.1, while config validation retains the 1.0 pin for already-published protocol 3.0 state. Conformance adds exact-scope coverage, manager objection, idempotent retry, explicit entry metadata, and catalog reference checks.

## Phase 8 protocol 3.0, 2026-09-17 (America/Chicago)

### ACP-10: persisted advisory learning tracks

The simulator now persists one advisory track, pins its definition digest, and separates track selection from evaluation-scope alignment. Seven universal core competencies remain unchanged. A track contributes required specialization competencies but owns no skill, grants no evidence, and imposes no project-completion gate.

The primary risk is scope drift: changing a track or catalog entry could otherwise rewrite an evaluation window. Protocol 3.0 makes a switch useful for recommendations but marks it `pending` until learner/team-lead scope agreement, longitudinal assessment, and performance review align future evaluation. Historical reviews keep their pinned competency sets and catalog versions. Replacing universal core with track-specific core and silently deriving a track from goals were rejected.

Protocol 3.0 adds closed track/current-track schemas, competency catalog 3.0, track catalog 1.0, explicit candidate-project metadata gaps, and generic attachability separate from curated task packs. Migration rewrites only mutable bootstrap envelopes, creates an unselected track record, and preserves published projects, tasks, evidence, assessments, and reviews byte-for-byte. Conformance covers catalog references, required selection, digest drift, pending switches, generic attachment, unknown metadata, and recovery.

## V1 freeze, 2026-09-12 (America/Chicago)

FOUNDATION STATUS: IMPLEMENTABLE

The user authorized resolving the previous review's blockers/high issues and freezing V1. The following architecture change proposals are **adopted by this freeze**, not silently inferred implementation choices. Product V1 retains its charter, E0–E5 levels, core competency taxonomy, assistance ladder and eight workflow responsibilities. Breaking structural and semantic corrections use wire/schema/catalog/contract version **2.0**. The protocol-bearing 1.0 draft, schemas, examples and evaluations remain in [the archive](archive/protocol-1.0/FOUNDATION_V1.md), with a [byte-integrity manifest](archive/protocol-1.0/SHA256SUMS.json) and [publication redaction notice](archive/protocol-1.0/REDACTION_NOTICE.md).

### Blocking and high findings resolved

| Finding / adopted proposal | Contradiction and adopted resolution | Alternative and tradeoff | Conformance |
| --- | --- | --- | --- |
| F01 / ACP-01 | Stale support previously had no readable level or recovery. Preserve last_awarded_level, derive unresolved standing/effective_level null, propagate explicit dependencies, allow corrections and ordered fresh review reconciliation. See [validity](docs/architecture/judgment-validity.md). | Reject every write until appeal policy exists. Rejected because honest corrections must remain publishable. Reconciliation requires explicit reviews for downstream awards. | FR-01–05 |
| F02 / ACP-02 | Promotions lacked stable recommendation/readiness/specialty identity. Freeze evaluation_scope on performance/promotion, pin both input IDs, match exact periods, inspect scope agreement and enforce pairwise distinct principals. | Select latest profile/reviews during replay. Rejected because historical decisions would change meaning. | FR-06–08 |
| F03 / ACP-03 | Registry removal broke old judgments and declaration could impersonate authority. Bind one learner actor, retain immutable roles/grants/retirement, authorize writes at publication using trusted invoker context and receipts. | Keep departed actors active or require an external identity provider. Rejected; local procedural integrity suffices for V1's stated assurance. | FR-09–11 |
| F04 / ACP-04 | Design gate lacked task/revision/decision. Technical checkpoint carries task/design/decision; task pins design artifact and assessment. Only matching supported approve opens implementation. | Infer approval from a competency finding. Rejected because findings do not approve a specific design. | FR-12–13 |
| F05 / ACP-05 | External/late help could not be faithfully recorded. Add stable help ID, recorder/provider, occurrence/disclosure time, correction edge and terminal disclosure exception; stale affected evidence. | Register all external helpers or call known help unknown. Rejected because attribution must not grant authority or conceal magnitude. | FR-14–15 |
| F06 / ACP-06 | Curator refresh changed historical project meaning. A project slug pins one immutable definition for a workspace's lifetime; reject replacement, resolve historical artifacts independently of current checkout. | Add multi-revision catalog storage and task snapshot IDs. Deferred because immutable per-workspace snapshots solve the ambiguity with fewer relationships. Changed definitions need a new workspace. | FR-16 |
| F07 / ACP-07 | Mandatory service wording excluded other charter specialties. Keep all thirteen dimensions and replace service-specific E3/E4 requirements with domain-neutral capability/subsystem behavior and non-service examples. | Declare V1 service-only. Rejected to preserve the charter's ML, library and GPU scope. No core-dimension waivers. | FR-17 |
| F08 / ACP-08 | Frozen criteria left tests/scope/waivers mutable. Enumerate the only mutable execution fields; freeze every other assignment field at assignment. Replacement tasks handle substantive changes. | Add learner-approved amendments and gate invalidation machinery. Deferred to keep V1 simple and historical agreements stable. | FR-18 |
| F09 / ACP-09 | Bounded findings could overwrite aggregate competency state. Require explicit checkpoint/longitudinal scope and derive cache only from longitudinal synthesis, with defined correction subjects and stale handling. | Require every checkpoint to reevaluate all history. Rejected as unnecessary review burden. | FR-19 |

### Remaining findings and open questions

| Finding | Disposition and defined V1 behavior |
| --- | --- |
| F10 | Resolved: project-free baseline evidence permits null project/task with actual artifacts; authorized prior-work snapshot import is also allowed before selection. |
| F11 | Resolved: project definitions explicitly use schema_version/data_class; competency/level catalogs use catalog_version. Fixture isolation remains mandatory. |
| F12 | Resolved at specification level: durable operation receipt location/envelope, immutable old/new snapshots, retry lookup after caller loss, and consistent-reader/recovery rules are explicit. Runtime crash tests remain required. |
| F13 | Resolved: artifact-free gaps stay in notes/self-report; report artifacts prove the report only. Unverified metadata describes a check that occurred, not a fictional verification. |
| F14 | Resolved at policy level: simulated effects require predeclared constraints, learner interactions, resulting artifacts and a counterfactual/failure probe. Reviewer quality remains an empirical question. |
| F15 | Resolved at policy level: paired examples distinguish navigation/consultation from disclosure of the reasoning being evaluated. No scalar help penalty. |
| F16 | Resolved at workflow level: bounded documentation waivers, concise multi-gate interaction and milestone-driven synthesis are permitted; roles and gates still apply. |
| F17 | Resolved for canonical output: JSON-compatible canonical YAML subset; current YAML fixtures/catalogs emit JSON, which is valid YAML 1.2. Parser specimens cover ambiguous strings, booleans, numbers, timestamps and Unicode. Arbitrary YAML requires a YAML 1.2-aware parser. |
| F18 | Deferred, explicitly NON-BLOCKING: incomplete project candidates remain suggestions outside the strict catalog; no fabricated required metadata. Explicit absent metadata is a future schema feature. |

Every question in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) is **NON-BLOCKING**, with a current V1 rule. Optional appeal policy, reviewer calibration, real project onboarding, deliberate-tampering protection, concurrency and hosted retention do not require an implementer to guess current semantics. They constrain later features and claims.

### Compatibility and migration impact

- Root schemas now identify 2.0; old identifiers and bytes are preserved in the archive. Strict readers reject unsupported versions, including additive unknown fields.
- Current fixtures are explicitly synthetic and rewritten for 2.0. They are not migrated learner records or observed engineering outcomes.
- A live 1.0 migration would require human-confirmed learner binding, grant history, evaluation scope/input IDs, assessment scope and help attribution. Missing historical facts cannot be reconstructed by inference. Until a separately reviewed migration exists, preserve old state read-only and initialize new 2.0 workspaces explicitly.
- Competency IDs and seven required-core members are unchanged. The versioned level rubric broadens specialty wording while retaining the dimension set and scope progression. Historical 1.0 judgments retain their original rubric; they are not regraded under 2.0 automatically.
- The nine learner-record schema count is unchanged. Durable transaction receipts are a specified infrastructure envelope, not a tenth discretionary evaluation record.

### Verification and freeze limits

[The validation report](evaluations/VALIDATION_REPORT.md) records executed artifact checks, targeted in-memory conformance specimens and archive integrity verification. [Conformance](docs/architecture/conformance.md) separately lists future implementation acceptance scenarios. No runtime, source-project build, deployment, live promotion, migration, crash recovery or learning efficacy was tested. The prior review documents remain historical findings with a resolution pointer; this freeze is not represented as a second independent audit.

After this release, protocol changes require a new proposal, explicit version/migration impact and corresponding tests/evaluations. This freeze ends foundation reconciliation; it does not start simulator implementation.
