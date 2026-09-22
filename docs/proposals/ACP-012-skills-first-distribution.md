# ACP-012: Skills-first distribution and retirement of the npm package

| Field | Value |
| --- | --- |
| Status | `ADOPTED` in part, 2026-09-22 |
| Date | 2026-09-21 (America/Chicago) |
| Depends on | none |
| Blocks | none |
| Supersedes | none |

> **Adoption note, 2026-09-22.** Adopted in part. The authority is the Phase 11 entry in
> [FOUNDATION_CHANGELOG.md](../../FOUNDATION_CHANGELOG.md), not this file.
>
> **Adopted:** retirement of registry publication, and the capability-routing requirement in section 3.5.
> **Not adopted:** bundling the controller into skill packages (sections 3.1 and 3.7), and the collected
> handoff table (section 3.5). Section 3.1 assumed a dependency-free runtime and section 3.3 then retained
> `yaml` under FR-21, so bundling would vendor a third-party parser and end dependency updates on it. The
> handoff table would duplicate contract prose against INV-009. Both need a fresh proposal; the reasoning in
> those sections is retained below for whoever writes it, including the now-incorrect cost figure in 3.7,
> which omits `yaml` and understates the artifact by roughly 2.2x.

Noetherkin should be installed as a set of agent capabilities and nothing else. The npm package is retired. The
transactional writer that the protocol requires survives as a pre-built, dependency-free script inside the
capability bundle, invoked through the shell rather than through an installed executable.

## 1. Contradiction

This proposal contradicts the current two-part distribution model.

`README.md:60`:

> Noetherkin has two portable parts: capabilities for your AI agent and a trusted local CLI for workspace state.

`README.md:78`:

> The npm command becomes available with the first package release:

`docs/skills.md:58`:

> The npm tarball includes the same skill folders but does not automatically install them into agent
> directories. The Phase 6 executable requires Node.js 24+.

`package.json:14-16` declares `bin`, `publishConfig` and the `files` allowlist that exist only to serve a
registry release.

It does **not** contradict the requirement that a trusted controller exist. `docs/skills.md:3` states:

> Canonical writes go only through the CLI publisher.

That requirement is retained in full. What changes is how the publisher reaches the learner's machine, not
whether it exists or what authority it holds.

## 2. Why the publisher cannot simply be deleted

`docs/architecture/state-model.md:32` requires:

> Only one writer per workspace at a time in V1. Every update checks the previously read content digest and
> rejects stale state. [...] A future writer must use a lock and staged writes with a durable transaction
> manifest containing transaction ID, operation ID, actor, input digest, output record IDs, expected old
> digests and proposed new digests.

`docs/architecture/state-model.md:56` requires durable receipts, ordered publication and recovery that either
completes a validated transaction or restores its complete old snapshot. INV-018 forbids reporting a partial
transaction as successful, and INV-003 forbids any role fabricating state.

`AGENTS.md` ("Deterministic Logic") requires normal code rather than language-model reasoning for schema
validation, initialization, ID generation, lifecycle state checks, migrations, project lookup and state
aggregation. Locking, digest comparison and crash recovery are the clearest possible members of that set.

The publisher therefore stays. Only its delivery changes.

## 3. Proposed resolution

### 3.1 The bundled executable script

`scripts/package-skills.mjs` gains a build step that emits one file, which is checked into the repository. Its
SHA-256 is recorded in each generated `references/bundle.json` alongside the existing per-file digests, and
`npm run skills:check` fails on drift exactly as it already does for every other generated file.

**Revised after the dependency spike (section 3.6).** The original form of this proposal vendored `ajv`,
`ajv-formats` and `yaml` into that file at build time. That is no longer the recommendation. `ajv` and
`ajv-formats` have been removed from the runtime entirely, so there is far less to bundle and none of it is
third-party.

**Revised again for install granularity (section 3.7).** The original form placed the file at a single shared
path, `skills/_noetherkin/bin/noetherkin.mjs`. That location is unreachable for a selective install and is
withdrawn. The runtime is bundled per skill, at `skills/<name>/bin/noetherkin.mjs`, for the skills that need
it.

Consequences:

- No `npm install`, no global binary, no registry account, no `node_modules` on the learner's machine.
- Node.js 24+ is still required, but only as an already-present runtime, not as a package manager.
- An agent invokes it through the shell: `node skills/_noetherkin/bin/noetherkin.mjs status --workspace .`

