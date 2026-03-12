# Agent Telemetry Standard (OAP)

## Цель
Фиксировать логи по каждому AI-агенту и процессу vibe-кодинга в едином формате, чтобы:
- видеть реальную эффективность агента по задачам;
- связывать рекомендации с результатами задач (`recommendation_action_rate`);
- быстро разбирать ошибки review и сбои MCP без ручного чтения сырых логов.

## Рекомендуемый стек
- Instrumentation layer: OpenTelemetry-first (trace/log correlation, `trace_id`, `span_id`, `run_id`).
- Monitoring UI: Sentry как операционный слой для ошибок, latency и AI-workflow.
- Local reproducible storage: JSONL per-agent logs в `.logs/agents/*.jsonl`.
- Long-term analytics storage: БД/warehouse (например Supabase/Postgres) через batch sync из локальных логов.

Почему так:
- OpenTelemetry дает стандартный контракт событий и переносимость.
- Sentry удобно использовать как production-панель по инцидентам и трассам.
- JSONL нужен как локальный и CI-friendly источник правды, который легко агрегировать в отчеты.

## Контракт события (минимум)
Каждое событие должно содержать:
- `agent_id`
- `process` (обычно `vibe_coding`)
- `task_id`
- `step`
- `status`
- `run_id`
- `trace_id`
- `metrics` (`duration_ms`, `tokens_in`, `tokens_out`, `review_errors`)

Опционально:
- `recommendation_id` для связи с рекомендациями
- benchmark-контекст:
  - `benchmark_run_id`
  - `benchmark_case_id`
  - `attempt_index`
  - `judge_model`
  - `judge_score`
- `mcp_tools[]` для контроля влияния MCP
- `tools[]` для фиксации используемых capability-инструментов (tool-layer)
- orchestration-контекст:
  - `profile_id`, `instance_id`, `parent_instance_id`, `root_agent_id`, `depth`
  - `objective`, `verify_status`
- `rules[]`, `input_artifacts[]`, `output_artifacts[]`
- `artifacts_read[]` для фиксации фактических чтений файлов/артефактов
- `artifacts_written[]` для фиксации фактических записей файлов/артефактов
- `artifact_operations[]` (optional canonical) для явной операции `read|create|update|delete` по пути
  - для каждой операции обязателен перенос taxonomy-метаданных: `source_kind`, `semantic_layer`, `reason`, `label`.
- `artifact_contract_version` — версия producer-контракта file trace (`v2`)
- `artifact_ops_origin` — происхождение операций: `explicit|mirrored_legacy|step_fallback|none`
- `error` для диагностики падений
- A/B checkpoint-контекст (`ab_test_checkpoint`):
  - `metrics.target_delta_pct` — сдвиг целевой метрики в процентах;
  - `metrics.guardrail_breached` — нарушение guardrail (`true|false`);
  - `metrics.ab_sessions_required` — целевое число сессий A/B (`3..8`).

Метрики принятия решений (в поле `metrics`, опционально):
- `metrics.n_candidates` — количество кандидатов-улучшений на шаге формирования списка (шаг 6)
- `metrics.n_selected` — количество отобранных улучшений на шаге приоритизации (шаг 7)
- `metrics.decision_time_ms` — время принятия решения о приоритизации в миллисекундах (шаг 7)

Семантика taxonomy:
- `skills[]` — только real skills, у которых есть `SKILL.md`.
- `tools[]` — capability-инструменты (например `QMD retrieval`).
- `mcp_tools[]` — integration-layer (серверы/подключения MCP).
- Legacy-совместимость: если в старом событии есть `skills=["qmd-memory-retrieval"]`, оно нормализуется в `tools=["QMD retrieval"]`.
- Baseline vs runtime:
  - step-level `Навыки/Инструменты/MCP` из operating plan задают baseline minimum;
  - telemetry `skills[]/tools[]/mcp_tools[]` фиксируют фактически использованный runtime-набор;
  - runtime-набор может быть шире baseline за счет dynamic capability selection (capability-first routing + orchestration + allowlist/policy gates).
