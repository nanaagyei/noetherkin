# Persistent, unpublished proposals

Drafts preserve work across sessions without changing protocol 2.0. They are ordinary Markdown, not a state store, approval service or publication queue.

## Save a reviewable revision

Use `apprenticeship-drafts/` directly inside the learner workspace, beside `.apprenticeship/`, never inside the source checkout or the installed skill. Follow mode and path restrictions in [runtime](runtime.md). If file writing is unavailable or not authorized, return the draft in conversation and report that it was not saved.

Choose a descriptive proposal folder after inspecting existing names. Use `revision-001.md`, incrementing for each changed proposal, and `reviews.md` for dated, append-only review notes. These filenames are draft references, not canonical IDs. Create new files without overwriting an existing file. A collision or concurrent edit requires rereading, not replacement. Do not create an empty review log until a real review is recorded.

Copy the [template](../assets/proposal.md) and replace its writing prompts with known facts or explicit “unresolved” explanations. Include only genuinely available structured candidate fields; incomplete candidates are not schema-valid records. Record source paths and exact revisions or tool-computed content digests, requested role and known actor binding, intended writes, evidence gaps and publication blockers. Never manufacture a test result, author grant, timestamp, consent artifact or canonical record ID to fill a field.

Distinguish canonical inputs, observed source/artifacts, learner reports, and unpublished dependencies. Pin draft dependencies to exact revision files, not merely a folder or “latest.” A future baseline pointer must identify the missing published baseline as unresolved; a draft pathname cannot stand in for an assessment ID.

## Review and resume

Before reuse, read the relevant proposal revisions and review log, inspect the pinned canonical/artifact inputs and draft dependencies, and check for newer revisions in their folders. Verify that the chosen workspace still matches. Do not infer continuity from conversation memory or an identical display name.

- Unchanged inputs and request: reference the existing revision; avoid a duplicate proposal or invented review event.
- Changed request, input, assistance disclosure, source revision or dependent draft: preserve the earlier revision and write a new one explaining the differences, affected claims, and remaining prerequisites.
- Missing dependency or unverifiable input: identify it and block affected conclusions. Do not fill the gap with another file at the same path or silently fall back to an old favorable judgment.
- Conflicting review notes or ambiguous current revisions: report the ambiguity and obtain focused learner input before treating a revision as reviewed.

Review log entries name the exact proposal revision, actual reviewer as known, observed date/time from a clock or supplied review artifact, decision, rationale, and provenance of the learner's words. Attribute an unauthenticated report as such. Do not backdate or synthesize approval. Use “approved draft,” “changes requested,” or “withdrawn” in prose, always with “unpublished.” These labels are local review notes, not formal review outcomes or runtime authority.

Earlier approval stays attached to its exact revision. A revised proposal needs fresh review even if the learner previously approved its predecessor. Saving a new revision does not edit canonical dependencies, satisfy lifecycle gates or certify staleness projection. Record reconciliation observations with their limits.

Approved drafts may inform explicitly conditional downstream drafts, preserving exact dependency references. They cannot complete onboarding, select a project, assign work, approve code formally, verify evidence, complete a task or change a level. Keep those prerequisites pending until a future authorized runtime publishes and validates the necessary records. No automatic apply/import command exists in this release.

Draft files and review logs are editable local documents. Numbering and retained revisions support review but do not provide tamper-proof history, locking, trusted signatures or canonical transaction recovery.
