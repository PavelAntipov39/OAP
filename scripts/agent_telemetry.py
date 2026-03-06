#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import uuid
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


LOG_VERSION = "agent_telemetry.v1"
REPORT_VERSION = "agent_telemetry_report.v1"
CYCLE_REPORT_VERSION = "agent_cycle_validation.v1"
LATEST_CYCLE_ANALYST_VERSION = "agent_latest_cycle_analyst.v1"
BENCHMARK_SUMMARY_VERSION = "agent_benchmark_summary.v1"

CYCLE_START_STATUSES = {"planned", "started"}
CYCLE_VERIFY_START_STATUS = "verify_started"
CYCLE_VERIFY_RESULT_STATUSES = {"verify_passed", "verify_failed"}
CYCLE_LESSON_STATUSES = {"lesson_captured", "lesson_not_applicable"}
CYCLE_FINAL_STATUSES = {"completed", "failed", "review_passed"}
USER_CORRECTION_STATUSES = {"user_correction", "user_corrected"}
FINAL_SCOPES = {"latest", "all"}
LATEST_CYCLE_AGENT_ID = "analyst-agent"

ANALYST_STEP_FALLBACK_ARTIFACTS: dict[str, dict[str, list[str]]] = {
    "plan": {
        "read": [
            "docs/subservices/oap/ANALYST_OPERATING_PLAN.md",
            "docs/agents/registry.yaml",
        ],
        "write": [],
    },
    "execute": {
        "read": [
            "docs/agents/registry.yaml",
            "docs/subservices/oap/agents-card.schema.json",
        ],
        "write": [
            "docs/agents/registry.yaml",
        ],
    },
    "verify": {
        "read": [
            ".logs/agents/analyst-agent.jsonl",
            "artifacts/agent_telemetry_summary.json",
        ],
        "write": [
            "artifacts/agent_cycle_validation_report.json",
        ],
    },
    "learn": {
        "read": [
            "artifacts/agent_cycle_validation_report.json",
        ],
        "write": [
            "docs/subservices/oap/tasks/lessons/analyst-agent.md",
        ],
    },
    "finalize": {
        "read": [
            ".logs/agents/analyst-agent.jsonl",
        ],
        "write": [
            "artifacts/agent_telemetry_summary.json",
            "artifacts/agent_telemetry_summary.md",
            "artifacts/agent_latest_cycle_analyst.json",
        ],
    },
    "cycle_repair": {
        "read": [
            ".logs/agents/analyst-agent.jsonl",
            "artifacts/agent_cycle_validation_report.json",
        ],
        "write": [
            ".logs/agents/analyst-agent.jsonl",
            "artifacts/agent_cycle_backfill_report.json",
        ],
    },
}

FINAL_STATUS_ARTIFACT_FALLBACK = {
    "read": [".logs/agents/analyst-agent.jsonl"],
    "write": [
        "artifacts/agent_telemetry_summary.json",
        "artifacts/agent_telemetry_summary.md",
        "artifacts/agent_latest_cycle_analyst.json",
    ],
}

BENCHMARK_THRESHOLD_DEFAULTS = {
    "pass_at_5": 0.80,
    "fact_coverage_mean": 0.85,
    "schema_valid_rate": 0.98,
    "trajectory_compliance_rate": 0.90,
    "judge_disagreement_rate": 0.15,
    "recommendation_action_rate": 0.30,
}


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso8601(value: str | None) -> dt.datetime | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def normalize_id(value: str | None, fallback: str) -> str:
    text = (value or "").strip()
    return text if text else fallback


def as_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return None
    return numeric if numeric >= 0 else None


def as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric if numeric >= 0 else None


def percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil((q / 100.0) * len(ordered)) - 1))
    return ordered[index]


def normalize_artifact_list(values: Any) -> list[str]:
    if values is None:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    candidates: list[str] = []
    if isinstance(values, str):
        candidates = [values]
    elif isinstance(values, list):
        candidates = [str(item) for item in values]
    else:
        candidates = [str(values)]
    for item in candidates:
        for part in item.split(","):
            value = part.strip()
            if not value:
                continue
            if value in seen:
                continue
            seen.add(value)
            normalized.append(value)
    return normalized


def build_log_event(args: argparse.Namespace) -> dict[str, Any]:
    timestamp = args.timestamp or utc_now_iso()
    run_id = normalize_id(args.run_id, str(uuid.uuid4()))
    trace_id = normalize_id(args.trace_id, str(uuid.uuid4()).replace("-", ""))

    metrics: dict[str, Any] = {}
    duration_ms = getattr(args, "duration_ms", None)
    tokens_in = getattr(args, "tokens_in", None)
    tokens_out = getattr(args, "tokens_out", None)
    review_errors = getattr(args, "review_errors", None)
    target_delta_pct = getattr(args, "target_delta_pct", None)
    guardrail_breached = getattr(args, "guardrail_breached", None)
    ab_sessions_required = getattr(args, "ab_sessions_required", None)

    if duration_ms is not None:
        metrics["duration_ms"] = duration_ms
    if tokens_in is not None:
        metrics["tokens_in"] = tokens_in
    if tokens_out is not None:
        metrics["tokens_out"] = tokens_out
    if review_errors is not None:
        metrics["review_errors"] = review_errors
    if target_delta_pct is not None:
        metrics["target_delta_pct"] = target_delta_pct
    if guardrail_breached is not None:
        metrics["guardrail_breached"] = guardrail_breached
    if ab_sessions_required is not None:
        metrics["ab_sessions_required"] = ab_sessions_required

    event: dict[str, Any] = {
        "version": LOG_VERSION,
        "event_id": str(uuid.uuid4()),
        "timestamp": timestamp,
        "agent_id": args.agent_id.strip(),
        "process": args.process.strip(),
        "run_id": run_id,
        "trace_id": trace_id,
        "span_id": args.span_id.strip() if args.span_id else None,
        "task_id": args.task_id.strip(),
        "step": args.step.strip(),
        "status": args.status.strip(),
        "outcome": args.outcome.strip() if args.outcome else None,
        "recommendation_id": args.recommendation_id.strip() if args.recommendation_id else None,
        "benchmark_run_id": args.benchmark_run_id.strip() if args.benchmark_run_id else None,
        "benchmark_case_id": args.benchmark_case_id.strip() if args.benchmark_case_id else None,
        "attempt_index": args.attempt_index if args.attempt_index is not None else None,
        "judge_model": args.judge_model.strip() if args.judge_model else None,
        "judge_score": args.judge_score if args.judge_score is not None else None,
        "mcp_tools": [item.strip() for item in (args.mcp or []) if item and item.strip()],
        "skills": [item.strip() for item in (args.skill or []) if item and item.strip()],
        "artifacts_read": normalize_artifact_list(args.artifact_read),
        "artifacts_written": normalize_artifact_list(args.artifact_write),
        "metrics": metrics,
        "error": args.error.strip() if args.error else None,
    }
    return event


def resolve_step_fallback_artifacts(step: str, status: str) -> dict[str, list[str]]:
    key = step.strip().lower()
    if key in ANALYST_STEP_FALLBACK_ARTIFACTS:
        payload = ANALYST_STEP_FALLBACK_ARTIFACTS[key]
        return {
            "read": list(payload.get("read", [])),
            "write": list(payload.get("write", [])),
        }
    for candidate in ("plan", "execute", "verify", "learn", "finalize", "cycle_repair"):
        if candidate in key:
            payload = ANALYST_STEP_FALLBACK_ARTIFACTS.get(candidate, {})
            return {
                "read": list(payload.get("read", [])),
                "write": list(payload.get("write", [])),
            }
    if status in CYCLE_FINAL_STATUSES:
        return {
            "read": list(FINAL_STATUS_ARTIFACT_FALLBACK.get("read", [])),
            "write": list(FINAL_STATUS_ARTIFACT_FALLBACK.get("write", [])),
        }
    return {"read": [], "write": []}


