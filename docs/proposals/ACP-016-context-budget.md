# ACP-016: Context budget discipline

| Field | Value |
| --- | --- |
| Status | `ADOPTED`, 2026-09-23 |
| Date | 2026-09-21 (America/Chicago) |
| Depends on | none |
| Blocks | none |
| Supersedes | none |

> **Adopted.** The authoritative record is Phase 12 in [FOUNDATION_CHANGELOG.md](../../FOUNDATION_CHANGELOG.md),
> not this file. Two resolutions differ from the text below. The map pointer is **derived, not stored**: `map status`
> recomputes it from the map text, the current source revision and the content-addressed check artifact, so no
> schema gains a pointer field and no role gains a new write. Path globs live in a new optional, frozen
> `investigation_paths` task field beside `investigation_areas` rather than inside its string entries, so the
> frozen-field list in `state-model.md` gains one entry.

Noetherkin gains an explicit position on context cost: the learner's own codebase map becomes the substrate
every later skill reads instead of the repository, investigation is path-scoped at assignment, and context
consumption is measured before it is optimized. The project does not build a code indexer, and the reason is
pedagogical rather than technical.

## 1. Contradiction

This proposal contradicts nothing, because the subject does not exist. A search across `core/`, `cli/`,
`adapters/`, `contracts/`, `docs/`, `schemas/`, `scripts/` and `catalog/` for token budget, context window,
summarization, indexing and truncation terms returns three incidental prose matches and no feature. It is not
in the "documented but not built" category; it was never designed.

Three adjacent things exist and should not be mistaken for it:

- **Context binding, not budgeting.** `core/adapters.ts:30` hashes the canonical JSON of a context packet and
  every role invocation asserts the returned digest matches (`core/simulation.ts:210`). That is integrity.
- **Context suppression in one adapter.** `adapters/runtime/codex.ts:60-62` forces `project_doc_max_bytes: 0`,
  disables web search, memories and skill search. That is determinism for evaluation.
- **Progressive disclosure by convention.** `scripts/package-skills.mjs:71` generates an index telling the
  agent to read the runtime guide and invoked contract first and load other references only as needed. That is
  a good convention with no accounting behind it.

## 2. What the measurements actually show

The assumption worth correcting before designing anything: the skills are not the problem.

A skill's mandatory upfront reads, measured on `skills/debug` (`SKILL.md` plus `references/runtime.md`,
`contract-debug.md` and `contract-peer-engineer.md`), total roughly 1,530 words, on the order of 2,000 tokens.
The approximately 244KB of bundled references per skill is disk, loaded lazily and mostly never read.

The cost is reading the target repository. For the 87 catalogued projects, several are among the largest
open-source codebases in existence. Optimizing skill bundles further would be optimizing the wrong term.

This matters for scope: it rules out the tempting response of installing third-party context-reduction tooling
to make skill loading cheaper, and points instead at the three mechanisms below.

## 3. Proposed resolution

### 3.1 Promote `codebase-map` to the canonical context substrate

This is the highest-value change in this proposal, and most of it already exists.

`core/simulation.ts:163` (`initMap`) writes a five-section template with `[PROMPT: ...]` placeholders.
`core/simulation.ts:169` (`checkMap`) verifies that every prompt was replaced, that all five sections have
content, and that at least three backtick-quoted source citations resolve to files that exist on disk
(`core/simulation.ts:173-176`). It is a genuine learner exercise with real verification, and today it is a
dead end: nothing downstream consumes its output.

Proposed: the completed, checked map becomes the artifact every later skill reads **in place of** the
repository, unless the task's investigation scope names something the map does not cover.

The reason to like this is that the pedagogy and the token saving are the same mechanism. The learner does the
comprehension once, by hand, with citations that were verified to resolve. Every subsequent invocation inherits
a cheap, cited, human-authored summary. Nothing is delegated to the agent that the learner was supposed to do,
because the learner wrote the map.

Three changes are required:

1. **Generalize the template.** `core/simulation.ts:162` hardcodes `# PetClinic codebase map` and
   PetClinic-specific prompts. This already violates the retained charter rule at `PROJECT_CHARTER.md:280`
   ("Core skills must not hardcode behavior for specific repositories") and must be made project-derived.
