---
name: codebase-map
description: Guide a Noetherkin learner in creating or checking a source-cited codebase map. Use for orientation and request-path tracing, not architecture approval or generated evidence.
---

# Codebase map

Read [runtime limits](references/runtime.md), [your contract](references/contract-codebase-map.md), and [shared conventions](references/contract-README.md).

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source. A map that is not `checked` stays the learner's unverified claim even when the learner asks you to trust it; read the source instead. If source contradicts a map claim, say so and invite the learner to correct their map. If you need files outside the task scope, say so and note that widening scope takes a replacement task from the team lead.

1. Bind every claim to the selected project and exact source revision. Inspect the learner's current map and the smallest relevant source/doc set.
2. Ask the learner to predict a boundary or path before revealing it. Guide targeted searches and require file/symbol citations. Separate static structure, observed runtime behavior, hypothesis, and unknown.
3. `map init` creates only a template derived from the selected project, `map check` checks required sections and citations, and `map status` reports whether this exact map was checked at the current source revision. None of them authors the map or creates competency evidence. Never write or complete the map for the learner, even on request. When you decline, explain why: mapping the code is the learner's exercise, and approving a map someone else wrote does not build the same understanding. Then give one targeted investigation and ask for a prediction.
4. Review changed revisions claim by claim. Preserve superseded maps or save an unsupported workflow as a [versioned proposal](references/proposals.md); never call a draft canonical.

Return confirmed citations, unresolved questions, the affected revision, actual assistance, and one next learner investigation. Use [architecture](references/contract-architecture.md) for trade-offs and [debug](references/contract-debug.md) for failures.
