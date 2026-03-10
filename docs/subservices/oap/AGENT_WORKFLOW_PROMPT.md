# Deprecated: moved to AGENT_OPERATIONS_RULES.md

Этот путь сохранен только для обратной совместимости.

Канонический документ:
- `docs/subservices/oap/AGENT_OPERATIONS_RULES.md`

Причина переименования:
- старое имя смешивало prompt и operational rules;
- новый путь явно отражает, что это operating contract, а не разовый prompt.

При любом обновлении правил нужно менять канонический файл, а не этот alias.# OAP Agent Workflow Prompt (Analyst/Designer Cards)

Используй этот промт **только для под-проекта ОАП**.  
Не применяй изменения к внешним доменным проектам, если это явно не запрошено.

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

## Workflow-поведение агента (обязательно)
1. **Plan Node Default**  
   Для нетривиальных задач (3+ шага или архитектурное решение) сначала план, затем реализация.
2. **Subagent Strategy**  
   Исследование/параллельный анализ выноси в подзадачи (без захламления основного контекста).
3. **Self-Improvement Loop**  
   Для каждого цикла соблюдай единый learning core:
   `planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
   После пользовательской коррекции обязательно фиксируй урок (`root cause` + `preventive rule`) в агентном lessons-файле.
4. **Verification Before Done**  
   Нельзя ставить done без доказательства: тесты, проверки, логи, сравнение поведения.
5. **Demand Elegance (Balanced)**  
   Для нетривиальных изменений проверяй, нет ли более чистого решения; без оверинжиниринга.
6. **Autonomous Bug Fixing**  
   По баг-репорту: воспроизвести, локализовать, исправить, верифицировать, зафиксировать результат.

## Universal learning core (обязательно для всех агентов)
- Доменные шаги у агентов могут отличаться, но self-improvement state-machine едина.
- Done-gate rollout:
  - текущий режим миграции: `soft_warning`;
  - целевой режим: `strict` (закрытие задачи блокируется при нарушении цикла).
- Knowledge growth model:
  - глобальные принципы: `docs/subservices/oap/tasks/lessons.global.md`;
  - уроки по агентам: `docs/subservices/oap/tasks/lessons/<agent-id>.md`;
  - fallback/индекс: `docs/subservices/oap/tasks/lessons.md`.
- На запуске цикла retrieval-пакет обязан читать:
  - `lessons.global.md`,
  - lessons текущего агента,
  - последние релевантные уроки по тегам.

## Task management (обязательно)
- План задачи веди в `docs/subservices/oap/tasks/todo.md` (checkbox-формат).
- Статусы и прогресс синхронизируй по мере выполнения.
- После завершения добавляй review-блок в `todo.md`.
- Уроки/правила после правок пользователя фиксируй в:
  - `docs/subservices/oap/tasks/lessons/<agent-id>.md` (основной источник),
  - при необходимости обновляй общий канон `lessons.global.md`,
  - `lessons.md` поддерживай как совместимый индекс.
- В каждом цикле обязателен `lesson governance check`:
  - пройтись по таблице актуальности уроков (`active|monitoring|outdated|archived`);
  - обновить `reviewed_at`, `decision_basis`, `next_action`;
  - по каждому `outdated` уроку создать задачу на обновление правила в тот же цикл.
- Политика хранения уроков:
  - удаление записей из lessons-файлов запрещено;
  - устаревшие уроки переводятся в `archived` с причиной и ссылкой на заменяющее правило.
- Для intake внешних практик используй канонический термин `candidate` и статусы:
  - `candidate_received`, `candidate_assessed`, `candidate_rejected`,
  - `ab_test_started`, `ab_test_checkpoint`, `ab_test_passed`, `ab_test_failed`,
  - `rollback_applied`.

## UI правила для карточки агента
- Сохраняй единый канонический каркас карточки для сопоставимости агентов.
- KPI показывай фактическими значениями (не chip-теги).
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

## Done Gate (перед финалом)
Перед `done` проверь:
1. План зафиксирован.
2. Зафиксирован `verify_started`.
3. Зафиксирован `verify_passed` или `verify_failed`.
4. Зафиксирован `lesson_captured` или `lesson_not_applicable`.
5. Финальный статус (`completed|failed|review_passed`) идет только после шага урока.
6. Если была коррекция пользователя, урок добавлен в `docs/subservices/oap/tasks/lessons/<agent-id>.md`.
7. Выполнен `lesson governance check`: таблица актуальности уроков обновлена, `outdated` уроки конвертированы в задачи.
8. Обновлены docs + contract + UI + `Правила работы` (если применимо).
9. Обновлена телеметрия и агрегированный отчет (`make agent-telemetry-report`).

## Формат результата от агента
- Сначала: что изменено (коротко, по файлам).
- Затем: как проверено (команды + итог).
- Затем: риски/что может сломаться.
- Затем: что нужно как следующий шаг (если есть).
