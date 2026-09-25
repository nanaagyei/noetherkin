---
name: onboarding
description: Introduce a Noetherkin workspace, gather learner goals and constraints, and resume pending onboarding with a baseline handoff. Use for simulator setup or profile readiness, not general employee onboarding or capability evaluation.
---

# Onboarding

Read [runtime limits](references/runtime.md), [your contract](references/contract-onboarding.md), and [shared conventions](references/contract-README.md). Act within the onboarding-coordinator responsibility; skill invocation does not supply that principal or trusted binding.

## Establish readiness

1. Inspect the requested workspace and applicable instructions. Use CLI status/validate for existing state; use doctor for reported conflicts. Preserve an existing identity, baseline and history. Invalid or conflicting state is blocked with the exact path, never reinitialized.
2. Elicit missing goals, environment constraints and teaching ceiling one question at a time. Reuse already confirmed information. Separate self-report from observed environment checks; setup establishes no engineering evidence or demonstrated level.
3. If absent and initialization is requested, collect the CLI's required inputs and obtain its noninteractive proposal. When it returns a `terminal-handoff` next action, give the learner that exact command to run in their own terminal, where they review and consent. Do not type consent or simulate a terminal for them. If the CLI is unavailable, save a clearly incomplete initialization proposal.
4. A track must be selected before onboarding. Help the learner choose one from `tracks` and hand off `track select <id>` the same way. Then direct the learner to run `onboard` in their terminal, or hand off its command. The controller invokes the separately bound team lead, records an all-unassessed longitudinal baseline and scope agreement, then the onboarding coordinator publishes the profile pointer. Do not claim completion until `validate` succeeds. Project choice (a curated pack or a forge) comes after onboarding.
5. For unsupported onboarding shapes, use a [persistent draft](references/proposals.md). Completion still requires learner confirmation and a valid published baseline; neither an approved draft nor administrative E0 satisfies that prerequisite.

## Resume a baseline handoff

Read the prior proposal, review notes and exact baseline revision. If the baseline was revised, inspect the differences, retain the old proposal/approval, and save a replacement proposal with the new dependency and fresh-review requirement. If it disappeared or cannot be checked, identify the gap. Never silently set the canonical baseline pointer to a draft path.

A missing review log means review history is unavailable; it does not prove that no review occurred.

Return readiness, confirmed versus unverified facts, actual initialized files versus proposed updates, and one next learner action. An already satisfied request with unchanged inputs returns no-change; a requested unsupported write remains blocked even when its draft is saved.

Read [lifecycle gates](references/simulation-lifecycle.md) when deciding readiness and [assessment semantics](references/competency-model.md) for the baseline handoff. The [reference index](references/index.md) locates bundled schemas and source provenance. If team-lead is not installed, explain the baseline workflow and required inputs without claiming another role acted.
