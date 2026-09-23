# Changelog

All notable changes will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use semantic versioning.

## [Unreleased]

### Added

- Initial public-release documentation, CI, security policy, release automation, and publication gates.
- Apache License 2.0 and a contributor-facing AI-agent policy.
- First-party JSON Schema Draft 2020-12 subset validator (`core/schema.ts`) covering the closed keyword set the eleven protocol schemas use, with unsupported keywords and formats rejected at load time.
- Differential parity test (`tests/schema-parity.test.mjs`) establishing equivalence with `ajv` over a 138-document corpus and 122,804 systematically mutated documents.
- Direct test coverage for the state reader's refusal of duplicate keys in flow and nested form, non-mapping document roots, and out-of-range or non-JSON number syntax, with the `YAML_INVALID` diagnostic code pinned.
- `docs/proposals/` staging area for architecture change proposals under review, with ACP-012 through ACP-016 and a worked forge-project example. These are explicitly non-normative and change no protocol behavior.
- `ClaudeRoleAdapter` (`adapters/runtime/claude.ts`) and a `--role-adapter codex|claude` CLI option (or `NOETHERKIN_ROLE_ADAPTER`), so every role-judgment command runs with Claude Code as well as Codex. Both adapters share one prompt and closed output contract in `adapters/runtime/output-contract.ts`.
- `noetherkin skills list` and `noetherkin skills install --host <generic|codex|claude-code>`: the host adapters now project all 21 capabilities, installation is digest-verified and never overwrites a differing file, and invoking a capability without a host bridge returns `blocked` with `NO_CONTROLLER_BRIDGE`.
- FR-29, FR-30 and FR-31 registered in `docs/architecture/conformance.md`, with a direct negative test for FR-31.
- ACP-016 context budget: `map status`, `task scope`, a project-derived map template, the optional frozen `investigation_paths` task field, `references_loaded` in the contract envelope, and bounded teach-back escalation with an explicit evidence limit.
- ACP-013 competency graph: catalog 4.0 with advisory `prerequisites` and `encompasses` edges, structural validation in both validators, and `noetherkin competency show <id>`. New workspaces pin catalog 4.0; 3.0 pins remain valid.
- ACP-015 forge projects: `noetherkin forges`, `project select <forge-id> --source <dir>`, `task attest`, `task test --command` for forge tasks, the `forge` schema, and the Eval Ledger specification with its four-task pack. Task packs are now resolved from catalog data rather than hardcoded.
- Findings from the first live runs of the Phase 12 and 13 behavioral cases are fixed in the portable skills: an unchecked map stays unverified even on request, and declining map authorship, refusing teach-back evidence, a map contradicted by source, an out-of-scope need and forge resume wording each carry their explicit teaching or process step. The bundled runtime guide now covers forge projects and the new commands. A test keeps model, vendor and host names out of portable instructions.
- The Claude eval isolation check allows exactly the two built-in plugins Claude Code 2.1.280 reports in safe mode, after a canary run showed they load no instruction files.

### Changed

- Adopted Noetherkin as the product, npm package, CLI executable, adapter handoff, and portable-skill-facing name before the first public release.
- Added theme-aware GitHub README logos with dark, light, and accessible fallback rendering.
- Simplified the public README and documented the separate one-command agent-capability and CLI installation paths.
- Excluded private architecture prompts and agent handoff notes from the public repository root.
- Migrated GitHub Actions dependencies from Node.js 20-backed releases to immutable Node.js 24-backed releases.
- Adopted ACP-012 in part: Noetherkin is no longer published to a package registry. `package.json` is private, `publishConfig` and `prepublishOnly` are removed, and the release workflow keeps only its verification job. Capabilities install with the Skills CLI; the controller is built from a checkout. Bundling the controller into skill packages was **not** adopted, because retaining `yaml` under FR-21 would mean vendoring a third-party parser and losing dependency updates on it.
- Every skill description must now state a boundary as well as a selecting condition, enforced by `validateInstalled`. All twenty-one already complied.
- Replaced `ajv` and `ajv-formats` in the runtime with the first-party validator and moved both to devDependencies, where they now serve only as the parity oracle. A production install resolves 2 packages rather than 8. Validation verdicts and reported errors are unchanged; error emission order is not reproduced and is not guaranteed.

## [0.1.0] - Unreleased

- Frozen V1 apprenticeship semantics with protocol 3.0 state.
- Deterministic local CLI and recoverable single-writer transactions.
- Twenty-one portable mentoring and engineering skills.
- Thirty-four learning tracks and eighty-seven project catalog records.
- Generic, Codex, and Claude Code onboarding adapter projections.
- Curated Spring PetClinic vertical journey and adversarial behavioral evaluation harness.
