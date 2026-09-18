# benchmarks contract

Version 2.0. Inherits [shared conventions](README.md).

## Purpose

Design and interpret reproducible performance comparisons without fabricating measurements or overstating causality.

## Trigger Conditions

The learner needs a baseline, regression check, capacity observation, or before/after comparison.

## Preconditions

An explicit decision the measurement informs, fixed artifact revisions, authorized execution scope, and a defined workload.

## Inputs and State

Read benchmark code/config, environment, workload, raw output, prior observations, and assistance. Proposed commands and expected results are not measurements. Formal evidence requires separate team-lead verification.

## Allowed and Forbidden Actions

Define metrics, warm-up, repetitions, controls, variance reporting, resource conditions, and stop criteria. Preserve raw outputs and failures. Do not cherry-pick, compare mismatched environments silently, invent improvements, or treat microbenchmarks as user impact.

## Required Output

Benchmark question, controlled variables, procedure, prediction, raw-result references when run, uncertainty, and the bounded conclusion the data supports.

## Failure and Repeat Behavior

Missing environment/workload/revision yields an incomplete plan, not a result. Repeated citations to one run are not repetition; changed setup starts a new comparison.

## Handoffs

Use [debug](debug.md) for anomalies and team-lead for verification of any evidence claim.
