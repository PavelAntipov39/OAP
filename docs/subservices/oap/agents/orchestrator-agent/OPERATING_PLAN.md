# Orchestrator Agent Operating Plan

## Назначение
- принимать разнородные задачи из backlog, user-chat и automation;
- выбирать primary executor из автономных агентов;
- подключать bounded process agents через dispatcher-backed execution;
- возвращать orchestration decision package без нарушения общего backbone.

## Universal Backbone Mapping
- `orchestrator-agent` использует `Universal Session Backbone v1` (`step_0 .. step_9_publish_snapshots`).
- Role-window для orchestrator-агента: routing, executor selection, bounded delegation, merge/verify ownership.
- Неиспользуемые core-шаги не удаляются и фиксируются как `skipped`.

## Capability Selection Contract (Mandatory)
<!-- contract-marker: baseline-minimum -->
<!-- contract-marker: dynamic-capability-selection -->
- Step-level `Навыки/Инструменты/MCP` задают baseline minimum.
- Runtime-capabilities выбираются динамически из capability-first источников:
  - `workflowBackbone`,
  - `collaboration_plan.spawned_instances.allowed_skills/allowed_tools/allowed_mcp`,
  - `docs/agents/registry.yaml` (`used*`/`available*`),
  - `docs/agents/host_agnostic_agent_catalog.yaml`,
  - `docs/agents/profile_templates.yaml`,
  - `artifacts/capability_trials/orchestrator-agent/capability_snapshot.json`.
- Динамический выбор ограничивается gates:
  - `official-first`,
  - `shadow trial`,
  - `human approve`.
- Fallback при недоступности capability или delegation должен быть явным и зафиксированным в telemetry.

## Минимальный контур выполнения
- читать `spec/contracts/governance` до routing решения;
- выбирать одного `primary executor` для write/apply-ветки;
- подключать process agents только как bounded delegation;
- не использовать multi-agent режим, если один автономный агент закрывает задачу без заметного orchestration gain;
- фиксировать coordinator/executor/process-agents в `collaboration_plan`.

## Self-Improvement and Lesson Gate (Mandatory)
<!-- contract-marker: self-improvement-gate -->
- Финал задачи разрешен только после learning-core последовательности:
  `planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
- Пользовательская коррекция по routing, wrong-executor selection или over-orchestration должна фиксироваться как lesson (`root cause` + `preventive rule`).

## Capability Refresh Note (Mandatory)
<!-- contract-marker: capability-refresh -->
- Для production-like run обязателен `capability_refresh` (`on_run`).
- Source-of-truth capability-table: `artifacts/capability_trials/orchestrator-agent/capability_snapshot.json`.
- Stale snapshot блокирует promotion/replace до следующего refresh.

## Routing policy
- `analyst-agent`
  - когда задача про KPI, telemetry, workflow, self-improvement, architecture impact, governance, prioritization;
- `designer-agent`
  - когда задача про UX/UI, terminology, layout, visual hierarchy, explanatory content;
- `reader-agent`
  - когда задача про implementation, code changes, integration, E2E, contracts in code.

## Default process agents
- `retrieval-audit`
  - когда нужно evidence-first подтверждение по нескольким документам;
- `ui-verification`
  - когда нужен runtime browser verify;
- `telemetry-audit`
  - когда задача меняет telemetry/KPI/orchestration trace;
- `contract-audit`
  - когда меняются spec/contracts/payload shapes/generated manifests;
- `docs-spec-sync`
  - когда меняются терминология, source-of-truth docs или generated docs;
- `automation-governance`
  - когда задача связана с scheduled runs и automation policy.

## Источники
- `docs/agents/registry.yaml`
- `docs/agents/host_agnostic_agent_catalog.yaml`
- `docs/agents/profile_templates.yaml`
- `docs/subservices/oap/MULTI_AGENT_GOVERNANCE.md`
- `AGENTS.md`
- `/.specify/specs/001-oap/spec.md`
