# Schema inventory

Nine standalone JSON Schemas use Draft 2020-12 and immutable 1.0 identifiers. Each has closed objects, explicit required fields and no external or circular schema references. Repeated small value definitions are embedded for portability; changes must be reconciled across all nine.

| Schema | Root document |
| --- | --- |
| apprenticeship-config | Workspace configuration |
| learner-profile | Learner metadata and onboarding |
| project | Global catalog record or pinned workspace snapshot |
| current-project | Null selection or complete source binding |
| task | Assignment and lifecycle history |
| evidence | One observed competency claim |
| competency-state | Derived summary |
| review | Discriminated code/task/performance/promotion review |
| assessment | Baseline or technical findings |

Schema validity is necessary but insufficient. Referential integrity, field-level role permissions, catalog IDs, state transitions, assistance consistency, artifact existence and promotion judgment are semantic checks specified in the architecture and conformance cases. Use format checking for timestamps and URIs. A URI's syntax does not prove artifact existence. `schemas/` contains no runtime validator.
