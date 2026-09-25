# Open questions

No unresolved BLOCKING question remains for the V1 specification. The following product choices are exposed for maintainer review; current V1 behavior is explicit and does not depend on their resolution. Implementers must not silently change that behavior. The freeze resolves all BLOCKER/HIGH review findings; the IMPORTANT and LATER labels below are non-blocking priorities, not missing protocol decisions.

| ID | Class (all NON-BLOCKING) | Question | Current V1 decision and recommendation |
| --- | --- | --- | --- |
| OQ-001 | IMPORTANT | How should independent reviewers be calibrated against systematic model bias? | Separate principals and independently recorded judgments, with learner-authorized review. Recommend human-audited calibration scenarios before claiming trustworthy promotion quality. Multiple model vendors remain optional. |
| OQ-002 | IMPORTANT | How should disputed or revoked promotions be handled? | ACP-01 defines unresolved standing and ordered reconciliation through fresh authorized reviews. V1 has no demotion/revocation or discretionary appeal override. A future appeal policy is optional and cannot block the specified repair path. |
| OQ-003 | IMPORTANT | Should evidence recency have specialization-specific guidance? | Reviewer explains recency relative to context and technology changes. Recommend empirical calibration; do not invent universal expiry days. |
| OQ-004 | RESOLVED IN PHASE 6 | When can a project candidate be labeled supported? | Spring PetClinic Microservices is the one supported live catalog project. Selection requires exact repository identity, a full pinned commit and revision-aware task compatibility probes. The example state remains fixture-only. |
| OQ-005 | IMPORTANT | What protects local records against deliberate tampering? | Explicit provenance, immutable review policy, local history and role checks; no credential-grade assurance. Recommend threat modeling before multi-user or credentialing use. |
| OQ-006 | LATER | How should concurrent writers coordinate? | V1 single writer, stale-digest checks and crash-recoverable transactions. Recommend experience with a vertical slice before adding distributed locks or event sourcing. |
| OQ-007 | LATER | What artifact retention and redaction policy is needed? | Persist safe minimal artifacts, disclose unverifiable material, mark dependent judgments stale if evidence disappears. Recommend explicit retention/consent policy before hosted storage. |
| OQ-008 | LATER | Which additional skills should cover promotion, incidents and specialization? | Twenty-one contracts now exist, including a proposal-only promotion-review contract. Promotion execution stays manual by the prescribed principals; automating it needs its own proposal. |
| OQ-009 | LATER | Should levels allow specialization-specific titles or lateral progression? | Fixed E0–E5 internal levels, adjacent promotion only, with separate competency findings. Recommend preserving this separation in any extension. |

| OQ-010 | LATER, NON-BLOCKING | Can project metadata explicitly represent absent contribution guides or organizations (F18)? | V1 admits only catalog entries with truthful values for required fields. Incomplete candidates remain read-only suggestions outside the catalog; do not invent URLs or organizations. A future schema may support explicit absence. This does not block the supported V1 catalog contract. |

If Agent 2 discovers a contradiction requiring a foundational semantic choice, classify it BLOCKING and write an architecture change proposal. Do not disguise it as an implementation detail.
