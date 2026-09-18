# Engineering Apprenticeship Simulator

An agent-agnostic apprenticeship protocol for learning engineering through real codebases. The learner remains the engineer; agents support investigation, understanding and evidence-based review.

This repository currently contains the **foundational V1 specification only**. There is no simulator runtime, production CLI, adapter or installed skill implementation.

Start with [PROJECT_CHARTER.md](PROJECT_CHARTER.md), [FOUNDATION_V1.md](FOUNDATION_V1.md) and the [specification index](SPEC.md). The [PetClinic example](examples/spring-petclinic/README.md) is explicitly fictional demonstration state. [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) records scope and validation. See the [publication redaction notice](REDACTION_NOTICE.md) for non-protocol local coordination files excluded before the first public commit.

Read-only specification checks:

```sh
python3 evaluations/validate_foundation.py
```

Requires Python, PyYAML and jsonschema. See [conformance scope](docs/architecture/conformance.md) for what the checks establish and what still requires runtime or human evaluation.
