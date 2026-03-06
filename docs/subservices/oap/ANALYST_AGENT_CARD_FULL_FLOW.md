# Analyst Agent Card - Full Process Model (C4 with BPMN logic)

Этот файл описывает полную процессную модель `analyst-agent` с привязкой к реальным сущностям карточки:
- какие поля карточки существуют;
- какие файлы/артефакты их наполняют;
- где агент читает и где пишет;
- как разделены краткосрочная и долговременная память;
- в каком шаге цикла обновляются `tasks`, `taskEvents`, `improvements`, telemetry и уведомления.

## Быстрая карта полей карточки (что откуда)
- `usedSkills[]` / `availableSkills[]`: реестр + резолв `SKILL.md` через `ops-web/scripts/build_content_index.mjs`.
- `usedMcp[]` / `availableMcp[]` / `mcpServers[]`: `docs/agents/registry.yaml`.
- `rulesApplied[]`: `docs/agents/registry.yaml` + fallback из `contextRefs[]`.
- `operatingPlan`: `docs/agents/registry.yaml` (для `analyst-agent`) + стандарт `docs/subservices/oap/ANALYST_OPERATING_PLAN.md`.
- `tasks` / `taskEvents`: `docs/agents/registry.yaml` (+ telemetry overlay для аналитики).
- `memoryContext`:
  - краткосрочная: `currentTask`, `contextAnchors`, `retrieval`, `decisionUsage`, `economics`, `riskControl`, `nextActions`;
  - долговременная: `persistentRules`.
- `improvements[]`: `docs/agents/registry.yaml`, обязательные аналитические поля:
  `ownerSection`, `targetMetric`, `baselineWindow`, `expectedDelta`, `validationDate`, `prompt*`, `ice`.
- telemetry:
  - write-ahead лог: `.logs/agents/*.jsonl`;
  - агрегаты: `artifacts/agent_telemetry_summary.json/.md`.
- UI-источник рантайма: `ops-web/src/generated/agents-manifest.json` (+ `docs-index.json`, `search-index.json`).

