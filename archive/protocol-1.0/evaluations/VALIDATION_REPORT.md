# Specification validation report

Validation completed during the foundational specification phase on 2026-09-12 (America/Chicago). No simulator or PetClinic commands were run.

Command:

```sh
python3 evaluations/validate_foundation.py
```

Observed result, exit status 0:

```text
PASS: 9 schemas; 14 fixture documents; 88 competencies; 6 levels x 13 dimensions; 8 contracts; 30 negative cases; fixture references, artifact links, task gates, derived cache and local Markdown links.
LIMIT: artifact checks are fixture-specific. Runtime permission enforcement, migration, crash recovery and promotion execution are not implemented or tested here.
```

The 14 structured documents include the global project fixture and its pinned workspace copy. All nine schema types have concrete fixtures. The checker also accepts shape-only specimens for all three promotion outcomes and rejects wrong promotion author, missing authorization and missing dimension findings. Those specimens are deliberately not published into the example workspace: schema acceptance alone does not establish promotion eligibility.

The 30 negative cases comprise 18 unknown-field/version cases, three invalid review fields, a partially null project binding, invalid assistance range, three promotion-structure cases, and four lifecycle/completion cases. They are mutations held in memory, not corrupted files left in the repository.

Initial checks exposed YAML aliases; all structured examples were serialized without aliases and the strict checks then passed. Artifact-revision reconciliation was added for both code and task reviews. Current task validation identifies its checked revision and time.

The behavioral scenarios in docs/architecture/conformance.md were reviewed against the written contracts. They have not been executed against an agent or runtime. No learning efficacy, production readiness or independent-review reliability is inferred from this report.

`git diff --check` returned no errors, but the repository files are untracked, so that command did not provide meaningful coverage of the new artifacts. No commit, push, PR, deployment or remote mutation was performed.
