# ACP-015: First-party forge projects

| Field | Value |
| --- | --- |
| Status | `ADOPTED`, 2026-09-23 |
| Date | 2026-09-21 (America/Chicago) |
| Depends on | none |
| Blocks | ACP-014 (which needs content to select among) |
| Supersedes | none |

> **Adopted.** The authoritative record is Phase 13 in [FOUNDATION_CHANGELOG.md](../../FOUNDATION_CHANGELOG.md),
> not this file. The staged assets below were promoted to `schemas/forge.schema.json`, `catalog/forge/eval-ledger.yaml`
> and `tasks/forge/eval-ledger-core/`; the copies here are kept as the reviewed proposal text. Outside checks are
> enforced through learner-recorded attestations (`task attest`).

Noetherkin gains a second kind of project. A **forge project** is built by the learner from a specification
this repository ships. The repository ships the problem, the acceptance criteria, the operational requirements
and a real task pack. It never ships the solution. Forge projects carry E0 through E2, where the cost of
comprehending an unfamiliar codebase is highest and the learner can least afford it. Real open-source
repositories remain the ceiling and the source of genuine external constraint from E3 upward.

## 1. Contradiction

This proposal amends the charter. `PROJECT_CHARTER.md:69-73`:

> The simulator should operate primarily against real open-source repositories.
>
> The repositories themselves are not owned or vendored by this project.
>
> Learners fork or clone them separately.

`PROJECT_CHARTER.md:220-225` assumes the same shape, with `source/` holding "the learner's fork or clone."

The project schema encodes the assumption structurally. `schemas/project.schema.json` lists both
`repository_url` and `upstream_organization` among its required fields. Neither has a truthful value for a
project that does not exist until the learner writes it, and inventing one would violate INV-016 (unknown facts
remain unknown).

`contracts/projects.md:35` forbids the curator to "implicitly clone, checkout, deploy or assume an existing
repository revision," which is correct for upstream work and describes a flow a forge project does not have.

## 2. Rationale

Two problems meet here.

**Token cost.** A learner at E0 who selects a real repository must build enough context to act before any
learning happens. For most of the 87 catalogued projects that is a large amount of reading, and the natural
response is to delegate it to the agent. That is precisely the failure the charter names at
`PROJECT_CHARTER.md:40-42`: "An AI agent finished the project for me." The cheapest fix is not better
summarization. It is starting where there is nothing to summarize because the learner wrote it.

**Content depth.** The catalog is broad and shallow. 86 of 87 project records carry `task_packs: []`, most
carry `contribution_readiness: unverified`, and there is exactly one authored task in the repository
(`tasks/petclinic-pet-type-integrity.json`). A learner selecting anything other than PetClinic reaches
`core/simulation.ts:377` and is handed off to portable task assignment with no curated content at all. Forge
projects are where authored content can realistically be produced, because the specification and the task pack
are written together by the same author who controls the problem.

## 3. Proposed resolution

### 3.1 A distinct catalog kind

Forge records live in `catalog/forge/<id>.yaml` under their own schema, not as a variant of `project`. They are
a different kind of thing, and overloading the project schema with nullable upstream fields would weaken a
record type whose required fields currently mean something.

A forge record carries:

| Field group | Content |
| --- | --- |
| Identity | `id`, `name`, `description`, `schema_version`, `data_class`, `status` |
| Learning | `competencies`, `recommended_minimum_level`, `ideal_level`, `track_alignment` |
| Specification | the problem, its users, success criteria, explicit non-goals, and the operational requirements the finished system must meet |
| Constraints | `primary_languages`, `technologies`, required external services if any |
| Content | `task_packs`, non-empty by construction |
| Budget | `context_budget`, the stated target size of the finished artifact (see 3.3) |

`repository_url` and `upstream_organization` do not appear. `contribution_readiness` does not appear; there is
no upstream to contribute to. `sources` records where the problem statement came from when it is drawn from a
real need.

### 3.2 Entry requirements

A candidate is admitted only if it meets all of these. They are normative, because the value of the whole idea
collapses if forge projects become toy exercises that happen to compile.

