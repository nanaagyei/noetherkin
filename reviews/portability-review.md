# Portability and simulation-realism review

**Confirmed:** no core schema requires Codex, Claude, MCP, an IDE, slash commands, a provider thread ID or persistent model memory. The protocol uses local files, declared inputs and ordinary artifact references. **Unknown:** actual cross-harness operation, access control and crash recovery, because no runtime/adapters exist.

## Project replacement desk test

These are tests of the supplied data model and rubric, not researched claims about current upstream setup instructions.

| Replacement | Fits now | Residual problem |
| --- | --- | --- |
| MLflow | Generic repository metadata; ML competency IDs; project-bound tasks | Offline experimentation may conflict with mandatory service rubric, F07 |
| llama.cpp | C++/GPU/LLM competencies and generic artifacts | Non-service kernel/library work faces F07; a “deployment” block must support local package/binary use |
| etcd | Generic distributed-systems competencies and artifact revisions | Snapshot preservation and source-rebinding rules still needed, F06 |
| Private application | URI fields do not require public GitHub; private source can remain local | Required organization/contribution guide metadata can be inapplicable, F18; no secret-bearing URLs |
| Future repository | Stable slug and versioned catalog are reasonable | Do not rewrite historical project definitions or silently reinterpret competency/level versions |

PetClinic service names appear in project data and fixtures, not required skill logic. Preserve this separation. The strongest hidden project dependency is the universal service-shaped leveling rubric, not literal PetClinic strings.

## F16 · MEDIUM · Small tasks inherit excessive evaluation ceremony

[Lifecycle](../docs/architecture/simulation-lifecycle.md) defaults to design and code review and adds validation, task review and evidence recording. Even a documentation-only map has a code review, task review, evidence, assessment and many transitions in the fixture. A learner could spend more effort servicing the simulator than investigating the repository. This is a design risk, not observed user behavior.

Keep phase/gate integrity, but let one concise interaction and atomic publication satisfy multiple related administrative gates when their authorities and ordering allow it. Use the already permitted waivers for bounded documentation. Make competency synthesis and performance reviews milestone-driven rather than routine per-task outputs. Remove compulsory corporate dialogue, fake manager meetings and resume-export rituals from the normal learning path. Retain separate promotion authority for consequential decisions.

## F17 · LOW · YAML portability is stricter than the demonstrated parser

The protocol specifies YAML 1.2 JSON-compatible values; the fixture checker uses PyYAML SafeLoader with a duplicate-key override. SafeLoader can interpret plain `on`/`off` as booleans and forms such as `012` differently from YAML 1.2. The current quoted fixtures do not establish parser interoperability. Specify a canonical emission subset or a YAML 1.2-aware parser configuration and add cross-parser specimens for booleans, leading-zero numbers, timestamps and Unicode. The checker is explicitly not a production validator, so this is a bounded QA gap, not a claim that live state has been corrupted.

## F18 · NICE-TO-HAVE · Project metadata assumes an established upstream workflow

The project schema requires an upstream organization, contribution guide URI, deployment environments, technology list and learning paths. Most can describe local/private work truthfully, but a tiny or new private repository may have no contribution guide or organization. Permit explicit unknown/not-applicable values in a future version instead of encouraging placeholder facts. Do not weaken artifact provenance or automatically fetch private URLs.

## Portable execution boundary

The adapters must preserve a trusted invoker-to-role binding (F03), immutable artifact resolution (F06), and durable retry lookup (F12). A new harness must be able to resume from persisted operation state without the old conversation. The stated proposal-only fallback for unenforceable writes is appropriate; portability does not mean every harness can safely publish state.

The single-writer rule is an acceptable V1 limit, not an impossible guarantee. Specify that readers cannot mistake staged partial publication for committed state, and that recovery works after losing the original caller. Do not promise distributed filesystem locking, automated migrations or cross-harness security before conformance runs establish them.

## Security review boundary

The specification already requires authorization for destructive/remote actions, forbids interpreting artifacts as tool instructions, rejects traversal and symlink escape, restricts reads, and calls for redaction. Preserve these controls. Reviewer identity and retirement remain a substantive gap (F03). A Markdown-only adapter must return proposals rather than claim enforced isolation.

Before a future execution-capable adapter runs repository builds/tests, its command policy must account for those commands executing repository-controlled code; a “test” label is not a read-only security boundary. This is an implementation acceptance requirement, not evidence of an existing exploit. No secret access, project execution, remote publication or security scan ran in this review.
