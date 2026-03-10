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

## 2026-03-07 - preserve-analyst-card-ux
- Principle:
  - При унификации карточек агентов analyst-card остается UX-эталоном: нельзя вводить tab shell, copy-link сценарии или новую компоновку секций, если пользователь явно не запросил изменение самой карточки аналитика.
- Trigger:
  - Унификация drawer-контракта изменила UI и логику analyst-agent вместо переноса исходной analyst-логики на остальные карточки.
- Preventive gate:
  - Перед merge сравнить analyst-card с предыдущим UX и отдельно подтвердить, что меняются только данные/переиспользование, а не структура и взаимодействия эталонной карточки.
- Applies to:
  - all
- Source:
  - docs/subservices/oap/DESIGN_RULES.md

## 2026-03-10 - task-card-routing-by-service-mode
- Principle:
  - Роутинг карточки задачи должен учитывать `service_mode` задачи, а не только ID allowlist. Allowlist обеспечивает canary для демо-задач, `service_mode` — продуктовое правило для всех live-задач.
- Trigger:
  - Роутер `shouldUseExperimentalTaskCard` использовал только `EXPERIMENTAL_TASK_CARD_IDS.has(taskId)`. Live-задачи с `status: "waiting_human"` получали legacy-карточку вместо экспериментальной, хотя их `service_mode === "waiting_human"` явно означает необходимость human-gate UI.
- Preventive gate:
  - При введении нового условия роутинга проверять: (1) все реальные пользовательские сценарии открытия задачи (клик по строке таблицы, deep-link по URL, открытие из секции самоулучшения), (2) передаётся ли `service_mode` до момента принятия решения о роутинге.
- Applies to:
  - all
- Source:
  - ops-web/src/components/tasks/TaskDetailsDrawer.tsx