1. **Production quality.** Real error handling, real tests, observability sufficient to operate it, documented
   operations including how it fails and how it is rolled back, and a deployable artifact. The
   `production-readiness` skill must have something genuine to assess.
2. **Genuinely usable.** Someone other than the learner could run it and get value. This is the difference
   between a portfolio piece and an exercise, and it is what makes the resulting evidence defensible under the
   `resume-evidence` contract.

   **Enforced, not asserted.** Each task pack ends with a criterion requiring a real person other than the
   learner to perform the quickstart unassisted, with the result recorded including where they got stuck. In
   the staged pack this is `AC-outside-check` in `tasks-eval-ledger/04-operable.json`. A model-performed or
   narrated walkthrough does not satisfy it, and recording one as satisfied is fabricated evidence under
   INV-003.

   This was raised as an open question, on the grounds that requiring another human adds real friction and is
   the criterion most likely to be quietly faked when nobody is watching. **Decided: keep it.** Without it,
   "genuinely usable by someone else" is an assertion the learner makes about their own work, which is exactly
   the kind of self-report `contracts/onboarding.md:35` and the evidence model refuse everywhere else. The
   friction is the requirement doing its job. Revisit if it proves to be the criterion that blocks completion
   in practice, rather than the one that improves the software.
3. **Bounded.** See 3.3.
4. **Track-aligned.** Maps to the `required_competencies` of at least one track in `catalog/tracks/`. A forge
   project that teaches nothing on any track has no place in the catalog.
5. **Ships a real task pack.** Multiple tasks forming a progression, not one exercise. A forge record with an
   empty task pack is rejected at catalog validation, which is the rule that stops the forge catalog repeating
   the current project catalog's breadth-without-depth problem.

### 3.3 The context budget, stated concretely

The finished artifact at E0 through E2 should be readable in roughly **15,000 tokens** of source, excluding
tests, lockfiles and generated files.

This number is a starting target, not a law of nature, and it should be revised against the measurements
ACP-016 introduces. It is stated as a number anyway because an unstated budget is not a constraint. Its purpose
is to force scope discipline on the author: a system small enough to hold in context is a system the learner
can hold in their head, which is the actual pedagogical goal.

### 3.4 Charter amendment

`PROJECT_CHARTER.md:67-75` becomes, in substance:

> The simulator operates against real open-source repositories and against first-party forge specifications.
>
> Open-source repositories supply genuine external constraint: existing design decisions, unfamiliar
> conventions, real contribution processes and maintainers who did not write the code for teaching. They remain
> the primary environment from E3 upward.
>
> Forge specifications supply bounded first work. The learner authors the entire system from a shipped
> specification. The repository owns the specification and the task pack; it never owns or ships a solution.
> They carry E0 through E2.
>
> Upstream repositories are not owned or vendored by this project. Learners fork or clone them separately.

`PROJECT_CHARTER.md:216-226` is amended so that `source/` in a forge workspace is learner-authored from empty
rather than a clone.

`PROJECT_CHARTER.md:278-280` is **retained unchanged**:

> Project inclusion must remain data-driven through a project catalog.
>
> Core skills must not hardcode behavior for specific repositories.

This applies to forge projects too. The existing PetClinic special-casing in `core/simulation.ts:122` and
`:377`, and the PetClinic-specific map template at `core/simulation.ts:162`, are exactly what must not be
repeated per forge project.

### 3.5 Skill and lifecycle effects

- `contracts/projects.md` gains forge selection. The clone and attach flow does not apply; binding a forge
  project creates an empty `source/` directory the learner populates. The forbidden action at line 35 stands
  for upstream projects and is inapplicable rather than relaxed for forge ones.
- `contracts/task-assignment.md` is unchanged. A forge task is an ordinary task record.
- `codebase-map` is **not** required before the first forge task. There is nothing to map yet. It becomes
  relevant mid-project, when the learner's own system has grown enough that mapping it is a real exercise, and
  this is a better first encounter with the skill than mapping a stranger's code.
- `production-readiness`, `incident-response` and `benchmarks` become reachable at E1 and E2 instead of
  requiring a system the learner did not build.
