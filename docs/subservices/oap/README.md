# Операционная агентная панель (ОАП)

## Что это
Операционная агентная панель (ОАП) — самоулучшающаяся веб-панель, которая визуализирует логику работы ИИ-агентов и проекта.

Цель: чтобы команда четко видела:
- что агент использует в работе;
- на каких данных основаны решения;
- что именно нужно улучшить и какой будет практический эффект.

## Принципы сервиса
- Максимальная прозрачность логики: у каждой рекомендации есть основание и ссылка на источник.
- Практический результат: каждое улучшение описывается через ожидаемый эффект в цифрах.
- Наблюдаемость: ключевые метрики и состояние агента должны быть видны без чтения сырых логов.
- Переиспользуемость: структура карточки и компоненты должны переноситься в другие внутренние сервисы без переписывания доменной логики.

## Лучшие практики, заложенные в ОАП
Подход основан на практиках OpenClaw-подобных систем и зрелых agent-ops подходах:
- Identity-first: агент всегда представлен через роль, границы ответственности и источник данных.
- Heartbeat: состояние и операционная нагрузка отображаются через KPI (`in_work`, `on_control`, `overdue`).
- Memory-as-evidence: блок памяти показывает опорные источники решений, а не общий список файлов.
- Tools-with-impact: инструменты (MCP/skills) показываются с фактической пользой и результатом.
- Recommendation governance: рекомендации содержат основание, сценарии применения, ожидаемый эффект и сложность внедрения.

## Канонические типы агентов
В пользовательской терминологии ОАП используются два типа агентов:

1. `Автономные агенты`
- самостоятельные роли системы;
- могут быть основной точкой входа в задачу;
- имеют свою карточку, operating plan, telemetry и host adapters.

Текущий active set:
- `orchestrator-agent`
- `analyst-agent`
- `designer-agent`
- `reader-agent`

2. `Процессные агенты (sub-agents)`
- узкие подключаемые агенты внутри цикла автономного агента;
- используются для bounded delegation и не считаются отдельной основной ролью;
- обычно запускаются через orchestration/dispatcher и возвращают result package обратно в общий backbone.

Текущий active set:
- `retrieval-audit`
- `ui-verification`
- `telemetry-audit`
- `contract-audit`
- `docs-spec-sync`
- `automation-governance`

Правило расширения:
- новый агент по умолчанию не попадает сразу в автономные;
- сначала новая роль оформляется как процессный агент;
- повышение до автономного агента возможно только после отдельного governance-check.

`orchestrator-agent`:
- это координационный автономный агент;
- он не заменяет доменных исполнителей, а выбирает primary executor и bounded process agents;
- доменная работа по-прежнему должна уходить в `analyst-agent`, `designer-agent` или `reader-agent`.

## Каноническая структура карточки агента
1. Шапка
- Имя агента.
- Роль.
- Текущий статус.
- Обновлено.
- Источник данных.

2. Анализ эффективности агента
- Единый блок метрик для всех top-level карточек.
- Один и тот же title, layout, tooltip-логика и row-pattern.
- Наполнение агент-специфично, но структура одинакова:
  - ключевые фактические метрики на карточке;
  - ссылка `Открыть остальные метрики`;
  - modal `metrics_catalog` по тому же URL-контракту.
- Если данных нет, блок не скрывается и показывает fallback `не зафиксировано`.

3. Как работает ИИ агент
- `Режим работы агента`.
- `Описание правил работы агента`.
- `История улучшений агента`.
- `Схема работы агента`.
- `Список сессий цикла агента`.
- `Уроки данного агента`.
- Для любого top-level агента эти пункты существуют в одном и том же порядке; при отсутствии runtime-данных открывается честный empty state без фиктивного успеха.

4. Рабочий контур агента
- Навыки.
- Инструменты.
- MCP / интеграции.
- Правила.
- Блок показывает фактически задействованный capability-contour в одном и том же формате у всех top-level агентов.

5. Память
- Оперативная память.
- Долговременная память.
- Самоулучшение агента.
- Пустые данные не убирают раздел, а отображаются как `не зафиксировано`.

6. Риски
- Отдельный фиксированный финальный раздел карточки.
- Содержит риски и контрольные условия без переноса их в другие секции.