### 3.2 Consent is unchanged

The existing consent model is the reason this proposal is safe, and it is preserved without modification.
`docs/cli.md:42`:

> Typing `initialize` grants consent to that registry and bound operation. Any other response publishes
> nothing. There is no `--yes` or actor override.

`docs/cli.md:44`:

> A terminal is a direct local-user interface, not a way for an agent harness to impersonate the learner.

A script invoked through an agent's shell tool has no TTY on stdin and stderr, so every mutating command
continues to return a proposal and exit 3. Nothing about moving the code from an installed binary to a bundled
script grants an agent new authority. This must be covered by an explicit conformance case, because it is the
single most important property this proposal must not break.

### 3.3 The `yaml` dependency and canonical emission

**Decided: `yaml` is retained as a runtime dependency.** The bundled runtime carries it.

The tempting argument runs: the publisher writes `encode(value)`, which is `canonical(value)` plus a newline,
so every record it writes is a single line of compact JSON; every `.yaml` file this project ships is already
valid JSON, which FR-21 in `evaluations/validate_freeze.py:291` asserts; and `docs/architecture/state-model.md:62`
says "A JSON document is a permitted YAML 1.2 subset and the recommended canonical emission." On that reading,
`JSON.parse` suffices and 293KB of third-party parser leaves the runtime.

That argument is wrong, and the reason is a frozen conformance case. `tests/bootstrap.test.ts:113` is the
Node-side expression of FR-21, and it requires the reader to **accept block-style YAML** and resolve it under
1.2 rules:

```js
assert.deepEqual(parse('on: on\noff: off\n"012": "012"\ntimestamp: 2026-09-13T00:00:00Z\nflag: true', 'yaml'),
                 { on: 'on', off: 'off', '012': '012', timestamp: '2026-09-13T00:00:00Z', flag: true });
```

The case exists to prove the reader is YAML 1.2-aware, so that a YAML 1.1 loader cannot silently turn `on` into
`true` or `012` into octal. A reader that refuses such input does not satisfy it; both parses must succeed and
agree. The full sentence in `state-model.md:62` reads the same way: "Input outside this canonical subset
**requires** a YAML 1.2-aware parser." That is an obligation on the reader, not permission to decline. And
`PROJECT_CHARTER.md:149-157` commits to YAML as a state format under the Human-Readable State principle.

Reading YAML is therefore a protocol commitment, not an implementation detail. Removing it would need its own
architecture change proposal amending a frozen conformance case to make the protocol less capable, and the case
for that is weak: one fewer package and 293KB, against a documented capability and the local-inspection
discipline the whole evidence model rests on.

Feasibility is not the obstacle and was verified rather than assumed. A `JSON.parse`-based reader with an
explicit duplicate-key scanner was implemented and differentially tested against the YAML reader: identical
values on all 137 shipped files and on publisher output, every hostile input the YAML reader refused still
refused, no prototype pollution, and the duplicate-key scan not confused by braces, escaped quotes or commas
inside string values. It worked. It was reverted because `tests/bootstrap.test.ts:113` failed, which is the
conformance case doing its job.

What this proposal does keep from that work is the fail-closed principle for genuinely unreadable input: where
state cannot be parsed under YAML 1.2 core-schema rules, the tool fails closed with a diagnostic naming the file
and the offending construct, and never falls back to a YAML 1.1 reading. `core/parsing.ts` already does this.

### 3.4 Repository changes

| File | Change |
| --- | --- |
| `package.json` | Add `"private": true`. Delete `bin`, `publishConfig`, `files`. Retain devDependencies, runtime dependencies (now build-time only) and scripts. |
| `scripts/check-package.mjs` | Replaced by `scripts/check-skillpack.mjs`: the same required-prefix and forbidden-prefix discipline, applied to the installable skill tree instead of an `npm pack` tarball. |
| `tests/package.test.ts` | Rewritten as `tests/skillpack.test.ts`: copy the skill tree to a temp directory with no `node_modules`, then drive the complete PetClinic journey through the bundled script. This test is retained deliberately, because it is the one that proves portability. |
| `.github/workflows/release.yml` | Delete the `publish` job. Retain the `verify` job, its SHA-pinned actions, the tag-matches-version check and `npm audit`. |
| `docs/PUBLISHING_CHECKLIST.md` | Delete the npm registry identity, trusted publisher and environment approval rows. Retain the GitHub publication, trademark and logo rows, which are independent of npm. |
| `README.md:58-90` | One install step. |
| `docs/skills.md:31-58`, `docs/cli.md:3` | Rewrite install and invocation. |
| `CHANGELOG.md` | Record the retirement. |

