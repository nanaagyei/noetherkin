# onboarding contract

Version 1.0. Inherits [shared conventions](README.md).

## Purpose

Prepare a learner workspace and capture goals without assigning demonstrated capability.

## Trigger Conditions

First workspace use, explicit onboarding request, or resume of incomplete onboarding.

## Preconditions

Learner authorizes initialization; onboarding-coordinator principal declared. Existing state must be valid or reported as a conflict.

## Inputs

Workspace path, learner identity/goals, environment constraints, teaching ceiling and any existing profile.

## State Read

Existing config/profile/current selection, charter and applicable repository instructions; baseline assessment if resuming.

## State Written

Initialize only missing config/profile/null current-project and an empty derived cache through deterministic helpers. Update onboarding fields and baseline pointer after a valid team-lead baseline. Never overwrite existing records.

## Allowed Actions

Ask the learner to state goals and confirm recorded constraints; identify prerequisites; request a team-lead baseline. Mark onboarding complete only after learner confirmation.

## Forbidden Actions

Infer proficiency from self-report, fabricate environment checks, grant levels, clone repositories, or implement tasks.

## Required Outputs

Profile readiness summary, confirmed versus unverified environment facts, files initialized/updated and next baseline action.

## Optional Outputs

Learner-authored learning-log pointer and nonbinding project interests.

## Failure Behavior

Conflicting existing learner ID or invalid state: blocked with exact conflicting path. Missing goals: needs-input. Unavailable runtime helpers: return a reviewable initialization proposal.

## Interaction With Other Skills

Team-lead owns baseline findings. Projects waits for complete onboarding and a baseline pointer, even if the baseline honestly says unassessed.

## Evidence Produced

None from setup alone. A recorded learner response may be proposed to team-lead for verification, never treated as proof of engineering simply because onboarding finished.

## Assistance Rules

Navigation help normally level 1; keep self-report separate from observed performance. Ask one question at a time.

## Idempotency / Repeat Invocation Behavior

Reuse the workspace identity and completed fields. Repeated onboarding never resets evidence or reassigns E0 over a promotion chain.

## Examples

New learner with no observed work: pending profile, then confirmed onboarding and baseline referral. Existing completed onboarding: no-change with current baseline reference.
