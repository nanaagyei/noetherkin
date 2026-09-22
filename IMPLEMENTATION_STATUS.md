# Implementation status

Foundational specification phase: complete. Phase 6 PetClinic vertical runtime: implemented and offline-verified. Twenty-one portable skill packages: implemented with focused per-skill bundles. Behavioral eval runner: expanded for Phase 7; the full dual-harness matrix remains deferred. Phase 8.1 versioned learning tracks, project entry metadata, generic attachment, and post-switch alignment publication: implemented. Phase 9 additive project catalog expansion: implemented. Phase 10 portable capability adapter onboarding slice: implemented and offline-verified for generic, Codex and Claude Code projections. Promotion execution remains proposal-only. Runtime schema validation is now first-party and dependency-free; `ajv` is retained only as a test oracle. Five architecture change proposals are staged for review under `docs/proposals/` and are not normative.

## Runtime dependency reduction and staged architecture proposals (2026-09-21)

- [x] Replaced `ajv` and `ajv-formats` in the runtime with `core/schema.ts`, a first-party validator for the closed Draft 2020-12 subset the eleven protocol schemas use: 22 validating keywords, two formats (`date-time`, `uri`), local `$ref` only, `additionalProperties` always false. 190 lines of code.
- [x] Made an unsupported keyword or format a load-time error rather than a silent skip, so a schema that grows beyond the subset fails closed instead of validating less than it claims.
- [x] Established equivalence by differential testing against `ajv` as an oracle in `tests/schema-parity.test.mjs`: a 138-document corpus reaching all 11 schemas and all four `review` union branches including promotion, then 122,804 systematically mutated documents with zero disagreements on verdict and on the reported error set, plus 44 `date-time` and `uri` edge cases per format.
- [x] Reproduced two ajv behaviors that consumers depend on: per-keyword error wording, which `tests/tracks.test.ts:69` asserts on, and the `uniqueItems` keyword's two code paths, which report their index pair in opposite orders depending on whether `items` declares only scalar types.
- [x] Moved `ajv` and `ajv-formats` to devDependencies. A production install of the packed tarball now resolves 2 packages (`noetherkin`, `yaml`) rather than 8, reducing runtime dependency bytes from roughly 3.6MB to 1.2MB.
- [x] Local verification: 111 Node tests, 21 skill bundles, 11 schemas, 135 fixture/catalog documents, 151 competencies, 34 tracks, 87 projects, 34 negative cases and all 22 frozen conformance cases pass. No schema, catalog, contract or frozen document changed.
- [x] Added `docs/proposals/` as a staging area for architecture change proposals under review, with status values, an adoption procedure and a required-section contract, indexed from `SPEC.md` as explicitly non-normative.
- [x] Staged ACP-012 (skills-first distribution and npm retirement), ACP-013 (competency prerequisite and encompassing graph), ACP-014 (advisory attention signal and frontier-guided selection), ACP-015 (first-party forge projects) and ACP-016 (context budget discipline). Each cites the normative text it contradicts with file and line, names its rejected alternatives, and declares new conformance cases in `CF-33`–`CF-51` and `FR-29`–`FR-53`, none of which collide with the existing `CF-01`–`CF-32` or `FR-01`–`FR-28`.
- [x] Staged a worked example for ACP-015 under `docs/proposals/ACP-015-assets/`: a proposed forge schema, the Eval Ledger E0 forge record validating clean against it, and a four-task pack. Catalog references, track alignment and record-to-task competency symmetry are checked in both directions.
- [x] Resolved the `yaml` runtime dependency question: retained. A `JSON.parse`-based reader was implemented and differentially verified against the YAML reader, but reverted because `tests/bootstrap.test.ts:113`, the Node-side expression of frozen conformance case FR-21, requires the reader to accept block-style YAML and resolve it under 1.2 rules. Reading YAML is a protocol commitment under FR-21, `state-model.md:62` and the charter's Human-Readable State principle, so removing it would need its own proposal amending a frozen conformance case. Hardened the reader's direct coverage while resolving this: the strict-parser cases in `tests/bootstrap.test.ts` now also pin duplicate keys in flow and nested form, non-mapping document roots, out-of-range and non-JSON number syntax, and the `YAML_INVALID` diagnostic code itself. Both protections were confirmed non-vacuous by seeded defect.
- [x] Resolved ACP-012's install-granularity gap: the runtime is bundled per skill through the existing `skill-pack/manifest.json` per-skill sources, into the 11 of 21 skills whose contracts permit a canonical write or consent-bearing operation, with every bundled copy required to be byte-identical. The single shared `skills/_noetherkin/` location is withdrawn as unreachable for a selective install.
- [x] Resolved ACP-015's outside-check question: the criterion requiring a real person other than the learner to perform the quickstart unassisted is retained, because without it "genuinely usable by someone else" reduces to self-report.
- [ ] Adopt or reject ACP-012 through ACP-016.

