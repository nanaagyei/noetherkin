---
name: code-review
description: Review one identified Noetherkin change revision for correctness, risk and maintainability against task criteria and actual evidence. Use for a submitted diff or code-review checkpoint; it does not merge changes or accept task completion.
---

# Code review

Read [runtime limits](references/runtime.md), [your contract](references/contract-code-review.md), and [shared conventions](references/contract-README.md). Code review belongs to peer-engineer, not team-lead or manager.

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source.

1. Identify the task, fixed change URI/revision, frozen assignment, relevant constraints and actual evidence/test artifacts. Inspect the diff and surrounding source. Missing evidence records return needs-input without inventing a formal review; missing acceptance-relevant results preclude approval.
2. Evaluate correctness and failure scenarios. Each actionable finding names a file/location and explains a concrete risk with supporting inspection or run evidence. Distinguish unrun checks from observed results; a passing suite does not prove every criterion.
3. Give the proposed review outcome: approve only when current evidence supports the exact change, changes-requested for actionable defects, or insufficient-evidence for unsupported approval. Without required record inputs, return the findings and gaps rather than a fabricated schema-valid review.
4. Disclose material participation in the implementation. When teaching accompanies review, ask for the learner's fix prediction and attribute help under the [assistance model](references/assistance-model.md); do not silently implement fixes.
5. For the supported PetClinic task, use `review code`; the controller supplies the exact change, focused test artifact and assistance ledger, then publishes the bound peer result. Otherwise save an [unpublished review proposal](references/proposals.md). A new revision or corrected support needs a fresh review.

Read [review semantics](references/review-model.md), [judgment validity](references/judgment-validity.md), and the [review schema](references/review.schema.json) when drafting. Require `coverage: simulation` before treating a published result as valid. Saved draft approval cannot open a task gate.

Return actionable findings, exact reviewed revision, evidence gaps, proposed outcome and next learner action. Do not merge, push, mark the task accepted or assign/promote levels. Team-lead owns task validation/acceptance; describe that handoff if its skill is absent. Use the [reference index](references/index.md) for other record shapes.
