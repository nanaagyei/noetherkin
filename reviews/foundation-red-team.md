# Foundation red-team review

Review date: 2026-09-12, America/Chicago. Scope: specification only. No simulator implementation or normative changes were made.

Verdict: preserve the architecture, but do not treat the foundation as ready for state-writing implementation. One BLOCKER requires a semantic decision; eight HIGH findings need bounded corrections. Severity describes consequence, while Confirmed / Strong Inference / Hypothesis / Unknown describe confidence. A schema accepting a semantically prohibited record is not, by itself, a protocol loophole.

## F01 · BLOCKER · Stale judgments have no complete state or recovery semantics

**Confirmed issue.** [State model](../docs/architecture/state-model.md), [evidence model](../docs/architecture/evidence-model.md), and [competency model](../docs/architecture/competency-model.md) require contradictory evidence and missing artifacts to make dependent judgments stale. They do not define the dependency closure, who determines material contradiction, how staleness is represented or derived, or what a reader returns while it exists. The cache schema requires an E0–E5 effective level. Corrections invalidate downstream promotions, while silent retention and demotion are both prohibited. OQ-002 defers reconciliation. This leaves a required ordinary correction path without a defined result.

**Why it matters.** A reader cannot reliably derive current capability or level after an honest correction. Candidate-workspace validation could also reject the corrective write itself if historical validity is confused with eligibility for new decisions.

**Failure scenario.** At E2, the learner reports that an E1 implementation was copied. The team lead supersedes its evidence. E1 and the dependent E2 decision now need review. One reader returns E2, another falls back to E0, and another refuses every write, including reassessment. None has a fully specified conforming answer. This scenario is a Strong Inference, not a runtime result.

**Recommended correction / ACP-01.** Adopt a versioned validity projection distinguishing historical publication validity, present evidentiary support, and permission to advance. Preserve the last awarded level as historical fact while explicitly marking current standing unresolved; exclude stale findings from affirmative claims. Define deterministic propagation for supersession/artifact loss, with an attributable judgment for semantic contradictions. Permit corrective publications even while downstream decisions are suspended. Specify the authorized reconciliation procedure or explicitly block only new advancement until that procedure exists. Alternative: fail closed on all formal evaluation, but still define readable historical state and a repair-only path. Do not silently reinterpret old level fields. Update cache/decision representation as needed and add correction, artifact-loss, partial-recovery and downstream-chain cases before adopting the proposal. This is a proposal, not an adopted architecture change.

## F08 · HIGH · Assigned requirements can be weakened outside acceptance criteria

**Confirmed issue.** The [state model](../docs/architecture/state-model.md) freezes acceptance criteria, but the task also has `design_required`, `code_review_required`, constraints, testing expectations, scope and competency targets. Waivers must be justified before assignment, yet no complete immutable assignment field set or temporal enforcement rule is specified. The team-lead role has broad task write authority.

**Why it matters.** Identical criterion text can become much easier to satisfy when required validation or scope changes underneath it.

**Failure scenario.** A source-change task keeps “handles retries correctly,” while its required failure tests disappear from `testing_expectations` after the happy path passes. A field-level permission implementation that freezes only criteria permits this. Changing a review waiver after assignment should already violate the prose, but its enforcement is also insufficiently explicit.

**Recommended correction.** Freeze the entire agreed assignment contract at assignment, identifying the exact fields. Restrict later mutations to enumerated execution fields and append-only histories. A substantive change requires a replacement task or a separately specified learner-approved amendment that invalidates affected gates. Add tests for removing tests, narrowing scope and flipping waivers after assignment.

## What survives the attacks

- Status resides in one task file; directories are not another state machine. The derived competency cache is explicitly non-authoritative.
- Evidence can precede completion, so the former review/evidence cycle is resolved.
- Revision-bound task and code review gates prevent accepting B with A's approval when enforced.
- Terminal tasks preserve their history; follow-up tasks handle defects.
- Authoritative judgments are immutable and corrections remain readable. UUID-based live record IDs and stable catalog IDs are sensible.
- The learner cannot formally promote through self-report. User-agent feedback has no canonical write authority.
- Source/state separation, no automatic remote actions, and untrusted-artifact rules are appropriate.

## Attack coverage

| Area | Result and detailed review |
| --- | --- |
| State consistency / interruption | F01, F06, F08, F09, F12; recovery is specified as a requirement but not demonstrated |
| Evidence integrity | F05, F09, F10, F13; scenario matrix in schema review |
| Leveling games | F02, F07, F14, F15; leveling review |
| Role authority | F03, F04, F05; contract review |
| Assistance fairness | F05, F15; no scalar penalty is warranted |
| Harness portability | F03, F12, F17; portability review |
| Project replacement | F06, F07, F10, F11, F18; portability review |
| Schema evolution | Versioning is viable; historical bindings need correction before migration |
| Simulation realism | F14, F16; remove performative ceremony without removing validation |
| Educational integrity | Explicit learner authorship is strong; artifact authorship remains a trust limitation |

## Verification and limits

Read PROJECT_CHARTER.md, SPEC.md, FOUNDATION_V1.md, all eleven architecture documents, nine schemas and schema inventory, all eight contracts plus shared conventions, both competency/level catalogs, the project catalog, every hidden example-state file and note, DECISIONS.md, OPEN_QUESTIONS.md, IMPLEMENTATION_STATUS.md, the internal foundation handoff, and the artifact checker/report.

Ran `python3 evaluations/validate_foundation.py`: exit 0; 9 schemas, 14 fixture documents, 88 competencies, 6 levels × 13 dimensions, 8 contracts, 30 negative cases. Six additional in-memory structural probes are documented in schema review. No runtime, learner evaluation, project build or adversarial agent session ran. External project/tool claims were not independently researched; conclusions concern the supplied local specification. The repository was already untracked at review start, so Git diff alone cannot establish the complete baseline.