This removes rather than adds a blocker. `docs/PUBLISHING_CHECKLIST.md:7-18` currently marks release identity as
blocked pending an npm owner, a trusted publisher configuration and environment approval, none of which are set
up. Retiring the package retires those gates.

### 3.5 Capability routing between skills

A separate concern raised alongside distribution is an agent moving between skills according to context. State
plainly what Noetherkin can and cannot do here.

Dispatch is the **host's** behavior. Implementing it would require harness-specific code in the core and
contradict the charter's Agent Independence principle (`PROJECT_CHARTER.md:130-145`). What Noetherkin controls
is the routing signal every harness reads: the `description` in each `SKILL.md` frontmatter. The existing 21
descriptions are already written in the correct discriminating form ("Use for X, not Y"), which should be made
an explicit obligation rather than an accident of authorship.

Two additions to `contracts/README.md`:

1. A routing requirement: each skill description must state both the condition that selects it and at least one
   adjacent capability it is not. Verified by `validateInstalled` in `scripts/package-skills.mjs`, which already
   checks description length and frontmatter presence.
2. A handoff table naming, for each skill, the successors it returns to. Several `SKILL.md` files already end
   with such a clause; this makes it uniform and machine-checkable.

Neither addition grants a skill authority. `docs/skills.md:29` continues to hold: "Roles are not created by
skill installation."

### 3.6 Dependency elimination (spike result)

Vendoring roughly 880KB of `ajv` and `yaml` into a checked-in file would have produced unreviewable diffs on
every dependency bump, against the repository's own standard that code be understandable by contributors who
were not in the design conversation. A spike tested whether the dependencies could be removed instead.

**Result for `ajv`: removed.** The eleven protocol schemas use a small, closed subset of Draft 2020-12. A
census of every schema position found 22 validating keywords and exactly two formats (`date-time`, `uri`), with
four `$ref`s that are all local, `additionalProperties` always `false`, `items` never in tuple form, and no
`patternProperties`, `dependentSchemas`, `unevaluatedProperties` or `propertyNames`. `core/schema.ts`
implements that subset in **190 lines of code**. An unsupported keyword or format is a load-time error rather
than a silent skip, so a schema that grows beyond the subset fails loudly instead of validating less than it
claims.

Equivalence is established by differential testing against ajv as an oracle, in `tests/schema-parity.test.mjs`:

| Check | Result |
| --- | --- |
| Corpus reaching every schema and all four `review` union branches | 138 documents, 11/11 schemas |
| Systematic mutations (field deletion, type substitution, unknown fields, emptied and duplicated arrays, string perturbation) | **122,804 documents, zero disagreements** on verdict and on the reported error set |
| `date-time` and `uri` edge cases (invalid calendar days, leap seconds, timezone bounds, non-hierarchical and relative URIs) | 44 samples per format, zero disagreements |
| Unsupported keyword or format in a schema | Rejected at compile time |

ajv is retained as a **devDependency**, solely to be that oracle. If the test ever fails, the replacement is not
equivalent and must not ship.

Two behaviors required faithful reproduction rather than reinvention, and both were found by the oracle rather
than by reading: ajv's per-keyword error wording, which `tests/tracks.test.ts:69` asserts on; and its
`uniqueItems` keyword, which has two code paths reporting their index pair in **opposite** orders depending on
whether `items` declares only scalar types. One residual difference is accepted deliberately: the **order** in
which errors are emitted is not reproduced, because it is an artifact of ajv's codegen scheduling and nothing in
this repository or the protocol depends on it. The parity test therefore compares the error multiset, and the
guarantee is same errors, same wording, same paths, same count.

Measured effect on a production install of the packaged tool:

| | Before | After |
| --- | --- | --- |
| Packages installed | 8 | **2** (`noetherkin`, `yaml`) |
| Runtime dependency bytes on disk | ~3.6MB | 1.2MB |
| Full suite | 106 passing | **111 passing** |

