# Data Agent Lessons

## Archive status
- `data-agent` выведен из active architecture в Batch `6R`.
- Этот lessons-файл сохранен для retrieval по historical telemetry и будущего возврата роли.

## 2026-02-28 - data-agent - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Не было отдельного файла уроков по ETL/Data циклам.
- Preventive rule:
  - Все уроки data-agent фиксируются в `archive/tasks/lessons/data-agent.md` до повторного ввода роли в active set.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - etl
  - datasets
  - telemetry
- Apply in:
  - Historical ETL и quality-циклы data-agent.
- Validation:
  - Файл доступен для retrieval и может быть использован при re-add роли.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
