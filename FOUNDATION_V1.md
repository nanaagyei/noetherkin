# Foundation V1

> Phase 8 protocol note: new workspaces use protocol 3.0 for persisted advisory tracks. Protocol 2.0 records retain their original meaning and immutable records are preserved during the explicit 2.0→3.0 migration. ACP-10 in `FOUNDATION_CHANGELOG.md` is normative for tracks; unchanged V1 evidence, leveling, assistance, role, and task semantics below remain authoritative.

FOUNDATION STATUS: IMPLEMENTABLE

**Frozen for V1 on 2026-09-12 (America/Chicago).** Product foundation: V1. Wire protocol, schemas, catalogs and contracts: **2.0**. Implementation has not started. Implementable means the normative behavior is specified, not that runtime safety or educational effectiveness has been demonstrated.

## Authority and release boundary

This document, the nine current JSON Schemas, architecture documents, catalogs and eight contracts indexed by [SPEC.md](SPEC.md) define the frozen foundation. MUST, MUST NOT and MAY denote requirements, prohibitions and options. The charter and explicit user scope govern product intent. Schemas govern structure; architecture governs semantics. Both are mandatory. Examples are synthetic fixture data, never learner accomplishments.

The protocol-bearing 1.0 artifacts are preserved under [archive/protocol-1.0](archive/protocol-1.0/FOUNDATION_V1.md), with a SHA-256 manifest. A [publication redaction notice](archive/protocol-1.0/REDACTION_NOTICE.md) identifies local orchestration prompts excluded before the first public commit; no schemas, contracts, fixtures, reviews, or protocol decisions were removed. Schema identifiers have not been redefined. Breaking corrections use new `/schemas/2.0/` identifiers. Product V1 and wire version 2.0 are different version axes. A 1.0 reader must reject 2.0, and a 2.0 writer must reject 1.0 rather than fill missing historical facts. No live migration is provided or claimed.

## Frozen implementation decisions

| Boundary | Required V1 behavior |
| --- | --- |
| Learner ownership | Learner authors engineering work; assistance escalates progressively and is attributed per claim. |
| Stale judgments | Preserve historical awards; current standing becomes explicitly unresolved, effective level null, and advancement blocked. Corrections and sequential authorized reconciliation remain available. |
| Promotion inputs | Pin recommendation, readiness assessment, agreed competency set and catalog versions. Technical, manager and decision principals are pairwise distinct. |
| Identity | One learner/principal binding; immutable actor roles, retained grants and retirement; trusted invoker binding and as-of-publication authorization. |
| Task gates | Freeze the full assignment contract; design approval identifies the task and exact design revision. Changed inputs require fresh applicable gates. |
| Assistance | Separate recorder/provider, occurrence/disclosure time and correction identity; permit outside-help disclosure after completion. |
| Historical projects | A workspace project slug resolves to one immutable definition for its entire lifetime. Source rebinding never changes historical context. |
| Competency summary | Only explicit longitudinal assessments supply aggregate findings. Bounded checkpoints cannot overwrite them. |
| Leveling | Keep E0–E5, seven core competencies and thirteen dimensions; behaviors apply across specialties without requiring services. |
| State publication | One writer, complete candidate validation, immutable records, durable receipts and recoverable complete snapshots. |
| Portability | Local inspectable files, closed schemas, deterministic integrity checks, no required vendor or harness. Unenforceable adapters return proposals. |

The adopted proposals, alternatives, issue dispositions and migration limits are in [FOUNDATION_CHANGELOG.md](FOUNDATION_CHANGELOG.md). Detailed staleness and reconciliation semantics are in [judgment validity](docs/architecture/judgment-validity.md). The frozen assignment fields, identity lifecycle and input bindings are normative, not implementation suggestions.

## Freeze acceptance and remaining scope

All review findings F01–F09 have normative resolutions and targeted conformance cases. The remaining questions in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) are explicitly **NON-BLOCKING** and have defined V1 defaults. They must not be used to invent alternate protocol behavior.

[Validation](evaluations/VALIDATION_REPORT.md) separates executed artifact checks from future runtime and agent evaluations. Runtime initialization, transactional writer, migrations, adapters, final skill packages and educational calibration remain implementation work. This freeze authorizes no deployment, source execution, remote action or automatic implementation.

After this freeze, a semantic change requires an architecture change proposal stating the contradiction, alternatives, migration impact, version changes and conformance cases. Preserve released schema/catalog meanings and original records. Editorial corrections may clarify wording but cannot change behavior. Unresolved conflicts must be reported rather than silently resolved by an implementation.
