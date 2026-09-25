# Publishing checklist

This is the release gate for Noetherkin's public repository. Complete the sections in order. There is no npm package: ACP-012 retired registry publication, so a published GitHub release only triggers verification.

## Current readiness

| Area | Status | Evidence or blocker |
| --- | --- | --- |
| Runtime and protocol | Ready for review | `npm run verify` exercises runtime tests, skill packaging, foundation validation, and frozen conformance cases. |
| Package contents | Ready for review | CI creates and retains the npm tarball for inspection. |
| Security automation | Pre-publication verified | The main ruleset and CI are active. Public CodeQL, dependency review, secret scanning, and push protection require the later visibility change and another verification pass. |
| npm name | Not applicable | ACP-012 retired registry publication. The name is deliberately unclaimed. |
| License | Complete | Apache-2.0 is declared in `package.json`, linked from the README, and included as `LICENSE`. |
| GitHub publication | Ready for visibility change | Cleaned history is on `main` and `release/dev`. GitHub Support confirmed the pull request 1-3 purge (owner-confirmed). Making the repository public is the remaining owner action. |
| Release identity | Not applicable | No registry publication, so no npm owner, trusted publisher or release-environment approval is required. |
| Brand rights | Confirmed | Owner completed name clearance and confirmed the right to distribute the Noetherkin logo assets. |

The source repository is published under Apache-2.0. There is no npm publication to gate.

## 1. Legal and project identity

- [x] Choose Apache-2.0 with owner approval. It is permissive and adds an explicit patent grant for a reusable protocol, CLI, adapter, and skill ecosystem.
- [x] Add the complete license text as `LICENSE`.
- [x] Declare the `Apache-2.0` SPDX identifier in `package.json`.
- [x] Link the README badge and license section to the selected license.
- [x] Confirm the copyright holder and year used by the license. `NOTICE` records `Copyright 2026 Prince Agyei Tuffour`. `LICENSE` is left byte-for-byte as published by Apache, including its "how to apply" appendix template, because editing license text is discouraged.
- [x] Complete an appropriate trademark/common-law clearance for Noetherkin and confirm the rights to publish `noetherkin-logo.png`, `noetherkin-logo-light.png`, examples, catalogs, and all bundled prose. Owner-confirmed.
- [x] Decide whether a `NOTICE` file is required. Added at the repository root so it travels with every checkout and skill-based distribution. It currently carries only the project copyright; registry-resolved dependencies are not redistributed and are not listed.
- [ ] Adopt a contributor license agreement or developer certificate of origin only if project governance actually needs one; do not add process theater by default.
- [x] Select a dependency-license policy, then configure `deny-licenses` in dependency review. Strong copyleft (AGPL, GPL, SSPL) fails review, because it would be inconsistent with the outbound Apache-2.0 grant on a redistributed tool.

## 2. Create and configure the GitHub repository

- [x] Ask [GitHub Support](https://support.github.com/) to dereference affected pull requests 1-3, remove cached views, and garbage-collect the old objects.
- [ ] Make the repository public only after GitHub Support confirms that purge is complete.
- [x] Configure package metadata for `git+https://github.com/nanaagyei/noetherkin.git`.
- [x] Update local `origin` to `https://github.com/nanaagyei/noetherkin.git` and verify it.
- [x] Commit and push the reviewed initial history to `main`.
- [x] Create `release/dev`. CI and CodeQL validate pushes to both `main` and `release/dev`; Dependabot targets `release/dev`; release publication remains gated separately.
- [x] Confirm the clone, repository, homepage, issue, and badge URLs after the GitHub rename.
- [x] Add repository-backed CI and CodeQL badges. Confirm they resolve after the initial push.
- [x] Add a concise GitHub description and topics.
- [ ] Add a social preview image. A 1280x640 card is prepared at `docs/assets/social-preview.png` (79KB, under the 1MB limit). GitHub exposes no API for this, so upload it manually under **Settings -> General -> Social preview**.
- [x] Enable Issues and Discussions only if maintainers intend to support them. Issues on, Discussions off, Wiki disabled: an empty wiki tab on a public repository reads as abandonment, and a solo maintainer should not open a second inbox before the first one has traffic.
- [x] Enable private vulnerability reporting under **Settings → Security → Code security** (owner-confirmed).
- [x] Enable the dependency graph, Dependabot alerts, and Dependabot security updates (owner-confirmed).
- [x] Enable code scanning with the checked-in CodeQL workflow (owner-confirmed).
- [x] Review the default `GITHUB_TOKEN` setting and keep permissions read-only unless a job grants a narrower explicit permission (owner-confirmed).
- [x] Add `CODEOWNERS` after the maintainer identity is known; require its review only when that rule is sustainable. `.github/CODEOWNERS` assigns every path to `@nanaagyei`. Branch protection deliberately does not require that review yet, because a solo maintainer cannot satisfy an approval rule.
- [x] Disable force pushes and branch deletion on `main` (owner-confirmed).
- [x] Protect `main` with pull requests, conversation resolution, and required checks: both runtime matrix jobs, frozen protocol validation, dependency audit, dependency review, package inspection, and CodeQL (owner-confirmed).
- [ ] Require at least one approving review once a second trusted maintainer exists. Do not create an impossible solo-maintainer rule.
- [ ] Require signed commits or signed tags only after documenting a workable maintainer process.

## 3. Distribution

ACP-012 is adopted: Noetherkin is **not published to a package registry**, and no npm ownership, trusted
publisher or release environment is required. The previous sections on npm setup, release candidates,
publication and post-publication verification are removed rather than left as unreachable steps.

- [x] Retire registry publication. `package.json` is `private`, `publishConfig` and `prepublishOnly` are gone,
      and `.github/workflows/release.yml` keeps only its verification job.
- [ ] Cut a GitHub release when a version is worth marking. Tag exactly `v<package-version>` from a reviewed
      commit and use the changelog entry as release notes. The workflow verifies and retains a release
      candidate for inspection; nothing is uploaded anywhere.
- [ ] Keep `npm pack` green. The tarball is retained as a portability check, exercised by the package test,
      and is not a release artifact.

Capabilities install with `npx skills add nanaagyei/noetherkin`. The CLI is built from a checkout, as the
README describes. Bundling the CLI into the skill packages was proposed in ACP-012 section 3.7 and deferred:
with `yaml` retained under FR-21, it would mean vendoring a third-party parser into the repository and losing
dependency updates on it.
