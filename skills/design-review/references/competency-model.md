# Competency taxonomy and assessments

Protocol 3.0 keeps the seven universal core competencies and adds shared data, research, mathematics, AI, product-integration, quantitative-finance and ML-systems competencies. Tracks reference these catalog IDs through `required_competencies`; tracks do not own or redefine competencies. Track changes cannot remove weak competencies from an active review window and require the alignment process in the state model.

`catalog/competencies.yaml` is the canonical V1 taxonomy. Each entry has a stable domain-qualified ID, name, observable behavior and `required_core`. Domain prefixes prevent ambiguous reuse of terms such as concurrency or networking. A language-specific demonstration may support a core competency through a separate evidence record with its own rationale; do not count the same underlying event as diverse evidence.

All seven core competencies apply to progression. The learner and team lead choose specialization competencies in the profile before a promotion evidence window is evaluated. They cannot remove a weak relevant competency during review to manufacture readiness; changes require documented rationale and a fresh performance review. Not every learner needs every language, cloud or GPU competency. Catalog IDs are references, not scores or levels.

Catalog extension adds a stable namespaced ID, observable boundary and domain through a versioned catalog change. Never rename an ID in place. A migration records replacement mappings and preserves historical meanings. For V1, catalog records require exactly the documented fields, unique IDs, nonempty behaviors and valid level dimensions; catalog integrity is covered by conformance evaluation.

## Competency graph (catalog 4.0, ACP-013)

Catalog 4.0 adds two optional arrays of competency IDs to each record. `prerequisites` names competencies a learner should be able to demonstrate before work targeting this one is reasonable. `encompasses` names component competencies exercised when this one is demonstrated. Both default to empty, and an unedged competency is always reachable. Every referenced ID must exist, no record may reference itself, a `required_core` competency may only require core competencies so core stays reachable from an empty profile, and the union of both edge sets must be acyclic. A catalog that breaks any rule is rejected by name, including the cycle, and is never repaired by dropping an edge.

**The graph changes where a human looks, never what a human concludes.** Edges are advisory input to selection, remediation targeting and evidence discovery. They never gate assignment, review or promotion, and they never award, weight or remove credit. Numeric implicit credit for encompassed competencies is rejected because it would be a skill score. The following rules are unchanged and bind every reader of the graph:

- An evidence record still makes exactly one competency claim in one context.
- A claim about an encompassed competency needs a **separate** evidence record with its own interpretation, published by a principal with authority to publish it. An `encompasses` edge does not perform that step; it only makes it discoverable.
- Repeated citations of the same artifact are not repeated demonstrations. An edge is not permission to cite one artifact twice.
- The derived cache selects only unsuperseded longitudinal findings. No edge contributes to it, and no edge produces, modifies or weights a finding.

A workspace pinned to competency catalog 3.0 remains valid under a 4.0 runtime and receives no graph; edges are never synthesized for it. New workspaces pin 4.0. `noetherkin competency show <id>` prints a competency's edges and their derived reverse directions (`required_by`, `encompassed_by`) for the pinned catalog. The first authored cut covers the seven core competencies and the backend-engineering track; extending it is an ordinary versioned catalog change.

Baseline assessments describe current evidence, including honest unknowns. Technical assessments explicitly choose scope `checkpoint` for bounded behavior/design or `longitudinal` for synthesis across relevant history. Checkpoints require task_id, and cannot supply the aggregate cache. Longitudinal assessments require null task_id/design, consider prior relevant supporting and contrary evidence and explain change from earlier findings. Baselines are longitudinal; self-report still cannot establish capability. Team lead authors both. Findings use `unassessed`, `developing`, `demonstrated`, or `contested`. A demonstrated level describes behavior for one competency, not a promotion. Each finding's evidence IDs are a subset of the assessment's IDs; a claim beyond unassessed requires relevant evidence and a rationale. Baseline self-report alone leaves a finding unassessed.

See the state model for deterministic cache derivation. A new verified contrary observation marks dependent findings stale until a fresh assessment explains whether the contradiction changes the judgment. Never average levels or calculate a percentage skill score.