def build_latest_cycle_analyst_payload(
    *,
    events: list[dict[str, Any]],
    summary: dict[str, Any],
    cycle_report: dict[str, Any],
    agent_id: str = LATEST_CYCLE_AGENT_ID,
) -> dict[str, Any]:
    task_rows = [
        item
        for item in (cycle_report.get("tasks") or [])
        if str(item.get("agent_id") or "").strip() == agent_id and bool(item.get("has_final_status"))
    ]
    task_rows.sort(
        key=lambda item: parse_iso8601(str(item.get("last_event_at") or "")) or dt.datetime.min.replace(tzinfo=dt.timezone.utc),
        reverse=True,
    )

    telemetry_agent = None
    for entry in (summary.get("agents") or []):
        if str(entry.get("agent_id") or "").strip() == agent_id:
            telemetry_agent = entry
            break

    metrics = {
        "verification_pass_rate": telemetry_agent.get("verification_pass_rate") if telemetry_agent else None,
        "lesson_capture_rate": telemetry_agent.get("lesson_capture_rate") if telemetry_agent else None,
        "review_error_rate": telemetry_agent.get("review_error_rate") if telemetry_agent else None,
        "recommendation_action_rate": telemetry_agent.get("recommendation_action_rate") if telemetry_agent else None,
        "replan_rate": telemetry_agent.get("replan_rate") if telemetry_agent else None,
        "decision_time_avg_ms": telemetry_agent.get("decision_time_avg_ms") if telemetry_agent else None,
    }

    metric_meta = {
        "verification_pass_rate": {
            "label": "Успех верификации",
            "description": "Какая доля verify-запусков завершилась успешно.",
            "formula": "verify_passed / verify_started * 100",
            "source": "artifacts/agent_telemetry_summary.json -> agents[].status_counts",
        },
        "lesson_capture_rate": {
            "label": "Фиксация уроков",
            "description": "Насколько стабильно после verify фиксируются уроки self-improvement.",
            "formula": "lesson_captured / (verify_passed + verify_failed) * 100",
            "source": "artifacts/agent_telemetry_summary.json -> agents[].status_counts",
        },
        "review_error_rate": {
            "label": "Доля review-ошибок",
            "description": "Сколько review-ошибок приходится на одну завершенную задачу.",
            "formula": "review_errors_total / completed_tasks",
            "source": "artifacts/agent_telemetry_summary.json -> agents[]",
        },
        "recommendation_action_rate": {
            "label": "Реализация рекомендаций",
            "description": "Какой процент предложенных рекомендаций дошел до применения.",
            "formula": "recommendations_applied / recommendations_suggested * 100",
            "source": "artifacts/agent_telemetry_summary.json -> agents[]",
        },
        "replan_rate": {
            "label": "Частота перепланирования",
            "description": "Как часто агент пересматривает план внутри одного цикла.",
            "formula": "replanned / planned * 100",
            "source": "artifacts/agent_telemetry_summary.json -> agents[].status_counts",
        },
        "decision_time_avg_ms": {
            "label": "Среднее время решения",
            "description": "Среднее время принятия решения о выборе улучшения (от формирования списка до приоритизации).",
            "formula": "avg(decision_time_ms) по всем событиям с metrics.decision_time_ms",
            "source": ".logs/agents/analyst-agent.jsonl -> events[].metrics.decision_time_ms",
        },
        "time_to_solution_min": {
            "label": "Время цикла (мин)",
            "description": "Длительность последнего завершённого цикла от started до completed.",
            "formula": "completed_at - started_at (минуты)",
            "source": ".logs/agents/analyst-agent.jsonl -> latest cycle events",
        },
    }

    base_payload: dict[str, Any] = {
        "generated_at": utc_now_iso(),
        "version": LATEST_CYCLE_ANALYST_VERSION,
        "agent_id": agent_id,
        "available": False,
        "source": {
            "summary_path": "artifacts/agent_telemetry_summary.json",
            "cycle_report_path": "artifacts/agent_cycle_validation_report.json",
            "log_dir": ".logs/agents",
        },
        "metrics": metrics,
        "metric_meta": metric_meta,
        "latest_cycle": None,
        "timeline": [],
        "file_trace": {
            "edges": [],
            "fallback_used": False,
        },
    }

    if not task_rows:
        return base_payload

    latest = task_rows[0]
    latest_task_id = str(latest.get("task_id") or "").strip()
    if not latest_task_id:
        return base_payload

    cycle_events = [
        event
        for event in events
        if str(event.get("agent_id") or "").strip() == agent_id
        and str(event.get("task_id") or "").strip() == latest_task_id
    ]
    ordered_events = sort_cycle_events(cycle_events)

    # Compute time_to_solution_min: from first started/planned to last completed/failed/review_passed
    _cycle_start_ts: dt.datetime | None = None
    _cycle_end_ts: dt.datetime | None = None
    for _ev in ordered_events:
        _ev_status = normalize_status(_ev.get("status"))
        _ev_ts = parse_iso8601(str(_ev.get("timestamp") or ""))
        if _ev_ts is None:
            continue
        if _ev_status in {"started", "planned"} and _cycle_start_ts is None:
            _cycle_start_ts = _ev_ts
        if _ev_status in {"completed", "failed", "review_passed"}:
            _cycle_end_ts = _ev_ts
    time_to_solution_min: float | None = None
    if _cycle_start_ts is not None and _cycle_end_ts is not None and _cycle_end_ts > _cycle_start_ts:
        time_to_solution_min = round((_cycle_end_ts - _cycle_start_ts).total_seconds() / 60, 1)
    metrics["time_to_solution_min"] = time_to_solution_min

    timeline: list[dict[str, Any]] = []
    file_edges: list[dict[str, Any]] = []
    fallback_used = False

    for event in ordered_events:
        step = str(event.get("step") or "").strip()
        status = normalize_status(event.get("status"))
        read_paths = normalize_artifact_list(event.get("artifacts_read"))
        write_paths = normalize_artifact_list(event.get("artifacts_written"))
        source_read = "telemetry"
        source_write = "telemetry"
        if not read_paths and not write_paths:
            fallback = resolve_step_fallback_artifacts(step, status)
            if fallback.get("read") or fallback.get("write"):
                read_paths = list(fallback.get("read", []))
                write_paths = list(fallback.get("write", []))
                source_read = "fallback"
                source_write = "fallback"
                fallback_used = True

        timeline.append(
            {
                "timestamp": coerce_timestamp(event.get("timestamp")),
                "step": step,
                "status": status,
                "run_id": str(event.get("run_id") or "").strip(),
                "trace_id": str(event.get("trace_id") or "").strip(),
                "recommendation_id": str(event.get("recommendation_id") or "").strip(),
                "outcome": str(event.get("outcome") or "").strip(),
                "artifacts_read": read_paths,
                "artifacts_written": write_paths,
                "artifacts_source": "fallback" if source_read == "fallback" or source_write == "fallback" else "telemetry",
            }
        )

        for path_value in read_paths:
            file_edges.append(
                {
                    "step": step,
                    "kind": "read",
                    "path": path_value,
                    "source": source_read,
                }
            )
        for path_value in write_paths:
            file_edges.append(
                {
                    "step": step,
                    "kind": "write",
                    "path": path_value,
                    "source": source_write,
                }
            )

    base_payload["available"] = True
    base_payload["latest_cycle"] = {
        "task_id": latest_task_id,
        "first_event_at": latest.get("first_event_at"),
        "last_event_at": latest.get("last_event_at"),
        "latest_final_status": latest.get("latest_final_status"),
        "final_scope": latest.get("final_scope"),
        "events_total": latest.get("events_total"),
    }
    base_payload["timeline"] = timeline
    base_payload["file_trace"] = {
        "edges": file_edges,
        "fallback_used": fallback_used,
    }
    return base_payload


def append_event(log_dir: Path, event: dict[str, Any]) -> Path:
    log_dir.mkdir(parents=True, exist_ok=True)
    target = log_dir / f"{event['agent_id']}.jsonl"
    with target.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False))
        handle.write("\n")
    return target


def read_events(log_dir: Path) -> tuple[list[dict[str, Any]], int]:
    if not log_dir.exists():
        return [], 0
    events: list[dict[str, Any]] = []
    invalid_lines = 0
    for file in sorted(log_dir.glob("*.jsonl")):
        with file.open("r", encoding="utf-8") as handle:
            for line in handle:
                raw = line.strip()
                if not raw:
                    continue
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    invalid_lines += 1
                    continue
                if not isinstance(payload, dict):
                    invalid_lines += 1
                    continue
                if not payload.get("agent_id"):
                    payload["agent_id"] = file.stem
                events.append(payload)
    return events, invalid_lines


def coerce_timestamp(value: Any) -> str | None:
    parsed = parse_iso8601(str(value)) if value is not None else None
    return parsed.isoformat().replace("+00:00", "Z") if parsed else None


def normalize_status(value: Any) -> str:
    return str(value or "").strip().lower()


def find_last_status_before(statuses: list[str], accepted: set[str], end_index: int) -> int | None:
    index = min(end_index - 1, len(statuses) - 1)
    while index >= 0:
        if statuses[index] in accepted:
            return index
        index -= 1
    return None


def find_last_status_between(statuses: list[str], accepted: set[str], start_index: int, end_index: int) -> int | None:
    index = min(end_index - 1, len(statuses) - 1)
    while index >= start_index and index >= 0:
        if statuses[index] in accepted:
            return index
        index -= 1
    return None


def sort_cycle_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    indexed = list(enumerate(events))

    def sort_key(pair: tuple[int, dict[str, Any]]) -> tuple[int, dt.datetime, int]:
        index, event = pair
        parsed = parse_iso8601(str(event.get("timestamp") or ""))
        if parsed is None:
            return (1, dt.datetime.min.replace(tzinfo=dt.timezone.utc), index)
        return (0, parsed, index)

    indexed.sort(key=sort_key)
    return [event for _, event in indexed]


