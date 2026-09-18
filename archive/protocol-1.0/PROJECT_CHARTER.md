# Engineering Apprenticeship Simulator

## Mission

Engineering Apprenticeship is an open-source, agent-agnostic software engineering apprenticeship simulator.

It helps developers become independent engineers by placing them inside real open-source codebases and surrounding them with simulated engineering processes such as onboarding, task assignment, mentorship, code review, management, user feedback, production incidents, performance evaluation, and promotion review.

The learner remains the primary engineer.

The system exists to strengthen engineering judgment, codebase comprehension, debugging ability, design reasoning, testing discipline, production readiness, and technical independence.

It is not primarily an autonomous coding system.

---

# Core Philosophy

The learning loop is:

READ  
→ MAP  
→ BUILD  
→ RUN  
→ TRACE  
→ BREAK  
→ DEBUG  
→ TEST  
→ MODIFY  
→ BENCHMARK  
→ DEPLOY  
→ OPERATE  
→ EXPLAIN  
→ CONTRIBUTE

The preferred outcome is:

> I understand this system well enough to explain it, debug it, modify it, operate it, and defend my design decisions without depending on AI to perform the engineering for me.

The undesired outcome is:

> An AI agent finished the project for me.

---

# Product Principles

## 1. Human Is the Engineer

The learner should normally:

- inspect source code;
- read documentation;
- investigate architecture;
- form hypotheses;
- implement changes;
- write tests;
- debug failures;
- benchmark systems;
- deploy software;
- explain technical decisions.

Agents support the learner rather than replace them.

---

## 2. Real Engineering Environments

The simulator should operate primarily against real open-source repositories.

The repositories themselves are not owned or vendored by this project.

Learners fork or clone them separately.

---

## 3. Evidence Over Gamification

Progression is based on demonstrated engineering capability.

Avoid meaningless:

- XP;
- streaks;
- arbitrary points;
- task-count promotion;
- congratulatory leveling.

Promotion requires repeated, relevant evidence.

---

## 4. Documentation First

Agents should encourage use of:

1. official documentation;
2. project source code;
3. design documents;
4. RFCs and ADRs;
5. project issues and pull requests;
6. specifications;
7. relevant research.

Agents should teach learners how to find answers.

---

## 5. Progressive Assistance

AI support should escalate only as necessary.

Possible assistance levels:

0. independent work;
1. documentation/navigation;
2. conceptual hint;
3. investigation guidance;
4. pseudocode;
5. isolated example;
6. partial implementation;
7. full implementation.

Use of assistance is not inherently negative.

It provides context for what a piece of work demonstrates.

---

## 6. Agent Agnostic

Core behavior must not depend on a single vendor or harness.

The simulator should be usable, where capabilities permit, with systems such as:

- Codex;
- Claude Code;
- Cursor;
- Gemini CLI;
- Windsurf;
- Copilot;
- open-source agents;
- future compatible agents.

Agent-specific conveniences belong in adapters.

---

## 7. Human-Readable State

Simulation state should use portable, inspectable formats such as:

- YAML;
- JSON;
- Markdown.

Avoid opaque databases for the initial architecture.

---

## 8. Separation of Concerns

The architecture distinguishes:

### Roles
Examples:
- manager;
- team lead;
- peer engineer;
- user.

### Workflows
Examples:
- onboarding;
- task assignment;
- performance review;
- promotion review.

### Capabilities
Examples:
- debugging;
- benchmarking;
- architecture review;
- code review.

### State
Examples:
- tasks;
- evidence;
- competencies;
- reviews;
- project status.

These concepts should not be conflated.

---

## 9. Truthful Simulation

The simulator must not invent:

- completed work;
- performance metrics;
- tests that were never run;
- upstream contributions;
- user counts;
- benchmark improvements;
- production experience.

All consequential evaluations should reference evidence.

---

## 10. Respect Upstream Projects

Learners should keep simulation state separate from upstream source repositories when practical.

Recommended workspace:

workspace/
  AGENTS.md
  .apprenticeship/
  source/

`source/` contains the learner's fork or clone.

---

# Initial Learning Domains

The simulator should eventually support:

- Python;
- machine learning;
- deep learning;
- LLM systems;
- model serving;
- Java;
- Spring;
- Spring Boot;
- C++;
- CUDA;
- Go;
- backend engineering;
- distributed systems;
- Docker;
- Kubernetes;
- AWS;
- Azure;
- infrastructure;
- observability;
- CI/CD;
- system design;
- machine-learning system design.

These should be learned through overlapping engineering projects rather than isolated course completion.

---

# Initial Project Candidates

Potential supported projects include:

- Spring PetClinic Microservices;
- MLflow;
- OpenTelemetry Astronomy Shop;
- Google Online Boutique;
- KServe;
- vLLM;
- OpenTelemetry C++;
- llama.cpp;
- Prometheus;
- Argo CD;
- etcd;
- Triton;
- selected cloud inference reference architectures.

Project inclusion must remain data-driven through a project catalog.

Core skills must not hardcode behavior for specific repositories.

---

# Non-Goals for V1

V1 is not:

- a full LMS;
- an autonomous coding platform;
- a hiring assessment platform;
- a credentialing authority;
- a replacement for GitHub;
- a replacement for project documentation;
- a proprietary agent runtime;
- a cloud execution service;
- a gamified coding challenge site.

---

# Long-Term Vision

The architecture should support future simulation types without rewriting the core.

Possible future simulations could include:

- backend engineer;
- ML engineer;
- infrastructure engineer;
- SRE;
- security engineer;
- data engineer;
- GPU engineer;
- research engineer.

The core protocol should remain generic enough to support these specializations.