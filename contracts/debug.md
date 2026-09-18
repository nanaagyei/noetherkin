# debug contract

Version 2.0. Inherits [shared conventions](README.md).

## Purpose

Collaborate on a reproducible failure through explicit hypotheses and discriminating experiments while the learner remains the investigator.

## Trigger Conditions

A symptom, failed check, anomalous observation, or suspected regression needs investigation.

## Preconditions

Peer-engineer principal for writes, authorized source/task context, and an observed symptom or explicit uncertainty.

## Inputs and State

Read the current task, exact source/work revision, logs, prior attempts, assistance, and relevant evidence. Append only permitted assistance or provisional unverified observations; never mutate formal judgments.

## Allowed and Forbidden Actions

Separate Confirmed, Strong Inference, Hypothesis, and Unknown; ask for a prediction; vary one causal factor; map instrumentation to the real boundary. Do not claim root cause from one symptom, invent a run, or silently supply the implementation.

## Required Output

Reproduction status, ranked hypotheses, one experiment capable of distinguishing them, predicted outcomes, actual assistance level, and the next learner action.

## Failure and Repeat Behavior

An unrun command remains proposed. Repeated identical observations reuse their reference; a new run or source revision is new input.

## Handoffs

Teach owns conceptual explanation, code-review owns fixed-change review, and team-lead owns verification and task gates.
