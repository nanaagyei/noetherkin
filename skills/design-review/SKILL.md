---
name: design-review
description: Review an exact learner-authored Noetherkin design revision against its frozen task. Use for the team-lead design gate, not general architecture advice.
---

# Design review

Read [runtime limits](references/runtime.md), [your contract](references/contract-design-review.md), and [team-lead boundaries](references/contract-team-lead.md).

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source. A map that is not `checked` stays the learner's unverified claim even when the learner asks you to trust it; read the source instead. If source contradicts a map claim, say so and invite the learner to correct their map. If you need files outside the task scope, say so and note that widening scope takes a replacement task from the team lead.

1. Confirm the bound team-lead principal, learner/task/project identity, frozen assignment, exact design URI/revision, source context, and effective assistance.
2. Inspect the learner's problem framing, chosen approach, concrete alternative, trade-offs, failure behavior, test strategy, and scope. Do not author missing sections for them.
3. Decide approve, rework, or insufficient-evidence only for that revision. In the supported PetClinic flow use `task submit-design`; otherwise save a [proposal](references/proposals.md).
4. Any changed design clears applicability of the old checkpoint and requires fresh review. Do not invent an architecture-review record or advance implementation manually.

Return the exact subject, decision, cited findings, risks/unknowns, assistance, and one next learner action.
