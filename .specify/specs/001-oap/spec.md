# OAP Spec (Source of Truth)

## 1. Product Scope
- Project: OAP (Operations & Agents Platform).
- Purpose: operational control panel for AI agents, task quality, telemetry, and improvement governance.
- Out of scope: domain features outside OAP operational governance.

## 2. Core Modules
- `ops-web`: UI dashboard for agents, tasks, telemetry, docs, and BPMN/C4 views.
- `scripts/agent_telemetry.py`: write/read telemetry events and aggregated reports.
- `scripts/sync_agent_tasks.py`: seed/sync task board from registry and telemetry signals.
- `scripts/candidate_processor.py`: normalize Telegram intake payloads into canonical `candidate` contracts and run guarded-auto assessment.
- `docs/agents/registry.yaml`: canonical agent registry and card payload source.
- `artifacts/n8n/oap_candidate_intake_v1.json`: importable n8n workflow for Telegram candidate intake.

## 3. Data Contracts
- Agent card contract: `docs/subservices/oap/agents-card.schema.json`.
- Registry source: `docs/agents/registry.yaml`.
- Generated artifacts: `ops-web/src/generated/*.json` and optional `artifacts/*.json|*.md`.
- Runtime task brief contract (`bible.agent_tasks.task_brief.context_package`, backward-compatible extension):
  - `relevant_anchors[]`, `mandatory_rules[]` (existing);
  - `operational_memory[]` items:
    `key`, `title`, `value`, optional `source_ref`, optional `updated_at`;
  - `collaboration_plan`:
    `analysis_required`, `suggested_agents[]`, `selected_agents[]`, `rationale`, optional `reviewed_at`;
  - `ab_test_plan`:
    `enabled`, `sessions_required` (clamp `3..8`), `pass_rule=target_plus_guardrails`,
    `target_metric`, `expected_delta_pct`, `guardrails[]`, `rollback_on_fail`.
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
- Workflow lifecycle for learning core:
  `planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
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
- `npm --prefix ops-web run prepare-content`
- `npm --prefix ops-web run check-agents`
- `npm --prefix ops-web run build`