- Для шагов, где применился динамический capability, producer обязан логировать фактический runtime capability в соответствующем telemetry-поле, а не только baseline шага.
- Для file-trace использовать 2 независимые оси (MECE):
  - `source_kind`: `registry`, `template_catalog`, `operating_plan`, `spec`, `contract`, `telemetry_log`, `generated_artifact`, `capability_snapshot`, `unknown`.
  - `semantic_layer`: `skills`, `tools`, `mcp`, `rules`, `tasks`, `memory`, `schema`, `telemetry`, `unknown`.
- Step-aware policy для `semantic_layer`:
  - `docs/agents/registry.yaml` и `docs/agents/profile_templates.yaml`:
    - `step_0_intake`/`step_3_orchestration` -> `tools`;
    - `step_1_start`/`step_6_role_exit_decision`/`step_7_apply_or_publish` -> `rules`.
  - `OPERATING_PLAN.md` и `DESIGN_RULES.md` -> `rules`.
  - `/.specify/specs/001-oap/*` и `/contracts/` -> `schema`.
  - `.logs/agents/*` и `artifacts/agent_*` -> `telemetry`.
  - `lessons*.md` -> `memory`.
  - `agent_tasks.task_brief.context_package` и task refs -> `tasks`.
- Consistency guard (soft-warning):
  - считаются `unknown_source_rate` и `unknown_semantic_rate`;
  - warning при `>10%` по любой метрике;
  - в `soft_warning` цикл не блокируется, warning публикуется в telemetry summary.

Workflow-статусы (рекомендуемый минимум):
- `planned`, `replanned`
- `started`, `completed`
- `verify_started`, `verify_passed`, `verify_failed`
- `lesson_captured`, `lesson_not_applicable`
- `recommendation_suggested`, `recommendation_applied`
- `candidate_received`, `candidate_assessed`, `candidate_rejected`
- `ab_test_started`, `ab_test_checkpoint`, `ab_test_passed`, `ab_test_failed`
- `rollback_applied`
- `failed`, `review_failed`, `step_error`
- orchestration:
  - `agent_profile_reused`, `agent_profile_created`
  - `agent_instance_spawned`, `agent_instance_completed`, `agent_instance_failed`
  - `agent_retire_recommended`
  - `orchestration_mode_selected`
  - `orchestration_phase_started`, `orchestration_phase_completed`
  - `roundtable_started`, `roundtable_round_completed`, `roundtable_converged`
  - `orchestration_merge_started`, `orchestration_merge_completed`
  - `orchestration_conflict_detected`, `orchestration_conflict_resolved`
- capability optimization:
  - `capability_refresh_started`, `capability_refresh_completed`, `capability_refresh_failed`
  - `shadow_trial_plan_refreshed`, `shadow_trial_judged`
  - `capability_snapshot_published`, `capability_stale_detected`

Обязательный learning-core цикл для всех агентов:
1. `planned|started`
2. `verify_started`
3. `verify_passed|verify_failed`
4. `lesson_captured|lesson_not_applicable`
5. только после этого: `completed|failed|review_passed`

Правило коррекций:
- если пользователь дал коррекцию, обязательно логировать урок (`lesson_captured`) и фиксировать `root cause + preventive rule` в lessons-файле агента.

