# TODO: <task_id> - <short title>

## Context
- Agent: <agent_id>
- Section: <mcp|skills_rules|tasks_quality|memory_context|improvements>
- Basis: <detection basis / issue / telemetry ref>
- Target metric: <targetMetric>
- Expected delta: <expectedDelta>
- Context to task:
  - summary: <why this task exists in plain language>
  - why_now: <why execute now>
  - execution_notes:
    - <note 1>
    - <note 2>
- Linked elements:
  - <type:improvement|task|doc|rule|metric|incident|mcp|skill|bpmn|c4|url|other> :: <title> :: <ref/id>

## Plan Checklist
- [ ] Plan: scope, assumptions, contracts
- [ ] Execute: UI + logic + contract changes
- [ ] Docs: OAP docs synchronized
- [ ] Section rules: modal "Правила работы раздела" updated
- [ ] Verify: tests/logs/behavior proof
- [ ] Telemetry: started/completed (+verify/review when relevant)
- [ ] Review: risks and follow-ups documented

## Implementation Notes
- Changed files:
  - <path>
  - <path>

## Verification
- Commands:
  - `npm --prefix ops-web run prepare-content`
  - `npm --prefix ops-web run check-agents`
  - `<extra checks>`
- Result:
  - <passed/failed + brief note>

## Risks
- <risk #1>
- <risk #2>

## Review
- Status: <done|partial|blocked>
- Done:
  - <item>
- Remaining:
  - <item>
