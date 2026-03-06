# Ops Agent Lessons

## 2026-02-28 - ops-agent - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Ops-уроки не были выделены в отдельный источник.
- Preventive rule:
  - Все lessons по инцидентам/deploy циклам вести в `lessons/ops-agent.md`.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - deploy
  - incidents
  - telemetry
- Apply in:
  - Все операционные циклы ops-agent.
- Validation:
  - Файл индексируется в OAP knowledge base.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
