# Contract Audit Specialist Lessons

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
| `2026-03-11 - contract-audit - bootstrap` | monitoring | 2026-03-11 | Инициализация self-improvement loop для contract-audit | Повторный пересмотр через 1 цикл | — |

## 2026-03-11 - contract-audit - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Contract-audit как process agent не имел отдельного lessons-файла; нарушения schema/API/routing-contract не агрегировались по специалисту.
- Preventive rule:
  - Уроки contract-audit всегда фиксируются в `lessons/contract-audit.md`.
  - При аудите всегда сверяться с source-of-truth: `spec.md`, `contracts/*.md`, generated manifests.
  - Breaking gap должен блокировать merge — фиксировать как P0 в отчёте.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - contracts
  - schema
  - api
  - routing
- Apply in:
  - Каждый запуск contract-audit при изменениях spec, contracts, routing, payload shape или generated manifests.
- Validation:
  - Файл доступен для retrieval и knowledge modal в OAP.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
  - .specify/specs/001-oap/contracts/
