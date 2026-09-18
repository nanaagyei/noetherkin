# Competency taxonomy and assessments

`catalog/competencies.yaml` is the canonical V1 taxonomy. Each entry has a stable domain-qualified ID, name, observable behavior and `required_core`. Domain prefixes prevent ambiguous reuse of terms such as concurrency or networking. A language-specific demonstration may support a core competency through a separate evidence record with its own rationale; do not count the same underlying event as diverse evidence.

All seven core competencies apply to progression. The learner and team lead choose specialization competencies in the profile before a promotion evidence window is evaluated. They cannot remove a weak relevant competency during review to manufacture readiness; changes require documented rationale and a fresh performance review. Not every learner needs every language, cloud or GPU competency. Catalog IDs are references, not scores or levels.

Catalog extension adds a stable namespaced ID, observable boundary and domain through a versioned catalog change. Never rename an ID in place. A migration records replacement mappings and preserves historical meanings. For V1, catalog records require exactly the documented fields, unique IDs, nonempty behaviors and valid level dimensions; catalog integrity is covered by conformance evaluation.

Baseline assessments describe current evidence, including honest unknowns. Technical assessments review a bounded design or behavior. Team lead authors both. Findings use `unassessed`, `developing`, `demonstrated`, or `contested`. A demonstrated level describes behavior for one competency, not a promotion. Each finding's evidence IDs are a subset of the assessment's IDs; a claim beyond unassessed requires relevant evidence and a rationale. Baseline self-report alone leaves a finding unassessed.

See the state model for deterministic cache derivation. A new verified contrary observation marks dependent findings stale until a fresh assessment explains whether the contradiction changes the judgment. Never average levels or calculate a percentage skill score.