**Result for `yaml`: feasible, not done, and a separate decision.** Every `.yaml` file under `catalog/` and
`examples/` is already valid JSON; FR-21 in `evaluations/validate_freeze.py:291` asserts exactly that. So the
shipped corpus needs no YAML parser at all. `core/parsing.ts` nonetheless does real protocol work, rejecting
aliases, anchors, explicit tags, non-string mapping keys, duplicate keys, multiple documents and non-JSON
numbers. Replacing it with `JSON.parse` plus the existing `check()` walk would need explicit duplicate-key
detection, since `JSON.parse` silently keeps the last of a repeated key. The real objection is not
implementation cost: it is that hand-edited ordinary YAML in a learner workspace would stop parsing. That is a
protocol-visible behavior change, permitted by `state-model.md:62` but more restrictive than today, and it
belongs to the fail-closed decision in section 3.3 rather than to a dependency cleanup. Recorded here as an open
option, deliberately not taken.

### 3.7 Install granularity: which skills carry the runtime

A single shared location cannot work. `docs/skills.md:43` documents selective install:

```sh
npx skills add nanaagyei/noetherkin --skill onboarding
```

That command copies one skill directory. A runtime sitting beside the skills, at `skills/_noetherkin/`, would
never be copied, so the installed skill would direct the agent at a file that does not exist. The three
adapters in `adapters/hosts/` project the `onboarding` skill alone, so this is not a marginal case; it is the
designed one.

**Resolution: bundle the runtime per skill, through the existing manifest, only into the skills that need it.**

`skill-pack/manifest.json` is already format 2 with a `shared_sources` list applied to every skill and a
per-skill `sources` list. The runtime becomes a per-skill source. No new mechanism, no new install step, no
ordering dependency between skills, and `validateInstalled` in `scripts/package-skills.mjs` already rejects a
bundle whose declared resources are missing.

**Which skills need it.** A skill carries the runtime if and only if its contract permits a canonical write or
a consent-bearing operation. Reading does not qualify: workspace state is JSON-compatible YAML by
`state-model.md:62`, so a skill that only reads can read the files. Publishing is the thing that must go
through the publisher, per `docs/skills.md:3`.

By that rule, 11 of the 21 skills carry it today:

| Carries the runtime | Does not |
| --- | --- |
| code-review, codebase-map, debug, design-review, manager, onboarding, peer-engineer, performance-review, projects, task-assignment, team-lead | architecture, benchmarks, incident-response, performance-improvement-plan, production-readiness, promotion-review, resume-evidence, retrospective, teach, user-agent |

The second column is the read-only mentoring and draft-only set. `skills/teach/SKILL.md` already states the
principle for its own case: "Read-only conceptual help needs no active task or CLI." The rule is derived from
the contracts rather than from which commands a `SKILL.md` happens to mention today, so a skill that later
gains a write gains the runtime with it.

**Cost, measured.** The compiled runtime is 217KB of JavaScript across `dist/core`, `dist/cli` and
`dist/adapters`. A skill bundle is currently 312KB, almost all of it the 304KB of shared references. Eleven
copies add roughly 2.4MB, taking `skills/` from 6.6MB to about 9MB. That is the same trade the repository
already makes for references, and for the same stated reason at `docs/skills.md:80`: keeping each installation
independent.

**Duplicated executable code needs a stronger integrity claim than duplicated prose.** Eleven copies of a
document are eleven things to read; eleven copies of an executable are eleven things to trust. The existing
machinery covers it, because `references/bundle.json` already records `source_sha256` and `bundled_sha256` per
file and `--check` verifies both. Make it explicit and normative: every bundled copy of the runtime MUST be
byte-identical, asserted by a check, so a reviewer verifies one file and compares digests rather than reviewing
eleven. A divergent copy is a packaging failure, not a variant.

**Rejected placements.**

| Placement | Reason for rejection |
| --- | --- |
| One copy at `skills/_noetherkin/`, as originally proposed. | Unreachable for a selective install. This is the gap being closed. |
| Bundle into all 21 skills rather than 11. | Simpler rule, about 4.6MB instead of 2.4MB. Rejected because shipping an executable to a skill whose contract forbids canonical writes misstates what that skill can do. The boundary is worth keeping visible in the package. |
| Ship it in `onboarding` only; it installs a copy into the workspace that other skills invoke. | One copy, and it matches the adapters projecting onboarding alone. Rejected because it creates an install-order dependency, requires a new workspace path convention outside the closed `.apprenticeship/` layout in `state-model.md:5-20`, and breaks the independence property that makes a single-skill install meaningful. |
| A separate installable runtime skill that others declare a dependency on. | Avoids duplication. Rejected because the Skills CLI has no dependency resolution, so it reduces to telling the learner to run a second command and hoping they do. |

