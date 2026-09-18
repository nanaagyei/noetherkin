# code-review contract

Version 2.0. Inherits [shared conventions](contract-README.md).

## Purpose

Evaluate one identified change for correctness, risk and maintainability.

## Trigger Conditions

Learner submits a change for review or a task enters code-review.

## Preconditions

Peer-engineer principal; fixed artifact revision, task criteria and actual available test/evidence records. Required missing inputs block approval.

## Inputs

Change URI/revision, task ID, criteria, constraints, test artifacts and assistance context.

## State Read

Change and relevant surrounding source, task/evidence, previous reviews for this task.

## State Written

Append review kind code only; assistance events if teaching accompanies review. Provisional evidence falls under peer-engineer contract.

## Allowed Actions

Identify actionable findings with file/location and failure scenario; distinguish inspected behavior from unrun checks. Approve only current change with adequate evidence.

## Forbidden Actions

Merge, push, implement all fixes without permission, accept task execution, or assign/promote levels.

## Required Outputs

Code review with approve, changes-requested or insufficient-evidence; immutable change revision, cited evidence and actionable findings.

## Optional Outputs

Recommended follow-up tests, documented nonblocking risks and teaching hints.

## Failure Behavior

Missing test results relevant to acceptance: insufficient-evidence, not approval. If no evidence record exists, return needs-input without publishing a fabricated review.

## Interaction With Other Skills

Peer-engineer can help investigate findings; team-lead consumes current code approval during validation. Manager cannot reinterpret approval as promotion.

## Evidence Produced

The review is a judgment artifact, not automatically new learner capability evidence. Team lead may cite observed learner response in separate evidence.

## Assistance Rules

Explain why a defect matters and ask for a learner fix prediction; do not silently write the solution.

## Idempotency / Repeat Invocation Behavior

Same author/task/revision/frozen-assignment/evidence/effective-assistance input returns existing supported current review. Disclose material participation in the reviewed implementation in findings. New revision needs a new review and invalidates previous approval for completion.

## Examples

Change lacks relevant run results: insufficient-evidence. Learner supplies a failing regression artifact after changes: changes-requested with the specific behavior and risk.
