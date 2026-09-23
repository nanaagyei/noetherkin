# ACP-013: Competency prerequisite and encompassing graph

| Field | Value |
| --- | --- |
| Status | `ADOPTED`, 2026-09-23 |
| Date | 2026-09-21 (America/Chicago) |
| Depends on | none |
| Blocks | ACP-014 |
| Supersedes | none |

> **Adopted.** The authoritative record is Phase 12 in [FOUNDATION_CHANGELOG.md](../../FOUNDATION_CHANGELOG.md),
> not this file. The first edge cut was authored with adoption and is flagged for owner review. Reverse
> directions are derived by `competency show` rather than stored.

The competency catalog gains dependency edges. `prerequisites` records what must be demonstrable before a
competency is reachable. `encompasses` records the component skills exercised when a competency is
demonstrated. The edges inform selection, remediation and evidence discovery. They never award credit.

## 1. Contradiction

This proposal contradicts no normative statement. It is nevertheless an architecture change rather than a
catalog edit, for two reasons.

First, `docs/architecture/competency-model.md:9` governs catalog extension:

> Catalog extension adds a stable namespaced ID, observable boundary and domain through a versioned catalog
> change. Never rename an ID in place. [...] For V1, catalog records require exactly the documented fields,
> unique IDs, nonempty behaviors and valid level dimensions; catalog integrity is covered by conformance
> evaluation.

"Exactly the documented fields" is enforced literally. `evaluations/validate_foundation.py:79` asserts that
every record's key set equals `{'id','domain','name','observable_behavior','required_core'}`. Adding a field is
a structural change to a frozen artifact, not an addition of data.

Second, the catalog version is pinned into every workspace. `core/validation.ts:26` requires
`catalog_version === '3.0'`, and `core/validation.ts:106` requires each protocol 3.0 config to pin
`competency_catalog_version === '3.0'`. A new catalog version therefore reaches existing learner state.

What this proposal must **not** contradict is `docs/architecture/competency-model.md:13`:

> Never average levels or calculate a percentage skill score.

Section 3.3 is the part of this proposal that exists to keep that true.

## 2. Proposed resolution

### 2.1 Two new fields

Competency catalog `catalog_version` becomes **4.0**. Each record in `catalog/competencies.yaml` gains two
optional arrays of competency IDs:

```json
{
  "id": "distributed.consistency",
  "domain": "distributed",
  "name": "consistency",
  "observable_behavior": "...",
  "required_core": false,
  "prerequisites": ["core.debugging", "distributed.replication"],
  "encompasses": ["core.testing"]
}
```

| Field | Meaning |
| --- | --- |
| `prerequisites` | Competencies a learner must be able to demonstrate before work targeting this one is reasonable. Advisory input to selection; never a gate on assignment, review or promotion. |
| `encompasses` | Competencies exercised as component skills when this one is demonstrated. A pointer for a reviewer looking for supporting evidence; never automatic credit. |

Structural rules, all enforced by conformance evaluation:

- Every referenced ID must exist in the same catalog.
- The union of both edge sets must form a **directed acyclic graph**. A cycle invalidates the catalog.
- A `required_core: true` competency may not list a prerequisite outside the core set. Core must remain
  reachable from an empty profile, or the diagnostic in ACP-014 has no entry point.
- A competency may not list itself in either array.
- Both fields default to `[]`. An unedged competency is always reachable, which is what makes partial
  authoring safe.

### 2.2 What the edges are used for

1. **Selection and remediation.** ACP-014 consumes them. This proposal only defines the data.
2. **Remediation targeting.** On a failed design gate, code review or validation, walking `prerequisites`
   backwards from the task's `primary_competencies` names a specific competency to revisit instead of a vague
   suggestion to study more. This is the analogue of pinpointing the prerequisite exercised by a failed lesson.
3. **Evidence discovery.** `encompasses` tells a reviewer where a demonstration might also be visible. It does
   not tell them it is.

### 2.3 The boundary against implicit credit

This is the load-bearing section. Math Academy's Fractional Implicit Repetition assigns discounted numeric
credit to encompassed topics when an advanced topic is practiced. **That mechanism is rejected here**, because
the credit is a number and `competency-model.md:13` forbids numeric skill scores.

What is adopted instead is already legal under the current protocol.
`docs/architecture/competency-model.md:5`:

> A language-specific demonstration may support a core competency through a separate evidence record with its
> own rationale; do not count the same underlying event as diverse evidence.

An `encompasses` edge makes that existing move **discoverable**. It does not perform it. Concretely, the
following remain unchanged and must be restated in the adopted changelog entry:

- An evidence record still makes exactly one competency claim in one context (`evidence-model.md:3`).
- A second claim about an encompassed competency requires a **separate** evidence record with its own
  `interpretation`, authored by a principal with the authority to publish it.
- `evidence-model.md:11` still holds: "Repeated citations to the same artifact are not repeated
  demonstrations." An `encompasses` edge is not permission to cite one artifact twice and call it two
  demonstrations. If anything, the edge makes that abuse easier to attempt, so the check matters more.
- The derived cache in `state-model.md:44` is untouched. It continues to select only unsuperseded longitudinal
  findings. **No edge contributes to it.**
- No edge produces, modifies or weights a finding. Findings remain `unassessed`, `developing`, `demonstrated`
  and `contested`.

A one-line summary worth carrying into the changelog: **the graph changes where a human looks, never what a
human concludes.**

### 2.4 Authoring scope

151 competencies is a large graph to author, and a wrong edge silently distorts every recommendation that
depends on it. Adoption should not require the complete graph.