Правило канонического overview:
- Все top-level карточки агентов открываются через единый `UnifiedAgentDrawer` контракт.
- Каноническая runtime-реализация `UnifiedAgentDrawer` опирается на `analyst-agent` overview как на общий composer для `orchestrator-agent`, `analyst-agent`, `designer-agent`, `reader-agent`.
- Любое изменение структуры/порядка/поведения секций делается один раз в общем composer и автоматически применяется ко всем top-level карточкам.
- Special-case роутинг карточки конкретного агента не допускается.

8. Задачи
- Отдельная страница `#/tasks`.
- Источник правды: `oap.agent_tasks` + `oap.agent_task_events`.
- Фильтры: `Статус`, `Источник задачи`, `Исполнитель`, `Поиск`.
- В таблице списка задач есть столбец `Цикл`:
  - показывает, в каком операционном цикле задача была обнаружена или создана;
  - заполняется только если постановщик/producer реально знает цикл происхождения задачи;
  - если данных нет, показывается `не зафиксировано`;
  - не используется для A/B окна и не заменяет `sessions_required`.
- Быстрый пресет: `Аналитик - Можно брать`.
- Статусы: `Backlog -> Можно брать -> В работе -> A/B тест -> На ревью -> Готово`.
- Переходы статусов строятся из telemetry (`candidate_*/ab_test_*/started/completed/review_passed/...`) через sync.
- В карточке задачи обязательно показываются:
  - `Время создания` и `Время изменения` (формат `14 фев 14:00`);
  - блок `Контекст к задаче`;
  - блок `Связанные элементы`.

### Task Intake Contract (обязательный минимум для любого постановщика)
Чтобы новый или частично настроенный агент мог ставить исполнимые задачи, в `task_brief` должны быть:
- `goal`
- `expected_outcome`
- `acceptance_criteria[]`
- `context_to_task.summary` (прикладной, понятный для не-IT пользователя контекст)
- `linked_elements[]` (минимум один связанный элемент)
- `context_package.operational_memory[]` (рабочая память задачи)
- `context_package.collaboration_plan` (кого подключать и почему)

Для candidate-задач через A/B обязательно:
- `context_package.ab_test_plan.enabled=true`
- `context_package.ab_test_plan.sessions_required` в диапазоне `3..8`
- `context_package.ab_test_plan.pass_rule=target_plus_guardrails`
- `context_package.ab_test_plan.rollback_on_fail=true`

`linked_elements[]` поддерживает типы: `improvement`, `task`, `doc`, `rule`, `metric`, `incident`, `mcp`, `skill`, `bpmn`, `c4`, `url`, `other`.

Правило качества:
- если контекст неполный, задача помечается как требующая уточнения;
- legacy-формат постановки не ломается, но UI должен показать прозрачный fallback.

### Candidate Intake Contract (Telegram -> OAP)
- Каноническая сущность для входящих практик: `candidate` (не смешивать с `candidat`/`hypothesis`).
- Минимальные поля intake:
  - `candidate_id`, `source`, `source_key`, `telegram_chat_id`, `telegram_message_id`,
  - `text`, `links[]`, `status`, `received_at`.
- Идемпотентность intake:
  - `source_key = telegram:<chat_id>:<message_id>` уникален для каждого входящего сообщения.
- После intake аналитический контур формирует `candidate_assessment`:
  - `decision`, `applicability`, `target_metric`, `expected_delta`, `objective_risks[]`, `cycles_required`.

9. Улучшения
- Проблема.
- Решение.
- Ожидаемый эффект.
- Приоритет.

10. Память и контекст (MECE, evidence-first, telemetry-first)
- Блоки в фиксированном порядке:
  1) Что агент решает сейчас
  2) Контекст-пакет на этот цикл (оперативный)
  3) Долговременная память (стабильные правила)
  4) Retrieval и источники
  5) Что реально использовано в решении
  6) Экономика контекста
  7) Риски и контроль
  8) Следующее действие
- Для каждого значения без данных используется `не зафиксировано`.
- Для контекстных якорей обязательно доступны действия `Открыть текст` и `Открыть источник` (если URL есть).
- Для всех агентов используется единый компонент `MemoryContextPanel` (modern и legacy карточки не расходятся по логике).

