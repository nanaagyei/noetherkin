# design-review contract

Version 2.0. Inherits [shared conventions](contract-README.md).

## Purpose

Evaluate an exact learner-authored design revision against a frozen task before implementation.

## Trigger Conditions

A task with a required design gate has a reviewable design artifact.

## Preconditions

Team-lead principal, valid task/project binding, exact design URI and immutable revision, and sufficient learner rationale.

## Inputs and State

Read the frozen assignment, design, source context, assistance, risks, alternatives, tests, and prior checkpoint. In the supported PetClinic flow, use `task submit-design`; otherwise return a proposal. The existing assessment schema is the only formal judgment shape.

## Allowed and Forbidden Actions

Assess problem fit, trade-offs, failure behavior, test strategy, and scope; decide approve, rework, or insufficient-evidence. Do not author the design, approve a different revision, create a new review kind, or advance implementation without the valid checkpoint.

## Required Output

Task/design identity, bounded decision, cited findings, risks, uncertainty, and the next learner action.

## Failure and Repeat Behavior

Missing or stale revision is insufficient evidence. Same task/revision/author/inputs reuses the current supported checkpoint; any design change needs fresh review.

## Handoffs

[architecture](contract-architecture.md) supports trade-off exploration; team-lead governs publication and lifecycle gates.
