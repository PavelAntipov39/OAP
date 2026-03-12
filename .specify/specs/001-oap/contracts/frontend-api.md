# OAP Frontend API Contract

## 1. Purpose
- Define data expectations for OAP frontend (`ops-web`) from generated manifests, telemetry artifacts, and DB-backed task endpoints.

## 2. Main Payloads
- `agents-manifest.json`
  - source: `docs/agents/registry.yaml` + normalization logic in `ops-web/scripts/build_content_index.mjs`.
  - contains: agent identity, profile metadata, tasks metrics, MCP/skills, memory context, improvements, workflow policy, workflow backbone.
- `oap-kb-index.json`
  - source: OAP docs and selected AGENTS sections.
- `assistant-governance.json`
  - source: `/.specify/specs/001-oap/contracts/assistant-governance.json` + generator in `ops-web/scripts/build_content_index.mjs`.
  - contains canonical assistant policy entry metadata and generated entry targets.
- `ui-section-contract.json`
  - source: runtime UI composition scan in `ops-web/scripts/build_content_index.mjs`.
  - contains semantic section map:
    `section_id`, `current_label`, `container_type`, `card_type`, `visibility`, `source_file`.
- `agent-latest-cycle-analyst.json`
  - source: telemetry-derived artifact from `scripts/agent_telemetry.py`.
- `agent-benchmark-summary.json`
  - source: benchmark aggregation from `scripts/agent_telemetry.py benchmark-report`.
  - contains:
    - run-level stability metrics (`pass_at_5`, `fact_coverage_mean`, `schema_valid_rate`, `trajectory_compliance_rate`, `judge_disagreement_rate`, `cost_per_success`);
    - impact metrics (`recommendation_executability_rate`, `evidence_link_coverage`, `time_to_action_p50`, `validated_impact_rate`);
    - gate result (`passed|warning|failed`) with thresholds and failed metrics.
- `agent-improvement-history.json`
  - source: unified feed from `docs/agents/registry.yaml` + `artifacts/candidate_*.json` + `.logs/agents/*.jsonl` in `ops-web/scripts/build_content_index.mjs`.
  - contains normalized `improvement_history_event[]`:
    - `event_id`, `occurred_at`, `agent_id`
    - `source_tool`: `codex|copilot|claude|other`
    - `source_ref`
    - `extracted_value`
    - `applied_change`
    - `target_scope`
    - `result_status`: `captured|applied|verified|rollback|rejected`
    - `result_note`
    - optional: `metric_name`, `metric_delta`
    - `evidence_refs[]`

## 3. Stability Rules
- Required card fields are defined by `docs/subservices/oap/agents-card.schema.json`.
- Backward-incompatible field changes require:
  1. schema update,
  2. registry update,
  3. UI adaptation in `ops-web/src`,
  4. docs update in `docs/subservices/oap`.

## 4. Task Board Contract (runtime)
- Status domain:
  - `backlog`, `ready`, `in_progress`, `ab_test`, `in_review`, `done`, `completed`.
- Status transitions are telemetry-driven, not direct UI DB writes.
- Task brief `context_package` extensions (optional, backward-compatible):
  - `operational_memory[]`:
    - `{ key, title, value, source_ref?, updated_at? }`
  - `collaboration_plan`:
    - `{ analysis_required, suggested_agents[], selected_agents[], rationale, reviewed_at? }`
    - orchestration extensions:
      - `strategy`: `reuse_existing|create_new|mixed`
      - `reuse_candidates[]`: `{ profile_id, name, score, decision, rationale }`
      - `created_profiles[]`: `{ id, name, created_by_agent_id, parent_template_id?, derived_from_agent_id?, specialization_scope, lifecycle, creation_reason, capability_contract }`
      - `primary_coordinator_agent_id`, `final_synthesizer_agent_id`, `merge_owner_agent_id`
      - `interaction_mode`: `sequential|parallel_read_only|mixed_phased`
      - `interaction_phases[]`: `{ phase_id, label, mode, goal, participants[], depends_on[], outputs[], status, merge_into? }`
      - `selection_basis[]`, `merge_strategy`, `conflict_policy`
      - `host_execution_strategy`: `{ default_host_id, selected_backend_by_default, context_isolation_policy, host_policies{} }`
      - `context_isolation_policy`
      - `roundtable_policy`: `{ enabled, moderated_by, max_rounds, transcript_visibility, allow_free_chat, allow_position_sharing, summary_required_each_round }`
      - `discussion_rounds[]`: `{ round_id, round_index, participants[], summary, status, next_owner_agent_id? }`
      - `spawned_instances[]`: `{ instance_id, profile_id, parent_instance_id?, root_agent_id, task_id, purpose, depth, allowed_skills[], allowed_tools[], allowed_mcp[], applied_rules[], input_refs[], output_refs[], status, verify_status, phase_id?, execution_mode?, execution_backend?, context_window_id?, isolation_mode?, read_only?, ownership_scope[]?, depends_on[]?, merge_target? }`
      - `spawned_instances[]` are executable runtime state, not suggestion-only metadata:
        `status = planned|running|completed|failed|skipped`
      - spawned instances must inherit the same `workflowBackbone` family as the parent task and return into the same canonical cycle after delegation
      - `orchestration_budget`: `{ max_instances, max_tokens, max_wall_clock_minutes, max_no_progress_hops }`
      - `delegation_depth`
  - `ab_test_plan`:
    - `{ enabled, sessions_required, pass_rule, target_metric, expected_delta_pct, guardrails[], rollback_on_fail }`
    - `sessions_required` must stay in `3..8`.
    - canonical `pass_rule`: `target_plus_guardrails`.
