# ACP-019: Learner-written session wrap-up

| Field | Value |
| --- | --- |
| Status | `ADOPTED`, 2026-09-29 |
| Date | 2026-09-29 (America/Chicago) |
| Author | Project maintainers, drafted with AI assistance |
| Depends on | ACP-016 (FR-48 map authorship, FR-49 teach-back evidence limit, CF-47 unverified learner claims) |
| Blocks | none |
| Supersedes | none |

> **Adopted.** The authoritative record is Phase 16 in [FOUNDATION_CHANGELOG.md](../../FOUNDATION_CHANGELOG.md),
> not this file.

Agent sessions carry no memory by design; state lives in `.apprenticeship/`. What a learner understood in a session
usually evaporates, because nothing prompts them to write it down, and the next session starts cold. This proposal
adds a session wrap-up to the `teach` contract, in which the learner writes a short reflection in their own knowledge
notes, and has the next session open with it as the learner's claim. It adds no record, field or canonical write.
Tracking issue: #20.

## 1. Contradiction

No normative text is contradicted. This is still an architecture change rather than an implementation detail,
because it adds obligations and a forbidden action to a versioned skill contract and widens what a skill reads at
session start.

The `teach` contract triggers only on conceptual questions:

> Learner asks a conceptual question, makes a prediction, or requests a hint. (`contracts/teach.md:11`, before this
> change)

Its forbidden actions cover the learner's explanation but say nothing about a reflection written at the end of a
session:

> Ghostwrite the learner explanation, turn confidence into evidence, edit assessments or automatically provide a full
> task solution. (`contracts/teach.md:35`, before this change)

The onboarding contract mentions a learning log only as an optional pointer, with no rule for reading it back:

> Learner-authored learning-log pointer and nonbinding project interests. (`contracts/onboarding.md:43`)

The state model already fixes the authority of these notes, and this proposal relies on it unchanged:

> Learner-authored notes, authoritative only for what they literally record. (`docs/architecture/state-model.md:19`)

## 2. Proposed resolution

1. **Trigger.** The `teach` contract gains a session wrap-up, run when the learner ends a session ("let's stop
   here", "wrap up") or when a task gate completes.
2. **Procedure.** The agent asks two or three short questions, one at a time: what the learner learned, what
   surprised them or what they would predict differently, and what they want to understand next. The existing
   teach-back escalation applies to the answers.
3. **Authorship.** The learner writes the entry, conventionally under a dated `## YYYY-MM-DD` heading in
   `.apprenticeship/knowledge/learning-log.md`. The agent may suggest where to write and point out a factual error in
   what the learner wrote. Drafting, completing, rewriting or writing the reflection is a forbidden action, including
   on request, on the same principle as FR-48 for the map. Declining is itself a teaching step: the agent gives the
   questions instead.
4. **Evidence limit.** A wrap-up is not evidence for any technical competency. Like a passed teach-back check it is at
   most weak evidence for `core.technical-communication` (FR-49, restated).
5. **Session start.** Every skill, through the shared runtime guide, reads the latest dated entry after `status` or
   `next` and may open with it ("last time you wanted to understand X"). The entry is the learner's claim, not a
   verified fact, exactly like an unchecked map (CF-47): where it conflicts with source, source wins, the agent says
   so, and the learner corrects their own entry. The agent never rewrites or completes it. The onboarding contract's
   state read names the entry for a returning learner.
6. **CLI.** `noetherkin next` shows the date and first line of the latest dated entry, and `learning_log` in its JSON
   output, or null. It is a read-only derived view, like `map status`.

## 3. Rejected alternatives

- **An agent-written session summary.** It is cheaper for the learner and more complete, but it records what the
  agent thinks the learner learned, and it is exactly the ghostwriting FR-48 and FR-49 exist to prevent. Rejected.
- **A canonical `session` record with a schema.** It would make wrap-ups queryable and validated, but it adds a
  record type, a writer and lifecycle rules for text that is authoritative only for what it literally says. The
  existing learner-note class already has the right authority. Rejected.
- **A wrap-up counted as communication evidence.** It would reward the habit, but a self-written reflection has no
  independent observer, and FR-49 already caps a far stronger signal at weak evidence. Rejected.
- **A mandatory wrap-up before a session may end.** It guarantees the habit, but the learner owns their time and a
  gate on stopping is friction without learning. The wrap-up is offered, never required.

## 4. Version impact

None. No schema, catalog, record field or wire format changes. The `teach` and `onboarding` contracts change text
within their current version, as earlier adopted proposals did. `next --json` gains the additive `learning_log`
field in its `data`, which the documented JSON envelope permits.

## 5. Migration impact

None. Existing workspaces keep their exact bytes and meaning. A workspace without a learning log, or with one that
has no dated heading, behaves exactly as before; `learning_log` is null.

## 6. Conformance

| ID | Setup | Required result | Covered by |
| --- | --- | --- | --- |
| CF-59 | The learner ends a session with no entry for today | Ask one reflection question at a time, suggest a dated heading in the learning log, and neither draft nor write the entry. | *behavioral* P22 |
| CF-60 | A returning learner starts a session with a dated learning-log entry | Open with the latest entry, quoted as the learner's own claim rather than a verified fact, and leave the log untouched. | *behavioral* P23; `tests/learning-log.test.ts` |
| FR-64 | The learner asks the agent to write their learning-log entry | Decline to author, draft or write it, and give the wrap-up questions instead. | *behavioral* A24 |
| FR-65 | The latest entry makes a claim that source does not support | Treat it as the learner's claim; source wins; the learner corrects their own entry; the agent neither confirms the claim nor rewrites the log. | *behavioral* A25 |

Each behavioral case was run live once per host (Codex and Claude Code) on 2026-09-29, and all eight executions have
passing reviews confirmed by the project owner. One execution per host is smoke evidence, not a reliability measure.

## 7. Open questions

1. **Entry format.** Only dated `## YYYY-MM-DD` headings are recognized. Whether to accept other date forms, or to let
   `next` show more than the first line, is left open until learners have used it.
2. **Task-gate trigger.** The contract lets a completed task gate start a wrap-up, but no command prompts it. Whether
   `next` should suggest a wrap-up after task review is left open.
3. **Signal strength.** Whether reading a prior entry back measurably improves the next session is unmeasured.
