# Skill contract review

The role/workflow separation is sound. There are eight contracts, not eight competing authorities. Preserve shared conventions rather than copying policy into every skill.

## F03 · HIGH · Principal lifecycle and learner identity binding are incomplete

**Confirmed issue.** [Permissions](../docs/architecture/permissions-model.md) authorize the learner to register principals. [Config schema](../schemas/apprenticeship-config.schema.json) stores only ID/role pairs, without retirement or historical grants. The profile's `LEARNER-...` identity is not explicitly linked to its `ACTOR-...` principal. The invocation declares its own principal/role; a trusted binding from invoker to registered principal is not specified. Local revision history is required, but no as-of-authorization rule connects it to judgments.

**Why it matters.** Current authority and historical authorization are different facts. An ordinary reviewer departure must neither erase valid historical judgments nor leave departed principals indefinitely authorized. Merely choosing a different ID is not an independent review invocation.

**Failure scenario.** A learner removes a retired team lead from config. Historical assessments now reference an unregistered principal and invalidate the workspace. Keeping the entry avoids that failure but leaves write authority active. A poorly bound adapter can also let an invocation select another registered role simply by declaring it.

**Recommended correction.** Define a single learner-to-principal binding, stable non-reassignable actor IDs, grant/retirement semantics and as-of-publication authority checks. Specify that the trusted caller binds each invocation to a role; task/artifact content cannot select it. A small append-only grant history or immutable registry revisions suffice. Explicitly test duplicate ID roles, retirement, changed roles and forged invocation identity. This is procedural integrity, not a demand for credential-grade authentication or multiple model vendors.

## F04 · HIGH · Design approval has no unambiguous task/revision binding

**Confirmed issue.** [Lifecycle](../docs/architecture/simulation-lifecycle.md) requires a learner design artifact and team-lead technical assessment before implementation. [Assessment schema](../schemas/assessment.schema.json) contains learner/project, competency findings and evidence IDs, but no task/design reference or approval decision. [Task schema](../schemas/task.schema.json) has no design-assessment pointer. Competency evidence may reference a task and design artifact indirectly, but the gate does not require that path or state what judgment approves the design.

**Why it matters.** The deterministic gate cannot distinguish a readiness assessment from an approval of this design at this revision.

**Failure scenario.** A technical assessment for an earlier task in the same project is offered at the next task's design gate. All IDs resolve, but no explicit rule proves that the current design was accepted. A later revised design has the same problem.

**Recommended correction.** Give the design gate an explicit task ID, immutable design artifact revision, accountable decision and referenced assessment/review. Define approval/rework/insufficient inputs and when design changes invalidate approval. Reuse an existing record kind if its semantics fit; do not add a new bureaucracy solely for naming symmetry.

## F05 · HIGH · Help from outside registered providers has no faithful write path

**Confirmed issue.** [Assistance model](../docs/architecture/assistance-model.md) calls for human/tool help attribution. [Permissions](../docs/architecture/permissions-model.md) allow providers to append their own events. Event `actor` must be a registered principal and is described as the provider. There is no separate recorder/provider, discovery time, external-provider representation or correction edge for erroneous help events.

**Why it matters.** Known outside help can become “unknown,” be attributed to the learner incorrectly, or require granting a nonparticipating helper a simulator role. Late disclosure also collides with immutable evidence snapshots and append-only task help history.

**Failure scenario.** After completing work, the learner discloses that a coworker supplied the implementation yesterday. The coworker has never used the simulator. The learner cannot append the coworker's own event under the existing write rule, and an event naming the learner misstates the provider. A team lead can correct evidence but the canonical task ledger remains unreconciled.

**Recommended correction.** Separate recorder identity from provider attribution. Permit an authorized learner report and team-lead verification/correction of outside help without granting the helper write authority. Retain occurrence and disclosure times, stable event references and correction relationships. Define the permitted terminal-task ledger update and invalidate affected evidence through F01. Unknown provider identity should not force unknown assistance magnitude when the supplied implementation is inspectable.

## F12 · MEDIUM · Retry and write provenance depend on an underspecified receipt

[Shared conventions](../contracts/README.md) require the caller to retain a transaction receipt “described by the state model”; [state model](../docs/architecture/state-model.md) actually describes a pending transaction manifest. Durable committed receipt location, retention, operation/input identity and lookup after caller loss are not defined. Task validation and work-artifact changes also need attributable historical updates, but only transition/help entries have explicit append-only treatment. Define durable committed receipts and a minimal revision/audit envelope for mutable task updates. Specify logical read consistency while publication is pending. Do not build a distributed event system; retain the single-writer design.

## Contract-by-contract disposition

| Contract | Disposition |
| --- | --- |
| onboarding | Correctly separates self-report and baseline; baseline evidence path needs F10 and bootstrap identity needs F03 |
| projects | Correctly requires explicit selection and source inspection; preserve snapshots under F06 and resolve catalog exception F11 |
| task-assignment | Good bounded problem/criteria contract and no solution leakage; freeze complete assignment under F08 |
| teach | Good one-hint escalation and response artifacts; clarify outside/late help F05 and low-impact help F15 |
| peer-engineer | Good provisional-only evidence and hypothesis labeling; helping and reviewing the same change should disclose participation |
| code-review | Revision binding is strong; reusing a review must include reviewer identity and relevant assistance/criteria inputs, not just task/revision/evidence |
| team-lead | Legitimate task authority, but design versus longitudinal assessment needs F04/F09; F08 limits later task edits |
| manager | Correctly recommends rather than promotes; pin its recommendation under F02 |

## Role conflict assessment

Manager cannot edit active technical criteria; user-agent cannot write evaluations; promotion-reviewer cannot appoint itself. These are good boundaries. ADR-005 specifies distinct manager, technical and promotion principals, while review procedure step 4 explicitly requires only promotion reviewer distinct from each. Reconcile that wording and test all required pairwise distinctions as part of F02. The peer who helped may also review code; that is ordinary collaboration, but review artifacts should disclose material authorship and never count the review as independent learner evidence. No additional reviewer is needed for every small task.