- `resume-evidence` gains genuinely defensible material. The simulation qualifiers it already requires still
  apply; a forge project is real software the learner wrote, but the surrounding engineering process was
  simulated, and `evidence-model.md:11` already forbids claiming simulated incidents as production experience.

### 3.6 Seed set

Three candidates, laddering within one track. ML and AI engineering is the recommended first target. These are
candidates for the adopted proposal to name, not authored content:

| Level | Shape | Competencies exercised |
| --- | --- | --- |
| E0 | A small evaluation harness: run a fixed set of cases against a component, record results as durable artifacts, report a comparison across runs. | `core.implementation`, `core.testing`, `core.git`, `core.technical-communication` |
| E1 | A data pipeline with real validation: ingest, validate against an explicit contract, quarantine bad records with a diagnosis rather than dropping them, expose metrics. | `core.debugging`, `core.ownership`, `ml.data-pipelines`, `data.quality` |
| E2 | A model serving service: versioned model loading, request validation, graceful degradation under load, health and readiness endpoints, a documented rollback. | `ml.serving`, `production.observability`, `design.api-design`, `core.codebase-navigation` |

Each ladders into the real open-source projects the ML track already recommends at its advanced tier, so the
transition at E3 is a step in scale rather than a change of subject.

### 3.7 Worked example

The format is settled against a real example rather than asserted. `ACP-015-assets/` contains:

| File | Contents |
| --- | --- |
| `forge.schema.json` | The proposed schema. Closed object, Draft 2020-12, no external references, matching the conventions in `schemas/README.md`. |
| `catalog-forge-eval-ledger.yaml` | The E0 forge record for Eval Ledger, validating clean against that schema. |
| `tasks-eval-ledger/` | The four-task `eval-ledger-core` pack. |

These are staged here rather than in `schemas/` and `catalog/` deliberately.
`evaluations/validate_foundation.py:43` asserts `len(schemas) == 11` and line 68 asserts every schema has at
least one validated document, so adding a twelfth schema to `schemas/` fails `npm run verify` immediately. A
proposal must not break the frozen artifact checks it is asking permission to change. Adoption moves these
files to `schemas/forge.schema.json`, `catalog/forge/eval-ledger.yaml` and `tasks/`, and updates both
validators in the same authorized change.

Checks performed against the staged example, all passing: schema validity; every competency ID resolves in
`catalog/competencies.yaml`; every track ID resolves in `catalog/tracks/`; both aligned tracks have genuine
overlap with the record's competencies, so entry requirement 4 in section 3.2 is met rather than asserted; and
the record's competency set is exactly the union of the task pack's primary and secondary competencies, in both
directions, so the record neither over-claims nor under-declares what the work exercises.

### 3.8 Compatibility probes do not transfer to forge projects

Authoring the pack surfaced a structural finding worth recording.

The task pack format carries `compatibility.required_files` and `compatibility.required_fragments`, consumed by
`assertTaskCompatibleSource` at `core/simulation.ts:122`. For an upstream checkout these probe that the task
still applies to the pinned revision, which is exactly right: the layout is known and not the learner's to
choose.

For a forge project they are meaningless and actively harmful. The source tree does not exist at task 1, and
from task 2 onward its layout is the learner's design decision. A path probe would dictate architecture, which
contradicts INV-001 and the charter principle that the learner is the engineer. Every task in the staged pack
therefore carries empty arrays, and sequencing is enforced by the pack order and the existing lifecycle rather
than by inspecting the tree.

The adopted change should either make `compatibility` optional for forge tasks or define a behavioral probe
that does not name paths. Naming paths is not an option.

## 4. Rejected alternatives

| Alternative | Tradeoff and reason for rejection |
| --- | --- |
| Stay open-source primary; solve the token cost with summarization or an indexing layer. | Preserves the charter and the existing 87-record catalog investment. Rejected because it puts the agent in charge of comprehension, which is the exact outcome `PROJECT_CHARTER.md:40-42` names as the failure, and because it would create a core dependency on an indexing stack against the Agent Independence principle. |
| Make forge projects the spine at every level; treat open-source as optional enrichment. | Maximum control over pedagogy and cost. Rejected because it discards the "Real Engineering Environments" principle and the thing open-source uniquely provides: code written by people who were not teaching, with constraints nobody chose for the learner's benefit. |
| Extend the existing `project` schema with nullable `repository_url` and a `kind` discriminator. | Fewer moving parts, one selection path. Rejected because it makes two required fields optional for every record, weakening a schema whose required fields currently carry meaning, and because a `null` upstream organization is an invitation to fabricate one. |
| Ship reference solutions alongside the specifications. | Would make the specs easier to validate and the task packs easier to author. Rejected outright. A shipped solution in the repository is a solution the agent can read, and INV-001 holds that the learner is the default code author. |

