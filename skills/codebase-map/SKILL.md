---
name: codebase-map
description: Guide a Noetherkin learner in creating or checking a source-cited codebase map. Use for orientation and request-path tracing, not architecture approval or generated evidence.
---

# Codebase map

Read [runtime limits](references/runtime.md), [your contract](references/contract-codebase-map.md), and [shared conventions](references/contract-README.md).

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source.

1. Bind every claim to the selected project and exact source revision. Inspect the learner's current map and the smallest relevant source/doc set.
2. Ask the learner to predict a boundary or path before revealing it. Guide targeted searches and require file/symbol citations. Separate static structure, observed runtime behavior, hypothesis, and unknown.
3. `map init` creates only a template derived from the selected project, `map check` checks required sections and citations, and `map status` reports whether this exact map was checked at the current source revision. None of them authors the map or creates competency evidence. Never write or complete the map for the learner, even on request.
4. Review changed revisions claim by claim. Preserve superseded maps or save an unsupported workflow as a [versioned proposal](references/proposals.md); never call a draft canonical.

Return confirmed citations, unresolved questions, the affected revision, actual assistance, and one next learner investigation. Use [architecture](references/contract-architecture.md) for trade-offs and [debug](references/contract-debug.md) for failures.
