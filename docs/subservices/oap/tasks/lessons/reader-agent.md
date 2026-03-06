# Reader Agent Lessons

## 2026-02-28 - reader-agent - bootstrap
- Correction:
  - Инициализация агентного lessons-файла для universal self-improvement loop.
- Root cause:
  - Ранее использовался общий `lessons.md`, без персонального контура.
- Preventive rule:
  - Все новые уроки reader-agent пишутся сюда в формате шаблона.
- Status evidence:
  - planned -> verify_started -> verify_passed -> lesson_captured -> completed
- Retrieval tags:
  - ui
  - docs
  - telemetry
- Apply in:
  - Все циклы reader-agent с пользовательскими корректировками.
- Validation:
  - Файл включен в knowledge model и может быть прочитан из OAP модалки.
- Related artifacts:
  - docs/subservices/oap/tasks/lessons/_TEMPLATE.md
  - docs/agents/registry.yaml