Limits: the validator replacement is implemented and verified; the proposals are not adopted and change no protocol behavior. `ajv` is retained as a devDependency solely as the parity oracle, and if `tests/schema-parity.test.mjs` fails the replacement is not equivalent and must not ship. Error emission order is deliberately not reproduced, because it is an artifact of ajv codegen scheduling that nothing here depends on; the parity test compares the error multiset, so the guarantee is same errors, same wording, same paths and same count, with unspecified sequence. The staged forge schema and catalog record live under `docs/proposals/` rather than `schemas/` and `catalog/` because `evaluations/validate_foundation.py:43` asserts exactly eleven schemas; a proposal must not break the frozen checks it seeks permission to change. The npm publication items in the section below remain open on their own terms; ACP-012 proposes retiring them but is not adopted.

## Public-release preparation (2026-09-18)

- [x] Reworked the root README around the Noetherkin identity, portable-capability model, quick start, architecture, trust boundaries, current status and contributor paths.
- [x] Added a security policy, changelog, contribution/release guidance, structured issue forms and a pull-request checklist.
- [x] Added least-privilege CI for macOS/Linux runtime tests, frozen protocol validation, dependency audit and exact npm package inspection.
- [x] Added pinned CodeQL and dependency-review workflows plus grouped npm and GitHub Actions Dependabot updates.
- [x] Added an npm release workflow using a protected GitHub environment, OIDC trusted publishing, provenance configuration and publication of the exact verified tarball.
- [x] Added a fail-closed release metadata check and a sequenced publication checklist covering legal identity, GitHub controls, npm setup, release review and post-publication verification.
- [x] Local verification: 106 Node tests, all 21 skill bundles, 11 schemas, 135 fixture/catalog documents, 151 competencies, 34 tracks, 87 projects, 34 negative cases and all 22 frozen conformance cases pass. `npm audit` reports zero known vulnerabilities. The Noetherkin dry-run tarball contains 1,010 files (6,837,182 unpacked bytes), includes Apache-2.0, both theme-aware logo variants, every reference host adapter and required public document, and excludes source tests, local state, drafts, artifacts and environment files.
- [x] Adopted Apache-2.0 and connected the SPDX package metadata, license file and README badge.
- [ ] Complete legal clearance for the Noetherkin name and confirm distribution rights for the generated logo. Preliminary exact-name web, USPTO, npm, GitHub and domain checks found no direct collision; this is not a legal opinion or reservation.
- [x] Bound clone, homepage, issue, CI badge and npm metadata to the intended `https://github.com/nanaagyei/noetherkin` repository identity.
- [x] Adopted `Noetherkin` as the public product name and `noetherkin` as the pre-release npm package and executable. Versioned schema `$id` namespaces, archived protocol snapshots and retained behavioral transcripts remain unchanged historical/protocol identifiers.
- [x] Published the reviewed initial history to `main`, created `release/dev`, updated `origin` to `nanaagyei/noetherkin`, and owner-confirmed branch protection and security settings.
- [x] Rechecked the unscoped `noetherkin` npm name after publication of the repository; the name remains apparently available but is not reserved.
- [ ] Establish npm ownership, a protected `npm` environment and the trusted-publisher relationship; complete the manual checklist before publishing a GitHub release.

