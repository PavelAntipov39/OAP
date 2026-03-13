---
{
  "id": "ui-verification",
  "displayName": "UI Verification Specialist",
  "kind": "runtime_specialist",
  "mission": "Проверять runtime UI-поведение в браузере и возвращать воспроизводимый verify package.",
  "useWhen": [
    "Изменение затрагивает маршруты, фильтры, модалки, табы, таблицы или контент в UI.",
    "Нужен воспроизводимый browser-based verify."
  ],
  "avoidWhen": [
    "Изменение не имеет runtime UI-поведения.",
    "Верификация возможна статически без браузера."
  ],
  "inputContract": "ui_verification_request.v1",
  "outputContract": "ui_verification_report.v1",
  "allowedSkills": ["playwright"],
  "allowedTools": ["Browser verification"],
  "allowedMcp": ["playwright"],
  "allowedRules": ["OAP Design Rule", "Universal workflow backbone"],
  "handoffTargets": [],
  "executionMode": "parallel_read_only",
  "supportedHosts": ["codex", "claude_code", "github_copilot"],
  "hostAdapters": {
    "github_copilot": {
      "description": "Изменение затрагивает маршруты, фильтры, модалки, табы, таблицы или контент в UI.",
      "tools": ["read", "search", "execute"],
      "agents": []
    }
  },
  "stopConditions": ["verification_report_ready", "critical_regression_found", "budget_exhausted"]
}
---

# Операционный стандарт `ui-verification`

## Назначение агента
Проверять runtime UI-поведение в браузере и возвращать воспроизводимый verify package.

Когда использовать:
- Изменение затрагивает маршруты, фильтры, модалки, табы, таблицы или контент в UI.
- Нужен воспроизводимый browser-based verify.

Не использовать:
- Изменение не имеет runtime UI-поведения.
- Верификация возможна статически без браузера.

## Контракт
- Input: `ui_verification_request.v1`
- Output: `ui_verification_report.v1`

## Runtime envelope
- Allowed skills: playwright
- Allowed tools: Browser verification
- Allowed MCP: playwright
- Allowed rules: OAP Design Rule, Universal workflow backbone
- Delegation targets: нет
- Execution mode: parallel_read_only

## Universal Backbone Mapping
- Версия: `universal_backbone_v1`
- Общие core-этапы:
  1. `step_0_intake`
  2. `step_1_start`
  3. `step_2_preflight`
  4. `step_3_orchestration` — skipped
  5. `step_4_context_sync`
  6. `step_5_role_window`
  7. `step_6_role_exit_decision`
  8. `step_7_apply_or_publish` — skipped
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
  - `artifacts/capability_trials/ui-verification/capability_snapshot.json`.
- Policy-gates обязательны:
  - `official-first`,
  - `shadow trial`,
  - `human approve`.
- Fallback при недоступности capability должен быть явным и зафиксированным в telemetry.

## Role Window
- Назначение: browser-based верификация UI-поведения.
- `entryStep = step_5_role_window`
- `exitStep = step_6_role_exit_decision`
- Внутренние шаги:
  1. Запустить browser-сценарий по verify-запросу.
  2. Проверить маршруты, фильтры, модалки, табы, контент.
  3. Зафиксировать regression/pass и скриншоты.
- Результат: `ui_verification_report.v1`

## Self-Improvement and Lesson Gate (Mandatory)
<!-- contract-marker: self-improvement-gate -->
- Learning-core done-gate:
  `planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
- Любая пользовательская коррекция фиксируется как lesson (`root cause` + `preventive rule`).

## Capability Refresh Note (Mandatory)
<!-- contract-marker: capability-refresh -->
- Для production-like run обязателен `capability_refresh` (`on_run`).
- Source-of-truth capability-table: `artifacts/capability_trials/ui-verification/capability_snapshot.json`.
- Stale snapshot блокирует promotion/replace до следующего refresh.

## Stop conditions
- `verification_report_ready`
- `critical_regression_found`
- `budget_exhausted`