11. Операционные стандарты modern-агентов
- Для `analyst-agent` обязательно использовать `docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md`.
- Для `designer-agent` обязательно использовать `docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md`.
- Для всех агентов canonical layout: `docs/subservices/oap/agents/<agent-id>/...`.
- В карточке modern-агента должен быть явный блок "План работы":
  - миссия;
  - процесс по которому работает ИИ агент;
  - единый `workflowBackbone` для всех агентов:
    - общий backbone `0..9.1`;
    - одна bounded `roleWindow` ветка с уникальными доменными шагами агента;
    - неиспользованные шаги не удаляются, а фиксируются как `skipped`;
  - путь к операционному стандарту (гиперссылка, открывает модалку);
  - история логов ИИ агента (гиперссылка, открывает модалку).
- Для `designer-agent` дополнительно обязателен блок
  `UX-гейт качества перед передачей в разработку` с фиксированными пунктами:
  - приоритет первого экрана;
  - ясность действия;
  - консистентность состояний;
  - пояснения в точках риска;
  - защита рискованных действий.
- Подробные политики (`источники`, `whitelist`, `lifecycle`, `уведомления`, `критичные случаи`) читаются в модалке по ссылке на operating plan.
- Блок должен быть связан с реальными данными `improvements`, `rulesApplied`, `tasks/taskEvents`, telemetry.

### Capability selection contract (mandatory for all agents)
- Step-level `Навыки/Инструменты/MCP` в `OPERATING_PLAN.md` являются baseline minimum и не ограничивают полный runtime-набор.
- Runtime-набор выбирается динамически capability-first контуром из:
  - `workflowBackbone`,
  - `collaboration_plan.spawned_instances.allowed_skills/allowed_tools/allowed_mcp`,
  - capability-полей registry (`used*`/`available*`),
  - per-agent snapshot `artifacts/capability_trials/<agent-id>/capability_snapshot.json`.
- Обязательные gates выбора:
  - `official-first`,
  - `shadow mode` для внешних skill/tool alternatives,
  - `human approve` перед promotion/replace.
- При недоступности динамического capability используется явный fallback policy с telemetry-traceability.
- В telemetry поля `skills[]/tools[]/mcp_tools[]` отражают фактически использованный runtime-набор и могут быть шире baseline списка шага.

### Canonical per-agent docs layout

| Agent ID | Обязательные файлы | Назначение |
| --- | --- | --- |
| `analyst-agent` | `OPERATING_PLAN.md`, `CARD_DATA_SOURCES_MAP.md`, `FLOW.md`, `CARD_FULL_FLOW.md` | analyst-card contract, data-source map, flow views и compatibility alias |
| `designer-agent` | `OPERATING_PLAN.md` | operating standard дизайнера |
| `reader-agent` | `OPERATING_PLAN.md` | operating standard инженерного исполнителя |

Правило расширения:
- любой новый агент обязан иметь папку `docs/subservices/oap/agents/<agent-id>/`;
- минимальный обязательный файл для нового агента: `OPERATING_PLAN.md`;
- дополнительные обязательные файлы фиксируются явно в validator policy, если агент получает отдельный UI/data-flow contract;
- проверка выполняется через `python3 scripts/validate_agent_operating_plans.py`.
- архивные профили и их operating plans хранятся в `docs/subservices/oap/archive/agents/<agent-id>/` и не считаются частью active manifest.
- отдельный governance-runbook для top-level vs runtime specialist хранится в `docs/subservices/oap/MULTI_AGENT_GOVERNANCE.md`.
- live/manual checklist реального handoff по hosts хранится в `docs/subservices/oap/HOST_HANDOFF_CHECKLIST.md`.
- новый агент не может попасть в active top-level set без:
  - distinct mission,
  - measurable task class,
  - bounded delegation model,
  - telemetry viability KPI,
  - host adapter support и успешного `python3 scripts/export_host_agents.py smoke-active-set`.
- если эти условия не выполнены, новая роль сначала оформляется только как `runtime specialist`.

