# Bootstrap runtime design

This implementation starts with bootstrap and generalizes the same transaction protocol into the Phase 6 single-writer publisher under the existing [state model](architecture/state-model.md) and [permissions model](architecture/permissions-model.md). It does not replace the nine learner-record schemas or expose an arbitrary record writer.

## Data flow

The terminal controller collects an `InitRequest` containing display name, goals, and assistance ceiling. It allocates a proposal with workspace, learner, principal, and operation IDs. The learner reviews the target directory and registry. The controller then issues a process-local capability bound to the exact proposal and resolved workspace path. Publication rejects a changed proposal, different root, deserialized capability, or absent capability.

This boundary prevents passing an actor string or model-produced object as invocation authority through the CLI. The controller binds one of the six consented principals, supplies IDs, timestamps and authorization metadata, and accepts only a closed judgment object from the role adapter. It is not credential-grade identity or a sandbox against arbitrary code running as the local filesystem owner.

The publisher constructs pending onboarding, null selection, an empty cache, and the initial active registry. Candidate validation checks every record and exact agreement with consent before publication. The original schemas remain the runtime validators; TypeScript does not duplicate their authority.

## Retained transaction format

Inside `.apprenticeship/`:

| Path | Purpose |
| --- | --- |
| `authorizations/<sha256>.json` | Exact learner consent, bound actor, request, initial registry, operation, authorization time, and workspace identity. |
| `snapshots/<sha256>.json` | Exact immutable bytes for every proposed creation, including authorization. |
| `pending.json` | The normative receipt envelope plus `phase: prepared`. |
| `operations/<OP-uuid>.json` | Permanent receipt, published as the final commit marker. |

Receipts use precisely the frozen envelope fields. The internal authorization artifact is independently digest-addressed and binds the request, actor and stale-read digests. Each change retains content-addressed old and new snapshots. Bootstrap output IDs retain workspace, learner and all six principals; later operations retain the records they publish.

The operation's UTC authorization time supplies bootstrap grant and record timestamps within that ordered initialization transaction. The receipt preserves the approved time through recovery; recovery resumes the same operation rather than inventing a new grant or reauthorizing a role.

## Publication and recovery

An exclusive `.apprenticeship.lock/` directory outside canonical state serializes readers and writers. Its owner records a local process ID, hostname, and random ownership token. The writer checks ownership at each publication step. Dead-lock reclamation has its own exclusion directory and never relies on expiry time.

Snapshot and candidate files are written privately, fsynced and atomically installed. Readers cannot enumerate canonical records while a pending manifest or held writer lock exists. Doctor can inspect the pending envelope and reports the exact old/new/absent checkpoint for every path without presenting mixed state as complete learner state.

The receipt is durable only after all candidate files and snapshots. A remaining pending marker alongside a valid committed receipt needs cleanup, not another publication. Recovery checks hashes, exact candidate reconstruction, current-file correspondence, safe paths and the reviewed checkpoint fingerprint. Manual changes conflict. Rollback restores exact retained old bytes in reverse publication order and removes only matching transaction creations; it never regenerates old snapshots.

Known limits are documented in [CLI recovery](cli.md). A valid checksum does not defend against a filesystem owner deliberately rewriting both records and receipts. Crash tests exercise process termination and injected I/O failure, not physical power loss or every filesystem implementation.

## Phase 6 boundary

The reusable publisher supports creates and updates for the PetClinic lifecycle, protocol migration, project/track selection, and reviewed track-scope alignment, with semantic candidate validation before publication and a local Codex adapter for bounded judgments. There is still no general mutation API, promotion executor, remote write, deployment or source-code authoring adapter.