Limits: the repository identity, `main`, `release/dev`, branch protection and security settings are owner-confirmed. No npm package was reserved or published. Legal clearance, logo distribution rights, trusted publishing and release-environment approval remain publication gates.

## Phase 10 portable capability adapter layer (2026-09-17)

- [x] Added a versioned `CapabilityHostAdapter` contract without changing the bounded-judgment `RoleAdapter`.
- [x] Added generic, Codex and Claude Code onboarding projections sourced from the existing portable `skills/onboarding/` bundle; projected files retain identical bytes and digests.
- [x] Normalized capability outcomes, confirmed/unverified facts, diagnostics, host profiles, probes, invocation surfaces and explicit degradation behavior.
- [x] Added a host-neutral stepwise onboarding bridge for initialization, track selection, onboarding completion and completed-workspace resume.
- [x] Added transparent terminal handoffs bound to workspace, correlation operation ID, proposal digest and the complete consulted state tree. Tokens provide no authority; noninteractive use remains proposal-only and direct terminal confirmation remains mandatory.
- [x] Preserved canonical controller ownership of principal binding, candidate validation, transactions and publication. `/onboarding` and `$onboarding` are documented host interfaces, not protocol capability identities.
- [x] Added a compatibility matrix for Cursor, Gemini, Windsurf, OpenCode, Pi, Kiro and OpenHands without placeholder adapter implementations or conformance claims.
- [x] Offline verification: 106 Node tests pass, including the same complete onboarding sequence through generic, Codex and Claude Code host adapters. All 21 skill bundles pass drift validation. Foundation validation passes 11 schemas, 135 fixture/catalog documents, 151 competencies, 34 tracks, 87 projects and 34 negative cases; all 22 frozen conformance cases pass.

Limits: Codex and Claude Code host binaries were version-probed, while the Phase 10 onboarding conformance path used the scripted role-judgment adapter and did not spend model inference. This establishes adapter/controller behavior, not native host discovery reliability, model obedience or educational effectiveness. The full dual-harness behavioral matrix remains deferred.

## Phase 9 additive project catalog expansion (2026-09-17)

- [x] Added attachable candidate records for Google Online Boutique, OpenTelemetry C++, and NVIDIA Triton Inference Server, raising the project catalog from 84 to 87 records.
- [x] Preserved OpenAI Triton as a distinct compiler project and retained explicit metadata gaps and empty task-pack support for all three additions.
- [x] Preserved all 34 track catalog 1.1 definitions byte-for-byte. The new repositories are globally discoverable and selectable but are not silently inserted into pinned recommendation tiers.
- [x] The Stage A–F sketch remains illustrative; project difficulty, onboarding cost, feedback-loop cost, and level fit remain independent editorial fields rather than sequence or promotion gates.
- [x] Offline verification: 100 Node tests pass. Foundation validation passes 11 schemas, 135 fixture/catalog documents, 151 competencies, 34 unchanged tracks, 87 projects and 34 negative cases. All 22 frozen conformance cases and all 21 skill bundle checks pass; TypeScript compilation succeeds.

## Phase 8 versioned learning tracks (2026-09-17)

- [x] Phase 8.1 expands track catalog 1.1 to 34 tracks and the project catalog to 84 records, adding frontend, full-stack, data, database, SRE, observability, security, application security, developer tooling, compiler, quality, mobile, embedded, network, and game paths.
- [x] Every project exposes editorial repository difficulty, onboarding cost, feedback-loop cost, level fit, and explicit contribution readiness separately from track stage. Unverified upstream entry points remain named metadata gaps.
- [x] Learner-authorized `track align` publishes a fresh exact-scope longitudinal assessment and manager review, preserves pending state on scope objection, and atomically adopts profile/current-track scope only after `continue`.

