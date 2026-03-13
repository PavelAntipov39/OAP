# Editorial Quality Specialist Lessons

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
| `2026-03-12 - editorial-quality-audit - bootstrap` | monitoring | 2026-03-12 | Инициализация self-improvement loop для editorial-quality-audit | Повторный пересмотр через 1 цикл | — |

## 2026-03-12 - editorial-quality-audit - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для specialist-а, который отвечает за ясность, фактологию и обещания в описательном тексте.
- Root cause:
  - В active-контуре ОАП не было отдельного process agent для редакционной проверки обзорных документов, section descriptions и объясняющего UI copy; из-за этого фактическая правка текста смешивалась между analyst, designer и docs-sync без выделенного editorial-контракта.
- Preventive rule:
  - Уроки editorial-quality-audit всегда фиксируются в `lessons/editorial-quality-audit.md`.
  - Перед финальной правкой описательного текста сначала проверять фактологию по source-of-truth, затем выполнять editorial review на ясность, обещания и понятность.
  - Если текст меняет термины или дублируемые operational facts, editorial-quality-audit не заменяет `terminology-consistency-audit` и `docs-spec-sync`, а работает вместе с ними.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - docs
  - copy
  - overview
  - ui
  - fact-check
- Apply in:
  - Каждый запуск editorial-quality-audit при изменениях overview-документов, agent descriptions, section descriptions, tooltip или modal text.
- Validation:
  - Файл доступен для retrieval и knowledge modal в OAP.
- Related artifacts:
  - docs/agents/registry.yaml
  - docs/subservices/oap/agents/editorial-quality-audit/OPERATING_PLAN.md
  - scripts/export_host_agents.py
  - docs/agents/profile_templates.yaml
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
