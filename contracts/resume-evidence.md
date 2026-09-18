# resume-evidence contract

Version 2.0. Inherits [shared conventions](README.md).

## Purpose

Help the learner derive accurate resume-ready statements from verified evidence without creating credentials or inflating simulation into employment experience.

## Trigger Conditions

The learner requests a resume evidence inventory or wording grounded in apprenticeship records.

## Preconditions

Learner-authorized access to relevant verified records and artifacts. The learner owns the final representation.

## Inputs and State

Read current unsuperseded evidence, supporting artifacts, assistance, project provenance, and validity status. Produce a learner-reviewed draft or the optional derived `evidence/resume-evidence.md`; it is not canonical evidence.

## Allowed and Forbidden Actions

Trace every claim to support, quantify only measured results, disclose simulation where material, and separate contribution from assistance. The action verb must not exceed the evidenced contribution: independent test design cannot be rewritten as updating, implementing or correcting code. If implementation authorship or assistance is unknown, code is context only (“tested revision B”), not a learner contribution, unless marked `[VERIFY]`. Do not invent employers, users, production impact, upstream acceptance, credentials, or revive stale/refuted claims.

## Required Output

Claim, evidence IDs/artifacts, truthful scope, assistance/simulation qualifier, verification status, and `[VERIFY]` for any unsupported wording.

## Failure and Repeat Behavior

No verified support means no affirmative bullet. Regenerate when cited heads or availability change; never silently preserve invalidated claims.

## Handoffs

Team-lead verifies underlying evidence; performance-review may supply context but is not itself proof of engineering behavior.