## KPI, которые считаются автоматически
- `trace_coverage_pct`
- `run_coverage_pct`
- `review_error_rate`
- `p95_duration_ms`
- `recommendation_action_rate`
- `plan_coverage_rate`
- `verification_pass_rate`
- `lesson_capture_rate`
- `replan_rate`
- `autonomous_bugfix_rate`
- `elegance_gate_rate`
- `decision_time_avg_ms` — среднее время приоритизации (из `metrics.decision_time_ms` в событиях)
- `ab_pass_rate` — доля успешных A/B запусков (`ab_test_passed / ab_test_started * 100`)
- `rollback_rate` — доля откатов после неуспешного A/B (`rollback_applied / ab_test_failed * 100`)
- `ab_guardrail_breach_rate` — доля checkpoint-сессий, где нарушены guardrails
- `ab_sessions_progress_rate` — прогресс прохождения окна A/B (`checkpoints_done / ab_sessions_required * 100`)
- `time_to_solution_min` — длительность последнего цикла (latest_cycle_analyst.json)
- `pass_at_5` — доля benchmark-кейсов, где минимум один из K запусков успешен
- `fact_coverage_mean` — среднее покрытие ожидаемых фактов в benchmark-ответах
- `schema_valid_rate` — доля benchmark-ответов, прошедших структурную валидацию
- `trajectory_compliance_rate` — доля benchmark-запусков с корректной траекторией lifecycle
- `judge_disagreement_rate` — доля несогласий между LLM-судьей и human-калибровкой
- `cost_per_success` — стоимость одного успешного benchmark-кейса
- `reuse_hit_rate` — доля reuse относительно reuse+create
- `reuse_rate` — alias для `reuse_hit_rate` в карточках orchestration
- `new_profile_creation_rate` — доля newly-created профилей относительно reuse+create
- `specialist_verify_pass_rate` — доля successful verify у specialist instance
- `profile_sprawl_ratio` — число новых профилей на одну задачу
- `tool_overreach_rate` — доля запусков с признаком overreach
- `routing_accuracy_rate` — доля routing-решений, подтвержденных как корректные
- `parallelization_gain_rate` — доля задач, где orchestration реально использовала non-sequential режим
- `merge_conflict_rate` — доля merge-циклов, где были зафиксированы конфликты
- `no_progress_loop_rate` — доля задач, где orchestration попала в no-progress loop
- `verification_coverage_rate` — доля задач, дошедших хотя бы до `verify_started`
- `orchestration_cost_per_completed_task` — стоимость/токены на завершенную задачу
- `time_to_verify_min` — среднее время от `agent_instance_spawned` до terminal verify
- `canonical_event_compliance_rate` — доля событий analyst-cycle, которые попали в канонические этапы `step_0..step_9.1`
- `non_canonical_events_total` — число событий analyst-cycle вне канона
- `missing_canonical_steps[]` — по каждой `task_id` список пропущенных канонических этапов
- `capability_refresh_coverage_rate` — доля task-run, где capability-refresh завершился успешно
- `stale_table_rate` — как часто на старте capability-refresh находился stale snapshot
- `shadow_trial_completion_rate` — доля judged shadow-trial относительно refresh-планов trial
- `promotion_blocked_by_stale_total` — сколько раз stale snapshot блокировал promotion/decision
- `file_ops_eligible_events` — события v2 с зафиксированными файловыми операциями
- `file_ops_explicit_events` — события v2, где операции переданы явно через `artifact_operations[]`
- `file_ops_mirrored_legacy_events` — события v2, где операции построены из legacy `artifacts_read/written`
- `file_ops_step_fallback_events` — события v2, где операции восстановлены step-fallback логикой
- `file_ops_operations_total` — суммарное число операций файла
- `file_ops_delete_total` — число операций `delete`
- `file_ops_explicit_coverage_pct` — доля explicit-событий среди `file_ops_eligible_events`
- `file_ops_fallback_share_pct` — доля fallback-событий среди `file_ops_eligible_events`

Формула:
- `recommendation_action_rate = applied / suggested * 100`
- `plan_coverage_rate = plan_signal_tasks / tasks_total * 100`, где `plan_signal_tasks` включает `planned|replanned` и `step=plan*` при `status=started`
- `verification_pass_rate = unique task_id с verify_started+verify_passed / unique task_id с verify_started * 100`
- `lesson_capture_rate = lesson_captured / (unique task_id с verify_started+verify_passed + unique task_id с verify_started+verify_failed) * 100`
- `replan_rate = replanned / planned * 100`
- `decision_time_avg_ms = avg(metrics.decision_time_ms) по всем событиям агента`
- `ab_pass_rate = ab_test_passed / ab_test_started * 100`
- `rollback_rate = rollback_applied / ab_test_failed * 100`
- `ab_guardrail_breach_rate = guardrail_breached_count / ab_test_checkpoint_count * 100`
- `ab_sessions_progress_rate = checkpoints_done / ab_sessions_required * 100`
- `time_to_solution_min = (completed_at - started_at) в минутах для последнего цикла`
- `pass_at_5 = successful_cases / total_cases`
- `fact_coverage_mean = avg(fact_coverage)`
- `schema_valid_rate = valid_schema_attempts / attempts_total`
- `trajectory_compliance_rate = trajectory_ok_attempts / attempts_total`
- `judge_disagreement_rate = judge_disagreed / human_checked`
- `cost_per_success = total_cost_usd / successful_cases`
- `canonical_event_compliance_rate = canonical_cycle_events / cycle_events_total * 100`
- `non_canonical_events_total = count(step not in canonical set)`
- `capability_refresh_coverage_rate = capability_refresh_completed_tasks / tasks_total * 100`
- `stale_table_rate = capability_stale_detected / capability_refresh_started * 100`
- `shadow_trial_completion_rate = shadow_trial_judged / shadow_trial_plan_refreshed * 100`
- `promotion_blocked_by_stale_total = count(capability_stale_detected)`

