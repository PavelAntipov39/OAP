# Terminology Consistency Specialist Lessons

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
| `2026-03-11 - terminology-consistency-audit - bootstrap` | monitoring | 2026-03-11 | Инициализация self-improvement loop для terminology-consistency-audit | Повторный пересмотр через 1 цикл | — |

## 2026-03-11 - terminology-consistency-audit - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Terminology-consistency-audit как process agent не имел отдельного lessons-файла; drift UI-лейблов и glossary-нарушения не агрегировались по специалисту.
- Preventive rule:
  - Уроки terminology-consistency-audit всегда фиксируются в `lessons/terminology-consistency-audit.md`.
  - Canonical source для терминов: `docs/subservices/oap/CAPABILITY_GLOSSARY.json`.
  - Hardcoded локальные маппинги в UI — автоматически P2 нарушение; должны быть заменены glossary-lookup.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - terminology
  - glossary
  - ui
  - labels
- Apply in:
  - Каждый запуск terminology-consistency-audit при изменениях labels/chips/tooltip/semantic_layer/source_kind.
- Validation:
  - Файл доступен для retrieval и knowledge modal в OAP.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
  - docs/subservices/oap/CAPABILITY_GLOSSARY.json
