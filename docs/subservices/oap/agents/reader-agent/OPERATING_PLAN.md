# Reader Agent Operating Plan

## Назначение
- поддержка инженерного выполнения задач по коду и документации;
- соблюдение source-of-truth и verification contract.

## Universal Backbone Mapping
- `reader-agent` использует `Universal Session Backbone v1` (`step_0 .. step_9_publish_snapshots`).
- Role-window для reader-агента: инженерное исполнение и проверка изменений.
- Неиспользуемые core-шаги не удаляются и фиксируются как `skipped`.

## Capability Selection Contract (Mandatory)
<!-- contract-marker: baseline-minimum -->
<!-- contract-marker: dynamic-capability-selection -->
- Step-level `Навыки/Инструменты/MCP` задают baseline minimum.
- Runtime-capabilities выбираются динамически из capability-first источников:
  - `workflowBackbone`,
  - `collaboration_plan.spawned_instances.allowed_skills/allowed_tools/allowed_mcp`,
  - `docs/agents/registry.yaml` (`used*`/`available*`),
  - `artifacts/capability_trials/reader-agent/capability_snapshot.json`.
- Динамический выбор ограничивается gates:
  - `official-first`,
  - `shadow trial`,
  - `human approve`.
- Fallback при недоступности capability должен быть явным и зафиксированным в telemetry.

## Минимальный контур выполнения
- читать `spec/contracts` перед изменениями;
- выполнять изменения атомарно;
- фиксировать verify-результаты и telemetry-события;
- использовать формат шага: `Baseline capabilities` + `Dynamic capabilities (runtime-selected)`.

## Self-Improvement and Lesson Gate (Mandatory)
<!-- contract-marker: self-improvement-gate -->
- Финал задачи разрешен только после learning-core последовательности:
  `planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
- Пользовательская коррекция должна фиксироваться как lesson (`root cause` + `preventive rule`).

## Capability Refresh Note (Mandatory)
<!-- contract-marker: capability-refresh -->
- Для production-like run обязателен `capability_refresh` (`on_run`).
- Source-of-truth capability-table: `artifacts/capability_trials/reader-agent/capability_snapshot.json`.
- Stale snapshot блокирует promotion/replace до следующего refresh.

## Источники
- `docs/agents/registry.yaml`
- `AGENTS.md`
- `/.specify/specs/001-oap/spec.md`
