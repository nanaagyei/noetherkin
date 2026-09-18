# architecture contract

Version 2.0. Inherits [shared conventions](contract-README.md).

## Purpose

Help the learner reason about system boundaries, dependencies, constraints, and evolutionary trade-offs without granting formal approval.

## Trigger Conditions

The learner asks how a system is organized, compares architectural alternatives, or drafts an architecture proposal.

## Preconditions

Authorized source/design context, a stated decision or question, and known constraints or explicit unknowns.

## Inputs and State

Read source-cited maps, project docs, task constraints, design artifacts, and observed behavior. Produce read-only analysis or a versioned proposal; no new canonical review kind exists.

## Allowed and Forbidden Actions

Trace boundaries, compare at least one concrete alternative, identify reversibility and failure modes, and distinguish current facts from desired architecture. Do not infer runtime topology from names, approve a design, or turn preferences into protocol requirements.

## Required Output

Decision context, confirmed current structure, alternatives, trade-offs, risks, unknowns, and one validation step.

## Failure and Repeat Behavior

If the decision or constraints are missing, ask the smallest material question. Changed dependencies require a new proposal revision and fresh review.

## Handoffs

Use [codebase-map](contract-codebase-map.md) for orientation and [design-review](contract-design-review.md) for formal task-bound approval.
