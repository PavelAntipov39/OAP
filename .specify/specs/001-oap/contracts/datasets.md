# OAP Datasets and ETL Contract

## 1. Scope
- This contract describes OAP operational datasets, not domain ingest datasets.

## 2. Registry Dataset
- File: `docs/agents/registry.yaml`
- Role: canonical source for agent cards, recommendations, references, and workflow policy defaults.
- Constraints:
  - must be JSON-compatible YAML;
  - must pass `npm --prefix ops-web run check-agents`.

## 3. Telemetry Dataset
- Raw logs: `.logs/agents/*.jsonl`
- Aggregates:
  - `artifacts/agent_telemetry_summary.json`
  - `artifacts/agent_telemetry_summary.md`
  - optional cycle artifacts consumed by `#/agent-flow`.
- Safety:
  - never store secrets (`token`, `password`, `apikey`, `dsn`).

## 3.1 A/B checkpoint telemetry fields
- For `ab_test_checkpoint` events, metrics payload should include:
  - `target_delta_pct` (number),
  - `guardrail_breached` (boolean),
  - `ab_sessions_required` (integer, `3..8`).
- These fields are optional for compatibility, but required for full A/B progress analytics.

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
- Regeneration is required after relevant docs/registry/schema changes:
  - `npm --prefix ops-web run prepare-content`

## 6. Task brief runtime dataset
- Source: `bible.agent_tasks.task_brief` (JSONB payload in runtime DB).
- Required baseline fields remain unchanged.
- Extended `context_package` fields:
  - `operational_memory[]`,
  - `collaboration_plan`,
  - `ab_test_plan`.