2. **Make the map a first-class artifact.** It is currently a `knowledge/*.md` file with, per
   `state-model.md:17`, "No machine schema" and authority only for what it literally records. That authority
   statement is correct and should be retained: a map is the learner's claim, not a verified fact. What is
   added is a pointer, so skills can find it and know whether `checkMap` passed.
3. **Add a contract obligation.** Skills that currently explore a repository read the map first and explore
   only what the map does not cover, reporting when they had to.

The honesty boundary must be explicit: a map is learner-authored and may be wrong. Reading it instead of the
source is a context decision, never an evidence decision. A skill that relies on the map for a consequential
judgment must say so, and `codebase-map`'s existing rule stands (`skills/codebase-map/SKILL.md:12`: it neither
authors the map nor creates competency evidence).

### 3.2 Path-scope investigation

`task.investigation_areas` is currently free text. Proposed: it carries explicit path globs relative to the
source root, so an agent reads a bounded slice of a large repository instead of exploring it.

This interacts correctly with the assignment freeze. `docs/architecture/state-model.md:48` lists
`investigation_areas` among the frozen fields, so scope is set once at assignment by the team lead and cannot
be widened mid-task. That is the right property: an investigation scope that grows as the work gets hard is not
a scope.

Two constraints:

- Globs are resolved with the existing safe-path rules (`state-model.md:26`): no traversal, no symlink escape.
- A scope that proves too narrow is grounds for a **replacement task**, per the existing freeze rule. It is not
  grounds for an in-place amendment, and this proposal does not create one.

### 3.3 Measure before optimizing

`contracts/README.md:17` already specifies a structured return envelope: outcome, rationale, referenced inputs,
record IDs, assistance events, gaps and next action. Add one reported field, `references_loaded`, naming which
bundled references the invocation actually read.

This makes context cost observable in the existing behavior harness (`tests/behavior/`, 115 declared cases
across 21 skills) and turns budget guidance into something calibrated rather than asserted. `contracts/README.md:17`
already notes these "are contract outputs, not a new persisted schema," so nothing is persisted.

ACP-015's 15,000 token budget target is the first thing that should be checked against real numbers.

### 3.4 Comprehension checks, and their evidentiary limit

Escalating teach-back, in the style of the "grill me" pattern, belongs in the existing `teach` skill rather
than a new one. Most of it is already specified. `skills/teach/SKILL.md:12-15` requires eliciting what the
learner understands, asking for a prediction, asking one question at a time, and closing with an explanation in
the learner's own words or one failure case, "never write that response for them." `contracts/teach.md:35`
forbids ghostwriting the learner's explanation.

What is added is escalation: follow-up questions that probe the boundary of an explanation rather than
accepting the first fluent answer, and a stopping rule so it does not become an interrogation. The existing
anti-gatekeeping refinement in `reviews/teach-interaction-refinement.md:5` applies unchanged: if the learner
repeats the request or declines, supply direct help without shaming or restarting gates.

**The guardrail matters more than the feature.** A passed comprehension check is at most weak evidence for
`core.technical-communication`. It is **not** evidence for the technical competency under discussion.
Explaining code is not engineering code, and `evidence-model.md:11` already bars promotion supported solely by
weak material. This must be written into `contracts/teach.md` Forbidden Actions explicitly, because a
comprehension check that produces cheap evidence for any competency it touches is the most likely way this
design gets abused, and it would be abused in the direction of inflating a learner's record.

### 3.5 Explicitly out of scope

No symbol indexer, embedding store or retrieval layer in `core/`.

Two reasons, both structural. It would make the agent the party that understands the codebase, contradicting
INV-001 and the charter's Human Is the Engineer principle. And it would create a core dependency on an indexing
stack, contradicting the Agent Independence requirement at `PROJECT_CHARTER.md:130-145`.

Third-party context tooling belongs in `adapters/`, optional, never required, and never on the path of a
consequential write. A learner who has such tooling may use it; the protocol must not assume it, and evidence
must not depend on it.

## 4. Rejected alternatives

