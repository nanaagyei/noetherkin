# Contributing

Read [AGENTS.md](AGENTS.md), [PROJECT_CHARTER.md](PROJECT_CHARTER.md), [FOUNDATION_V1.md](FOUNDATION_V1.md), the relevant [architecture documents](docs/architecture/overview.md), and [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) before changing behavior.

The frozen schemas and catalogs remain under `schemas/` and `catalog/`. Do not redefine protocol 2.0 to accommodate an implementation shortcut. A blocking contradiction needs an architecture change proposal describing alternatives, migration/version effects, and conformance cases; continue independent work separately.

## AI-assisted contributions

AI tools are allowed, but the submitting contributor owns the result. Review every generated change, understand the affected invariants, and disclose material AI assistance in the pull request. Include what the tool helped with and what you personally verified.

Do not commit personal prompts, local agent settings, raw transcripts, hidden reasoning, credentials, private learner data, or unrelated machine context. Public agent instructions belong in [AGENTS.md](AGENTS.md); durable decisions belong in the architecture records. An agent must not push, merge, publish, deploy, or perform destructive actions unless a human explicitly authorizes that exact operation.

## Development

Use Node.js 24+, npm, and Python 3. The existing artifact checks also require PyYAML and jsonschema.

```sh
npm ci
python3 -m pip install --requirement requirements-validation.txt
npm run verify
```

The package test installs a freshly packed tarball offline into a temporary directory. Its pretest step resolves the declared production dependency ranges in a disposable directory, reusing the active npm cache and fetching missing registry artifacts when necessary; the actual tarball installation remains offline. Run installation and tests with the same npm cache. If your cache is elsewhere, pass `--cache /your/cache` to both npm commands. Runtime tests create disposable workspaces and include actual SIGKILL, lock contention, injected filesystem failures, and a pseudo-terminal test of learner consent. They do not evaluate an actual learner or run an upstream project.

The unchanged foundation link checker traverses every Markdown file, including ignored dependency directories. If dependency documentation causes unrelated broken-link failures, run it against a clean source snapshot without `node_modules/`, or temporarily move build dependencies aside and restore them afterward. Do not weaken foundation checks to accommodate third-party documentation.

## Implementation boundaries

- `cli/` collects input and formats results. Only its direct terminal controller requests learner consent.
- `core/` parses data, validates supported invariants, binds approved initialization, and publishes recoverable transactions.
- Public compatibility currently covers the executable and its documented JSON result envelope. Core modules are internal implementation details, not an adapter API.
- Keep clocks, IDs, filesystem operations, and failure boundaries injectable for tests. Never expose production crash switches or authorization bypasses through environment variables or CLI options.
- Add corresponding tests for schema, lifecycle, permission, or contract changes. Document actual checks and limitations in implementation status.

Do not publish the package, choose a license, push commits, submit PRs, or modify remote infrastructure as part of a local implementation change without the relevant authorization.

## Security and releases

Report suspected vulnerabilities through the private process in [SECURITY.md](SECURITY.md), never through a public issue. Release preparation follows [docs/PUBLISHING_CHECKLIST.md](docs/PUBLISHING_CHECKLIST.md). Contributors must not add registry credentials, signing keys, learner records, or secrets to the repository or its fixtures.

Every release-affecting change should update [CHANGELOG.md](CHANGELOG.md). `npm run release:check` is intentionally stricter than ordinary CI.

### Versions and releases

Feature and fix branches merge into `release/dev`. A pull request from `release/dev` into `main` must carry exactly one release label, which the **Release label** check enforces:

| Label | Meaning | Bump |
| --- | --- | --- |
| `release:major` | A breaking change: state, protocol or CLI behavior a learner relies on changes incompatibly | `1.4.2` → `2.0.0` |
| `release:minor` | A new feature that keeps existing workspaces and commands working | `1.4.2` → `1.5.0` |
| `release:patch` | A bug fix with no new behavior | `1.4.2` → `1.4.3` |
| `release:none` | Docs, tests or tooling only; no release | none |

When it merges, the **Release** workflow computes the next version from the latest `v*` tag, stamps it into the package, reruns `release:check`, and publishes a GitHub release with `noetherkin.tgz` attached. A push to `main` with no pull request falls back to Conventional Commit subjects (`feat:` minor, `fix:`/`perf:` patch, `!` or `BREAKING CHANGE:` major). Tags are the version source of truth, so the `version` in `package.json` is not bumped by hand. A maintainer can also run the workflow manually with an explicit bump. See ADR-018.
