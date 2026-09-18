# Architectural invariants

| ID | Requirement | Violation example |
| --- | --- | --- |
| INV-001 | Learner is default code author | Completing assigned code before the learner attempts it |
| INV-002 | Formal evaluation requires relevant evidence | Promoting from conversational impressions |
| INV-003 | No role fabricates state | Reporting a test passed without a run |
| INV-004 | Source and simulator state remain separable | Requiring upstream to vendor learner records |
| INV-005 | Promotion is demonstrated competency based | Promoting after ten tickets |
| INV-006 | Core skills require no model vendor | A protocol field requiring a proprietary thread ID |
| INV-007 | Assistance is attributable where practical, otherwise unknown | Recording undocumented help as independent |
| INV-008 | Upstream policies constrain simulator actions | Sending an unauthorized contribution |
| INV-009 | Each critical fact has one canonical source | Editable level in both profile and review chain |
| INV-010 | Implementation help is progressively disclosed | Giving full code at the first hint request |
| INV-011 | Formal records are immutable with explicit corrections | Deleting contrary evidence |
| INV-012 | Fixture and live provenance never mix | Using a demo review for a live promotion |
| INV-013 | Roles and skill capabilities are separate | A manager loading code-review to gain promotion rights |
| INV-014 | Consequential writes require structural and semantic validation | Accepting an unresolved evidence ID |
| INV-015 | External/destructive actions require explicit authorization | Automatically pushing a learner branch |
| INV-016 | Unknown facts remain unknown | Inferring successful deployment from a config file |
| INV-017 | Promotion has separate technical and decision authority | Team lead acting as the only formal reviewer |
| INV-018 | No partial transaction is reported successful | Updating completion while losing its evidence |
| INV-019 | Tracks are advisory and do not own skills or evidence | Treating an advanced recommendation as a promotion gate |
| INV-020 | Scope changes are explicit and prospective | Rewriting historical reviews when a learner switches tracks |

The conformance scenarios exercise these invariants. An implementation must preserve them even when its agent instructions, prompt or UI differs.
