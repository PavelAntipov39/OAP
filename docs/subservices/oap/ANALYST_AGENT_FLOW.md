# Analyst Agent Flow (BPMN-style in C4)

Назначение:
- этот DSL отражает процессную логику `analyst-agent` в формате C4 с BPMN-стилем шагов;
- показывает, где агент читает данные, где пишет артефакты, где отправляет уведомления.

Как использовать:
1. Откройте [LikeC4 Playground](https://playground.likec4.dev/).
2. Вставьте DSL ниже.
3. Откройте view:
   - `analyst_flow_context`
   - `analyst_flow_steps`
   - `analyst_flow_io`
   - `analyst_flow_notifications`

BPMN-версия процесса:
- `docs/bpmn/analyst-agent-flow.bpmn`
- UI: `#/agent-flow` (блок "Как должен работать")

```c4
specification {
  color c4blue #1f5fa8
  color c4ext #7a7f96

  element actor {
    notation "Пользователь"
    style {
      shape person
      color c4blue
    }
  }

  element external_system {
    notation "Внешняя система"
    style {
      color c4ext
      opacity 20%
    }
  }

  element software_system {
    notation "Программная система"
    style {
      color c4blue
      opacity 12%
    }
  }

  element container {
    notation "Контейнер"
    style {
      color c4blue
    }
  }

  element database {
    notation "Хранилище"
    style {
      shape storage
      color c4blue
    }
  }
}

model {
  analyst = actor "analyst-agent" {
    description "Анализирует всех агентов ежедневно и управляет lifecycle улучшений."
  }

  owner = actor "Владелец платформы" {
    description "Получает критичные уведомления и подтверждает спорные решения."
  }

  vendor_docs = external_system "Официальные источники (whitelist)" {
    description "OpenAI/Anthropic/docs/changelog и другие проверенные vendor sources."
  }

  oss_best_practices = external_system "Проверенные open-source практики" {
    description "Крупные проекты с доказанной эффективностью."
  }

  telegram_api = external_system "Telegram Bot API" {
    description "Канал alert/digest уведомлений."
  }

  analyst_ops = software_system "Analyst Agent Operations (OAP)" {
    description "Операционный контур аналитика: шаги процесса, данные, telemetry, уведомления."

    step_1_start = container "Step 1 - Start daily cycle" {
      description "Запуск цикла и фиксация статуса started."
    }

    step_2_health_check = container "Step 2 - Health-check agents" {
      description "Проверка статусов, задач, review-ошибок, деградаций MCP."
    }

    step_3_kb_sync = container "Step 3 - Validate KB/Rules" {
      description "Проверка актуальности spec/contracts/rules/runbook."
    }

    step_4_source_monitor = container "Step 4 - Monitor whitelist updates" {
      description "Сверка внешних обновлений с текущей базой знаний."
    }

    step_5_improvement_planning = container "Step 5 - Build and prioritize improvements" {
      description "Формирование полного списка улучшений и выбор top-priority."
    }

    step_6_apply = container "Step 6 - Apply top-priority changes" {
      description "Внедрение только приоритетных улучшений, остальное в backlog."
    }

    step_7_verify = container "Step 7 - Verify effect and regressions" {
      description "Проверка target metrics и регрессий."
    }

    step_8_finalize = container "Step 8 - Finalize and notify" {
      description "Запись completed/failed, report generation, critical+digest notifications."
    }

    registry_store = database "Registry Store" {
      description "docs/agents/registry.yaml"
    }

    docs_store = database "KB Docs Store" {
      description ".specify/spec.md + contracts/* + docs/subservices/oap/*.md"
    }

    schema_guard = container "Schema Guard" {
      description "docs/subservices/oap/agents-card.schema.json + ops-web/scripts/check_agents_manifest.mjs"
    }

    content_builder = container "Content Builder" {
      description "ops-web/scripts/build_content_index.mjs"
    }

    generated_store = database "Generated Store" {
      description "ops-web/src/generated/agents-manifest.json + docs-index.json + search-index.json"
    }

    telemetry_logger = container "Telemetry Logger" {
      description "scripts/agent_telemetry.py (log/report)"
    }

    telemetry_log_store = database "Telemetry Log Store" {
      description ".logs/agents/*.jsonl"
    }

    telemetry_report_store = database "Telemetry Report Store" {
      description "artifacts/agent_telemetry_summary.json/.md"
    }

    notifier = container "Notifier" {
      description "scripts/notify_analyst_digest.mjs"
    }

    env_secrets = database "Env Secrets" {
      description "ANALYST_TELEGRAM_BOT_TOKEN + ANALYST_TELEGRAM_CHAT_ID"
    }

    ui_card = container "OAP Agent Card UI" {
      description "ops-web/src/pages/AgentsPage.tsx"
    }

    analyst -> step_1_start "trigger daily run"
    step_1_start -> telemetry_logger "write started [scripts/agent_telemetry.py log]"
    telemetry_logger -> telemetry_log_store "append jsonl"

    step_1_start -> step_2_health_check "next"
    step_2_health_check -> registry_store "read tasks/taskEvents/improvements [read]"

    step_2_health_check -> step_3_kb_sync "next"
    step_3_kb_sync -> docs_store "read spec/contracts/oap rules [read]"
    step_3_kb_sync -> schema_guard "validate structure and required fields [check]"

    step_3_kb_sync -> step_4_source_monitor "next"
    step_4_source_monitor -> vendor_docs "read updates [read]"
    step_4_source_monitor -> oss_best_practices "read updates [read]"

    step_4_source_monitor -> step_5_improvement_planning "next"
    step_5_improvement_planning -> registry_store "write lifecycle statuses + prioritized improvements [write]"

    step_5_improvement_planning -> step_6_apply "next"
    step_6_apply -> content_builder "rebuild indexes [ops-web/scripts/build_content_index.mjs]"
    content_builder -> generated_store "write generated json [write]"

    step_6_apply -> step_7_verify "next"
    step_7_verify -> telemetry_logger "write recommendation_applied/review statuses [write]"
    step_7_verify -> telemetry_log_store "read/write verification signals"
    telemetry_logger -> telemetry_report_store "report aggregation [scripts/agent_telemetry.py report]"

    step_7_verify -> step_8_finalize "next"
    step_8_finalize -> telemetry_logger "write completed/failed [write]"
    step_8_finalize -> notifier "trigger critical+digest"
    notifier -> env_secrets "read token/chat_id [read]"
    notifier -> telegram_api "send notifications"
    telegram_api -> owner "deliver alerts"

    ui_card -> generated_store "read operatingPlan/improvements/rules [read]"
    ui_card -> telemetry_report_store "read KPI summaries [read]"

    owner -> step_8_finalize "approve/resolve high-risk decisions"
  }
}

views {
  view analyst_flow_context {
    title "Analyst Agent - C1 Context"
    include analyst, owner, vendor_docs, oss_best_practices, telegram_api, analyst_ops
    exclude analyst_ops.*
    autoLayout LeftRight
  }

  view analyst_flow_steps of analyst_ops {
    title "Analyst Agent - BPMN-style Steps (C4)"
    include
      analyst,
      owner,
      step_1_start,
      step_2_health_check,
      step_3_kb_sync,
      step_4_source_monitor,
      step_5_improvement_planning,
      step_6_apply,
      step_7_verify,
      step_8_finalize
    autoLayout TopBottom
  }

  view analyst_flow_io of analyst_ops {
    title "Analyst Agent - File I/O and Artifacts"
    include
      analyst,
      step_2_health_check,
      step_3_kb_sync,
      step_5_improvement_planning,
      step_6_apply,
      step_7_verify,
      registry_store,
      docs_store,
      schema_guard,
      content_builder,
      generated_store,
      telemetry_logger,
      telemetry_log_store,
      telemetry_report_store,
      ui_card
    autoLayout LeftRight
  }

  view analyst_flow_notifications of analyst_ops {
    title "Analyst Agent - Notifications and Security"
    include
      analyst,
      owner,
      step_8_finalize,
      notifier,
      env_secrets,
      telegram_api,
      telemetry_logger,
      telemetry_log_store,
      telemetry_report_store
    autoLayout LeftRight
  }
}
```
