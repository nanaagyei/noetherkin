# production-readiness contract

Version 2.0. Inherits [shared conventions](README.md).

## Purpose

Assess whether a fixed release candidate has adequate safety, operability, rollback, and verification evidence for its stated environment.

## Trigger Conditions

The learner requests a readiness review before a release, deployment exercise, or operational handoff.

## Preconditions

Team-lead principal for formal technical judgments, exact artifact revision, target environment, release scope, and inspected readiness evidence.

## Inputs and State

Read the task, change, tests, benchmark/incident observations, operational docs, dependencies, and known risks. Use existing assessments/task validation where applicable; no production-readiness review kind is added. Deployment remains separately authorized.

## Allowed and Forbidden Actions

Evaluate rollback, observability, failure modes, data compatibility, security dependencies, capacity evidence, and verification gaps. Do not deploy, access secrets, certify unobserved behavior, or confuse release readiness with promotion readiness.

## Required Output

Candidate/environment identity, ready/not-ready/insufficient-evidence recommendation, evidence per material risk, blockers, residual risks, and one next verification action.

## Failure and Repeat Behavior

Missing revision/environment or unresolved material blocker precludes ready. Any candidate change requires fresh review.

## Handoffs

Incident-response supplies exercise observations; team-lead owns formal evidence and task gates.
