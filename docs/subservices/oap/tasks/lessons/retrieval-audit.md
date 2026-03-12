# Retrieval Audit Specialist Lessons

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
| `2026-03-11 - retrieval-audit - bootstrap` | monitoring | 2026-03-11 | Инициализация self-improvement loop для retrieval-audit | Повторный пересмотр через 1 цикл | — |

## 2026-03-11 - retrieval-audit - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Retrieval-audit как process agent не имел отдельного lessons-файла; уроки оседали в вызывающем агенте.
- Preventive rule:
  - Уроки retrieval-audit всегда фиксируются в `lessons/retrieval-audit.md`.
  - При аудите retrieval всегда документировать: evidence set, top_k, score threshold, выявленные пробелы.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - retrieval
  - evidence
  - qmd
  - quality
- Apply in:
  - Каждый запуск retrieval-audit при распределённом контексте задачи.
- Validation:
  - Файл доступен для retrieval и knowledge modal в OAP.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
  - docs/agents/host_agnostic_agent_catalog.yaml
