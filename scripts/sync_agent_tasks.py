#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
from typing import Any, TYPE_CHECKING
from uuid import UUID
import copy

if TYPE_CHECKING:
    import psycopg

STATUS_BACKLOG = "backlog"
STATUS_READY = "ready"
STATUS_IN_PROGRESS = "in_progress"
STATUS_AB_TEST = "ab_test"
STATUS_IN_REVIEW = "in_review"
STATUS_DONE = "done"
STATUS_COMPLETED = "completed"

VALID_STATUSES = {
    STATUS_BACKLOG,
    STATUS_READY,
    STATUS_IN_PROGRESS,
    STATUS_AB_TEST,
    STATUS_IN_REVIEW,
    STATUS_DONE,
    STATUS_COMPLETED,
}

VALID_PRIORITIES = {"low", "medium", "high"}
PASS_RULE_TARGET_PLUS_GUARDRAILS = "target_plus_guardrails"
DEFAULT_AB_GUARDRAILS = [
    "review_error_rate",
    "verification_pass_rate",
    "lesson_capture_rate",
]
DEFAULT_AB_TARGET_METRIC = "recommendation_action_rate"
DEFAULT_DB_SCHEMA = "oap"
LEGACY_DB_SCHEMA = "bible"
ALLOWED_DB_SCHEMAS = {DEFAULT_DB_SCHEMA, LEGACY_DB_SCHEMA}

COLLABORATION_KEYWORDS: dict[str, tuple[str, ...]] = {
    "analyst-agent": ("telemetry", "metric", "quality", "review", "risk", "benchmark", "аналит"),
    "designer-agent": ("ui", "ux", "design", "дизайн", "карточк", "tooltip", "m3", "mui"),
    "reader-agent": ("knowledge", "kb", "read", "reader", "докум", "retrieval", "context"),
}

DEFAULT_MANDATORY_RULES = [
    {
        "title": "Project spec",
        "path": ".specify/specs/001-oap/spec.md",
        "mandatory": True,
    },
    {
        "title": "Frontend API contract",
        "path": ".specify/specs/001-oap/contracts/frontend-api.md",
        "mandatory": True,
    },
    {
        "title": "Agent rules",
        "path": "AGENTS.md",
        "mandatory": True,
    },
]