## Команды
Записать событие:

```bash
make agent-log AGENT=analyst-agent TASK=task-42 STEP=recommendation_scoring STATUS=recommendation_suggested REC=rec-12 MCP=Context7 TOOL="QMD retrieval" TOKENS_IN=1200 TOKENS_OUT=420
```

Записать событие с проверкой step-контракта:

```bash
python3 scripts/agent_telemetry.py log \
  --agent-id analyst-agent \
  --task-id task-42 \
  --step step_7_apply_or_publish \
  --status recommendation_applied \
  --enforce-step-contract warning
```

Правило `--enforce-step-contract`:
- `none` — без проверки;
- `warning` — событие пишется, но в событие добавляется `metrics.step_contract_violation=true`;
- `strict` — неканонический этап блокирует запись события (exit code 1).

Правило `--auto-capability-refresh`:
- `on_run` (по умолчанию) — при финальном каноническом событии (`step_9_finalize`/`step_9_publish_snapshots` + `completed|failed|review_passed`) автоматически запускается capability-refresh для текущего `agent_id` с логированием `capability_refresh_*`.
- для дефолтного `--log-dir .logs/agents` выполняется best-effort синхронизация generated-индексов (`ops-web/scripts/build_content_index.mjs`), чтобы snapshot был виден в UI без ручного шага.
- `off` — отключает авто-refresh для этого конкретного лог-события (используется runner-ами, где refresh вызывается отдельным явным subflow).

Записать orchestration-событие:

```bash
python3 scripts/agent_telemetry.py log \
  --agent-id analyst-agent \
  --task-id task-42 \
  --step delegation \
  --status agent_instance_spawned \
  --profile-id specialist-retrieval-audit-001 \
  --instance-id inst-001 \
  --root-agent-id analyst-agent \
  --depth 1 \
  --objective "Проверить evidence coverage по candidate-задаче" \
  --verify-status pending \
  --rule "QMD Retrieval Policy" \
  --input-artifact ".specify/specs/001-oap/spec.md"
```

Записать факт read/write артефактов:

```bash
make agent-log AGENT=analyst-agent TASK=task-42 STEP=verify STATUS=verify_started ARTIFACT_READ=docs/agents/registry.yaml ARTIFACT_WRITE=artifacts/agent_cycle_validation_report.json
```

Записать канонические операции файла (`artifact_operations[]`):

```bash
python3 scripts/agent_telemetry.py log \
  --agent-id analyst-agent \
  --task-id task-42 \
  --step step_7_apply_or_publish \
  --status started \
  --artifact-op read:docs/agents/registry.yaml \
  --artifact-op delete:artifacts/tmp/draft.md
```

Отметить применение рекомендации:

```bash
make agent-log AGENT=analyst-agent TASK=task-42 STEP=apply_fix STATUS=recommendation_applied REC=rec-12 OUTCOME=success DURATION_MS=1800
```

Отметить прохождение verify + lessons-loop:

```bash
make agent-log AGENT=analyst-agent TASK=task-42 STEP=verify STATUS=verify_started
make agent-log AGENT=analyst-agent TASK=task-42 STEP=verify STATUS=verify_passed
make agent-log AGENT=analyst-agent TASK=task-42 STEP=learn STATUS=lesson_captured
```

Отметить checkpoint A/B с guardrails:

```bash
python3 scripts/agent_telemetry.py log \
  --agent-id analyst-agent \
  --task-id task-42 \
  --step ab_test \
  --status ab_test_checkpoint \
  --run-id run-ab-42 \
  --trace-id trace-ab-42 \
  --benchmark-run-id bench-2026-03-05 \
  --attempt-index 3 \
  --tokens-in 900 \
  --tokens-out 220 \
  --target-delta-pct 7.4 \
  --guardrail-breached false \
  --ab-sessions-required 5
```

