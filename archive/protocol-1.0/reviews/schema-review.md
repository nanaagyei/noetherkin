# Schema review

The nine closed Draft 2020-12 schemas are a reasonable V1 format. Keep the separation between structural and semantic validation. Do not introduce a database or permissive extension bag to fix a few missing relationships.

## F02 · HIGH · Promotion does not pin its decision inputs

**Confirmed issue.** [Review procedure](../docs/architecture/review-model.md) requires a current manager recommendation, technical assessment and agreed specialization. [Review schema](../schemas/review.schema.json) has assessment IDs but no recommendation review ID, specialization snapshot, or profile revision. `technical_reviewer_id` identifies an author rather than one designated readiness assessment. “Latest ... for that learner and evidence period” does not define matching periods or stable historical selection.

**Why it matters.** A promotion's authorization split and required competency coverage cannot be replayed unambiguously from its own canonical dependencies.

**Failure scenario.** Manager A recommends promotion; a reviewer publishes PROMOTE; manager B later publishes a new overlapping-period review, and the learner changes specialties. Revalidation now selects B or today's specialty set, making the old decision appear to have different prerequisites. With several assessments by one team lead, the intended readiness assessment is also ambiguous.

**Recommended correction.** Pin the recommending performance review, designated technical readiness assessment, evaluated core/specialty set and rubric/catalog versions in the decision or an immutable referenced review packet. Define as-of-publication selection, period compatibility and subsequent invalidation rules. Require pairwise distinct manager, technical and decision principals as ADR-005 states. Preserve free-form reasoning for judgment; make dependency identity deterministic.

## F06 · HIGH · Historical tasks do not identify their project snapshot

**Confirmed issue.** [State model](../docs/architecture/state-model.md) allows explicit updates to `projects/<project-id>.yaml`. Tasks and evidence reference only the stable project slug. Artifact revisions preserve deliverables, not the catalog definition, repository identity or assignment-time project metadata.

**Why it matters.** Historical context can change without changing an immutable evidence record.

**Failure scenario.** A curator refreshes a project's learning paths, repository location or competency coverage. Old tasks now resolve to the new snapshot. Reusing `source/` for another checkout can also make old workspace URIs unresolvable even though artifact digests reveal the mismatch.

**Recommended correction.** Keep project identity separate from immutable definition revision. Pin the latter in assignments and preserve snapshots. Define historical artifact resolution independently of current selection, including an explicit unavailable result. No need to enable concurrent projects in V1. An alternative is to prohibit snapshot replacement for the lifetime of a workspace and require new immutable snapshot identities.

## F09 · HIGH · A bounded assessment overwrites a longitudinal competency

**Confirmed issue.** The [competency model](../docs/architecture/competency-model.md) allows technical assessments of bounded designs or behavior. The [state model](../docs/architecture/state-model.md) uses the latest assessment finding as the global competency summary. Assessment findings have no applicability scope or distinction between checkpoint observation and aggregate judgment.

**Why it matters.** A narrow design checkpoint can erase or inflate a broad capability finding without an explicit synthesis decision.

**Failure scenario.** A learner has an E2 navigation finding supported across contexts. A later bounded E0 exercise produces an E0 technical finding, or an unassessed finding because the checkpoint did not observe navigation. Cache rebuild replaces E2 even though no reviewer concluded the broader capability had changed. Conversely, one narrow high-level finding becomes the displayed global result.

**Recommended correction.** Either require every cache-producing assessment to be an explicit longitudinal synthesis that considers earlier relevant evidence, or distinguish scoped checkpoint findings from aggregate findings and derive the cache from only the latter. Specify same-subject supersession precisely. Keep effective promotion level separate.

## F10 · MEDIUM · Evidence-based baseline has a project prerequisite cycle

[Lifecycle](../docs/architecture/simulation-lifecycle.md) places baseline before project selection; [projects contract](../contracts/projects.md) requires a baseline for selection. Evidence requires a non-null project ID resolving to a pinned project. There is no clear route to record genuine project-free baseline observations or pin prior-work context before baseline. An all-unassessed baseline escapes the cycle, so initialization is not universally blocked. Permit a project-free baseline context, or a narrowly authorized preselection evidence-context import. Do not force an invented project or unknown baseline when evidence exists.

