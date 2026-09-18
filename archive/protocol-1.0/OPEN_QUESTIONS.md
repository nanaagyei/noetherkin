# Open questions

No unresolved BLOCKING question remains for the V1 specification. The following product choices are exposed for maintainer review; current V1 behavior is explicit and does not depend on their resolution. Agent 2 must not silently change that behavior.

| ID | Class | Question | Current V1 decision and recommendation |
| --- | --- | --- | --- |
| OQ-001 | IMPORTANT | How should independent reviewers be calibrated against systematic model bias? | Separate principals and independently recorded judgments, with learner-authorized review. Recommend human-audited calibration scenarios before claiming trustworthy promotion quality. Multiple model vendors remain optional. |
| OQ-002 | IMPORTANT | How should disputed or revoked promotions be handled? | Corrections preserve records and block a dependent invalid chain; no silent demotion. Recommend a dedicated appeal/reconciliation proposal before implementing retrospective level changes. |
| OQ-003 | IMPORTANT | Should evidence recency have specialization-specific guidance? | Reviewer explains recency relative to context and technology changes. Recommend empirical calibration; do not invent universal expiry days. |
| OQ-004 | IMPORTANT | When can a project candidate be labeled supported? | PetClinic remains a candidate fixture with researched upstream context. Recommend a revision-pinned onboarding evaluation on a real checkout before live supported status. |
| OQ-005 | IMPORTANT | What protects local records against deliberate tampering? | Explicit provenance, immutable review policy, local history and role checks; no credential-grade assurance. Recommend threat modeling before multi-user or credentialing use. |
| OQ-006 | LATER | How should concurrent writers coordinate? | V1 single writer, stale-digest checks and crash-recoverable transactions. Recommend experience with a vertical slice before adding distributed locks or event sourcing. |
| OQ-007 | LATER | What artifact retention and redaction policy is needed? | Persist safe minimal artifacts, disclose unverifiable material, mark dependent judgments stale if evidence disappears. Recommend explicit retention/consent policy before hosted storage. |
| OQ-008 | LATER | Which additional skills should cover promotion, incidents and specialization? | Only eight contracts delivered; promotion protocol can be performed manually by the prescribed principals. Recommend a dedicated promotion contract before automating it. |
| OQ-009 | LATER | Should levels allow specialization-specific titles or lateral progression? | Fixed E0–E5 internal levels, adjacent promotion only, with separate competency findings. Recommend preserving this separation in any extension. |

If Agent 2 discovers a contradiction requiring a foundational semantic choice, classify it BLOCKING and write an architecture change proposal. Do not disguise it as an implementation detail.