Примечание:
- при записи A/B checkpoint используйте параметры:
  `--target-delta-pct`, `--guardrail-breached`, `--ab-sessions-required`.
- Если guardrail нарушен, переход в `ab_test_failed` и `rollback_applied` обязателен.

Собрать отчет:

```bash
make agent-telemetry-report
```

Собрать отчет с gate по качеству producer file-trace:

```bash
python3 scripts/agent_telemetry.py report \
  --file-ops-explicit-min-pct 90 \
  --file-ops-fallback-max-pct 10 \
  --file-ops-gate-mode soft_warning
```

Собрать benchmark summary (local-first):

```bash
python3 scripts/agent_telemetry.py benchmark-report \
  --dataset-json artifacts/analyst_benchmark_dataset.json \
  --run-json artifacts/agent_benchmark_run_results.json \
  --telemetry-summary-json artifacts/agent_telemetry_summary.json \
  --out-json artifacts/agent_benchmark_summary.json \
  --out-history-jsonl artifacts/agent_benchmark_history.jsonl \
  --mode soft_warning
```

Проверить цикл self-improvement (soft-warning по умолчанию):

```bash
make agent-cycle-validate
```

Посмотреть план repair для исторических нарушений (без записи в логи):

```bash
make agent-cycle-backfill
```

Применить append-only backfill repair:

```bash
make agent-cycle-backfill APPLY=1
```

Проверить и закрыть конкретную задачу в strict-режиме:

```bash
make agent-cycle-close AGENT=analyst-agent TASK=task-42 MODE=strict
```

Артефакты:
- `artifacts/agent_telemetry_summary.json`
- `artifacts/agent_telemetry_summary.md`
- `artifacts/agent_cycle_validation_report.json`
- `artifacts/agent_latest_cycle_analyst.json`
- `artifacts/agent_benchmark_summary.json`
- `artifacts/agent_benchmark_history.jsonl`

## State-machine enforce (Soft-warning -> Strict)
- `soft_warning`:
  - нарушения последовательности пишутся в отчет;
  - процесс не блокируется (exit code 0).
- `strict`:
  - нарушение последовательности блокирует закрытие цикла (non-zero exit code).
- benchmark gate в `strict` режиме:
  - если threshold по benchmark-метрике не выполнен, `benchmark-report` завершается non-zero exit code.
- benchmark gate в `soft_warning` режиме:
  - отчёт фиксирует деградацию, но не блокирует пайплайн.
- Enforce выполняется по ключу `agent_id + task_id`.
- Валидация проверяет именно learning-core state-machine, а не доменные шаги конкретной роли.
- По умолчанию проверяется `latest` final-state per task (исторические старые `completed` не блокируют после корректного repair-цикла).
- В `scripts/check_ops_hub.sh` default режим валидации: `strict` (можно временно переопределить `AGENT_CYCLE_MODE=soft_warning`).
- Критерий перехода в strict-by-default:
  - `lesson_capture_rate` и `verification_pass_rate` не деградируют в течение 2 недель.

## Где смотреть логи
- Сырые логи (оперативно): `.logs/agents/*.jsonl`
- Сводка (оперативно): `artifacts/agent_telemetry_summary.json`
- Сводка (читаемо): `artifacts/agent_telemetry_summary.md`
- Историческая аналитика: в БД/warehouse после sync (целевая модель).

## KPI жизнеспособности агента
- В `agents[]` summary дополнительно публикуются KPI, которые помогают понять, нужен ли top-level агент как отдельная роль, а не только как архивная сущность.
- `invocation_count`
  - что значит: сколько отдельных запусков агента было за период;
  - как считается: `count(distinct run_id)`; если в старых событиях `run_id` отсутствует, используется fallback `tasks_total`.
- `completed_task_count`
  - что значит: сколько задач агент довел до terminal success;
  - как считается: то же значение, что и `completed_tasks`.
- `handoff_use_rate`
  - что значит: в какой доле задач агент реально делегировал работу в child-run, а не только планировал это;
  - как считается: `tasks_with_agent_instance_spawned / tasks_total * 100`.
- `overlap_with_analyst_rate`
  - что значит: насколько часто агент работает в тех же `task_id`, что и `analyst-agent`;
  - как считается: `shared_tasks_with_analyst / tasks_total * 100`;
  - для `analyst-agent` значение `null`, потому что overlap с самим собой неинформативен.
