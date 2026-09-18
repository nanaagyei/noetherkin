# Portable capability adapters

The portable unit is a capability such as `onboarding`. A host expression such as `/onboarding`, `$onboarding`, automatic discovery or a palette action is an interface to that capability. Host syntax is never a protocol prerequisite.

## Adapter boundaries

`CapabilityHostAdapter` projects a portable skill bundle into one host, reports the host features it can actually detect, and normalizes capability results. It does not interpret evidence, assume a protocol role or publish canonical state. `RoleAdapter` remains the separate interface for bounded role judgments inside a controller-owned workflow.

The generic onboarding bridge returns one of `needs-input`, `proposal`, `consent-required`, `completed`, `no-change` or `blocked`. It separates confirmed facts from unverified user/environment input and reports structured diagnostics. Codex and Claude Code use this same bridge.

## Trusted terminal handoff

Consent-bearing work produces an exact `adapter-handoff` command. Its transparent base64url payload binds:

- contract and capability version;
- resolved workspace path;
- action and correlation operation ID;
- proposal digest;
- every canonical state digest consulted by the proposal;
- the proposed inputs.

The token is not a credential or authorization. The terminal controller decodes it, verifies its closed envelope and proposal digest, checks the workspace and current state again, displays the proposal, and requires the learner to type the action-specific confirmation. Noninteractive execution returns a proposal without mutation. Canonical publication continues to use process-local capabilities, role binding, candidate validation and durable transactions.

The current onboarding handoff is intentionally stepwise: initialize, select a track, then complete onboarding. The host resumes the capability after each terminal action. This preserves the existing separate consent boundaries and lets a changed workspace invalidate only the pending handoff.

## Bundle projection

All projections read `skills/onboarding/` and its generated `references/bundle.json`. The adapter changes target paths and invocation metadata only. It does not rewrite `SKILL.md`, protocol references or their bytes. Bundle checks and adapter conformance tests compare every projected file digest across generic, Codex and Claude Code.

## Verification

Run:

```sh
npm test
npm run skills:check
```

The offline suite exercises the same onboarding sequence through all three adapters. A passing offline suite establishes adapter contract behavior and controller boundaries; it does not establish educational effectiveness or prove an external host version will preserve its interface indefinitely.
