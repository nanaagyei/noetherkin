# Engineering Apprenticeship Simulator — Agent Instructions

## Read Before Working

Before making substantial changes, read:

1. `PROJECT_CHARTER.md`
2. `FOUNDATION_V1.md`
3. `docs/architecture/`
4. relevant skill contracts
5. `IMPLEMENTATION_STATUS.md`

---

# Architectural Authority

`FOUNDATION_V1.md` and the versioned schemas define the V1 protocol.

Do not silently redefine:

- engineering levels;
- competency semantics;
- evidence semantics;
- role permissions;
- task states;
- assistance levels;
- promotion rules;
- skill ownership.

If implementation reveals a contradiction, create an architecture change proposal instead of silently changing behavior.

---

# Product Philosophy

The learner is the engineer.

Do not optimize this project around autonomous code generation.

Skills should strengthen:

- investigation;
- comprehension;
- debugging;
- design;
- testing;
- deployment;
- operation;
- technical communication.

---

# Agent Independence

Do not introduce core dependencies on any one:

- model provider;
- IDE;
- agent harness;
- proprietary protocol.

Vendor-specific behavior belongs in `adapters/`.

---

# Deterministic Logic

Prefer normal code rather than language-model reasoning for:

- schema validation;
- initialization;
- ID generation;
- lifecycle state checks;
- migrations;
- project lookup;
- state aggregation.

---

# State Integrity

Never fabricate simulation state.

Formal learner evaluations require evidence.

Do not update learner level merely because a model believes the learner is ready.

Follow the review and promotion protocols.

---

# Skills

Every reusable skill must:

- have one clear responsibility;
- follow its contract;
- use progressive disclosure;
- avoid duplicating global policy unnecessarily;
- reference shared standards where appropriate.

Keep `SKILL.md` focused.

Put extensive background material in `references/`.

---

# Testing

Changes to:

- schemas;
- leveling;
- lifecycle;
- permissions;
- skill contracts

require corresponding tests/evaluations.

---

# Security

Do not create behavior that automatically:

- pushes commits;
- merges PRs;
- deletes repositories;
- force-resets Git;
- modifies remote infrastructure;
- accesses secrets;
- deploys production systems.

Those actions require explicit user authorization.

---

# Implementation Discipline

Maintain:

`IMPLEMENTATION_STATUS.md`

Update it when substantial work is completed.

Do not create broad placeholder scaffolding without meaningful implementation.

Prefer vertical slices over dozens of empty modules.

---

# Open-Source Quality

Code and documentation should be understandable by contributors who did not participate in the original design conversation.

Avoid hidden context.

If a decision matters, document it.