- Task brief provenance extension (optional, backward-compatible):
  - `origin_context`:
    - `{ source?, recommendation_id?, linked_improvement_id?, origin_cycle_id? }`
    - `origin_cycle_id` is shown in task board column `Цикл` and means the cycle where the task was detected or created.
    - `origin_cycle_id` must not be interpreted as A/B session progress.
    - if producer does not know the real origin cycle, omit the field and let UI show `не зафиксировано`.

## 4.1 Unified Agent Drawer Contract
- Canonical drawer contract for agent deep-links:
  - top-level agents use one canonical route: `#/agents?agent=<agent-id>&tab=overview`
  - legacy tab aliases `mcp|skills_rules|tasks_quality|memory_context|improvements` remain backward-compatible in URLs,
    but must canonicalize to `tab=overview` for every top-level agent shown in `#/agents`
  - active modal deep-links are applied on top of the same `overview` route; tab switching is not a product-level navigation model anymore
- Drawer modal deep-links:
  - `modal=capability_comparison`
  - `modal=capability_journal&capability=<row-key>`
  - `modal=metrics_catalog&entity=<agent-id>`
  - `modal=operative_memory&entity=<session-id|latest>`
  - `modal=lessons&entity=agent|global`
  - `modal=sessions&entity=<session-id|latest>`
  - `modal=improvement_history`
- Top-level cards must use one canonical composer seeded from `analyst-agent` overview:
  1. `Шапка`
  2. `Анализ эффективности агента`
  3. `Как работает ИИ агент`
  4. `Рабочий контур агента`
  5. `Память`
  6. `Риски`
- `analyst-agent` must use the same routing/drawer contract as other top-level agents (no special-case routing branch).
- Persistent agent profiles displayed in the drawer must also expose:
  - `agentClass`: `core|specialist`
  - `origin`: `manual|dynamic`
  - `lifecycle`: `active|retire_candidate|retired`
  - optional `createdByAgentId`, `parentTemplateId`, `derivedFromAgentId`, `specializationScope`, `creationReason`
  - `capabilityContract`: `{ mission, entryCriteria[], doneCondition, outputSchema }`
  - `workflowBackbone`:
    - `version`: currently `universal_backbone_v1`
    - `commonCoreSteps[]`: shared cycle template used for comparability across agents
    - `roleWindow`: `{ entryStep, exitStep, purpose, internalSteps[] }`
    - `stepExecutionPolicy`: `{ skippedStepsAllowed, skippedStepStatus }`
    - `supportsDynamicInstances`: whether spawned specialist instances are expected to use the same backbone
- UI must treat `workflowBackbone` as invariant across top-level and delegated execution:
  host-specific adapter differences may affect invocation transport, but they must not introduce a different cycle model in the frontend.
- Dynamic specialist profiles are shown on `#/agents` immediately after creation once the registry/manifests are refreshed.
- Task card and task session UI must expose orchestration in three layers:
  - `Схема работы агентов`: mode, coordinator, merge owner, phases, host backend, instance graph;
  - `История`: group phase-aware events by `phase_id`, show `execution_mode`, `read_only`, optional `round_index`;
  - `agent-flow`: show orchestration mode decision and phase graph with merge point.

## 4.2 Dynamic UI Section Contract
- Governance/docs and assistant entry-files must reference UI nodes by `section_id`.
- `current_label` is runtime metadata and may change without governance-doc rewrites.
- Label lookup source:
  `ops-web/src/generated/ui-section-contract.json`.

## 5. Candidate Intake Contract (runtime)
- Canonical entity name: `candidate`.
- `candidate_inbox` fields:
  - `candidate_id`, `source`, `source_key`, `telegram_chat_id`, `telegram_message_id`,
  - `text`, `links[]`, `status`, `received_at`.
  - processing statuses for queue visibility: `candidate_received`, `processing`, `ab_test_started`, `candidate_rejected`.
- `candidate_assessment` fields:
  - `candidate_id`, `decision`, `applicability`, `target_metric`, `baseline_value`,
  - `expected_delta`, `objective_risks[]`, `cycles_required`, `decided_at`.
- Idempotency rule:
  - `source_key = telegram:<chat_id>:<message_id>` must be unique per inbound message.
  - cycle runner claims only rows in `candidate_received`; already claimed/terminal rows must not be reprocessed in the same cycle.

## 6. Benchmark Contract (runtime, local-first)
- Benchmark artifacts:
  - `artifacts/analyst_benchmark_dataset.json` (scenario dataset contract)
  - `artifacts/agent_benchmark_run_results.json` (one benchmark run raw results)
  - `artifacts/agent_benchmark_summary.json` (aggregated latest summary)
  - `artifacts/agent_benchmark_history.jsonl` (append-only trend history)
- Minimum scenario fields:
  - `case_id`, `agent_id`, `case_source`, `difficulty`,
  - `input_payload`, `expected_facts[]`, `critical_must_not[]`,
  - `judge_rubric_version`, `owner`, `last_validated_at`.
- CI policy:
  - current mode: `soft_warning` (regressions are reported, merge is not blocked by default).

## 7. A/B Decision Contract
- A/B acceptance rule for candidate practice rollout:
  - `pass` when `median(target_delta_pct) >= expected_delta_pct`
    and `guardrail_breached_count = 0`;
  - otherwise mark run as `ab_test_failed` and require `rollback_applied`.
