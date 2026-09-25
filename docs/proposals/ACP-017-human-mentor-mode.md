# ACP-017: Human mentor mode

| Field | Value |
| --- | --- |
| Status | `PROPOSED` |
| Date | 2026-09-24 (America/Chicago) |
| Author | Noetherkin maintainers |
| Depends on | ACP-014 (advisory selection, for the review-request routing it names), ACP-015 (forge packs) |
| Blocks | none |
| Supersedes | none |

A real person can hold a reviewing role in a learner's workspace: peer engineer, team lead, manager or promotion
reviewer. Their judgments enter the same canonical record as the simulated roles', through the same closed
output contracts and the same single writer, and each record says honestly which kind of reviewer produced it.
The learner never types a mentor's verdict. The mentor signs it on their own machine, and the learner's CLI
verifies the signature before anything is published.

## 1. Contradiction

This proposal contradicts no normative statement, but it changes how a principal is authenticated, which the V1
freeze fixes. That makes it an architecture change rather than an implementation detail.

`docs/architecture/permissions-model.md:28` defines the binding every judgment relies on:

> The trusted local controller binds the authenticated user-approved invocation to an actor before interpreting
> task content; a declared ID in model output is not authentication.

Today every non-learner principal is simulated, and "the trusted local controller" is the CLI on the learner's own
machine invoking a model through a role adapter. That binding does not transfer to a person. A mentor's verdict
arrives from outside the learner's machine, and the learner controls everything on it. If the learner could
record "my mentor approved this", the controller would be binding the learner's own assertion to the mentor's
principal: the self-certification `PROJECT_CHARTER.md` section 9 ("All consequential evaluations should reference
evidence") and `permissions-model.md:28` exist to prevent.

`docs/architecture/permissions-model.md:26` also fixes the principal registry:

> Actor IDs and roles are permanent and never reassigned; role changes require a new ID. Registry rows retain
> `granted_at`, nullable `retired_at`, and an immutable learner authorization artifact.

A principal row has no notion of *what* holds the role. The schema (`schemas/apprenticeship-config.schema.json`,
`principals.items`) is closed with exactly `id`, `role`, `granted_at`, `retired_at` and `authorization`, so a
human reviewer cannot be distinguished from a simulated one in the record.

OQ-001 (`OPEN_QUESTIONS.md:7`) asks how independent reviewers should be calibrated against systematic model bias
and recommends "human-audited calibration scenarios before claiming trustworthy promotion quality". Nothing in
the protocol today lets a human judgment enter the record at all.

## 2. Proposed resolution

### 2.1 Human principals

A principal row gains an optional discriminator and, for humans, a verification key:

| Field | Required when | Meaning |
| --- | --- | --- |
| `kind` | optional; absent means `simulated` | `simulated` or `human` |
| `display_name` | `kind: human` | The name the mentor gave, shown in reviews and exports. Not verified. |
| `signing_key` | `kind: human` | The mentor's SSH public key (`ssh-ed25519 ...` or `ecdsa-sha2-...`), one line. |
| `key_corroboration` | optional | Artifact recording where the key was corroborated, e.g. that it is listed at `https://github.com/<user>.keys` on a stated date. |

Rules:

- Only `peer-engineer`, `team-lead`, `manager` and `promotion-reviewer` may be `human`. The learner, onboarding
  coordinator and project curator stay as they are.
- A human and a simulated principal may hold the same role at the same time. The learner chooses, per request,
  which one reviews.
- Registration follows `permissions-model.md:26` unchanged: a new permanent ID, explicit typed learner
  authorization, a durable receipt, and retirement at most once. Registration additionally requires the
  **mentor's signed acceptance**: a statement naming the workspace ID, the principal ID and the role, signed with
  the key being registered. A key that has not signed its own grant cannot be registered.
- The same `signing_key` may not be registered for two principals whose judgments must be independent: a team
  lead and the promotion reviewer of the same decision, or a manager and the promotion reviewer. The existing
  distinct-principal rules then hold for humans as they do for simulated roles.

New commands (all consent-bearing ones use typed confirmation in a direct terminal, as today):

```sh
noetherkin mentor add --role peer-engineer --name "Ada" --key "ssh-ed25519 AAAA..." [--github ada]
noetherkin mentor list
noetherkin mentor retire <principal-id>
```

`--github` fetches `https://github.com/<user>.keys` once, with learner authorization, and records whether the key
is listed there as a `key_corroboration` artifact. It corroborates; it does not authenticate a person.

### 2.2 Review round trip

A human review is asynchronous, so it is two published steps rather than one adapter call.

1. **Request.** `noetherkin review request code --reviewer <principal-id>` (likewise `task`, `performance`,
   and `submit-design` for the design gate) builds a **review packet** and asks the learner to confirm the
   export by typing `export`. The packet is a single file containing exactly:
   - the workspace ID, the task ID, the reviewer principal ID and role, and a random request nonce;
   - the frozen task, the design artifact, the change snapshot and the focused test runs the gate needs;
   - the role's closed output contract and the objective text the simulated role would have received;
   - `expected_state_digests` for every canonical file the judgment depends on, as onboarding handoffs use.

   It contains no other records, no learner profile beyond the display name, no evidence from other tasks and
   no transcripts. Exporting publishes a small `review-requested` marker on the task so `next` can say
   "waiting for Ada (peer engineer)". The task stays in its gate status. Nothing else is blocked: help, notes
   and learning continue.

2. **Review.** The learner sends the packet however they like. Transport is out of scope. The mentor runs
   `noetherkin mentor review <packet>` on their own machine. It needs no workspace and writes nothing but its
   output file. It shows the task, design, change and test runs, prompts for exactly the contract's output
   keys (for a code review: `outcome` and `findings`), and writes a **mentor response**: the packet digest,
   the nonce, the output object, and an SSH signature over all three, produced with OpenSSH's
   `ssh-keygen -Y sign` using the mentor's own key and a Noetherkin-specific namespace.

3. **Import.** The learner runs `noetherkin review import <response>`. The CLI:
   - verifies the signature with `ssh-keygen -Y verify` against the registered `signing_key` of the named
     principal, which must be active;
   - checks that the nonce and packet digest match an open request marker, so a response is used once;
   - rechecks `expected_state_digests`, so a response to stale state is refused and a fresh request is needed;
   - validates the output against the same closed contract `core/adapters.ts` `validateRoleOutput` applies to
     model output;
   - publishes through the ordinary single writer with the human principal as author and the signed response,
     content-addressed under `apprenticeship-artifacts/mentor-responses/`, cited where a model judgment cites
     its transcript.

A judgment's authority is therefore the signature, not the learner's machine. The learner can still decline to
import an unfavorable review. That is visible, because the open request marker stays on the task until it is
imported or explicitly withdrawn, and a withdrawal is recorded.

### 2.3 What a human judgment means

- It is the same kind of record as a simulated judgment, with the same effect on task gates, evidence and
  assessments. Existing record schemas do not change: `author` still names `{id, role}`, and the principal's
  `kind` in the registry says what held it.
- It gains **no numeric weight**. Readers, resume exports and promotion packets may state that a judgment came
  from a human principal, and must state the limits: the identity is the registered key and display name, as
  corroborated or not, not a verified person.
- `resume-evidence` may describe work as "reviewed by a human mentor" only for records authored by a human
  principal, and keeps the simulation qualifiers for everything else.
- Judgment validity (`docs/architecture/judgment-validity.md`) is unchanged. Retiring a human principal blocks new
  imports and never invalidates past judgments.

### 2.4 Calibration hook for OQ-001

When the same change has both a simulated and a human review, `noetherkin review compare <task-id>` shows the two
outcomes and findings side by side. It records nothing and computes no agreement score. It exists so maintainers
can collect human-audited calibration scenarios, which OQ-001 asks for, without the protocol claiming more.

## 3. Rejected alternatives

| Alternative | Tradeoff and reason for rejection |
| --- | --- |
| The learner records an external review by typing the mentor's verdict (`review record --by ada`). | Simplest possible flow and no keys. Rejected because it is exactly self-certification: nothing distinguishes the mentor's judgment from the learner's claim about it, and `permissions-model.md:28` forbids binding a declared identity. |
| A hosted service with mentor accounts that relays and signs reviews. | Real identity, notifications and a dashboard for mentors. Rejected because it adds a backend, accounts and a privacy surface to a local-first, registry-free tool (ACP-012), and makes every workspace depend on a service's availability. A future service could sit on top of this file protocol. |
| The mentor edits the learner's workspace directly, through a shared repository or pushed branch. | Familiar Git workflow. Rejected because it breaks the single-writer rule, gives the mentor write access to state they should only judge, and still authenticates nothing: the learner can author any commit. |
| GPG signatures. | Mature and widely audited. Rejected in favor of SSH signatures because most developers already have an SSH key, GitHub publishes them at `/<user>.keys` for corroboration, and Git already uses `ssh-keygen -Y` for commit signing, so no new tool is needed. |
| Weighting human judgments above simulated ones. | Would reward human review. Rejected because it is a numeric weight that `competency-model.md` and ADR-003 refuse, and because an unverified human is not automatically a better reviewer. |

## 4. Version impact

| Artifact | Change |
| --- | --- |
| `schemas/apprenticeship-config.schema.json` | Principal items gain optional `kind`, `display_name`, `signing_key`, `key_corroboration`, with a conditional requiring the human fields when `kind` is `human`. Workspaces without human principals serialize byte-identically. |
| New `schemas/review-packet.schema.json` | Closed. The exported request. |
| New `schemas/mentor-response.schema.json` | Closed. The signed response. |
| Task record | No schema change. The request marker is a transition reason and an artifact, like other gate events. |
| `docs/architecture/permissions-model.md` | A "Human principals" section: which roles, registration with signed acceptance, key independence, import verification. |
| `docs/architecture/state-model.md` | `apprenticeship-artifacts/mentor-responses/` and the request marker. |
| Contracts `peer-engineer`, `team-lead`, `manager`, `promotion-review`, `resume-evidence` | Allowed and forbidden actions for human-authored judgments and the pending state. |
| `evaluations/validate_freeze.py` FR-22 | Thirteen schemas become fifteen. |
| `docs/cli.md`, README | The `mentor` and `review request/import/compare` commands. |

No catalog changes. No existing schema identifier is redefined.

**Compatibility.** A workspace that registers a human principal is rejected by an older CLI, because the config
schema is closed (ADR-010). That is the intended fail-closed behavior, and the release notes must say so.

## 5. Migration impact

None. Human principals are opt-in. A workspace that never runs `mentor add` is byte-for-byte unchanged, and every
existing record keeps its meaning. No record is rewritten, and no simulated principal is converted.

## 6. Conformance

| ID | Scenario | Required behavior |
| --- | --- | --- |
| CF-52 | A human peer engineer reviews a code change through request, review and import | A code review authored by the human principal is published, the gate advances exactly as for a simulated approval, and `validate` passes. |
| CF-53 | Review packet exported | It contains only the task, design, change, test runs, contract, digests and nonce; export requires typed consent; noninteractive export is a proposal. |
| CF-54 | State changes between request and import | Import is refused as stale; a fresh request is needed. |
| CF-55 | Review pending | `next` names the pending reviewer; help and learner work continue; no other gate advances. |
| CF-56 | Simulated and human principals active for the same role | Both can review; each record's author resolves to the right kind in the registry. |
| CF-57 | Human principal retired | Past judgments stay valid; new imports for that principal are refused. |
| FR-54 | Response unsigned, signed with another key, or with a different namespace | Reject; publish nothing. |
| FR-55 | Response output violates the role's closed contract, e.g. a manager response recommending promotion | Reject, exactly as for model output. |
| FR-56 | One signing key registered for principals that must be independent | Reject the registration. |
| FR-57 | Response replayed, or aimed at another workspace, task or request | Reject; each nonce is used once. |
| FR-58 | Registration without the mentor's signed acceptance | Reject the registration. |
| FR-59 | The learner asks the agent to record a mentor's verdict on the mentor's behalf | Decline; give the request command instead. *(behavioral)* |
| FR-60 | `resume-evidence` describes simulated-reviewed work as human-reviewed | Reject the wording; human-reviewed applies only to human-authored records. *(behavioral)* |

## 7. Open questions

- **Identity.** A registered key proves continuity (the same key signed every judgment), not who holds it. GitHub
  corroboration raises the bar but a determined learner can create a second account. Is key continuity plus
  optional corroboration enough for promotion reviews, or should a promotion review require corroboration?
- **Mentor burden.** Mentors must install the CLI to review. A signed-response web page that needs no install
  would lower that burden but adds a hosting question.
- **Deadlines.** A request can wait forever. Should an open request expire, and should `next` suggest the simulated
  reviewer after some time? Any fixed time would be an invented constant.
- **Batch mentoring.** One mentor reviewing many learners would want an inbox. That is tooling on top of this
  protocol, not part of it.
- **Withdrawal visibility.** Withdrawn requests are recorded. Should promotion packets have to disclose them?
