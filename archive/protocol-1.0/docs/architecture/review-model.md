# Reviews and promotion authority

All review records are immutable, evidence-linked judgments. Code and task reviews carry `change` identifying the reviewed deliverable at a fixed revision, including documentation deliverables. Task review publication must follow the current validation checks. An outcome applies to a named subject and a bounded interval. The period start must not follow its end or publication time. A later review supersedes an earlier same-kind/same-subject review when correcting its judgment; task rework ordinarily creates a fresh review for the new revision. Current review means latest unsuperseded review for the subject and current artifact revision; ties or competing heads are invalid.

| Kind | Inputs / subject | Author and output | Read / write boundary |
| --- | --- | --- | --- |
| code | Change artifact at fixed revision, task criteria, tests, evidence; task ID | Peer engineer: approve, changes-requested, insufficient-evidence | Read source/task/evidence; append code review only |
| task | Execution history, validation, assistance, current code review if required; task ID | Team lead: accepted, rework, insufficient-evidence | Read project work; append task review and govern task gates |
| performance | Evidence/assessments/reviews over a stated period; learner ID | Manager: continue, adjust-scope, recommend-promotion-review, insufficient-evidence | Read formal records; append performance review, no level writes |
| promotion | Current level chain, performance recommendation, technical assessment, rubric and evidence; learner ID | Promotion reviewer: PROMOTE, NOT YET, INSUFFICIENT EVIDENCE | Read formal records; append promotion review only |

Code approval neither merges a change nor grants task completion. A manager adjusts future task scope by recommendation to team lead, not by rewriting active acceptance criteria. Team lead provides technical input but cannot grant promotion alone.

## Promotion procedure

1. Manager publishes a performance review recommending promotion review. Select the latest unsuperseded recommendation for that learner and evidence period; an absent or conflicting recommendation blocks the procedure.
2. Team lead publishes a technical assessment covering the core and agreed specialization competencies. Promotion `assessment_ids` must include this current assessment. `technical_reviewer_id` names its author.
3. Learner explicitly authorizes that review and its potential adjacent-level decision. Store the authorization artifact and timestamp; this is process authorization, not proof of readiness.
4. A registered promotion reviewer with a principal ID different from the technical reviewer, manager recommender and learner examines supporting and contrary evidence. A distinct invocation with a distinct principal and independently recorded judgment is required; a second model vendor is not required. This separation is procedural, not a claim of bias-free independence.
5. Record `from_level` equal to the derived effective level and `target_level` exactly one step higher, with the previous accepted promotion pointer. Include findings for each of the thirteen rubric dimensions exactly once, evidence references and quality analysis for repetition, recency, diversity, scope, independence and contrary evidence.
6. PROMOTE requires each dimension to meet the target and relevant core/specialization coverage, with repeated independent demonstrations in materially different contexts. No numeric task quota substitutes for this judgment. Evidence must be recent enough for the claimed capability; the reviewer explains why rather than applying an arbitrary expiry window. Unresolved material contrary evidence precludes PROMOTE.
7. NOT YET means adequate evidence shows a next-level requirement is not met. INSUFFICIENT EVIDENCE means missing, unverifiable or contextually narrow evidence prevents a decision. Both leave effective level unchanged and name the next observation needed.
8. Deterministic checks validate identity, permissions, chain, evidence references and completeness before publication. Then rebuild derived competencies. Structural validity does not establish sound judgment.

Review evidence may precede the review period where explicitly needed for longitudinal comparison; identify that in findings. Observations and cited records cannot be from after review publication. Strong same-artifact repetitions or duplicate reviews are not independent demonstrations. A reviewer lacking required independent principal/context returns a blocked procedure, not a synthetic second reviewer. There is no promotion skill among the first eight; the protocol is reserved for a future dedicated workflow or a manually conducted conforming review.
