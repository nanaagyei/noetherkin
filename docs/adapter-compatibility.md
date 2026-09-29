# Capability host compatibility

Checked 2026-09-17; projection widened 2026-09-23. “Implemented” means this repository has a host profile, a byte-identical bundle projection for all 21 capabilities, a capability probe and shared offline onboarding conformance coverage. Only `onboarding` has a host invocation bridge; invoking any other capability through an adapter returns `blocked` with `NO_CONTROLLER_BRIDGE`, and the capability runs through its installed `SKILL.md` and the CLI commands it names. It does not mean every host feature is integrated.

| Host | Status | Interface projection (all 21 capabilities) | Probe | Canonical writes | Evidence |
| --- | --- | --- | --- | --- | --- |
| Generic Agent Skills host | Implemented reference | `capability:<id>` descriptor plus automatic discovery where supported | Contract version | Trusted terminal handoff | Shared offline conformance suite |
| Codex | Implemented reference | `$<id>` in `.agents/skills/<id>` (project) or `~/.agents/skills/<id>` (user) and automatic skill discovery | CLI version, with bundled-app fallback | Trusted terminal handoff | Shared offline conformance suite; existing Codex behavioral/runtime adapters remain separate |
| Claude Code | Implemented reference | `/<id>` in `.claude/skills/<id>` (project) or `~/.claude/skills/<id>` (user) and automatic skill discovery | CLI version | Trusted terminal handoff | Shared offline conformance suite; Claude behavioral-eval and role adapters remain separate |
| Cursor | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| Gemini | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| Windsurf | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| OpenCode | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| Pi | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| Kiro | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| OpenHands | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |

## Verified skill discovery

Automatic discovery after `noetherkin skills install` was checked on 2026-09-28 on macOS. Claude Code 2.1.284 and Codex 0.158.0 each found the installed `onboarding` skill at user level and at project level. Each routed an unnamed onboarding request to it, loaded it when named, listed it, and loaded no other skill. The procedure, the evidence rules and the per-case table are in [skill-discovery-check.md](skill-discovery-check.md); rerun it with `npm run evals:discovery` after a host upgrade. This covers `onboarding` only.

Before promoting a research candidate to an implementation, record its official extension documentation, installation/discovery behavior, explicit invocation forms, argument transport, workspace rules, tool/isolation controls, structured-output support, session continuation and consent limitations. Then run the shared onboarding suite without changing the portable capability.
