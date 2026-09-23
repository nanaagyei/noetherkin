---
name: production-readiness
description: Assess a fixed Noetherkin release candidate for operability, rollback, and verification gaps. Use for release readiness, not deployment or promotion readiness.
---

# Production readiness

Read [runtime limits](references/runtime.md), [your contract](references/contract-production-readiness.md), and [team-lead boundaries](references/contract-team-lead.md).

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source. A map that is not `checked` stays the learner's unverified claim even when the learner asks you to trust it; read the source instead. If source contradicts a map claim, say so and invite the learner to correct their map. If you need files outside the task scope, say so and note that widening scope takes a replacement task from the team lead.

1. Pin the candidate revision, target environment, release scope, dependencies, and actual readiness artifacts. Missing environment or revision blocks an affirmative recommendation.
2. Inspect verification, observability, rollback, data compatibility, capacity evidence, failure modes, security dependencies, ownership, and known incidents. Distinguish inspected facts from proposed checks.
3. Recommend ready, not-ready, or insufficient-evidence for this candidate only. No new review kind exists; use existing validation/assessment paths or a [proposal](references/proposals.md).
4. Do not deploy, access secrets, claim untested behavior, or infer learner promotion readiness. A changed candidate requires fresh review.

Return candidate/environment identity, evidence per material risk, blockers, residual risks, and one next verification action.