def validate_cycle_sequence(
    agent_id: str,
    task_id: str,
    events: list[dict[str, Any]],
    *,
    final_scope: str = "latest",
) -> dict[str, Any]:
    ordered_events = sort_cycle_events(events)
    statuses = [normalize_status(event.get("status")) for event in ordered_events]
    first_timestamp = coerce_timestamp(ordered_events[0].get("timestamp")) if ordered_events else None
    last_timestamp = coerce_timestamp(ordered_events[-1].get("timestamp")) if ordered_events else None
    final_indices_all = [index for index, status in enumerate(statuses) if status in CYCLE_FINAL_STATUSES]
    if final_scope not in FINAL_SCOPES:
        final_scope = "latest"
    if final_scope == "latest" and final_indices_all:
        final_indices = [final_indices_all[-1]]
    else:
        final_indices = list(final_indices_all)

    violations: list[dict[str, Any]] = []
    seen_codes: set[tuple[str, int]] = set()

    def add_violation(code: str, message: str, final_index: int, final_status: str) -> None:
        signature = (code, final_index)
        if signature in seen_codes:
            return
        seen_codes.add(signature)
        violations.append(
            {
                "code": code,
                "message": message,
                "final_status": final_status,
                "final_index": final_index,
            }
        )

    for final_index in final_indices:
        final_status = statuses[final_index]
        start_index = find_last_status_before(statuses, CYCLE_START_STATUSES, final_index)
        if start_index is None:
            add_violation(
                "missing_start_before_final",
                "final status recorded without planned|started before completion",
                final_index,
                final_status,
            )

        verify_started_index = find_last_status_before(statuses, {CYCLE_VERIFY_START_STATUS}, final_index)
        if verify_started_index is None:
            add_violation(
                "missing_verify_started_before_final",
                "final status recorded without verify_started before completion",
                final_index,
                final_status,
            )
            continue

        verify_result_index = find_last_status_between(
            statuses,
            CYCLE_VERIFY_RESULT_STATUSES,
            verify_started_index + 1,
            final_index,
        )
        if verify_result_index is None:
            add_violation(
                "missing_verify_result_before_final",
                "final status recorded without verify_passed|verify_failed after verify_started",
                final_index,
                final_status,
            )
            continue

        lesson_index = find_last_status_between(
            statuses,
            CYCLE_LESSON_STATUSES,
            verify_result_index + 1,
            final_index,
        )
        if lesson_index is None:
            add_violation(
                "missing_lesson_before_final",
                "final status recorded without lesson_captured|lesson_not_applicable after verify result",
                final_index,
                final_status,
            )

    correction_indices = [index for index, status in enumerate(statuses) if status in USER_CORRECTION_STATUSES]
    for correction_index in correction_indices:
        lesson_index = find_last_status_between(
            statuses,
            {"lesson_captured"},
            correction_index + 1,
            len(statuses),
        )
        if lesson_index is None:
            correction_status = statuses[correction_index]
            add_violation(
                "missing_lesson_after_user_correction",
                f"status={correction_status} requires lesson_captured with root cause and preventive rule",
                correction_index,
                correction_status,
            )

    return {
        "agent_id": agent_id,
        "task_id": task_id,
        "events_total": len(ordered_events),
        "first_event_at": first_timestamp,
        "last_event_at": last_timestamp,
        "statuses": statuses,
        "has_final_status": len(final_indices_all) > 0,
        "final_scope": final_scope,
        "finals_total": len(final_indices_all),
        "finals_considered": len(final_indices),
        "latest_final_status": statuses[final_indices_all[-1]] if final_indices_all else None,
        "violations": violations,
    }


def build_cycle_validation_report(
    events: list[dict[str, Any]],
    *,
    invalid_lines: int,
    log_dir: Path,
    mode: str,
    final_scope: str = "latest",
    agent_id: str | None = None,
    task_id: str | None = None,
) -> dict[str, Any]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for event in events:
        event_agent = str(event.get("agent_id") or "").strip()
        event_task = str(event.get("task_id") or "").strip()
        if not event_agent or not event_task:
            continue
        if agent_id and event_agent != agent_id:
            continue
        if task_id and event_task != task_id:
            continue
        grouped[(event_agent, event_task)].append(event)

    task_reports: list[dict[str, Any]] = []
    violations_flat: list[dict[str, Any]] = []
    tasks_with_final_status = 0

    for agent_task in sorted(grouped.keys()):
        event_agent, event_task = agent_task
        task_report = validate_cycle_sequence(event_agent, event_task, grouped[agent_task], final_scope=final_scope)
        task_reports.append(task_report)
        if task_report["has_final_status"]:
            tasks_with_final_status += 1
        for violation in task_report["violations"]:
            violations_flat.append(
                {
                    "agent_id": event_agent,
                    "task_id": event_task,
                    **violation,
                }
            )

    return {
        "generated_at": utc_now_iso(),
        "version": CYCLE_REPORT_VERSION,
        "mode": mode,
        "final_scope": final_scope,
        "log_dir": str(log_dir),
        "filters": {
            "agent_id": agent_id,
            "task_id": task_id,
        },
        "totals": {
            "tasks_checked": len(task_reports),
            "tasks_with_final_status": tasks_with_final_status,
            "tasks_with_violations": sum(1 for task in task_reports if task["violations"]),
            "violations_total": len(violations_flat),
            "invalid_lines": invalid_lines,
        },
        "tasks": task_reports,
        "violations": violations_flat,
    }


