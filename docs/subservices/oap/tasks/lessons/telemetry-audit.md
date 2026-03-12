# Telemetry Audit Specialist Lessons

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
| `2026-03-11 - telemetry-audit - bootstrap` | monitoring | 2026-03-11 | Инициализация self-improvement loop для telemetry-audit | Повторный пересмотр через 1 цикл | — |

## 2026-03-11 - telemetry-audit - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Telemetry-audit как process agent не имел отдельного lessons-файла; пробелы в coverage KPI оседали в вызывающем агенте без агрегации.
- Preventive rule:
  - Уроки telemetry-audit всегда фиксируются в `lessons/telemetry-audit.md`.
  - Каждый telemetry-аудит должен явно перечислять: проверенные events, gap list, KPI coverage score.
  - При обнаружении contract gap немедленно создавать задачу (не откладывать).
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - telemetry
  - kpi
  - agent-telemetry
  - coverage
- Apply in:
  - Каждый запуск telemetry-audit при изменениях lifecycle, orchestration, metrics или summaries.
- Validation:
  - Файл доступен для retrieval и knowledge modal в OAP.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
  - artifacts/agent_telemetry_summary.json
