# Authoring a forge

A forge is a first-party specification that a learner builds from an empty directory. This repository ships the specification and a task pack, never a solution. This guide explains what makes a good forge and how to check one before you open a pull request. The rules it describes already exist in the catalog loader and the foundation validator; `noetherkin forge check` applies them to your directory and reports every problem at once.

The annotated example throughout is [Eval Ledger](../catalog/forge/eval-ledger.yaml) and its pack in [`tasks/forge/eval-ledger-core/`](../tasks/forge/eval-ledger-core/).

## Quick start

```sh
noetherkin forge new water-ledger my-forge --track ml-engineering
noetherkin forge check my-forge
```

`forge new` writes two files that mirror the repository layout, so the directory can be copied into a checkout unchanged:

```text
my-forge/
  catalog/forge/water-ledger.yaml
  tasks/forge/water-ledger-core/01-first-task.json
```

Every field is present. The content you must write is a `TODO` marker, and the first `forge check` lists only those markers, one problem per file. Replace them, add the remaining tasks, and run the check until it reports no errors. Errors fail the check. Warnings flag authoring smells a reviewer will ask about; they do not block. Run `forge check .` at a checkout root to check every shipped forge.

## What a forge is for

A forge takes a learner from E0 toward E2 by building something real that someone other than them can use. It is not an exercise. Three properties distinguish it:

- **Built from empty.** There is no upstream codebase and no starter code. The learner creates the repository and owns every design decision inside the specification's constraints. A pack directory holds task JSON only; any other file is treated as possible solution code and rejected (FR-45).
- **Operable, not merely correct.** The operational requirements (failure modes, observability, rollback, documentation) are what give production readiness something to assess.
- **Honest about what it teaches.** A forge's competencies are exactly what its tasks exercise, and each track it aligns to must require at least one of them.

## Choose a problem with a real failure mode

State the problem as a situation in which something goes wrong, not as a feature list. Eval Ledger's problem is that "is this better than before" gets answered from memory because nobody keeps per-case history. That sentence tells the learner what failure the system exists to prevent, and every success criterion traces back to it.

A good problem has at least one failure a careless implementation will hit. In Eval Ledger, a target that raises on one case must not lose the other results, and a malformed case file must refuse to run rather than produce a misleading comparison. If you cannot name such a failure, the problem is probably an exercise.

List `non_goals` generously. They bound the work so it fits the context budget, and they stop a reviewer from asking for features the specification never promised.

## Success criteria a stranger can verify

Each success criterion is an observable property of the finished system, paired with `verifiable_by`: the action an outside reviewer takes to confirm it without trusting a claim.

| Weak | Strong (Eval Ledger SC-2) |
| --- | --- |
| "Runs are stored safely." | "A run produces an immutable record ... A later run never overwrites an earlier one." Verifiable by: "Run twice. Two records exist. The first is byte-identical to what it was before the second run." |

If the only way to check a criterion is to read the learner's code or take their word for it, rewrite it.

## Operational requirements

- **failure_modes:** each failure with the required behavior. Say what the system does instead of failing silently.
- **observability:** what an operator can see without a debugger.
- **rollback:** the actual procedure for undoing a bad change. "Not applicable" is not accepted; Eval Ledger explains that immutable records make rollback a rerun, and names the one destructive action.
- **documentation:** what someone else needs to run it, usually a README quickstart and an operations note.

## Size the pack as four tasks

A pack is ordered. Files are named `NN-<slug>.json` and numbered 1..n with no gaps. Four tasks usually fit this shape:

1. **Data inspection or contract.** Define and validate the input boundary (Eval Ledger: declare the case set as data and refuse a bad one).
2. **Core behavior.** The smallest useful system (run the cases and record the run immutably).
3. **The hard part.** Where the real failure mode lives (compare two runs per case).
4. **Operability.** Documentation, observability, and a check by someone other than the learner.

