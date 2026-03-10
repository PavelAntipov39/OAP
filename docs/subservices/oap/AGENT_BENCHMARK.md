# OAP Agent Benchmark Runbook

## Цель
Этот runbook задает воспроизводимый цикл benchmark-оценки AI-агентов в ОАП с режимом `local-first`.

## Артефакты
- Dataset: `artifacts/analyst_benchmark_dataset.json`
- Raw run: `artifacts/agent_benchmark_run_results.json`
- Latest summary: `artifacts/agent_benchmark_summary.json`
- Trend history (append-only): `artifacts/agent_benchmark_history.jsonl`

## Контракт dataset (минимум)
- `case_id`, `agent_id`, `case_source`, `difficulty`
- `input_payload`, `expected_facts[]`, `critical_must_not[]`
- `judge_rubric_version`, `owner`, `last_validated_at`
- `expected_schema` — опционально

## Контракт run-results
- `run_id`, `agent_id`, `target_k`, `judge_model`, `judge_rubric_version`
- `started_at`, `finished_at`
- `cases[]`:
  - `case_id`
  - `attempts[]`: `attempt_index`, `passed`, `fact_coverage`, `schema_valid`, `trajectory_compliant`, `latency_ms`, `cost_usd`, `critical_violation`
  - `human_validation`: `checked`, `judge_agreed`
- `impact` (опционально): `recommendation_executability_rate`, `evidence_link_coverage`, `validated_impact_rate`, `time_to_action_hours[]`

## Запуск
```bash
python3 scripts/agent_telemetry.py benchmark-report \
  --dataset-json artifacts/analyst_benchmark_dataset.json \
  --run-json artifacts/agent_benchmark_run_results.json \
  --telemetry-summary-json artifacts/agent_telemetry_summary.json \
  --out-json artifacts/agent_benchmark_summary.json \
  --out-history-jsonl artifacts/agent_benchmark_history.jsonl \
  --mode soft_warning
```

## Целевые пороги (pilot, 30 дней)
- `pass_at_5 >= 0.80`
- `fact_coverage_mean >= 0.85`
- `schema_valid_rate >= 0.98`
- `trajectory_compliance_rate >= 0.90`
- `judge_disagreement_rate <= 0.15`
- `recommendation_action_rate >= 0.30`

## Интерпретация gate
- `passed`: пороги выполнены.
- `warning`: есть деградация/неполные данные, но пайплайн не блокируется (`soft_warning`).
- `failed`: при `strict` режиме threshold нарушен, команда завершается с non-zero.

## Сравнение запусков
1. Запуск `benchmark-report` добавляет строку в `agent_benchmark_history.jsonl`.
2. Для сравнения двух запусков используйте `run_id` и секцию `metrics` + `impact_metrics`.
3. Регрессией считается просадка метрики ниже порога в 2 последовательных прогонах.