- [x] Protocol 3.0 ACP-10 introduced the first 19 persisted advisory tracks without changing skill or evidence ownership; ACP-11 adds 15 more.
- [x] Competency catalog 3.0 contains 151 observable competencies; level catalog remains 2.0 and the additive track expansion is catalog 1.1.
- [x] Closed track and current-track schemas, pinned definition digests, explicit unselected/pending/aligned state, and onboarding enforcement.
- [x] Exactly two early, intermediate and advanced recommendations per track, resolving to 84 truthful project records with explicit candidate metadata gaps.
- [x] Generic attachable-project selection checks safe paths, exact origin, clean checkout, full immutable commit SHA and explicit terminal consent.
- [x] PetClinic remains the only bundled curated task pack. Other projects retain portable task-assignment handoff and cannot invoke PetClinic-specific runtime operations.
- [x] Explicit 2.0 to 3.0 dry-run and learner-authorized transactional migration preserve immutable 2.0 history and create no inferred track.
- [x] CLI discovery, selection, filtering and migration commands; track switching preserves existing profile scope and blocks new promotion decisions while alignment is pending.
- [x] Offline verification: 99 Node tests pass, including packed terminal journey, alignment success/objection/idempotency, project-metadata conditionals, generic candidate attachment, transactional/idempotent migration and transaction recovery. Foundation validation passes 11 schemas, 132 fixture/catalog documents, 151 competencies, 34 tracks, 84 projects and 34 negative cases. All 22 frozen conformance oracles and all 21 skill bundle checks pass.
- [x] Post-onboarding `track align` canonical publication, including retry reuse of already-published scope assessment/review artifacts.

## Phase 7 portable skill clusters (2026-09-17)

- [x] Engineering cluster: codebase-map, debug, architecture, design-review and benchmarks.
- [x] Validation cluster: user-agent, production-readiness and incident-response.
- [x] Career/progression cluster: performance-review, proposal-only promotion-review, non-employment performance-improvement-plan, resume-evidence and retrospective.
- [x] Thirteen versioned contracts preserve existing protocol roles, schemas, lifecycle and publication boundaries. No schema, catalog, role or review-kind changes were introduced.
- [x] Skill manifest format 2 separates shared protocol resources from per-skill contracts and explicit handoffs. Bundle inventory/counts are manifest-driven; standalone provenance and drift checks remain deterministic.
- [x] Behavioral discovery covers all 21 skills. D01 promotion review is active as a proposal-only case, and Phase 7 adds positive/adversarial coverage for insufficient inputs, authority overreach, fabricated evidence, stale revisions, untrusted artifacts, archived workspaces and unchanged draft retries.
- [x] Offline verification: all 21 skill packages pass the skill validator; 87 Node tests pass; 115 behavioral cases validate; bundle drift/check mode passes; the foundation checker passes nine schemas, 14 fixture/catalog documents and 30 negative cases; all 22 frozen conformance cases pass.
- [x] Focused Codex/Claude Phase 7 smoke schedule completed and independently reviewed during development. One resume-evidence attribution failure produced two focused guidance corrections; the final affected rerun passed on both harnesses. Raw transcripts and host metadata are intentionally excluded from the repository.
- [ ] Full repeated dual-harness behavioral matrix. This remains intentionally deferred and is not an offline acceptance prerequisite.

Limits: the Phase 6 CLI remains the only canonical publisher. User-agent and promotion-reviewer principals are not added by skill installation; promotion, general readiness, arbitrary incident and career writes remain proposals. Skill and fixture checks do not establish learner authorship, reviewer quality or educational effectiveness.

## Phase 6 PetClinic vertical journey (2026-09-15–17)

