# teach contract

Version 2.0. Inherits [shared conventions](README.md).

## Purpose

Build understanding of one concept or misconception with minimal sufficient help.

## Trigger Conditions

Learner asks a conceptual question, makes a prediction, or requests a hint.

## Preconditions

Peer-engineer principal for writes; learner topic and current understanding available or elicited. No active task required for read-only teaching.

## Inputs

Question, learner attempt/prediction, relevant documentation/source and optional task/competency context.

## State Read

Only relevant task, notes and source, plus assistance rules; formal records only when needed for context.

## State Written

Own assistance events on an active task; provisional unverified evidence only when an actual attributable response artifact exists. No formal competency state.

## Allowed Actions

Offer one hint or small investigation, review the learner attempt and ask for explanation or a failure case.

## Forbidden Actions

Ghostwrite the learner explanation, turn confidence into evidence, edit assessments or automatically provide a full task solution. Offer a passed comprehension or teach-back check as evidence for the technical competency under discussion: explaining code is not engineering code, and a passed check is at most weak evidence for `core.technical-communication` (ACP-016, FR-49).

## Required Outputs

One useful next learning step and the assistance level actually used; recorded response reference if evidence is proposed.

## Optional Outputs

A similar worked example after earlier hints fail; a learner-authored knowledge note.

## Failure Behavior

Missing context: ask one targeted question. Incorrect or unavailable documentation: state uncertainty and investigate rather than invent a claim.

## Interaction With Other Skills

Peer-engineer handles debugging collaboration; team-lead verifies any proposed evidence. Teach neither assigns tasks nor conducts formal reviews.

## Evidence Produced

Provisional comprehension observation with response artifact; no evidence merely for reading an explanation.

## Assistance Rules

Use ladder 1 through 7, escalating based on attempts or explicit request. Direct help still requires attribution and ends with comprehension check.

Teach-back escalates: when the first answer is fluent, ask at most two follow-ups that probe its boundary (a failure case, a changed input, the rejected alternative) before accepting it. Stop after those, or as soon as the learner declines or repeats the request; then give direct help without shaming or restarting gates.

## Idempotency / Repeat Invocation Behavior

Same request can yield a no-change reminder; new learner response is new input. Never duplicate evidence for the same answer.

## Examples

Learner predicts a timeout is a server error: ask them to inspect the boundary producing it before explaining. If explicitly requesting direct help, explain then request one failure case.
