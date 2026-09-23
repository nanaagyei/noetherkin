# Portable apprenticeship skills

The 21 directories under `skills/` contain individually installable procedures. Each includes focused references and a proposal template. Skills provide mentoring and inspection, direct the supported PetClinic CLI workflow, and retain drafts for operations outside that slice. Canonical writes go only through the CLI publisher.

| Skill | Responsibility | Protocol role |
| --- | --- | --- |
| onboarding | Goals, environment readiness and baseline handoff | onboarding-coordinator |
| projects | Catalog discovery and supported PetClinic selection | project-curator |
| task-assignment | Bounded problem, criteria and investigation prompt | team-lead |
| teach | Minimal conceptual help and teach-back | peer-engineer |
| peer-engineer | Hypotheses and discriminating experiments | peer-engineer |
| code-review | Findings for one fixed change revision | peer-engineer |
| team-lead | Baseline, design, evidence and acceptance assessment | team-lead |
| manager | Performance patterns and next-scope recommendations | manager |
| codebase-map | Learner-authored source orientation | peer-engineer for assistance |
| debug | Causal investigation and discriminating experiments | peer-engineer |
| architecture | Boundary and trade-off analysis | peer-engineer for assistance |
| design-review | Exact-revision design checkpoint | team-lead |
| benchmarks | Controlled performance measurements | peer-engineer; team-lead verifies evidence |
| user-agent | Bounded simulated-user feedback | user-agent |
| production-readiness | Release/operability risk assessment | team-lead |
| incident-response | Safely bounded incident exercises | team-lead |
| performance-review | Exact-period performance synthesis | manager |
| promotion-review | Adjacent-level decision proposal | promotion-reviewer |
| performance-improvement-plan | Non-employment learning recovery plan | manager |
| resume-evidence | Learner-owned derived evidence export | learner |
| retrospective | Learner-authored prediction/outcome reflection | none for read-only facilitation |

Roles are not created by skill installation. The reviewed CLI initialization registers learner, onboarding coordinator, project curator, peer engineer, team lead and manager. It does not register a user-agent or promotion reviewer or publish their judgments. The controller binds principals only to supported operations; model output cannot declare authority. Read-only guidance can operate without a task or CLI.

## Install a skill

From the project where you want to use Noetherkin, install from the public GitHub repository:

```sh
npx skills add nanaagyei/noetherkin
```

The installer discovers the available skills and lets you choose the target agent. You can list or select skills explicitly:

```sh
npx skills add nanaagyei/noetherkin --list
npx skills add nanaagyei/noetherkin --skill onboarding
```

For a global installation or an explicit agent target, use the Skills CLI flags:

```sh
npx skills add nanaagyei/noetherkin --skill onboarding --global --agent codex
```

This uses the documented GitHub-source, skill-selection, scope and agent-targeting options in the [Skills CLI](https://github.com/vercel-labs/skills). The directory/frontmatter format follows the [Agent Skills specification](https://agentskills.io/specification). Documentation checked 2026-09-13; external installer behavior is not exercised by the repository tests.

Alternatively, copy one entire skill folder to the skills directory supported by your harness. Keep `SKILL.md`, `references/` and `assets/` together. No sibling skill, original checkout or model vendor is required to read the bundle. Invocation/discovery conventions still depend on the harness. The runtime includes local Codex and Claude Code role adapters plus the vendor-neutral adapter contract. Avoid overwriting an unrelated installed skill with the same short name.

From a checkout, `noetherkin skills install --host <generic|codex|claude-code> --target <directory>` copies all 21 bundles, or those named with repeated `--skill`, into that host's skill directory with digest verification and no overwrites. The [capability host adapters](adapters.md) project the same portable bundle into generic, Codex and Claude Code host locations. A host expression such as `/onboarding` or `$onboarding` is an invocation surface, not the identity of the `onboarding` capability. Consent-bearing operations still use the trusted terminal handoff.

Noetherkin is not published to a package registry. The CLI is built from a checkout and requires Node.js 24+; see the [CLI guide](cli.md). Installing a skill alone does not initialize a learner workspace or configure an agent harness.

## Persistent drafts

In an active learner workspace, unsupported writes use `apprenticeship-drafts/`, beside `.apprenticeship/`. A proposal folder contains numbered Markdown revision files and a review log once someone actually reviews it. Each revision pins its canonical inputs, inspected artifacts and exact draft dependencies. Unavailable identifiers and facts remain unresolved.

Review notes apply only to the named revision. On changed inputs, retain the earlier proposal and approval, describe differences in a new revision, and request fresh review. An approved baseline draft may inform a conditional onboarding draft but cannot complete onboarding or fill a canonical baseline pointer. Missing dependencies block affected conclusions.

Drafts are ordinary editable files. Their review notes do not authenticate actors, enforce concurrency, authorize publication or implement the protocol's transactional history. No apply/import command exists. Do not copy drafts into `.apprenticeship/`. Paused and archived workspaces remain read-only for draft persistence in this release.

Read the shared [runtime guide](../skill-pack/runtime.md), [draft procedure](../skill-pack/proposals.md) and [template](../skill-pack/proposal.md). The generated [onboarding runtime copy](../skills/onboarding/references/runtime.md) demonstrates their relocated installed paths.

## Maintain the bundles

Authoritative protocol sources stay in their existing locations. Entrypoints live directly in `skills/<name>/SKILL.md`. The [manifest](../skill-pack/manifest.json) selects shared resources, and [the packaging helper](../scripts/package-skills.mjs) generates each bundle:

```sh
npm run skills:bundle
npm run skills:check
npm test
```

The full frozen schema/catalog set and shared protocol guidance are bundled with every skill. Manifest format 2 adds only the invoked contract and explicit handoff contracts to each package. This keeps installations independent without copying all 21 contracts into each skill. Loading is progressive: runtime and the invoked contract first, then only relevant references.

Generated Markdown changes local link locations, not protocol semantics. The reference index maps original source paths to installed files. Each `references/bundle.json` records source and output SHA-256 digests, the source-manifest digest and index digest. Explicitly listed historical/index citations remain plain repository context; an unlisted missing dependency fails generation. Check mode performs no writes and fails on drift, extra resources or broken installed links. Edit source guidance, regenerate and review; never hand-edit generated references.

`npm pack` runs the bundle check before building; the tarball is retained as a portability check, not a release artifact. Tests copy skills away from the checkout, compile bundled schemas, inject broken references/content, and verify npm contents. Behavioral cases cover every skill, including authority, stale-input, fabricated-evidence, untrusted-artifact and draft-idempotency failures. These checks establish artifact portability and bounded behavior, not educational effectiveness. See [behavioral evaluation cases](../evaluations/skills-behavior.md) for the manual acceptance procedure.
