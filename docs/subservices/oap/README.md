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

## Каноническая структура карточки агента
1. Шапка
- Имя агента.
- Роль.
- Текущий статус.
- Обновлено.
- Источник данных.

2. Операционный контур
- Идентичность (identity).
- Пульс (heartbeat): задачи в работе, требуют внимания, просрочены.
- Память (memory): 3-5 ключевых опорных источников.
- Инструменты (tools): активные MCP и навыки.
- Следующий фокус: 1 приоритетное действие.

3. MCP: фактическое применение
- Название MCP.
- Что дает.
- Где уже применялось (конкретные задачи).
- Результат в цифрах.
- Текущий статус подключения.

4. MCP: рекомендации к установке
- Название.
- Что делает.
- Когда использовать.
- Что улучшит.
- Основание рекомендации.
- Задачи, где поможет.
- Сложность подключения.
- Ссылка.

5. Опорные источники решений
- Источник.
- Файл/путь.
- Где смотреть.
- Ссылка на источник.

6. Навыки и правила (для modern-карточек аналитика и продакт дизайнера)
- Кнопка `Правила работы раздела` -> открывает модалку с полным текстом правил.
- Используемые навыки:
  - Название навыка.
  - Время последнего использования.
  - Путь к `SKILL.md`.
  - Точный текст из `SKILL.md` (без подстановки из registry).
- Правила:
  - Путь к правилу (показывается как понятная гиперссылка с названием документа).
  - Краткое описание.
  - Переход открывает текстовую модалку внутри ОАП.
  - По умолчанию показывается релевантный фрагмент по `pathHint`, а не весь документ.

7. Рекомендации по улучшению
- Карточка рекомендации:
  - `Оценка эффекта ICE: Score | Impact | Confidence | Ease`
  - `Точка роста`
  - `Решение`
  - `Кнопка: Скопировать промт для внедрения`
- Кнопка `Открыть все рекомендации`:
  - открывает модалку со списком подготовленных промтов (`promptMarkdown`).

Правило для modern-карточек:
- `analyst-agent` и `designer-agent` работают через единый `UnifiedAgentDrawer` контракт.
- Special-case роутинг карточки конкретного агента не допускается, кроме временного deprecated fallback.

8. Задачи
- Отдельная страница `#/tasks`.
- Источник правды: `bible.agent_tasks` + `bible.agent_task_events`.
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
- Для `analyst-agent` обязательно использовать `docs/subservices/oap/ANALYST_OPERATING_PLAN.md`.
- Для `designer-agent` обязательно использовать `docs/subservices/oap/DESIGNER_OPERATING_PLAN.md`.
- В карточке modern-агента должен быть явный блок "План работы":
  - миссия;
  - процесс по которому работает ИИ агент;
  - путь к операционному стандарту (гиперссылка, открывает модалку);
  - история логов ИИ агента (гиперссылка, открывает модалку).
- Подробные политики (`источники`, `whitelist`, `lifecycle`, `уведомления`, `критичные случаи`) читаются в модалке по ссылке на operating plan.
- Блок должен быть связан с реальными данными `improvements`, `rulesApplied`, `tasks/taskEvents`, telemetry.

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
- `docs/subservices/oap/ANALYST_OPERATING_PLAN.md`
- `docs/subservices/oap/DESIGNER_OPERATING_PLAN.md`
- `docs/subservices/oap/README.md`
- `docs/subservices/oap/DESIGN_RULES.md`

## OAP Workflow artifacts (OAP-only)
Для операционного цикла агентов в ОАП используются отдельные артефакты подпроекта:
- `docs/subservices/oap/tasks/todo.md` — шаблон плана задачи (Plan -> Execute -> Verify -> Review).
- `docs/subservices/oap/tasks/lessons.global.md` — общий канон self-improvement принципов (для всех агентов).
- `docs/subservices/oap/tasks/lessons/<agent-id>.md` — локальные уроки конкретного агента.
- `docs/subservices/oap/tasks/lessons/_TEMPLATE.md` — шаблон оформления локальных уроков.
- `docs/subservices/oap/tasks/lessons.md` — совместимый fallback/индекс.
- `docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md` — итоговый промт внедрения workflow-практик в карточки агентов.

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
- `docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md`
- `docs/subservices/oap/AGENT_TELEMETRY.md`
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

## Экран `#/agent-flow` для analyst-agent
- Экран показывает 3 слоя:
  1) `Как устроен агент` (C4 process-view ссылки `analyst_flow_*` из `ANALYST_AGENT_FLOW.md`),
  2) `Как должен работать` (BPMN `docs/bpmn/analyst-agent-flow.bpmn`),
  3) `Как сработал последний цикл` (факт из telemetry).
- Фактический слой строится из:
  - `.logs/agents/analyst-agent.jsonl`,
  - `artifacts/agent_cycle_validation_report.json`,
  - `artifacts/agent_telemetry_summary.json`,
  - `artifacts/agent_latest_cycle_analyst.json`.
- Для file-trace обязательно использовать telemetry-поля:
  - `artifacts_read[]`,
  - `artifacts_written[]`.
- Обновление экрана:
  - авто при открытии,
  - ручная кнопка `Обновить`.

## Visual explainer для последнего цикла аналитика
```bash
make oap-analyst-cycle-review
```
- Команда строит HTML-отчет по `artifacts/agent_latest_cycle_analyst.json`.
