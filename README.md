<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./noetherkin-logo.png">
    <source media="(prefers-color-scheme: light)" srcset="./noetherkin-logo-light.png">
    <img src="./noetherkin-logo.png" alt="Noetherkin: Practice, Build, Belong" width="760">
  </picture>
</p>

<h1 align="center">Noetherkin</h1>

<p align="center">
  Learn software engineering inside real codebases with portable mentoring workflows, evidence-based progression, and the learner firmly in control.
</p>

<p align="center">
  <img alt="Release status: pre-release" src="https://img.shields.io/badge/status-pre--release-f59e0b">
  <a href="https://github.com/nanaagyei/noetherkin/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/nanaagyei/noetherkin/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <a href="https://github.com/nanaagyei/noetherkin/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://github.com/nanaagyei/noetherkin/actions/workflows/codeql.yml/badge.svg?branch=main"></a>
  <img alt="Node.js 24 or newer" src="https://img.shields.io/badge/node-%3E%3D24-339933?logo=nodedotjs&logoColor=white">
  <img alt="Protocol 3.0" src="https://img.shields.io/badge/protocol-3.0-0f766e">
  <img alt="21 portable skills" src="https://img.shields.io/badge/portable_skills-21-7c3aed">
  <a href="./LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
</p>

> [!NOTE]
> Noetherkin is currently in pre-release.

## What is Noetherkin?

Noetherkin is an agent-agnostic apprenticeship protocol and local CLI for practicing engineering through real open-source systems. It surrounds learner-authored work with onboarding, investigation, task assignment, progressive assistance, design review, code review, evidence capture, performance review, and promotion discipline.

The name combines Emmy Noether's mathematical legacy with *kin*: people learning and building as a community.

The project is built around one principle:

> The learner is the engineer. Agents support judgment and understanding; they do not replace the work that creates them.

Noetherkin currently includes:

- a frozen V1 product foundation with wire protocol 3.0;
- a deterministic, recoverable local state publisher;
- 21 portable [Agent Skills](docs/skills.md);
- 34 versioned learning tracks and 87 project catalog entries;
- generic, Codex, and Claude Code onboarding adapters;
- evidence, assistance, review, and promotion semantics designed to resist fabricated progress.

## Why it exists

Most coding-agent workflows optimize for finishing the ticket. Noetherkin optimizes for the learner becoming able to explain, debug, modify, test, operate, and defend the system independently.

```text
READ → MAP → BUILD → RUN → TRACE → BREAK → DEBUG
     → TEST → MODIFY → BENCHMARK → OPERATE → EXPLAIN
```

Progress is based on attributable evidence, not points, streaks, task counts, or conversational impressions. Self-report can guide onboarding, but it cannot establish demonstrated capability or grant promotion.

## Install

Noetherkin has two portable parts: capabilities for your AI agent, and a trusted local CLI that owns workspace state. They install separately and neither authorizes the other.

### 1. Install the capabilities

Run this inside the project where you want to use Noetherkin:

```sh
npx skills add nanaagyei/noetherkin
```

