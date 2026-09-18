# Assistance levels

| Level | Meaning | Example boundary |
| --- | --- | --- |
| 0 | Independent | Learner chooses and executes an approach without task-specific help |
| 1 | Documentation/navigation | Point to relevant documentation or source location |
| 2 | Conceptual hint | Name a concept worth investigating |
| 3 | Investigation guidance | Suggest a diagnostic experiment without its answer |
| 4 | Pseudocode | Outline solution steps without executable implementation |
| 5 | Isolated example | Demonstrate a similar, separate problem |
| 6 | Partial implementation | Supply part of the actual change |
| 7 | Full implementation | Supply the actual solution |

Begin with learner understanding and a prediction, then reveal one useful hint. Escalate only after an attempt, a clear blocker, explicit request or urgent authorized work. Respect a demonstrated understanding without repeated gates. Record assistance for humans and tools where practical, including who, when, affected competencies and description. Unattributed help is unknown, never silently level 0. General prior study does not count as task-specific assistance; task-specific copied solutions do.

The config maximum is a default teaching ceiling, not authorization to modify source. A learner can explicitly request greater help; record the request with the event. All source changes still follow scope and repository policies. The highest level is a summary of help relevant to an evidence claim, not an average and not a punishment.

A level-7 implementation may still yield independent test-design evidence if the learner devised those tests without help. Split claims by competency, retaining the full task history. Completion and independence are distinct. Teach-back and failure-case questions can establish comprehension evidence only when the actual learner response is recorded and reviewed.

## Attribution and corrections

Each event has a stable `HELP-` UUID (fixture suffixes allowed), `at` for occurrence, `recorded_at` for disclosure, a registered `recorder`, and a `provider` with kind registered/external/unknown, nullable principal_id and a descriptive label. Registered providers require their retained principal ID; external/unknown providers require null principal_id. Unknown identity does not mean unknown magnitude: an inspected supplied implementation is level 7 even if its provider is anonymous. Event IDs are unique within the canonical workspace ledger; evidence snapshots reuse those IDs and exact event values.

Require at <= recorded_at <= publication; recorder authority is checked at publication. External reports are attributed as reports in the description and require corroboration before independent/strong evidence is claimed. A correction appends a new event with `supersedes` naming the prior event on the same task, never edits/deletes it, and cannot fork or cycle. The original recorder, learner or team lead may correct it; disputed claims stay explicit for team-lead verification. Late disclosure is permitted on terminal tasks without changing status or other fields. The validity projection stales affected evidence and dependent judgments until evidence is corrected and reassessed. Evidence snapshots include effective applicable event heads, not both old and corrected events.

For project-free baseline evidence, team lead records reported assistance directly in the immutable evidence snapshot; there is no fictitious task ledger. Correct it by evidence supersession.

## Independence calibration

A README pointer can preserve independent diagnosis; pointing out the faulty line may reveal the key diagnosis. Naming a concept can preserve independent causal reasoning; supplying the causal explanation cannot prove the learner discovered it. Suggesting an experiment can preserve independent interpretation; supplying the expected answer weakens that claim. An isolated example may teach a technique; copying an isomorphic solution does not demonstrate independent implementation. Reviewers explain which decisions remained the learner's. No assistance number mechanically sets a competency level or penalty.
