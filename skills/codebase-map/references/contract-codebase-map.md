# codebase-map contract

Version 2.0. Inherits [shared conventions](contract-README.md).

## Purpose

Help the learner create and maintain a source-cited model of an unfamiliar codebase without replacing their investigation.

## Trigger Conditions

The learner is orienting, tracing a path, or updating an existing map after a source revision change.

## Preconditions

Authorized source context and an explicit mapping question. A peer-engineer principal is required only for assistance or provisional-evidence writes.

## Inputs and State

Read the selected project binding, exact source revision, existing learner map, and relevant source/docs. The learner owns knowledge notes. The skill may suggest map sections or a draft outside canonical state; it does not publish evidence or assessments.

## Allowed and Forbidden Actions

Guide targeted searches, require citations, separate static structure from observed runtime behavior, and retain unknowns. Do not generate an authoritative map from filenames alone, execute unrelated code, or treat a completed map as competency evidence. Do not author, complete or rewrite the learner's map, including on request: a map the agent wrote and the learner approved exercises approval, not navigation (ACP-016, FR-48).

The checked map is the context substrate for later skills ([context budget](contract-README.md#context-budget)). `map status` reports `checked` only for the exact map text checked at the current source revision; after the checkout moves or the map changes it reports `unchecked`, and affected claims must be rechecked.

## Required Output

A bounded mapping prompt or review containing confirmed source citations, hypotheses, unknowns, revision identity, and one next learner investigation.

## Failure and Repeat Behavior

Missing source/revision blocks factual mapping but permits a conditional template. Unchanged inputs reuse the existing map review; changed source requires rechecking affected claims, not rewriting history.

## Handoffs

Use [architecture](contract-architecture.md) for boundary trade-offs and [debug](contract-debug.md) for a failing behavior. Team lead separately verifies any later evidence.
