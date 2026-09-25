# Selection model: advisory attention and the frontier

Adopted from ACP-014 (`docs/proposals/ACP-014-frontier-selection.md`) in Phase 14. This document is normative for the advisory attention view. The view changes where a human looks, never what a human concludes. It adopts **ordering** and rejects **scheduling**.

## The artifact

The view lives at `.apprenticeship/advisory/attention.yaml` and is validated by `schemas/attention-advisory.schema.json`, which marks it `canonical: false`.

- **Derived.** It is computed from the competency cache, the evidence records the cache cites, and the [competency graph](competency-model.md). It holds no fact that cannot be derived from those.
- **Regenerable and deletable.** Its absence never blocks work, gates a transition or fails validation. `validate` does not read it, and the onboarding handoff digests exclude it. `next` regenerates it in an active workspace; a paused or archived workspace shows the view without writing it.
- **Subordinate.** If it disagrees with `.apprenticeship/competencies.yaml`, the cache wins. A stored view whose cache digest or findings disagree with the cache is reported as a contradiction and replaced, never reconciled.
- **Not evidence.** No assessment, review, evidence record or promotion packet may cite it. Validation rejects any `workspace:/` artifact URI that points into `.apprenticeship/advisory/` (`ADVISORY_CITED`).
- **Not a score.** It contains an ordering and a stated reason per entry. It contains no percentage, mastery value, decay coefficient or due date, and the schema has no field for one.

## Scope

The view covers the learner's evaluation scope: the core competencies, the profile's specialization competencies, and any competency with an entry in the cache.

## Frontier

A competency is **on the frontier** when every ID in its `prerequisites` has a `demonstrated` finding in the cache, and its own finding is `unassessed` or `developing`. A competency with no prerequisites is always on the frontier. A catalog without edges, including any workspace pinned to competency catalog 3.0 or earlier, therefore puts every open competency on the frontier. That is a true statement about a graph with no edges.

A competency with an open finding and at least one undemonstrated prerequisite is **blocked**. The view names the missing prerequisites. Blocking is information for the learner and the team lead. It never prevents an assignment.

A competency whose finding is `contested` is on the **remediation** list, not the frontier, because a contested finding means a contradiction needs explaining rather than more practice.

## Attention ordering

Frontier competencies and demonstrated competencies are ordered by these keys, in priority order:

1. Whether a prerequisite is `contested`, or rests on a record listed in the cache's `stale_record_ids`. A shaky foundation outranks anything built on it.
2. When the most recent evidence cited for the competency was observed, taken from evidence `fact.observed_at`, with the oldest first. A competency with no cited evidence counts as the oldest.
3. How many distinct `project_id` values its cited evidence spans, fewest first. Distinct project is a weak but mechanical proxy for the "materially different contexts" in [review-model.md](review-model.md). The proxy is recorded as an open question, not settled.

Entries with equal keys share a rank and list each other in `tied_with`. No synthetic value breaks a tie; the competency ID only fixes display order inside a tie. The ordering uses only observed dates and observed counts, so it needs no invented constant. This is what keeps it inside OQ-003 and the recency rule in [review-model.md](review-model.md).

## Consumers

- **`next`** adds a labeled `advisory` block: the entries tied for first attention, why, which forges or curated packs exercise them, blocked items, remediation items and any contradictions found.
- **Task assignment** may use the ordering to prefer assignments that genuinely exercise several high-attention competencies, to interleave dissimilar domains, and to keep momentum by naming a blocked prerequisite rather than forcing a detour (see the task-assignment contract (repository context: `contracts/task-assignment.md`; Related skill contract; omitted from this focused bundle.)). A task claims exactly the competencies its work exercises. For a task instantiated from a shipped template, validation rejects any difference from the template's competencies (`SCOPE_FABRICATED`).
- **Remediation.** A rework outcome from a design gate, a failed test run, a code review or a task review lists the prerequisites of the task's primary competencies, walked backwards through the graph. Undemonstrated, contested or stale prerequisites come first. When every prerequisite is demonstrated, the direct prerequisites are still named, so the learner gets a specific claim to argue with.
- **Baseline probing.** `probe_candidates` lists open competencies in scope with the in-scope competencies that depend on them. Probing one constrains the most of the graph. With no edges the list is empty and the [onboarding contract](contract-onboarding.md) falls back to the core competencies. A probe that produces no artifact produces no finding, self-report is still not proficiency, and an all-`unassessed` baseline is still valid.

## Prohibitions

The view must never:

- gate a transition, an assignment, a review or a promotion;
- write to `.apprenticeship/competencies.yaml` or any canonical record (the writer refuses any path outside `.apprenticeship/advisory/`: `ADVISORY_CANONICAL_WRITE`);
- be cited by an assessment, review, evidence record or promotion packet;
- present a number that could be read as capability;
- cause a task to be assigned without the team lead exercising the assignment contract. It ranks; the team-lead principal still decides.

Only the CLI imports the advisory modules (`core/frontier.ts`, `core/advisory.ts`). Nothing that publishes canonical state or derives the competency cache may import them, and a structural test enforces this alongside the ACP-013 guard.

## Conformance

CF-38 to CF-41 and FR-37 to FR-41 are registered in [conformance.md](conformance.md) and executed by `tests/frontier.test.ts`.
