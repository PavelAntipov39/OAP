# OAP Datasets and ETL Contract

## 1. Scope
- This contract describes OAP operational datasets, not domain ingest datasets.

## 2. Registry Dataset
- File: `docs/agents/registry.yaml`
- Role: canonical source for agent cards, recommendations, references, and workflow policy defaults.
- Constraints:
  - must be JSON-compatible YAML;
  - must pass `npm --prefix ops-web run check-agents`.
- Persistent profile metadata required for each agent row:
  - `agentClass`, `origin`, `lifecycle`, `specializationScope`, `capabilityContract`
  - optional provenance: `createdByAgentId`, `parentTemplateId`, `derivedFromAgentId`, `creationReason`

## 2.1 Specialist template dataset
- File: `docs/agents/profile_templates.yaml`
- Role: reusable blueprint catalog for specialist profile derivation.
- Minimum template fields:
  - `id`, `name`, `scope`, `matchKeywords[]`
  - `allowedSkills[]`, `allowedTools[]`, `allowedMcp[]`, `defaultRules[]`
  - `outputSchema`
- Constraint:
  - templates may compose only already approved OAP `Skills / Tools / MCP / Rules`.

## 3. Telemetry Dataset
- Raw logs: `.logs/agents/*.jsonl`
- Aggregates:
  - `artifacts/agent_telemetry_summary.json`
  - `artifacts/agent_telemetry_summary.md`
  - optional cycle artifacts consumed by `#/agent-flow`.
- Safety:
  - never store secrets (`token`, `password`, `apikey`, `dsn`).
- Specialist orchestration additions:
  - per-event fields:
    `profile_id`, `instance_id`, optional `parent_instance_id`, `root_agent_id`, optional `depth`,
    `rules[]`, `input_artifacts[]`, `output_artifacts[]`, `objective`, `verify_status`
  - aggregated KPIs:
    `reuse_hit_rate`, `new_profile_creation_rate`, `specialist_verify_pass_rate`,
    `profile_sprawl_ratio`, `tool_overreach_rate`, `orchestration_cost_per_completed_task`, `time_to_verify`

## 3.1 A/B checkpoint telemetry fields
- For `ab_test_checkpoint` events, metrics payload should include:
  - `target_delta_pct` (number),
  - `guardrail_breached` (boolean),
  - `ab_sessions_required` (integer, `3..8`).
- These fields are optional for compatibility, but required for full A/B progress analytics.

## 3.2 Canonical file trace operations (optional, backward-compatible)
- Event payload may include `artifact_operations[]` with canonical operations:
  - `op`: `read|create|update|delete`
  - required context fields: `path`, `timestamp`, `step`, `task_id`, `run_id`
- Event provenance fields (producer contract v2):
  - `artifact_contract_version`: `v2`
  - `artifact_ops_origin`: `explicit|mirrored_legacy|step_fallback|none`
- Compatibility policy:
  - if only `artifacts_read[]/artifacts_written[]` are provided, producer auto-builds fallback operations as `read|write`;
  - if `artifact_operations[]` is provided, producer mirrors legacy arrays for old consumers;
  - `delete` is mirrored into `artifacts_written[]` for legacy compatibility, while staying explicit in `artifact_operations[]`.
- Telemetry quality KPIs (summary-level):
  - `file_ops_eligible_events`
  - `file_ops_explicit_events`
  - `file_ops_mirrored_legacy_events`
  - `file_ops_step_fallback_events`
  - `file_ops_operations_total`
  - `file_ops_delete_total`
  - `file_ops_explicit_coverage_pct`
  - `file_ops_fallback_share_pct`
- Report gate params for producer rollout quality:
  - `--file-ops-explicit-min-pct` (default `90`)
  - `--file-ops-fallback-max-pct` (default `10`)
  - `--file-ops-gate-mode soft_warning|strict` (default `soft_warning`)
  - `--file-ops-min-events` (default `5`, sample-size guard)
- Consumer/UI v1 policy:
  - display canon is `read/write/delete`;
  - `create/update` are treated as write-like operations until a dedicated UI contract for `create/update` is introduced.

## 4. Candidate Intake Dataset (runtime)
- Canonical entity name: `candidate`.
- Primary runtime table (shared DB owner repo): `candidate_inbox`.
- Required fields:
  - `candidate_id`, `source`, `source_key`, `telegram_chat_id`, `telegram_message_id`,
  - `text`, `links[]`, `status`, `received_at`.
- Queue status contract:
  - `candidate_received` (pending),
  - `processing` (claimed by cycle run),
  - terminal: `ab_test_started` or `candidate_rejected`.
- Assessment dataset:
  - `candidate_assessment` with fields
    `candidate_id`, `decision`, `applicability`, `target_metric`, `baseline_value`,
    `expected_delta`, `objective_risks[]`, `cycles_required`, `decided_at`.
- Idempotency:
  - one row per unique `source_key`.
  - during cycle processing, claim by conditional update (`status=eq.candidate_received`) to avoid duplicate processing when multiple runs overlap.

## 4.1 Candidate assessment extensions
- `candidate_assessment` may include:
  - `ab_plan`:
    - `enabled`, `sessions_required`, `pass_rule`, `target_metric`, `expected_delta_pct`, `guardrails[]`, `rollback_on_fail`;
  - `collaboration_hints`:
    - `suggested_agents[]`, `rationale`.

## 5. Generated Frontend Datasets
- Directory: `ops-web/src/generated/`
- Build source: `ops-web/scripts/build_content_index.mjs`
- Assistant governance dataset:
  - source contract: `/.specify/specs/001-oap/contracts/assistant-governance.json`
  - generated payload: `ops-web/src/generated/assistant-governance.json`
  - generated entry files: `.github/copilot-instructions.md`, `CLAUDE.md`
- Dynamic UI section dataset:
  - generated payload: `ops-web/src/generated/ui-section-contract.json`
  - schema fields per section: `section_id`, `current_label`, `container_type`, `card_type`, `visibility`, `source_file`
- Regeneration is required after relevant docs/registry/schema changes:
  - `npm --prefix ops-web run prepare-content`

## 6. Task brief runtime dataset
- Source: `oap.agent_tasks.task_brief` (JSONB payload in runtime DB).
- Required baseline fields remain unchanged.
- Extended `context_package` fields:
  - `operational_memory[]`,
  - `collaboration_plan`,
  - `ab_test_plan`.
- Extended `collaboration_plan` orchestration fields:
  - `strategy`
  - `reuse_candidates[]`
  - `created_profiles[]`
  - `spawned_instances[]`
  - `orchestration_budget`
  - `delegation_depth`
