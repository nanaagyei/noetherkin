# Schema inventory

Twelve standalone JSON Schemas use Draft 2020-12. Protocol 3.0 adds tracks and current-track state while retained variants continue to validate immutable 2.0 records in migrated workspaces; the reviewed 1.0 files remain under archive/protocol-1.0/schemas. Each schema has closed objects, explicit required fields and no external or circular schema references.

| Schema | Root document |
| --- | --- |
| apprenticeship-config | Workspace configuration |
| learner-profile | Learner metadata and onboarding |
| project | Global catalog record or pinned workspace snapshot |
| current-project | Null selection, complete upstream source binding, or forge binding |
| track | Versioned advisory track definition |
| current-track | Null selection or pinned track and alignment state |
| task | Assignment and lifecycle history |
| evidence | One observed competency claim |
| competency-state | Derived summary |
| review | Discriminated code/task/performance/promotion review |
| assessment | Baseline/longitudinal synthesis or bounded checkpoint findings |
| forge | First-party forge specification: problem, success criteria, operational requirements, context budget and task packs, with no upstream identity (ACP-015) |

Schema validity is necessary but insufficient. Referential integrity, field-level role permissions, catalog IDs, state transitions, assistance consistency, artifact existence and promotion judgment are semantic checks specified in the architecture and conformance cases. Use format checking for timestamps and URIs. A URI's syntax does not prove artifact existence. `schemas/` contains no runtime validator.
