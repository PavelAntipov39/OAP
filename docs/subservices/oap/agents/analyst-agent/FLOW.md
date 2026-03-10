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

    step_0_intake = container "Step 0 - Task intake and sync" {
      description "Подготовка task-run, context package и стартовых ограничений до запуска цикла."
    }

    step_1_start = container "Step 1 - Start daily cycle" {
      description "Запуск цикла и фиксация статуса started."
    }

    step_2_health_check = container "Step 2 - Health-check agents" {
      description "Проверка статусов, задач, review-ошибок, деградаций MCP."
    }

    step_3_orchestration = container "Step 3 - Reuse-first orchestration" {
      description "Выбор strategy reuse/create, bounded specialist instances, orchestration budget."
    }

    step_4_evidence_sync = container "Step 4 - Evidence retrieval and KB sync" {
      description "Сбор доказательств и проверка актуальности spec/contracts/rules/runbook."
    }

    step_5_candidate_scoring = container "Step 5 - Build candidate list and score" {
      description "Analyst role-window: вход в уникальную ветку аналитика, формирование candidate-list с owner/metric/baseline/delta."
    }

    step_6_priority_decision = container "Step 6 - Priority decision and A/B gate" {
      description "Analyst role-window exit: выбор top-priority, перевод в backlog/ab_test и возврат decision package в общий backbone."
    }

    step_7_apply = container "Step 7 - Apply selected changes" {
      description "Внедрение выбранных изменений и обновление generated artifacts."
    }

    step_7_contract_gate = container "Step 7.1 - Contract gate" {
      description "Проверка schema/manifest после внедрения изменений."
    }

    step_8_verify = container "Step 8 - Verify effect and regressions" {
      description "Проверка target metrics, regressions и cycle validation."
    }

    step_8_error_channel = container "Step 8.1 - Error channel" {
      description "Фиксация verify-ошибок в отдельном журнале и привязка owner/next action."
    }

    step_9_finalize = container "Step 9 - Learn, finalize and notify" {
      description "Обновление lessons + telemetry summary, затем completed/failed и notifications."
    }

    step_9_publish_snapshots = container "Step 9.1 - Publish runtime snapshots" {
      description "Публикация generated snapshot-файлов для UI без ручных правок."
    }

    registry_store = database "Registry Store" {
      description "docs/agents/registry.yaml"
    }

    templates_store = database "Profile Template Store" {
      description "docs/agents/profile_templates.yaml"
    }

    docs_store = database "KB Docs Store" {
      description ".specify/spec.md + contracts/* + docs/subservices/oap/*.md"
    }

    lessons_store = database "Lessons Store" {
      description "docs/subservices/oap/tasks/lessons.global.md + lessons/analyst-agent.md"
    }

    task_runtime_store = database "Task Runtime Store" {
      description "agent_tasks.task_brief.context_package (operational_memory/collaboration_plan/ab_test_plan)"
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

    telemetry_error_store = database "Telemetry Error Store" {
      description ".logs/agents/analyst-agent-errors.jsonl"
    }

    telemetry_report_store = database "Telemetry Report Store" {
      description "artifacts/agent_telemetry_summary.json/.md"
    }

    runtime_snapshot_store = database "Runtime Snapshot Store" {
      description "ops-web/src/generated/agent-latest-cycle-analyst.json + agent-benchmark-summary.json + ops-web/public/generated/*.json"
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

    analyst -> step_0_intake "trigger task sync"
    step_0_intake -> registry_store "read profile/task sources [read]"
    step_0_intake -> templates_store "read reusable specialist templates [read]"
    step_0_intake -> telemetry_log_store "read recent cycle traces [read]"
    step_0_intake -> task_runtime_store "write initial context_package [write]"

    step_0_intake -> step_1_start "next"
    analyst -> step_1_start "trigger daily run"
    step_1_start -> telemetry_logger "write started [scripts/agent_telemetry.py log]"
    telemetry_logger -> telemetry_log_store "append jsonl"

    step_1_start -> step_2_health_check "next"
    step_2_health_check -> registry_store "read tasks/taskEvents/improvements [read]"

    step_2_health_check -> step_3_orchestration "next"
    step_3_orchestration -> registry_store "read active profiles and capabilities [read]"
    step_3_orchestration -> templates_store "read specialist templates [read]"
    step_3_orchestration -> task_runtime_store "write collaboration_plan and orchestration budget [write]"

    step_3_orchestration -> step_4_evidence_sync "next"
    step_4_evidence_sync -> docs_store "read spec/contracts/oap rules [read]"
    step_4_evidence_sync -> schema_guard "validate structure and required fields [check]"
    step_4_evidence_sync -> vendor_docs "read updates [read]"
    step_4_evidence_sync -> oss_best_practices "read updates [read]"

    step_4_evidence_sync -> step_5_candidate_scoring "next"
    step_5_candidate_scoring -> task_runtime_store "write candidate list and scoring signals [write]"

    step_5_candidate_scoring -> step_6_priority_decision "next"
    step_6_priority_decision -> registry_store "write lifecycle statuses + selected priority [write]"
    step_6_priority_decision -> task_runtime_store "write ab_test_plan and selection rationale [write]"

    step_6_priority_decision -> step_7_apply "next"
    step_7_apply -> content_builder "rebuild indexes [ops-web/scripts/build_content_index.mjs]"
    content_builder -> generated_store "write generated json [write]"

    step_7_apply -> step_7_contract_gate "next"
    step_7_contract_gate -> schema_guard "validate generated manifest and schema [check]"
    step_7_contract_gate -> telemetry_logger "write contract gate status [write]"

    step_7_contract_gate -> step_8_verify "next"
    step_8_verify -> telemetry_logger "write recommendation_applied/review statuses [write]"
    step_8_verify -> telemetry_log_store "read/write verification signals"
    telemetry_logger -> telemetry_report_store "report aggregation [scripts/agent_telemetry.py report]"
    step_8_verify -> telemetry_report_store "write cycle_validation report [write]"

    step_8_verify -> step_8_error_channel "next"
    step_8_error_channel -> telemetry_error_store "write classified verify errors [write]"
    step_8_error_channel -> telemetry_logger "write review_error statuses [write]"

    step_8_error_channel -> step_9_finalize "next"
    step_9_finalize -> lessons_store "write lessons and status updates [write]"
    step_9_finalize -> telemetry_logger "write lesson_captured/completed/failed [write]"
    step_9_finalize -> notifier "trigger critical+digest"
    notifier -> env_secrets "read token/chat_id [read]"
    notifier -> telegram_api "send notifications"
    telegram_api -> owner "deliver alerts"

    step_9_finalize -> step_9_publish_snapshots "next"
    step_9_publish_snapshots -> content_builder "refresh latest-cycle and benchmark snapshots [write]"
    step_9_publish_snapshots -> runtime_snapshot_store "write UI runtime snapshots [write]"

    ui_card -> generated_store "read operatingPlan/improvements/rules [read]"
    ui_card -> telemetry_report_store "read KPI summaries [read]"

    owner -> step_9_finalize "approve/resolve high-risk decisions"
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
      step_0_intake,
      step_1_start,
      step_2_health_check,
      step_3_orchestration,
      step_4_evidence_sync,
      step_5_candidate_scoring,
      step_6_priority_decision,
      step_7_apply,
      step_7_contract_gate,
      step_8_verify,
      step_8_error_channel,
      step_9_finalize,
      step_9_publish_snapshots
    autoLayout TopBottom
  }

  view analyst_flow_io of analyst_ops {
    title "Analyst Agent - File I/O and Artifacts"
    include
      analyst,
      step_0_intake,
      step_2_health_check,
      step_3_orchestration,
      step_4_evidence_sync,
      step_5_candidate_scoring,
      step_6_priority_decision,
      step_7_apply,
      step_7_contract_gate,
      step_8_verify,
      step_8_error_channel,
      step_9_publish_snapshots,
      registry_store,
      templates_store,
      docs_store,
      lessons_store,
      task_runtime_store,
      schema_guard,
      content_builder,
      generated_store,
      telemetry_logger,
      telemetry_log_store,
      telemetry_error_store,
      telemetry_report_store,
      runtime_snapshot_store,
      ui_card
    autoLayout LeftRight
  }

  view analyst_flow_notifications of analyst_ops {
    title "Analyst Agent - Notifications and Security"
    include
      analyst,
      owner,
      step_9_finalize,
      step_9_publish_snapshots,
      notifier,
      env_secrets,
      telegram_api,
      telemetry_logger,
      telemetry_log_store,
      telemetry_error_store,
      telemetry_report_store
    autoLayout LeftRight
  }
}
```
