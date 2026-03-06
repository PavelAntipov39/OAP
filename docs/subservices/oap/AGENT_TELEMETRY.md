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
- `artifacts_read[]` для фиксации фактических чтений файлов/артефактов
- `artifacts_written[]` для фиксации фактических записей файлов/артефактов
- `error` для диагностики падений
- A/B checkpoint-контекст (`ab_test_checkpoint`):
  - `metrics.target_delta_pct` — сдвиг целевой метрики в процентах;
  - `metrics.guardrail_breached` — нарушение guardrail (`true|false`);
  - `metrics.ab_sessions_required` — целевое число сессий A/B (`3..8`).

Метрики принятия решений (в поле `metrics`, опционально):
- `metrics.n_candidates` — количество кандидатов-улучшений на шаге формирования списка (шаг 6)
- `metrics.n_selected` — количество отобранных улучшений на шаге приоритизации (шаг 7)
- `metrics.decision_time_ms` — время принятия решения о приоритизации в миллисекундах (шаг 7)

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

Формула:
- `recommendation_action_rate = applied / suggested * 100`
- `plan_coverage_rate = plan_signal_tasks / tasks_total * 100`, где `plan_signal_tasks` включает `planned|replanned` и `step=plan*` при `status=started`
- `verification_pass_rate = verify_passed / verify_started * 100`
- `lesson_capture_rate = lesson_captured / (verify_passed + verify_failed) * 100`
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

## Команды
Записать событие:

```bash
make agent-log AGENT=analyst-agent TASK=task-42 STEP=recommendation_scoring STATUS=recommendation_suggested REC=rec-12 MCP=Context7 TOKENS_IN=1200 TOKENS_OUT=420
```

Записать факт read/write артефактов:

```bash
make agent-log AGENT=analyst-agent TASK=task-42 STEP=verify STATUS=verify_started ARTIFACT_READ=docs/agents/registry.yaml ARTIFACT_WRITE=artifacts/agent_cycle_validation_report.json
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

## Политика качества
- Любой production-агент должен держать `trace_coverage_pct >= 95`.
- Любая новая рекомендация должна иметь `recommendation_id`, иначе она не попадет в измеримую воронку эффекта.
- Review-инциденты логируются отдельным событием с `review_errors`.

## Источники практик
- OpenTelemetry semantic conventions: [opentelemetry.io](https://opentelemetry.io/docs/specs/semconv/)
- OpenTelemetry log/trace correlation: [opentelemetry.io](https://opentelemetry.io/docs/)
- Sentry + OpenTelemetry: [docs.sentry.io](https://docs.sentry.io/)
- Sentry AI agent instrumentation: [docs.sentry.io](https://docs.sentry.io/product/insights/agent-monitoring/)