- [x] Locally packable CLI flow from initialization through onboarding, live PetClinic binding, learner-authored map, curated assignment, implementation/test capture, optional help, code review, task acceptance/evidence, TASK-002 preview and one-task performance review.
- [x] Generic single-writer transactions for creates and updates with stale digests, process-local actor binding, durable receipts, immutable old/new snapshots and candidate validation.
- [x] Crash recovery exposes an old/new/absent checkpoint per path. Manual edits conflict. Completion reuses retained new snapshots; rollback restores retained old bytes and never rebuilds snapshots.
- [x] Six principals registered in one initialization consent. Separate team-lead baseline publication precedes onboarding-coordinator completion.
- [x] Supported live PetClinic catalog entry, default clone ref `v3.4.1`, full resolved commit persistence, exact-origin/clean-checkout checks and revision-aware task compatibility probes.
- [x] Content-addressed change, focused Maven run and role transcript artifacts outside canonical state. No Docker Compose requirement.
- [x] Vendor-neutral `RoleAdapter`, scripted offline adapter and local Codex adapter with bound actor/context digest, minimal packets, tool-disabled read-only execution and explicit closed output schemas.
- [x] Code- and task-review packets contain the exact learner design, change snapshot and revision-bound test observation needed to assess every frozen criterion.
- [x] Phase 6 semantic validation for role authorship, task immutability/transitions, design gates, artifact digests, review/change binding, assistance attribution and completion evidence.
- [x] Offline complete-journey test and representative create/update crash, resume, conflict and rollback tests.
- [x] Captured real Codex integration pilot against PetClinic `v3.4.1` commit `f9fd559361f11b79e622ee0c0c660f42980a36ac`: real design/code/task/performance judgments, focused Maven execution, verified evidence, restart validation, TASK-002 preview and idempotent review retries all completed.
- [ ] Genuine learner-authorship acceptance remains unclaimed. The learner authored the map, then explicitly requested demonstration mode; Codex authored the design, implementation and tests outside `task help`, so this run must not be treated as evidence of learner independence or educational effectiveness.
- [ ] Full 118-execution Codex/Claude matrix and unfinished A02 manager repetitions. Explicitly deferred because they are not a Phase 6 prerequisite and have high token cost.

The exact remaining executions, acceptance meaning and commands are recorded in [docs/deferred-validation.md](docs/deferred-validation.md).

Current offline verification: **85 tests passed** on macOS, including the locally packed terminal journey with a scripted adapter, explicit Codex output-contract tests, review-packet coverage, restart/validation/retry checks, stale-work rejection, malformed/context-unbound role output, and create/update crash checkpoints. All eight skill bundles pass drift validation. The foundation checker passes nine schemas, 14 fixture/catalog documents and 30 negative cases; the frozen oracle passes all 22 cases. Live pilot results are integration evidence only, not a learner performance metric.

## Adversarial behavioral evaluations (2026-09-13–15, America/Chicago)

- [x] Portable Node.js case runner with 49 active cases and one deferred promotion-review case; retains S01–S20 and adds adversarial/positive controls across all eight skills.
- [x] Codex and Claude CLI adapters, isolated skill/fixture workspaces, explicit session continuation, model pinning, capability probes and per-case deadlines.
- [x] Transcript/tool-event capture, state and draft integrity checks, citation-bound maintainer reviews, and pass/fail/pending/infrastructure/not-run/deferred reporting.
- [x] Existing offline test command stays model-free; 21 meaningful runner tests cover isolation, event parsing, UTF-8 preservation, failures, sessions, grading and report completeness.
- [x] Initial and corrected live attempts preserved with transcripts, reviews and byte-verified archives. Onboarding, teach, task-assignment, manager and peer-engineer failures produced focused guidance corrections without changing frozen protocol semantics.
- [x] Interrupted-run continuation retries only missing or clean infrastructure results under identical suite, implementation, bundle, binary and model hashes; prior attempts remain under `interrupted-attempts/`.
- [ ] Complete corrected suite accepted on both harnesses, including all required repetitions and positive controls.

Confirmed offline verification: **74 tests passed**, including TypeScript compilation, the existing bootstrap/package/bundle suite and 23 runner tests. Bundle drift checks and all eight portable skill validators passed. Both original foundation checkers passed unchanged on a clean snapshot excluding dependencies, build output and Git internals: nine schemas, 14 fixture documents, 30 foundation negatives and 22 freeze cases.

