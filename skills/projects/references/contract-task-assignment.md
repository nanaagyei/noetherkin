# task-assignment contract

Version 2.0. Inherits [shared conventions](contract-README.md).

## Purpose

Create a testable assignment without disclosing its solution.

## Trigger Conditions

Learner requests next work or manager recommends a scope adjustment.

## Preconditions

Team-lead principal, valid selected project, complete onboarding and baseline. Proposed work fits learner goals and safe authorized environment.

## Inputs

Problem or learning need, project context, target competencies, observed capability, constraints and manager recommendations if present.

## State Read

Project snapshot, profile, existing tasks, relevant evidence/assessments/reviews and catalog rubric.

## State Written

One task initially at backlog, then assigned with append-only transitions. Owns initial problem, criteria, constraints, scope and waiver decisions.

## Allowed Actions

Define TRAINING (simulated exercise), PRODUCT (learner-local product improvement) or UPSTREAM (intended contribution, no submission authorization). Set unique criterion IDs, test expectations and investigation areas. Where the choice is otherwise open, use the advisory attention view (see [selection model](selection-model.md)): prefer one assignment that genuinely exercises several high-attention competencies over several narrow ones, prefer high-attention competencies from dissimilar domains within one assignment, and when a high-attention competency is blocked by a missing prerequisite, prefer unblocked frontier work and name the gap so the learner decides whether to detour.

## Forbidden Actions

Include a solution, invent upstream demand, promise contribution acceptance, change any frozen assignment field or promote a learner. List a competency the work does not genuinely exercise, whatever the attention ordering recommends; that is fabricated scope. Treat the advisory view as evidence, as a gate, or as a substitute for the team lead's assignment decision.

## Required Outputs

Complete schema-valid task proposal or assigned record; why scope fits, learner investigation prompt and explicit waiver rationales if applicable.

## Optional Outputs

Backlog alternatives and a recommendation to inspect missing prerequisites.

## Failure Behavior

Unclear problem/impact: needs-input with the smallest design question. Unsupported competency or inconsistent binding: blocked without writing a partial task.

## Interaction With Other Skills

Manager recommends priorities. Peer/teach support work. Team-lead contract owns execution gates and acceptance after assignment.

## Evidence Produced

Assignment itself produces none. Task references later observations without promising a level outcome.

## Assistance Rules

Before implementation, ask the learner to predict behavior and articulate approach, tradeoffs and failure cases appropriate to task stakes.

## Idempotency / Repeat Invocation Behavior

Existing equivalent assignment under the same operation returns its ID. Deliberate similar practice uses a new task and explains the new context.

## Examples

TRAINING task asks learner to map a service boundary with cited source and a failure case; it does not provide the map. A new acceptance criterion after assignment requires a replacement task.
