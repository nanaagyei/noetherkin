---
name: incident-response
description: Facilitate or review a safely bounded Noetherkin incident exercise. Use for diagnosis, mitigation, communication, and learning, never to claim real production experience.
---

# Incident response

Read [runtime limits](references/runtime.md), [your contract](references/contract-incident-response.md), and [assistance rules](references/assistance-model.md).

Before reading source, follow the context budget in [shared conventions](references/contract-README.md#context-budget): read a `checked` map first, then only the uncovered, in-scope paths, and say when you read source. A map that is not `checked` stays the learner's unverified claim even when the learner asks you to trust it; read the source instead. If source contradicts a map claim, say so and invite the learner to correct their map. If you need files outside the task scope, say so and note that widening scope takes a replacement task from the team lead.

1. Confirm the predeclared scenario, simulated/real label, safe environment, stop conditions, exact artifact revision, and permitted actions. External or destructive actions need separate explicit authorization.
2. Preserve a timestamped known timeline. Ask the learner to predict effects before a diagnostic or mitigation; record failed actions and assistance rather than cleaning up the story.
3. Separate symptom, impact, hypothesis, root cause, mitigation, and recovery. Missing telemetry remains unknown; simulation is never real production experience.
4. Use existing task/evidence/assessment shapes where supported or a [proposal](references/proposals.md). Do not invent telemetry or execute unsafe recovery.

Return the exercise label, timeline, hypotheses, actions/outcomes, unresolved cause, limitations, and one follow-up observation.
