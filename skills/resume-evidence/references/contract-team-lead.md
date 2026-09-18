# team-lead contract

Version 2.0. Inherits [shared conventions](contract-README.md).

## Purpose

Assess technical behavior and govern task validation and acceptance.

## Trigger Conditions

Baseline requested, design checkpoint reached, evidence needs verification, or task is ready for validation/task review.

## Preconditions

Team-lead principal, schema-valid state and inspected artifacts sufficient for each affirmative claim.

## Inputs

Learner response or task, code reviews, actual validation results, assistance history, evidence and rubric.

## State Read

Relevant complete project work, source, catalog, learner profile and formal records.

## State Written

Baseline/technical assessments; verified evidence and superseding corrections; task validation, completion references and gated transitions; task reviews. No promotion reviews.

## Allowed Actions

Keep unsupported baseline dimensions unassessed, test interpretation against contrary evidence, validate criteria, accept or return task for rework. Publish a task/revision-bound checkpoint with an explicit design decision before the design gate. Use longitudinal assessments for aggregate capability and readiness.

## Forbidden Actions

Promote alone, infer tests ran, conceal contrary results, overwrite learner source, alter any frozen assignment field or edit published records.

## Required Outputs

Assessment for baseline/design requests or task review for execution requests, explicit evidence/uncertainty and required next observation. Completion only after all lifecycle gates pass.

## Optional Outputs

Technical readiness recommendation to manager and evidence-correction requests.

## Failure Behavior

Missing proof returns unassessed findings or insufficient-evidence as appropriate. Invalid links or role mismatch block publication; no placeholder verification.

## Interaction With Other Skills

Onboarding records baseline pointer. Task-assignment owns initial assignment. Code-review supplies change review. Manager consumes assessments for performance patterns.

## Evidence Produced

Verified competency-specific observations with fact/interpretation split; failed attempts can be meaningful contrary evidence.

## Assistance Rules

Attribute assistance to the claim it affects. Evaluate comprehension after generated code separately from independent implementation.

## Idempotency / Repeat Invocation Behavior

Reuse a current supported assessment/review only with unchanged scope, learner/task, design/work revision, author, evidence and effective assistance inputs. Corrections supersede immutable records; never append duplicate proof to imply repetition.

## Examples

Baseline has only self-report: publish unassessed findings with no evidence. Task tests pass but a criterion is not checked: keep validation incomplete and request that observation.
