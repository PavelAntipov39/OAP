# OAP Spec (Source of Truth)

## 1. Product Scope
- Project: OAP (Operations & Agents Platform).
- Purpose: operational control panel for AI agents, task quality, telemetry, and improvement governance.
- Out of scope: domain features outside OAP operational governance.

## 1.1 Assistant Governance Contract
- Repo-wide assistant behavior is tool-agnostic:
  the same communication and decision rules must apply to `Codex`, `GitHub Copilot`, `Claude Code`, and other assistants used in this project.
- Canonical governance order:
  1. this spec;
  2. `AGENTS.md` as operational gateway;
  3. assistant entry files (tool-specific short pointers generated from one contract).
- Assistant entry files are generated, short, and non-authoritative.
  If they diverge from this spec or `AGENTS.md`, the spec and `AGENTS.md` win.
- Host-specific agent entry files follow the same rule:
  they are generated adapter outputs and must not redefine the canonical workflow, learning core, or tool governance.
- Machine-readable assistant contract:
  `/.specify/specs/001-oap/contracts/assistant-governance.json`
  with fields:
  `canonical_file`, `supported_assistants[]`, `entry_file`, `entry_strategy=generated_pointer`, `template_version`.
- Any repo-wide change to communication rules, decision policy, or assistant behavior must update canonical layers and regenerate assistant entry files in the same task.
- Minimum communication invariants for all assistants:
  - concise, factual answers;
  - evidence-first reasoning;
  - explicit separation between confirmed fact and inference;
  - no references to stale UI sections, tabs, or workflows that are not confirmed by current runtime/code.
  - assistant/docs references must use semantic `section_id`; display label is resolved from the current UI section contract.

## 2. Core Modules
- `ops-web`: UI dashboard for agents, tasks, telemetry, docs, and BPMN/C4 views.
- `scripts/agent_telemetry.py`: write/read telemetry events and aggregated reports.
- `scripts/sync_agent_tasks.py`: seed/sync task board from registry and telemetry signals.
- `scripts/agent_orchestration.py`: reuse-first orchestration helper for specialist profile selection, creation, and instance planning.
- `scripts/candidate_processor.py`: normalize Telegram intake payloads into canonical `candidate` contracts and run guarded-auto assessment.
- `docs/agents/registry.yaml`: canonical agent registry and card payload source.
- `docs/agents/profile_templates.yaml`: canonical template catalog for reusable specialist blueprints.
- `artifacts/n8n/oap_candidate_intake_v1.json`: importable n8n workflow for Telegram candidate intake.

## 3. Data Contracts
- Agent card contract: `docs/subservices/oap/agents-card.schema.json`.
- Registry source: `docs/agents/registry.yaml`.
- Generated artifacts: `ops-web/src/generated/*.json` and optional `artifacts/*.json|*.md`.
- Universal workflow backbone:
  - all top-level agents and all spawned specialist instances follow `Universal Session Backbone v1`;
  - the backbone consists of shared core steps plus one bounded `role window` for agent-specific logic;
  - core steps remain visible in the canonical cycle even when a specific agent marks a step as `skipped`.
- Multi-agent orchestration invariant:
  - multi-agent execution extends the existing backbone and never replaces it with a second workflow;
  - delegation is allowed only inside canonical orchestration points and must return into the same parent cycle;
  - host-specific adapter behavior may change how delegation is invoked, but it must not change the backbone or learning-core sequence.
- Runtime task brief contract (`oap.agent_tasks.task_brief.context_package`, backward-compatible extension):
  - `relevant_anchors[]`, `mandatory_rules[]` (existing);
  - `operational_memory[]` items:
    `key`, `title`, `value`, optional `source_ref`, optional `updated_at`;
  - `collaboration_plan`:
    `analysis_required`, `suggested_agents[]`, `selected_agents[]`, `rationale`, optional `reviewed_at`,
    `strategy`, `reuse_candidates[]`, `created_profiles[]`,
    `primary_coordinator_agent_id`, `final_synthesizer_agent_id`, `merge_owner_agent_id`,
    `interaction_mode`, `interaction_phases[]`, `selection_basis[]`,
    `merge_strategy`, `conflict_policy`,
    `host_execution_strategy`, `context_isolation_policy`,
    `roundtable_policy`, `discussion_rounds[]`,
    `spawned_instances[]`, `orchestration_budget`, optional `delegation_depth`;
  - `ab_test_plan`:
    `enabled`, `sessions_required` (clamp `3..8`), `pass_rule=target_plus_guardrails`,
    `target_metric`, `expected_delta_pct`, `guardrails[]`, `rollback_on_fail`.
  - Persistent agent profile metadata (`docs/agents/registry.yaml -> agents[]`):
    `agentClass`, `origin`, optional `createdByAgentId`, optional `parentTemplateId`,
    optional `derivedFromAgentId`, `specializationScope`, `lifecycle`, optional `creationReason`,
    `capabilityContract`, `workflowBackbone`.
  - Workflow backbone profile contract (`agents[] -> workflowBackbone`):
    `version`, `commonCoreSteps[]`, `roleWindow`, `stepExecutionPolicy`, `supportsDynamicInstances`.
  - Runtime agent instance contract (`collaboration_plan.spawned_instances[]`):
    `instance_id`, `profile_id`, optional `parent_instance_id`, `root_agent_id`, `task_id`,
    `purpose`, `depth`, `allowed_skills[]`, `allowed_tools[]`, `allowed_mcp[]`,
    `applied_rules[]`, `input_refs[]`, `output_refs[]`, `status`, `verify_status`,
    optional `phase_id`, optional `execution_mode`, optional `execution_backend`,
    optional `context_window_id`, optional `isolation_mode`, optional `read_only`,
    optional `ownership_scope[]`, optional `depends_on[]`, optional `merge_target`.
    Execution semantics:
    `status = planned|running|completed|failed|skipped`;
    every instance stays bound to the same `workflowBackbone` family as its parent and may skip unused core steps instead of redefining the cycle.
  - Runtime phase-aware orchestration contract:
    - `interaction_mode`: `sequential|parallel_read_only|mixed_phased`
    - `interaction_phases[]`: `{ phase_id, label, mode, goal, participants[], depends_on[], outputs[], status, merge_into? }`
    - `roundtable_policy`: `{ enabled, moderated_by, max_rounds<=4, transcript_visibility=summary_only, allow_free_chat=false }`
    - `discussion_rounds[]`: summary-only history by round, not raw full transcript
    - `host_execution_strategy`: host-aware policy map, where `Claude Code` / `GitHub Copilot` may use native isolated windows and `Codex` uses dispatcher-backed child runs
    - `context_isolation_policy = per_instance_context_package`
    - V1 safety rule: parallel branches are `read_only`; any `write/apply/merge` is always single-owner.
  - Runtime orchestration budget contract:
    `max_instances`, `max_tokens`, `max_wall_clock_minutes`, `max_no_progress_hops`.
  - `origin_context` (optional provenance object):
    `source`, optional `recommendation_id`, optional `linked_improvement_id`,
    optional `origin_cycle_id` for the cycle where the task was detected or created.
    Do not synthesize `origin_cycle_id` from an unrelated latest cycle; write it only when the producer knows the real origin cycle.