| Alternative | Tradeoff and reason for rejection |
| --- | --- |
| Build repository indexing and retrieval into `core/`. | The most direct answer to token cost, and it would work. Rejected on INV-001 and Agent Independence grounds, as in 3.5. |
| Install third-party context-reduction skills to shrink skill loading. | Low effort. Rejected because the measurement in section 2 shows skill loading is roughly 2,000 tokens, so this optimizes a term that is already small. |
| Have the agent generate the codebase map, then have the learner review it. | Much faster to a usable map, and a real temptation. Rejected because mapping a codebase is the `core.codebase-navigation` exercise itself. Generating it and asking for approval produces a learner who approved a map, which is the failure at `PROJECT_CHARTER.md:40-42`. |
| Enforce a hard token ceiling per invocation. | Unambiguous. Rejected because no ceiling can be chosen honestly before 3.3 produces measurements, and a wrong ceiling would cause skills to stop mid-judgment, which is worse than reading too much. |
| Add a `comprehension` competency so grill results have somewhere to go. | Would give teach-back a natural evidence home. Rejected because it creates a competency that is demonstrated by talking, and every incentive would push work toward it. `core.technical-communication` already covers explanation and is correctly hard to satisfy. |

## 5. Version impact

| Artifact | Change |
| --- | --- |
| `schemas/task.schema.json` | `investigation_areas` entries gain a path-glob field. Frozen-field list in `state-model.md:48` is unchanged. |
| `schemas/learner-profile.schema.json` or `current-project.schema.json` | A pointer to the current checked map and its check status. Placement decided at implementation. |
| `core/simulation.ts:162` | Project-derived map template instead of the hardcoded PetClinic one. |
| `contracts/README.md:17` | `references_loaded` added to the return envelope. |
| `contracts/codebase-map.md`, `contracts/teach.md` | Map-first obligation; teach-back escalation and its evidentiary limit. |
| `docs/architecture/state-model.md:17` | Map pointer. The "no machine schema" and literal-authority statements are retained. |

No catalog version change. No wire protocol change. No record type becomes mutable.

## 6. Migration impact

Task schema change is additive; the glob field is optional and absent on existing task records, which continue
to validate and to mean exactly what they meant. Existing `knowledge/*.md` maps remain valid and are pointed at
rather than rewritten.

The map template generalization affects only newly initialized maps. An existing PetClinic map is untouched,
and `checkMap`'s five required sections are unchanged, so a map written under the old template still passes.

## 7. Conformance

| ID | Scenario | Required behavior |
| --- | --- | --- |
| CF-46 | Skill invoked with a checked map present | Read the map first. Explore source only for what the map does not cover, and report that it did. |
| CF-47 | Skill invoked with no map, or a map that failed `checkMap` | Proceed without it. Never treat an unchecked map as verified, never fabricate one. |
| CF-48 | Map initialized for a non-PetClinic project | Template is project-derived. No PetClinic identifier appears. |
| CF-49 | Task assigned with path-scoped investigation areas | Reads stay within scope. Out-of-scope need is reported, not silently satisfied. |
| FR-47 | Consequential judgment rests on a map claim that source contradicts | Source wins. The map is a learner claim, not verified fact, per `state-model.md:17`. |
| FR-48 | Agent proposes to author or complete the learner's map | Reject. `codebase-map` guides; it does not author. |
| FR-49 | Passed comprehension check offered as evidence for a technical competency | Reject. At most weak evidence for `core.technical-communication`. |
| FR-50 | Investigation glob escapes the source root by traversal or symlink | Reject under the existing `state-model.md:26` path rules. |
| FR-51 | Investigation scope widened in place after assignment | Reject. A replacement task is the only path, per `state-model.md:48`. |

FR-49 is the one to watch. It is the boundary that keeps a comprehension check from becoming a cheap route to
evidence.

## 8. Open questions

- Whether the map pointer belongs on the profile or on the current-project record. The map is per-project, but
  a learner may hold several over a project's life.
- What "the map does not cover" means mechanically. A skill needs to decide whether to read source, and the map
  has no machine-readable coverage claim. The five fixed sections are a weak proxy.
- The map's staleness is real and unaddressed here. A map written at one revision describes that revision, and
  `state-model.md:26` already requires live artifacts to pin an immutable revision rather than a moving branch.
  Whether a map should be invalidated when the source revision moves, and how aggressively, is unresolved and
  probably deserves its own proposal.
