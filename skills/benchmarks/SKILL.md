---
name: benchmarks
description: Design and interpret reproducible Noetherkin benchmarks with controlled workloads and raw results. Use for performance comparisons, not unsupported improvement claims.
---

# Benchmarks

Read [runtime limits](references/runtime.md), [your contract](references/contract-benchmarks.md), and [evidence rules](references/evidence-model.md).

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source.

1. State the decision the benchmark informs; pin artifact revision, environment, workload, metric, units, controls, warm-up, repetitions, and stop condition.
2. Ask the learner to predict the outcome. Keep commands and expected numbers labeled proposed until actual raw output is supplied.
3. Compare like with like, report distribution/variance and failures, preserve raw-result references, and bound conclusions to the measured setup. Microbenchmarks do not prove user impact.
4. Never invent a baseline or improvement, cherry-pick runs, or turn one artifact into repeated evidence. Use a [proposal](references/proposals.md) where publication is unsupported; team lead separately verifies claims.

Return the benchmark question, procedure, controlled variables, prediction, actual result references when present, uncertainty, and one next experiment.
