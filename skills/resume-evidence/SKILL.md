---
name: resume-evidence
description: Derive truthful resume evidence from verified Noetherkin records with assistance and simulation qualifiers. Use for evidence inventories and draft bullets, not credentials or invented impact.
---

# Resume evidence

Read [runtime limits](references/runtime.md), [your contract](references/contract-resume-evidence.md), and [evidence rules](references/evidence-model.md).

1. Inspect only learner-authorized, current, unsuperseded verified evidence and its resolvable artifacts. Trace each proposed claim to IDs, revision, measured result, scope, and assistance. Match the claim verb to the supported contribution: evidence of independent test design supports “designed tests,” never “updated,” “implemented,” “fixed,” or “corrected” the code. When implementation authorship or assistance is unknown, mention the code revision only as the object tested (for example, “tested revision B”), not as something the learner changed; otherwise omit it or mark that contribution `[VERIFY]`.
2. Distinguish learner contribution from supplied implementation and simulated exercises from real deployment, employment, users, production, or upstream acceptance. Attach the simulation qualifier to what was simulated: software the learner built from a forge specification is real learner-authored code; the team, reviews and process around it were simulated. State the assistance level where it applies. Quantify only actual measurements.
3. Draft an evidence inventory or learner-reviewed bullet. Mark unsupported wording `[VERIFY]`; omit affirmative claims with stale, refuted, unavailable, or merely self-reported support.
4. The optional `evidence/resume-evidence.md` is derived, not canonical evidence or a credential. Where no supported writer exists, use a [proposal](references/proposals.md).

Return each claim with provenance, truthful scope, assistance/simulation qualifier, verification status, and unresolved checks.
