# Launch post outline

Not published by CI. This is an outline for the maintainer to write from: structure, the claims the post may make,
and the evidence behind each one. It is deliberately not finished prose. Every claim below links to its evidence;
anything that cannot be supported is marked `[VERIFY]` and must be resolved or cut before posting.

Rules for the post (from the charter and `IMPLEMENTATION_STATUS.md`):

- No user counts, adoption metrics or testimonials. None exist.
- Every non-learner role is simulated. Say so wherever a review or verdict appears.
- A forge is learner-authored software built in a simulated process. It has no users or production deployment.
- Say what is proven and what is not, with links.

## 1. The problem

- Agents make it easy to ship code you do not understand. The post's own framing; cite the charter's statement of
  the problem rather than invented statistics. Evidence: [PROJECT_CHARTER.md](../../PROJECT_CHARTER.md).
- Learners either read a stranger's large codebase before learning anything, or learn in exercises with no stakes.
  Evidence: the contradiction ACP-015 resolved, [FOUNDATION_CHANGELOG.md](../../FOUNDATION_CHANGELOG.md) (Phase 13).
- `[VERIFY]` Any claim about how common this is among learners needs a real source or must be cut.

## 2. What Noetherkin does differently

One short paragraph per point, each with one link:

- **The learner is the engineer.** Skills teach and gate; they do not write the learner's work. The map (FR-48) and
  the session reflection (FR-64) are refused if asked for. Evidence:
  [conformance.md](../architecture/conformance.md), rows FR-48 and FR-64.
- **Consent is typed, not assumed.** Initialization, track selection and onboarding need the learner at a terminal;
  an agent receives a handoff, never authority. Evidence: [cli.md](../cli.md) and
  [permissions-model.md](../architecture/permissions-model.md).
- **Progress is evidence, not vibes.** Findings cite evidence records; a passed teach-back check is at most weak
  evidence for communication (FR-49). Evidence: [evidence-model.md](../architecture/evidence-model.md),
  [judgment-validity.md](../architecture/judgment-validity.md).
- **Simulated roles, named as simulated.** A team lead, peer engineer and manager review work through bounded model
  judgments. Evidence: the demo recording's own output ("Asking the team lead for a judgment through claude") and
  [review-model.md](../architecture/review-model.md).
- **Forges: build from empty, with a real failure mode.** Seven draft specifications, each with a four-task pack and
  no shipped solution. Evidence: [catalog/forge/](../../catalog/forge/) and
  [forge-authoring.md](../forge-authoring.md).
- **Real open-source projects, pinned.** Curated packs on Spring PetClinic, pytest 9.1.1 and textlint v15.8.0, each a
  training task on a gap confirmed at that revision. Evidence: [IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md)
  ("Curated upstream packs").
- **Agent-agnostic.** Codex and Claude Code both serve as role adapters and skill hosts. Evidence:
  [adapter-compatibility.md](../adapter-compatibility.md).

## 3. Show it

- Embed the recording: [noetherkin-demo.gif](../assets/noetherkin-demo.gif), regenerated with
  `vhs docs/demo/setup.tape` ([setup.tape](../demo/setup.tape)). Keep its caption: a real session on the v0.2.0 release,
  genuine Claude Code judgments, a simulated reviewer, a demo learner and design. A 60-second launch video is attached
  to the [v0.2.0 release](https://github.com/nanaagyei/noetherkin/releases/tag/v0.2.0).
- Optionally the shareable report: `noetherkin report` output from a real workspace. Evidence:
  [cli.md](../cli.md) (`report`).

## 4. What is proven and what is not

Link straight to the limits rather than summarizing them away. Evidence:
[IMPLEMENTATION_STATUS.md](../../IMPLEMENTATION_STATUS.md), the "Limits" paragraph of each section.

- Proven offline: the lifecycle, permissions, crash recovery and every forge and curated pack's journey, on macOS,
  Linux and Windows CI. Evidence: [conformance.md](../architecture/conformance.md) and the `Runtime` CI jobs.
- Smoke-tested live: behavioral cases, one execution per host, reviewed by the maintainer. Evidence:
  [conformance.md](../architecture/conformance.md) (behavioral rows) and `IMPLEMENTATION_STATUS.md`.
- Not proven: that it improves learning. No learner study exists. No forge has been built end to end by a real
  learner, so all seven ship as `draft`. No one has yet performed the pytest or textlint task against the real
  repository.
- `[VERIFY]` If the maintainer has completed a forge or a curated task by launch day, cite that run and its limits
  here; otherwise keep the sentence above.

## 5. Try it

- Install and start: the commands in [README.md](../../README.md) ("Install" and "Start a workspace"). Needs Node.js
  24+, Git, and Codex or Claude Code for role judgments.
- Point at `noetherkin setup` and `noetherkin next`.

## 6. Contribute a forge

- The fastest way to grow the catalog: `noetherkin forge new`, write the specification, and run
  `noetherkin forge check` until it is clean. Evidence: [forge-authoring.md](../forge-authoring.md) and
  [CONTRIBUTING.md](../../CONTRIBUTING.md) ("Authoring a forge").
- Curated packs for more open-source projects follow the pytest and textlint examples in [tasks/](../../tasks/).

## Before posting

- [ ] Every `[VERIFY]` resolved or cut.
- [x] The release that contains these features is published (v0.2.0), and the recording is regenerated against it
      (`NOETHERKIN_TGZ=https://github.com/nanaagyei/noetherkin/releases/latest/download/noetherkin.tgz vhs docs/demo/setup.tape`).
- [ ] No number appears without a linked source.