def summarize(events: list[dict[str, Any]], invalid_lines: int, log_dir: Path) -> dict[str, Any]:
    by_agent: dict[str, dict[str, Any]] = {}
    total_recommendations_suggested: set[str] = set()
    total_recommendations_applied: set[str] = set()

    for event in events:
        agent_id = str(event.get("agent_id") or "unknown").strip() or "unknown"
        item = by_agent.setdefault(
            agent_id,
            {
                "agent_id": agent_id,
                "events_total": 0,
                "_tasks": set(),
                "_completed_tasks": set(),
                "_failed_tasks": set(),
                "_durations": [],
                "_recommendations_suggested": set(),
                "_recommendations_applied": set(),
                "_plan_signal_tasks": set(),
                "review_errors_total": 0,
                "tokens_in_total": 0,
                "tokens_out_total": 0,
                "trace_linked_events": 0,
                "run_linked_events": 0,
                "status_counts": Counter(),
                "mcp_usage": Counter(),
                "_first_ts": None,
                "_last_ts": None,
                "n_candidates_total": 0,
                "n_selected_total": 0,
                "n_decisions": 0,
                "_decision_times": [],
                "ab_guardrail_breached_count": 0,
                "ab_sessions_required": None,
                "_ab_target_deltas": [],
                "_ab_checkpoint_counts_by_task": Counter(),
            },
        )

        item["events_total"] += 1
        status = str(event.get("status") or "").strip()
        step = str(event.get("step") or "").strip().lower()
        if status:
            item["status_counts"][status] += 1

        task_id = str(event.get("task_id") or "").strip()
        if task_id:
            item["_tasks"].add(task_id)

        outcome = str(event.get("outcome") or "").strip().lower()
        if task_id and (status in {"completed", "review_passed"} or outcome == "success"):
            item["_completed_tasks"].add(task_id)
        if task_id and (status in {"failed", "step_error", "review_failed"} or outcome == "failed"):
            item["_failed_tasks"].add(task_id)
        if task_id and (
            status in {"planned", "replanned"}
            or (status == "started" and step.startswith("plan"))
        ):
            item["_plan_signal_tasks"].add(task_id)

        metrics = event.get("metrics") if isinstance(event.get("metrics"), dict) else {}
        review_errors = as_int(metrics.get("review_errors"))
        if review_errors is None:
            review_errors = as_int(event.get("review_errors"))
        if review_errors is not None:
            item["review_errors_total"] += review_errors

        duration_ms = as_float(metrics.get("duration_ms"))
        if duration_ms is None:
            duration_ms = as_float(event.get("duration_ms"))
        if duration_ms is not None:
            item["_durations"].append(duration_ms)

        tokens_in = as_int(metrics.get("tokens_in"))
        if tokens_in is None:
            tokens_in = as_int(event.get("tokens_in"))
        if tokens_in is not None:
            item["tokens_in_total"] += tokens_in

        tokens_out = as_int(metrics.get("tokens_out"))
        if tokens_out is None:
            tokens_out = as_int(event.get("tokens_out"))
        if tokens_out is not None:
            item["tokens_out_total"] += tokens_out

        if str(event.get("trace_id") or "").strip():
            item["trace_linked_events"] += 1
        if str(event.get("run_id") or "").strip():
            item["run_linked_events"] += 1

        mcp_tools = event.get("mcp_tools")
        if isinstance(mcp_tools, str):
            mcp_tools = [mcp_tools]
        if isinstance(mcp_tools, list):
            for tool in mcp_tools:
                name = str(tool).strip()
                if name:
                    item["mcp_usage"][name] += 1

        recommendation_id = str(event.get("recommendation_id") or "").strip()
        if recommendation_id:
            if status == "recommendation_suggested":
                item["_recommendations_suggested"].add(recommendation_id)
                total_recommendations_suggested.add(f"{agent_id}:{recommendation_id}")
            if status == "recommendation_applied":
                item["_recommendations_applied"].add(recommendation_id)
                total_recommendations_applied.add(f"{agent_id}:{recommendation_id}")

        n_candidates = as_int(metrics.get("n_candidates"))
        if n_candidates is not None:
            item["n_candidates_total"] += n_candidates
            item["n_decisions"] += 1

        n_selected = as_int(metrics.get("n_selected"))
        if n_selected is not None:
            item["n_selected_total"] += n_selected

        decision_time_ms = as_float(metrics.get("decision_time_ms"))
        if decision_time_ms is not None:
            item["_decision_times"].append(decision_time_ms)

        if status == "ab_test_checkpoint":
            guardrail_breached = parse_bool(metrics.get("guardrail_breached"))
            if guardrail_breached is True:
                item["ab_guardrail_breached_count"] += 1

            target_delta_pct = as_float(metrics.get("target_delta_pct"))
            if target_delta_pct is not None:
                item["_ab_target_deltas"].append(target_delta_pct)

            ab_sessions_required = as_int(metrics.get("ab_sessions_required"))
            if ab_sessions_required is not None:
                previous_required = as_int(item.get("ab_sessions_required"))
                if previous_required is None:
                    item["ab_sessions_required"] = ab_sessions_required
                else:
                    item["ab_sessions_required"] = max(previous_required, ab_sessions_required)

            if task_id:
                item["_ab_checkpoint_counts_by_task"][task_id] += 1

        ts = coerce_timestamp(event.get("timestamp"))
        if ts:
            if item["_first_ts"] is None or ts < item["_first_ts"]:
                item["_first_ts"] = ts
            if item["_last_ts"] is None or ts > item["_last_ts"]:
                item["_last_ts"] = ts

    agents = []
    total_events = 0
    total_tasks = 0
    total_review_errors = 0
    total_trace_linked = 0

    for agent_id in sorted(by_agent.keys()):
        item = by_agent[agent_id]
        events_total = int(item["events_total"])
        tasks_total = len(item["_tasks"])
        completed_total = len(item["_completed_tasks"])
        failed_total = len(item["_failed_tasks"])
        rec_suggested = item["_recommendations_suggested"]
        rec_applied = item["_recommendations_applied"]
        matched_recommendations = rec_applied.intersection(rec_suggested)

        recommendation_action_rate = None
        if rec_suggested:
            recommendation_action_rate = round((len(matched_recommendations) / len(rec_suggested)) * 100, 2)

        review_error_rate = None
        if completed_total > 0:
            review_error_rate = round(item["review_errors_total"] / completed_total, 4)

        trace_coverage_pct = round((item["trace_linked_events"] / events_total) * 100, 2) if events_total > 0 else 0.0
        run_coverage_pct = round((item["run_linked_events"] / events_total) * 100, 2) if events_total > 0 else 0.0

        status_counts = item["status_counts"]
        planned_count = int(status_counts.get("planned", 0))
        replanned_count = int(status_counts.get("replanned", 0))
        verify_started_count = int(status_counts.get("verify_started", 0))
        verify_passed_count = int(status_counts.get("verify_passed", 0))
        verify_failed_count = int(status_counts.get("verify_failed", 0))
        lesson_captured_count = int(status_counts.get("lesson_captured", 0))
        bugfix_autonomous_count = int(status_counts.get("bugfix_autonomous", 0))
        elegance_checked_count = int(status_counts.get("elegance_checked", 0))
        ab_test_started_count = int(status_counts.get("ab_test_started", 0))
        ab_test_checkpoint_count = int(status_counts.get("ab_test_checkpoint", 0))
        ab_test_passed_count = int(status_counts.get("ab_test_passed", 0))
        ab_test_failed_count = int(status_counts.get("ab_test_failed", 0))
        rollback_applied_count = int(status_counts.get("rollback_applied", 0))

        plan_signal_tasks = len(item["_plan_signal_tasks"])
        plan_coverage_rate = round((plan_signal_tasks / tasks_total) * 100, 2) if tasks_total > 0 else None
        verification_pass_rate = (
            round((verify_passed_count / verify_started_count) * 100, 2)
            if verify_started_count > 0
            else None
        )
        lesson_capture_rate_den = verify_passed_count + verify_failed_count
        lesson_capture_rate = (
            round((lesson_captured_count / lesson_capture_rate_den) * 100, 2)
            if lesson_capture_rate_den > 0
            else None
        )
        replan_rate = round((replanned_count / planned_count) * 100, 2) if planned_count > 0 else None
        autonomous_bugfix_rate = round((bugfix_autonomous_count / tasks_total) * 100, 2) if tasks_total > 0 else None
        elegance_gate_rate = round((elegance_checked_count / planned_count) * 100, 2) if planned_count > 0 else None
        ab_pass_rate = (
            round((ab_test_passed_count / ab_test_started_count) * 100, 2)
            if ab_test_started_count > 0
            else None
        )
        rollback_rate = (
            round((rollback_applied_count / ab_test_failed_count) * 100, 2)
            if ab_test_failed_count > 0
            else None
        )
        ab_guardrail_breach_rate = (
            round((item["ab_guardrail_breached_count"] / ab_test_checkpoint_count) * 100, 2)
            if ab_test_checkpoint_count > 0
            else None
        )
        ab_sessions_required_value = as_int(item.get("ab_sessions_required"))
        ab_sessions_progress_rate = (
            round((ab_test_checkpoint_count / ab_sessions_required_value) * 100, 2)
            if ab_sessions_required_value and ab_sessions_required_value > 0
            else None
        )
        ab_target_delta_p50 = median(item["_ab_target_deltas"])

        agents.append(
            {
                "agent_id": agent_id,
                "events_total": events_total,
                "tasks_total": tasks_total,
                "completed_tasks": completed_total,
                "failed_tasks": failed_total,
                "review_errors_total": item["review_errors_total"],
                "review_error_rate": review_error_rate,
                "tokens_in_total": item["tokens_in_total"],
                "tokens_out_total": item["tokens_out_total"],
                "p95_duration_ms": percentile(item["_durations"], 95.0),
                "trace_coverage_pct": trace_coverage_pct,
                "run_coverage_pct": run_coverage_pct,
                "recommendations_suggested": len(rec_suggested),
                "recommendations_applied": len(rec_applied),
                "recommendation_action_rate": recommendation_action_rate,
                "plan_coverage_rate": plan_coverage_rate,
                "verification_pass_rate": verification_pass_rate,
                "lesson_capture_rate": lesson_capture_rate,
                "replan_rate": replan_rate,
                "autonomous_bugfix_rate": autonomous_bugfix_rate,
                "elegance_gate_rate": elegance_gate_rate,
                "ab_test_started_count": ab_test_started_count,
                "ab_test_checkpoint_count": ab_test_checkpoint_count,
                "ab_test_passed_count": ab_test_passed_count,
                "ab_test_failed_count": ab_test_failed_count,
                "rollback_applied_count": rollback_applied_count,
                "ab_pass_rate": ab_pass_rate,
                "rollback_rate": rollback_rate,
                "ab_guardrail_breached_count": item["ab_guardrail_breached_count"],
                "ab_guardrail_breach_rate": ab_guardrail_breach_rate,
                "ab_sessions_required": ab_sessions_required_value,
                "ab_sessions_progress_rate": ab_sessions_progress_rate,
                "ab_target_delta_p50": ab_target_delta_p50,
                "plan_signal_tasks": plan_signal_tasks,
                "mcp_usage": [
                    {"name": name, "events": count}
                    for name, count in sorted(item["mcp_usage"].items(), key=lambda pair: (-pair[1], pair[0]))
                ],
                "status_counts": dict(status_counts),
                "first_event_at": item["_first_ts"],
                "last_event_at": item["_last_ts"],
                "n_decisions": item["n_decisions"],
                "n_candidates_total": item["n_candidates_total"],
                "n_selected_total": item["n_selected_total"],
                "decision_time_avg_ms": round(sum(item["_decision_times"]) / len(item["_decision_times"]), 1) if item["_decision_times"] else None,
            }
        )

        total_events += events_total
        total_tasks += tasks_total
        total_review_errors += int(item["review_errors_total"])
        total_trace_linked += int(item["trace_linked_events"])

    total_recommendation_action_rate = None
    if total_recommendations_suggested:
        total_recommendation_action_rate = round(
            (len(total_recommendations_applied.intersection(total_recommendations_suggested)) / len(total_recommendations_suggested)) * 100,
            2,
        )

    total_planned = 0
    total_replanned = 0
    total_verify_started = 0
    total_verify_passed = 0
    total_verify_failed = 0
    total_lesson_captured = 0
    total_bugfix_autonomous = 0
    total_elegance_checked = 0
    total_plan_signal_tasks = 0
    total_ab_test_started = 0
    total_ab_test_checkpoint = 0
    total_ab_test_passed = 0
    total_ab_test_failed = 0
    total_rollback_applied = 0
    total_ab_guardrail_breached_count = 0
    total_ab_sessions_required = 0
    for agent in agents:
        status_counts = agent.get("status_counts", {})
        total_plan_signal_tasks += int(agent.get("plan_signal_tasks", 0))
        total_planned += int(status_counts.get("planned", 0))
        total_replanned += int(status_counts.get("replanned", 0))
        total_verify_started += int(status_counts.get("verify_started", 0))
        total_verify_passed += int(status_counts.get("verify_passed", 0))
        total_verify_failed += int(status_counts.get("verify_failed", 0))
        total_lesson_captured += int(status_counts.get("lesson_captured", 0))
        total_bugfix_autonomous += int(status_counts.get("bugfix_autonomous", 0))
        total_elegance_checked += int(status_counts.get("elegance_checked", 0))
        total_ab_test_started += int(status_counts.get("ab_test_started", 0))
        total_ab_test_checkpoint += int(status_counts.get("ab_test_checkpoint", 0))
        total_ab_test_passed += int(status_counts.get("ab_test_passed", 0))
        total_ab_test_failed += int(status_counts.get("ab_test_failed", 0))
        total_rollback_applied += int(status_counts.get("rollback_applied", 0))
        total_ab_guardrail_breached_count += int(agent.get("ab_guardrail_breached_count", 0))
        total_ab_sessions_required += int(agent.get("ab_sessions_required") or 0)

    total_plan_coverage_rate = round((total_plan_signal_tasks / total_tasks) * 100, 2) if total_tasks > 0 else None
    total_verification_pass_rate = (
        round((total_verify_passed / total_verify_started) * 100, 2) if total_verify_started > 0 else None
    )
    total_lesson_capture_rate_den = total_verify_passed + total_verify_failed
    total_lesson_capture_rate = (
        round((total_lesson_captured / total_lesson_capture_rate_den) * 100, 2) if total_lesson_capture_rate_den > 0 else None
    )
    total_replan_rate = round((total_replanned / total_planned) * 100, 2) if total_planned > 0 else None
    total_autonomous_bugfix_rate = round((total_bugfix_autonomous / total_tasks) * 100, 2) if total_tasks > 0 else None
    total_elegance_gate_rate = round((total_elegance_checked / total_planned) * 100, 2) if total_planned > 0 else None
    total_ab_pass_rate = (
        round((total_ab_test_passed / total_ab_test_started) * 100, 2)
        if total_ab_test_started > 0
        else None
    )
    total_rollback_rate = (
        round((total_rollback_applied / total_ab_test_failed) * 100, 2)
        if total_ab_test_failed > 0
        else None
    )
    total_ab_guardrail_breach_rate = (
        round((total_ab_guardrail_breached_count / total_ab_test_checkpoint) * 100, 2)
        if total_ab_test_checkpoint > 0
        else None
    )
    total_ab_sessions_progress_rate = (
        round((total_ab_test_checkpoint / total_ab_sessions_required) * 100, 2)
        if total_ab_sessions_required > 0
        else None
    )

    return {
        "generated_at": utc_now_iso(),
        "version": REPORT_VERSION,
        "log_dir": str(log_dir),
        "totals": {
            "agents_total": len(agents),
            "events_total": total_events,
            "tasks_total": total_tasks,
            "review_errors_total": total_review_errors,
            "trace_coverage_pct": round((total_trace_linked / total_events) * 100, 2) if total_events > 0 else 0.0,
            "recommendations_suggested": len(total_recommendations_suggested),
            "recommendations_applied": len(total_recommendations_applied),
            "recommendation_action_rate": total_recommendation_action_rate,
            "plan_coverage_rate": total_plan_coverage_rate,
            "verification_pass_rate": total_verification_pass_rate,
            "lesson_capture_rate": total_lesson_capture_rate,
            "replan_rate": total_replan_rate,
            "autonomous_bugfix_rate": total_autonomous_bugfix_rate,
            "elegance_gate_rate": total_elegance_gate_rate,
            "ab_test_started_count": total_ab_test_started,
            "ab_test_checkpoint_count": total_ab_test_checkpoint,
            "ab_test_passed_count": total_ab_test_passed,
            "ab_test_failed_count": total_ab_test_failed,
            "rollback_applied_count": total_rollback_applied,
            "ab_pass_rate": total_ab_pass_rate,
            "rollback_rate": total_rollback_rate,
            "ab_guardrail_breached_count": total_ab_guardrail_breached_count,
            "ab_guardrail_breach_rate": total_ab_guardrail_breach_rate,
            "ab_sessions_required": total_ab_sessions_required if total_ab_sessions_required > 0 else None,
            "ab_sessions_progress_rate": total_ab_sessions_progress_rate,
            "invalid_lines": invalid_lines,
        },
        "agents": agents,
    }


