# Capability host compatibility

Checked 2026-09-17. “Implemented” means this repository has a host profile, bundle projection, capability probe and shared offline onboarding conformance coverage. It does not mean every host feature or all 21 capabilities are integrated.

| Host | Status | Onboarding interface projection | Probe | Canonical writes | Evidence |
| --- | --- | --- | --- | --- | --- |
| Generic Agent Skills host | Implemented reference | `capability:onboarding` descriptor plus automatic discovery where supported | Contract version | Trusted terminal handoff | Shared offline conformance suite |
| Codex | Implemented reference | `$onboarding` and automatic skill discovery | CLI version, with bundled-app fallback | Trusted terminal handoff | Shared offline conformance suite; existing Codex behavioral/runtime adapters remain separate |
| Claude Code | Implemented reference | `/onboarding` and automatic skill discovery | CLI version | Trusted terminal handoff | Shared offline conformance suite; existing Claude behavioral-eval adapter remains separate |
| Cursor | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| Gemini | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| Windsurf | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| OpenCode | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| Pi | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| Kiro | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |
| OpenHands | Research candidate | Unknown | Not implemented | Proposal-only by default | No conformance claim |

Before promoting a research candidate to an implementation, record its official extension documentation, installation/discovery behavior, explicit invocation forms, argument transport, workspace rules, tool/isolation controls, structured-output support, session continuation and consent limitations. Then run the shared onboarding suite without changing the portable capability.