### Термины для документации и UI
- User-facing термин `Автономные агенты` соответствует internal key `top_level`.
- User-facing термин `Процессные агенты (sub-agents)` соответствует internal key `runtime_specialist`.
- Internal schema keys не переименовываются, чтобы не ломать registry, telemetry и cross-host adapters.

## KPI для контроля качества после рефакторинга
- `tasks_in_work` = `queued + running + retrying`.
- `tasks_on_control` = `waiting_review + blocked + waiting_external`.
- `overdue`.
- `review_error_rate`.
- `mcp_online_ratio`.
- `tokens_per_task` (на задачах с длинным контекстом).
- `p95_time_to_context`.
- `recommendation_action_rate`.
- `evidence_coverage`.

## Что нужно для реюза в других сервисах
- Единый data-contract карточки агента (JSON schema/TS type).
- Библиотека UI-компонентов ОАП.
- Стандартизированный маппинг статусов, KPI и рекомендаций.
- Отдельный слой адаптеров под источник данных (реестр, трекер задач, telemetry).

## Дополнительные обязательные источники для modern-агентов
- `docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md`
- `docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md`
- `docs/subservices/oap/README.md`
- `docs/subservices/oap/DESIGN_RULES.md`

## OAP Workflow artifacts (OAP-only)
Для операционного цикла агентов в ОАП используются отдельные артефакты подпроекта:
- `docs/subservices/oap/tasks/todo.md` — шаблон плана задачи (Plan -> Execute -> Verify -> Review).
- `docs/subservices/oap/tasks/lessons.global.md` — общий канон self-improvement принципов (для всех агентов).
- `docs/subservices/oap/tasks/lessons/<agent-id>.md` — локальные уроки конкретного агента.
- `docs/subservices/oap/tasks/lessons/_TEMPLATE.md` — шаблон оформления локальных уроков.
- `docs/subservices/oap/tasks/lessons.md` — совместимый fallback/индекс.
- `docs/subservices/oap/AGENT_OPERATIONS_RULES.md` — канонический operating rules entry point для analyst/designer и других OAP card workflows.
- `docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md` — legacy alias, сохраняется только для обратной совместимости.

## Universal Session Backbone
Для всех OAP-агентов и spawned specialist instances используется единый runtime-контракт `Universal Session Backbone v1`.

Состав backbone:
- `step_0_intake`
- `step_1_start`
- `step_2_preflight`
- `step_3_orchestration`
- `step_4_context_sync`
- `step_5_role_window`
- `step_6_role_exit_decision`
- `step_7_apply_or_publish`
- `step_7_contract_gate`
- `step_8_verify`
- `step_8_error_channel`
- `step_9_finalize`
- `step_9_publish_snapshots`

Правила:
- уникальная доменная логика агента размещается только внутри `roleWindow`;
- один агент = один bounded role-window в рамках одного session backbone;
- неиспользуемые core-этапы не удаляются, а помечаются как `skipped`;
- `analyst-agent` служит эталонным примером этой модели, но его внутренние шаги `candidate scoring / priority decision` остаются analyst-specific branch, а не общим core.
- capability-optimization обязателен для всех агентов: при финальном каноническом событии цикла telemetry запускает `capability_refresh` в режиме `on_run` (если `capabilityOptimization.enabled=true` и `refreshMode=on_run`), а результаты пишутся в `artifacts/capability_trials/<agent-id>/capability_snapshot.json`.

Проверка auto-refresh (smoke, все активные агенты):
- записать финальное каноническое событие для `designer-agent`, `reader-agent`, `analyst-agent`;
- убедиться, что в `.logs/agents/<agent-id>.jsonl` появились `capability_refresh_started` и `capability_refresh_completed`;
- пересобрать отчеты:
  - `python3 scripts/agent_telemetry.py report --log-dir .logs/agents --out-json artifacts/agent_telemetry_summary.json --out-md artifacts/agent_telemetry_summary.md --out-cycle-json artifacts/agent_cycle_validation_report.json --out-latest-analyst-json ops-web/public/generated/agent-latest-cycle-analyst.json --benchmark-summary-json artifacts/agent_benchmark_summary.json`
  - `node ops-web/scripts/build_content_index.mjs`

