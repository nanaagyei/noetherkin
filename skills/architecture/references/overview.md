# Architecture overview

The learner works in an authorized checkout inside the workspace; `.apprenticeship/` holds portable state beside it. Global track and project catalogs describe advisory pathways and repositories without learner progress. Skills read explicit state and return bounded proposals or permitted updates. Deterministic utilities validate those updates. Adapters translate harness capabilities without changing protocol semantics.

The units are separate: a role is an authority-bearing principal; a skill is a reusable capability/workflow contract; a track is an advisory competency/project guide; a task is an assignment; evidence records observed behavior; assessments interpret competencies; reviews decide at a defined scope. Tracks own no skill or evidence. No hidden conversation memory is required to resume work.

| Deterministic responsibility | Agent reasoning responsibility |
| --- | --- |
| Parse safe YAML, validate schemas and references | Ask a useful mentoring question |
| Allocate IDs, initialize missing state | Propose a scoped task without a solution |
| Check role, transitions and completion gates | Explain architecture and review a change |
| Resolve catalogs and derive summaries | Interpret evidence and contrary signals |
| Detect stale writes and apply migrations | Judge next-level behavior against the rubric |

Judgment is not automated by a numeric skill score. Deterministic checks can reject a structurally or procedurally invalid judgment, but cannot prove its educational validity.

## External standards research

Consulted 2026-09-12. The [official Agent Skills specification](https://agentskills.io/specification) defines a skill directory with `SKILL.md`, YAML frontmatter, required `name` and `description`, and optional resources. Names match their directory and use constrained lowercase names. It recommends progressive loading and keeping the main file under 500 lines. V1 contracts are design documents, not installable skills. Future packages should reference shared protocol guidance and put extended material in `references/`. Experimental `allowed-tools` metadata is not a portable security boundary.

The [official AGENTS.md convention](https://agents.md/) uses ordinary Markdown, supports directory-scoped guidance and describes nearer instructions taking precedence. Harness discovery varies; adapters must document what they load and surface conflicts instead of assuming every tool behaves identically. Repository guidance complements these workflow contracts and cannot supply runtime access control.

The [PetClinic upstream repository](https://github.com/spring-petclinic/spring-petclinic-microservices) describes a distributed Spring application and supplies contribution guidance and local deployment instructions. The catalog records this provenance; its learning recommendations are simulator design choices, not upstream endorsements. Actual setup requirements must be read at the learner's selected revision.
