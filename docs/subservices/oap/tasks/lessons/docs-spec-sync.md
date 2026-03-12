# Docs & Spec Sync Specialist Lessons

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
| `2026-03-11 - docs-spec-sync - bootstrap` | monitoring | 2026-03-11 | Инициализация self-improvement loop для docs-spec-sync | Повторный пересмотр через 1 цикл | — |

## 2026-03-11 - docs-spec-sync - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Docs-spec-sync как process agent не имел отдельного lessons-файла; дрейф между spec/ADR/README/glossary не накапливался как обучающий сигнал.
- Preventive rule:
  - Уроки docs-spec-sync всегда фиксируются в `lessons/docs-spec-sync.md`.
  - При аудите проверять все точки дублирования: human-readable + machine-readable версии одного контракта.
  - Consistency gap должен сопровождаться ссылкой на canonical source и список устаревших docs.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - docs
  - spec
  - consistency
  - sync
- Apply in:
  - Каждый запуск docs-spec-sync при архитектурных и process changes.
- Validation:
  - Файл доступен для retrieval и knowledge modal в OAP.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
  - .specify/specs/001-oap/spec.md
