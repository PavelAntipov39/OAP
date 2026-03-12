# Ops Agent Lessons

## Archive status
- `ops-agent` выведен из active architecture в Batch `6R`.
- Этот lessons-файл сохранен для retrieval по historical telemetry и будущего возврата роли.

## 2026-02-28 - ops-agent - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Ops-уроки не были выделены в отдельный источник.
- Preventive rule:
  - Все lessons по инцидентам/deploy циклам вести в `archive/tasks/lessons/ops-agent.md` до повторного ввода роли в active set.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - deploy
  - incidents
  - telemetry
- Apply in:
  - Historical операционные циклы ops-agent.
- Validation:
  - Файл сохраняется в архивном knowledge layer для будущего re-add.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
