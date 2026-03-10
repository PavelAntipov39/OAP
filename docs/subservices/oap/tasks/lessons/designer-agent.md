# Designer Agent Lessons

## 2026-02-28 - designer-agent - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Ранее использовался общий журнал без отдельного UX-профиля уроков.
- Preventive rule:
  - Все UX/UI lessons фиксируются в `lessons/designer-agent.md`.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - ux
  - ui-kit
  - telemetry
- Apply in:
  - Все циклы design-review и UI-проверок.
- Validation:
  - Файл участвует в retrieval-пакете и доступен из OAP.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