## 4. Rejected alternatives

| Alternative | Tradeoff and reason for rejection |
| --- | --- |
| Agent writes workspace YAML directly; no executable at all. | Simplest to ship and the largest regression. It abandons single-writer locking, digest checking and crash recovery, violating INV-018, and makes fabricated state trivial, violating INV-003. Rejected. |
| Publish a thin `noetherkin-cli` package; skills install separately. | Preserves provenance and OIDC trusted publishing, and keeps one canonical binary. Rejected because it retains the entire registry release process, which is the thing being removed, and leaves the two-part install the user is eliminating. |
| Fetch the runtime from GitHub at invocation time (`npx github:...`). | No registry. Rejected because it introduces a network dependency at the moment of a consequential write and a weaker integrity story than a checked-in file with a recorded digest. |
| Rewrite the publisher in Python or shell to avoid bundling. | Removes the Node requirement. Rejected as a large rewrite of 1,600 tested lines with no benefit that bundling does not already provide, and it would discard the test suite. |
| Vendor `ajv` and `yaml` into the bundled file, as this proposal originally specified. | Fastest path, no reimplementation risk. Rejected on the evidence in section 3.6: `ajv` was replaced in 190 reviewable lines with parity established over 122,804 differential cases, which is strictly better than shipping ~880KB of unreviewable vendored code that produces an opaque diff on every dependency bump. |

## 5. Version impact

None. No schema identifier, catalog version or wire protocol version changes. Record structure, semantics and
authority are untouched. This proposal is packaging only, which is why it is sequenced first.

## 6. Migration impact

No workspace migration. Existing `.apprenticeship/` directories are read and written identically by the same
code through a different entry point. Receipts, snapshots, locks and record bytes are unaffected.

A learner with a locally packed installation keeps a working `noetherkin` binary; it is simply no longer the
documented path. The documentation should say so rather than implying the old command stopped working.

## 7. Conformance

New cases, continuing from the current maxima (`CF-32`, `FR-28` in `docs/architecture/conformance.md`):

| ID | Scenario | Required behavior |
| --- | --- | --- |
| CF-33 | Bundled script invoked from a skill directory with no `node_modules` present | Complete the full journey; validation, locking, receipts and recovery behave identically to the built binary. |
| CF-34 | Skill bundle regenerated and checked | Bundled script digest recorded in `bundle.json`; `skills:check` fails on any drift between the source build and the checked-in file. |
| CF-50 | Single skill installed selectively with `--skill <name>` | A skill that carries the runtime is fully operable alone. A skill that does not is operable for its read-only and draft scope and directs no agent at a missing file. |
| CF-51 | Every bundled copy of the runtime compared across skills | All copies byte-identical, verified by digest. |
| FR-29 | Agent invokes a mutating command through a shell tool with no TTY | Return a proposal and exit 3. Publish nothing. No flag, environment variable or argument bypasses this. |
| FR-30 | Workspace contains hand-edited YAML using block syntax, bare `on`/`off`, or `012` | Parse under YAML 1.2 core-schema rules; strings stay strings. Never reinterpret under YAML 1.1 rules. Aliases, anchors, explicit tags, duplicate keys, multiple documents and non-JSON scalars are refused with a diagnostic naming the file and construct, never repaired by guesswork. |
| FR-31 | Skill description omits the discriminating "not Y" clause | `validateInstalled` rejects the bundle. |
| FR-52 | Bundled runtime copies diverge between two skills | Packaging fails. A divergent copy is never treated as a variant. |
| FR-53 | Skill whose contract permits no canonical write ships the runtime, or a skill that permits one omits it | Packaging fails, naming the skill and the contract mismatch. |

## 8. Open questions

- The bundled script is a build artifact checked into version control. That is already true of every file under
  `skills/*/references/`, so the practice is established, but this artifact is executable code rather than
  documentation. Whether reviewers can meaningfully review a bundled file, or should review only the source plus
  the digest, should be settled before adoption.
- `adapters/hosts/*` currently project only the `onboarding` skill. Since `onboarding` carries the runtime under
  section 3.7, the projection carries it too, and the remaining question is only whether a host projection may
  rewrite the invocation path it hands the agent.