def _load_orchestration_module():
    module_path = Path(__file__).resolve().with_name("agent_orchestration.py")
    spec = importlib.util.spec_from_file_location("agent_orchestration", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load orchestration module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


ORCHESTRATION = _load_orchestration_module()
DISPATCHER: Any | None = None


def _load_dispatcher_module():
    module_path = Path(__file__).resolve().with_name("oap_agent_dispatcher.py")
    spec = importlib.util.spec_from_file_location("oap_agent_dispatcher", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load dispatcher module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


def get_dispatcher_module():
    global DISPATCHER
    if DISPATCHER is None:
        DISPATCHER = _load_dispatcher_module()
    return DISPATCHER


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sync OAP task board from agents registry and telemetry logs.",
    )
    parser.add_argument(
        "--db",
        default=os.getenv("SUPABASE_DB_URL", ""),
        help="Postgres DSN (default: SUPABASE_DB_URL).",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    sync_parser = subparsers.add_parser("sync", help="Seed tasks and project telemetry statuses.")
    sync_parser.add_argument("--registry", default="docs/agents/registry.yaml")
    sync_parser.add_argument("--logs-dir", default=".logs/agents")
    sync_parser.add_argument("--executor-agent-id", default="analyst-agent")
    sync_parser.add_argument(
        "--db-schema",
        default=DEFAULT_DB_SCHEMA,
        choices=sorted(ALLOWED_DB_SCHEMAS),
        help="Runtime DB schema. Default: oap. Use bible only for explicit legacy compatibility.",
    )
    sync_parser.add_argument("--out-json", default="artifacts/agent_tasks_sync_report.json")
    sync_parser.add_argument("--dry-run", action="store_true")
    sync_parser.add_argument("--execute-collaboration-plans", action="store_true")
    sync_parser.add_argument("--execution-limit", type=int, default=0)

    report_parser = subparsers.add_parser("report", help="Build status summary report from DB.")
    report_parser.add_argument(
        "--db-schema",
        default=DEFAULT_DB_SCHEMA,
        choices=sorted(ALLOWED_DB_SCHEMAS),
        help="Runtime DB schema. Default: oap. Use bible only for explicit legacy compatibility.",
    )
    report_parser.add_argument("--out-json", default="artifacts/agent_tasks_report.json")

    return parser.parse_args()


def json_default(value: Any) -> str:
    if isinstance(value, dt.datetime):
        raw = value
        if raw.tzinfo is None:
            raw = raw.replace(tzinfo=dt.timezone.utc)
        return raw.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, UUID):
        return str(value)
    raise TypeError(f"Object of type {value.__class__.__name__} is not JSON serializable")


def ensure_db_url(db_url: str) -> str:
    value = (db_url or "").strip()
    if not value:
        raise ValueError("Database URL is required. Pass --db or set SUPABASE_DB_URL.")
    return value


def connect(db_url: str):
    import psycopg  # Lazy import: allows unit tests to run without DB driver.
    from psycopg.rows import dict_row

    return psycopg.connect(ensure_db_url(db_url), row_factory=dict_row, prepare_threshold=0)


def parse_registry(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid registry format at {path}: expected JSON-compatible YAML.") from exc
    if not isinstance(parsed, dict):
        raise ValueError(f"Invalid registry root at {path}: expected object.")
    return parsed


def write_registry(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def slugify(value: str) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    ascii_only = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if ascii_only:
        return ascii_only[:80]
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]
    return f"name-{digest}"


def normalize_priority(value: str | None) -> str:
    text = (value or "").strip().lower()
    if "выс" in text or text == "high":
        return "high"
    if "низ" in text or text == "low":
        return "low"
    return "medium"


def normalize_event_status(status: str | None, outcome: str | None = None, step: str | None = None) -> str | None:
    base = (status or "").strip().lower()
    outcome_norm = (outcome or "").strip().lower()
    step_norm = (step or "").strip().lower()
    if base == "candidate_received":
        return STATUS_BACKLOG
    if base == "candidate_assessed":
        return STATUS_READY
    if base == "candidate_rejected":
        return STATUS_BACKLOG
    if base == "ab_test_started":
        return STATUS_AB_TEST
    if base == "ab_test_checkpoint":
        return STATUS_AB_TEST
    if base == "ab_test_passed":
        return STATUS_IN_REVIEW
    if base == "ab_test_failed":
        return STATUS_BACKLOG
    if base == "rollback_applied":
        return STATUS_BACKLOG
    if base == "recommendation_suggested":
        return STATUS_READY
    if base == "completed" and (outcome_norm == "deployed" or step_norm == "deploy"):
        return STATUS_COMPLETED
    if base == "started":
        return STATUS_IN_PROGRESS
    if base == "completed":
        return STATUS_IN_REVIEW
    if base == "verify_started":
        return STATUS_IN_REVIEW
    if base == "verify_passed":
        return STATUS_DONE
    if base == "verify_failed":
        return STATUS_BACKLOG
    if base == "review_passed":
        return STATUS_DONE
    if base in {"deployed", "release_done", "rollout_done", "implemented"}:
        return STATUS_COMPLETED
    if base == "recommendation_applied" and outcome_norm == "success":
        return STATUS_DONE
    if base in {"failed", "review_failed", "step_error"}:
        return STATUS_BACKLOG
    return None


def safe_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def build_db_schema_candidates(preferred: str | None) -> list[str]:
    normalized = safe_str(preferred).lower() or DEFAULT_DB_SCHEMA
    if normalized not in ALLOWED_DB_SCHEMAS:
        raise ValueError(
            f"Unsupported db schema `{normalized}`. Allowed: {', '.join(sorted(ALLOWED_DB_SCHEMAS))}."
        )
    return [normalized]


def resolve_db_schema(conn, preferred: str | None = None) -> str:
    candidates = build_db_schema_candidates(preferred)
    for candidate in candidates:
        row = conn.execute("select to_regnamespace(%s)::text as schema_name", (candidate,)).fetchone()
        if safe_str((row or {}).get("schema_name")).lower() == candidate:
            return candidate
    raise ValueError(
        f"DB schema is not available. Checked candidates: {', '.join(candidates)}."
    )


def safe_list_str(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = safe_str(item)
        if text:
            result.append(text)
    return result


def normalize_text_tokens(value: str) -> set[str]:
    text = safe_str(value).lower()
    if not text:
        return set()
    parts = re.split(r"[^a-z0-9а-яё]+", text)
    return {part for part in parts if len(part) > 1}


def format_ice(item: dict[str, Any]) -> dict[str, int]:
    raw = item.get("ice") if isinstance(item.get("ice"), dict) else {}
    impact = int(float(raw.get("impact", 0) or 0))
    confidence = int(float(raw.get("confidence", 0) or 0))
    ease = int(float(raw.get("ease", 0) or 0))
    return {
        "impact": max(0, min(10, impact)),
        "confidence": max(0, min(10, confidence)),
        "ease": max(0, min(10, ease)),
    }


def make_linked_element(
    *,
    item_type: str,
    title: str,
    item_id: str | None = None,
    ref: str | None = None,
    source_agent_id: str | None = None,
    source_url: str | None = None,
    open_mode: str | None = None,
    importance: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "type": item_type,
        "title": title or "Связанный элемент",
    }
    if item_id:
        payload["id"] = item_id
    if ref:
        payload["ref"] = ref
    if source_agent_id:
        payload["source_agent_id"] = source_agent_id
    if source_url:
        payload["source_url"] = source_url
    if open_mode:
        payload["open_mode"] = open_mode
    if importance:
        payload["importance"] = importance
    return payload


def normalize_context_to_task(value: Any, fallback_summary: str, fallback_why_now: str = "") -> dict[str, Any]:
    payload = value if isinstance(value, dict) else {}
    summary = safe_str(payload.get("summary")) or safe_str(fallback_summary)
    why_now = safe_str(payload.get("why_now")) or safe_str(fallback_why_now)
    execution_notes = safe_list_str(payload.get("execution_notes"))
    source_snapshot = payload.get("source_snapshot") if isinstance(payload.get("source_snapshot"), dict) else None
    return {
        "summary": summary,
        "why_now": why_now,
        "execution_notes": execution_notes,
        "source_snapshot": source_snapshot,
    }


def build_improvement_snapshot(
    *,
    source_agent_id: str,
    item: dict[str, Any],
    improvement_id: str,
) -> dict[str, Any]:
    ice = format_ice(item)
    return {
        "id": improvement_id,
        "source_agent_id": source_agent_id,
        "title": safe_str(item.get("title")),
        "problem": safe_str(item.get("problem")),
        "solution": safe_str(item.get("solution")),
        "effect": safe_str(item.get("effect")),
        "priority": safe_str(item.get("priority")) or "Средний",
        "section": safe_str(item.get("section")),
        "ownerSection": safe_str(item.get("ownerSection")),
        "detectionBasis": safe_str(item.get("detectionBasis")),
        "targetMetric": safe_str(item.get("targetMetric")),
        "baselineWindow": safe_str(item.get("baselineWindow")),
        "expectedDelta": safe_str(item.get("expectedDelta")),
        "validationDate": safe_str(item.get("validationDate")),
        "promptPath": safe_str(item.get("promptPath")),
        "promptTitle": safe_str(item.get("promptTitle")),
        "promptMarkdown": safe_str(item.get("promptMarkdown")),
        "promptSourceUrl": safe_str(item.get("promptSourceUrl")),
        "ice": ice,
        "iceScore": ice["impact"] + ice["confidence"] + ice["ease"],
    }


def build_improvement_index(source_agent_id: str, improvements: list[Any]) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
    by_id: dict[str, dict[str, Any]] = {}
    ranked: list[dict[str, Any]] = []
    for item in improvements:
        if not isinstance(item, dict):
            continue
        title = safe_str(item.get("title"))
        if not title:
            continue
        improvement_id = safe_str(item.get("id")) or f"imp-{source_agent_id}-{slugify(title)}"
        snapshot = build_improvement_snapshot(source_agent_id=source_agent_id, item=item, improvement_id=improvement_id)
        search_blob = " ".join([
            snapshot["title"],
            snapshot["problem"],
            snapshot["solution"],
            snapshot["effect"],
            safe_str(snapshot.get("ownerSection")),
            safe_str(snapshot.get("targetMetric")),
        ])
        tokens = normalize_text_tokens(search_blob)
        candidate = {
            "id": improvement_id,
            "snapshot": snapshot,
            "tokens": tokens,
            "score_hint": snapshot["iceScore"],
        }
        by_id[improvement_id] = candidate
        ranked.append(candidate)
    return by_id, ranked


def match_improvement_for_recommendation(
    recommendation_text: str,
    candidates: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, float]:
    rec_tokens = normalize_text_tokens(recommendation_text)
    if not rec_tokens or not candidates:
        return None, 0.0

    best: dict[str, Any] | None = None
    best_score = 0.0
    for candidate in candidates:
        candidate_tokens = candidate.get("tokens") or set()
        if not candidate_tokens:
            continue
        overlap = rec_tokens.intersection(candidate_tokens)
        score = len(overlap) / len(rec_tokens)
        if score > best_score or (score == best_score and candidate.get("score_hint", 0) > (best or {}).get("score_hint", 0)):
            best = candidate
            best_score = score
    if best_score < 0.32:
        return None, best_score
    return best, best_score


def normalize_recommendation_entry(value: Any, index: int) -> dict[str, Any]:
    if isinstance(value, dict):
        text = safe_str(value.get("text")) or safe_str(value.get("title")) or safe_str(value.get("recommendation"))
        recommendation_id = safe_str(value.get("id")) or f"rec-{index}"
        linked_improvement_id = safe_str(value.get("linkedImprovementId"))
        context_to_task = value.get("contextToTask") if isinstance(value.get("contextToTask"), dict) else None
        return {
            "text": text,
            "id": recommendation_id,
            "linked_improvement_id": linked_improvement_id,
            "context_to_task": context_to_task,
            "origin_cycle_id": safe_str(value.get("originCycleId")) or safe_str(value.get("origin_cycle_id")),
        }
    text = safe_str(value)
    return {
        "text": text,
        "id": f"rec-{index}",
        "linked_improvement_id": "",
        "context_to_task": None,
        "origin_cycle_id": "",
    }


def parse_iso(value: str | None) -> dt.datetime | None:
    text = safe_str(value)
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def parse_uuid_or_none(value: str | None) -> UUID | None:
    text = safe_str(value)
    if not text:
        return None
    try:
        return UUID(text)
    except ValueError:
        return None


def extract_markdown_acceptance_criteria(markdown: str) -> list[str]:
    text = (markdown or "").strip()
    if not text:
        return []
    result: list[str] = []
    for line in text.splitlines():
        cleaned = line.strip()
        if cleaned.startswith("- "):
            item = cleaned[2:].strip()
            if item:
                result.append(item)
    deduped: list[str] = []
    seen: set[str] = set()
    for item in result:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def extract_first_number(value: str) -> float | None:
    text = safe_str(value).replace(",", ".")
    if not text:
        return None
    match = re.search(r"(-?\d+(?:\.\d+)?)", text)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


def parse_expected_delta_pct(value: str) -> float | None:
    parsed = extract_first_number(value)
    if parsed is None:
        return None
    return abs(parsed)


def clamp_sessions_required(value: int) -> int:
    return max(3, min(8, int(value)))


def compute_sessions_required(expected_delta_pct: float | None) -> int:
    delta = expected_delta_pct if expected_delta_pct is not None else 5.0
    if delta >= 20.0:
        return 3
    if delta >= 12.0:
        return 4
    if delta >= 8.0:
        return 5
    if delta >= 5.0:
        return 6
    if delta >= 3.0:
        return 7
    return 8


def suggest_collaboration_agents(
    *,
    source_agent_id: str,
    executor_agent_id: str,
    available_agent_ids: set[str],
    hint_text: str,
    linked_snapshot: dict[str, Any] | None = None,
) -> list[str]:
    hints = safe_str(hint_text).lower()
    scored: dict[str, int] = {}

    if (
        source_agent_id
        and source_agent_id != executor_agent_id
        and source_agent_id in available_agent_ids
    ):
        scored[source_agent_id] = 3

    linked_source = safe_str(linked_snapshot.get("source_agent_id")) if linked_snapshot else ""
    if (
        linked_source
        and linked_source != executor_agent_id
        and linked_source in available_agent_ids
    ):
        scored[linked_source] = max(scored.get(linked_source, 0), 2)

    for agent_id, keywords in COLLABORATION_KEYWORDS.items():
        if agent_id == executor_agent_id or agent_id not in available_agent_ids:
            continue
        score = 0
        for keyword in keywords:
            if keyword in hints:
                score += 1
        if score > 0:
            scored[agent_id] = max(scored.get(agent_id, 0), score)

    ordered = sorted(scored.items(), key=lambda item: (-item[1], item[0]))
    return [agent_id for agent_id, _score in ordered]


def resolve_executor_agent_id(
    *,
    default_executor_agent_id: str,
    available_agent_ids: set[str],
    hint_text: str,
    target_metric: str = "",
    owner_section: str = "",
    linked_snapshot: dict[str, Any] | None = None,
) -> str:
    fallback_executor = safe_str(default_executor_agent_id) or "analyst-agent"
    if fallback_executor == "orchestrator-agent":
        return fallback_executor
    if "orchestrator-agent" not in available_agent_ids:
        return fallback_executor
    requirements = build_orchestration_requirements(
        hint_text=hint_text,
        target_metric=target_metric,
        owner_section=owner_section,
        linked_snapshot=linked_snapshot,
    )
    if not requirements:
        return fallback_executor

    complexity = safe_str(requirements.get("complexity")).lower()
    complexity_signals = sum(
        1
        for key in ("retrieval_related", "ui_related", "telemetry_related", "contract_related")
        if bool(requirements.get(key))
    )
    if complexity == "high" or complexity_signals >= 2:
        return "orchestrator-agent"
    return fallback_executor


def build_orchestration_requirements(
    *,
    hint_text: str,
    target_metric: str = "",
    owner_section: str = "",
    linked_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not hasattr(ORCHESTRATION, "build_requirements"):
        return {}
    try:
        requirements = ORCHESTRATION.build_requirements(
            hint_text=hint_text,
            target_metric=target_metric,
            owner_section=owner_section,
            linked_snapshot=linked_snapshot,
        )
    except Exception:
        return {}
    return requirements if isinstance(requirements, dict) else {}


def build_routing_task_class(requirements: dict[str, Any]) -> str:
    signal_labels: list[str] = []
    if bool(requirements.get("retrieval_related")):
        signal_labels.append("retrieval")
    if bool(requirements.get("ui_related")):
        signal_labels.append("ui")
    if bool(requirements.get("telemetry_related")):
        signal_labels.append("telemetry")
    if bool(requirements.get("contract_related")):
        signal_labels.append("contract")
    if not signal_labels:
        return "general_change"
    if len(signal_labels) == 1:
        return f"{signal_labels[0]}_change"
    return "multi_signal_" + "_".join(signal_labels)


def build_routing_comparison_metrics(requirements: dict[str, Any]) -> list[str]:
    metrics = ["quality", "token_cost", "verification_coverage"]
    if bool(requirements.get("ui_related")):
        metrics.append("ui_regression_risk")
    if bool(requirements.get("telemetry_related")):
        metrics.append("telemetry_completeness")
    if bool(requirements.get("contract_related")):
        metrics.append("contract_validity")
    if bool(requirements.get("retrieval_related")):
        metrics.append("evidence_coverage")
    return safe_list_str(metrics)


def build_routing_decision(
    *,
    root_agent_id: str,
    suggested_agents: list[str],
    orchestration_plan: dict[str, Any],
    requirements: dict[str, Any],
) -> dict[str, Any]:
    def _ordered_unique(values: list[str]) -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for item in values:
            value = safe_str(item)
            if not value or value in seen:
                continue
            seen.add(value)
            result.append(value)
        return result

    interaction_mode = safe_str(orchestration_plan.get("interaction_mode")).lower() or "sequential"
    selected_agents = safe_list_str(orchestration_plan.get("selected_agents"))
    coordinator_agent_id = safe_str(orchestration_plan.get("primary_coordinator_agent_id")) or root_agent_id
    merge_owner_agent_id = safe_str(orchestration_plan.get("merge_owner_agent_id")) or root_agent_id
    final_synthesizer_agent_id = safe_str(orchestration_plan.get("final_synthesizer_agent_id")) or coordinator_agent_id

    process_agents = _ordered_unique(
        [root_agent_id, coordinator_agent_id, merge_owner_agent_id, final_synthesizer_agent_id]
        + selected_agents
        + safe_list_str(suggested_agents)
        + [
            safe_str(item.get("profile_id"))
            for item in (
                orchestration_plan.get("spawned_instances")
                if isinstance(orchestration_plan.get("spawned_instances"), list)
                else []
            )
            if isinstance(item, dict)
        ]
    )
    delegated_agents = [agent_id for agent_id in process_agents if agent_id and agent_id != root_agent_id]
    selected_route = (
        "delegated_path"
        if interaction_mode != "sequential" or safe_str(coordinator_agent_id) == "orchestrator-agent" or delegated_agents
        else "single_agent_path"
    )
    fallback_route = "single_agent_path" if selected_route == "delegated_path" else "delegated_path"
    task_class = build_routing_task_class(requirements)

    signal_titles: list[str] = []
    if bool(requirements.get("retrieval_related")):
        signal_titles.append("нужна проверка источников и контекста")
    if bool(requirements.get("ui_related")):
        signal_titles.append("есть UI-риск")
    if bool(requirements.get("telemetry_related")):
        signal_titles.append("нужен telemetry-контур")
    if bool(requirements.get("contract_related")):
        signal_titles.append("есть контрактный риск")

    if selected_route == "delegated_path":
        why_this_route = (
            "Выбран делегированный маршрут, потому что задача требует координации нескольких ролей: "
            + (", ".join(signal_titles) if signal_titles else "обнаружены сигналы повышенной сложности")
            + "."
        )
        expected_gain = "Выше полнота проверки и ниже риск пропустить дефект на merge/verify этапах."
    else:
        why_this_route = "Выбран одиночный маршрут, потому что сильных сигналов для multi-agent координации не найдено."
        expected_gain = "Ниже расход токенов и меньше накладные затраты на orchestration для простой задачи."

    signal_count = sum(
        1
        for key in ("retrieval_related", "ui_related", "telemetry_related", "contract_related")
        if bool(requirements.get(key))
    )
    decision_confidence = round(min(0.65 + (signal_count * 0.1), 0.95), 2)

    return {
        "route_id": f"{task_class}:{selected_route}",
        "task_class": task_class,
        "primary_executor_agent_id": root_agent_id,
        "process_agents": process_agents,
        "why_this_route": why_this_route,
        "expected_gain": expected_gain,
        "verify_owner_agent_id": merge_owner_agent_id,
        "fallback_route": fallback_route,
        "considered_routes": ["single_agent_path", "delegated_path"],
        "decision_confidence": decision_confidence,
        "comparison_basis": "baseline_vs_selected",
        "comparison_metrics": build_routing_comparison_metrics(requirements),
    }


def build_operational_memory_entries(
    *,
    goal: str,
    summary: str,
    why_now: str,
    target_metric: str,
    expected_delta: str,
    source_ref: str,
) -> list[dict[str, Any]]:
    raw_entries = [
        ("goal", "Цель задачи", goal),
        ("context_summary", "Краткий контекст", summary),
        ("why_now", "Почему сейчас", why_now),
        ("target_metric", "Целевая метрика", target_metric),
        ("expected_delta", "Ожидаемый эффект", expected_delta),
    ]
    entries: list[dict[str, Any]] = []
    for key, title, value in raw_entries:
        text = safe_str(value)
        if not text:
            continue
        payload: dict[str, Any] = {
            "key": key,
            "title": title,
            "value": text,
        }
        if source_ref:
            payload["source_ref"] = source_ref
        entries.append(payload)
    return entries


def normalize_spawned_instance(item: Any, *, root_agent_id: str, task_id: str) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    instance_id = safe_str(item.get("instance_id"))
    profile_id = safe_str(item.get("profile_id")) or root_agent_id
    if not instance_id:
        digest = hashlib.sha1(f"{task_id}:{profile_id}:{safe_str(item.get('purpose'))}".encode("utf-8")).hexdigest()[:10]
        instance_id = f"inst-{digest}"
    artifact_dir = f"artifacts/agent_runs/{instance_id}"
    timings = item.get("timings") if isinstance(item.get("timings"), dict) else {}
    usage = item.get("usage") if isinstance(item.get("usage"), dict) else {}
    artifacts = item.get("artifacts") if isinstance(item.get("artifacts"), dict) else {}
    return {
        "instance_id": instance_id,
        "profile_id": profile_id,
        "source_template_id": safe_str(item.get("source_template_id")) or None,
        "parent_instance_id": safe_str(item.get("parent_instance_id")) or None,
        "root_agent_id": safe_str(item.get("root_agent_id")) or root_agent_id,
        "task_id": safe_str(item.get("task_id")) or task_id,
        "purpose": safe_str(item.get("purpose")) or "Task-local specialist execution",
        "depth": int(item.get("depth", 0) or 0),
        "allowed_skills": safe_list_str(item.get("allowed_skills")),
        "allowed_tools": safe_list_str(item.get("allowed_tools")),
        "allowed_mcp": safe_list_str(item.get("allowed_mcp")),
        "applied_rules": safe_list_str(item.get("applied_rules")),
        "input_refs": safe_list_str(item.get("input_refs")),
        "output_refs": safe_list_str(item.get("output_refs")),
        "status": safe_str(item.get("status")) or "planned",
        "verify_status": safe_str(item.get("verify_status")) or "pending",
        "workflow_backbone_version": safe_str(item.get("workflow_backbone_version")) or "universal_backbone_v1",
        "output_contract": safe_str(item.get("output_contract")) or "agent_output.v1",
        "execution_mode": safe_str(item.get("execution_mode")) or "sequential",
        "execution_backend": safe_str(item.get("execution_backend")) or "dispatcher",
        "phase_id": safe_str(item.get("phase_id")) or None,
        "context_window_id": safe_str(item.get("context_window_id")) or f"ctx-{instance_id}",
        "isolation_mode": safe_str(item.get("isolation_mode")) or "per_instance_context_package",
        "read_only": bool(item.get("read_only", False)),
        "ownership_scope": safe_list_str(item.get("ownership_scope")),
        "depends_on": safe_list_str(item.get("depends_on")),
        "merge_target": safe_str(item.get("merge_target")) or None,
        "timings": {
            "queued_at": safe_str(timings.get("queued_at")) or None,
            "started_at": safe_str(timings.get("started_at")) or None,
            "finished_at": safe_str(timings.get("finished_at")) or None,
        },
        "usage": {
            "prompt_tokens": int(usage.get("prompt_tokens", 0) or 0),
            "completion_tokens": int(usage.get("completion_tokens", 0) or 0),
            "total_tokens": int(usage.get("total_tokens", 0) or 0),
            "cost_usd": float(usage.get("cost_usd", 0.0) or 0.0),
        },
        "artifacts": {
            "run_dir": safe_str(artifacts.get("run_dir")) or artifact_dir,
            "manifest_path": safe_str(artifacts.get("manifest_path")) or f"{artifact_dir}/run_manifest.json",
            "result_path": safe_str(artifacts.get("result_path")) or f"{artifact_dir}/result.json",
        },
    }


def normalize_interaction_phase(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    phase_id = safe_str(item.get("phase_id"))
    if not phase_id:
        return None
    return {
        "phase_id": phase_id,
        "label": safe_str(item.get("label")) or phase_id,
        "mode": safe_str(item.get("mode")) or "sequential",
        "goal": safe_str(item.get("goal")) or "",
        "participants": safe_list_str(item.get("participants")),
        "depends_on": safe_list_str(item.get("depends_on")),
        "outputs": safe_list_str(item.get("outputs")),
        "status": safe_str(item.get("status")) or "planned",
        "merge_into": safe_str(item.get("merge_into")) or None,
    }


def normalize_roundtable_policy(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    return {
        "enabled": bool(value.get("enabled", False)),
        "moderated_by": safe_str(value.get("moderated_by")) or None,
        "max_rounds": int(value.get("max_rounds", 4) or 4),
        "transcript_visibility": safe_str(value.get("transcript_visibility")) or "summary_only",
        "allow_free_chat": bool(value.get("allow_free_chat", False)),
        "allow_position_sharing": bool(value.get("allow_position_sharing", True)),
        "summary_required_each_round": bool(value.get("summary_required_each_round", True)),
    }


def normalize_host_execution_strategy(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    host_policies_raw = value.get("host_policies") if isinstance(value.get("host_policies"), dict) else {}
    host_policies: dict[str, dict[str, Any]] = {}
    for host_id, host_payload in host_policies_raw.items():
        if not isinstance(host_payload, dict):
            continue
        normalized_host_id = safe_str(host_id)
        if not normalized_host_id:
            continue
        host_policies[normalized_host_id] = {
            "display_name": safe_str(host_payload.get("display_name")) or normalized_host_id,
            "execution_backend": safe_str(host_payload.get("execution_backend")) or "dispatcher_backed_child_runs",
            "native_delegation": bool(host_payload.get("native_delegation", False)),
            "isolated_context_windows": bool(host_payload.get("isolated_context_windows", False)),
            "dispatcher_required": bool(host_payload.get("dispatcher_required", False)),
            "fallback_mode": safe_str(host_payload.get("fallback_mode")) or "dispatcher_backed",
            "adapter_strategy": safe_str(host_payload.get("adapter_strategy")) or "unknown",
        }
    return {
        "default_host_id": safe_str(value.get("default_host_id")) or "codex",
        "selected_backend_by_default": safe_str(value.get("selected_backend_by_default")) or "dispatcher_backed_child_runs",
        "context_isolation_policy": safe_str(value.get("context_isolation_policy")) or "per_instance_context_package",
        "host_policies": host_policies,
    }


def normalize_discussion_round(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    round_id = safe_str(item.get("round_id"))
    if not round_id:
        return None
    return {
        "round_id": round_id,
        "round_index": int(item.get("round_index", 0) or 0),
        "participants": safe_list_str(item.get("participants")),
        "summary": safe_str(item.get("summary")) or "",
        "status": safe_str(item.get("status")) or "planned",
        "next_owner_agent_id": safe_str(item.get("next_owner_agent_id")) or None,
    }


def build_collaboration_plan(
    *,
    task_id: str,
    root_agent_id: str,
    hint_text: str,
    suggested_agents: list[str],
    rationale: str,
    registry: dict[str, Any],
    target_metric: str = "",
    owner_section: str = "",
    linked_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    created_profiles: list[dict[str, Any]] = []
    requirements = build_orchestration_requirements(
        hint_text=hint_text,
        target_metric=target_metric,
        owner_section=owner_section,
        linked_snapshot=linked_snapshot,
    )
    try:
        orchestration_plan, created_profiles = ORCHESTRATION.build_collaboration_plan(
            task_id=task_id,
            root_agent_id=root_agent_id,
            purpose=safe_str(rationale) or "Task collaboration planning",
            hint_text=hint_text,
            registry=registry,
            suggested_agents=suggested_agents,
            target_metric=target_metric,
            owner_section=owner_section,
            linked_snapshot=linked_snapshot,
        )
        if created_profiles and hasattr(ORCHESTRATION, "append_created_profiles_to_registry"):
            ORCHESTRATION.append_created_profiles_to_registry(
                registry=registry,
                created_profiles=created_profiles,
            )
    except Exception:
        orchestration_plan = {}

    base_rationale = safe_str(rationale) or "Анализ выполнен автоматически на основе ownerSection/promptPath/targetMetric."
    if not isinstance(orchestration_plan, dict):
        orchestration_plan = {}
    spawned_instances: list[dict[str, Any]] = []
    raw_spawned_instances = orchestration_plan.get("spawned_instances")
    if isinstance(raw_spawned_instances, list):
        for item in raw_spawned_instances:
            normalized = normalize_spawned_instance(item, root_agent_id=root_agent_id, task_id=task_id)
            if normalized is not None:
                spawned_instances.append(normalized)
    interaction_phases = [
        normalized
        for normalized in (
            normalize_interaction_phase(item)
            for item in (orchestration_plan.get("interaction_phases") if isinstance(orchestration_plan.get("interaction_phases"), list) else [])
        )
        if normalized is not None
    ]
    discussion_rounds = [
        normalized
        for normalized in (
            normalize_discussion_round(item)
            for item in (orchestration_plan.get("discussion_rounds") if isinstance(orchestration_plan.get("discussion_rounds"), list) else [])
        )
        if normalized is not None
    ]
    plan = {
        "analysis_required": bool(orchestration_plan.get("analysis_required", True)),
        "suggested_agents": safe_list_str(orchestration_plan.get("suggested_agents")) or suggested_agents,
        "selected_agents": safe_list_str(orchestration_plan.get("selected_agents")),
        "rationale": safe_str(orchestration_plan.get("rationale")) or base_rationale,
        "reviewed_at": orchestration_plan.get("reviewed_at"),
        "strategy": safe_str(orchestration_plan.get("strategy")) or "reuse_existing",
        "reuse_candidates": orchestration_plan.get("reuse_candidates") if isinstance(orchestration_plan.get("reuse_candidates"), list) else [],
        "created_profiles": orchestration_plan.get("created_profiles") if isinstance(orchestration_plan.get("created_profiles"), list) else [],
        "primary_coordinator_agent_id": safe_str(orchestration_plan.get("primary_coordinator_agent_id")) or root_agent_id,
        "final_synthesizer_agent_id": safe_str(orchestration_plan.get("final_synthesizer_agent_id")) or root_agent_id,
        "merge_owner_agent_id": safe_str(orchestration_plan.get("merge_owner_agent_id")) or root_agent_id,
        "interaction_mode": safe_str(orchestration_plan.get("interaction_mode")) or "sequential",
        "interaction_phases": interaction_phases,
        "selection_basis": safe_list_str(orchestration_plan.get("selection_basis")),
        "merge_strategy": safe_str(orchestration_plan.get("merge_strategy")) or "single_owner_apply",
        "conflict_policy": safe_str(orchestration_plan.get("conflict_policy")) or "merge_owner_decision",
        "host_execution_strategy": normalize_host_execution_strategy(orchestration_plan.get("host_execution_strategy")),
        "context_isolation_policy": safe_str(orchestration_plan.get("context_isolation_policy")) or "per_instance_context_package",
        "roundtable_policy": normalize_roundtable_policy(orchestration_plan.get("roundtable_policy")),
        "discussion_rounds": discussion_rounds,
        "spawned_instances": spawned_instances,
        "orchestration_budget": orchestration_plan.get("orchestration_budget")
        if isinstance(orchestration_plan.get("orchestration_budget"), dict)
        else {
            "max_instances": 7,
            "max_tokens": 120000,
            "max_wall_clock_minutes": 45,
            "max_no_progress_hops": 2,
        },
        "delegation_depth": int(orchestration_plan.get("delegation_depth", 0) or 0),
        "routing_decision": build_routing_decision(
            root_agent_id=root_agent_id,
            suggested_agents=suggested_agents,
            orchestration_plan=orchestration_plan,
            requirements=requirements,
        ),
    }
    return plan


def build_ab_test_plan(
    *,
    enabled: bool,
    target_metric: str,
    expected_delta: str,
    guardrails: list[str] | None = None,
) -> dict[str, Any]:
    expected_delta_pct = parse_expected_delta_pct(expected_delta)
    sessions_required = clamp_sessions_required(compute_sessions_required(expected_delta_pct))
    return {
        "enabled": bool(enabled),
        "sessions_required": sessions_required,
        "pass_rule": PASS_RULE_TARGET_PLUS_GUARDRAILS,
        "target_metric": safe_str(target_metric) or DEFAULT_AB_TARGET_METRIC,
        "expected_delta_pct": round(expected_delta_pct if expected_delta_pct is not None else 5.0, 2),
        "guardrails": guardrails if isinstance(guardrails, list) and guardrails else list(DEFAULT_AB_GUARDRAILS),
        "rollback_on_fail": True,
    }


def build_context_package(
    *,
    prompt_path: str,
    evidence_refs: list[str],
    operational_memory: list[dict[str, Any]] | None = None,
    collaboration_plan: dict[str, Any] | None = None,
    ab_test_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    anchors: list[dict[str, str]] = []
    if prompt_path:
        anchors.append(
            {
                "path": prompt_path,
                "reason": "prompt_path",
            }
        )
    for ref in evidence_refs:
        value = safe_str(ref)
        if not value:
            continue
        anchors.append(
            {
                "value": value,
                "reason": "evidence_ref",
            }
        )
    payload: dict[str, Any] = {
        "relevant_anchors": anchors,
        "mandatory_rules": DEFAULT_MANDATORY_RULES,
    }
    if operational_memory is not None:
        payload["operational_memory"] = operational_memory
    if collaboration_plan is not None:
        payload["collaboration_plan"] = collaboration_plan
    if ab_test_plan is not None:
        payload["ab_test_plan"] = ab_test_plan
    return payload


def build_task_brief_for_improvement(
    *,
    registry: dict[str, Any],
    source_agent_id: str,
    executor_agent_id: str,
    available_agent_ids: set[str],
    item: dict[str, Any],
    improvement_id: str,
    evidence_refs: list[str],
    origin_cycle_id: str | None = None,
) -> dict[str, Any]:
    prompt_path = safe_str(item.get("promptPath"))
    detection_basis = safe_str(item.get("detectionBasis"))
    target_metric = safe_str(item.get("targetMetric"))
    expected_delta = safe_str(item.get("expectedDelta"))
    effect = safe_str(item.get("effect"))
    prompt_markdown = safe_str(item.get("promptMarkdown"))
    acceptance_criteria = extract_markdown_acceptance_criteria(prompt_markdown)
    if not acceptance_criteria and target_metric:
        metric_criterion = f"Target metric: {target_metric}"
        if expected_delta:
            metric_criterion = f"{metric_criterion}, expected delta: {expected_delta}"
        acceptance_criteria.append(metric_criterion)

    target_artifacts: list[str] = []
    if prompt_path:
        target_artifacts.append(prompt_path)
    owner_section = safe_str(item.get("ownerSection"))
    if owner_section:
        target_artifacts.append(f"section:{owner_section}")

    priority = normalize_priority(safe_str(item.get("priority")))
    priority_reason = detection_basis or f"priority={priority}"
    expected_outcome = effect or expected_delta
    snapshot = build_improvement_snapshot(source_agent_id=source_agent_id, item=item, improvement_id=improvement_id)
    context_to_task = normalize_context_to_task(
        {
            "summary": f"{safe_str(item.get('title'))}: {safe_str(item.get('problem'))}",
            "why_now": detection_basis,
            "execution_notes": [
                safe_str(item.get("solution")),
                safe_str(item.get("expectedDelta")),
            ],
            "source_snapshot": snapshot,
        },
        fallback_summary=safe_str(item.get("title")),
        fallback_why_now=detection_basis,
    )
    hint_text = " ".join([
        safe_str(item.get("title")),
        safe_str(item.get("ownerSection")),
        target_metric,
        prompt_path,
        detection_basis,
    ])
    suggested_agents = suggest_collaboration_agents(
        source_agent_id=source_agent_id,
        executor_agent_id=executor_agent_id,
        available_agent_ids=available_agent_ids,
        hint_text=hint_text,
    )
    collaboration_plan = build_collaboration_plan(
        task_id=f"imp:{source_agent_id}:{improvement_id}",
        root_agent_id=executor_agent_id,
        hint_text=hint_text,
        suggested_agents=suggested_agents,
        rationale=f"Подбор соисполнителей выполнен по ownerSection/targetMetric/promptPath: {safe_str(item.get('ownerSection')) or 'не задано'}.",
        registry=registry,
        target_metric=target_metric,
        owner_section=safe_str(item.get("ownerSection")),
        linked_snapshot=snapshot,
    )
    operational_memory = build_operational_memory_entries(
        goal=safe_str(item.get("title")),
        summary=context_to_task.get("summary", ""),
        why_now=context_to_task.get("why_now", ""),
        target_metric=target_metric,
        expected_delta=expected_delta,
        source_ref=prompt_path or detection_basis,
    )
    ab_test_plan = build_ab_test_plan(
        enabled=True,
        target_metric=target_metric,
        expected_delta=expected_delta,
    )
    linked_elements: list[dict[str, Any]] = [
        make_linked_element(
            item_type="improvement",
            item_id=improvement_id,
            title=safe_str(item.get("title")) or improvement_id,
            ref=prompt_path or safe_str(item.get("ownerSection")),
            source_agent_id=source_agent_id,
            source_url=safe_str(item.get("promptSourceUrl")) or None,
            open_mode="agent_card",
            importance="primary",
        ),
    ]
    if prompt_path:
        linked_elements.append(
            make_linked_element(
                item_type="doc",
                title=safe_str(item.get("promptTitle")) or prompt_path,
                ref=prompt_path,
                source_agent_id=source_agent_id,
                source_url=safe_str(item.get("promptSourceUrl")) or None,
                open_mode="modal",
                importance="supporting",
            )
        )
    origin_context = {
        "source": "improvement",
        "recommendation_id": None,
        "recommendation_text": None,
        "link_mode": "explicit",
        "linked_improvement_id": improvement_id,
        "similarity_score": 1.0,
        "origin_cycle_id": origin_cycle_id,
        "linked_improvement_snapshot": snapshot,
    }

    return {
        "goal": safe_str(item.get("title")),
        "expected_outcome": expected_outcome,
        "acceptance_criteria": acceptance_criteria,
        "constraints": [],
        "dependencies": [],
        "target_artifacts": target_artifacts,
        "priority_reason": priority_reason,
        "context_package": build_context_package(
            prompt_path=prompt_path,
            evidence_refs=evidence_refs,
            operational_memory=operational_memory,
            collaboration_plan=collaboration_plan,
            ab_test_plan=ab_test_plan,
        ),
        "context_to_task": context_to_task,
        "linked_elements": linked_elements,
        "origin_context": origin_context,
    }


def build_task_brief_for_recommendation(
    *,
    registry: dict[str, Any],
    source_agent_id: str,
    executor_agent_id: str,
    available_agent_ids: set[str],
    recommendation_id: str,
    rec_text: str,
    origin_ref: str,
    context_to_task_input: dict[str, Any] | None = None,
    linked_snapshot: dict[str, Any] | None = None,
    link_mode: str = "none",
    similarity_score: float | None = None,
    origin_cycle_id: str | None = None,
) -> dict[str, Any]:
    evidence_refs: list[str] = []
    if linked_snapshot:
        if safe_str(linked_snapshot.get("detectionBasis")):
            evidence_refs.append(safe_str(linked_snapshot.get("detectionBasis")))
        if safe_str(linked_snapshot.get("promptPath")):
            evidence_refs.append(safe_str(linked_snapshot.get("promptPath")))

    default_summary = rec_text
    default_why_now = "Рекомендация требует уточнения контекста постановки."
    execution_notes: list[str] = []
    linked_elements: list[dict[str, Any]] = []
    expected_outcome = ""
    acceptance_criteria: list[str] = []
    priority_reason = "requires_clarification"
    target_artifacts: list[str] = []

    if linked_snapshot:
        default_summary = f"{rec_text}. Точка роста: {safe_str(linked_snapshot.get('problem'))}"
        default_why_now = safe_str(linked_snapshot.get("detectionBasis")) or default_why_now
        expected_outcome = safe_str(linked_snapshot.get("effect")) or safe_str(linked_snapshot.get("expectedDelta"))
        priority_reason = default_why_now or priority_reason
        prompt_path = safe_str(linked_snapshot.get("promptPath"))
        if prompt_path:
            target_artifacts.append(prompt_path)
        owner_section = safe_str(linked_snapshot.get("ownerSection"))
        if owner_section:
            target_artifacts.append(f"section:{owner_section}")
        target_metric = safe_str(linked_snapshot.get("targetMetric"))
        expected_delta = safe_str(linked_snapshot.get("expectedDelta"))
        if target_metric:
            criterion = f"Target metric: {target_metric}"
            if expected_delta:
                criterion = f"{criterion}, expected delta: {expected_delta}"
            acceptance_criteria.append(criterion)
        execution_notes = [safe_str(linked_snapshot.get("solution")), safe_str(linked_snapshot.get("expectedDelta"))]
        linked_elements.append(
            make_linked_element(
                item_type="improvement",
                item_id=safe_str(linked_snapshot.get("id")),
                title=safe_str(linked_snapshot.get("title")) or "Связанное улучшение",
                ref=prompt_path or safe_str(linked_snapshot.get("ownerSection")),
                source_agent_id=safe_str(linked_snapshot.get("source_agent_id")) or source_agent_id,
                source_url=safe_str(linked_snapshot.get("promptSourceUrl")) or None,
                open_mode="agent_card",
                importance="primary",
            )
        )
        if prompt_path:
            linked_elements.append(
                make_linked_element(
                    item_type="doc",
                    title=safe_str(linked_snapshot.get("promptTitle")) or prompt_path,
                    ref=prompt_path,
                    source_agent_id=safe_str(linked_snapshot.get("source_agent_id")) or source_agent_id,
                    source_url=safe_str(linked_snapshot.get("promptSourceUrl")) or None,
                    open_mode="modal",
                    importance="supporting",
                )
            )

    context_to_task = normalize_context_to_task(
        context_to_task_input or {
            "summary": default_summary,
            "why_now": default_why_now,
            "execution_notes": execution_notes,
            "source_snapshot": linked_snapshot if linked_snapshot else None,
        },
        fallback_summary=default_summary,
        fallback_why_now=default_why_now,
    )
    target_metric = safe_str(linked_snapshot.get("targetMetric")) if linked_snapshot else ""
    expected_delta = safe_str(linked_snapshot.get("expectedDelta")) if linked_snapshot else ""
    hint_text = " ".join([
        rec_text,
        target_metric,
        safe_str(linked_snapshot.get("ownerSection")) if linked_snapshot else "",
        safe_str(linked_snapshot.get("promptPath")) if linked_snapshot else "",
        origin_ref,
    ])
    suggested_agents = suggest_collaboration_agents(
        source_agent_id=source_agent_id,
        executor_agent_id=executor_agent_id,
        available_agent_ids=available_agent_ids,
        hint_text=hint_text,
        linked_snapshot=linked_snapshot,
    )
    collaboration_plan = build_collaboration_plan(
        task_id=f"rec:{source_agent_id}:{recommendation_id}",
        root_agent_id=executor_agent_id,
        hint_text=hint_text,
        suggested_agents=suggested_agents,
        rationale="Соисполнители подобраны по тексту рекомендации и связанной точке роста.",
        registry=registry,
        target_metric=target_metric,
        owner_section=safe_str(linked_snapshot.get("ownerSection")) if linked_snapshot else "",
        linked_snapshot=linked_snapshot,
    )
    operational_memory = build_operational_memory_entries(
        goal=rec_text,
        summary=context_to_task.get("summary", ""),
        why_now=context_to_task.get("why_now", ""),
        target_metric=target_metric,
        expected_delta=expected_delta,
        source_ref=origin_ref,
    )
    ab_test_plan = build_ab_test_plan(
        enabled=linked_snapshot is not None,
        target_metric=target_metric,
        expected_delta=expected_delta,
    )

    linked_elements.insert(
        0,
        make_linked_element(
            item_type="recommendation",
            item_id=recommendation_id,
            title=rec_text or recommendation_id,
            ref=origin_ref,
            source_agent_id=source_agent_id,
            open_mode="text",
            importance="primary",
        ),
    )

    origin_context = {
        "source": "recommendation",
        "recommendation_id": recommendation_id,
        "recommendation_text": rec_text,
        "link_mode": link_mode,
        "linked_improvement_id": safe_str(linked_snapshot.get("id")) if linked_snapshot else None,
        "similarity_score": round(similarity_score, 4) if isinstance(similarity_score, float) else None,
        "origin_cycle_id": origin_cycle_id,
        "linked_improvement_snapshot": linked_snapshot,
    }
    return {
        "goal": safe_str(rec_text),
        "expected_outcome": expected_outcome,
        "acceptance_criteria": acceptance_criteria,
        "constraints": [],
        "dependencies": [],
        "target_artifacts": target_artifacts,
        "priority_reason": priority_reason,
        "context_package": build_context_package(
            prompt_path=safe_str(linked_snapshot.get("promptPath")) if linked_snapshot else "",
            evidence_refs=evidence_refs,
            operational_memory=operational_memory,
            collaboration_plan=collaboration_plan,
            ab_test_plan=ab_test_plan,
        ),
        "context_to_task": context_to_task,
        "linked_elements": linked_elements,
        "origin_context": origin_context,
    }


def build_seed_tasks(registry: dict[str, Any], executor_agent_id: str) -> list[dict[str, Any]]:
    agents = registry.get("agents") if isinstance(registry, dict) else None
    if not isinstance(agents, list):
        return []

    available_agent_ids = {
        safe_str(agent.get("id"))
        for agent in agents
        if isinstance(agent, dict) and safe_str(agent.get("id"))
    }
    result: list[dict[str, Any]] = []
    seen: set[str] = set()

    for agent in agents:
        if not isinstance(agent, dict):
            continue
        source_agent_id = safe_str(agent.get("id"))
        if not source_agent_id:
            continue

        improvements = agent.get("improvements")
        improvement_by_id, improvement_candidates = build_improvement_index(source_agent_id, improvements if isinstance(improvements, list) else [])
        if isinstance(improvements, list):
            for item in improvements:
                if not isinstance(item, dict):
                    continue
                title = safe_str(item.get("title"))
                if not title:
                    continue
                improvement_id = safe_str(item.get("id")) or f"imp-{source_agent_id}-{slugify(title)}"
                external_key = f"imp:{source_agent_id}:{slugify(title)}"
                if external_key in seen:
                    continue
                seen.add(external_key)
                evidence = []
                detection_basis = safe_str(item.get("detectionBasis"))
                prompt_path = safe_str(item.get("promptPath"))
                if detection_basis:
                    evidence.append(detection_basis)
                if prompt_path:
                    evidence.append(prompt_path)
                hint_text = " ".join([
                    title,
                    safe_str(item.get("ownerSection")),
                    safe_str(item.get("targetMetric")),
                    prompt_path,
                    detection_basis,
                ])
                task_executor_id = resolve_executor_agent_id(
                    default_executor_agent_id=executor_agent_id,
                    available_agent_ids=available_agent_ids,
                    hint_text=hint_text,
                    target_metric=safe_str(item.get("targetMetric")),
                    owner_section=safe_str(item.get("ownerSection")),
                    linked_snapshot=item if isinstance(item, dict) else None,
                )
                task_brief = build_task_brief_for_improvement(
                    registry=registry,
                    source_agent_id=source_agent_id,
                    executor_agent_id=task_executor_id,
                    available_agent_ids=available_agent_ids,
                    item=item,
                    improvement_id=improvement_id,
                    evidence_refs=evidence,
                    origin_cycle_id=safe_str(item.get("originCycleId")) or safe_str(item.get("origin_cycle_id")) or None,
                )
                result.append(
                    {
                        "external_key": external_key,
                        "title": title,
                        "source_agent_id": source_agent_id,
                        "executor_agent_id": task_executor_id,
                        "status": STATUS_READY,
                        "priority": normalize_priority(safe_str(item.get("priority"))),
                        "origin_type": "improvement",
                        "origin_ref": prompt_path or f"{source_agent_id}.improvements[{improvement_id}]",
                        "evidence_refs": evidence,
                        "task_brief": task_brief,
                    }
                )

        recommendations = agent.get("analystRecommendations")
        if isinstance(recommendations, list):
            for index, rec in enumerate(recommendations, start=1):
                normalized_rec = normalize_recommendation_entry(rec, index)
                title = safe_str(normalized_rec["text"])
                if not title:
                    continue
                external_key = f"rec:{source_agent_id}:{index}"
                if external_key in seen:
                    continue
                seen.add(external_key)
                origin_ref = f"{source_agent_id}.analystRecommendations[{index}]"
                recommendation_id = safe_str(normalized_rec["id"]) or f"rec-{index}"
                linked_improvement_id = safe_str(normalized_rec["linked_improvement_id"])
                linked_snapshot: dict[str, Any] | None = None
                link_mode = "none"
                similarity_score: float | None = None
                if linked_improvement_id and linked_improvement_id in improvement_by_id:
                    linked_snapshot = improvement_by_id[linked_improvement_id]["snapshot"]
                    link_mode = "explicit"
                    similarity_score = 1.0
                else:
                    fallback, score = match_improvement_for_recommendation(title, improvement_candidates)
                    if fallback:
                        linked_snapshot = fallback["snapshot"]
                        link_mode = "fallback"
                        similarity_score = score
                recommendation_target_metric = safe_str(linked_snapshot.get("targetMetric")) if linked_snapshot else ""
                recommendation_owner_section = safe_str(linked_snapshot.get("ownerSection")) if linked_snapshot else ""
                recommendation_hint_text = " ".join([
                    title,
                    recommendation_target_metric,
                    recommendation_owner_section,
                    origin_ref,
                ])
                task_executor_id = resolve_executor_agent_id(
                    default_executor_agent_id=executor_agent_id,
                    available_agent_ids=available_agent_ids,
                    hint_text=recommendation_hint_text,
                    target_metric=recommendation_target_metric,
                    owner_section=recommendation_owner_section,
                    linked_snapshot=linked_snapshot,
                )

                result.append(
                    {
                        "external_key": external_key,
                        "title": title,
                        "source_agent_id": source_agent_id,
                        "executor_agent_id": task_executor_id,
                        "status": STATUS_READY,
                        "priority": "medium",
                        "origin_type": "recommendation",
                        "origin_ref": origin_ref,
                        "evidence_refs": [],
                        "task_brief": build_task_brief_for_recommendation(
                            registry=registry,
                            source_agent_id=source_agent_id,
                            executor_agent_id=task_executor_id,
                            available_agent_ids=available_agent_ids,
                            recommendation_id=recommendation_id,
                            rec_text=title,
                            origin_ref=origin_ref,
                            context_to_task_input=normalized_rec["context_to_task"] if isinstance(normalized_rec["context_to_task"], dict) else None,
                            linked_snapshot=linked_snapshot,
                            link_mode=link_mode,
                            similarity_score=similarity_score,
                            origin_cycle_id=safe_str(normalized_rec["origin_cycle_id"]) or None,
                        ),
                    }
                )

    return result


def load_telemetry_events(log_dir: Path) -> list[dict[str, Any]]:
    if not log_dir.exists():
        return []

    events: list[dict[str, Any]] = []
    for file_path in sorted(log_dir.glob("*.jsonl")):
        with file_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                raw = line.strip()
                if not raw:
                    continue
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if not isinstance(event, dict):
                    continue
                task_id = safe_str(event.get("task_id"))
                if not task_id:
                    continue
                timestamp = parse_iso(safe_str(event.get("timestamp")))
                events.append(
                    {
                        "task_id": task_id,
                        "event_id": parse_uuid_or_none(safe_str(event.get("event_id"))),
                        "actor_agent_id": safe_str(event.get("agent_id")) or "unknown-agent",
                        "event_type": safe_str(event.get("step")) or "unknown_step",
                        "event_status": safe_str(event.get("status")),
                        "outcome": safe_str(event.get("outcome")),
                        "event_time": timestamp,
                        "payload": event,
                    }
                )
    events.sort(key=lambda item: item["event_time"] or dt.datetime.min.replace(tzinfo=dt.timezone.utc))
    return events


def execute_seed_collaboration_plans(
    tasks: list[dict[str, Any]],
    *,
    log_dir: Path,
    limit: int = 0,
    eligible_statuses_by_task: dict[str, str] | None = None,
) -> dict[str, Any]:
    dispatcher = get_dispatcher_module()
    report: dict[str, Any] = {
        "enabled": True,
        "limit": max(int(limit or 0), 0),
        "attempted": 0,
        "completed": 0,
        "failed": 0,
        "skipped": 0,
        "results": [],
    }
    max_runs = max(int(limit or 0), 0)

    for task in tasks:
        if max_runs and report["attempted"] >= max_runs:
            break
        brief = task.get("task_brief") if isinstance(task.get("task_brief"), dict) else {}
        context_package = brief.get("context_package") if isinstance(brief.get("context_package"), dict) else {}
        collaboration_plan = (
            context_package.get("collaboration_plan")
            if isinstance(context_package.get("collaboration_plan"), dict)
            else None
        )
        spawned_instances = (
            collaboration_plan.get("spawned_instances")
            if isinstance(collaboration_plan, dict) and isinstance(collaboration_plan.get("spawned_instances"), list)
            else []
        )
        task_id = safe_str(task.get("external_key")) or safe_str(task.get("title")) or "unknown-task"
        current_status = (
            safe_str((eligible_statuses_by_task or {}).get(task_id)).lower()
            if isinstance(eligible_statuses_by_task, dict)
            else ""
        )
        if current_status and current_status not in {STATUS_READY, STATUS_BACKLOG}:
            report["skipped"] += 1
            report["results"].append(
                {
                    "task_id": task_id,
                    "status": "skipped",
                    "reason": f"task_status_not_eligible({current_status})",
                }
            )
            continue
        if collaboration_plan is None or not spawned_instances:
            report["skipped"] += 1
            report["results"].append(
                {
                    "task_id": task_id,
                    "status": "skipped",
                    "reason": "collaboration_plan_missing_or_empty",
                }
            )
            continue

        report["attempted"] += 1
        try:
            execution = dispatcher.execute_collaboration_plan(
                task_id=task_id,
                collaboration_plan=collaboration_plan,
                log_dir=log_dir,
            )
        except Exception as exc:
            report["failed"] += 1
            report["results"].append(
                {
                    "task_id": task_id,
                    "status": "failed",
                    "error": str(exc),
                }
            )
            continue

        updated_collaboration_plan = merge_execution_into_collaboration_plan(collaboration_plan, execution)
        task_brief = task.get("task_brief") if isinstance(task.get("task_brief"), dict) else {}
        context_package = task_brief.get("context_package") if isinstance(task_brief.get("context_package"), dict) else {}
        context_package["collaboration_plan"] = updated_collaboration_plan
        task_brief["context_package"] = context_package
        task["task_brief"] = task_brief
        task["_execution_persisted"] = True

        report["completed"] += 1
        report["results"].append(
            {
                "task_id": task_id,
                "status": safe_str(execution.get("status")) or "completed",
                "interaction_mode": safe_str(execution.get("interaction_mode")) or None,
                "phases_total": len(execution.get("phases")) if isinstance(execution.get("phases"), list) else 0,
                "runs_total": int(execution.get("runs_total", 0) or 0),
                "persisted_to_task_brief": True,
            }
        )

    return report


def merge_execution_into_collaboration_plan(
    collaboration_plan: dict[str, Any],
    execution: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(collaboration_plan, dict):
        return {}
    if not isinstance(execution, dict):
        return copy.deepcopy(collaboration_plan)

    updated = copy.deepcopy(collaboration_plan)
    execution_phases = execution.get("phases") if isinstance(execution.get("phases"), list) else []
    execution_runs = execution.get("runs") if isinstance(execution.get("runs"), list) else []
    phase_reports = {
        safe_str(item.get("phase_id")): item
        for item in execution_phases
        if isinstance(item, dict) and safe_str(item.get("phase_id"))
    }
    run_reports = {
        safe_str(item.get("instance_id")): item
        for item in execution_runs
        if isinstance(item, dict) and safe_str(item.get("instance_id"))
    }

    interaction_phases = updated.get("interaction_phases") if isinstance(updated.get("interaction_phases"), list) else []
    if interaction_phases:
        for phase in interaction_phases:
            if not isinstance(phase, dict):
                continue
            phase_id = safe_str(phase.get("phase_id"))
            report = phase_reports.get(phase_id)
            if not report:
                continue
            phase["status"] = safe_str(report.get("status")) or safe_str(phase.get("status")) or "planned"
            participants = safe_list_str(report.get("participants"))
            if participants:
                phase["participants"] = participants
    elif phase_reports:
        updated["interaction_phases"] = [
            {
                "phase_id": phase_id,
                "label": safe_str(report.get("phase_id")) or phase_id,
                "mode": safe_str(report.get("mode")) or "sequential",
                "goal": "",
                "participants": safe_list_str(report.get("participants")),
                "depends_on": [],
                "outputs": [],
                "status": safe_str(report.get("status")) or "completed",
                "merge_into": None,
            }
            for phase_id, report in phase_reports.items()
        ]

    spawned_instances = updated.get("spawned_instances") if isinstance(updated.get("spawned_instances"), list) else []
    for instance in spawned_instances:
        if not isinstance(instance, dict):
            continue
        instance_id = safe_str(instance.get("instance_id"))
        report = run_reports.get(instance_id)
        if not report:
            continue
        instance["status"] = safe_str(report.get("status")) or safe_str(instance.get("status")) or "completed"
        instance["verify_status"] = safe_str(report.get("verify_status")) or safe_str(instance.get("verify_status")) or "passed"
        result_path = safe_str(report.get("result_path"))
        existing_output_refs = safe_list_str(instance.get("output_refs"))
        if result_path and result_path not in existing_output_refs:
            existing_output_refs.append(result_path)
        instance["output_refs"] = existing_output_refs

    roundtable_phase = phase_reports.get("phase_3_roundtable")
    if roundtable_phase and safe_str(roundtable_phase.get("status")) == "completed":
        discussion_rounds = updated.get("discussion_rounds") if isinstance(updated.get("discussion_rounds"), list) else []
        has_round_one = any(
            isinstance(item, dict) and safe_str(item.get("round_id")) == "round-1"
            for item in discussion_rounds
        )
        if not has_round_one:
            discussion_rounds.append(
                {
                    "round_id": "round-1",
                    "round_index": 1,
                    "participants": safe_list_str(roundtable_phase.get("participants")),
                    "summary": "Roundtable завершен через dispatcher-backed execution; итоговый owner может переходить к merge-фазе.",
                    "status": "completed",
                    "next_owner_agent_id": safe_str(updated.get("merge_owner_agent_id")) or None,
                }
            )
        updated["discussion_rounds"] = discussion_rounds

    return updated


def fetch_tasks_by_external_key(conn, *, db_schema: str) -> dict[str, dict[str, Any]]:
    rows = conn.execute(
        f"""
        select id, external_key, status
        from {db_schema}.agent_tasks
        """
    ).fetchall()
    return {row["external_key"]: row for row in rows}


def fetch_existing_telemetry_event_ids(conn, *, db_schema: str) -> set[UUID]:
    rows = conn.execute(
        f"""
        select telemetry_event_id
        from {db_schema}.agent_task_events
        where telemetry_event_id is not null
        """
    ).fetchall()
    return {row["telemetry_event_id"] for row in rows if row.get("telemetry_event_id")}


def upsert_seed_task(conn, task: dict[str, Any], *, db_schema: str) -> None:
    priority = task.get("priority")
    if priority not in VALID_PRIORITIES:
        priority = "medium"
    status = task.get("status")
    if status not in VALID_STATUSES:
        status = STATUS_READY

    conn.execute(
        f"""
        insert into {db_schema}.agent_tasks(
          external_key,
          title,
          source_agent_id,
          executor_agent_id,
          status,
          priority,
          origin_type,
          origin_ref,
          evidence_refs,
          task_brief
        )
        values (
          %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb
        )
        on conflict (external_key) do update set
          title = excluded.title,
          source_agent_id = excluded.source_agent_id,
          executor_agent_id = excluded.executor_agent_id,
          priority = excluded.priority,
          origin_type = excluded.origin_type,
          origin_ref = excluded.origin_ref,
          evidence_refs = excluded.evidence_refs,
          task_brief = case
            when nullif({db_schema}.agent_tasks.task_brief #>> '{{origin_context,origin_cycle_id}}', '') is not null then jsonb_set(
              excluded.task_brief,
              '{{origin_context}}',
              coalesce(excluded.task_brief -> 'origin_context', '{{}}'::jsonb) ||
                jsonb_build_object('origin_cycle_id', {db_schema}.agent_tasks.task_brief #>> '{{origin_context,origin_cycle_id}}'),
              true
            )
            when nullif(excluded.task_brief #>> '{{origin_context,origin_cycle_id}}', '') is not null then jsonb_set(
              excluded.task_brief,
              '{{origin_context}}',
              coalesce(excluded.task_brief -> 'origin_context', '{{}}'::jsonb) - 'origin_cycle_id',
              true
            )
            else excluded.task_brief
          end,
          updated_at = now()
        """,
        (
            task["external_key"],
            task["title"],
            task["source_agent_id"],
            task["executor_agent_id"],
            status,
            priority,
            task["origin_type"],
            task["origin_ref"],
            json.dumps(task["evidence_refs"], ensure_ascii=False),
            json.dumps(task.get("task_brief") or {}, ensure_ascii=False),
        ),
    )


def apply_telemetry_projection(
    conn,
    *,
    events: list[dict[str, Any]],
    db_schema: str,
) -> dict[str, int]:
    tasks = fetch_tasks_by_external_key(conn, db_schema=db_schema)
    existing_event_ids = fetch_existing_telemetry_event_ids(conn, db_schema=db_schema)

    counters = {
        "events_total": len(events),
        "events_inserted": 0,
        "status_updates": 0,
        "events_without_status_mapping": 0,
        "events_skipped_orphan_task": 0,
        "events_skipped_duplicate": 0,
    }

    for event in events:
        external_key = safe_str(event.get("task_id"))
        task_row = tasks.get(external_key)
        if not task_row:
            counters["events_skipped_orphan_task"] += 1
            continue

        next_status = normalize_event_status(event.get("event_status"), event.get("outcome"), event.get("event_type"))

        telemetry_event_id = event.get("event_id")
        if telemetry_event_id and telemetry_event_id in existing_event_ids:
            counters["events_skipped_duplicate"] += 1
            continue

        task_id = task_row["id"]
        current_status = task_row.get("status")
        event_time = event.get("event_time") or dt.datetime.now(dt.timezone.utc)
        payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}

        inserted = conn.execute(
            f"""
            insert into {db_schema}.agent_task_events(
              task_id,
              actor_agent_id,
              event_time,
              event_type,
              status_from,
              status_to,
              telemetry_event_id,
              payload
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            on conflict (telemetry_event_id) do nothing
            returning id
            """,
            (
                task_id,
                safe_str(event.get("actor_agent_id")) or "unknown-agent",
                event_time,
                safe_str(event.get("event_type")) or "unknown_step",
                current_status if current_status in VALID_STATUSES else None,
                next_status,
                telemetry_event_id,
                json.dumps(payload, ensure_ascii=False),
            ),
        ).fetchone()

        if not inserted:
            counters["events_skipped_duplicate"] += 1
            continue

        counters["events_inserted"] += 1
        if telemetry_event_id:
            existing_event_ids.add(telemetry_event_id)

        if next_status:
            conn.execute(
                f"""
                update {db_schema}.agent_tasks
                set status = %s,
                    last_event_at = %s,
                    updated_at = now()
                where id = %s
                """,
                (next_status, event_time, task_id),
            )
            counters["status_updates"] += 1
            task_row["status"] = next_status
        else:
            conn.execute(
                f"""
                update {db_schema}.agent_tasks
                set last_event_at = %s,
                    updated_at = now()
                where id = %s
                """,
                (event_time, task_id),
            )
            counters["events_without_status_mapping"] += 1

    return counters


def build_status_report(conn, *, db_schema: str) -> dict[str, Any]:
    status_rows = conn.execute(
        f"""
        select status, count(*)::bigint as total
        from {db_schema}.agent_tasks
        group by status
        order by status
        """
    ).fetchall()
    by_status = {row["status"]: int(row["total"]) for row in status_rows}
    total_tasks = sum(by_status.values())
    latest = conn.execute(
        f"""
        select external_key, title, status, source_agent_id, executor_agent_id, updated_at
        from {db_schema}.agent_tasks
        order by coalesce(last_event_at, updated_at, created_at) desc
        limit 20
        """
    ).fetchall()
    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "total_tasks": total_tasks,
        "status_counts": by_status,
        "latest_tasks": latest,
    }


def run_sync(args: argparse.Namespace) -> int:
    registry_path = Path(args.registry)
    registry = parse_registry(registry_path)
    agents_before = registry.get("agents") if isinstance(registry.get("agents"), list) else []
    known_agent_ids = {
        safe_str(item.get("id"))
        for item in agents_before
        if isinstance(item, dict) and safe_str(item.get("id"))
    }
    executor_agent_id = safe_str(args.executor_agent_id) or "analyst-agent"
    seeds = build_seed_tasks(registry, executor_agent_id)
    agents_after = registry.get("agents") if isinstance(registry.get("agents"), list) else []
    promoted_profiles: list[dict[str, Any]] = []
    for item in agents_after:
        if not isinstance(item, dict):
            continue
        profile_id = safe_str(item.get("id"))
        if not profile_id or profile_id in known_agent_ids:
            continue
        promoted_profiles.append(
            {
                "id": profile_id,
                "name": safe_str(item.get("name")) or profile_id,
                "agentClass": safe_str(item.get("agentClass")) or "specialist",
                "origin": safe_str(item.get("origin")) or "dynamic",
                "specializationScope": safe_str(item.get("specializationScope")),
            }
        )

    report: dict[str, Any] = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "registry_path": str(registry_path),
        "logs_dir": str(args.logs_dir),
        "seed_tasks": len(seeds),
        "dry_run": bool(args.dry_run),
        "execution_enabled": bool(args.execute_collaboration_plans),
        "execution_limit": max(int(getattr(args, "execution_limit", 0) or 0), 0),
        "promoted_profiles_total": len(promoted_profiles),
        "promoted_profile_ids": [item["id"] for item in promoted_profiles],
    }

    with connect(args.db) as conn:
        db_schema = resolve_db_schema(conn, getattr(args, "db_schema", DEFAULT_DB_SCHEMA))
        report["resolved_db_schema"] = db_schema
        with conn.cursor() as cur:
            before_total = cur.execute(
                f"select count(*)::bigint as total from {db_schema}.agent_tasks"
            ).fetchone()["total"]
        report["tasks_before"] = int(before_total)

        execution_report = {
            "enabled": bool(args.execute_collaboration_plans),
            "limit": max(int(getattr(args, "execution_limit", 0) or 0), 0),
            "attempted": 0,
            "completed": 0,
            "failed": 0,
            "skipped": 0,
            "results": [],
        }
        if args.dry_run:
            events = load_telemetry_events(Path(args.logs_dir))
            projection = {
                "events_total": len(events),
                "events_inserted": 0,
                "status_updates": 0,
                "events_without_status_mapping": 0,
                "events_skipped_orphan_task": 0,
                "events_skipped_duplicate": 0,
            }
        else:
            for task in seeds:
                upsert_seed_task(conn, task, db_schema=db_schema)
            task_status_snapshot = {
                external_key: safe_str(row.get("status")).lower()
                for external_key, row in fetch_tasks_by_external_key(conn, db_schema=db_schema).items()
            }
            if args.execute_collaboration_plans:
                execution_report = execute_seed_collaboration_plans(
                    seeds,
                    log_dir=Path(args.logs_dir),
                    limit=max(int(getattr(args, "execution_limit", 0) or 0), 0),
                    eligible_statuses_by_task=task_status_snapshot,
                )
                for task in seeds:
                    if task.get("_execution_persisted"):
                        upsert_seed_task(conn, task, db_schema=db_schema)
            events = load_telemetry_events(Path(args.logs_dir))
            projection = apply_telemetry_projection(conn, events=events, db_schema=db_schema)

        with conn.cursor() as cur:
            after_total = cur.execute(
                f"select count(*)::bigint as total from {db_schema}.agent_tasks"
            ).fetchone()["total"]
            row = cur.execute(
                f"""
                select count(*)::bigint as total
                from {db_schema}.agent_task_events
                """
            ).fetchone()
            events_total_db = int(row["total"])

        if args.dry_run:
            conn.rollback()
        else:
            conn.commit()

    registry_updated = False
    if not args.dry_run and promoted_profiles:
        write_registry(registry_path, registry)
        registry_updated = True

    report.update(
        {
            "tasks_after": int(after_total),
            "tasks_delta": int(after_total) - int(before_total),
            "task_events_total_db": events_total_db,
            "projection": projection,
            "execution": execution_report,
            "registry_updated": registry_updated,
        }
    )

    out_path = Path(args.out_json)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=json_default) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, default=json_default))
    return 0


def run_report(args: argparse.Namespace) -> int:
    with connect(args.db) as conn:
        db_schema = resolve_db_schema(conn, getattr(args, "db_schema", DEFAULT_DB_SCHEMA))
        report = build_status_report(conn, db_schema=db_schema)
        report["resolved_db_schema"] = db_schema
    out_path = Path(args.out_json)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, default=json_default) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, default=json_default))
    return 0


def main() -> int:
    args = parse_args()
    if args.command == "sync":
        return run_sync(args)
    if args.command == "report":
        return run_report(args)
    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
