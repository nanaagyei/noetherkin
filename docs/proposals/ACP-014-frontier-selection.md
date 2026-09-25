# ACP-014: Advisory attention signal and frontier-guided selection

| Field | Value |
| --- | --- |
| Status | `ADOPTED`, 2026-09-24 |
| Date | 2026-09-21 (America/Chicago) |
| Depends on | ACP-013 (competency graph), ACP-015 (content to select from) |
| Blocks | none |
| Supersedes | none |

> **Adopted, 2026-09-24.** The authoritative record is Phase 14 in [FOUNDATION_CHANGELOG.md](../../FOUNDATION_CHANGELOG.md)
> and the normative text is [selection-model.md](../architecture/selection-model.md), not this file. It was deferred on
> 2026-09-23 until several packs existed and the graph covered more than one track; four forge packs, the PetClinic
> pack and edges for the frontend, SRE, observability and data competencies now satisfy that condition.

Noetherkin gains a derived, advisory view that answers "what should this learner work on next, and why." It
computes a knowledge frontier from the competency graph, orders competencies by how much attention they
warrant, and feeds task assignment, remediation and baseline probing. It is regenerable, deletable, never
persisted as capability, and never an input to any judgment.

## 1. Contradiction

This proposal contradicts no normative statement, but it sits next to three rules it must not break.

`docs/architecture/state-model.md:44` closes the derivation of the competency cache:

> For each competency, use only unsuperseded **longitudinal** assessment findings, ordered by `created_at`.
> [...] Checkpoints never enter this selection.

The advisory view must be a separate artifact. It must not become an input to that derivation, and it must not
be written into `.apprenticeship/competencies.yaml`.

`docs/architecture/review-model.md:21` forbids mechanical recency:

> Evidence must be recent enough for the claimed capability; the reviewer explains why rather than applying an
> arbitrary expiry window.

`OPEN_QUESTIONS.md:9` (OQ-003) says the same thing from the other direction:

> Reviewer explains recency relative to context and technology changes. Recommend empirical calibration; do not
> invent universal expiry days.

Together these rule out a spaced-repetition schedule with decay constants. This proposal adopts **ordering**
and rejects **scheduling**, which is the significant difference from the system it borrows from.

## 2. Proposed resolution

### 2.1 A separate, non-canonical artifact

The view lives outside the canonical record set, in a file that may be deleted at any time without losing a
decision:

```
.apprenticeship/advisory/attention.yaml
```

Properties, all normative:

- **Derived.** Computed from the competency cache, the published evidence and assessment records, and the
  ACP-013 graph. It holds no fact not derivable from those.
- **Regenerable and deletable.** Its absence must never block work, gate a transition or fail validation.
- **Subordinate.** If it disagrees with `.apprenticeship/competencies.yaml`, the cache wins without argument.
- **Not evidence.** It is cited by no assessment, no review and no promotion packet. It carries `data_class`
  and a generation timestamp so a reader can tell it is stale, but it establishes nothing.
- **Not a score.** It contains an ordering and the reasons for that ordering. It contains no percentage, no
  mastery value, no decay coefficient and no "due date."

### 2.2 Frontier

A competency is **on the frontier** when every ID in its `prerequisites` has a `demonstrated` finding in the
cache, and its own finding is `unassessed` or `developing`.

A competency with no prerequisites is always on the frontier, which is why partial graph authoring under
ACP-013 degrades safely: an unedged catalog puts everything on the frontier, reproducing today's behavior.

A competency whose finding is `contested` is not on the frontier. It is on the remediation list, which is a
separate output, because a contested finding means a contradiction needs explaining rather than more practice.

### 2.3 Attention ordering

Frontier competencies and previously demonstrated competencies are ordered by, in priority order:

1. Whether a prerequisite has become `contested` or stale. A shaky foundation outranks anything built on it.
2. How long ago the most recent cited evidence was observed, taken from evidence record `fact` timestamps.
3. How few materially different contexts the competency has been demonstrated in. This reuses the standard
   `review-model.md:21` already applies to promotion: "repeated independent demonstrations in materially
   different contexts."

**Ordering only.** The output is a ranked list with a stated reason per entry, not a set of numbers. Two
competencies may tie; the view says so rather than breaking the tie with a manufactured value. This is the
concession that keeps the proposal inside OQ-003: relative ordering by observed dates and observed context
counts needs no invented constant, whereas any "due in N days" would require one.

### 2.4 What consumes it

**Task assignment.** `contracts/task-assignment.md` gains guidance in Allowed Actions:

- *Repetition compression.* Prefer one assignment that legitimately exercises several high-attention
  competencies over several narrow assignments. The constraint is that the work must genuinely exercise each
  one; a task listing competencies it does not exercise is fabricated scope, and the existing
  `primary_competencies` and `secondary_competencies` distinction already carries that honesty.
- *Interleaving.* Where the choice is otherwise open, prefer high-attention competencies from **dissimilar**
  `domain` prefixes within one assignment, and avoid scheduling closely related competencies back to back.
- *Momentum.* When a high-attention competency is blocked by a missing prerequisite, prefer unblocked frontier
  work and **name the gap** rather than forcing remediation first. The learner decides whether to detour.

**Remediation.** On a rework or insufficient-evidence outcome at a design gate, code review or validation,
walk `prerequisites` backwards from the task's `primary_competencies` and name the specific competency to
revisit. This replaces a general suggestion to study with a specific claim a learner can argue with.