Each task says what it deliberately does not do yet, as a constraint, so the learner cannot drift into the next task. Every task names its pack and forge (`pack_id`, `forge_id`) and carries a `next_task_preview` except the last, whose preview is `null`.

## Acceptance criteria

Criteria are observable against an artifact: a test run, a document, a record. Every task includes:

- **`AC-tests`**: automated tests cover the behavior and pass at the submitted revision.
- **`AC-explanation`**: the learner explains the choice they made, one rejected alternative, and what breaks first. This is how a reviewer checks comprehension rather than output. `forge check` warns when a task lacks one.

### When to use `attested_criteria`

Some criteria can only be satisfied by another person, such as "Someone other than the learner performs the quickstart without assistance." No artifact the learner produces alone can satisfy that, so list the criterion ID in the task's `attested_criteria`. The learner then records the outside check with `noetherkin task attest --criterion <id> --file <notes>`, and task review requires the attestation. `forge check` warns when a criterion's text mentions another person but nothing attests it, and rejects an attested ID that is not one of the task's criteria.

## Constraints every task carries

- **No pushing.** Every task forbids pushing to a remote, for example "Do not push to a remote or open a pull request as part of this task."
- **No publishing.** At least one task, usually the last, where the work first becomes shippable, forbids publishing or deploying: "Do not push to a remote, publish a package or deploy anything as part of this task."

The learner's work stays local; sharing it is the learner's decision, made outside the simulation.

## Choose competencies honestly

List a competency on a task only if the task genuinely exercises it. The forge's `competencies` must equal the union of its tasks' primary and secondary competencies: `forge check` names anything declared but unexercised, or exercised but undeclared. At assignment, a task claiming a competency its template does not exercise is rejected as fabricated scope (FR-41), so over-claiming here only produces work that cannot count.

`track_alignment` lists the tracks the forge serves. Each one must require at least one of the forge's competencies; `noetherkin track show <track-id>` lists them. Drop a track rather than inflate the competency list to reach it.

## The context budget

`context_budget.source_tokens_target` is the target size of the finished source, excluding what you list under `excludes`. It forces scope discipline on the specification: a system the learner can hold in context is one they can hold in their head. It is advisory, never an acceptance criterion, and no task fails for exceeding it. Eval Ledger uses 15,000 tokens; revise against ACP-016 measurements when you have them.

## Status, identity and caveats

- A new forge is `draft`. Maintainers promote it to `supported` after review.
- The forge ID is lowercase words joined by hyphens, matches the file name, and must not collide with a catalog project, since the two share one selection namespace. Pack and task IDs must not collide with another forge's; name them after your forge (`<id>-core`, `<id>-01-<slug>`).
- Keep the standard caveats `forge new` writes, and add any specific to your problem (Batch Ingest notes that its data is synthetic).
- `sources` may be empty for an invented problem. An entry claims a real need and must be checkable.

## Checklist

`forge check` enforces the errors; review the rest yourself.

| Check | Enforced |
| --- | --- |
| Record and every task match their schemas; tasks are in template form | error |
| No `TODO` markers remain | error |
| Forge ID matches its file name; no collision with a project or another forge's pack or task IDs | error |
| Every competency resolves in the catalog | error |
| Every aligned track resolves and requires at least one of the forge's competencies | error |
| Forge competencies equal the union of the tasks' competencies | error |
| Tasks numbered 1..n, file prefixes match, each names its pack and forge | error |
| Pack holds only `.json` files | error |
| Every attested ID is one of the task's criteria | error |
| Every task forbids pushing; some task forbids publishing or deploying | error |
| A new forge is `draft` | error |
| A criterion needing another person is attested | warning |
| Every task has `AC-explanation` | warning |
| Every pack directory is listed by a record | warning |
| The problem names a real failure mode; success criteria are verifiable by a stranger | review |
| Rollback is an actual procedure; non-goals bound the work | review |