First cut: the seven `required_core` competencies plus the `required_competencies` of **one** track. That is
roughly 15 nodes, small enough to review by hand and large enough to exercise ACP-014 end to end. Every other
competency keeps `[]` and remains permanently reachable, which degrades to exactly today's behavior.

Edges are data, so extending the graph later is an ordinary versioned catalog change under
`competency-model.md:9`, not another architecture proposal.

## 3. Rejected alternatives

| Alternative | Tradeoff and reason for rejection |
| --- | --- |
| Numeric mastery per competency with fractional implicit credit and decay (FIRe as specified). | The strongest scheduling signal available, and the reason Math Academy's system works. Rejected because it directly contradicts `competency-model.md:13`, requires rewriting the derived cache in `state-model.md:44`, and conflicts with the charter's Evidence Over Gamification principle (`PROJECT_CHARTER.md:77-90`). Adopting it would be a protocol major version, not an additive change. |
| Weighted edges (a fraction on each `encompasses` edge) without per-learner scores. | Closer to the source design and still not a learner score. Rejected because a weight has no meaning unless something multiplies by it, and the only thing that could is a score. The weight would be decorative or the rule would be dead. |
| Put prerequisites on tracks rather than competencies. | Smaller change; 34 files instead of one large one. Rejected because it would make dependency semantics track-specific, and INV-019 holds that tracks are advisory and own nothing. Two tracks would be free to disagree about what `core.testing` requires. |
| Put prerequisites on tasks. | Most concrete and most local. Rejected because there is currently one authored task in the repository, so the graph would be almost empty, and prerequisites would have to be restated on every future task. |

## 4. Version impact

| Artifact | Change |
| --- | --- |
| `catalog/competencies.yaml` | `catalog_version` 3.0 to 4.0. Two optional fields per record. No ID renamed, no `observable_behavior` reworded, no `required_core` flag flipped. |
| `schemas/apprenticeship-config.schema.json` | `competency_catalog_version` must accept `"4.0"`. Whether it accepts both 3.0 and 4.0 is settled in section 5. |
| `core/validation.ts:26,106` | Accept 4.0. Add DAG and reference checks to `catalogs()`. |
| `evaluations/validate_foundation.py:79` | The exact-key-set assertion becomes required keys plus two optional keys. Add cycle detection. |
| `docs/architecture/competency-model.md` | Document the two fields and, at greater length, section 2.3. |
| `SPEC.md` | No new row; the competency row already points at the catalog. |

No wire protocol version change. No record schema changes. Evidence, assessment, review and task schemas are
untouched.

## 5. Migration impact

Additive and mechanical. Every existing competency ID keeps its meaning, so every evidence record, assessment
finding, task competency reference, track requirement and project competency list remains valid without
rewriting.

The one real decision is the config pin. `core/validation.ts:106` currently requires an exact match on
`competency_catalog_version === '3.0'`. Two options:

- **Accept both 3.0 and 4.0** and treat a 3.0 pin as a graph-free catalog. Existing workspaces keep working
  untouched. The cost is two supported catalog versions.
- **Require a migration step** that rewrites the config pin, matching how ACP-10's 2.0 to 3.0 migration
  rewrote mutable bootstrap envelopes.

The first is recommended. The edges are advisory, so a workspace pinned at 3.0 loses a recommendation feature
and nothing else. The precedent already exists: `core/validation.ts:106` accepts `['1.0', '1.1']` for
`track_catalog_version`.

Immutable records are untouched under either option. No evidence, assessment, review, task or project snapshot
is rewritten, re-signed or reinterpreted.

## 6. Conformance

| ID | Scenario | Required behavior |
| --- | --- | --- |
| CF-35 | Catalog with a complete, acyclic edge set loads | Accept. Expose the graph to selection. |
| CF-36 | Competency with empty `prerequisites` and `encompasses` | Treat as always reachable. Behavior identical to catalog 3.0. |
| CF-37 | Workspace pinned at competency catalog 3.0 under a 4.0 runtime | Operate normally without graph-derived recommendations. Never synthesize edges. |
| FR-32 | Edge set contains a cycle | Reject the catalog with a diagnostic naming the cycle. Do not break it arbitrarily. |
| FR-33 | Edge references an unknown competency ID | Reject the catalog naming the dangling reference. |
| FR-34 | `required_core` competency lists a non-core prerequisite | Reject. Core must be reachable from an empty profile. |
| FR-35 | Reviewer cites one artifact as evidence for a competency and its encompassed competency | Reject the second claim as a repeated demonstration per `evidence-model.md:11`. An edge does not authorize double counting. |
| FR-36 | Derived cache rebuilt with a populated graph | Cache is byte-identical to a rebuild with an empty graph. No edge reaches `state-model.md:44` derivation. |

FR-36 is the regression test for the whole proposal. If it ever fails, implicit credit has leaked in.

## 7. Open questions

- Authoring the edges is judgment work that this proposal scopes but does not do. Whether the first track's
  graph is authored alongside adoption or after it is unresolved.
- `encompasses` and `prerequisites` will often be near-inverses of one another. Whether the catalog should
  record both directions explicitly, or derive one, is an authoring ergonomics question deferred to the first
  authoring pass.
- Whether a DAG is the right shape long term is untested. Real engineering competencies plausibly have mutual
  reinforcement rather than strict ordering. The acyclicity rule is adopted because it is checkable and because
  a cycle has no useful interpretation for selection, not because the domain is known to be acyclic.
