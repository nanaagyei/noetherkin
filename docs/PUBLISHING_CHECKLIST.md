# Publishing checklist

This is the release gate for Noetherkin's first public repository and npm package. Complete the sections in order. Do not publish a GitHub release until npm publishing is configured: a published GitHub release activates `.github/workflows/release.yml`.

## Current readiness

| Area | Status | Evidence or blocker |
| --- | --- | --- |
| Runtime and protocol | Ready for review | `npm run verify` exercises runtime tests, skill packaging, foundation validation, and frozen conformance cases. |
| Package contents | Ready for review | CI creates and retains the npm tarball for inspection. |
| Security automation | Configured locally | CI audit, dependency review, CodeQL, Dependabot, pinned actions, and private-reporting policy are present. They become effective after GitHub publication and repository settings are enabled. |
| npm name | Apparently available | `noetherkin` returned `E404` during the preliminary screen on 2026-09-18. This is not a reservation; check again immediately before publishing. |
| License | Complete | Apache-2.0 is declared in `package.json`, linked from the README, and included as `LICENSE`. |
| GitHub publication | **Blocked** | Package and README metadata target `github.com/nanaagyei/noetherkin`, while local `origin` still points to the pre-rebrand `github.com/nanaagyei/devstride.git`. Rename the repository, update `origin`, then push and verify protection under the new identity. |
| Release identity | **Blocked** | The npm owner, trusted publisher, GitHub `npm` environment, and approval policy require maintainer setup. |
| Brand rights | Needs confirmation | Preliminary exact-name checks found no direct collision, but legal clearance and the right to distribute `noetherkin-logo.png` still require owner confirmation. |

The project is technically close, but it is not ready to call open source or publish to npm until every blocking row is resolved.

## 1. Legal and project identity

- [x] Choose Apache-2.0 with owner approval. It is permissive and adds an explicit patent grant for a reusable protocol, CLI, adapter, and skill ecosystem.
- [x] Add the complete license text as `LICENSE`.
- [x] Declare the `Apache-2.0` SPDX identifier in `package.json`.
- [x] Link the README badge and license section to the selected license.
- [ ] Confirm the copyright holder and year used by the license, if required.
- [ ] Complete an appropriate trademark/common-law clearance for Noetherkin and confirm the rights to publish `noetherkin-logo.png`, examples, catalogs, and all bundled prose.
- [ ] Decide whether a `NOTICE` file is required, especially if Apache-2.0 or third-party notices apply.
- [ ] Adopt a contributor license agreement or developer certificate of origin only if project governance actually needs one; do not add process theater by default.
- [ ] Select a dependency-license policy, then configure `deny-licenses` in dependency review if the policy requires it.

## 2. Create and configure the GitHub repository

- [ ] Rename or create the repository at `https://github.com/nanaagyei/noetherkin` with the intended visibility and ownership.
- [x] Configure package metadata for `git+https://github.com/nanaagyei/noetherkin.git`.
- [ ] After the GitHub rename, run `git remote set-url origin https://github.com/nanaagyei/noetherkin.git` and verify with `git remote -v`.
- [ ] Commit and push the reviewed initial history to `main`.
- [ ] Create `release/dev` immediately after the initial push. CI and CodeQL validate pushes to both `main` and `release/dev`; Dependabot targets `release/dev`; release publication remains gated separately.
- [ ] Confirm the clone, repository, homepage, issue, and badge URLs resolve after the GitHub rename.
- [x] Add repository-backed CI and CodeQL badges. Confirm they resolve after the initial push.
- [ ] Add npm version and release badges after the first successful publication.
- [ ] Add a concise GitHub description, topics, and social preview image.
- [ ] Enable Issues and Discussions only if maintainers intend to support them.
- [ ] Enable private vulnerability reporting under **Settings → Security → Code security**.
- [ ] Enable the dependency graph, Dependabot alerts, and Dependabot security updates.
- [ ] Enable code scanning with the checked-in CodeQL workflow.
- [ ] Review the default `GITHUB_TOKEN` setting and keep permissions read-only unless a job grants a narrower explicit permission.
- [ ] Add `CODEOWNERS` after the maintainer identity is known; require its review only when that rule is sustainable.
- [ ] Disable force pushes and branch deletion on `main`.
- [ ] Protect `main` with pull requests, conversation resolution, and required checks: both runtime matrix jobs, frozen protocol validation, dependency audit, dependency review, package inspection, and CodeQL.
- [ ] Require at least one approving review once a second trusted maintainer exists. Do not create an impossible solo-maintainer rule.
- [ ] Require signed commits or signed tags only after documenting a workable maintainer process.

