# ACP-018: Canonical publication on Windows

| Field | Value |
| --- | --- |
| Status | `ADOPTED`, 2026-09-28 |
| Date | 2026-09-28 (America/Chicago) |
| Author | Project maintainers, drafted with AI assistance |
| Depends on | none |
| Blocks | none |
| Supersedes | none |

> **Adopted.** The authoritative record is Phase 15 in [FOUNDATION_CHANGELOG.md](../../FOUNDATION_CHANGELOG.md),
> not this file.

Noetherkin publishes canonical state on macOS and Linux only; on Windows it offers proposals and inspection, and
the documentation sends learners to WSL. This proposal lets a native Windows process publish on a local NTFS volume,
states exactly which durability guarantee changes, and keeps every other publication rule. Tracking issue: #23.

## 1. Contradiction

The runtime documentation names the platforms and the primitives publication relies on:

> Publication targets single-user local macOS/Linux filesystems supporting file and directory fsync and atomic
> hard-link creation. (`docs/cli.md:111`, before this change)

> Other platforms support inspection/proposals where Node and temporary locking are available.
> (`docs/cli.md:113`, before this change)

And the code enforces it: `core/bootstrap.ts` refuses publication outside `darwin` and `linux` with
`DURABILITY_UNSUPPORTED`, and `cli/main.ts` downgrades `init` to a proposal there.

Windows cannot satisfy "directory fsync": Node cannot `fsync` a directory handle on Windows, and Win32 has no
equivalent call for a directory entry. Allowing publication there therefore changes a stated durability assumption,
which `docs/proposals/README.md` requires a proposal for, even though no schema or record changes.

## 2. Proposed resolution

1. **Platforms.** Publication is supported on `darwin`, `linux` and `win32`. On Windows the workspace must be on a
   local NTFS volume. `publicationPlatforms` in `core/storage.ts` is the single source of this list.
2. **What stays the same on every platform.** Candidate files and snapshots are written to a private temporary file
   and flushed with `fsync` (on Windows, `FlushFileBuffers`) before they are installed. Creations use an atomic
   hard link (NTFS supports them). Replacements use an atomic rename (`MoveFileEx` with replace-existing on
   Windows). The single-writer lock, the pending manifest, the receipt as the final commit marker, and recovery are
   unchanged.
3. **What changes on Windows.** The directory fsync after each install is skipped. The durability of a directory
   entry, meaning that a completed rename or link survives power loss, instead rests on NTFS metadata journaling,
   which replays logged metadata operations in order after a crash. The protocol already tolerates losing the last
   uncommitted step, because recovery reads the pending manifest and each path's old, new or absent checkpoint. The
   remaining exposure is ordering across power loss: a later metadata operation surviving while an earlier one is
   lost. NTFS journaling is expected to prevent that, but this project has not tested it against power loss. The
   documentation says so and claims nothing further.
4. **Fail closed on other volumes.** The existing publication probe (fsync of the lock owner file and a hard-link
   probe) still runs first. FAT32, exFAT and ReFS (including Dev Drive) have no hard links, so the probe fails and
   `init` returns a proposal with `DURABILITY_UNSUPPORTED`. Network shares remain unsupported, as on POSIX.
5. **Transient sharing violations.** Virus scanners and indexers briefly hold newly written files open, which makes
   rename, unlink or rmdir fail with `EPERM`, `EACCES` or `EBUSY`. On Windows only, those three errors are retried a
   bounded number of times, backing off from 10 ms up to about 2.5 s in total. Any other error, or one that
   persists, fails the operation exactly as before.
6. **Paths.** State paths still reject symbolic links. On Windows this includes directory junctions, which Node
   reports as symbolic links. A source checkout on a different drive has no relative path from the workspace and is
   refused with `UNSAFE_PATH`, the same as a checkout outside the workspace.
7. **Locks.** Lock ownership is unchanged: process ID, hostname and a random token. `process.kill(pid, 0)` answers
   liveness on Windows as it does on POSIX, so dead-lock reclamation keeps its rule that age never permits
   reclamation.
8. **Consent.** The direct-terminal check (`stdin` and `stderr` are TTYs) is unchanged. Windows consoles and
   Windows Terminal satisfy it, and a noninteractive agent still receives only a proposal.

Supporting, non-normative changes ship with it: role hosts installed as `.cmd` shims (`codex.cmd`, `claude.cmd`)
are resolved through PATHEXT and started through `cmd.exe` with escaped arguments (`core/process.ts`); declared
forge test commands run in the platform shell; and `.gitattributes` checks out text as LF so content digests match
across platforms.

## 3. Rejected alternatives

- **Keep Windows at WSL only.** It avoids any change to stated guarantees, but it leaves native Windows learners with
  a proposal-only CLI and a second environment to maintain. WSL remains documented as a supported alternative.
- **Emulate directory fsync by flushing the volume.** `FlushFileBuffers` on a volume handle forces the entry to disk,
  but it needs administrator rights and flushes the whole volume on every publication step. A learner tool must
  not require elevation, so this was rejected.
- **A native addon calling `MoveFileEx` with `MOVEFILE_WRITE_THROUGH`.** This is the strongest per-rename guarantee,
  but it adds a compiled dependency to a package that ships none and needs a build toolchain on every Windows
  install. It was rejected for now; open question 1 keeps it available.
- **Copy the file and delete the original instead of renaming.** This loses atomicity, so readers could see a torn
  file. It was rejected outright.

## 4. Version impact

None. No schema, catalog, record field or wire format changes. The `publication_supported_platform` value that
`doctor` reports becomes `true` on Windows, and its `filesystem_assumption` text names the NTFS journaling
assumption there.

## 5. Migration impact

None. Existing workspaces keep their exact bytes and meaning. A workspace created on Windows is byte-for-byte the
same kind of workspace as one created on macOS or Linux. Records are written with LF line endings on every
platform, and paths inside records use forward slashes.

## 6. Conformance

| ID | Setup | Required result | Covered by |
| --- | --- | --- | --- |
| CF-58 | The full runtime suite, including the sixteen process-kill publication boundaries, interrupted rollback, and terminal consent, runs on Windows | Every case passes with the same recoverable or blocked outcomes as on POSIX. | CI `Runtime (windows-latest)` |
| FR-61 | Publication on a volume without hard links or file fsync | Fail closed with `DURABILITY_UNSUPPORTED` before any canonical record; `init` yields a proposal. | `tests/bootstrap.test.ts` FR-61 |
| FR-62 | A state path passes through a Windows directory junction | Reject as a symbolic link. | `tests/windows.test.ts` FR-62 |
| FR-63 | A source checkout on a different Windows drive | Reject with `UNSAFE_PATH`. | `tests/windows.test.ts` FR-63 |

## 7. Open questions

1. **Power-loss ordering on NTFS** is assumed from journaling semantics, not measured. A write-through rename
   through a native addon, or a real power-cut test rig, would turn the assumption into evidence.
2. **ReFS and Dev Drive** fail closed today because the hard-link probe fails. Whether to support them through a
   different no-clobber create primitive is left open.
3. **The consent harness** covers ConPTY (Windows Terminal and modern consoles). The legacy console host was not
   tested.
