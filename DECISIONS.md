# Foundation decisions

All decisions below are explicit V1 design choices, not empirical findings. Revisit through an architecture change proposal and versioned migration where state semantics change.

| ID | Decision | Alternatives considered | Rationale | Consequences |
| --- | --- | --- | --- | --- |
| ADR-001 | YAML restricted to JSON-compatible data, JSON Schema 2020-12, Markdown notes | SQLite; arbitrary YAML tags | Inspectability, source-control review and tool portability | Strict parser and format checks required; no opaque database in V1 |
| ADR-002 | One record per task/evidence/assessment/review; stable paths | Status directories; one giant evidence ledger | Avoid duplicate status and file-move races; minimize shared edits | Directory enumeration needed; derived indexes optional |
| ADR-003 | Evidence separates fact, verification and interpretation | Free-form praise; a scalar skill score | A true observation can support a weak interpretation | More explicit review work; no automated inference of proficiency |
| ADR-004 | Canonical promotion chain; competencies are a derived cache | Editable level in profile; average competency score | Prevent unilateral level edits and duplicate authority | Corrupt/stale chain blocks progression; cache rebuild cannot invent a decision |
| ADR-005 | Distinct team lead, manager recommender and promotion reviewer principals, plus learner authorization | Manager promotes; team lead acts alone; compulsory second model vendor | Separate technical assessment and consequential judgment without vendor dependency | Procedural independence only; no claim that two agents are bias-free |
| ADR-006 | Task evidence can precede completion; final phase reconciles records | All evidence written only after task completion | Reviews require evidence, so late-only evidence causes a dependency cycle | Partial/failed work can be evidence; acceptance is still gated |
| ADR-007 | All core competencies plus declared specialization; thirteen rubric dimensions | Every learner must cover every language; task-count progression | Preserve engineering breadth without requiring universal specialization | Review must justify coverage and contrary evidence qualitatively |
| ADR-008 | Single writer with stale-digest checks and recoverable staged publication | Concurrent agents directly editing YAML; full event-sourced runtime | Keep V1 simple while specifying crash and retry integrity | Concurrent writes fail safely; transaction machinery deferred to implementation |
| ADR-009 | Source beside state; pinned workspace project definitions | Vendor source into this repo; global catalog carries learner progress | Respect upstream and preserve context across tool changes | Source existence/revision checks required for live selection |
| ADR-010 | Strict unknown-field rejection and explicit versioned migration | Ignore unknown fields; opportunistic upgrades | Prevent tools silently dropping new meaning | Even additive schema changes require version negotiation |
| ADR-011 | Code/task reviews and criterion validation bind to deliverable revision | Approval only attached to task ID | Prevent earlier approval surviving changed work | New revision requires validation and review again |
| ADR-012 | Fixture classification on every structured example | Unmarked realistic-looking state | Prevent demo accomplishments entering live evaluation | Live cross-reference checks must reject fixtures |
| ADR-013 | Eight workflow contracts now; final skill packages and promotion workflow later | Generate all SKILL.md files and runtime immediately | Foundational specification is the requested scope | Agent 2 reviews before implementing a narrow slice |
| ADR-014 | Terminal tasks stay terminal; blocked reason overlays active phase | Reopen completed tasks; add blocked as a phase | Preserve completed-work history without losing resume context | Defects create follow-up tasks; cancellation is not success |

The registry bootstrap is explicitly learner-authorized. No role may appoint itself during normal operation. Assistance snapshots preserve the observation context while the task history remains the canonical help ledger.

The adopted freeze proposals ACP-01 through ACP-09 in [FOUNDATION_CHANGELOG.md](FOUNDATION_CHANGELOG.md) refine ADR-004/005/007/009/011. In particular: unresolved standing replaces an unreadable stale chain, project snapshots cannot be refreshed in-place, and explicit longitudinal synthesis replaces latest arbitrary assessment cache selection. Wire/catalog/contract version 2.0 preserves the reviewed 1.0 meanings in the archive.