The [runner guide](tests/behavior/README.md) documents commands, continuation rules, interfaces, private artifact handling and limitations. Historical development records report that focused corrected runs established the requested A01-A04 behavior on both harnesses before the first clean full schedule. That schedule produced six passes, two manager evidence-reconciliation failures, 110 infrastructure errors and two deferred records. Raw transcripts and host metadata are intentionally excluded from version control, and corrected guidance still requires a new full run. Source corrections do not inherit earlier passing results. No full-suite or educational-effectiveness claim is made, and no new skills, promotion executor or general canonical publisher were added.

## Agent Skills layer (2026-09-13)

- [x] Eight independently installable skill directories: onboarding, projects, task-assignment, teach, peer-engineer, code-review, team-lead and manager.
- [x] Focused entrypoints preserving frozen responsibilities, progressive assistance, role boundaries and evidence requirements.
- [x] Self-contained references and reusable draft template in every skill; no sibling skill or original checkout required to read them.
- [x] Deterministic manifest-based packaging, source/output SHA-256 provenance, relocated links and read-only drift checks.
- [x] Ordinary Markdown draft procedure: numbered revisions, exact dependency references, retained review notes and fresh review after changed inputs. Drafts remain outside canonical state and never satisfy lifecycle gates.
- [x] Actual CLI commands and coverage limits documented; no impersonated terminal consent, canonical-copy workaround, implicit actor registration or unsupported publication.
- [x] npm package includes skill resources; installation and contributor instructions documented.
- [x] Twenty behavioral evaluation scenarios specified across the eight skills.
- [ ] All behavioral scenarios executed and accepted against both agents; partial executions are recorded above. External Skills installer behavior remains untested.
- [ ] Learner-authored baseline reconciliation acceptance example and review.

Confirmed verification: **51 tests passed** with `npm test --cache /private/tmp/engineering-apprenticeship-npm-cache` on Node.js 24.14.0 / macOS. TypeScript compilation passed. This includes the existing 44 bootstrap/package tests plus seven bundle tests covering isolated installations, schema compilation, drift, missing/altered resources, invalid frontmatter, escaping links/symlinks and deterministic regeneration. The offline npm tarball installation and terminal bootstrap journey passed with the skill resources included.

All eight skill packages passed the skill-creator `quick_validate.py` checker. Both original Python foundation checkers passed unchanged on a clean source snapshot excluding dependency/build/Git directories: nine schemas, 14 fixture documents, 30 foundation negative cases and 22 freeze cases. Their copied bytes were verified identical before execution. This avoids the previously documented dependency README link issue without changing either checker.

Limits: these runs establish structural and package properties, not agent obedience, trusted reviewer identity or educational effectiveness. The original validation was structural; historical partial behavioral executions are summarized above without committing their raw transcripts or host metadata. Draft persistence is an instruction-driven Markdown workflow, without a draft writer, concurrency service or authenticated approval store. No general canonical writer, lifecycle engine, formal review publisher, harness adapter or promotion execution was added. No package was published or installed into personal agent directories.

## Bootstrap runtime slice (2026-09-13)

- [x] Node.js 24+/TypeScript ESM executable: init, status, projects, validate, doctor.
- [x] Direct learner consent, initial learner/coordinator binding, protocol UUIDs, pending onboarding and administrative E0.
- [x] Strict YAML/JSON parsing and all nine existing Draft 2020-12 schemas with format checking.
- [x] Bootstrap identity, reference, catalog, path, cache, consent, receipt and snapshot checks.
- [x] Single-writer publication, no-clobber file creation, SHA-256 snapshots, prepared manifest, durable receipt and explicit recovery.
- [x] Later canonical state returns incomplete semantic coverage with no computed standing.
- [x] Packed npm executable and interactive terminal bootstrap journey tested locally; package not published.

Runtime verification: **44 tests passed** with `npm test --cache /private/tmp/engineering-apprenticeship-npm-cache` on Node.js 24.14.0 / macOS. This includes actual SIGKILL at 14 publication boundaries, interrupted rollback, lock contention, injected filesystem failures, no-clobber races, parser/schema negatives, and an offline installed-tarball journey through the real terminal confirmation flow. TypeScript compilation passed as part of the run.