## LikeC4 DSL (вставить в Playground)

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
    description "Проводит ежедневный аудит всех агентов и управляет улучшениями."
  }

  owner = actor "Владелец платформы" {
    description "Получает критичные уведомления и утверждает рискованные изменения."
  }

  implementer = actor "Исполняющий агент" {
    description "Выполняет внедрение промтов/изменений, предложенных аналитиком."
  }

  vendor_docs = external_system "Официальные источники (whitelist)" {
    description "Vendor docs/changelog (OpenAI, Anthropic и т.д.)."
  }

  oss_practices = external_system "Проверенные open-source практики" {
    description "Крупные проекты с доказанной эффективностью."
  }

  telegram_api = external_system "Telegram Bot API" {
    description "Канал critical alerts и daily digest."
  }

  oap_card_flow = software_system "OAP Analyst Card Flow" {
    description "Полная карта: процесс аналитика + сущности карточки + файлы/записи."

    process_cycle = container "Daily Process Cycle (BPMN-style)" {
      description "started -> health-check -> kb-sync -> source-check -> prioritize -> apply -> verify -> notify -> completed."
    }

    sec_overview = container "Card Section - Обзор" {
      description "name/role/status/updatedAt/source + processLink + runbook + trackerUrl + notes."
    }

    sec_mcp = container "Card Section - MCP" {
      description "usedMcp[]/availableMcp[]/mcpServers[] + impactInNumbers."
    }

    sec_skills_rules = container "Card Section - Навыки и Правила" {
      description "usedSkills[] (SKILL.md text), availableSkills[], rulesApplied[], operatingPlan."
    }

    sec_tasks_quality = container "Card Section - Задачи и качество" {
      description "tasks counters, taskEvents, review_error_rate, TQS."
    }

    sec_memory_context = container "Card Section - Память и контекст" {
      description "memoryContext short-term + persistentRules long-term."
    }

    sec_improvements = container "Card Section - Улучшения" {
      description "improvements[] с ownerSection/metric window/delta/validation/prompt/ICE."
    }

    registry_store = database "Registry Store" {
      description "docs/agents/registry.yaml"
    }

    spec_store = database "Spec/Contracts Store" {
      description ".specify/spec.md + contracts/* + docs/subservices/oap/*.md"
    }

    skill_store = database "Skills Store" {
      description "$CODEX_HOME/skills/*/SKILL.md"
    }

    telemetry_log_store = database "Telemetry Log Store" {
      description ".logs/agents/*.jsonl"
    }

    telemetry_report_store = database "Telemetry Reports" {
      description "artifacts/agent_telemetry_summary.json/.md"
    }

    generated_store = database "Generated Manifest Store" {
      description "ops-web/src/generated/agents-manifest.json + docs-index.json + search-index.json"
    }

    schema_guard = container "Schema Guard" {
      description "docs/subservices/oap/agents-card.schema.json + check_agents_manifest.mjs"
    }

    content_builder = container "Content Builder" {
      description "ops-web/scripts/build_content_index.mjs"
    }

    telemetry_tool = container "Telemetry Tool" {
      description "scripts/agent_telemetry.py"
    }

    notifier = container "Notifier" {
      description "scripts/notify_analyst_digest.mjs"
    }

    env_secrets = database "Env Secrets" {
      description "ANALYST_TELEGRAM_BOT_TOKEN + ANALYST_TELEGRAM_CHAT_ID (env only)"
    }

    ui_card = container "OAP UI Card" {
      description "ops-web/src/pages/AgentsPage.tsx"
    }

    short_memory = container "Short-term Memory Model" {
      description "memoryContext.currentTask/contextAnchors/retrieval/decisionUsage/economics/riskControl/nextActions."
    }

    long_memory = container "Long-term Memory Model" {
      description "memoryContext.persistentRules + rulesApplied + operating standards."
    }

    analyst -> process_cycle "run daily cycle"
    owner -> process_cycle "approve high-risk decisions"

    process_cycle -> spec_store "read spec/contracts/oap standards [read]"
    process_cycle -> vendor_docs "read whitelist updates [read]"
    process_cycle -> oss_practices "read whitelist updates [read]"
    process_cycle -> registry_store "read all agent cards [read]"
    process_cycle -> registry_store "write prioritized improvements + lifecycle changes [write]"

    process_cycle -> short_memory "refresh from current cycle evidence"
    process_cycle -> long_memory "refresh durable rules and anchors"

    short_memory -> sec_memory_context "render short-term fields"
    long_memory -> sec_memory_context "render persistent rules"
    long_memory -> sec_skills_rules "rulesApplied + operatingPlan source"

    process_cycle -> telemetry_tool "write started/recommendation*/completed [write]"
    telemetry_tool -> telemetry_log_store "append events"
    telemetry_tool -> telemetry_report_store "generate summary report"

    process_cycle -> content_builder "rebuild generated manifest/indexes"
    content_builder -> skill_store "read SKILL.md texts"
    content_builder -> registry_store "read card source data"
    content_builder -> spec_store "read docs-index context"
    content_builder -> generated_store "write agents-manifest/docs-index/search-index"

    process_cycle -> schema_guard "validate contract and required fields"
    schema_guard -> registry_store "read source registry"
    schema_guard -> generated_store "read generated manifest"

    generated_store -> sec_overview "source fields"
    generated_store -> sec_mcp "used/available MCP"
    generated_store -> sec_skills_rules "used/available skills + rules + operatingPlan"
    generated_store -> sec_tasks_quality "tasks/taskEvents"
    generated_store -> sec_memory_context "memoryContext object"
    generated_store -> sec_improvements "improvements[] rich fields"

    telemetry_report_store -> sec_tasks_quality "quality metrics overlay"
    telemetry_report_store -> sec_improvements "evidence of action-rate/outcome"

    sec_overview -> ui_card "render"
    sec_mcp -> ui_card "render"
    sec_skills_rules -> ui_card "render"
    sec_tasks_quality -> ui_card "render"
    sec_memory_context -> ui_card "render"
    sec_improvements -> ui_card "render"

    process_cycle -> notifier "trigger critical + digest by policy"
    notifier -> env_secrets "read token/chat_id [read]"
    notifier -> telegram_api "send message"
    telegram_api -> owner "deliver alerts and digest"

    sec_improvements -> implementer "copy prompt for implementation"
    implementer -> process_cycle "returns applied change and status"
  }
}

views {
  view analyst_flow_context {
    title "Analyst Card Flow - C1 Context"
    include analyst, owner, implementer, vendor_docs, oss_practices, telegram_api, oap_card_flow
    exclude oap_card_flow.*
    autoLayout LeftRight
  }

  view analyst_flow_steps of oap_card_flow {
    title "Analyst Card Flow - Steps and Sections"
    include
      analyst,
      owner,
      process_cycle,
      sec_overview,
      sec_mcp,
      sec_skills_rules,
      sec_tasks_quality,
      sec_memory_context,
      sec_improvements,
      ui_card
    autoLayout TopBottom
  }

  view analyst_flow_io of oap_card_flow {
    title "Analyst Card Flow - File I/O and Artifacts"
    include
      analyst,
      process_cycle,
      registry_store,
      spec_store,
      skill_store,
      telemetry_tool,
      telemetry_log_store,
      telemetry_report_store,
      content_builder,
      schema_guard,
      generated_store,
      sec_tasks_quality,
      sec_improvements
    autoLayout LeftRight
  }

  view analyst_flow_notifications of oap_card_flow {
    title "Analyst Card Flow - Security and Notifications"
    include
      analyst,
      owner,
      process_cycle,
      notifier,
      env_secrets,
      telegram_api,
      telemetry_tool,
      telemetry_log_store,
      telemetry_report_store
    autoLayout LeftRight
  }
}
```
