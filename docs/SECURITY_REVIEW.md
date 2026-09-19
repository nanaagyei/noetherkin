# Security review: public-release preparation

Date: 2026-09-19
Scope: the Node.js CLI/package, repository automation, npm release path, and documented local-state trust boundary.

## Executive summary

No critical or high-severity code vulnerability was confirmed in this release-preparation review. `npm audit --audit-level=high` reported zero known dependency vulnerabilities on 2026-09-19, and the complete local and GitHub verification suites passed. This is a point-in-time dependency result, not proof that the package or its transitive dependencies are vulnerability-free.

The release supply chain uses least-privilege GitHub Actions, immutable action commits, an npm environment, provenance, exact-artifact promotion, dependency review, Dependabot and CodeQL. The main ruleset and CI controls are active. npm trusted publishing and public-repository security activation remain incomplete, and historical pull-request references must be purged before the repository becomes public.

## Findings

### SEC-001: Release identity is not configured

- Severity: Medium, release blocker
- Status: Open, owner action required
- Evidence: `.github/workflows/release.yml` requires the existing `npm` environment and grants `id-token: write`; repository and package identities agree, but no npm owner or trusted publisher is configured yet.
- Risk: publishing before the GitHub repository, npm owner and trusted-publisher relationship agree could fail, produce incomplete provenance, or tempt maintainers to introduce a long-lived token.
- Required action: create the npm account with 2FA, bootstrap the package if npm requires an existing package, configure the exact trusted-publisher relationship, then protect the `npm` environment before publishing a release.

### SEC-002: Public security activation is pending

- Severity: Medium, release blocker
- Status: Open, visibility change required
- Evidence: the active main ruleset requires pull requests, conversation resolution, strict up-to-date branches, and seven first-party checks. Dependabot reports no open alerts. CodeQL and dependency review workflows pass their private-repository fallback paths, while GitHub secret scanning and code-scanning alerts remain unavailable for this private user-owned repository.
- Risk: passing fallback jobs do not establish that public CodeQL, dependency review, secret scanning, and push protection are active.
- Required action: after GitHub Support confirms the historical purge, make the repository public and verify the real public security checks before the first release.

### SEC-003: Vulnerability-report fallback is intentionally non-specific

- Severity: Low
- Status: Accepted for pre-release; revisit at publication
- Evidence: `SECURITY.md:11` directs reporters to GitHub private vulnerability reporting, with the owner's private profile contact as fallback.
- Risk: if private reporting is unavailable and the owner profile has no private contact, a reporter may lack a safe channel.
- Required action: after the public repository and maintainer identity exist, verify private reporting and add a dedicated security contact if the fallback is inadequate.

### SEC-004: Historical evaluation artifacts remain in GitHub pull-request refs

- Severity: High privacy, publication blocker
- Status: Awaiting GitHub Support
- Evidence: all branch history was rewritten to remove `evaluations/behavior`, personal paths, session metadata, raw transcripts, and the old personal commit email. GitHub still retains read-only refs for pull requests 1, 2, and 3.
- Risk: making the repository public before those refs and cached views are purged could expose the removed artifacts through historical pull-request data.
- Required action: ask GitHub Support to dereference the three affected pull requests, remove cached views, and garbage-collect the old objects. Keep the repository private until Support confirms completion.

## Controls implemented

- CI has read-only default repository permissions and separates runtime, protocol, dependency and package jobs (`.github/workflows/ci.yml:9`).
- Release publication alone receives `id-token: write`, targets the `npm` environment, and downloads the already verified artifact (`.github/workflows/release.yml:45`).
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