- Runtime candidate intake contract (`candidate_inbox`):
  - `candidate_id`, `source`, `source_key`, `telegram_chat_id`, `telegram_message_id`, `text`, `links[]`, `status`, `received_at`.
  - queue statuses: `candidate_received` -> `processing` -> `ab_test_started|candidate_rejected`.
- Runtime candidate assessment contract (`candidate_assessment`):
  - `candidate_id`, `decision`, `applicability`, `target_metric`, `baseline_value`, `expected_delta`, `objective_risks[]`, `cycles_required`, `decided_at`.
- Canonical terminology:
  - use `candidate` for incoming external practices; avoid parallel naming (`candidat`/`hypothesis`).
  - use `cycle` for task-board provenance (`origin_cycle_id`, column `Цикл`);
    reserve `session` for A/B windows and counters such as `sessions_required`.

## 4. Telemetry Contract (OTel-first)
- Required fields: `agent_id`, `task_id`, `step`, `status`, `run_id`, `trace_id`.
- Minimal lifecycle: `started -> completed|failed`.
- Universal backbone telemetry rule:
  - shared core steps stay stable across agents;
  - agent-specific substeps must be contained inside one explicit `role window`;
  - branch-local telemetry may exist, but it must map back to one backbone entry step and one backbone exit step.
- Specialist orchestration fields (optional but required for full orchestration analytics):
  - `profile_id`, `instance_id`, optional `parent_instance_id`, `root_agent_id`, optional `depth`
  - `rules[]`, `input_artifacts[]`, `output_artifacts[]`, `objective`, `verify_status`
- Workflow lifecycle for learning core:
  `planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
- Specialist orchestration statuses:
  - `agent_profile_reused`, `agent_profile_created`,
  - `agent_instance_spawned`, `agent_instance_completed`, `agent_instance_failed`,
  - `agent_retire_recommended`.
- Candidate/A-B lifecycle statuses:
  - `candidate_received`, `candidate_assessed`, `candidate_rejected`,
  - `ab_test_started`, `ab_test_checkpoint`, `ab_test_passed`, `ab_test_failed`,
  - `rollback_applied`.
- Candidate queue processing policy:
  - intake (`n8n`) is transport-only: accept + enqueue + ACK;
  - decision is produced in `analyst-agent` daily cycle;
  - cycle uses `cutoff_iso` and processes only `candidate_received` with `received_at <= cutoff_iso`;
  - each row is atomically claimed by status transition `candidate_received -> processing`;
  - on processing error row is returned to `candidate_received` for retry in next cycle.
- A/B pass policy (`target_plus_guardrails`):
  - pass when `median(target_delta_pct) >= expected_delta_pct`
    and `guardrail_breached_count = 0`;
  - otherwise `ab_test_failed` and `rollback_applied` are required.

## 5. Architecture Governance
- C4 source file: `docs/oap.c4`.
- Required view IDs:
  - `oap_context`
  - `oap_containers`
  - `db_rpc_boundary`
  - `security_access`
- Validation command:
  - `npx -y likec4@latest validate --ignore-layout docs`

## 6. Change Order
1. Update spec/contracts/ADR for behavior changes.
2. Update architecture/BPMN when flow or boundaries change.
3. Update code.
4. Rebuild generated content and run checks.

## 7. Verification Runbook
- Canonical verification contract: `/.specify/specs/001-oap/contracts/verification.yaml`
- Local and CI checks must use the command list from that contract without local forks.

CI merge-gate:
- `.github/workflows/ci.yml` must run the same command list from `/.specify/specs/001-oap/contracts/verification.yaml`, including targeted Playwright smoke route checks for capability-routing and deeplink canonicalization, plus Python `unittest` suite on every pull request.