- `host_adapter_sync_status`
  - что значит: в каком состоянии repo-generated host adapters для этого агента;
  - значения:
    - `synced` — есть и `.claude/agents/<agent-id>.md`, и `.github/agents/<agent-id>.agent.md`;
    - `partial` — есть только один из двух adapter-файлов;
    - `missing` — adapter-файлы не найдены;
    - `archived` — агент выведен из активной архитектуры и находится в `docs/subservices/oap/archive/agents/<agent-id>/`.
- Эти KPI не заменяют `verification_pass_rate` и `orchestration_cost_per_completed_task`, а используются вместе с ними для решения `keep / narrow / merge / retire_candidate`.

## Structured artifact trace
- Каноническое поле producer-слоя: `artifact_operations[]` (optional, backward-compatible).
- Каждая операция хранит факт действия по файлу: `read|create|update|delete` (+ контекст события).
- Каждое событие file-trace v2 содержит:
  - `artifact_contract_version: "v2"`
  - `artifact_ops_origin: explicit|mirrored_legacy|step_fallback|none`
- Текущие поля `artifacts_read[]` и `artifacts_written[]` остаются обязательными для legacy-consumers и зеркалируются из `artifact_operations[]`.
- При отсутствии `artifact_operations[]` producer строит fallback-операции из `artifacts_read[]/artifacts_written[]` как `read/write`.
- `delete` зеркалируется в `artifacts_written[]` для legacy-совместимости, но в `artifact_operations[]` остается явным `op=delete`.

Целевой формат `artifact_operations[]`:

```json
{
  "path": "artifacts/agent_cycle_validation_report.json",
  "op": "delete",
  "timestamp": "2026-03-10T10:00:00Z",
  "step": "step_7_apply_or_publish",
  "task_id": "task-42",
  "run_id": "run-42"
}
```

Structured-формат для `artifacts_read[]/artifacts_written[]`:

```json
{
  "path": "docs/agents/registry.yaml",
  "source_kind": "registry",
  "semantic_layer": "tools",
  "reason": "orchestration_lookup",
  "label": "Реестр агентов"
}
```

- Значения `source_kind`:
  - `registry`
  - `template_catalog`
  - `operating_plan`
  - `spec`
  - `contract`
  - `telemetry_log`
  - `generated_artifact`
  - `capability_snapshot`
  - `unknown`
- Значения `semantic_layer`:
  - `skills`
  - `tools`
  - `mcp`
  - `rules`
  - `tasks`
  - `memory`
  - `schema`
  - `telemetry`
  - `unknown`
- Значения `reason` фиксируют операционную причину чтения/записи:
  - `task_intake`
  - `orchestration_lookup`
  - `health_check`
  - `context_sync`
  - `role_decision`
  - `contract_gate`
  - `verify`
  - `error_channel`
  - `lessons_update`
  - `capability_refresh`
  - `publish_snapshot`
  - `unknown`
- Правила интерпретации:
  - канонический источник операций: `artifact_operations[]`;
  - UI v1 показывает только `read/write/delete`; операции `create/update` в UI сводятся к `write` до отдельного контракта отображения;
  - `source_kind` является primary label для UI и session/file-метрик;
  - `semantic_layer` используется как secondary label, фильтр или tooltip;
  - тип `Tools` нельзя вычислять только из `path`;
  - legacy string-path формат остается допустимым, но считается менее точным и не должен приводить к ложной классификации capability-слоя.

## Политика качества
- Любой production-агент должен держать `trace_coverage_pct >= 95`.
- Любая новая рекомендация должна иметь `recommendation_id`, иначе она не попадет в измеримую воронку эффекта.
- Review-инциденты логируются отдельным событием с `review_errors`.

## Источники практик
- OpenTelemetry semantic conventions: [opentelemetry.io](https://opentelemetry.io/docs/specs/semconv/)
- OpenTelemetry log/trace correlation: [opentelemetry.io](https://opentelemetry.io/docs/)
- Sentry + OpenTelemetry: [docs.sentry.io](https://docs.sentry.io/)
- Sentry AI agent instrumentation: [docs.sentry.io](https://docs.sentry.io/product/insights/agent-monitoring/)
