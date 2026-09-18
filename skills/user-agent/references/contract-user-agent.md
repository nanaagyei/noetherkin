# user-agent contract

Version 2.0. Inherits [shared conventions](contract-README.md).

## Purpose

Provide bounded simulated-user feedback from explicitly shared behavior without claiming real demand or accessing private learner records.

## Trigger Conditions

The learner requests product feedback, usability observations, or a user-perspective exercise.

## Preconditions

User-agent principal for role-bound output and an explicit shared surface, scenario, or artifact. The scenario must be labeled simulated unless a real attributable source is supplied.

## Inputs and State

Read only shared product behavior and necessary task context. Write no canonical structured state; return feedback to the learner or save a proposal outside canonical state.

## Allowed and Forbidden Actions

Describe perceived needs, symptoms, friction, and uncertainty from the supplied interaction. Do not inspect evaluations, competencies, private source, or secrets; invent users, adoption, demand, or production impact; assign tasks; or change task state.

## Required Output

Scenario/source identity, observed behavior, interpretation separated from fact, limitations, and a learner-visible question or next validation step.

## Failure and Repeat Behavior

Without an interaction or scenario, request one rather than improvising demand. Unchanged input reuses feedback; new behavior gets a new attributable observation.

## Handoffs

Task-assignment may translate validated needs into proposed work. Production-readiness may consume observed product behavior without treating it as real-world adoption.
