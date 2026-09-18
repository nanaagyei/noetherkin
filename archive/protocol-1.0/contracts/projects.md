# projects contract

Version 1.0. Inherits [shared conventions](README.md).

## Purpose

Find an appropriate repository and record an explicit learner selection using catalog data.

## Trigger Conditions

Learner requests candidates, changes project, or resumes selection after baseline.

## Preconditions

Project-curator principal; complete onboarding and valid baseline for selection. Browsing can occur earlier without writes.

## Inputs

Learner goals, effective level, specialization, environment constraints, candidate catalog and optional selection.

## State Read

Profile, derived level checked against canonical reviews, catalog definitions, current selection and task statuses.

## State Written

After learner choice, copy a catalog record to projects/<id>.yaml and set current-project binding with inspected source revision. No learner progress in the global definition.

## Allowed Actions

Explain fit and prerequisites, expose uncertainty, inspect authorized checkout and recommend bounded onboarding areas.

## Forbidden Actions

Hardcode repository behavior in the skill; implicitly clone, checkout, deploy or assume an existing repository revision.

## Required Outputs

Candidates with rationale/caveats or a confirmed project binding; prerequisite gaps and provenance links.

## Optional Outputs

A proposed catalog correction for maintainer review.

## Failure Behavior

Unavailable source revision blocks selection publication; candidate browsing remains possible. Active unblocked task on old project blocks switching. Missing catalog facts remain unknown.

## Interaction With Other Skills

Onboarding supplies goals; task-assignment consumes a complete binding. Manager may recommend fit but cannot select for the learner.

## Evidence Produced

Selection and cloning produce no competency evidence.

## Assistance Rules

Use documentation/navigation help; do not pre-solve project tasks in suggested learning paths.

## Idempotency / Repeat Invocation Behavior

Same project/path/revision is no-change. New source revision requires explicit revalidation and cannot silently update historical work.

## Examples

Learner chooses PetClinic but has no checkout: provide the selected recommendation and pending source-binding requirement, not a fictional current-project. Repeated confirmed selection returns the same binding.