## OAP Request Routing artifacts
Для запуска задач по capability-first модели используются отдельные артефакты маршрутизации:
- `docs/subservices/oap/DOCUMENTATION_MAP.md` — каноническая карта authority, startup и capability routing.
- `docs/subservices/oap/ROUTING_MANUAL_TRIALS.md` — manual trials и edge-case coverage перед automation.
- `docs/subservices/oap/REQUEST_ROUTING_CONTRACT.yaml` — канонический routing contract: маршруты, домены, fallback-политика и правила валидации в одном файле.

Проверка канонического routing contract:
- `python3 scripts/validate_request_router.py`

## Canonical naming after semantic cleanup
- `docs/subservices/oap/AGENT_OPERATIONS_RULES.md` — canonical name для слоя operational rules.
- `docs/subservices/oap/agents/analyst-agent/CARD_DATA_SOURCES_MAP.md` — canonical name для analyst-card data-source mapping.
- `docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md` и `docs/subservices/oap/agents/analyst-agent/CARD_FULL_FLOW.md` остаются как compatibility aliases и не считаются основными entry points.

Правило:
- `domain` используется как navigation helper, а не как hard gate;
- capability routing имеет приоритет над domain label;
- если домен неизвестен или спорный, используется capability-first fallback route из `REQUEST_ROUTING_CONTRACT.yaml`.

Правило:
- эти файлы относятся только к workflow ОАП и не должны использоваться как общий task-layer для внешних доменных проектов.
- на запуске цикла агент обязан читать hybrid retrieval-пакет:
  - `lessons.global.md`,
  - свой `lessons/<agent-id>.md`,
  - последние релевантные уроки по тегам.
- при изменении логики секции карточки агента необходимо синхронно обновлять:
  - UI-логику секции,
  - data-contract/schema,
  - OAP документацию,
  - модалку `Правила работы раздела` в UI.

## Состав базы знаний ОАП (для `#/docs`)
База знаний ОАП в `ops-web` должна включать только операционный контекст ОАП и данные, реально используемые агентами для улучшения процессов.

Обязательные источники:
- `docs/subservices/oap/README.md`
- `docs/subservices/oap/DESIGN_RULES.md`
- `docs/subservices/oap/AGENT_OPERATIONS_RULES.md`
- `docs/subservices/oap/AGENT_TELEMETRY.md`
- `docs/subservices/oap/agents/analyst-agent/CARD_DATA_SOURCES_MAP.md`
- `docs/subservices/oap/ROUTING_MANUAL_TRIALS.md`
- `docs/subservices/oap/REQUEST_ROUTING_CONTRACT.yaml`
- `docs/subservices/oap/agents-card.schema.json`
- `docs/agents/registry.yaml`
- `artifacts/agent_telemetry_summary.md` (если файл присутствует)
- `artifacts/agent_telemetry_summary.json` (если файл присутствует)
- OAP-релевантные секции из `AGENTS.md`:
  - `QMD Retrieval Policy`
  - `OAP Design Rule`
  - `Agent Telemetry Logging`

Сырые логи:
- `.logs/agents/*.jsonl` не включаются в полнотекстовый индекс по умолчанию.
- Сырые логи подключаются on-demand в UI по явному действию пользователя.

Правило актуальности:
- При любом изменении структуры ОАП, правил, телеметрии или реестра агентов нужно обновить источники выше и пересобрать generated индексы:
  - `npm --prefix ops-web run prepare-content`
- После изменения host-agent каталога или generated adapters обязательно прогонять cross-host smoke для активной тройки (`analyst-agent`, `designer-agent`, `reader-agent`):
  ```bash
  python3 scripts/export_host_agents.py smoke-active-set
  ```
- Smoke проверяет:
  - repo-generated adapters в `.claude/agents/*.md`,
  - repo-generated adapters в `.github/agents/*.agent.md`,
  - codex mirror generation в temp `skills-generated`,
  - handoff targets только на существующие agent ids каталога.
- После успешного smoke для реального host-level handoff нужно отдельно пройти live/manual checklist:
  - `docs/subservices/oap/HOST_HANDOFF_CHECKLIST.md`
