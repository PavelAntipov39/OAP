# Global Lessons Canon

Этот файл хранит универсальные правила самообучения, обязательные для любого ИИ-агента в ОАП.

## Обязательные принципы
1. `Plan -> Verify -> Learn` обязателен перед финальным `completed|failed|review_passed`.
2. Любая пользовательская коррекция должна приводить к уроку с `root cause` и `preventive rule`.
3. Любой урок должен быть воспроизводим:
   - где возникла проблема,
   - почему возникла,
   - какое правило предотвращает повтор.
4. `lesson_not_applicable` допустим только с кратким обоснованием в задаче/логах.
5. Уроки должны использоваться на следующем релевантном цикле через retrieval-пакет:
   - `lessons.global.md`
   - `lessons/<agent-id>.md`
   - последние релевантные уроки по тегам.
6. Запрещено закрывать задачу без verify-следа и шага learn в telemetry.

## Формат канонической записи
```md
## <YYYY-MM-DD> - <rule_id>
- Principle:
  - <что стало обязательным правилом>
- Trigger:
  - <какая ошибка/коррекция это правило породила>
- Preventive gate:
  - <какая проверка обязательна перед done>
- Applies to:
  - <analyst|designer|reader|data|ops|all>
- Source:
  - <task_id/log_ref/doc_ref>
```

## Seed правила
## 2026-02-28 - core-sequence-before-done
- Principle:
  - Перед `completed|failed|review_passed` должны быть `verify_started`, `verify_passed|verify_failed` и `lesson_captured|lesson_not_applicable`.
- Trigger:
  - Несистемное завершение задач без явного verify/learn следа.
- Preventive gate:
  - Включить `agent-cycle-validate` в soft-warning, затем strict.
- Applies to:
  - all
- Source:
  - docs/subservices/oap/AGENT_TELEMETRY.md
