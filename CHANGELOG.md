# Changelog

All notable changes will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use semantic versioning.

## [Unreleased]

### Added

- Initial public-release documentation, CI, security policy, release automation, and publication gates.
- Apache License 2.0 and a contributor-facing AI-agent policy.
- First-party JSON Schema Draft 2020-12 subset validator (`core/schema.ts`) covering the closed keyword set the eleven protocol schemas use, with unsupported keywords and formats rejected at load time.
- Differential parity test (`tests/schema-parity.test.mjs`) establishing equivalence with `ajv` over a 138-document corpus and 122,804 systematically mutated documents.
- Direct test coverage for the state reader's refusal of duplicate keys in flow and nested form, non-mapping document roots, and out-of-range or non-JSON number syntax, with the `YAML_INVALID` diagnostic code pinned.
- `docs/proposals/` staging area for architecture change proposals under review, with ACP-012 through ACP-016 and a worked forge-project example. Staged proposals are non-normative; ACP-012 (in part), ACP-013, ACP-015 and ACP-016 have since been adopted through `FOUNDATION_CHANGELOG.md`.
- `ClaudeRoleAdapter` (`adapters/runtime/claude.ts`) and a `--role-adapter codex|claude` CLI option (or `NOETHERKIN_ROLE_ADAPTER`), so every role-judgment command runs with Claude Code as well as Codex. Both adapters share one prompt and closed output contract in `adapters/runtime/output-contract.ts`.
- `noetherkin skills list` and `noetherkin skills install --host <generic|codex|claude-code>`: the host adapters now project all 21 capabilities, installation is digest-verified and never overwrites a differing file, and invoking a capability without a host bridge returns `blocked` with `NO_CONTROLLER_BRIDGE`.
- FR-29, FR-30 and FR-31 registered in `docs/architecture/conformance.md`, with a direct negative test for FR-31.
- ACP-016 context budget: `map status`, `task scope`, a project-derived map template, the optional frozen `investigation_paths` task field, `references_loaded` in the contract envelope, and bounded teach-back escalation with an explicit evidence limit.
- ACP-013 competency graph: catalog 4.0 with advisory `prerequisites` and `encompasses` edges, structural validation in both validators, and `noetherkin competency show <id>`. New workspaces pin catalog 4.0; 3.0 pins remain valid.
- ACP-015 forge projects: `noetherkin forges`, `project select <forge-id> --source <dir>`, `task attest`, `task test --command` for forge tasks, the `forge` schema, and the Eval Ledger specification with its four-task pack. Task packs are now resolved from catalog data rather than hardcoded.
- Findings from the first live runs of the Phase 12 and 13 behavioral cases are fixed in the portable skills: an unchecked map stays unverified even on request, and declining map authorship, refusing teach-back evidence, a map contradicted by source, an out-of-scope need and forge resume wording each carry their explicit teaching or process step. The bundled runtime guide now covers forge projects and the new commands. A test keeps model, vendor and host names out of portable instructions.
- The Claude eval isolation check allows exactly the two built-in plugins Claude Code 2.1.280 reports in safe mode, after a canary run showed they load no instruction files.
- `noetherkin setup`: an environment report (Node, platform, Git, role hosts, the bound project's toolchain), then, in a direct terminal and one confirmed step at a time, skill installation for each detected agent, `init`, track selection and onboarding. Noninteractive runs only report. `doctor` gains the same environment section and works without a workspace.
- Per-command help (`noetherkin help <command>`, `<command> --help`), compact human output for status, next, tracks, projects, forges, skills and errors (each error with a `Try:` line), and a `run` field on next actions holding the full command.
- `skills install` detects agents when `--host` is omitted and gains `--global` (`~/.claude/skills`, `~/.agents/skills`).
- Noninteractive `init`, `track select` and `onboard` return a `terminal-handoff` next action, so an agent can give the learner the exact approval command.
- Three draft forge specifications with four-task packs: Accessible Data Table (frontend, full stack; TypeScript and the DOM), SLO Burn Report (site reliability, observability, DevOps, platform; Python standard library) and Batch Ingest (data engineering, database, data analyst; Python and SQLite). Twelve tracks now have a runnable path.
- ACP-014 advisory selection: the thirteenth schema `attention-advisory`, a derived and deletable `.apprenticeship/advisory/attention.yaml`, an advisory block in `next`, prerequisite remediation on rework outcomes, and CF-38 to CF-41 and FR-37 to FR-41. Competency graph edges now cover the frontend, metrics, logging, observability, SRE and data competencies.

### Changed

- Adopted Noetherkin as the product, npm package, CLI executable, adapter handoff, and portable-skill-facing name before the first public release.
- Added theme-aware GitHub README logos with dark, light, and accessible fallback rendering.
- Simplified the public README and documented the separate one-command agent-capability and CLI installation paths.
- Excluded private architecture prompts and agent handoff notes from the public repository root.
- Migrated GitHub Actions dependencies from Node.js 20-backed releases to immutable Node.js 24-backed releases.
- Adopted ACP-012 in part: Noetherkin is no longer published to a package registry. `package.json` is private, `publishConfig` and `prepublishOnly` are removed, and the release workflow keeps only its verification job. Capabilities install with the Skills CLI; the controller is built from a checkout. Bundling the controller into skill packages was **not** adopted, because retaining `yaml` under FR-21 would mean vendoring a third-party parser and losing dependency updates on it.
- Every skill description must now state a boundary as well as a selecting condition, enforced by `validateInstalled`. All twenty-one already complied.
- Role judgments auto-detect their host: `--role-adapter` or `NOETHERKIN_ROLE_ADAPTER`, then a `--codex-bin` or `--claude-bin` flag, then the first working of `codex` and `claude`. A missing host fails with `ROLE_ADAPTER_UNAVAILABLE` before any consent prompt instead of `spawn codex ENOENT` after it.
- Usage errors print only the failing command's usage; unknown flags report `USAGE` rather than `IO_ERROR`; subcommands are checked before workspace lookup; an uninitialized directory reports `WORKSPACE_NOT_INITIALIZED`. The init prompt explains the assistance scale and names the roles; the onboard prompt names the selected track and its competencies.
- The README install is now: clone, `npm install`, `npm link`, then `noetherkin setup`. `npm install -g` from a git URL does not work under npm 11 and is documented as such.
- Codex skills install under `.agents/skills`.
- Automatic releases: every push to `main` is released at the version its merged pull request's release label implies (`release:major`, `release:minor`, `release:patch`, `release:none`), falling back to Conventional Commit subjects; a **Release label** check requires exactly one label on pull requests into `main` (ADR-018).
- The CLI now installs in one command from the latest GitHub release: `npm install -g https://github.com/nanaagyei/noetherkin/releases/latest/download/noetherkin.tgz`. The release workflow attaches the verified tarball under a versioned and a stable name, each with a SHA-256 checksum (ADR-017). Cloning with `npm link` remains the contributor path.
- Replaced `ajv` and `ajv-formats` in the runtime with the first-party validator and moved both to devDependencies, where they now serve only as the parity oracle. A production install resolves 2 packages rather than 8. Validation verdicts and reported errors are unchanged; error emission order is not reproduced and is not guaranteed.

### Fixed

- The release gate required a non-private package, contradicting ACP-012's `private: true`, so no release could pass verification. It now requires `private`.

- The packed CLI now ships `skill-pack/manifest.json`, so `skills install` and `setup` work from an installed package and not only from a checkout. A package test now installs a skill from the packed executable.
- Onboarding handoffs ignore the derived advisory directory, so regenerating the advisory never stales a prepared handoff.

## [0.1.0] - Unreleased

- Frozen V1 apprenticeship semantics with protocol 3.0 state.
- Deterministic local CLI and recoverable single-writer transactions.
- Twenty-one portable mentoring and engineering skills.
- Thirty-four learning tracks and eighty-seven project catalog records.
- Generic, Codex, and Claude Code onboarding adapter projections.
- Curated Spring PetClinic vertical journey and adversarial behavioral evaluation harness.
