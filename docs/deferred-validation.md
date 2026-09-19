# Deferred validation after the Phase 6 pilot

This document separates Phase 6 acceptance from the older high-token behavioral matrix. None of the runs below is a prerequisite for moving to the next implementation phase after one genuine PetClinic pilot succeeds.

## Completed: Phase 6 real-model integration pilot

On 2026-09-17, the locally packed CLI completed a real-model integration pilot against Spring PetClinic Microservices `v3.4.1`, resolved commit `f9fd559361f11b79e622ee0c0c660f42980a36ac`. The focused command `./mvnw -pl spring-petclinic-customers-service test` passed five tests with no failures, errors or skips. The exact change received an approved peer code review, the team lead atomically completed TASK-001 with two verified evidence records, `next` displayed the gateway-focused TASK-002 preview, and the manager published `continue` without promotion. A fresh CLI process returned `validate: success` with `coverage: simulation`, E0 standing and a terminal `COMPLETE` phase. Task and performance review retries returned `no-change` with the original IDs.

The pilot exposed and corrected three runtime integration defects without weakening validation:

- The Codex adapter originally supplied only result key names. It now supplies explicit closed shapes, enum choices and cardinality requirements.
- The code-review packet omitted the learner-design contents. It now includes the exact content-addressed design.
- The task-review packet omitted the exact design and change contents. It now includes both, alongside the approved code review and observed test run.

Malformed model output, an insufficient-evidence code review, a team-lead rework decision and an empty-findings candidate were all rejected or retained through normal lifecycle paths. The empty-findings candidate failed full candidate validation before canonical publication and left no pending checkpoint. A sandbox-only Mockito attachment failure was stored as failed test evidence; an exact retry for the same change digest passed outside that restriction.

This was intentionally converted to demonstration mode at the learner's request. The learner authored the codebase map, but Codex authored the design, implementation and focused tests outside the formal `task help` path. Consequently, the canonical records demonstrate runtime integration and recovery behavior but must not be cited as evidence of learner independence, learner competency or educational effectiveness.

## Deferred: genuine learner-authorship pilot

If learner-experience acceptance is required later, repeat the journey in a new workspace with the learner authoring the map, design, implementation, tests and failure explanation. Codex should be invoked only for the all-unassessed baseline, design review, code review, task review and performance review. Peer help is optional and must be requested and attributed through `task help`.

Acceptance requires `validate` to return `coverage: simulation` after restart, an accepted completed task with verified evidence, a visible TASK-002 preview and a canonical manager performance review. Preserve the canonical workspace, `apprenticeship-artifacts/` and command transcript. Do not reuse the demonstration workspace as learner evidence.

## Deferred: A02 manager repetitions

A02 tests whether the manager refuses an unsupported E2 promotion when only two trivial, heavily assisted tasks and no debugging/readiness evidence are supplied. It has three required repetitions per harness:

- Codex: 3 model executions.
- Claude: 3 model executions.
- Complete A02 acceptance: 6 independently retained executions plus completed human review records.

A single Codex A02 execution is a smoke test only. It cannot satisfy the repetition or dual-harness requirement. Previous A02 behavior loaded a large installed skill/reference packet, so this is not considered a low-token substitute for the Phase 6 pilot.

```sh
npm run evals:run -- --out /private/tmp/apprenticeship-a02-codex-smoke --harness codex --case A02
npm run evals:run -- --out /private/tmp/apprenticeship-a02-complete --case A02
```

Use a new output directory whenever implementation, bundles, model selection or suite inputs change. Do not merge results with an older manifest.

## Deferred: complete dual-harness behavioral suite

The Phase 7 suite contains 115 active cases. Five retained high-risk cases run three times, producing 125 executions per harness and 250 across Codex and Claude. It requires privately retained raw transcripts, deterministic integrity checks and completed independent review records for every required result. Partial or harness-only runs do not establish full acceptance. The earlier 118-execution schedule remains historical evidence for the older eight-skill bundles and cannot be combined with Phase 7 results.

Before that full matrix, the bounded Phase 7 smoke schedule runs `P08,A08,P13,A10,P18,A14` once on each harness (12 executions). It is useful integration evidence but cannot establish full behavioral acceptance.

```sh
npm run evals:run -- --out /private/tmp/apprenticeship-full-behavioral-suite
npm run evals:report -- --run /private/tmp/apprenticeship-full-behavioral-suite
```

Run this only when full cross-harness skill calibration becomes the active milestone. Do not run it merely to validate Phase 6 runtime mechanics.

## Still outside automated acceptance

Educational effectiveness requires repeated learner trials and cannot be inferred from unit tests, a model review, or one successful task. Promotion execution remains deliberately unsupported.
