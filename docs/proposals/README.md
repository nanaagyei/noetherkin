# Architecture change proposals

Documents in this directory are **proposed, not normative**. They do not change protocol behavior, schema
meaning, catalog semantics or contract obligations. `FOUNDATION_V1.md`, the versioned schemas, the architecture
documents under `docs/architecture/` and the contracts under `contracts/` remain the only authority until a
proposal is explicitly adopted.

`FOUNDATION_V1.md` requires that a semantic change after the V1 freeze "requires an architecture change proposal
stating the contradiction, alternatives, migration impact, version changes and conformance cases." This
directory is where such a proposal lives while it is under review.

## Status values

| Status | Meaning |
| --- | --- |
| `DRAFT` | Under authorship. Incomplete sections are expected. |
| `PROPOSED` | Complete and ready for review. Still not normative. |
| `ADOPTED` | Accepted. A condensed entry exists in `FOUNDATION_CHANGELOG.md`; that entry is the authority. |
| `REJECTED` | Declined. Retained for the record, with the reason. |
| `SUPERSEDED` | Replaced by a later proposal, which is named in the header. |

## Adoption

Adoption is a separate authorized act, never a consequence of writing or merging a proposal.

1. The proposal reaches `PROPOSED` with every required section complete.
2. The user authorizes adoption explicitly.
3. A condensed entry is added to `FOUNDATION_CHANGELOG.md` under a new dated phase heading, following the
   existing `### ACP-10` format: what changes, the contradiction and adopted resolution, the rejected
   alternative and its tradeoff, then schema, catalog, migration and conformance impact.
4. The normative documents, schemas and catalogs are changed in the same authorized change, with the new
   conformance cases implemented.
5. The proposal file is marked `ADOPTED` and points at its changelog entry. The changelog entry, not the
   proposal, is thereafter the authority.

A proposal that is merged but not adopted changes nothing. `npm run verify` must pass both before and after a
proposal is merged, because a proposal must not mutate a frozen artifact.

## Required sections

Every proposal must contain, in this order:

1. **Header block**: ID, title, status, date, author, and the proposals it depends on or supersedes.
2. **Contradiction**: the current normative text this proposal conflicts with, quoted, with a `file:line`
   citation for each quote. A proposal that contradicts nothing states that explicitly and says why it is still
   an architecture change rather than an implementation detail.
3. **Proposed resolution**: the normative behavior being proposed.
4. **Rejected alternatives**: at least one, each with the tradeoff that caused the rejection.
5. **Version impact**: schema identifiers, catalog versions and wire protocol versions affected.
6. **Migration impact**: what happens to existing workspaces, and what is preserved byte-for-byte.
7. **Conformance**: named new cases. New behavioral cases continue from `CF-33`; new failure and repair cases
   continue from `FR-29`. Verify against `docs/architecture/conformance.md` before assigning IDs, because those
   ranges move.
8. **Open questions**: what this proposal deliberately leaves unresolved.

## Index

| ID | Title | Status |
| --- | --- | --- |
| [ACP-012](ACP-012-skills-first-distribution.md) | Skills-first distribution and retirement of the npm package | `ADOPTED` in part, 2026-09-22 |
| [ACP-013](ACP-013-competency-graph.md) | Competency prerequisite and encompassing graph | `ADOPTED`, 2026-09-23 |
| [ACP-014](ACP-014-frontier-selection.md) | Advisory attention signal and frontier-guided selection | `PROPOSED`, deferred 2026-09-23 until several task packs exist |
| [ACP-015](ACP-015-forge-projects.md) | First-party forge projects | `ADOPTED`, 2026-09-23 |
| [ACP-016](ACP-016-context-budget.md) | Context budget discipline | `ADOPTED`, 2026-09-23 |

ACP-01 through ACP-11 were adopted before this directory existed. They are recorded in
[`FOUNDATION_CHANGELOG.md`](../../FOUNDATION_CHANGELOG.md) and have no file here.
