# UI Verification Specialist Lessons

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
| `2026-03-11 - ui-verification - bootstrap` | monitoring | 2026-03-11 | Инициализация self-improvement loop для ui-verification | Повторный пересмотр через 1 цикл | — |

## 2026-03-11 - ui-verification - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - UI-verification как process agent не имел отдельного lessons-файла; регрессии и паттерны накапливались в вызывающем агенте.
- Preventive rule:
  - Уроки ui-verification всегда фиксируются в `lessons/ui-verification.md`.
  - Каждый verify-отчёт должен включать: URL/route, action sequence, expected vs actual, screenshot ref.
  - При обнаружении regression всегда создавать linked_task в тот же цикл (не откладывать).
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - ui
  - playwright
  - verification
  - regression
- Apply in:
  - Каждый запуск ui-verification для изменений в маршрутах, модалках, фильтрах, табах, таблицах.
- Validation:
  - Файл доступен для retrieval и knowledge modal в OAP.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
  - docs/subservices/oap/agents/ui-verification/OPERATING_PLAN.md
  - scripts/export_host_agents.py
