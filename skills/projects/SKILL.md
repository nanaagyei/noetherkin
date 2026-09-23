---
name: projects
description: Browse Noetherkin catalog and forge projects, explain fit and prerequisites, and bind the supported PetClinic checkout, a forge specification, or draft another selection. Use for simulator project discovery or switching, not generic project management.
---

# Projects

Read [runtime limits](references/runtime.md), [your contract](references/contract-projects.md), and [shared conventions](references/contract-README.md). Selection belongs to a project-curator principal; loading this skill cannot grant it.

1. Read learner goals and constraints, then browse with CLI `projects --json`. Browsing can precede onboarding. Distinguish missing catalog facts from inspected facts; recommendations must use catalog provenance and actual project documentation, not hardcoded repository behavior.
2. Explain candidate fit, prerequisites and uncertainty without pre-solving tasks. Do not infer current standing from administrative E0 or incomplete CLI validation. If a fit decision requires unavailable capability evidence, describe it as conditional.
3. Ask for the learner's choice when absent. Spring PetClinic Microservices is the one supported live selection; the example copy remains synthetic. A repository outside the supported catalog can remain a read-only suggestion pending truthful curator data.
4. Use `project select spring-petclinic-microservices --source <path>` for a clean existing checkout. Offer `--clone-to <path> --revision v3.4.1` only with the CLI's explicit learner confirmation. The controller verifies the exact origin, full resolved commit and task compatibility; preserve partial clone contents on failure.
5. For E0 to E2 learners, also offer forge specifications from `forges --json`: the learner builds the whole system from a shipped specification and task pack. Bind one with `project select <forge-id> --source <new or empty directory>`. Nothing is cloned, no commit is pinned, and you never supply, sketch or point to a solution. A `draft` forge has not yet been built end to end; say so.
6. Inspect onboarding completion, published baseline, existing project snapshot and old-project tasks. Active unblocked work prevents switching except backlog; fixture data, unresolved prerequisites and incomplete semantic validation remain explicit blockers. Imported project snapshots are immutable for the workspace lifetime.
7. Use a proposal for every unsupported project, switch or rebind. An approved onboarding draft does not satisfy selection prerequisites. Retain old project context and require explicit learner selection for changed source bindings.

Return candidates with rationale and provenance, or the proposed binding with inspected facts, remaining gaps and next action. Reuse an unchanged draft; never report a saved proposal as current-project. Selection and cloning produce no competency evidence.

Read [lifecycle](references/simulation-lifecycle.md), [project identity](references/state-model.md), and the [project](references/project.schema.json)/[binding](references/current-project.schema.json) schemas when drafting a selection. Other packaged references are listed in the [index](references/index.md). If onboarding or task-assignment is unavailable, explain the required next workflow without assuming it ran.
