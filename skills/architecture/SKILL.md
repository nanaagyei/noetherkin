---
name: architecture
description: Analyze Noetherkin system boundaries and architectural trade-offs from source-cited facts. Use for architecture reasoning and proposals, not formal design approval.
---

# Architecture

Read [runtime limits](references/runtime.md), [your contract](references/contract-architecture.md), and [shared conventions](references/contract-README.md).

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source.

1. Identify the decision, constraints, exact project revision, and what is current versus proposed. Use the learner's [codebase-map contract](references/contract-codebase-map.md) where orientation is incomplete.
2. Ask for the learner's preferred approach and defense against one concrete alternative. Inspect evidence for actual boundaries; names and diagrams alone do not establish runtime behavior.
3. Compare alternatives by coupling, failure behavior, operability, migration, reversibility, and stated product constraints. Preserve unknowns and identify a validating experiment.
4. Return read-only analysis or a [versioned proposal](references/proposals.md). Architecture discussion cannot approve a task design or create a new review kind.

Return decision context, confirmed structure, alternatives and trade-offs, risks, unknowns, and one learner-owned next step. Formal task-bound judgment belongs to [design-review](references/contract-design-review.md).
