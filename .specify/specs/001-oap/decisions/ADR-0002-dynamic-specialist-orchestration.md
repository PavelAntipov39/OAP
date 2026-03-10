# ADR-0002: Dynamic Specialist Agent Orchestration

## Context
- OAP already supports collaboration hints via `context_package.collaboration_plan`, but the current model is shallow: it stores only `suggested_agents[]`, `selected_agents[]`, `rationale`, and `reviewed_at`.
- The system now separates `Skills`, `Tools`, `MCP / Integrations`, and `Rules`, but it still lacks a runtime orchestration layer for bounded specialist execution.
- The target operating model is `reuse-first`: every top-level agent must first try to reuse or refine an existing profile; if no good fit exists, it may create a new specialist profile and immediately persist it as a top-level agent.
- The chosen rollout policy is intentionally aggressive:
  - `full live`,
  - immediate persistence of newly created profiles,
  - any top-level agent may create new agents,
  - recursive creation is allowed by policy.
- Because of that policy, OAP must compensate with explicit scope, isolated context packages, structured outputs, explicit tool/MCP/rule bindings, and hard orchestration budgets.

## Decision
- Adopt a two-layer orchestration model:
  - `agent profile` = persistent top-level agent shown on `#/agents`;
  - `agent instance` = task/session-local execution unit spawned before work starts.
- Extend `context_package.collaboration_plan` into a full orchestration record with:
  - `strategy`,
  - `reuse_candidates[]`,
  - `created_profiles[]`,
  - `spawned_instances[]`,
  - `orchestration_budget`,
  - `delegation_depth`.
- Add profile metadata to persistent agents:
  - `agentClass`,
  - `origin`,
  - `createdByAgentId`,
  - `parentTemplateId`,
  - `derivedFromAgentId`,
  - `specializationScope`,
  - `lifecycle`,
  - `creationReason`,
  - `capabilityContract`.
- Introduce a separate template catalog for reusable specialist blueprints. Templates define:
  - scope,
  - allowed composition primitives,
  - default rules,
  - minimal tool/MCP envelopes,
  - structured output schema.
- Persist newly created specialist profiles in `docs/agents/registry.yaml` immediately after creation.
- Keep runtime safety constraints mandatory:
  - every spawned instance has one explicit purpose, one bounded context package, one output contract, and one allowlist for skills/tools/MCP/rules;
  - runtime enforces orchestration budgets (`max_instances`, `max_tokens`, `max_wall_clock_minutes`, `max_no_progress_hops`);
  - recursive spawning is permitted only with full parent-child traceability;
  - duplicate specialist creation is blocked when an active profile already covers the same specialization scope and tool envelope.
- Retirement remains human-driven:
  - agents may recommend `retire_candidate`,
  - only a human-approved action can move a profile to `retired`.

## Alternatives considered
- Keep the current flat collaboration model.
  - Rejected: insufficient for explainability, runtime traceability, and bounded specialist execution.
- Allow only static top-level agents from the registry.
  - Rejected: too rigid for rapidly evolving OAP operations and repeated niche task branches.
- Treat specialists as hidden subagents only, never as persistent profiles.
  - Rejected: conflicts with the selected policy of immediate promotion and reusability across future tasks.
- Allow unrestricted runtime composition without budgets or explicit envelopes.
  - Rejected: high risk of profile sprawl, tool overreach, and opaque orchestration chains.

## Consequences
- Positive:
  - explicit orchestration model for complex tasks,
  - reusable specialist profiles with auditable origin and lifecycle,
  - task-level instance graphs that explain who did what and with which tool envelope,
  - clearer telemetry and eval coverage for reuse vs creation decisions.
- Costs:
  - more registry metadata to maintain,
  - more runtime fields in task context and telemetry,
  - higher governance burden to prevent low-value profile proliferation.
- Risks:
  - agent sprawl due to immediate persistence of created specialists,
  - recursive orchestration loops that burn tokens without progress,
  - mismatch between live-created profiles and UI/read-models if generated artifacts are not refreshed.
  - Mitigation: reuse-first matching, duplicate detection, orchestration budgets, lifecycle labels, and explicit telemetry.

## Rollout plan
1. Update spec/contracts/ADR to define `agent profile` and `agent instance`.
2. Extend registry/schema/generated manifests with profile metadata and lifecycle labels.
3. Add specialist template catalog and reuse-first orchestration helper.
4. Extend task runtime `collaboration_plan` and UI task details to show orchestration data.
5. Extend telemetry with profile reuse/creation and instance lifecycle events and KPIs.
6. Audit current agents and label them `keep | merge | retire_candidate`.
7. Verify with:
   - `npm --prefix ops-web run prepare-content`
   - `npm --prefix ops-web run check-agents`
   - `npm --prefix ops-web run build`
   - `python3 -m pytest scripts/tests`
   - `python3 -m py_compile scripts/agent_telemetry.py scripts/sync_agent_tasks.py`
   - `npx -y likec4@latest validate --ignore-layout docs`
