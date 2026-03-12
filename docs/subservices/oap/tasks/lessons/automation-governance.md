# Automation Governance Specialist Lessons

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
| `2026-03-11 - automation-governance - bootstrap` | monitoring | 2026-03-11 | Инициализация self-improvement loop для automation-governance | Повторный пересмотр через 1 цикл | — |

## 2026-03-11 - automation-governance - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Automation-governance как process agent не имел отдельного lessons-файла; нарушения schedule policy и unsafe automation decisions не накапливались.
- Preventive rule:
  - Уроки automation-governance всегда фиксируются в `lessons/automation-governance.md`.
  - Перед одобрением scheduled run всегда проверять: stale check, sync status, execution contract версию.
  - Unsafe schedule должен блокировать запуск до явного human-approve.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - automation
  - schedule
  - governance
  - agent-telemetry
- Apply in:
  - Каждый запуск automation-governance при изменениях scheduled runs, automation registry или pause/resume/archive policy.
- Validation:
  - Файл доступен для retrieval и knowledge modal в OAP.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
  - artifacts/agent_telemetry_summary.json