## 5. Version impact

| Artifact | Change |
| --- | --- |
| New `schemas/forge.schema.json` | Closed object, Draft 2020-12, no external references, matching the conventions in `schemas/README.md`. Twelfth schema. |
| New `catalog/forge/` | Forge records. New `forge_catalog_version`, starting at 1.0. |
| `schemas/apprenticeship-config.schema.json` | Pin `forge_catalog_version` alongside the existing competency, level and track pins. |
| `schemas/current-project.schema.json` | Represent a forge binding: a selected forge ID with a learner-authored `source_path` and no upstream identity or commit pin. |
| `core/validation.ts` | Load and cross-check the forge catalog. Enforce non-empty `task_packs`. |
| `PROJECT_CHARTER.md` | Amend lines 67-75 and 216-226. Retain 278-280. |
| `contracts/projects.md` | Forge selection path. |
| `SPEC.md` | One row. |

`schemas/project.schema.json` is **not** modified. Existing project records keep their exact meaning.

## 6. Migration impact

Additive. No existing workspace changes. A workspace bound to an upstream project is unaffected, and the two
kinds never mix within one selection: `current-project.yaml` binds one or the other.

The `source/` binding rules need care. `docs/architecture/state-model.md:28` requires source paths to point
outside `.apprenticeship` and to resolve relative to the workspace root, and both hold for a forge project.
What does not apply is the commit-identity check: there is no upstream identity to match. A forge binding
records the learner's own repository identity once it exists, and the safe-path and symlink-escape rules in
`state-model.md:26` apply unchanged.

Historical artifact resolution (`state-model.md:64`) works identically, because it resolves by cited repository
identity and immutable revision, and a learner's own repository supplies both.

## 7. Conformance

| ID | Scenario | Required behavior |
| --- | --- | --- |
| CF-42 | Forge project selected at E0 | Bind with an empty learner-authored `source/`. Never attempt a clone. Never require a commit pin before code exists. |
| CF-43 | Forge task assigned, completed and evidence recorded | Full lifecycle succeeds with no upstream repository present. |
| CF-44 | `resume-evidence` invoked on completed forge work | Produce truthful evidence describing learner-authored software, retaining simulation qualifiers for the surrounding process. |
| CF-45 | Learner moves from a forge project to an upstream project | Prior forge evidence remains valid and citable. No re-baselining. |
| FR-42 | Forge record with empty `task_packs` | Reject at catalog validation. |
| FR-43 | Forge record declaring `repository_url` or `upstream_organization` | Reject as an unknown field; the schema is closed. |
| FR-44 | Curator attempts to clone or fetch for a forge selection | Reject. There is nothing upstream to fetch. |
| FR-45 | Forge specification directory found to contain implementation source | Reject the record. The repository ships specifications and task packs, never solutions. |
| FR-46 | Core skill branches on a specific forge project ID | Reject, under the retained `PROJECT_CHARTER.md:278-280`. |

FR-45 is the regression test for the entire premise. FR-46 is the one that stops the forge catalog reproducing
the PetClinic special-casing already present in `core/simulation.ts`.

## 8. Open questions

- Whether the first forge project is authored alongside adoption or strictly after it. Authoring one would
  validate the schema, the budget target and the task-pack format before they are frozen. It also exceeds a
  proposals-only scope, so it is a decision for the user rather than for this document.
- The 15,000 token budget is asserted, not measured. ACP-016 provides the measurement; whether the budget is
  revised before or after the first forge project is authored is unresolved.
- Whether a learner may promote a completed forge project into the upstream catalog once it is public and used
  by others. It would be a satisfying loop and it introduces a self-certification risk that this proposal does
  not address.