def parse_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "y"}:
            return True
        if lowered in {"false", "0", "no", "n"}:
            return False
    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value == 0:
            return False
    return None


def safe_ratio(numerator: float, denominator: float) -> float | None:
    if denominator <= 0:
        return None
    return numerator / denominator


def median(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    middle = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2.0


def validate_benchmark_case(case: dict[str, Any]) -> tuple[bool, str]:
    required = [
        "case_id",
        "agent_id",
        "case_source",
        "difficulty",
        "input_payload",
        "expected_facts",
        "critical_must_not",
        "judge_rubric_version",
        "owner",
        "last_validated_at",
    ]
    missing = [field for field in required if field not in case]
    if missing:
        return False, f"missing_fields:{','.join(missing)}"
    case_source = str(case.get("case_source") or "").strip()
    if case_source not in {"prod", "feedback", "synthetic"}:
        return False, f"invalid_case_source:{case_source or 'empty'}"
    difficulty = str(case.get("difficulty") or "").strip()
    if difficulty not in {"easy", "mid", "hard"}:
        return False, f"invalid_difficulty:{difficulty or 'empty'}"
    expected_facts = case.get("expected_facts")
    if not isinstance(expected_facts, list) or len(expected_facts) == 0:
        return False, "expected_facts_must_be_non_empty_list"
    critical_must_not = case.get("critical_must_not")
    if not isinstance(critical_must_not, list):
        return False, "critical_must_not_must_be_list"
    return True, "ok"


def load_json_file(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def load_benchmark_summary(path: Path) -> dict[str, Any] | None:
    payload = load_json_file(path)
    if not payload:
        return None
    if str(payload.get("version") or "").strip() != BENCHMARK_SUMMARY_VERSION:
        return None
    return payload


def build_benchmark_summary(
    *,
    dataset: dict[str, Any],
    run_payload: dict[str, Any],
    telemetry_summary: dict[str, Any] | None,
    source_paths: dict[str, str],
    gate_mode: str,
) -> dict[str, Any]:
    dataset_cases = dataset.get("cases") if isinstance(dataset.get("cases"), list) else []
    valid_case_count = 0
    invalid_case_count = 0
    invalid_case_reasons: list[str] = []
    dataset_agent_id = str(dataset.get("agent_id") or "").strip() or "analyst-agent"
    dataset_case_ids: set[str] = set()
    for case in dataset_cases:
        if not isinstance(case, dict):
            invalid_case_count += 1
            invalid_case_reasons.append("invalid_case:not_object")
            continue
        is_valid, reason = validate_benchmark_case(case)
        if not is_valid:
            invalid_case_count += 1
            invalid_case_reasons.append(f"{case.get('case_id') or 'unknown'}:{reason}")
            continue
        valid_case_count += 1
        dataset_case_ids.add(str(case.get("case_id") or "").strip())

    run_agent_id = str(run_payload.get("agent_id") or "").strip() or dataset_agent_id
    cases = run_payload.get("cases") if isinstance(run_payload.get("cases"), list) else []
    target_k = as_int(run_payload.get("target_k")) or 5
    thresholds = dict(BENCHMARK_THRESHOLD_DEFAULTS)
    custom_thresholds = run_payload.get("thresholds") if isinstance(run_payload.get("thresholds"), dict) else {}
    for key, value in custom_thresholds.items():
        parsed = as_float(value)
        if parsed is not None and key in thresholds:
            thresholds[key] = parsed

    cases_total = len(dataset_case_ids) if dataset_case_ids else valid_case_count
    cases_with_results = 0
    successful_cases = 0
    attempts_total = 0
    schema_valid_attempts = 0
    trajectory_ok_attempts = 0
    fact_coverage_values: list[float] = []
    pass_rates_by_case: list[float] = []
    all_costs: list[float] = []
    all_latency: list[float] = []
    human_checked = 0
    human_disagreed = 0

    for case in cases:
        if not isinstance(case, dict):
            continue
        case_id = str(case.get("case_id") or "").strip()
        if dataset_case_ids and case_id and case_id not in dataset_case_ids:
            continue
        attempts = case.get("attempts") if isinstance(case.get("attempts"), list) else []
        if not attempts:
            continue
        cases_with_results += 1
        case_passed = False
        case_pass_count = 0
        for attempt in attempts:
            if not isinstance(attempt, dict):
                continue
            attempts_total += 1
            passed = parse_bool(attempt.get("passed"))
            critical_violation = parse_bool(attempt.get("critical_violation")) is True
            if passed is True and not critical_violation:
                case_passed = True
                case_pass_count += 1

            schema_valid = parse_bool(attempt.get("schema_valid"))
            if schema_valid is True:
                schema_valid_attempts += 1

            trajectory = parse_bool(attempt.get("trajectory_compliant"))
            if trajectory is True:
                trajectory_ok_attempts += 1

            fact_coverage = as_float(attempt.get("fact_coverage"))
            if fact_coverage is not None:
                fact_coverage_values.append(min(max(fact_coverage, 0.0), 1.0))

            latency = as_float(attempt.get("latency_ms"))
            if latency is not None:
                all_latency.append(latency)

            cost = as_float(attempt.get("cost_usd"))
            if cost is not None:
                all_costs.append(cost)

        if case_passed:
            successful_cases += 1
        pass_rate = safe_ratio(case_pass_count, max(len(attempts), 1))
        if pass_rate is not None:
            pass_rates_by_case.append(pass_rate)

        human_validation = case.get("human_validation") if isinstance(case.get("human_validation"), dict) else {}
        checked = parse_bool(human_validation.get("checked"))
        agreed = parse_bool(human_validation.get("judge_agreed"))
        if checked is True:
            human_checked += 1
            if agreed is False:
                human_disagreed += 1

    pass_at_5 = safe_ratio(successful_cases, cases_total or 1)
    fact_coverage_mean = safe_ratio(sum(fact_coverage_values), len(fact_coverage_values))
    schema_valid_rate = safe_ratio(schema_valid_attempts, attempts_total)
    trajectory_compliance_rate = safe_ratio(trajectory_ok_attempts, attempts_total)
    judge_disagreement_rate = safe_ratio(human_disagreed, human_checked)
    cost_total = sum(all_costs)
    cost_per_success = safe_ratio(cost_total, successful_cases)
    pass_rate_variance = None
    if pass_rates_by_case:
        mean_value = sum(pass_rates_by_case) / len(pass_rates_by_case)
        pass_rate_variance = sum((value - mean_value) ** 2 for value in pass_rates_by_case) / len(pass_rates_by_case)

    telemetry_recommendation_action_rate = None
    if telemetry_summary and isinstance(telemetry_summary.get("agents"), list):
        for entry in telemetry_summary.get("agents") or []:
            if str(entry.get("agent_id") or "").strip() != run_agent_id:
                continue
            telemetry_recommendation_action_rate = as_float(entry.get("recommendation_action_rate"))
            break

    impact = run_payload.get("impact") if isinstance(run_payload.get("impact"), dict) else {}
    recommendation_executability_rate = as_float(impact.get("recommendation_executability_rate"))
    evidence_link_coverage = as_float(impact.get("evidence_link_coverage"))
    validated_impact_rate = as_float(impact.get("validated_impact_rate"))
    time_to_action_values = impact.get("time_to_action_hours") if isinstance(impact.get("time_to_action_hours"), list) else []
    parsed_time_to_action = [as_float(value) for value in time_to_action_values]
    parsed_time_to_action = [value for value in parsed_time_to_action if value is not None]
    time_to_action_p50 = median(parsed_time_to_action)

    metric_values = {
        "pass_at_5": pass_at_5,
        "fact_coverage_mean": fact_coverage_mean,
        "schema_valid_rate": schema_valid_rate,
        "trajectory_compliance_rate": trajectory_compliance_rate,
        "judge_disagreement_rate": judge_disagreement_rate,
        "recommendation_action_rate": telemetry_recommendation_action_rate,
    }

    gate_results: list[dict[str, Any]] = []
    for key, threshold in thresholds.items():
        value = metric_values.get(key)
        if value is None:
            gate_results.append(
                {
                    "metric": key,
                    "status": "missing",
                    "value": None,
                    "threshold": threshold,
                    "direction": "max" if key == "judge_disagreement_rate" else "min",
                    "message": "metric value is missing",
                }
            )
            continue

        if key == "judge_disagreement_rate":
            ok = value <= threshold
            direction = "max"
        else:
            ok = value >= threshold
            direction = "min"
        gate_results.append(
            {
                "metric": key,
                "status": "pass" if ok else "fail",
                "value": round(value, 6),
                "threshold": threshold,
                "direction": direction,
                "message": "ok" if ok else "threshold not met",
            }
        )

    gate_failed = [item for item in gate_results if item["status"] == "fail"]
    gate_missing = [item for item in gate_results if item["status"] == "missing"]
    gate_status = "passed"
    if gate_failed:
        gate_status = "failed" if gate_mode == "strict" else "warning"
    elif gate_missing:
        gate_status = "warning"

    metrics = {
        "pass_at_5": pass_at_5,
        "fact_coverage_mean": fact_coverage_mean,
        "schema_valid_rate": schema_valid_rate,
        "trajectory_compliance_rate": trajectory_compliance_rate,
        "judge_disagreement_rate": judge_disagreement_rate,
        "cost_per_success": cost_per_success,
        "attempts_total": attempts_total,
        "cases_total": cases_total,
        "cases_with_results": cases_with_results,
        "successful_cases": successful_cases,
        "cost_total": cost_total,
        "latency_p95_ms": percentile(all_latency, 95.0),
        "pass_rate_variance": pass_rate_variance,
    }
    impact_metrics = {
        "recommendation_executability_rate": recommendation_executability_rate,
        "evidence_link_coverage": evidence_link_coverage,
        "time_to_action_p50": time_to_action_p50,
        "validated_impact_rate": validated_impact_rate,
    }

    return {
        "generated_at": utc_now_iso(),
        "version": BENCHMARK_SUMMARY_VERSION,
        "mode": gate_mode,
        "source": {
            "dataset_path": source_paths["dataset_path"],
            "run_path": source_paths["run_path"],
            "telemetry_summary_path": source_paths["telemetry_summary_path"],
        },
        "dataset": {
            "agent_id": dataset_agent_id,
            "cases_total": cases_total,
            "valid_cases": valid_case_count,
            "invalid_cases": invalid_case_count,
            "invalid_reasons": invalid_case_reasons[:30],
            "judge_rubric_version": str(dataset.get("judge_rubric_version") or "").strip() or None,
        },
        "run": {
            "run_id": str(run_payload.get("run_id") or "").strip() or f"bench-{utc_now_iso()}",
            "agent_id": run_agent_id,
            "target_k": target_k,
            "judge_model": str(run_payload.get("judge_model") or "").strip() or None,
            "judge_rubric_version": str(run_payload.get("judge_rubric_version") or "").strip() or None,
            "started_at": str(run_payload.get("started_at") or "").strip() or None,
            "finished_at": str(run_payload.get("finished_at") or "").strip() or None,
        },
        "thresholds": thresholds,
        "metrics": metrics,
        "impact_metrics": impact_metrics,
        "telemetry_metrics": {
            "recommendation_action_rate": telemetry_recommendation_action_rate,
        },
        "gate": {
            "status": gate_status,
            "failed_metrics": [item["metric"] for item in gate_failed],
            "missing_metrics": [item["metric"] for item in gate_missing],
            "results": gate_results,
        },
        "agents": [
            {
                "agent_id": run_agent_id,
                **metrics,
                **impact_metrics,
                "recommendation_action_rate": telemetry_recommendation_action_rate,
            }
        ],
    }


def append_benchmark_history(path: Path, summary: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    history_item = {
        "generated_at": summary.get("generated_at"),
        "version": summary.get("version"),
        "run_id": (summary.get("run") or {}).get("run_id"),
        "agent_id": (summary.get("run") or {}).get("agent_id"),
        "mode": summary.get("mode"),
        "metrics": summary.get("metrics"),
        "impact_metrics": summary.get("impact_metrics"),
        "telemetry_metrics": summary.get("telemetry_metrics"),
        "gate": summary.get("gate"),
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(history_item, ensure_ascii=False))
        handle.write("\n")


def render_markdown_report(summary: dict[str, Any]) -> str:
    benchmark_summary = summary.get("benchmark_summary") if isinstance(summary.get("benchmark_summary"), dict) else None
    lines = [
        "# Agent Telemetry Summary",
        "",
        f"- Generated at: {summary.get('generated_at', 'unknown')}",
        f"- Log dir: {summary.get('log_dir', 'unknown')}",
        f"- Events total: {summary.get('totals', {}).get('events_total', 0)}",
        f"- Trace coverage: {summary.get('totals', {}).get('trace_coverage_pct', 0)}%",
        f"- Recommendation action rate: {summary.get('totals', {}).get('recommendation_action_rate', 'unknown')}%",
        f"- Plan coverage rate: {summary.get('totals', {}).get('plan_coverage_rate', 'unknown')}%",
        f"- Verification pass rate: {summary.get('totals', {}).get('verification_pass_rate', 'unknown')}%",
        f"- Lesson capture rate: {summary.get('totals', {}).get('lesson_capture_rate', 'unknown')}%",
        f"- A/B pass rate: {summary.get('totals', {}).get('ab_pass_rate', 'unknown')}%",
        f"- A/B guardrail breach rate: {summary.get('totals', {}).get('ab_guardrail_breach_rate', 'unknown')}%",
        f"- A/B sessions progress rate: {summary.get('totals', {}).get('ab_sessions_progress_rate', 'unknown')}%",
    ]
    if benchmark_summary:
        benchmark_metrics = benchmark_summary.get("metrics") if isinstance(benchmark_summary.get("metrics"), dict) else {}
        benchmark_gate = benchmark_summary.get("gate") if isinstance(benchmark_summary.get("gate"), dict) else {}
        lines.extend(
            [
                f"- Benchmark gate status: {benchmark_gate.get('status', 'unknown')}",
                f"- Benchmark pass@5: {benchmark_metrics.get('pass_at_5', 'unknown')}",
                f"- Benchmark fact coverage mean: {benchmark_metrics.get('fact_coverage_mean', 'unknown')}",
            ]
        )
    lines.extend(
        [
            "",
            "## By Agent",
            "",
            "| Agent | Events | Tasks | Completed | Failed | Review errors | Trace coverage | Rec action rate | p95 duration ms |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )

    for agent in summary.get("agents", []):
        lines.append(
            "| {agent_id} | {events_total} | {tasks_total} | {completed_tasks} | {failed_tasks} | {review_errors_total} | {trace_coverage_pct}% | {recommendation_action_rate} | {p95_duration_ms} |".format(
                agent_id=agent.get("agent_id", "unknown"),
                events_total=agent.get("events_total", 0),
                tasks_total=agent.get("tasks_total", 0),
                completed_tasks=agent.get("completed_tasks", 0),
                failed_tasks=agent.get("failed_tasks", 0),
                review_errors_total=agent.get("review_errors_total", 0),
                trace_coverage_pct=agent.get("trace_coverage_pct", 0),
                recommendation_action_rate=agent.get("recommendation_action_rate", "unknown"),
                p95_duration_ms=agent.get("p95_duration_ms", "unknown"),
            )
        )

    lines.extend(
        [
            "",
            "## Best-Practice Stack",
            "",
            "- Instrumentation: OpenTelemetry semantic conventions for traces/logs (including `trace_id`, `span_id`, `gen_ai.*`).",
            "- Error and AI observability UI: Sentry with OpenTelemetry bridge.",
            "- Data contract for every event: `agent_id`, `process`, `task_id`, `step`, `status`, `run_id`, `trace_id`, `metrics`, `recommendation_id`.",
        ]
    )
    return "\n".join(lines) + "\n"


def command_log(args: argparse.Namespace) -> int:
    event = build_log_event(args)
    log_dir = Path(args.log_dir)
    target = append_event(log_dir, event)
    print(f"[agent-telemetry] event logged: {target}")

    if args.enforce_cycle:
        events, invalid_lines = read_events(log_dir)
        report = build_cycle_validation_report(
            events,
            invalid_lines=invalid_lines,
            log_dir=log_dir,
            mode=args.enforce_mode,
            final_scope=args.enforce_final_scope,
            agent_id=event["agent_id"],
            task_id=event["task_id"],
        )
        if args.enforce_out_json:
            out_json = Path(args.enforce_out_json)
            out_json.parent.mkdir(parents=True, exist_ok=True)
            out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            print(f"[agent-telemetry] cycle report written: {out_json}")

        violations_total = int(report.get("totals", {}).get("violations_total", 0))
        if violations_total > 0:
            print(
                f"[agent-telemetry] cycle violations detected: {violations_total} "
                f"(agent={event['agent_id']} task={event['task_id']} mode={args.enforce_mode})"
            )
            if args.enforce_mode == "strict":
                return 1
    return 0


def command_report(args: argparse.Namespace) -> int:
    events, invalid_lines = read_events(Path(args.log_dir))
    summary = summarize(events=events, invalid_lines=invalid_lines, log_dir=Path(args.log_dir))
    benchmark_summary = load_benchmark_summary(Path(args.benchmark_summary_json))
    if benchmark_summary is not None:
        summary["benchmark_summary"] = benchmark_summary

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    out_md = Path(args.out_md)
    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(render_markdown_report(summary), encoding="utf-8")

    cycle_report = build_cycle_validation_report(
        events,
        invalid_lines=invalid_lines,
        log_dir=Path(args.log_dir),
        mode="strict",
        final_scope="latest",
    )
    out_cycle_json = Path(args.out_cycle_json)
    out_cycle_json.parent.mkdir(parents=True, exist_ok=True)
    out_cycle_json.write_text(json.dumps(cycle_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    analyst_latest = build_latest_cycle_analyst_payload(
        events=events,
        summary=summary,
        cycle_report=cycle_report,
    )
    out_latest_cycle = Path(args.out_latest_analyst_json)
    out_latest_cycle.parent.mkdir(parents=True, exist_ok=True)
    out_latest_cycle.write_text(json.dumps(analyst_latest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"[agent-telemetry] report written: {out_json}")
    print(f"[agent-telemetry] report written: {out_md}")
    print(f"[agent-telemetry] cycle report written: {out_cycle_json}")
    print(f"[agent-telemetry] latest cycle written: {out_latest_cycle}")
    return 0


def command_benchmark_report(args: argparse.Namespace) -> int:
    dataset_path = Path(args.dataset_json)
    run_path = Path(args.run_json)
    telemetry_summary_path = Path(args.telemetry_summary_json)

    dataset = load_json_file(dataset_path)
    if dataset is None:
        print(f"[agent-telemetry] benchmark dataset is missing or invalid JSON: {dataset_path}")
        return 1
    run_payload = load_json_file(run_path)
    if run_payload is None:
        print(f"[agent-telemetry] benchmark run payload is missing or invalid JSON: {run_path}")
        return 1
    telemetry_summary = load_json_file(telemetry_summary_path)

    summary = build_benchmark_summary(
        dataset=dataset,
        run_payload=run_payload,
        telemetry_summary=telemetry_summary,
        source_paths={
            "dataset_path": str(dataset_path),
            "run_path": str(run_path),
            "telemetry_summary_path": str(telemetry_summary_path),
        },
        gate_mode=args.mode,
    )

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    append_benchmark_history(Path(args.out_history_jsonl), summary)

    gate_status = str((summary.get("gate") or {}).get("status") or "warning")
    print(f"[agent-telemetry] benchmark summary written: {out_json}")
    print(f"[agent-telemetry] benchmark history appended: {args.out_history_jsonl}")
    print(f"[agent-telemetry] benchmark gate status: {gate_status}")

    if gate_status == "failed" and args.mode == "strict":
        print("[agent-telemetry] strict mode: benchmark gate failed")
        return 1
    return 0


def command_validate_cycle(args: argparse.Namespace) -> int:
    log_dir = Path(args.log_dir)
    events, invalid_lines = read_events(log_dir)
    report = build_cycle_validation_report(
        events,
        invalid_lines=invalid_lines,
        log_dir=log_dir,
        mode=args.mode,
        final_scope=args.final_scope,
        agent_id=args.agent_id,
        task_id=args.task_id,
    )

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[agent-telemetry] cycle validation report written: {out_json}")

    violations_total = int(report.get("totals", {}).get("violations_total", 0))
    tasks_checked = int(report.get("totals", {}).get("tasks_checked", 0))
    print(
        f"[agent-telemetry] cycle validation: tasks={tasks_checked} violations={violations_total} mode={args.mode}"
    )

    if violations_total > 0 and args.mode == "strict":
        print("[agent-telemetry] strict mode: cycle validation failed")
        return 1
    if violations_total > 0:
        print("[agent-telemetry] soft-warning mode: violations reported, process is not blocked")
    return 0


def build_manual_event(
    *,
    agent_id: str,
    task_id: str,
    process: str,
    step: str,
    status: str,
    timestamp: str,
    run_id: str,
    trace_id: str,
    outcome: str | None = None,
) -> dict[str, Any]:
    return {
        "version": LOG_VERSION,
        "event_id": str(uuid.uuid4()),
        "timestamp": timestamp,
        "agent_id": agent_id,
        "process": process,
        "run_id": run_id,
        "trace_id": trace_id,
        "span_id": None,
        "task_id": task_id,
        "step": step,
        "status": status,
        "outcome": outcome,
        "recommendation_id": None,
        "mcp_tools": [],
        "skills": [],
        "artifacts_read": [],
        "artifacts_written": [],
        "metrics": {},
        "error": None,
    }


def has_user_correction(statuses: list[str]) -> bool:
    return any(status in USER_CORRECTION_STATUSES for status in statuses)


def planned_repair_statuses(task_report: dict[str, Any]) -> list[str]:
    lesson_status = "lesson_captured" if has_user_correction(task_report.get("statuses", [])) else "lesson_not_applicable"
    final_status = normalize_status(task_report.get("latest_final_status"))
    if final_status not in CYCLE_FINAL_STATUSES:
        final_status = "completed"
    return ["started", "verify_started", "verify_passed", lesson_status, final_status]


def command_backfill_cycle(args: argparse.Namespace) -> int:
    log_dir = Path(args.log_dir)
    events, invalid_lines = read_events(log_dir)
    before_report = build_cycle_validation_report(
        events,
        invalid_lines=invalid_lines,
        log_dir=log_dir,
        mode="strict",
        final_scope=args.final_scope,
        agent_id=args.agent_id,
        task_id=args.task_id,
    )

    repair_plan = []
    events_appended = 0
    now = dt.datetime.now(dt.timezone.utc)

    for index, task_report in enumerate(before_report.get("tasks", [])):
        if not task_report.get("violations"):
            continue
        statuses_to_append = planned_repair_statuses(task_report)
        plan_item = {
            "agent_id": task_report.get("agent_id"),
            "task_id": task_report.get("task_id"),
            "latest_final_status_before": task_report.get("latest_final_status"),
            "statuses_to_append": statuses_to_append,
        }
        repair_plan.append(plan_item)

        if not args.apply:
            continue

        run_id = str(uuid.uuid4())
        trace_id = str(uuid.uuid4()).replace("-", "")
        base = now + dt.timedelta(minutes=index)
        for offset, status in enumerate(statuses_to_append):
            timestamp = (base + dt.timedelta(seconds=offset)).isoformat().replace("+00:00", "Z")
            event = build_manual_event(
                agent_id=plan_item["agent_id"],
                task_id=plan_item["task_id"],
                process=args.process,
                step=args.step,
                status=status,
                timestamp=timestamp,
                run_id=run_id,
                trace_id=trace_id,
                outcome="backfill_repair" if status in CYCLE_FINAL_STATUSES else None,
            )
            append_event(log_dir, event)
            events_appended += 1

    after_events, after_invalid_lines = read_events(log_dir)
    after_report = build_cycle_validation_report(
        after_events,
        invalid_lines=after_invalid_lines,
        log_dir=log_dir,
        mode="strict",
        final_scope=args.final_scope,
        agent_id=args.agent_id,
        task_id=args.task_id,
    )

    out = {
        "generated_at": utc_now_iso(),
        "version": "agent_cycle_backfill.v1",
        "apply": bool(args.apply),
        "final_scope": args.final_scope,
        "log_dir": str(log_dir),
        "filters": {
            "agent_id": args.agent_id,
            "task_id": args.task_id,
        },
        "before": {
            "tasks_checked": before_report.get("totals", {}).get("tasks_checked", 0),
            "tasks_with_violations": before_report.get("totals", {}).get("tasks_with_violations", 0),
            "violations_total": before_report.get("totals", {}).get("violations_total", 0),
            "invalid_lines": invalid_lines,
        },
        "after": {
            "tasks_checked": after_report.get("totals", {}).get("tasks_checked", 0),
            "tasks_with_violations": after_report.get("totals", {}).get("tasks_with_violations", 0),
            "violations_total": after_report.get("totals", {}).get("violations_total", 0),
            "invalid_lines": after_invalid_lines,
        },
        "repairs_planned": len(repair_plan),
        "events_appended": events_appended,
        "repairs": repair_plan,
    }

    out_json = Path(args.out_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[agent-telemetry] cycle backfill report written: {out_json}")
    print(
        "[agent-telemetry] cycle backfill: apply={apply} planned={planned} appended={appended} "
        "violations_before={before} violations_after={after}".format(
            apply=bool(args.apply),
            planned=out["repairs_planned"],
            appended=events_appended,
            before=out["before"]["violations_total"],
            after=out["after"]["violations_total"],
        )
    )
    if args.apply and int(out["after"]["violations_total"]) > 0:
        return 1
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Structured telemetry logging for AI agents and vibe-coding process.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    log_parser = subparsers.add_parser("log", help="Append one telemetry event to JSONL log.")
    log_parser.add_argument("--agent-id", required=True)
    log_parser.add_argument("--task-id", required=True)
    log_parser.add_argument("--step", required=True)
    log_parser.add_argument("--status", required=True)
    log_parser.add_argument("--process", default="vibe_coding")
    log_parser.add_argument("--run-id")
    log_parser.add_argument("--trace-id")
    log_parser.add_argument("--span-id")
    log_parser.add_argument("--outcome")
    log_parser.add_argument("--recommendation-id")
    log_parser.add_argument("--benchmark-run-id")
    log_parser.add_argument("--benchmark-case-id")
    log_parser.add_argument("--attempt-index", type=int)
    log_parser.add_argument("--judge-model")
    log_parser.add_argument("--judge-score", type=float)
    log_parser.add_argument("--mcp", action="append", default=[])
    log_parser.add_argument("--skill", action="append", default=[])
    log_parser.add_argument("--artifact-read", action="append", default=[])
    log_parser.add_argument("--artifact-write", action="append", default=[])
    log_parser.add_argument("--duration-ms", type=int)
    log_parser.add_argument("--tokens-in", type=int)
    log_parser.add_argument("--tokens-out", type=int)
    log_parser.add_argument("--review-errors", type=int)
    log_parser.add_argument("--target-delta-pct", type=float)
    log_parser.add_argument("--guardrail-breached", type=parse_bool)
    log_parser.add_argument("--ab-sessions-required", type=int)
    log_parser.add_argument("--error")
    log_parser.add_argument("--timestamp")
    log_parser.add_argument("--log-dir", default=".logs/agents")
    log_parser.add_argument("--enforce-cycle", action="store_true")
    log_parser.add_argument("--enforce-mode", choices=["soft_warning", "strict"], default="soft_warning")
    log_parser.add_argument("--enforce-final-scope", choices=["latest", "all"], default="latest")
    log_parser.add_argument("--enforce-out-json", default=None)
    log_parser.set_defaults(handler=command_log)

    report_parser = subparsers.add_parser("report", help="Build aggregated telemetry report.")
    report_parser.add_argument("--log-dir", default=".logs/agents")
    report_parser.add_argument("--out-json", default="artifacts/agent_telemetry_summary.json")
    report_parser.add_argument("--out-md", default="artifacts/agent_telemetry_summary.md")
    report_parser.add_argument("--out-cycle-json", default="artifacts/agent_cycle_validation_report.json")
    report_parser.add_argument("--out-latest-analyst-json", default="artifacts/agent_latest_cycle_analyst.json")
    report_parser.add_argument("--benchmark-summary-json", default="artifacts/agent_benchmark_summary.json")
    report_parser.set_defaults(handler=command_report)

    benchmark_parser = subparsers.add_parser(
        "benchmark-report",
        help="Build benchmark summary from dataset + run results and append history.",
    )
    benchmark_parser.add_argument("--dataset-json", default="artifacts/analyst_benchmark_dataset.json")
    benchmark_parser.add_argument("--run-json", default="artifacts/agent_benchmark_run_results.json")
    benchmark_parser.add_argument("--telemetry-summary-json", default="artifacts/agent_telemetry_summary.json")
    benchmark_parser.add_argument("--out-json", default="artifacts/agent_benchmark_summary.json")
    benchmark_parser.add_argument("--out-history-jsonl", default="artifacts/agent_benchmark_history.jsonl")
    benchmark_parser.add_argument("--mode", choices=["soft_warning", "strict"], default="soft_warning")
    benchmark_parser.set_defaults(handler=command_benchmark_report)

    validate_parser = subparsers.add_parser("validate-cycle", help="Validate learning-core cycle status order per agent/task.")
    validate_parser.add_argument("--log-dir", default=".logs/agents")
    validate_parser.add_argument("--mode", choices=["soft_warning", "strict"], default="soft_warning")
    validate_parser.add_argument("--final-scope", choices=["latest", "all"], default="latest")
    validate_parser.add_argument("--agent-id", default=None)
    validate_parser.add_argument("--task-id", default=None)
    validate_parser.add_argument("--out-json", default="artifacts/agent_cycle_validation_report.json")
    validate_parser.set_defaults(handler=command_validate_cycle)

    backfill_parser = subparsers.add_parser(
        "backfill-cycle",
        help="Append repair cycle events for tasks with cycle violations (append-only).",
    )
    backfill_parser.add_argument("--log-dir", default=".logs/agents")
    backfill_parser.add_argument("--final-scope", choices=["latest", "all"], default="latest")
    backfill_parser.add_argument("--agent-id", default=None)
    backfill_parser.add_argument("--task-id", default=None)
    backfill_parser.add_argument("--process", default="vibe_coding")
    backfill_parser.add_argument("--step", default="cycle_repair")
    backfill_parser.add_argument("--apply", action="store_true")
    backfill_parser.add_argument("--out-json", default="artifacts/agent_cycle_backfill_report.json")
    backfill_parser.set_defaults(handler=command_backfill_cycle)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
