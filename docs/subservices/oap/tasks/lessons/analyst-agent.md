# Analyst Agent Lessons

## Реестр актуальности уроков (обязательный для каждого цикла)
Статусы:
- `active` — правило обязательно к применению в текущих задачах.
- `monitoring` — правило стабильно, контрольный пересмотр раз в цикл.
- `outdated` — правило перестало предотвращать повтор ошибки; требуется обновление через задачу.
- `archived` — правило заменено новым, хранится только как история решений.

Правила:
- обновлять таблицу ниже в каждом цикле до финального `completed|failed`;
- для каждого `outdated` урока в этом же цикле создавать задачу на обновление правила;
- удаление исторических уроков запрещено (append-only, только перевод в `archived`).

| lesson_ref | status | reviewed_at | decision_basis | next_action | linked_task |
| --- | --- | --- | --- | --- | --- |
| `2026-02-28 - analyst-agent - bootstrap` | monitoring | 2026-03-06 | Базовый урок про обязательность lessons-файла, повторов нарушения не зафиксировано | Повторный пересмотр через 1 цикл | — |
| `2026-03-02 - analyst-agent - cycle-20260303-1` | active | 2026-03-06 | Правило по обязательности `memoryContext/operatingPlan` применимо к текущим изменениям схемы | Проверить повторяемость нарушения в следующих 2 циклах | — |
| `2026-03-03 - analyst-agent - cycle-20260303-2` | active | 2026-03-06 | Правило про реакцию на `degraded` MCP критично для health-check шага | При повторе задержки перевести в `outdated` и открыть задачу на усиление контроля SLA | — |
| `2026-03-10 - analyst-agent - task-card-routing` | active | 2026-03-10 | Роутинг карточки задачи учитывает `service_mode`, а не только allowlist ID | Убедиться что паттерн применяется при добавлении новых режимов карточки | — |

## 2026-02-28 - analyst-agent - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Self-improvement логика была описана, но lessons не были выделены по агенту.
- Preventive rule:
  - Уроки analyst-agent всегда фиксируются в `lessons/analyst-agent.md`.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - recommendations
  - quality
  - telemetry
- Apply in:
  - Все циклы аналитика по рекомендациям и quality-review.
- Validation:
  - Файл доступен для retrieval и knowledge modal.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml

## 2026-03-02 - analyst-agent - cycle-20260303-1 / step: learn
- Correction:
  - `memoryContext` должен быть обязательным полем карточки агента в agents-manifest.
- Root cause:
  - В шаге `execute` цикла обнаружено, что `memoryContext` и `operatingPlan` отсутствовали
    в исходной схеме как обязательные поля — агент добавлял их по факту запуска, а не декларативно.
  - Recommendation: `imp-analyst-recommendation-schema` (ICE-приоритизация выполнена).
- Preventive rule:
  - Перед каждым `execute`-шагом проверять наличие `memoryContext` и `operatingPlan`
    в schema карточки агента. При отсутствии — создавать задачу на исправление, не пропускать.
- Status evidence:
  - plan -> health_check -> knowledge_base_check -> external_monitor -> improvements_list
    -> execute -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - schema
  - memoryContext
  - operatingPlan
  - mandatory_fields
- Apply in:
  - Шаг `execute` при обновлении карточек агентов в registry.yaml.
- Validation:
  - Изменения верифицированы: регрессий нет (verify_passed, run-1772497324-1).
- Related artifacts:
  - docs/agents/registry.yaml
  - docs/subservices/oap/agents-card.schema.json
  - artifacts/agent_telemetry_summary.json

## 2026-03-03 - analyst-agent - cycle-20260303-2 / step: learn
- Correction:
  - MCP деградация (context7) требует создания задачи в первый же день обнаружения, не на второй.
- Root cause:
  - В цикле 1 (2026-03-02) обнаружена деградация context7 MCP — но задача создана только
    в цикле 2 (2026-03-03). Суточная задержка реакции допущена из-за ожидания «само пройдёт».
  - health_check цикла 2: "context7 MCP деградирует второй день, создана задача на подключение".
- Preventive rule:
  - При обнаружении MCP со статусом `degraded` в шаге `health_check` — немедленно создавать
    задачу в тот же цикл (не откладывать). Срок реакции: ≤ 1 цикл.
- Status evidence:
  - plan -> health_check -> knowledge_base_check -> improvements_list -> execute
    -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - mcp
  - degraded
  - health_check
  - reaction_time
- Apply in:
  - Шаг `health_check` любого цикла при обнаружении деградированных MCP.
- Validation:
  - Задача на context7 создана, изменения корректны (verify_passed, run-1772497559-2).
- Related artifacts:
  - docs/agents/registry.yaml
  - artifacts/agent_latest_cycle_analyst.json

## 2026-03-10 - analyst-agent - task-card-routing
- Correction:
  - Роутер `shouldUseExperimentalTaskCard` расширен: учитывает `service_mode === "waiting_human"` в дополнение к ID allowlist.
- Root cause:
  - Роутинг основывался только на ID allowlist (`EXPERIMENTAL_TASK_CARD_IDS`). Live-задачи с `status: waiting_human` не попадали в экспериментальный drawer, хотя их `service_mode` явно требует human-gate UI. Prop `serviceMode` не передавался от callers к router.
- Preventive rule:
  - При изменении условий роутинга карточки задачи — проверять все 3 сценария открытия: (1) клик по строке таблицы в TasksPage, (2) deep-link через URL hash, (3) открытие из AnalystCardDrawer (selfImprovement). Убедиться, что `service_mode` передаётся по цепочке до момента принятия решения о роутинге.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - task-card
  - routing
  - service_mode
  - waiting_human
  - experimental
- Apply in:
  - Любые задачи по расширению роутинга карточек задач или добавлению новых `service_mode`.
- Validation:
  - TypeScript: 0 errors. Новый тест `waiting_human service_mode opens experimental task card via row click` добавлен.
- Related artifacts:
  - ops-web/src/components/tasks/TaskDetailsDrawer.tsx
  - ops-web/src/pages/TasksPage.tsx
  - ops-web/src/pages/AgentsPage.tsx
  - ops-web/src/components/analyst-card/AnalystCardDrawer.tsx
  - ops-web/tests/task-card-canary.spec.ts