- Для release-like прогона перед демонстрацией или rollout использовать единый gate:
  ```bash
  npm --prefix ops-web run check:release
  ```
  Он объединяет:
  - contract/build checks,
  - cross-host parity checks,
  - Playwright smoke для `#/agents` и capability workflows.

## Синхронизация task board
1. Создать/обновить задачи из `docs/agents/registry.yaml` и применить telemetry-переходы:
```bash
make agent-tasks-sync DB="$SUPABASE_DB_URL"
```
2. Получить текущую сводку task board:
```bash
make agent-tasks-report DB="$SUPABASE_DB_URL"
```
3. Проверить UI:
- `http://127.0.0.1:4174/#/tasks`

Замечание:
- UI не пишет статусы напрямую в БД.
- Для перевода задачи в `В работе` используется telemetry-команда:
  `make agent-log AGENT=<agent> TASK=<external_key> STEP=implement STATUS=started`.

## Экран `#/agent-flow` (все агенты)
- Экран показывает 4 слоя:
  1) `Пайплайн работы агента` (единый backbone + встроенные метки ключевых проверок),
  2) `Mermaid: unified capability optimization loop` (упрощённая схема цикла улучшения без технического жаргона),
  3) `Как сработал последний цикл` (факт из telemetry, analyst-first runtime contract),
  4) `Архитектура (C4 process views)` для analyst-agent.
- Важные проверки показываются внутри этапов пайплайна, а не отдельным блоком:
  - `Проверка результата` (этап проверки эффекта),
  - `Обновление способностей` (этап обновления профиля агента).
- Runtime-факт последнего цикла в текущем контракте гарантирован для `analyst-agent` через:
  - `.logs/agents/analyst-agent.jsonl`,
  - `artifacts/agent_cycle_validation_report.json`,
  - `artifacts/agent_telemetry_summary.json`,
  - `artifacts/agent_latest_cycle_analyst.json`.
- Для `file trace` обязательно использовать telemetry-поля:
  - `artifacts_read[]`,
  - `artifacts_written[]`.
- Обновление runtime-среза:
  - авто при открытии,
  - ручная кнопка `Обновить`.
- Onboarding для нового участника:
  - читать экран сверху вниз: `пайплайн` -> `Mermaid loop` -> `факт последнего цикла` -> `file-trace`;
  - в первую очередь смотреть этапы с метками `Проверка результата` и `Обновление способностей`.

## Visual explainer для последнего цикла аналитика
```bash
make oap-analyst-cycle-review
```
- Команда строит HTML-отчет по `artifacts/agent_latest_cycle_analyst.json`.

## Принудительный канонический цикл агента
Запустить тестовый цикл по эталонным этапам `step_0..step_9.1`:

```bash
python3 scripts/analyst_cycle_runner.py --agent-id analyst-agent --phase warning
```

- Что runner делает автоматически:
  - прогоняет канонический cycle выбранного `agent-id`;
  - собирает telemetry-отчеты;
  - запускает `capability_refresh` для выбранного агента;
  - записывает `artifacts/capability_trials/<agent-id>/capability_snapshot.json`;
  - пересобирает `ops-web/src/generated/agents-manifest.json` и related UI artifacts.

После 3-5 warning-прогонов переключить в strict:

```bash
python3 scripts/analyst_cycle_runner.py --agent-id analyst-agent --phase strict
```

Для изолированных экспериментов (чтобы не смешивать KPI тестов и боевых run):

```bash
python3 scripts/analyst_cycle_runner.py \
  --agent-id designer-agent \
  --phase strict \
  --log-dir .logs/agents-experiments \
  --report-dir artifacts/experiments/designer-strict
```

- `--log-dir` уводит telemetry события в отдельный журнал.
- `--report-dir` уводит summary/cycle-report в отдельные artifacts и не перезаписывает боевые отчеты.

Проверить результат в отчетах:
- `artifacts/agent_telemetry_summary.json` (`canonical_event_compliance_rate`, `non_canonical_events_total`)
- `artifacts/agent_cycle_validation_report.json`
- `artifacts/agent_latest_cycle_analyst.json` (13 канонических этапов + `out_of_canon`)
- `artifacts/capability_trials/analyst-agent/capability_snapshot.json` (`freshnessStatus`, `sourceFingerprint`, `tableRows[]`)