Both existing Python checkers passed unchanged against a clean source snapshot: nine schemas, 14 fixture documents, 30 foundation negative cases, and 22 freeze cases. Running the original foundation checker directly with dependencies installed also exposed an unrelated missing `docs/CONTRIBUTING.md` link in `node_modules/yaml/README.md`. The clean snapshot excluded dependency/build directories and retained the checker bytes exactly; no check was weakened. The freeze checker also passed directly in the working repository.

Tests exercise temporary workspaces rather than learner engineering activity. Publication targets local macOS/Linux filesystems; this development run exercises macOS, with Linux verification still outstanding. Crash tests cover process termination and injected I/O faults, not physical power loss. See [CLI limits](docs/cli.md) and [runtime design](docs/bootstrap-runtime.md).

## Foundation deliverables

- [x] Completed the original foundation architecture brief after reading the charter and repository agent policy.
- [x] Research official Agent Skills and AGENTS.md conventions; sources recorded in architecture overview.
- [x] FOUNDATION_V1.md authority and SPEC.md index.
- [x] Lifecycle, persistent state, evidence, competency, assistance and review models.
- [x] Role permissions, security boundaries and architectural invariants.
- [x] Nine standalone versioned schemas.
- [x] Competency taxonomy and behaviorally specific E0–E5 rubric across thirteen dimensions.
- [x] Eight precise skill contracts, without final skill packages.
- [x] Clearly labeled PetClinic fixtures covering every schema, assigned/completed work and reviews.
- [x] Decisions and classified open questions; no unresolved V1 specification blocker.
- [x] Architecture self-review and foundation reconciliation; issues and limits recorded in conformance document.
- [x] Read-only schema/fixture/conformance artifact checks.
- [x] Completed the internal foundation-to-review handoff; local coordination material is excluded from public source control.

## Verification

Run `python3 evaluations/validate_foundation.py`. The final observed result is recorded in [the validation report](evaluations/VALIDATION_REPORT.md). Checks inspect specification artifacts only; no learner task, PetClinic build, deployment or simulator behavior ran.

The independent specification review is recorded in reviews/ and its BLOCKER/HIGH findings are resolved in FOUNDATION_CHANGELOG.md. Runtime behavioral evaluations remain future work. Manual conformance scenarios are specified, not reported as passing agent executions.

## Remaining implementation

- [x] Bootstrap workspace initialization and its transactional publication service.
- [x] Reusable single-writer publisher and Phase 6 permission/history validation; arbitrary record mutation remains unsupported.
- [x] Read-only catalog lookup and bounded state inspection utilities.
- [x] PetClinic lifecycle helpers and baseline cache derivation; general migrations and later longitudinal cache rebuilds remain unsupported.
- [x] Eight SKILL.md packages using existing CLI operations and unsupported-write proposals.
- [x] Local Codex role adapter, scripted offline adapter and captured real-model integration pilot; genuine learner-authorship and educational calibration remain outstanding.
- [x] Eval-only CLI adapters and behavioral evaluation harness; observed coverage remains incomplete.
- [x] First-party runtime schema validation with differential parity against `ajv`; error emission order is not reproduced.
- [ ] Automated promotion workflow and operational features.
- [ ] Disposition of the staged architecture change proposals in `docs/proposals/`.

The user separately authorized the bootstrap slice and then the portable Agent Skills layer after the foundation freeze. The skills provide procedures and proposals, not execution of the remaining formal workflows.

## V1 freeze reconciliation

FOUNDATION STATUS: IMPLEMENTABLE

- [x] Preserve reviewed protocol 1.0 and adopt documented protocol 2.0 corrections.
- [x] Resolve F01–F09 across normative documents, schemas, catalogs, contracts and synthetic fixtures.
- [x] Define non-blocking V1 defaults for remaining review questions.
- [x] Add focused freeze conformance specimens and validate foundation artifacts.

At the foundation freeze, no simulator runtime, live migration or learner evaluation had been implemented. The subsequent bootstrap implementation is recorded above. Frozen product V1 still uses wire protocol 2.0; no schema, catalog, skill contract, leveling, evidence, or ownership meaning was changed.
