# onboarding contract

Version 3.0. Inherits [shared conventions](contract-README.md).

## Purpose

Prepare a learner workspace and capture goals without assigning demonstrated capability.

## Trigger Conditions

First workspace use, explicit onboarding request, or resume of incomplete onboarding.

## Preconditions

Learner authorizes initialization; onboarding-coordinator principal bound by the trusted caller to the learner-authorized initial registry. The learner explicitly selects a catalog track before completion. Existing state must be valid or reported as a conflict.

## Inputs

Workspace path, learner identity/goals, environment constraints, teaching ceiling, explicit track selection and any existing profile.

## State Read

Existing config/profile/current project/current track, charter and applicable repository instructions; baseline assessment if resuming.

## State Written

Initialize only missing config/profile/null current-project/unselected current-track and an empty derived cache through deterministic helpers. After explicit selection, baseline universal core plus that track's required competencies. Update onboarding, baseline pointer, aligned track scope and profile specialization together. Never overwrite existing records.

## Allowed Actions

Ask the learner to state goals, choose a track and confirm recorded constraints; identify prerequisites; request a team-lead baseline. Mark onboarding complete only after learner confirmation and aligned scope publication. When probing for the baseline, prefer the advisory view's `probe_candidates`, the competencies whose observation constrains the most of the graph, falling back to the core competencies when the graph has no edges (see [selection model](selection-model.md)). A probe that produces no artifact produces no finding, and an all-`unassessed` baseline remains valid.

## Forbidden Actions

Infer a track from goals, prior projects or specialization; infer proficiency from self-report; fabricate environment checks; grant levels; clone repositories; or implement tasks.

## Required Outputs

Profile readiness summary, confirmed versus unverified environment facts, files initialized/updated and next baseline action.

## Optional Outputs

Learner-authored learning-log pointer and nonbinding project interests.

## Failure Behavior

Conflicting existing learner ID or invalid state: blocked with exact conflicting path. Missing goals or track selection: needs-input. Unavailable runtime helpers: return a reviewable initialization proposal.

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
