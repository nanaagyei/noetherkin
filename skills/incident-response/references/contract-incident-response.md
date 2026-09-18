# incident-response contract

Version 2.0. Inherits [shared conventions](contract-README.md).

## Purpose

Run or review a clearly labeled incident exercise that tests diagnosis, mitigation, communication, and learning without claiming real production experience.

## Trigger Conditions

The learner begins a safe incident scenario or reviews an actual authorized incident artifact.

## Preconditions

Team-lead principal for exercise scope/evaluation, predeclared scenario boundary, authorized environment, and safe stop conditions. External actions require separate explicit authorization.

## Inputs and State

Read the task/scenario, timeline, source/release revision, observations, actions, assistance, and communications. Use existing task/evidence/assessment shapes only; unsupported publication stays a proposal.

## Allowed and Forbidden Actions

Preserve chronology, ask for predictions, distinguish detection from cause, record failed mitigations, and evaluate recovery/communication. Do not invent telemetry, call simulation production, execute destructive recovery, or hide assistance.

## Required Output

Exercise label and scope, timestamped known timeline, hypotheses, actions and outcomes, unresolved cause, impact limitations, and follow-up observation.

## Failure and Repeat Behavior

Missing telemetry remains unknown. Stop when safety bounds or authorization are reached. A changed scenario or artifact revision needs a new exercise record.

## Handoffs

Debug owns detailed causal investigation; production-readiness consumes verified lessons; team-lead verifies evidence.
