# Lifecycle and task transitions

Simulation phases are derived from persisted prerequisites, not a second status machine. Config mode `paused` permits reads and learner-authorized resume only; `archived` is read-only. Resuming archived state requires an explicit learner mode change. Mode changes never imply completed work.

| Phase | Gate, responsibility and skill | State written / next phase |
| --- | --- | --- |
| INITIALIZE | Learner requests workspace; onboarding coordinator checks absence/conflicts | Config, pending profile, null project, empty derived competencies; ONBOARD |
| TRACK SELECTION | Learner explicitly chooses one advisory track | Pinned pending current-track; ONBOARD |
| TRACK ALIGNMENT AFTER SWITCH | Learner authorizes exact new scope; team lead assesses it longitudinally; manager reviews it | Pending remains on objection; profile/current-track align atomically only after `continue` |
| ONBOARD | Onboarding records goals, environment constraints, teaching preferences and selected track | Profile complete only after learner confirmation; BASELINE |
| BASELINE | Team lead reviews evidence or explicitly records unknowns | Baseline assessment and profile pointer; PROJECT SELECTION |
| PROJECT SELECTION | Projects offers track-grouped catalog candidates; learner chooses | Pinned project and current-project; TASK ASSIGNMENT or portable assignment handoff |
| TASK ASSIGNMENT | Team lead creates scoped task with acceptance criteria | Assigned task; INVESTIGATION |
| INVESTIGATION | Learner inspects source, predicts behavior; teach/peer assist | Notes and assistance events; DESIGN or IMPLEMENTATION |
| DESIGN WHEN NEEDED | Learner defends approach and alternatives; team lead reviews risks | Design artifact; IMPLEMENTATION |
| IMPLEMENTATION | Learner authors change; peer assists progressively | Source artifacts only with authorization, assistance history; TESTING |
| TESTING | Learner predicts then runs appropriate checks | Actual results and evidence, including failures; CODE REVIEW or VALIDATION |
| CODE REVIEW | Peer reviews an identified artifact revision | Code review; VALIDATION or rework |
| VALIDATION | Team lead checks acceptance criteria against actual artifacts | Task validation entries; TASK REVIEW or rework |
| TASK REVIEW | Team lead evaluates execution with evidence | Task review; EVIDENCE RECORDING or rework |
| EVIDENCE RECORDING | Team lead verifies provenance and completion references | Evidence, completion IDs, completed status; NEXT WORK |
| NEXT WORK | Manager and learner choose next scope | New assignment, project switch or PERFORMANCE REVIEW |
| PERFORMANCE REVIEW | Manager examines a body of evidence | Performance review; next work or PROMOTION REVIEW |
| PROMOTION REVIEW WHEN WARRANTED | Distinct promotion reviewer, technical input and learner authorization | Promotion review; increased scope only following PROMOTE |

Baseline may be an assessment with all findings `unassessed`; this records missing information without pretending an evaluation succeeded. A valid existing baseline can be reused. Onboarding can resume, but cannot be skipped without its recorded completion. Performance and promotion reviews are optional between tasks and never required at arbitrary task counts. Increased scope may be a training experiment without a promotion, but cannot change effective level.

## Canonical task transition table

| From | Allowed next states | Gate |
| --- | --- | --- |
| backlog | assigned, cancelled | Team lead assigns after prerequisites; cancellation reason required |
| assigned | investigating, cancelled | Learner begins investigation |
| investigating | designing, implementing, cancelled | Skip designing only if `design_required: false`, with reason |
| designing | implementing, investigating, cancelled | Learner design artifact and team-lead technical assessment before implementation |
| implementing | testing, investigating, cancelled | Changed artifact identified; return for new uncertainty |
| testing | code-review, validating, implementing, cancelled | Results recorded; validating shortcut requires `code_review_required: false` and reason |
| code-review | validating, implementing, investigating, cancelled | Review change URI/revision equals task work_artifact and is approved before validating |
| validating | task-review, implementing, investigating, cancelled | Every acceptance criterion passes with an inspected artifact, checked_at and work_revision matching the current deliverable |
| task-review | evidence-recording, implementing, investigating, cancelled | Current task review accepted with evidence |
| evidence-recording | completed, task-review, cancelled | Completion bundle checks below |
| completed | none | New follow-up task for defects or changed scope |
| cancelled | none | Reason retained; cancellation proves no success |

A task is created at backlog with first history entry `from: absent, to: backlog`. Each subsequent history entry must match the previous state; last `to` equals current status and timestamps do not decrease. `blocked_reason` overlays any nonterminal state and prevents forward advancement until cleared with an explained transition (a self-transition is allowed solely to set/clear this flag). Reads and assistance may continue while blocked. Cancellation remains permitted. Terminal tasks cannot be blocked.

The learner may advance investigating/designing/implementing/testing phases along allowed edges; team lead controls assignment, review gates, completion and cancellation (learner requests cancellation). All role actions appear in history. Default both design and code review to required; team lead may waive design for bounded changes without architectural/data/security impact, and code review only for work with no source/config behavior change. Waivers are justified in constraints before assignment. Testing means checking the work's acceptance criteria; a documentation task can use source citation checks rather than executable tests.

Completion requires every criterion to pass, nonempty verified completion evidence for this task, a current accepted task review whose change URI/revision matches work_artifact and publication follows the validation checks, and a current approved code review if required. New source revisions invalidate earlier review/validation gates. Evidence can and should be recorded throughout work: the final phase reconciles references, so reviews never depend on evidence that only exists after completion. A completed task may contain contrary evidence and may produce no demonstrated competency.

Project switching is allowed only with no nonterminal task on the old project except backlog or explicitly blocked work. Historical project bindings remain intact. Returning to blocked work requires reselecting that project and checking the source revision. V1 permits multiple tasks in the workspace but advancement only on the selected project.

## Design gate binding

A required design gate uses task.design_artifact and task.design_assessment_id. The referenced assessment must be a current, supported technical checkpoint for this learner, project and task, with design.artifact URI/revision exactly matching task.design_artifact and design.decision approve. The team lead publishes it after inspecting the learner's design and before the implementing transition. Rework or insufficient-evidence cannot open the gate. An unrelated assessment, longitudinal finding, superseded approval or old design revision fails the gate. The task stores null design fields before design exists; no design decision may be inferred from demonstrated competency. A design waiver is frozen before assignment.

One concise interaction and ordered atomic publication may satisfy several administrative gates when all role bindings, predecessor records and timestamps remain valid. This does not let one actor forge another role. Documentation-only work may use justified preassignment waivers and source citation checks. Aggregate competency assessments and performance reviews are milestone-driven, not mandatory per task; corporate roleplay is optional.