## F11 · MEDIUM · Project catalog version rule contradicts its schema

[State model](../docs/architecture/state-model.md) says catalogs use `catalog_version` instead of learner data classification. [Project schema](../schemas/project.schema.json) and the global project catalog require `data_class` and omit `catalog_version`. Competency and level catalogs do use `catalog_version`. Clarify whether projects are an explicit exception or separate catalog definitions from classified workspace snapshots. Preserve fixture/live isolation. This is an authority conflict requiring a documented versioning choice, not a reason to relabel fixtures as live.

## F13 · MEDIUM · Missing-artifact observations cannot be recorded as evidence

[Evidence model](../docs/architecture/evidence-model.md) asks for missing artifacts to be recorded as gaps, but every evidence record requires at least one artifact and a verification reviewer/method/time, even when unverified. A transcript can legitimately be the artifact for a self-report, but it must not masquerade as corroboration of the original work. Define whether unsupported observations live only in profile/notes until an artifact exists, or permit explicitly unverified artifact-free records. Define provisional verification metadata as “checked but uncorroborated” or allow a not-yet-checked state. This is representational friction, not permission to invent URIs.

## In-memory structural probes

Ran six probes using the installed `jsonschema` Draft202012Validator with FormatChecker against copies of fixtures. No fixture was modified.

| Probe | Observed schema result | Interpretation |
| --- | --- | --- |
| Null task and null project for baseline evidence | REJECTED | Confirms F10's structural restriction |
| Unverified evidence with no artifacts | REJECTED | Confirms F13 |
| Unknown help, strong independent interpretation | ACCEPTED | Prohibited semantically; schema-only validation is insufficient, as already documented |
| Assessment with explicit `task_id` | REJECTED | No structured task edge for the design gate, F04 |
| Review with `recommendation_review_id` | REJECTED | No explicit manager dependency field, F02 |
| Registry with one ID assigned two different roles | ACCEPTED | Object uniqueness is not ID uniqueness; fixture checker rejects this separately |

Acceptance here does not demonstrate a working exploit against a runtime. Rejection of invented fields demonstrates closed shapes, not that those exact field names must be adopted.

## Evidence attack matrix

| Scenario | Current representation and residual risk |
| --- | --- |
| Copies AI implementation | Level 7 plus implemented-by-other; separate comprehension claim. Undisclosed copying remains Unknown, not detectable by file provenance alone |
| Heavy mentorship | Per-competency help and guided interpretation can represent it; external attribution gap F05 remains |
| Repeated success in one codebase | Project, scope and artifacts represent observations; diversity must assess contexts, not count IDs or repositories |
| Unsupported reviewer claim | Unverified/weak material cannot substantiate affirmative capability. Prose assertions still need human judgment; schema acceptance proves nothing |
| New evidence contradicts old | Contrary records and contested assessments exist; validity propagation/recovery is incomplete, F01 |
| Code passes, learner cannot explain | Verified passing test and separate contrary comprehension/implementation evidence can coexist; completion does not imply competency |
| Fix without causal understanding | Supporting outcome plus contrary debugging evidence is expressible; do not infer diagnosis from the patch |
| One good performance, inconsistent later | Multiple observations and longitudinal review can represent inconsistency; F09's latest-finding cache can obscure it |

## Evolution assessment

Strict unknown-field rejection and immutable schema IDs provide an honest migration boundary. Concurrent projects can extend selection without changing stable task IDs. Multiple reviewers need decision-group and resolution semantics, not arbitrary multiple current heads. Team changes need F03. Specialty/custom-level changes require versioned historical rubric bindings, not mutation of E0–E5 meanings. Additional evidence categories and external review systems can use versioned records plus immutable artifact references. No architectural impossibility is established, but migration cannot recover historical input identities V1 never captured.
