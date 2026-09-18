# Security review: public-release preparation

Date: 2026-09-17  
Scope: the Node.js CLI/package, repository automation, npm release path, and documented local-state trust boundary.

## Executive summary

No critical or high-severity vulnerability was confirmed in this release-preparation review. `npm audit --audit-level=high` reported zero known dependency vulnerabilities on 2026-09-17, and the complete local verification suite passed. This is a point-in-time dependency result, not proof that the package or its transitive dependencies are vulnerability-free.

The release supply chain is prepared around least-privilege GitHub Actions, immutable action commits, a protected environment, npm OIDC trusted publishing, provenance, exact-artifact promotion, dependency review, Dependabot and CodeQL. These controls are checked into the repository but are not active until the repository is published and its owner completes the settings in `docs/PUBLISHING_CHECKLIST.md`.

## Findings

### SEC-001: Release identity is not configured

- Severity: Medium, release blocker
- Status: Open, owner action required
- Evidence: `.github/workflows/release.yml:46` requires an `npm` environment and grants `id-token: write`; `package.json` targets `github.com/nanaagyei/noetherkin`, while local `origin` still uses the pre-rebrand repository URL; `docs/PUBLISHING_CHECKLIST.md` lists the repository-rename and trusted-publisher setup.
- Risk: publishing before the GitHub repository, npm owner and trusted-publisher relationship agree could fail, produce incomplete provenance, or tempt maintainers to introduce a long-lived token.
- Required action: configure the exact GitHub repository/workflow/environment relationship in npm, protect the `npm` environment, then run the workflow manually before publishing a release.

### SEC-002: Repository security controls are not active

- Severity: Medium, release blocker
- Status: Open, owner action required
- Evidence: `.github/workflows/codeql.yml:1`, `.github/workflows/dependency-review.yml:1` and `.github/dependabot.yml:1` define automation; `docs/PUBLISHING_CHECKLIST.md:32` lists the settings that cannot be enabled locally.
- Risk: checked-in workflows alone do not enable private vulnerability reporting, branch protection, required checks, the dependency graph, or alerting.
- Required action: complete the GitHub settings checklist and verify each workflow succeeds on the public repository before the first release.

### SEC-003: Vulnerability-report fallback is intentionally non-specific

- Severity: Low
- Status: Accepted for pre-release; revisit at publication
- Evidence: `SECURITY.md:11` directs reporters to GitHub private vulnerability reporting, with the owner's private profile contact as fallback.
- Risk: if private reporting is unavailable and the owner profile has no private contact, a reporter may lack a safe channel.
- Required action: after the public repository and maintainer identity exist, verify private reporting and add a dedicated security contact if the fallback is inadequate.

## Controls implemented

- CI has read-only default repository permissions and separates runtime, protocol, dependency and package jobs (`.github/workflows/ci.yml:9`).
- Release publication alone receives `id-token: write`, is gated by the `npm` environment, and downloads the already verified artifact (`.github/workflows/release.yml:45`).
- All third-party workflow actions are pinned to full immutable commit SHAs and are covered by Dependabot.
- The package declares public provenance and does not contain a registry token or token-based release secret.
- The release gate rejects missing licensing and repository metadata before publication (`scripts/check-release.mjs:1`).
- The package allowlist excludes source tests, repository workflows, local apprenticeship state, drafts, artifacts and environment files.
- The security policy documents that the local filesystem owner remains able to rewrite state and receipts (`SECURITY.md:24`).

## Residual trust boundaries

- Noetherkin is not a multi-tenant sandbox, identity provider, or tamper-proof evidence ledger.
- GitHub-hosted CI validates Linux and macOS behavior, but local test success does not substitute for the first live CI run.
- CodeQL, audit and dependency review reduce known risks; they do not establish absence of vulnerabilities.
- Model or chat output does not confer consent. Canonical mutation remains bound to the direct terminal controller and existing state checks.
- Apache-2.0 is selected. Brand and content distribution rights remain legal publication gates rather than technical security findings.
