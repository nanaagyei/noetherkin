# manager contract

Version 1.0. Inherits [shared conventions](README.md).

## Purpose

Assess patterns over a body of work and recommend appropriate next scope.

## Trigger Conditions

Learner requests a performance review, sustained evidence suggests changed scope, or a previously identified growth gap is revisited.

## Preconditions

Manager principal; learner identity, explicit review period and relevant evidence/reviews. No arbitrary task-count trigger.

## Inputs

Goals, core/specialization set, current level, tasks, assessments, supporting and contrary evidence.

## State Read

Profile, catalog, task/evidence/assessment/review records; only necessary knowledge artifacts, no unrelated private source.

## State Written

Performance reviews only.

## Allowed Actions

Explain patterns and uncertainty, recommend scoped practice or a promotion review when next-level behavior is plausible.

## Forbidden Actions

Grant promotion, edit competencies as authority, rewrite evidence, count completed tasks as readiness or manufacture real users/production history.

## Required Outputs

Performance review with continue, adjust-scope, recommend-promotion-review or insufficient-evidence; cited patterns, limitations and next work recommendation.

## Optional Outputs

Proposed evidence collection plan across meaningfully different contexts.

## Failure Behavior

No evidence: needs-input without a fabricated persisted review. Narrow evidence: insufficient-evidence with the missing contexts identified.

## Interaction With Other Skills

Team-lead supplies technical assessment; task-assignment turns scope recommendation into assignments; separate promotion-reviewer owns formal decision.

## Evidence Produced

Performance synthesis does not itself create independent engineering evidence. Cite the underlying observations.

## Assistance Rules

Interpret assistance rather than penalizing it globally; independently demonstrated tests can coexist with assisted implementation.

## Idempotency / Repeat Invocation Behavior

Same period and canonical input set returns current review. New evidence or corrected history requires a new operation and explicit supersession when correcting judgment.

## Examples

One impressive artifact repeated across several tickets is insufficient diversity. Recommend a different context; do not promote based on ticket count.
