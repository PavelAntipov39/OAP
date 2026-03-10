# <Agent Name> Operating Plan

> Шаблон. Скопировать в `docs/subservices/oap/agents/<agent-id>/OPERATING_PLAN.md` и заполнить.

## Назначение агента
<!-- Кратко: что делает агент и какую ценность приносит. -->

## Universal Session Backbone
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
<!-- Какие skills, MCP-серверы, tools используются. -->

## Память
- Краткосрочная: <!-- contextAnchors, retrieval, riskControl -->
- Долговременная: <!-- persistentRules, lessons -->

## Метрики качества
<!-- KPI агента: TQS, review_error_rate, recommendation_action_rate и т.д. -->

## Источники данных
<!-- Какие файлы/артефакты агент читает и пишет. -->