The [Skills CLI](https://github.com/vercel-labs/skills) discovers the bundled capabilities and lets you choose the target agent and skills. To install only onboarding:

```sh
npx skills add nanaagyei/noetherkin --skill onboarding
```

### 2. Build the CLI

The CLI is not published to a package registry. Build it from a checkout, which needs Node.js 24 or newer:

```sh
git clone https://github.com/nanaagyei/noetherkin.git
cd noetherkin
npm ci
npm run build
```

That produces the executable at `dist/cli/main.js`. The examples below assume a shell alias:

```sh
alias noetherkin="node $PWD/dist/cli/main.js"
```

`npx skills add` installs instructions that teach an agent how to participate. The CLI is what actually writes state: it owns validation, consent, transactions, and every canonical record. An agent proposes; the CLI publishes.

## Start a workspace

```sh
mkdir -p /absolute/path/to/workspace
noetherkin init --workspace /absolute/path/to/workspace
noetherkin tracks
noetherkin track select backend-engineering \
  --workspace /absolute/path/to/workspace
noetherkin onboard --workspace /absolute/path/to/workspace
noetherkin next --workspace /absolute/path/to/workspace
```

Initialization requires direct terminal review and consent. Track selection guides project discovery but never owns skills, evidence, or promotion decisions. All CLI commands support `--json`; see the [CLI and recovery guide](docs/cli.md).

## Use with an AI agent

Open the learner workspace in your agent and ask naturally:

> Use the installed Noetherkin onboarding capability for this workspace. Ask for missing information one question at a time. When terminal consent is required, give me the exact handoff command and wait for its result.

Agents with native Agent Skills support can discover the installed capability automatically. For an agent without native discovery, provide the complete installed skill folder and direct it to follow `SKILL.md`; keep its `references/` and `assets/` directories beside it. The capability is still `onboarding` regardless of whether the host exposes it through natural language, a slash command, a palette action, or another interface.

The agent may inspect state, gather inputs, prepare proposals, and resume after a terminal handoff. Chat text and model output never count as consent: canonical writes remain in the learner-controlled CLI.

## Portable capabilities

`onboarding` is a portable capability. `/onboarding`, `$onboarding`, automatic discovery, and a CLI command are host-specific ways to reach it.

```text
portable capability → host adapter → host interface
onboarding          → Claude Code  → /onboarding
onboarding          → Codex        → $onboarding
onboarding          → generic host → capability:onboarding
```

Host adapters cannot publish canonical state by treating chat text as consent. Consent-bearing operations produce a state-bound terminal handoff that the learner reviews and approves directly. Read the [adapter architecture](docs/adapters.md) and [compatibility matrix](docs/adapter-compatibility.md).

## Architecture

```text
cli/               trusted learner-facing controller
core/              validation, lifecycle, transactions, state projection
adapters/hosts/    portable capability projections
adapters/runtime/  bounded model-judgment adapters
skills/            independently installable capability packages
schemas/           closed versioned state schemas
catalog/           competencies, levels, tracks, and projects
evaluations/       structural, behavioral, and adversarial checks
```

Canonical state is local, inspectable, and stored under `.apprenticeship/`. Skills propose or guide behavior; deterministic code owns schema validation, IDs, permissions, lifecycle gates, migrations, integrity checks, and publication recovery.

## Safety and trust boundaries

Noetherkin does not automatically:

- push commits or open and merge pull requests;
- deploy software or modify remote infrastructure;
- access secrets;
- delete repositories or force-reset Git;
- infer capability from self-report;
- promote a learner from task counts or model opinion.

Formal judgments require attributable evidence and role-appropriate authority. Unsupported or unenforceable writes degrade to reviewable proposals. See the [permissions model](docs/architecture/permissions-model.md) and [security policy](SECURITY.md).

## Validation

Run the same core checks used by CI:

```sh
npm run verify
```

That command builds the TypeScript sources, runs 106 runtime and packaging tests, checks all 21 portable skill bundles, validates the current foundation artifacts, and executes the 22 frozen conformance cases.

These checks establish bounded structural and runtime properties. They do not prove learner authorship, reviewer quality, model obedience, or educational effectiveness. Detailed claims and deferred evaluations live in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and [deferred validation](docs/deferred-validation.md).

## Documentation

| Document | Purpose |
| --- | --- |
| [Project charter](PROJECT_CHARTER.md) | Mission, product philosophy, and non-goals |
| [Foundation V1](FOUNDATION_V1.md) | Normative V1 protocol boundary |
| [Specification index](SPEC.md) | Authoritative schemas, catalogs, and contracts |
| [Implementation status](IMPLEMENTATION_STATUS.md) | Implemented scope, evidence, and limits |
| [CLI guide](docs/cli.md) | Commands, consent, recovery, and JSON output |
| [Portable skills](docs/skills.md) | Installation, packaging, and skill boundaries |
| [Contributor guide](CONTRIBUTING.md) | Development and architecture-change process |
| [Security review](docs/SECURITY_REVIEW.md) | Release threat boundaries, controls, and residual findings |
| [Publishing checklist](docs/PUBLISHING_CHECKLIST.md) | Repository, npm, security, and release gates |

## Contributing

Contributions are welcome. Before changing behavior, read [AGENTS.md](AGENTS.md), [PROJECT_CHARTER.md](PROJECT_CHARTER.md), [FOUNDATION_V1.md](FOUNDATION_V1.md), and [CONTRIBUTING.md](CONTRIBUTING.md).

Protocol semantics are versioned. If implementation work exposes a contradiction, propose an architecture change instead of silently redefining the released schemas or historical records.

## License

Noetherkin is licensed under the [Apache License 2.0](LICENSE).
