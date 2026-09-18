# Security policy

## Supported versions

Noetherkin is currently pre-release. Security fixes are applied to the latest code on the default branch. A supported-version table will be added after the first stable release.

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in a public issue, discussion, pull request, transcript, or apprenticeship artifact.

After this repository is published on GitHub, use **Security → Report a vulnerability** to open a private vulnerability report. If private vulnerability reporting is temporarily unavailable, contact the repository owner through the private contact method listed on their GitHub profile and include only enough information to establish contact.

Please include:

- the affected version or commit;
- the security boundary involved;
- reproducible steps or a minimal proof of concept;
- potential impact;
- any known mitigations;
- whether public disclosure has already occurred.

Maintainers should acknowledge a report within five business days, establish severity and next steps after reproducing it, and coordinate disclosure with the reporter. These are response targets, not contractual guarantees.

## Security boundaries

Noetherkin is a local protocol implementation, not a credential-grade identity system or hardened multi-tenant sandbox. Its controller protects canonical state through explicit local consent, role binding, closed schemas, safe path handling, immutable records, stale-read checks, durable receipts, and recoverable transactions. A local filesystem owner can still rewrite both records and receipts.

The project must never automatically access secrets, push or merge code, deploy systems, modify remote infrastructure, delete repositories, or force-reset Git. Those operations require separate explicit user authorization and remain outside the current runtime.

## Supply-chain policy

- Release publication uses npm trusted publishing with GitHub Actions OIDC; long-lived npm write tokens are not used.
- Release jobs use GitHub-hosted runners and publish npm provenance.
- Workflow actions are pinned to immutable commits and updated through Dependabot.
- CI runs dependency audit, CodeQL, dependency review, package inspection, and the complete protocol/runtime validation suite.
- Maintainers review the packed tarball before approving a release.
