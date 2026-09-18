# projects contract

Version 3.0. Inherits [shared conventions](README.md).

## Purpose

Find an appropriate repository and record an explicit learner selection using catalog data.

## Trigger Conditions

Learner requests candidates, changes project, or resumes selection after baseline.

## Preconditions

Project-curator principal; complete onboarding and valid baseline for selection. Browsing can occur earlier without writes.

## Inputs

Learner goals, effective level, selected track and editorial stage, specialization, environment constraints, candidate catalog and optional selection.

## State Read

Profile, current track and alignment status, derived level checked against canonical reviews, catalog definitions, current selection and task statuses.

## State Written

After learner choice, import an absent catalog record to projects/<id>.yaml once and set current-project binding with inspected source revision. Existing project snapshots are immutable for the workspace lifetime. A learner-authorized prior-work evidence-context import may occur before baseline without selecting a project. No learner progress in the global definition.

## Allowed Actions

Show every editorial tier as guidance with repository difficulty, onboarding cost, feedback-loop cost, level fit, contribution readiness, missing prerequisites, metadata gaps, attachability and task-pack availability. Explain fit and prerequisites, expose uncertainty, inspect an authorized checkout and recommend bounded onboarding areas. Track stage and project difficulty are independent fields.

## Forbidden Actions

Calculate an opaque fit score; treat a tier as repository difficulty or an E-level gate; infer contribution readiness from popularity; expose PetClinic commands for projects without its task pack; hardcode repository behavior in the skill; implicitly clone, checkout, deploy or assume an existing repository revision.

## Required Outputs

Candidates with rationale/caveats or a confirmed project binding; prerequisite gaps and provenance links.

## Optional Outputs

A proposed catalog correction for maintainer review.

## Failure Behavior

Unavailable source revision, unsafe path, dirty checkout, origin mismatch or non-attachable catalog status blocks selection publication; candidate browsing remains possible. Active unblocked task on old project blocks switching. Missing catalog facts remain explicit metadata gaps.

## Interaction With Other Skills

Onboarding supplies goals and the selected track. Projects without a bundled task pack hand off to portable task-assignment. Manager may recommend fit but cannot select for the learner.

## Evidence Produced

Selection and cloning produce no competency evidence.

## Assistance Rules

Use documentation/navigation help; do not pre-solve project tasks in suggested learning paths.

## Idempotency / Repeat Invocation Behavior

Same project/path/revision is no-change. New source revision requires explicit revalidation and cannot silently update historical work.

## Examples

Learner chooses PetClinic but has no checkout: provide the selected recommendation and pending source-binding requirement, not a fictional current-project. Repeated confirmed selection returns the same binding.
