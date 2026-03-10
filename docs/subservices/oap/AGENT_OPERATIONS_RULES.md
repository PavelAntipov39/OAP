# OAP Agent Operations Rules

Этот документ является каноническим successor для legacy-файла `AGENT_WORKFLOW_PROMPT.md`.

Назначение:
- задать операционные правила для analyst/designer и других OAP agent-card workflows;
- отделить rules/operating contract от prompt-like naming;
- использовать один стабильный entry point для manual routing и будущей automation.

Legacy compatibility:
- старый путь `docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md` сохраняется как compatibility alias;
- новым source-of-truth для этого слоя считается текущий файл.

## Контекст и границы
- Scope: `docs/subservices/oap/*`, `ops-web/*`, `scripts/*`, `docs/agents/registry.yaml`.
- Source of truth для ОАП:
  - `docs/subservices/oap/README.md`
  - `docs/subservices/oap/DESIGN_RULES.md`
  - `docs/subservices/oap/agents-card.schema.json`
- Любое изменение карточки агента делай синхронно в:
  1. UI/logic (`ops-web/src/pages/AgentsPage.tsx`)
  2. contract/schema (`docs/subservices/oap/agents-card.schema.json`, `docs/agents/registry.yaml`)
  3. документации ОАП (`docs/subservices/oap/README.md`, `docs/subservices/oap/DESIGN_RULES.md`)
  4. разделе `Правила работы` в модальном окне карточки (если меняется поведение/метрики/ограничения)

## Workflow-поведение агента
1. `Plan Node Default`
Для нетривиальных задач (3+ шага или архитектурное решение) сначала план, затем реализация.
2. `Subagent Strategy`
Исследование/параллельный анализ выноси в подзадачи (без захламления основного контекста).
3. `Self-Improvement Loop`
Для каждого цикла соблюдай единый learning core:
`planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
После пользовательской коррекции обязательно фиксируй урок (`root cause` + `preventive rule`) в агентном lessons-файле.
4. `Verification Before Done`
Нельзя ставить done без доказательства: тесты, проверки, логи, сравнение поведения.
5. `Demand Elegance (Balanced)`
Для нетривиальных изменений проверяй, нет ли более чистого решения; без оверинжиниринга.
6. `Autonomous Bug Fixing`
По баг-репорту: воспроизвести, локализовать, исправить, верифицировать, зафиксировать результат.

## Universal learning core
- Доменные шаги у агентов могут отличаться, но self-improvement state-machine едина.
- Done-gate rollout:
  - текущий режим миграции: `soft_warning`;
  - целевой режим: `strict`.
- Knowledge growth model:
  - глобальные принципы: `docs/subservices/oap/tasks/lessons.global.md`;
  - уроки по агентам: `docs/subservices/oap/tasks/lessons/<agent-id>.md`;
  - fallback/индекс: `docs/subservices/oap/tasks/lessons.md`.
- На запуске цикла retrieval-пакет обязан читать:
  - `lessons.global.md`;
  - lessons текущего агента;
  - последние релевантные уроки по тегам.

## Task management
- План задачи веди в `docs/subservices/oap/tasks/todo.md`.
- Статусы и прогресс синхронизируй по мере выполнения.
- После завершения добавляй review-блок в `todo.md`.
- Уроки/правила после правок пользователя фиксируй в:
  - `docs/subservices/oap/tasks/lessons/<agent-id>.md`;
  - при необходимости обновляй `lessons.global.md`;
  - `lessons.md` поддерживай как совместимый индекс.
- В каждом цикле обязателен `lesson governance check`.
- Политика хранения уроков:
  - удаление записей из lessons-файлов запрещено;
  - устаревшие уроки переводятся в `archived`.
- Для intake внешних практик используй термин `candidate`.

## UI правила для карточки агента
- Сохраняй единый канонический каркас карточки для сопоставимости агентов.
- KPI показывай фактическими значениями.
- У каждой метрики обязателен tooltip `Как считается`: формула + источник + простое описание.
- Для `analyst-agent` блок `Целевые метрики` размещай в разделе `Задачи и качество`.
- В `Память и контекст` используй термины:
  - `Оперативная память`
  - `Долговременная память`
- Для workflow-метрик поддерживай поля:
  - `plan_coverage_rate`
  - `verification_pass_rate`
  - `lesson_capture_rate`
  - `replan_rate`
  - `autonomous_bugfix_rate`
  - `elegance_gate_rate`

## Done Gate
Перед `done` проверь:
1. План зафиксирован.
2. Зафиксирован `verify_started`.
3. Зафиксирован `verify_passed` или `verify_failed`.
4. Зафиксирован `lesson_captured` или `lesson_not_applicable`.
5. Финальный статус идет только после шага урока.
6. Если была коррекция пользователя, урок добавлен в `docs/subservices/oap/tasks/lessons/<agent-id>.md`.
7. Выполнен `lesson governance check`.
8. Обновлены docs + contract + UI + `Правила работы`.
9. Обновлена телеметрия и агрегированный отчет (`make agent-telemetry-report`).

## Формат результата от агента
- Сначала: что изменено.
- Затем: как проверено.
- Затем: риски/что может сломаться.
- Затем: что нужно как следующий шаг.