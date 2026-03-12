# <Agent Name> Operating Plan

> Шаблон. Скопировать в `docs/subservices/oap/agents/<agent-id>/OPERATING_PLAN.md` и заполнить.

## Назначение агента
<!-- Кратко: что делает агент и какую ценность приносит. -->

## Universal Backbone Mapping
- Версия: `universal_backbone_v1`
- Общие core-этапы:
  1. `step_0_intake`
  2. `step_1_start`
  3. `step_2_preflight`
  4. `step_3_orchestration`
  5. `step_4_context_sync`
  6. `step_5_role_window`
  7. `step_6_role_exit_decision`
  8. `step_7_apply_or_publish`
  9. `step_7_contract_gate`
  10. `step_8_verify`
  11. `step_8_error_channel`
  12. `step_9_finalize`
  13. `step_9_publish_snapshots`
- Если шаг не нужен агенту, он не удаляется из схемы, а фиксируется как `skipped`.

## Capability Selection Contract (Mandatory)
<!-- contract-marker: baseline-minimum -->
<!-- contract-marker: dynamic-capability-selection -->
- Step-level `Навыки/Инструменты/MCP` задают baseline minimum.
- Runtime-capabilities выбираются динамически из capability-first источников:
  - `workflowBackbone`,
  - `collaboration_plan.spawned_instances.allowed_skills/allowed_tools/allowed_mcp`,
  - `docs/agents/registry.yaml` (`used*`/`available*`),
  - `artifacts/capability_trials/<agent-id>/capability_snapshot.json`.
- Policy-gates обязательны:
  - `official-first`,
  - `shadow trial`,
  - `human approve`.
- Fallback при недоступности capability должен быть явным и зафиксированным в telemetry.

## Delegation Contract
- Делегирование допустимо только в:
  - `step_3_orchestration`
  - `step_5_role_window`
  - `step_6_role_exit_decision`
- Child-run не создает новую схему работы: он следует тому же `workflowBackbone` семейству и может только помечать неиспользуемые шаги как `skipped`.
- Для каждого delegated run зафиксируй:
  - `purpose`
  - `input package`
  - `allowed_skills/tools/mcp/rules`
  - `output contract`
  - `parent_instance_id`
  - `root_agent_id`
  - `depth`
  - `orchestration budget`
- Если host не умеет native delegation, используй dispatcher-backed execution через `scripts/oap_agent_dispatcher.py`.
- Минимальные execution artifacts delegated run:
  - `artifacts/agent_runs/<run-id>/run_manifest.json`
  - `artifacts/agent_runs/<run-id>/result.json`
- Минимальные telemetry-события delegated run:
  - `agent_instance_spawned`
  - `agent_instance_completed|agent_instance_failed`

## Role Window
- Назначение role-window:
  <!-- Какую доменную работу агент выполняет внутри своей уникальной ветки. -->
- Вход в ветку:
  - `entryStep = step_5_role_window`
- Выход из ветки:
  - `exitStep = step_6_role_exit_decision`
- Внутренние шаги role-window:
  1. <!-- role_step_1 -->
  2. <!-- role_step_2 -->
  3. <!-- role_step_3 -->
- Результат role-window:
  - `decision package`
  - `artifact refs`
  - `verify requirements`
  - `status`

## Процесс (BPMN-style)
<!-- Покажите, как агент проходит общий backbone и что делает внутри role-window. -->

## Навыки и инструменты
<!-- Для каждого шага фиксируйте формат:
- Baseline capabilities: минимальный набор.
- Dynamic capabilities (runtime-selected): фактический runtime-набор. -->

## Self-Improvement and Lesson Gate (Mandatory)
<!-- contract-marker: self-improvement-gate -->
- Learning-core done-gate:
  `planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
- Любая пользовательская коррекция фиксируется как lesson (`root cause` + `preventive rule`).

## Capability Refresh Note (Mandatory)
<!-- contract-marker: capability-refresh -->
- Для production-like run обязателен `capability_refresh` (`on_run`).
- Source-of-truth capability-table: `artifacts/capability_trials/<agent-id>/capability_snapshot.json`.
- Stale snapshot блокирует promotion/replace до следующего refresh.

## Память
- Краткосрочная: <!-- contextAnchors, retrieval, riskControl -->
- Долговременная: <!-- persistentRules, lessons -->

## Метрики качества
<!-- KPI агента: TQS, review_error_rate, recommendation_action_rate и т.д. -->

## Источники данных
<!-- Какие файлы/артефакты агент читает и пишет. -->
