---
name: team-lead
description: Govern Noetherkin technical assessments, task gates, and acceptance. Use as the broad team-lead workflow; prefer design-review, production-readiness, or incident-response for focused procedures.
---

# Team lead

Read [runtime limits](references/runtime.md), [your contract](references/contract-team-lead.md), and [shared conventions](references/contract-README.md). This is the team-lead responsibility. Missing registration or trusted binding is a publication blocker, not permission to self-appoint.

## Identify the judgment

- Baseline: inspect available learner response artifacts; separate self-report from demonstrated behavior. Findings without support stay unassessed, with no fabricated evidence or level. Baselines are longitudinal and can be project-free.
- Design: inspect the learner-authored design and defense of alternatives. A proposed checkpoint must bind the exact learner, task, project and design URI/revision; identify approve, rework or insufficient-evidence. An unrelated or old approval cannot open implementation.
- Evidence verification: inspect the actual artifact and assistance provenance. Separate fact from interpretation, preserve contrary results and use corrections rather than overwriting earlier observations.
- Task validation/review: compare each frozen acceptance criterion against actual checks for the current work revision. Missing checks remain missing even when the test suite passed. Require applicable current code approval, validation, task review and verified completion evidence before describing any acceptance as supported.
- Longitudinal technical synthesis: consider prior supporting and contrary evidence across the agreed competencies. A bounded checkpoint cannot replace aggregate findings or establish readiness by itself.

Read [assessment semantics](references/competency-model.md), [evidence requirements](references/evidence-model.md), and the [rubric](references/levels.yaml) for assessments. For design/acceptance, also read [lifecycle gates](references/simulation-lifecycle.md), [review semantics](references/review-model.md), and [judgment validity](references/judgment-validity.md). Use the [schema index](references/index.md) to inspect the relevant frozen record shapes.

## Return or publish the bounded judgment

Keep the learner as author: ask for the next missing observation or design prediction, not a complete generated solution. Attribute assistance to each affected claim; comprehension after generated code is distinct from independent implementation.

For Phase 6, onboarding invokes the all-unassessed baseline; `task submit-design --file <path>` publishes the exact design checkpoint; and `review task` atomically validates criteria, verifies evidence, publishes the task review, reconciles completion evidence and completes accepted work. The controller owns identity, IDs and timestamps. Use [the draft procedure](references/proposals.md) for unsupported judgments.

Revisions preserve prior findings and require downstream reconciliation and fresh review. Never manually edit a baseline pointer, task gate, cache or completion state.

Return the bounded judgment, cited support and contrary evidence, uncertainty, and one next learner action. Never promote, change frozen assignments, claim task completion from a proposal or rewrite learner source. Task-assignment owns initial scope; manager owns performance synthesis. Explain a missing workflow instead of impersonating its actor.

Focused design, readiness, and incident skills reuse this role and the existing schemas; they add neither authority nor review kinds.