**Baseline probing.** `docs/architecture/simulation-lifecycle.md:11` (BASELINE) currently has no method.
Interviewing across 151 competencies is not viable. Instead, probe the **cut set**: the competencies that
dominate the largest portion of the graph, so that one observation constrains the most descendants. Two rules
are unchanged and must be restated in the adopted entry:

- `contracts/onboarding.md:35` still forbids inferring proficiency from self-report.
- `docs/architecture/simulation-lifecycle.md:26` still permits an all-`unassessed` baseline: "this records
  missing information without pretending an evaluation succeeded."

The frontier makes the probe cheaper. It does not make a probe into evidence. A probe that produces no
artifact produces no finding.

### 2.5 What it must never do

Stated as prohibitions, because this is where the design is most likely to be misused:

- Never gate a transition, an assignment, a review or a promotion.
- Never write to `.apprenticeship/competencies.yaml` or any canonical record.
- Never be cited by an assessment, review or promotion packet.
- Never present a number that could be read as capability.
- Never cause a task to be assigned without a team lead exercising the assignment contract. It ranks; the
  team-lead principal still decides.

## 3. Rejected alternatives

| Alternative | Tradeoff and reason for rejection |
| --- | --- |
| Spaced repetition with a real schedule (half-lives, due dates, per-learner speed multipliers). | The mechanism that makes the borrowed system effective, and the most useful version of this feature. Rejected because every constant would be invented, which OQ-003 and `review-model.md:21` both explicitly forbid, and because "due" implies an obligation the evidence model does not support. Revisit once there is enough real learner data to calibrate, which is exactly what OQ-003 asks for. |
| Extend the existing derived cache instead of adding a separate file. | Fewer artifacts, one place to look. Rejected because `state-model.md:44` closes that derivation, and because mixing advisory ordering into the canonical capability record is precisely the confusion this proposal exists to prevent. |
| Compute the view on demand, persist nothing. | No stale artifact, no risk of it being cited. Genuinely attractive. Rejected because "how long since this was last demonstrated" is only meaningful against a previous observation, and because persisting it makes it inspectable, which the charter's Human-Readable State principle favors. Reconsider if the staleness risk proves worse than the opacity. |
| Target a success rate (assign work the learner is expected to pass about 80 percent of the time). | Powerful difficulty calibration in the source system. Rejected because it requires a numeric ability estimate, the thing ACP-013 refused, and because a success-rate target invites optimizing the metric by assigning easier work. `task.recommended_level` and the `catalog/levels.yaml` rubric anchors already carry difficulty qualitatively. |

## 4. Version impact

| Artifact | Change |
| --- | --- |
| New `docs/architecture/selection-model.md` | Normative semantics for frontier, attention ordering and the prohibitions in 2.5. |
| New `schemas/attention-advisory.schema.json` | Closed object. Marked explicitly non-canonical. |
| `docs/architecture/state-model.md:5-20` | Add `advisory/attention.yaml` to the location table with authority "Derived advisory view; establishes nothing; deletable." |
| `contracts/task-assignment.md` | Allowed Actions and Forbidden Actions additions. |
| `contracts/onboarding.md` | Baseline probing guidance. The existing prohibition at line 35 is unchanged. |
| `docs/cli.md` | `next` gains advisory output, clearly labeled. |
| `SPEC.md` | One row for the selection model. |

No existing schema identifier is redefined. No catalog version changes beyond ACP-013's.

## 5. Migration impact

None. The file is generated on first use and its absence is valid. A workspace that never generates it behaves
exactly as today. A workspace pinned at competency catalog 3.0 (no graph) produces a view in which every
competency is on the frontier, which is a true statement about a graph with no edges.

No immutable record is read differently, rewritten or reinterpreted.

## 6. Conformance

| ID | Scenario | Required behavior |
| --- | --- | --- |
| CF-38 | Frontier computed with a populated graph and a partly demonstrated cache | Frontier contains exactly the competencies whose prerequisites are all demonstrated and whose own finding is `unassessed` or `developing`. |
| CF-39 | Advisory file deleted, then any command run | Every operation succeeds. Regeneration is offered, never required. |
| CF-40 | Failed design gate on a task with populated `primary_competencies` | Remediation output names specific prerequisite competencies, not a general instruction to study. |
| CF-41 | Two competencies with identical evidence dates and context counts | Reported as tied. No synthetic tiebreak value. |
| FR-37 | Advisory view contradicts the derived cache | Cache wins. The contradiction is reported, never silently reconciled. |
| FR-38 | Assessment, review or promotion packet cites the advisory view as evidence | Reject the citation. The view is not an evidence record. |
| FR-39 | Advisory generation attempts to write a canonical record | Reject the write. |
| FR-40 | Advisory output rendered for a learner | Contains no percentage, mastery value, decay coefficient or due date. |
| FR-41 | Assignment proposed listing a competency the work does not exercise | Reject as fabricated scope, whatever the attention ordering recommended. |

FR-40 is the regression test for the OQ-003 boundary. FR-41 is the regression test against compression being
used to inflate a task's claimed coverage.

## 7. Open questions

- Ordering by "materially different contexts" requires deciding what makes two contexts materially different.
  `review-model.md:21` leaves that to reviewer judgment, correctly. A derived view needs something mechanical,
  and distinct `project_id` is the obvious proxy while also being a weak one. Unresolved.
- The cut-set computation for baseline probing is only meaningful once a substantial graph exists. Until then
  it degenerates to the seven core competencies, which is a reasonable default but is not the designed
  behavior.
- This proposal is worth little until there is more than one authored task to select among. It is sequenced
  last for that reason, and adopting it before ACP-015 has produced content would be adopting a scheduler with
  an empty queue.
