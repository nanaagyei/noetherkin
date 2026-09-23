---
name: task-assignment
description: Define a bounded, testable Noetherkin assignment and its investigation prompt without revealing the solution. Use when a learner requests next work or a manager recommends new scope; execution gates belong to team-lead.
---

# Task assignment

Read [runtime limits](references/runtime.md), [your contract](references/contract-task-assignment.md), and [shared conventions](references/contract-README.md). Assignment is a team-lead responsibility, not a separate principal.

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source.

1. Inspect learner goals, canonical onboarding/baseline, selected project snapshot and source binding, relevant tasks and available capability evidence. State unresolved prerequisites; approved drafts cannot establish assignment eligibility. Catalog fixtures cannot support live assignments.
   When the request explicitly asks for hypothetical level calibration, evaluate the requested level's task shape without treating the fictional learner's current standing as an eligibility gate. Keep the output noncanonical and conditional on source binding, and do not redirect to a lower level unless requested. Current evidence still governs any later live assignment.
2. Identify the actual problem and observable success. If unclear, ask the smallest question that establishes problem or impact. Set TRAINING for a labeled simulated exercise, PRODUCT for learner-local improvement, or UPSTREAM for an intended contribution without submission authority. Never invent upstream demand or acceptance.
3. Propose bounded scope, supported competency IDs, unique criterion labels, test expectations, constraints and documentation needs using the [task schema](references/task.schema.json). Use the [competency catalog](references/competencies.yaml) and [rubric](references/levels.yaml) to explain fit without promising advancement.
4. Default design and code review to required. Any allowed waiver needs its rationale before assignment under [lifecycle rules](references/simulation-lifecycle.md). Preserve the [entire frozen assignment](references/state-model.md); new criteria or changed scope require replacement work, not edits to an assigned contract.
5. For the compatible PetClinic checkout, use `task assign pet-type-integrity`; the deterministic controller instantiates the curated frozen TRAINING task and its backlog-to-assigned history. Use a [proposal](references/proposals.md) for other tasks, with unresolved IDs and publication prerequisites explicit.

Give one learner investigation prompt without the architecture map, root cause, solution or implementation. Before implementation, elicit their prediction, approach, defended alternatives and failure cases appropriate to the stakes. Assignment itself creates no capability evidence.

Return the proposed task, scope rationale, waiver explanations when applicable, and next learner action. Refer execution/design/acceptance to team-lead and help to teach or peer-engineer; explain the workflow if the corresponding skill is not installed. The [reference index](references/index.md) contains the remaining record shapes and provenance.