## 3. Configure npm ownership and trusted publishing

- [ ] Create or select the npm owner or organization and require two-factor authentication for maintainers.
- [ ] Recheck `npm view noetherkin`; an earlier `E404` does not reserve the name.
- [ ] Decide whether the unscoped name is appropriate. If not, update the package name, binary documentation, tests, workflow tarball glob, and examples together.
- [ ] Create a protected GitHub environment named `npm` and add required reviewers for production publication.
- [ ] Configure npm trusted publishing for the exact GitHub owner, repository, and `.github/workflows/release.yml` workflow, using the `npm` environment when npm exposes that option.
- [ ] If npm cannot configure a trusted publisher until the package exists, perform the one-time bootstrap publish manually from the already inspected tarball with a narrowly scoped credential and 2FA. Immediately configure trusted publishing and revoke the bootstrap credential. Never commit or persist the token in Actions.
- [ ] Confirm that publication uses a GitHub-hosted runner, Node.js 24+, npm 11.5.1+, and `id-token: write`. The workflow currently pins npm 11.9.0.
- [ ] Run the release workflow with `workflow_dispatch` before the first release. It must verify and package, but its publish job must remain skipped.

## 4. Prepare a release candidate

- [ ] Ensure the working tree contains only intended release changes.
- [ ] Update `CHANGELOG.md`, replace `Unreleased` for the target version with the release date, and retain a fresh Unreleased section.
- [ ] Set one semantic version in `package.json` and `package-lock.json`.
- [ ] Install from the lockfile and run the complete checks:

  ```sh
  npm ci --ignore-scripts
  python3 -m pip install --requirement requirements-validation.txt
  npm run verify
  npm audit --audit-level=high
  npm run release:check
  ```

- [ ] Inspect the generated tarball rather than trusting the manifest summary:

  ```sh
  npm run prepack
  npm pack --ignore-scripts --json
  npm run package:check
  tar -tf noetherkin-<version>.tgz
  ```

- [ ] Confirm the tarball contains the CLI, generic/Codex/Claude onboarding adapters, schemas, catalogs, skills, README, changelog, security policy, and normative documentation.
- [ ] Confirm it excludes source tests, local state, drafts, artifacts, credentials, environment files, caches, and unrelated working files.
- [ ] Install the tarball into a fresh temporary directory and smoke-test `noetherkin --help`, `init`, `validate`, and an onboarding no-change cycle.
- [ ] Review the GitHub Actions logs and downloaded `release-candidate` artifact.
- [ ] Re-run the documented Codex and Claude capability probes if either host version or adapter behavior changed.
- [ ] Obtain the maintainer approval required by the `npm` environment.

## 5. Publish

- [ ] Merge the release commit through the protected branch.
- [ ] Create a GitHub release tagged exactly `v<package-version>` from the reviewed commit and include the changelog entry as release notes.
- [ ] Publish the GitHub release only when the npm environment and trusted publisher are ready. Publication triggers verification and, after environment approval, publishes the exact verified tarball.
- [ ] Do not add `NPM_TOKEN` to the workflow when trusted publishing is working.
- [ ] If any verification job fails, fix forward with a reviewed change. Do not bypass or weaken the check to make the release pass.

## 6. Verify after publication

- [ ] Confirm the registry version and metadata:

  ```sh
  npm view noetherkin version dist.integrity repository
  npm view noetherkin --json
  ```

- [ ] Verify the npm page displays provenance for the published version.
- [ ] Install by version in a clean directory and repeat the CLI smoke test.
- [ ] Confirm the GitHub release points to the same commit and has successful release checks.
- [ ] Confirm README Actions, npm version, license, and release badges resolve correctly.
- [ ] Announce the release only after the registry and install checks pass.
- [ ] Update `SECURITY.md` with a supported-version table.
- [ ] Record any deviation or manual bootstrap step in the release notes and project decisions.

## Recovery rules

- Prefer a corrected patch release over unpublishing. npm unpublish affects downstream users and package-name reuse.
- Deprecate a compromised or unusable version with an actionable message while preparing the corrected release.
- If credentials were exposed, revoke them first, preserve evidence, rotate affected access, and follow `SECURITY.md`.
- If provenance, repository identity, or the packed contents do not match expectations, stop publication and investigate. Do not treat a successful registry upload as proof of release integrity.
