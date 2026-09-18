# Foundation review summary

**Verdict: revise before state-writing implementation.** Preserve the architecture. The review found **1 BLOCKER, 8 HIGH, 7 MEDIUM, 1 LOW and 1 NICE-TO-HAVE** finding. No simulator implementation or foundational edits were made.

The blocker is the incomplete handling of stale evidence and invalidated promotion chains: the specification forbids retaining or silently demoting the level but does not define the readable state and recovery path. A proposed bounded architecture change is recorded as ACP-01 in the red-team review; it is not adopted.

| ID | Severity | Finding | Detail |
| --- | --- | --- | --- |
| F01 | BLOCKER | Stale judgment state and reconciliation are incomplete | [Red-team review](reviews/foundation-red-team.md) |
| F02 | HIGH | Promotions do not pin recommendation and evaluation scope | [Schema review](reviews/schema-review.md) |
| F03 | HIGH | Principal lifecycle, learner binding and invocation authority | [Contract review](reviews/skill-contract-review.md) |
| F04 | HIGH | Design approval lacks task/revision/decision binding | [Contract review](reviews/skill-contract-review.md) |
| F05 | HIGH | Outside and late assistance lack faithful attribution path | [Contract review](reviews/skill-contract-review.md) |
| F06 | HIGH | Historical tasks do not pin project definition revisions | [Schema review](reviews/schema-review.md) |
| F07 | HIGH | Universal service rubric blocks other specialties | [Leveling review](reviews/leveling-review.md) |
| F08 | HIGH | Assignment freeze does not cover all meaningful requirements | [Red-team review](reviews/foundation-red-team.md) |
| F09 | HIGH | Bounded assessments overwrite longitudinal competency state | [Schema review](reviews/schema-review.md) |
| F10 | MEDIUM | Evidence-based baseline has a project prerequisite cycle | [Schema review](reviews/schema-review.md) |
| F11 | MEDIUM | Project catalog version rule conflicts with schema | [Schema review](reviews/schema-review.md) |
| F12 | MEDIUM | Durable retry receipt and mutation provenance underspecified | [Contract review](reviews/skill-contract-review.md) |
| F13 | MEDIUM | Missing-artifact observation representation unclear | [Schema review](reviews/schema-review.md) |
| F14 | MEDIUM | Simulated leadership effects can become self-generated proof | [Leveling review](reviews/leveling-review.md) |
| F15 | MEDIUM | Independence calibration may penalize healthy consultation | [Leveling review](reviews/leveling-review.md) |
| F16 | MEDIUM | Small tasks incur excessive evaluation ceremony | [Portability review](reviews/portability-review.md) |
| F17 | LOW | YAML 1.2 portability not established by fixture parser | [Portability review](reviews/portability-review.md) |
| F18 | NICE-TO-HAVE | Project metadata needs honest not-applicable values | [Portability review](reviews/portability-review.md) |

## Preserve

Keep the learner as engineer, immutable attributable judgments, facts separate from interpretation, assistance per competency, revision-bound acceptance, derived level/cache, terminal task history, single-writer transactions, strict version negotiation, source/state separation and proposal-only fallback. No XP system, mandatory proprietary protocol or PetClinic-specific skill logic was found.

## Verification

Read all requested documents, schemas, contracts, catalogs and example state, including hidden `.apprenticeship` files. The existing read-only checker passed: 9 schemas, 14 fixture documents, 88 competencies, 6 levels × 13 dimensions, 8 contracts and 30 negative cases. Six additional in-memory schema probes confirmed representational boundaries; details and observed results are in schema review. Structural acceptance of semantically forbidden data is explicitly distinguished from a runtime vulnerability.

Failure scenarios are desk analysis. No runtime, agent behavior, learning efficacy, migration, crash recovery or project build was tested. Findings label observed specification facts separately from inferred failures. Prior “no unresolved blocker” and “internally consistent enough” statements should be revisited by maintainers; this review does not silently change their authority.

## Recommended decision order

1. Resolve ACP-01 and the historical dependency/authority issues F02, F03, F06 and F09.
2. Specify the design gate, complete assignment freeze and assistance correction path, F04/F08/F05.
3. Decide whether V1 levels are domain-neutral or explicitly service-specialized, F07.
4. Reconcile the remaining schema/contract ambiguities and add focused conformance specimens. Preserve versioned V1 artifacts when adopting changes.

Implementation remains out of scope.

## Resolution after review

The verdict above is the preserved pre-freeze review result. The authorized reconciliation is recorded in [FOUNDATION_CHANGELOG.md](FOUNDATION_CHANGELOG.md): F01–F09 resolved, F10–F17 clarified, F18 explicitly deferred with a non-blocking admissibility rule. Current authority is [FOUNDATION_V1.md](FOUNDATION_V1.md), protocol 2.0. These edits do not claim a second independent review or runtime verification.
