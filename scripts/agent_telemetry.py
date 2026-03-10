#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import math
import re
import subprocess
import sys
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

CANONICAL_STEP_LABELS: dict[str, str] = {
    "step_0_intake": "0) task-intake/sync",
    "step_1_start": "1) started",
    "step_2_preflight": "2) preflight health-check",
    "step_3_orchestration": "3) orchestration (reuse-first)",
    "step_4_context_sync": "4) context / evidence sync",
    "step_5_role_window": "5) role window",
    "step_6_role_exit_decision": "6) role exit decision",
    "step_7_apply_or_publish": "7) apply / publish",
    "step_7_contract_gate": "7.1) contract gate",
    "step_8_verify": "8) verify",
    "step_8_error_channel": "8.1) error channel",
    "step_9_finalize": "9) learn + finalize",
    "step_9_publish_snapshots": "9.1) publish snapshots",
    "cycle_repair": "cycle_repair",
}

CANONICAL_CYCLE_STEP_SEQUENCE: list[str] = [
    "step_0_intake",
    "step_1_start",
    "step_2_preflight",
    "step_3_orchestration",
    "step_4_context_sync",
    "step_5_role_window",
    "step_6_role_exit_decision",
    "step_7_apply_or_publish",
    "step_7_contract_gate",
    "step_8_verify",
    "step_8_error_channel",
    "step_9_finalize",
    "step_9_publish_snapshots",
]
CANONICAL_CYCLE_STEP_SET: set[str] = set(CANONICAL_CYCLE_STEP_SEQUENCE)

STEP_ALIAS_TO_CANONICAL: dict[str, str] = {
    "step_0_intake": "step_0_intake",
    "task_intake": "step_0_intake",
    "intake": "step_0_intake",
    "sync": "step_0_intake",
    "step_1_start": "step_1_start",
    "started": "step_1_start",
    "start": "step_1_start",
    "step_2_preflight": "step_2_preflight",
    "preflight": "step_2_preflight",
    "step_2_health_check": "step_2_preflight",
    "health_check": "step_2_preflight",
    "healthcheck": "step_2_preflight",
    "step_3_orchestration": "step_3_orchestration",
    "orchestration": "step_3_orchestration",
    "plan": "step_3_orchestration",
    "step_4_context_sync": "step_4_context_sync",
    "context_sync": "step_4_context_sync",
    "step_4_evidence_sync": "step_4_context_sync",
    "evidence": "step_4_context_sync",
    "kb_sync": "step_4_context_sync",
    "source_monitor": "step_4_context_sync",
    "step_5_role_window": "step_5_role_window",
    "role_window": "step_5_role_window",
    "step_5_candidate_scoring": "step_5_role_window",
    "candidate_scoring": "step_5_role_window",
    "improvement_planning": "step_5_role_window",
    "step_6_role_exit_decision": "step_6_role_exit_decision",
    "role_exit_decision": "step_6_role_exit_decision",
    "step_6_priority_decision": "step_6_role_exit_decision",
    "priority_decision": "step_6_role_exit_decision",
    "step_7_apply_or_publish": "step_7_apply_or_publish",
    "step_7_apply": "step_7_apply_or_publish",
    "apply": "step_7_apply_or_publish",
    "apply_fix": "step_7_apply_or_publish",
    "implement": "step_7_apply_or_publish",
    "execute": "step_7_apply_or_publish",
    "publish": "step_7_apply_or_publish",
    "step_7_contract_gate": "step_7_contract_gate",
    "contract_gate": "step_7_contract_gate",
    "step_8_verify": "step_8_verify",
    "verify": "step_8_verify",
    "step_8_error_channel": "step_8_error_channel",
    "error_channel": "step_8_error_channel",
    "step_9_finalize": "step_9_finalize",
    "learn": "step_9_finalize",
    "finalize": "step_9_finalize",
    "step_9_publish_snapshots": "step_9_publish_snapshots",
    "publish_snapshots": "step_9_publish_snapshots",
    "knowledge_base_check": "step_4_context_sync",
    "external_monitor": "step_4_context_sync",
    "improvements_list": "step_5_role_window",
    "implementation_started": "step_1_start",
    "batch1_schema_registry_validation": "step_7_contract_gate",
    "batch2_ui_work_contour": "step_7_apply_or_publish",
    "batch3_telemetry_semantics_and_docs": "step_9_finalize",
    "batch4_legacy_telemetry_compat_ui": "step_7_apply_or_publish",
    "finalize_work_contour_migration": "step_9_finalize",
    "cycle_repair": "cycle_repair",
}

ANALYST_STEP_FALLBACK_ARTIFACTS: dict[str, dict[str, list[str]]] = {
    "step_0_intake": {
        "read": [
            "docs/agents/registry.yaml",
            "docs/agents/profile_templates.yaml",
            ".logs/agents/analyst-agent.jsonl",
        ],
        "write": [
            "agent_tasks.task_brief.context_package",
        ],
    },
    "step_1_start": {
        "read": [
            "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
            "docs/agents/registry.yaml",
        ],
        "write": [
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_2_preflight": {
        "read": [
            "docs/agents/registry.yaml",
            "artifacts/agent_telemetry_summary.json",
        ],
        "write": [
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_3_orchestration": {
        "read": [
            "docs/agents/registry.yaml",
            "docs/agents/profile_templates.yaml",
        ],
        "write": [
            "agent_tasks.task_brief.context_package",
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_4_context_sync": {
        "read": [
            ".specify/specs/001-oap/spec.md",
            ".specify/specs/001-oap/contracts/frontend-api.md",
            ".specify/specs/001-oap/contracts/datasets.md",
            "docs/subservices/oap/DESIGN_RULES.md",
            "docs/subservices/oap/agents-card.schema.json",
        ],
        "write": [
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_5_role_window": {
        "read": [
            "artifacts/agent_telemetry_summary.json",
            "docs/subservices/oap/DESIGN_RULES.md",
        ],
        "write": [
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_6_role_exit_decision": {
        "read": [
            "artifacts/agent_telemetry_summary.json",
            "docs/agents/registry.yaml",
        ],
        "write": [
            "docs/agents/registry.yaml",
            "agent_tasks.task_brief.context_package",
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_7_apply_or_publish": {
        "read": [
            "docs/agents/registry.yaml",
            "docs/subservices/oap/agents-card.schema.json",
            "ops-web/scripts/build_content_index.mjs",
        ],
        "write": [
            "docs/agents/registry.yaml",
            "ops-web/src/generated/agents-manifest.json",
            "ops-web/src/generated/docs-index.json",
            "ops-web/src/generated/search-index.json",
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_7_contract_gate": {
        "read": [
            "ops-web/src/generated/agents-manifest.json",
            "docs/subservices/oap/agents-card.schema.json",
            "ops-web/scripts/check_agents_manifest.mjs",
        ],
        "write": [
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_8_verify": {
        "read": [
            ".logs/agents/analyst-agent.jsonl",
            "artifacts/agent_telemetry_summary.json",
        ],
        "write": [
            "artifacts/agent_cycle_validation_report.json",
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_8_error_channel": {
        "read": [
            ".logs/agents/analyst-agent-errors.jsonl",
            ".logs/agents/analyst-agent.jsonl",
        ],
        "write": [
            ".logs/agents/analyst-agent-errors.jsonl",
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_9_finalize": {
        "read": [
            "docs/subservices/oap/tasks/lessons.global.md",
            "docs/subservices/oap/tasks/lessons/analyst-agent.md",
            "artifacts/agent_cycle_validation_report.json",
        ],
        "write": [
            "docs/subservices/oap/tasks/lessons/analyst-agent.md",
            "artifacts/agent_telemetry_summary.json",
            "artifacts/agent_telemetry_summary.md",
            ".logs/agents/analyst-agent.jsonl",
        ],
    },
    "step_9_publish_snapshots": {
        "read": [
            "artifacts/agent_telemetry_summary.json",
            "artifacts/agent_benchmark_summary.json",
            "artifacts/agent_latest_cycle_analyst.json",
        ],
        "write": [
            "ops-web/src/generated/agent-latest-cycle-analyst.json",
            "ops-web/src/generated/agent-benchmark-summary.json",
            "ops-web/public/generated/agent-latest-cycle-analyst.json",
            "ops-web/public/generated/agent-benchmark-summary.json",
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
LEGACY_SKILL_TO_TOOL = {
    "qmd-memory-retrieval": "QMD retrieval",
}
ORCHESTRATION_REUSE_STATUS = "agent_profile_reused"
ORCHESTRATION_CREATE_STATUS = "agent_profile_created"
ORCHESTRATION_INSTANCE_SPAWNED_STATUS = "agent_instance_spawned"
ORCHESTRATION_INSTANCE_COMPLETED_STATUS = "agent_instance_completed"
ORCHESTRATION_INSTANCE_FAILED_STATUS = "agent_instance_failed"
ORCHESTRATION_RETIRE_RECOMMENDED_STATUS = "agent_retire_recommended"
ORCHESTRATION_TERMINAL_INSTANCE_STATUSES = {
    ORCHESTRATION_INSTANCE_COMPLETED_STATUS,
    ORCHESTRATION_INSTANCE_FAILED_STATUS,
}
VALID_ARTIFACT_OPERATION_KINDS = {"read", "write", "create", "update", "delete"}
ARTIFACT_CONTRACT_VERSION = "v2"
VALID_ARTIFACT_OPS_ORIGINS = {"explicit", "mirrored_legacy", "step_fallback", "none"}
CAPABILITY_REFRESH_STARTED_STATUS = "capability_refresh_started"
CAPABILITY_REFRESH_COMPLETED_STATUS = "capability_refresh_completed"
CAPABILITY_REFRESH_FAILED_STATUS = "capability_refresh_failed"
SHADOW_TRIAL_PLAN_REFRESHED_STATUS = "shadow_trial_plan_refreshed"
SHADOW_TRIAL_JUDGED_STATUS = "shadow_trial_judged"
CAPABILITY_SNAPSHOT_PUBLISHED_STATUS = "capability_snapshot_published"
CAPABILITY_STALE_DETECTED_STATUS = "capability_stale_detected"
VALID_VERIFY_STATUSES = {"pending", "passed", "failed", "skipped"}
AUTO_CAPABILITY_REFRESH_FINAL_STEPS = {"step_9_finalize", "step_9_publish_snapshots"}
AUTO_CAPABILITY_REFRESH_MODES = {"off", "on_run"}
TAXONOMY_UNKNOWN_WARNING_THRESHOLD_PCT = 10.0
_SKILL_SHADOW_TRIAL_MODULE: Any | None = None


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


def safe_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def infer_artifact_source_kind(path: Any) -> str:
    value = safe_str(path).lower()
    if not value:
        return "unknown"
    if value.startswith("agent_tasks."):
        return "generated_artifact"
    if value == "docs/agents/registry.yaml":
        return "registry"
    if value == "docs/agents/profile_templates.yaml":
        return "template_catalog"
    if value.endswith("/operating_plan.md"):
        return "operating_plan"
    if value == "docs/subservices/oap/agents-card.schema.json":
        return "contract"
    if value.startswith(".specify/specs/001-oap/contracts/"):
        return "contract"
    if value.startswith(".specify/specs/001-oap/"):
        return "spec"
    if value.startswith(".logs/agents/"):
        return "telemetry_log"
    if value.startswith("artifacts/capability_trials/"):
        return "capability_snapshot"
    if value.startswith("artifacts/"):
        return "generated_artifact"
    if value.startswith("ops-web/src/generated/") or value.startswith("ops-web/public/generated/"):
        return "generated_artifact"
    return "unknown"


def infer_artifact_semantic_layer(path: Any, *, step: Any = "") -> str:
    value = safe_str(path).lower()
    if not value:
        return "unknown"
    step_key = normalize_step_name(step)
    if value in {"docs/agents/registry.yaml", "docs/agents/profile_templates.yaml"}:
        if step_key in {"step_0_intake", "step_3_orchestration"}:
            return "tools"
        if step_key in {"step_1_start", "step_6_role_exit_decision", "step_7_apply_or_publish"}:
            return "rules"
    if value == "agent_tasks.task_brief.context_package" or value.startswith("agent_tasks."):
        return "tasks"
    if value.startswith("docs/tasks/") or (value.endswith("/todo.md") and "/tasks/" in value):
        return "tasks"
    if value.endswith("/skill.md") or "/skills/" in value:
        return "skills"
    if value == ".mcp.json" or "/mcp/" in value or "context7" in value or "supabase" in value:
        return "mcp"
    if value.endswith("/operating_plan.md") or value.endswith("design_rules.md"):
        return "rules"
    if value == "agents.md" or "/decisions/" in value:
        return "rules"
    if value.startswith(".specify/specs/001-oap/"):
        return "schema"
    if value == "docs/subservices/oap/agents-card.schema.json" or "/contracts/" in value:
        return "schema"
    if (
        value.startswith(".logs/agents/")
        or value.startswith("artifacts/agent_telemetry_")
        or value.startswith("artifacts/agent_cycle_")
        or value.startswith("artifacts/agent_benchmark_")
        or value.startswith("artifacts/capability_trials/")
    ):
        return "telemetry"
    if "lessons.global.md" in value or "/tasks/lessons/" in value:
        return "memory"
    return "unknown"


def infer_artifact_reason(step: Any) -> str:
    step_key = normalize_step_name(step)
    reason_by_step = {
        "step_0_intake": "task_intake",
        "step_2_preflight": "health_check",
        "step_3_orchestration": "orchestration_lookup",
        "step_4_context_sync": "context_sync",
        "step_5_role_window": "role_decision",
        "step_6_role_exit_decision": "role_decision",
        "step_7_contract_gate": "contract_gate",
        "step_8_verify": "verify",
        "step_8_error_channel": "error_channel",
        "step_9_finalize": "lessons_update",
        "step_9_publish_snapshots": "publish_snapshot",
    }
    return reason_by_step.get(step_key, "unknown")


def infer_artifact_label(path: Any) -> str | None:
    value = safe_str(path)
    lowered = value.lower()
    if not value:
        return None
    if lowered == "docs/agents/registry.yaml":
        return "Реестр агентов"
    if lowered == "docs/agents/profile_templates.yaml":
        return "Template catalog"
    if lowered.endswith("/operating_plan.md"):
        return "Операционный стандарт агента"
    if lowered == "docs/subservices/oap/agents-card.schema.json":
        return "Schema: agents card"
    if lowered.startswith(".logs/agents/"):
        return f"Telemetry log: {Path(value).stem}"
    if lowered == "artifacts/agent_telemetry_summary.json":
        return "Telemetry summary"
    if lowered == "artifacts/agent_cycle_validation_report.json":
        return "Cycle validation report"
    if lowered == "artifacts/agent_latest_cycle_analyst.json":
        return "Latest cycle snapshot"
    if lowered.startswith("artifacts/capability_trials/"):
        return "Capability snapshot artifact"
    return Path(value).name or value


def make_artifact_ref(
    path: Any,
    *,
    step: Any = "",
    source_kind: str | None = None,
    semantic_layer: str | None = None,
    reason: str | None = None,
    label: str | None = None,
) -> dict[str, str]:
    path_value = safe_str(path)
    if not path_value:
        return {}
    source_value = safe_str(source_kind) or infer_artifact_source_kind(path_value)
    semantic_value = safe_str(semantic_layer) or infer_artifact_semantic_layer(path_value, step=step)
    reason_value = safe_str(reason) or infer_artifact_reason(step)
    label_value = safe_str(label) or infer_artifact_label(path_value) or path_value
    payload = {
        "path": path_value,
        "source_kind": source_value or "unknown",
        "semantic_layer": semantic_value or "unknown",
        "reason": reason_value or "unknown",
        "label": label_value,
    }
    return payload


def normalize_artifact_refs(values: Any, *, step: Any = "") -> list[dict[str, str]]:
    if values is None:
        return []
    normalized: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str, str]] = set()
    candidates: list[Any]
    if isinstance(values, list):
        candidates = values
    else:
        candidates = [values]
    for candidate in candidates:
        if isinstance(candidate, dict):
            ref = make_artifact_ref(
                candidate.get("path"),
                step=step,
                source_kind=safe_str(candidate.get("source_kind")) or None,
                semantic_layer=safe_str(candidate.get("semantic_layer")) or None,
                reason=safe_str(candidate.get("reason")) or None,
                label=safe_str(candidate.get("label")) or None,
            )
            if not ref:
                continue
            identity = (
                ref.get("path", ""),
                ref.get("source_kind", ""),
                ref.get("semantic_layer", ""),
                ref.get("reason", ""),
                ref.get("label", ""),
            )
            if identity in seen:
                continue
            seen.add(identity)
            normalized.append(ref)
            continue
        for part in safe_str(candidate).split(","):
            ref = make_artifact_ref(part, step=step)
            if not ref:
                continue
            identity = (
                ref.get("path", ""),
                ref.get("source_kind", ""),
                ref.get("semantic_layer", ""),
                ref.get("reason", ""),
                ref.get("label", ""),
            )
            if identity in seen:
                continue
            seen.add(identity)
            normalized.append(ref)
    return normalized


def normalize_step_name(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    normalized = re.sub(r"[^a-z0-9]+", "_", raw.lower()).strip("_")
    if not normalized:
        return ""
    mapped = STEP_ALIAS_TO_CANONICAL.get(normalized)
    if mapped:
        return mapped
    if normalized in CANONICAL_STEP_LABELS:
        return normalized
    return normalized


def resolve_step_label(step_key: str, fallback_raw: str = "") -> str:
    label = CANONICAL_STEP_LABELS.get(step_key)
    if label:
        return label
    raw = fallback_raw.strip()
    if raw:
        return raw
    return step_key


def is_canonical_cycle_step(step_key: str) -> bool:
    return step_key in CANONICAL_CYCLE_STEP_SET


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
    normalized: list[str] = []
    seen: set[str] = set()
    for ref in normalize_artifact_refs(values):
        value = safe_str(ref.get("path"))
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def compute_unknown_taxonomy_stats(refs: list[dict[str, Any]]) -> dict[str, float | int | None]:
    total = len(refs)
    unknown_source = sum(1 for ref in refs if safe_str(ref.get("source_kind")).lower() == "unknown")
    unknown_semantic = sum(1 for ref in refs if safe_str(ref.get("semantic_layer")).lower() == "unknown")
    unknown_source_rate = round((unknown_source / total) * 100, 2) if total > 0 else None
    unknown_semantic_rate = round((unknown_semantic / total) * 100, 2) if total > 0 else None
    return {
        "artifact_refs_total": total,
        "unknown_source_refs_total": unknown_source,
        "unknown_semantic_refs_total": unknown_semantic,
        "unknown_source_rate": unknown_source_rate,
        "unknown_semantic_rate": unknown_semantic_rate,
    }


def build_taxonomy_warnings(
    stats: dict[str, float | int | None],
    *,
    threshold_pct: float = TAXONOMY_UNKNOWN_WARNING_THRESHOLD_PCT,
) -> list[dict[str, Any]]:
    warnings: list[dict[str, Any]] = []
    unknown_source_rate = as_float(stats.get("unknown_source_rate"))
    unknown_semantic_rate = as_float(stats.get("unknown_semantic_rate"))
    if unknown_source_rate is not None and unknown_source_rate > threshold_pct:
        warnings.append(
            {
                "code": "unknown_source_rate_high",
                "message": "source_kind contains too many unknown values",
                "threshold_pct": threshold_pct,
                "actual_pct": round(unknown_source_rate, 2),
            }
        )
    if unknown_semantic_rate is not None and unknown_semantic_rate > threshold_pct:
        warnings.append(
            {
                "code": "unknown_semantic_rate_high",
                "message": "semantic_layer contains too many unknown values",
                "threshold_pct": threshold_pct,
                "actual_pct": round(unknown_semantic_rate, 2),
            }
        )
    return warnings


def normalize_artifact_operation_kind(value: Any) -> str:
    op = safe_str(value).lower()
    if not op:
        return ""
    if op in {"remove", "removed", "unlink", "drop", "rm", "erase"}:
        return "delete"
    if op in VALID_ARTIFACT_OPERATION_KINDS:
        return op
    return ""


def normalize_artifact_ops_origin(value: Any) -> str:
    origin = safe_str(value).lower()
    if origin in VALID_ARTIFACT_OPS_ORIGINS:
        return origin
    return ""


def infer_artifact_ops_origin(
    *,
    explicit_operations: list[dict[str, Any]],
    read_refs: list[dict[str, str]],
    write_refs: list[dict[str, str]],
    fallback_used: bool = False,
    preset: Any = None,
) -> str:
    preset_origin = normalize_artifact_ops_origin(preset)
    if preset_origin:
        return preset_origin
    if explicit_operations:
        return "explicit"
    if fallback_used:
        return "step_fallback"
    if read_refs or write_refs:
        return "mirrored_legacy"
    return "none"


def artifact_ref_from_operation(operation: dict[str, Any], *, step: Any = "") -> dict[str, str]:
    return make_artifact_ref(
        operation.get("path"),
        step=operation.get("step") or step,
        source_kind=safe_str(operation.get("source_kind")) or None,
        semantic_layer=safe_str(operation.get("semantic_layer")) or None,
        reason=safe_str(operation.get("reason")) or None,
        label=safe_str(operation.get("label")) or None,
    )


def parse_cli_artifact_operations(
    values: Any,
    *,
    step: str,
    timestamp: str,
    task_id: str,
    run_id: str,
    source: str = "telemetry",
) -> list[dict[str, str]]:
    if values is None:
        return []
    if isinstance(values, list):
        candidates = values
    else:
        candidates = [values]
    operations: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str, str]] = set()
    for candidate in candidates:
        raw = safe_str(candidate)
        if not raw:
            continue
        for part in raw.split(","):
            token = safe_str(part)
            if not token:
                continue
            if ":" not in token:
                continue
            op_raw, path_raw = token.split(":", 1)
            op = normalize_artifact_operation_kind(op_raw)
            if not op:
                continue
            ref = make_artifact_ref(path_raw, step=step)
            if not ref:
                continue
            payload = {
                "path": ref.get("path", ""),
                "op": op,
                "timestamp": timestamp,
                "step": step,
                "task_id": task_id,
                "run_id": run_id,
                "source": source,
                "source_kind": ref.get("source_kind", "unknown"),
                "semantic_layer": ref.get("semantic_layer", "unknown"),
                "reason": ref.get("reason", "unknown"),
                "label": ref.get("label", ref.get("path", "")),
            }
            identity = (
                payload.get("path", ""),
                payload.get("op", ""),
                payload.get("source_kind", ""),
                payload.get("semantic_layer", ""),
                payload.get("reason", ""),
            )
            if identity in seen:
                continue
            seen.add(identity)
            operations.append(payload)
    return operations


def build_artifact_operations_from_refs(
    *,
    read_refs: list[dict[str, str]],
    write_refs: list[dict[str, str]],
    step: str,
    timestamp: str,
    task_id: str,
    run_id: str,
    source: str,
    write_op: str = "write",
) -> list[dict[str, str]]:
    operations: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str, str]] = set()

    def push(ref: dict[str, str], op: str) -> None:
        normalized_op = normalize_artifact_operation_kind(op)
        if not normalized_op:
            return
        path = safe_str(ref.get("path"))
        if not path:
            return
        payload = {
            "path": path,
            "op": normalized_op,
            "timestamp": timestamp,
            "step": step,
            "task_id": task_id,
            "run_id": run_id,
            "source": source,
            "source_kind": safe_str(ref.get("source_kind")) or "unknown",
            "semantic_layer": safe_str(ref.get("semantic_layer")) or "unknown",
            "reason": safe_str(ref.get("reason")) or "unknown",
            "label": safe_str(ref.get("label")) or infer_artifact_label(path) or path,
        }
        identity = (
            payload.get("path", ""),
            payload.get("op", ""),
            payload.get("source_kind", ""),
            payload.get("semantic_layer", ""),
            payload.get("reason", ""),
        )
        if identity in seen:
            return
        seen.add(identity)
        operations.append(payload)

    for ref in read_refs:
        push(ref, "read")
    for ref in write_refs:
        push(ref, write_op)
    return operations


def normalize_artifact_operations(
    values: Any,
    *,
    step: str,
    timestamp: str,
    task_id: str,
    run_id: str,
    source: str,
) -> list[dict[str, str]]:
    if values is None:
        return []
    if isinstance(values, list):
        candidates = values
    else:
        candidates = [values]

    operations: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str, str]] = set()
    for candidate in candidates:
        if isinstance(candidate, dict):
            op = normalize_artifact_operation_kind(candidate.get("op"))
            ref = make_artifact_ref(
                candidate.get("path"),
                step=candidate.get("step") or step,
                source_kind=safe_str(candidate.get("source_kind")) or None,
                semantic_layer=safe_str(candidate.get("semantic_layer")) or None,
                reason=safe_str(candidate.get("reason")) or None,
                label=safe_str(candidate.get("label")) or None,
            )
            if not op or not ref:
                continue
            payload = {
                "path": ref.get("path", ""),
                "op": op,
                "timestamp": safe_str(candidate.get("timestamp")) or timestamp,
                "step": safe_str(candidate.get("step")) or step,
                "task_id": safe_str(candidate.get("task_id")) or task_id,
                "run_id": safe_str(candidate.get("run_id")) or run_id,
                "source": safe_str(candidate.get("source")) or source,
                "source_kind": ref.get("source_kind", "unknown"),
                "semantic_layer": ref.get("semantic_layer", "unknown"),
                "reason": ref.get("reason", "unknown"),
                "label": ref.get("label", ref.get("path", "")),
            }
            identity = (
                payload.get("path", ""),
                payload.get("op", ""),
                payload.get("source_kind", ""),
                payload.get("semantic_layer", ""),
                payload.get("reason", ""),
            )
            if identity in seen:
                continue
            seen.add(identity)
            operations.append(payload)
            continue

        token_values = parse_cli_artifact_operations(
            candidate,
            step=step,
            timestamp=timestamp,
            task_id=task_id,
            run_id=run_id,
            source=source,
        )
        for item in token_values:
            identity = (
                item.get("path", ""),
                item.get("op", ""),
                item.get("source_kind", ""),
                item.get("semantic_layer", ""),
                item.get("reason", ""),
            )
            if identity in seen:
                continue
            seen.add(identity)
            operations.append(item)

    return operations


def operation_to_file_edge_kind(op: str) -> str:
    normalized = normalize_artifact_operation_kind(op)
    if normalized == "read":
        return "read"
    if normalized == "delete":
        return "delete"
    return "write"


def split_artifact_refs_by_operation(
    operations: list[dict[str, Any]],
    *,
    step: str,
) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    read_refs = normalize_artifact_refs(
        [
            artifact_ref_from_operation(operation, step=step)
            for operation in operations
            if normalize_artifact_operation_kind(operation.get("op")) == "read"
        ],
        step=step,
    )
    write_refs = normalize_artifact_refs(
        [
            artifact_ref_from_operation(operation, step=step)
            for operation in operations
            if normalize_artifact_operation_kind(operation.get("op")) != "read"
        ],
        step=step,
    )
    return read_refs, write_refs


def unique_preserving_order(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for item in values:
        value = str(item or "").strip()
        if not value:
            continue
        if value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def normalize_tools_and_skills(tool_values: Any, skill_values: Any) -> tuple[list[str], list[str]]:
    raw_tools = normalize_artifact_list(tool_values)
    raw_skills = normalize_artifact_list(skill_values)

    tools: list[str] = []
    skills: list[str] = []
    tools_seen: set[str] = set()
    skills_seen: set[str] = set()

    for value in raw_tools:
        name = str(value or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in tools_seen:
            continue
        tools_seen.add(key)
        tools.append(name)

    for value in raw_skills:
        name = str(value or "").strip()
        if not name:
            continue
        mapped_tool = LEGACY_SKILL_TO_TOOL.get(name.lower())
        if mapped_tool:
            mapped_key = mapped_tool.lower()
            if mapped_key not in tools_seen:
                tools_seen.add(mapped_key)
                tools.append(mapped_tool)
            continue
        key = name.lower()
        if key in skills_seen:
            continue
        skills_seen.add(key)
        skills.append(name)

    return tools, skills


def build_log_event(args: argparse.Namespace) -> dict[str, Any]:
    timestamp = args.timestamp or utc_now_iso()
    run_id = normalize_id(args.run_id, str(uuid.uuid4()))
    trace_id = normalize_id(args.trace_id, str(uuid.uuid4()).replace("-", ""))
    task_id = args.task_id.strip()

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

    tools, skills = normalize_tools_and_skills(
        getattr(args, "tool", []) or [],
        getattr(args, "skill", []) or [],
    )
    step_raw = args.step.strip()
    step_key = normalize_step_name(step_raw)
    step_value = step_key or step_raw

    read_refs = normalize_artifact_refs(getattr(args, "artifact_read", []), step=step_value)
    write_refs = normalize_artifact_refs(getattr(args, "artifact_write", []), step=step_value)

    explicit_operations = normalize_artifact_operations(
        getattr(args, "artifact_op", []),
        step=step_value,
        timestamp=timestamp,
        task_id=task_id,
        run_id=run_id,
        source="telemetry",
    )
    if explicit_operations:
        artifact_operations = explicit_operations
        read_refs, write_refs = split_artifact_refs_by_operation(artifact_operations, step=step_value)
    else:
        artifact_operations = build_artifact_operations_from_refs(
            read_refs=read_refs,
            write_refs=write_refs,
            step=step_value,
            timestamp=timestamp,
            task_id=task_id,
            run_id=run_id,
            source="telemetry",
            write_op="write",
        )
    artifact_ops_origin = infer_artifact_ops_origin(
        explicit_operations=explicit_operations,
        read_refs=read_refs,
        write_refs=write_refs,
        fallback_used=False,
    )

    event: dict[str, Any] = {
        "version": LOG_VERSION,
        "artifact_contract_version": ARTIFACT_CONTRACT_VERSION,
        "artifact_ops_origin": artifact_ops_origin,
        "event_id": str(uuid.uuid4()),
        "timestamp": timestamp,
        "agent_id": args.agent_id.strip(),
        "process": args.process.strip(),
        "run_id": run_id,
        "trace_id": trace_id,
        "span_id": args.span_id.strip() if args.span_id else None,
        "task_id": task_id,
        "step": step_value,
        "step_raw": step_raw,
        "step_label": resolve_step_label(step_value, step_raw),
        "status": args.status.strip(),
        "outcome": args.outcome.strip() if args.outcome else None,
        "recommendation_id": args.recommendation_id.strip() if args.recommendation_id else None,
        "benchmark_run_id": args.benchmark_run_id.strip() if args.benchmark_run_id else None,
        "benchmark_case_id": args.benchmark_case_id.strip() if args.benchmark_case_id else None,
        "attempt_index": args.attempt_index if args.attempt_index is not None else None,
        "profile_id": args.profile_id.strip() if getattr(args, "profile_id", None) else None,
        "instance_id": args.instance_id.strip() if getattr(args, "instance_id", None) else None,
        "parent_instance_id": args.parent_instance_id.strip() if getattr(args, "parent_instance_id", None) else None,
        "root_agent_id": args.root_agent_id.strip() if getattr(args, "root_agent_id", None) else None,
        "depth": args.depth if getattr(args, "depth", None) is not None else None,
        "objective": args.objective.strip() if getattr(args, "objective", None) else None,
        "verify_status": normalize_verify_status(getattr(args, "verify_status", None)),
        "judge_model": args.judge_model.strip() if args.judge_model else None,
        "judge_score": args.judge_score if args.judge_score is not None else None,
        "mcp_tools": [item.strip() for item in (args.mcp or []) if item and item.strip()],
        "tools": tools,
        "skills": skills,
        "rules": [item.strip() for item in (getattr(args, "rule", []) or []) if item and item.strip()],
        "input_artifacts": normalize_artifact_list(getattr(args, "input_artifact", [])),
        "output_artifacts": normalize_artifact_list(getattr(args, "output_artifact", [])),
        "artifacts_read": read_refs,
        "artifacts_written": write_refs,
        "artifact_operations": artifact_operations,
        "metrics": metrics,
        "error": args.error.strip() if args.error else None,
    }
    return event


def apply_step_contract(event: dict[str, Any], mode: str) -> tuple[bool, str | None]:
    if mode not in {"warning", "strict"}:
        return True, None
    if str(event.get("agent_id") or "").strip() != LATEST_CYCLE_AGENT_ID:
        return True, None

    step_key = normalize_step_name(event.get("step") or event.get("step_raw"))
    if is_canonical_cycle_step(step_key) or step_key == "cycle_repair":
        return True, None

    message = (
        f"non-canonical step `{event.get('step')}` for analyst-agent; "
        f"expected canonical step_0..step_9_publish_snapshots"
    )
    if mode == "warning":
        metrics = event.get("metrics") if isinstance(event.get("metrics"), dict) else {}
        metrics["step_contract_violation"] = True
        metrics["step_contract_expected"] = "canonical_0_9_1"
        event["metrics"] = metrics
        event["step_contract"] = {
            "mode": "warning",
            "result": "violation",
            "message": message,
            "canonical_hint": "step_0_intake -> ... -> step_9_publish_snapshots",
        }
        return True, message

    return False, message


def _fallback_refs_for_step(step: str, paths: list[str]) -> list[dict[str, str]]:
    return [ref for ref in (make_artifact_ref(path, step=step) for path in paths) if ref]


def resolve_step_fallback_artifacts(step: str, status: str) -> dict[str, list[dict[str, str]]]:
    key = normalize_step_name(step)
    if key in ANALYST_STEP_FALLBACK_ARTIFACTS:
        payload = ANALYST_STEP_FALLBACK_ARTIFACTS[key]
        return {
            "read": _fallback_refs_for_step(key, list(payload.get("read", []))),
            "write": _fallback_refs_for_step(key, list(payload.get("write", []))),
        }
    raw_key = normalize_step_name(step.strip().lower())
    for alias, canonical in STEP_ALIAS_TO_CANONICAL.items():
        if alias and alias in raw_key and canonical in ANALYST_STEP_FALLBACK_ARTIFACTS:
            payload = ANALYST_STEP_FALLBACK_ARTIFACTS.get(canonical, {})
            return {
                "read": _fallback_refs_for_step(canonical, list(payload.get("read", []))),
                "write": _fallback_refs_for_step(canonical, list(payload.get("write", []))),
            }
    if status in CYCLE_FINAL_STATUSES:
        return {
            "read": _fallback_refs_for_step(key or step, list(FINAL_STATUS_ARTIFACT_FALLBACK.get("read", []))),
            "write": _fallback_refs_for_step(key or step, list(FINAL_STATUS_ARTIFACT_FALLBACK.get("write", []))),
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
        "unknown_source_rate": telemetry_agent.get("unknown_source_rate") if telemetry_agent else None,
        "unknown_semantic_rate": telemetry_agent.get("unknown_semantic_rate") if telemetry_agent else None,
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
        "unknown_source_rate": {
            "label": "Unknown source rate",
            "description": "Доля artifact refs, где source_kind остался unknown.",
            "formula": "unknown_source_refs_total / artifact_refs_total * 100",
            "source": ".logs/agents/analyst-agent.jsonl -> artifacts_read/artifacts_written",
        },
        "unknown_semantic_rate": {
            "label": "Unknown semantic rate",
            "description": "Доля artifact refs, где semantic_layer остался unknown.",
            "formula": "unknown_semantic_refs_total / artifact_refs_total * 100",
            "source": ".logs/agents/analyst-agent.jsonl -> artifacts_read/artifacts_written",
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
        "canonical_stages": [],
        "out_of_canon": [],
        "file_trace": {
            "edges": [],
            "fallback_used": False,
        },
        "taxonomy_guard": {
            "threshold_pct": TAXONOMY_UNKNOWN_WARNING_THRESHOLD_PCT,
            "artifact_refs_total": 0,
            "unknown_source_refs_total": 0,
            "unknown_semantic_refs_total": 0,
            "unknown_source_rate": None,
            "unknown_semantic_rate": None,
            "warnings": [],
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
    canonical_stage_events: dict[str, list[dict[str, Any]]] = defaultdict(list)
    out_of_canon: list[dict[str, Any]] = []
    file_edges: list[dict[str, Any]] = []
    fallback_used = False
    taxonomy_refs: list[dict[str, str]] = []

    for event in ordered_events:
        step_raw = str(event.get("step_raw") or event.get("step") or "").strip()
        step = normalize_step_name(event.get("step") or step_raw) or step_raw
        step_label = resolve_step_label(step, step_raw)
        status = normalize_status(event.get("status"))
        event_timestamp = coerce_timestamp(event.get("timestamp"))
        event_run_id = str(event.get("run_id") or "").strip()
        event_task_id = str(event.get("task_id") or latest_task_id).strip()
        event_metrics = event.get("metrics") if isinstance(event.get("metrics"), dict) else {}
        tokens_in = as_int(event_metrics.get("tokens_in")) or 0
        tokens_out = as_int(event_metrics.get("tokens_out")) or 0

        explicit_operations = normalize_artifact_operations(
            event.get("artifact_operations"),
            step=step,
            timestamp=str(event.get("timestamp") or event_timestamp or ""),
            task_id=event_task_id,
            run_id=event_run_id,
            source="telemetry",
        )
        source_read = "telemetry"
        source_write = "telemetry"
        fallback_step_used = False
        if explicit_operations:
            artifact_operations = explicit_operations
            read_refs, write_refs = split_artifact_refs_by_operation(artifact_operations, step=step)
        else:
            read_refs = normalize_artifact_refs(event.get("artifacts_read"), step=step)
            write_refs = normalize_artifact_refs(event.get("artifacts_written"), step=step)
            if not read_refs and not write_refs:
                fallback = resolve_step_fallback_artifacts(step, status)
                if fallback.get("read") or fallback.get("write"):
                    read_refs = normalize_artifact_refs(fallback.get("read", []), step=step)
                    write_refs = normalize_artifact_refs(fallback.get("write", []), step=step)
                    source_read = "fallback"
                    source_write = "fallback"
                    fallback_used = True
                    fallback_step_used = True

            artifact_operations = build_artifact_operations_from_refs(
                read_refs=read_refs,
                write_refs=write_refs,
                step=step,
                timestamp=str(event.get("timestamp") or event_timestamp or ""),
                task_id=event_task_id,
                run_id=event_run_id,
                source="fallback" if source_read == "fallback" or source_write == "fallback" else "telemetry",
                write_op="write",
            )
        artifact_ops_origin = infer_artifact_ops_origin(
            explicit_operations=explicit_operations,
            read_refs=read_refs,
            write_refs=write_refs,
            fallback_used=fallback_step_used,
            preset=event.get("artifact_ops_origin"),
        )
        artifact_contract_version = safe_str(event.get("artifact_contract_version")) or ARTIFACT_CONTRACT_VERSION

        timeline_event = {
            "timestamp": event_timestamp,
            "step": step,
            "step_raw": step_raw,
            "step_label": step_label,
            "status": status,
            "run_id": event_run_id,
            "trace_id": str(event.get("trace_id") or "").strip(),
            "recommendation_id": str(event.get("recommendation_id") or "").strip(),
            "outcome": str(event.get("outcome") or "").strip(),
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "artifacts_read": read_refs,
            "artifacts_written": write_refs,
            "artifacts_source": "fallback" if source_read == "fallback" or source_write == "fallback" else "telemetry",
            "artifact_contract_version": artifact_contract_version,
            "artifact_ops_origin": artifact_ops_origin,
        }
        if artifact_operations:
            timeline_event["artifact_operations"] = artifact_operations
        timeline.append(timeline_event)
        taxonomy_refs.extend(read_refs)
        taxonomy_refs.extend(write_refs)

        event_payload = {
            "timestamp": event_timestamp,
            "step": step,
            "step_raw": step_raw,
            "step_label": step_label,
            "status": status,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "artifacts_read": read_refs,
            "artifacts_written": write_refs,
            "artifacts_source": "fallback" if source_read == "fallback" or source_write == "fallback" else "telemetry",
            "artifact_contract_version": artifact_contract_version,
            "artifact_ops_origin": artifact_ops_origin,
        }
        if artifact_operations:
            event_payload["artifact_operations"] = artifact_operations
        if is_canonical_cycle_step(step):
            canonical_stage_events[step].append(event_payload)
        elif step and step != "cycle_repair":
            out_of_canon.append(event_payload)

        for operation in artifact_operations:
            ref = artifact_ref_from_operation(operation, step=step)
            path = ref.get("path")
            if not path:
                continue
            edge_source = "fallback" if safe_str(operation.get("source")).lower() == "fallback" else "telemetry"
            file_edges.append(
                {
                    "step": step,
                    "step_label": step_label,
                    "kind": operation_to_file_edge_kind(safe_str(operation.get("op"))),
                    "path": path,
                    "source_kind": ref.get("source_kind"),
                    "semantic_layer": ref.get("semantic_layer"),
                    "reason": ref.get("reason"),
                    "label": ref.get("label"),
                    "source": edge_source,
                }
            )

    canonical_stages: list[dict[str, Any]] = []
    for step_key in CANONICAL_CYCLE_STEP_SEQUENCE:
        events_for_step = canonical_stage_events.get(step_key, [])
        if not events_for_step:
            canonical_stages.append(
                {
                    "step_key": step_key,
                    "step_label": resolve_step_label(step_key),
                    "executed": False,
                    "events_total": 0,
                    "started_at": None,
                    "last_event_at": None,
                    "status": None,
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "tokens_total": 0,
                    "artifacts_read": [],
                    "artifacts_written": [],
                    "raw_steps": [],
                }
            )
            continue

        timestamps = [str(item.get("timestamp") or "") for item in events_for_step if item.get("timestamp")]
        started_at = min(timestamps) if timestamps else None
        last_event_at = max(timestamps) if timestamps else None
        status = str(events_for_step[-1].get("status") or "").strip() or None
        tokens_in_sum = sum(int(item.get("tokens_in") or 0) for item in events_for_step)
        tokens_out_sum = sum(int(item.get("tokens_out") or 0) for item in events_for_step)
        artifacts_read = normalize_artifact_refs(
            [ref for item in events_for_step for ref in normalize_artifact_refs(item.get("artifacts_read"), step=step_key)],
            step=step_key,
        )
        artifacts_written = normalize_artifact_refs(
            [ref for item in events_for_step for ref in normalize_artifact_refs(item.get("artifacts_written"), step=step_key)],
            step=step_key,
        )
        raw_steps = unique_preserving_order(
            [str(item.get("step_raw") or "").strip() for item in events_for_step if str(item.get("step_raw") or "").strip()]
        )
        canonical_stages.append(
            {
                "step_key": step_key,
                "step_label": resolve_step_label(step_key),
                "executed": True,
                "events_total": len(events_for_step),
                "started_at": started_at,
                "last_event_at": last_event_at,
                "status": status,
                "tokens_in": tokens_in_sum,
                "tokens_out": tokens_out_sum,
                "tokens_total": tokens_in_sum + tokens_out_sum,
                "artifacts_read": artifacts_read,
                "artifacts_written": artifacts_written,
                "raw_steps": raw_steps,
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
    base_payload["canonical_stages"] = canonical_stages
    base_payload["out_of_canon"] = out_of_canon
    taxonomy_stats = compute_unknown_taxonomy_stats(normalize_artifact_refs(taxonomy_refs))
    taxonomy_warnings = build_taxonomy_warnings(taxonomy_stats)
    metrics["unknown_source_rate"] = taxonomy_stats.get("unknown_source_rate")
    metrics["unknown_semantic_rate"] = taxonomy_stats.get("unknown_semantic_rate")
    base_payload["taxonomy_guard"] = {
        "threshold_pct": TAXONOMY_UNKNOWN_WARNING_THRESHOLD_PCT,
        **taxonomy_stats,
        "warnings": taxonomy_warnings,
    }
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


def _load_skill_shadow_trial_module() -> Any | None:
    global _SKILL_SHADOW_TRIAL_MODULE
    if _SKILL_SHADOW_TRIAL_MODULE is not None:
        return _SKILL_SHADOW_TRIAL_MODULE
    module_path = Path(__file__).resolve().with_name("skill_shadow_trial_runner.py")
    spec = importlib.util.spec_from_file_location("skill_shadow_trial_runner", module_path)
    if spec is None or spec.loader is None:
        return None
    module = importlib.util.module_from_spec(spec)
    try:
        sys.modules[spec.name] = module
        spec.loader.exec_module(module)  # type: ignore[attr-defined]
    except Exception:
        return None
    _SKILL_SHADOW_TRIAL_MODULE = module
    return module


def _has_capability_refresh_completed_for_run(
    *,
    log_dir: Path,
    agent_id: str,
    task_id: str,
    run_id: str,
) -> bool:
    target = log_dir / f"{agent_id}.jsonl"
    if not target.exists():
        return False
    try:
        with target.open("r", encoding="utf-8") as handle:
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
                if normalize_status(event.get("status")) != CAPABILITY_REFRESH_COMPLETED_STATUS:
                    continue
                if str(event.get("task_id") or "").strip() != task_id:
                    continue
                if str(event.get("run_id") or "").strip() != run_id:
                    continue
                if str(event.get("agent_id") or "").strip() != agent_id:
                    continue
                return True
    except OSError:
        return False
    return False


def _build_capability_refresh_event(
    *,
    root_event: dict[str, Any],
    status: str,
    outcome: str,
    artifact_read: list[Any],
    artifact_write: list[Any],
    tokens_in: int,
    tokens_out: int,
    error: str | None = None,
) -> dict[str, Any]:
    step = "step_9_publish_snapshots"
    reason = "capability_refresh" if status != CAPABILITY_SNAPSHOT_PUBLISHED_STATUS else "publish_snapshot"
    event_timestamp = utc_now_iso()
    run_id = str(root_event.get("run_id") or "").strip()
    task_id = str(root_event.get("task_id") or "").strip()
    read_refs = normalize_artifact_refs(
        [
            make_artifact_ref(item, step=step, reason=reason)
            if not isinstance(item, dict)
            else {**item, "reason": safe_str(item.get("reason")) or reason}
            for item in artifact_read
        ],
        step=step,
    )
    write_refs = normalize_artifact_refs(
        [
            make_artifact_ref(item, step=step, reason=reason)
            if not isinstance(item, dict)
            else {**item, "reason": safe_str(item.get("reason")) or reason}
            for item in artifact_write
        ],
        step=step,
    )
    artifact_operations = build_artifact_operations_from_refs(
        read_refs=read_refs,
        write_refs=write_refs,
        step=step,
        timestamp=event_timestamp,
        task_id=task_id,
        run_id=run_id,
        source="telemetry",
        write_op="write",
    )
    artifact_ops_origin = infer_artifact_ops_origin(
        explicit_operations=[],
        read_refs=read_refs,
        write_refs=write_refs,
        fallback_used=False,
        preset="mirrored_legacy",
    )
    return {
        "version": LOG_VERSION,
        "artifact_contract_version": ARTIFACT_CONTRACT_VERSION,
        "artifact_ops_origin": artifact_ops_origin,
        "event_id": str(uuid.uuid4()),
        "timestamp": event_timestamp,
        "agent_id": str(root_event.get("agent_id") or "").strip(),
        "process": "capability_refresh_subflow",
        "run_id": run_id,
        "trace_id": str(root_event.get("trace_id") or "").strip(),
        "span_id": None,
        "task_id": task_id,
        "step": step,
        "step_raw": step,
        "step_label": resolve_step_label(step),
        "status": status,
        "outcome": outcome,
        "recommendation_id": None,
        "benchmark_run_id": None,
        "benchmark_case_id": None,
        "attempt_index": None,
        "profile_id": None,
        "instance_id": None,
        "parent_instance_id": None,
        "root_agent_id": str(root_event.get("agent_id") or "").strip() or None,
        "depth": 0,
        "objective": "capability_refresh",
        "verify_status": "pending",
        "judge_model": None,
        "judge_score": None,
        "mcp_tools": [],
        "tools": [],
        "skills": [],
        "rules": [],
        "input_artifacts": [],
        "output_artifacts": [],
        "artifacts_read": read_refs,
        "artifacts_written": write_refs,
        "artifact_operations": artifact_operations,
        "metrics": {
            "tokens_in": max(0, int(tokens_in)),
            "tokens_out": max(0, int(tokens_out)),
        },
        "error": safe_str(error) or None,
    }


def _sync_generated_content_after_refresh(log_dir: Path) -> None:
    repo_root = Path(__file__).resolve().parents[1]
    default_log_dir = repo_root / ".logs" / "agents"
    try:
        if log_dir.resolve() != default_log_dir.resolve():
            return
    except OSError:
        return
    script_path = repo_root / "ops-web" / "scripts" / "build_content_index.mjs"
    if not script_path.exists():
        return
    completed = subprocess.run(
        ["node", str(script_path)],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "prepare_content_failed").strip()
        print(f"[agent-telemetry] capability refresh content sync skipped: {detail[:240]}")


def maybe_auto_capability_refresh(
    *,
    args: argparse.Namespace,
    root_event: dict[str, Any],
    log_dir: Path,
) -> None:
    mode = safe_str(getattr(args, "auto_capability_refresh", "on_run")).lower() or "on_run"
    if mode not in AUTO_CAPABILITY_REFRESH_MODES or mode != "on_run":
        return

    status = normalize_status(root_event.get("status"))
    if status not in CYCLE_FINAL_STATUSES:
        return

    step_key = normalize_step_name(root_event.get("step") or root_event.get("step_raw"))
    if step_key not in AUTO_CAPABILITY_REFRESH_FINAL_STEPS:
        return

    agent_id = str(root_event.get("agent_id") or "").strip()
    task_id = str(root_event.get("task_id") or "").strip()
    run_id = str(root_event.get("run_id") or "").strip()
    if not agent_id or not task_id or not run_id:
        return

    if _has_capability_refresh_completed_for_run(
        log_dir=log_dir,
        agent_id=agent_id,
        task_id=task_id,
        run_id=run_id,
    ):
        return

    shadow_trial = _load_skill_shadow_trial_module()
    if shadow_trial is None:
        return

    try:
        registry_path = getattr(shadow_trial, "DEFAULT_REGISTRY_PATH", None)
        load_registry = getattr(shadow_trial, "load_registry", None)
        find_agent = getattr(shadow_trial, "find_agent", None)
        resolve_policy = getattr(shadow_trial, "resolve_capability_optimization", None)
        refresh_agent_capabilities = getattr(shadow_trial, "refresh_agent_capabilities", None)
        if (
            registry_path is None
            or load_registry is None
            or find_agent is None
            or resolve_policy is None
            or refresh_agent_capabilities is None
        ):
            return

        registry = load_registry(Path(registry_path))
        agent = find_agent(registry, agent_id)
        policy = resolve_policy(agent)
        if not bool(getattr(policy, "enabled", False)):
            return
        if safe_str(getattr(policy, "refresh_mode", "")).lower() != "on_run":
            return

        started_event = _build_capability_refresh_event(
            root_event=root_event,
            status=CAPABILITY_REFRESH_STARTED_STATUS,
            outcome="capability refresh subflow started",
            artifact_read=["docs/agents/registry.yaml"],
            artifact_write=[],
            tokens_in=64,
            tokens_out=18,
        )
        append_event(log_dir, started_event)

        refresh_result = refresh_agent_capabilities(
            registry=registry,
            agent_id=agent_id,
            last_run_id=run_id,
            tasks_per_trial=max(3, int(getattr(policy, "min_shadow_sample_size", 3) or 3)),
        )

        if bool(refresh_result.get("stale_before_refresh")):
            stale_reason = safe_str(refresh_result.get("stale_before_refresh_reason")) or "snapshot_missing"
            stale_event = _build_capability_refresh_event(
                root_event=root_event,
                status=CAPABILITY_STALE_DETECTED_STATUS,
                outcome=f"stale detected before refresh: {stale_reason}",
                artifact_read=[safe_str(refresh_result.get("snapshot_path")) or f"artifacts/capability_trials/{agent_id}/capability_snapshot.json"],
                artifact_write=[],
                tokens_in=16,
                tokens_out=10,
            )
            append_event(log_dir, stale_event)

        plan_event = _build_capability_refresh_event(
            root_event=root_event,
            status=SHADOW_TRIAL_PLAN_REFRESHED_STATUS,
            outcome="shadow trial plan refreshed",
            artifact_read=["docs/agents/registry.yaml"],
            artifact_write=[safe_str(refresh_result.get("plan_path")) or f"artifacts/capability_trials/{agent_id}/shadow_trial_plan.json"],
            tokens_in=42,
            tokens_out=24,
        )
        append_event(log_dir, plan_event)

        judgement_path = safe_str(refresh_result.get("judgement_path"))
        if judgement_path or int(refresh_result.get("judgements_total") or 0) > 0:
            judged_event = _build_capability_refresh_event(
                root_event=root_event,
                status=SHADOW_TRIAL_JUDGED_STATUS,
                outcome="shadow trial judgement linked into capability snapshot",
                artifact_read=[judgement_path] if judgement_path else [],
                artifact_write=[safe_str(refresh_result.get("snapshot_path")) or f"artifacts/capability_trials/{agent_id}/capability_snapshot.json"],
                tokens_in=26,
                tokens_out=14,
            )
            append_event(log_dir, judged_event)

        published_event = _build_capability_refresh_event(
            root_event=root_event,
            status=CAPABILITY_SNAPSHOT_PUBLISHED_STATUS,
            outcome="capability snapshot written",
            artifact_read=[
                safe_str(refresh_result.get("plan_path")) or f"artifacts/capability_trials/{agent_id}/shadow_trial_plan.json",
                judgement_path,
            ],
            artifact_write=[safe_str(refresh_result.get("snapshot_path")) or f"artifacts/capability_trials/{agent_id}/capability_snapshot.json"],
            tokens_in=34,
            tokens_out=22,
        )
        append_event(log_dir, published_event)

        completed_event = _build_capability_refresh_event(
            root_event=root_event,
            status=CAPABILITY_REFRESH_COMPLETED_STATUS,
            outcome="capability refresh subflow completed",
            artifact_read=[safe_str(refresh_result.get("snapshot_path")) or f"artifacts/capability_trials/{agent_id}/capability_snapshot.json"],
            artifact_write=[],
            tokens_in=18,
            tokens_out=12,
        )
        append_event(log_dir, completed_event)
        _sync_generated_content_after_refresh(log_dir)
    except Exception as exc:
        failed_event = _build_capability_refresh_event(
            root_event=root_event,
            status=CAPABILITY_REFRESH_FAILED_STATUS,
            outcome="capability refresh subflow failed",
            artifact_read=["docs/agents/registry.yaml"],
            artifact_write=[],
            tokens_in=10,
            tokens_out=6,
            error=safe_str(exc) or "capability_refresh_failed",
        )
        append_event(log_dir, failed_event)


def coerce_timestamp(value: Any) -> str | None:
    parsed = parse_iso8601(str(value)) if value is not None else None
    return parsed.isoformat().replace("+00:00", "Z") if parsed else None


def normalize_status(value: Any) -> str:
    return str(value or "").strip().lower()


def normalize_verify_status(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in VALID_VERIFY_STATUSES:
        return normalized
    return "pending"


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
                "tool_usage": Counter(),
                "profile_usage": Counter(),
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
                "_created_profiles": set(),
                "_orchestration_reused": 0,
                "_orchestration_created": 0,
                "_instances_spawned": 0,
                "_instances_completed": 0,
                "_instances_failed": 0,
                "_retire_recommended": 0,
                "_specialist_verify_pass": 0,
                "_specialist_verify_total": 0,
                "_tool_overreach_events": 0,
                "_instance_spans": {},
                "_cycle_events_total": 0,
                "_canonical_cycle_events": 0,
                "_non_canonical_events_total": 0,
                "_task_canonical_steps": defaultdict(set),
                "_task_non_canonical_steps": defaultdict(set),
                "_capability_refresh_started": 0,
                "_capability_refresh_completed": 0,
                "_capability_refresh_failed": 0,
                "_shadow_trial_plan_refreshed": 0,
                "_shadow_trial_judged": 0,
                "_capability_snapshot_published": 0,
                "_capability_stale_detected": 0,
                "_capability_refresh_completed_tasks": set(),
                "_artifact_refs_total": 0,
                "_unknown_source_refs_total": 0,
                "_unknown_semantic_refs_total": 0,
                "_file_ops_v2_events_total": 0,
                "_file_ops_eligible_events": 0,
                "_file_ops_explicit_events": 0,
                "_file_ops_mirrored_legacy_events": 0,
                "_file_ops_step_fallback_events": 0,
                "_file_ops_operations_total": 0,
                "_file_ops_delete_total": 0,
                "cost_usd_total": 0.0,
            },
        )

        item["events_total"] += 1
        status = str(event.get("status") or "").strip()
        step = normalize_step_name(event.get("step") or event.get("step_raw"))
        profile_id = str(event.get("profile_id") or "").strip()
        instance_id = str(event.get("instance_id") or "").strip()
        task_id = str(event.get("task_id") or "").strip()
        verify_status = normalize_verify_status(event.get("verify_status"))
        event_ts_dt = parse_iso8601(str(event.get("timestamp") or ""))
        if status:
            item["status_counts"][status] += 1
        if profile_id:
            item["profile_usage"][profile_id] += 1

        if status == ORCHESTRATION_REUSE_STATUS:
            item["_orchestration_reused"] += 1
        elif status == ORCHESTRATION_CREATE_STATUS:
            item["_orchestration_created"] += 1
            if profile_id:
                item["_created_profiles"].add(profile_id)
        elif status == ORCHESTRATION_INSTANCE_SPAWNED_STATUS:
            item["_instances_spawned"] += 1
        elif status == ORCHESTRATION_INSTANCE_COMPLETED_STATUS:
            item["_instances_completed"] += 1
        elif status == ORCHESTRATION_INSTANCE_FAILED_STATUS:
            item["_instances_failed"] += 1
        elif status == ORCHESTRATION_RETIRE_RECOMMENDED_STATUS:
            item["_retire_recommended"] += 1
        elif status == CAPABILITY_REFRESH_STARTED_STATUS:
            item["_capability_refresh_started"] += 1
        elif status == CAPABILITY_REFRESH_COMPLETED_STATUS:
            item["_capability_refresh_completed"] += 1
            if task_id:
                item["_capability_refresh_completed_tasks"].add(task_id)
        elif status == CAPABILITY_REFRESH_FAILED_STATUS:
            item["_capability_refresh_failed"] += 1
        elif status == SHADOW_TRIAL_PLAN_REFRESHED_STATUS:
            item["_shadow_trial_plan_refreshed"] += 1
        elif status == SHADOW_TRIAL_JUDGED_STATUS:
            item["_shadow_trial_judged"] += 1
        elif status == CAPABILITY_SNAPSHOT_PUBLISHED_STATUS:
            item["_capability_snapshot_published"] += 1
        elif status == CAPABILITY_STALE_DETECTED_STATUS:
            item["_capability_stale_detected"] += 1

        if status in ORCHESTRATION_TERMINAL_INSTANCE_STATUSES and verify_status in {"passed", "failed"}:
            item["_specialist_verify_total"] += 1
            if verify_status == "passed":
                item["_specialist_verify_pass"] += 1

        if task_id:
            item["_tasks"].add(task_id)
        if step and step != "cycle_repair":
            item["_cycle_events_total"] += 1
            if is_canonical_cycle_step(step):
                item["_canonical_cycle_events"] += 1
                if task_id:
                    item["_task_canonical_steps"][task_id].add(step)
            else:
                item["_non_canonical_events_total"] += 1
                if task_id:
                    item["_task_non_canonical_steps"][task_id].add(step)

        explicit_event_operations = normalize_artifact_operations(
            event.get("artifact_operations"),
            step=step or safe_str(event.get("step")),
            timestamp=safe_str(event.get("timestamp")),
            task_id=task_id,
            run_id=safe_str(event.get("run_id")),
            source="telemetry",
        )
        if explicit_event_operations:
            event_read_refs, event_write_refs = split_artifact_refs_by_operation(explicit_event_operations, step=step)
        else:
            event_read_refs = normalize_artifact_refs(event.get("artifacts_read"), step=step)
            event_write_refs = normalize_artifact_refs(event.get("artifacts_written"), step=step)
        event_operations = (
            explicit_event_operations
            if explicit_event_operations
            else build_artifact_operations_from_refs(
                read_refs=event_read_refs,
                write_refs=event_write_refs,
                step=step or safe_str(event.get("step")),
                timestamp=safe_str(event.get("timestamp")),
                task_id=task_id,
                run_id=safe_str(event.get("run_id")),
                source="telemetry",
                write_op="write",
            )
        )
        event_ops_origin = infer_artifact_ops_origin(
            explicit_operations=explicit_event_operations,
            read_refs=event_read_refs,
            write_refs=event_write_refs,
            fallback_used=False,
            preset=event.get("artifact_ops_origin"),
        )
        event_contract_version = safe_str(event.get("artifact_contract_version")).lower()
        if event_contract_version == ARTIFACT_CONTRACT_VERSION:
            item["_file_ops_v2_events_total"] += 1
            if event_operations:
                item["_file_ops_eligible_events"] += 1
                if event_ops_origin == "explicit":
                    item["_file_ops_explicit_events"] += 1
                elif event_ops_origin == "mirrored_legacy":
                    item["_file_ops_mirrored_legacy_events"] += 1
                elif event_ops_origin == "step_fallback":
                    item["_file_ops_step_fallback_events"] += 1
            item["_file_ops_operations_total"] += len(event_operations)
            item["_file_ops_delete_total"] += sum(
                1
                for op_item in event_operations
                if operation_to_file_edge_kind(safe_str(op_item.get("op"))) == "delete"
            )
        event_ref_stats = compute_unknown_taxonomy_stats(
            normalize_artifact_refs([*event_read_refs, *event_write_refs], step=step)
        )
        item["_artifact_refs_total"] += int(event_ref_stats.get("artifact_refs_total") or 0)
        item["_unknown_source_refs_total"] += int(event_ref_stats.get("unknown_source_refs_total") or 0)
        item["_unknown_semantic_refs_total"] += int(event_ref_stats.get("unknown_semantic_refs_total") or 0)

        if instance_id:
            span = item["_instance_spans"].setdefault(
                instance_id,
                {
                    "spawn": None,
                    "terminal": None,
                    "verify_status": "pending",
                },
            )
            if status == ORCHESTRATION_INSTANCE_SPAWNED_STATUS and event_ts_dt is not None and span.get("spawn") is None:
                span["spawn"] = event_ts_dt
            if status in ORCHESTRATION_TERMINAL_INSTANCE_STATUSES and event_ts_dt is not None:
                span["terminal"] = event_ts_dt
                span["verify_status"] = verify_status

        outcome = str(event.get("outcome") or "").strip().lower()
        if task_id and (status in {"completed", "review_passed"} or outcome == "success"):
            item["_completed_tasks"].add(task_id)
        if task_id and (status in {"failed", "step_error", "review_failed"} or outcome == "failed"):
            item["_failed_tasks"].add(task_id)
        if task_id and (
            status in {"planned", "replanned"}
            or (status == "started" and step in {"step_0_intake", "step_3_orchestration"})
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

        cost_usd = as_float(metrics.get("cost_usd"))
        if cost_usd is None:
            cost_usd = as_float(event.get("cost_usd"))
        if cost_usd is not None:
            item["cost_usd_total"] += cost_usd

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

        tools, _skills = normalize_tools_and_skills(event.get("tools"), event.get("skills"))
        for tool_name in tools:
            item["tool_usage"][tool_name] += 1

        tool_overreach = parse_bool(metrics.get("tool_overreach"))
        if tool_overreach is True:
            item["_tool_overreach_events"] += 1

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
    total_tokens_in = 0
    total_tokens_out = 0
    total_cost_usd = 0.0
    total_orchestration_reused = 0
    total_orchestration_created = 0
    total_instances_spawned = 0
    total_instances_completed = 0
    total_instances_failed = 0
    total_retire_recommended = 0
    total_specialist_verify_pass = 0
    total_specialist_verify_total = 0
    total_tool_overreach_events = 0
    total_created_profiles: set[str] = set()
    total_time_to_verify_samples: list[float] = []
    total_cycle_events = 0
    total_canonical_cycle_events = 0
    total_non_canonical_events = 0
    total_missing_canonical_steps: list[dict[str, Any]] = []
    total_capability_refresh_started = 0
    total_capability_refresh_completed = 0
    total_capability_refresh_failed = 0
    total_shadow_trial_plan_refreshed = 0
    total_shadow_trial_judged = 0
    total_capability_snapshot_published = 0
    total_capability_stale_detected = 0
    total_capability_refresh_completed_tasks = 0
    total_artifact_refs = 0
    total_unknown_source_refs = 0
    total_unknown_semantic_refs = 0
    total_file_ops_v2_events = 0
    total_file_ops_eligible_events = 0
    total_file_ops_explicit_events = 0
    total_file_ops_mirrored_legacy_events = 0
    total_file_ops_step_fallback_events = 0
    total_file_ops_operations_total = 0
    total_file_ops_delete_total = 0

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

        orchestration_reused = int(item["_orchestration_reused"])
        orchestration_created = int(item["_orchestration_created"])
        instances_spawned = int(item["_instances_spawned"])
        instances_completed = int(item["_instances_completed"])
        instances_failed = int(item["_instances_failed"])
        retire_recommended = int(item["_retire_recommended"])
        specialist_verify_pass = int(item["_specialist_verify_pass"])
        specialist_verify_total = int(item["_specialist_verify_total"])
        tool_overreach_events = int(item["_tool_overreach_events"])

        reuse_denominator = orchestration_reused + orchestration_created
        reuse_hit_rate = (
            round((orchestration_reused / reuse_denominator) * 100, 2)
            if reuse_denominator > 0
            else None
        )
        new_profile_creation_rate = (
            round((orchestration_created / reuse_denominator) * 100, 2)
            if reuse_denominator > 0
            else None
        )
        specialist_verify_pass_rate = (
            round((specialist_verify_pass / specialist_verify_total) * 100, 2)
            if specialist_verify_total > 0
            else None
        )
        profile_sprawl_ratio = (
            round((len(item["_created_profiles"]) / tasks_total), 4)
            if tasks_total > 0
            else None
        )
        tool_overreach_rate = (
            round((tool_overreach_events / instances_spawned) * 100, 2)
            if instances_spawned > 0
            else None
        )

        instance_time_to_verify_minutes: list[float] = []
        for span in item["_instance_spans"].values():
            if not isinstance(span, dict):
                continue
            spawn_ts = span.get("spawn")
            terminal_ts = span.get("terminal")
            verify_state = normalize_verify_status(span.get("verify_status"))
            if not isinstance(spawn_ts, dt.datetime) or not isinstance(terminal_ts, dt.datetime):
                continue
            if terminal_ts < spawn_ts:
                continue
            if verify_state not in {"passed", "failed"}:
                continue
            instance_time_to_verify_minutes.append((terminal_ts - spawn_ts).total_seconds() / 60.0)
        time_to_verify = (
            round(sum(instance_time_to_verify_minutes) / len(instance_time_to_verify_minutes), 2)
            if instance_time_to_verify_minutes
            else None
        )

        orchestration_cost_per_completed_task = None
        orchestration_cost_unit = None
        if completed_total > 0 and item["cost_usd_total"] > 0:
            orchestration_cost_per_completed_task = round(item["cost_usd_total"] / completed_total, 6)
            orchestration_cost_unit = "usd"
        elif completed_total > 0:
            orchestration_cost_per_completed_task = round((item["tokens_in_total"] + item["tokens_out_total"]) / completed_total, 2)
            orchestration_cost_unit = "token_proxy"

        cycle_events_total = int(item["_cycle_events_total"])
        canonical_cycle_events = int(item["_canonical_cycle_events"])
        non_canonical_events_total = int(item["_non_canonical_events_total"])
        canonical_event_compliance_rate = (
            round((canonical_cycle_events / cycle_events_total) * 100, 2)
            if cycle_events_total > 0
            else None
        )
        capability_refresh_started_count = int(item["_capability_refresh_started"])
        capability_refresh_completed_count = int(item["_capability_refresh_completed"])
        capability_refresh_failed_count = int(item["_capability_refresh_failed"])
        shadow_trial_plan_refreshed_count = int(item["_shadow_trial_plan_refreshed"])
        shadow_trial_judged_count = int(item["_shadow_trial_judged"])
        capability_snapshot_published_count = int(item["_capability_snapshot_published"])
        capability_stale_detected_count = int(item["_capability_stale_detected"])
        capability_refresh_completed_tasks = len(item["_capability_refresh_completed_tasks"])
        capability_refresh_coverage_rate = (
            round((capability_refresh_completed_tasks / tasks_total) * 100, 2)
            if tasks_total > 0
            else None
        )
        stale_table_rate = (
            round((capability_stale_detected_count / capability_refresh_started_count) * 100, 2)
            if capability_refresh_started_count > 0
            else None
        )
        shadow_trial_completion_rate = (
            round((shadow_trial_judged_count / shadow_trial_plan_refreshed_count) * 100, 2)
            if shadow_trial_plan_refreshed_count > 0
            else None
        )
        missing_canonical_steps: list[dict[str, Any]] = []
        for task_id in sorted(item["_tasks"]):
            observed_steps = sorted(item["_task_canonical_steps"].get(task_id, set()))
            missing_steps = [step_key for step_key in CANONICAL_CYCLE_STEP_SEQUENCE if step_key not in observed_steps]
            non_canonical_steps = sorted(item["_task_non_canonical_steps"].get(task_id, set()))
            missing_payload = {
                "task_id": task_id,
                "missing_steps": missing_steps,
                "observed_canonical_steps": observed_steps,
                "non_canonical_steps": non_canonical_steps,
            }
            missing_canonical_steps.append(missing_payload)
            total_missing_canonical_steps.append({"agent_id": agent_id, **missing_payload})

        artifact_refs_total = int(item["_artifact_refs_total"])
        unknown_source_refs_total = int(item["_unknown_source_refs_total"])
        unknown_semantic_refs_total = int(item["_unknown_semantic_refs_total"])
        unknown_source_rate = (
            round((unknown_source_refs_total / artifact_refs_total) * 100, 2)
            if artifact_refs_total > 0
            else None
        )
        unknown_semantic_rate = (
            round((unknown_semantic_refs_total / artifact_refs_total) * 100, 2)
            if artifact_refs_total > 0
            else None
        )
        taxonomy_warnings = build_taxonomy_warnings(
            {
                "artifact_refs_total": artifact_refs_total,
                "unknown_source_refs_total": unknown_source_refs_total,
                "unknown_semantic_refs_total": unknown_semantic_refs_total,
                "unknown_source_rate": unknown_source_rate,
                "unknown_semantic_rate": unknown_semantic_rate,
            }
        )
        file_ops_v2_events_total = int(item["_file_ops_v2_events_total"])
        file_ops_eligible_events = int(item["_file_ops_eligible_events"])
        file_ops_explicit_events = int(item["_file_ops_explicit_events"])
        file_ops_mirrored_legacy_events = int(item["_file_ops_mirrored_legacy_events"])
        file_ops_step_fallback_events = int(item["_file_ops_step_fallback_events"])
        file_ops_operations_total = int(item["_file_ops_operations_total"])
        file_ops_delete_total = int(item["_file_ops_delete_total"])
        file_ops_fallback_events = file_ops_mirrored_legacy_events + file_ops_step_fallback_events
        file_ops_explicit_coverage_pct = (
            round((file_ops_explicit_events / file_ops_eligible_events) * 100, 2)
            if file_ops_eligible_events > 0
            else None
        )
        file_ops_fallback_share_pct = (
            round((file_ops_fallback_events / file_ops_eligible_events) * 100, 2)
            if file_ops_eligible_events > 0
            else None
        )

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
                "tool_usage": [
                    {"name": name, "events": count}
                    for name, count in sorted(item["tool_usage"].items(), key=lambda pair: (-pair[1], pair[0]))
                ],
                "profile_usage": [
                    {"name": name, "events": count}
                    for name, count in sorted(item["profile_usage"].items(), key=lambda pair: (-pair[1], pair[0]))
                ],
                "status_counts": dict(status_counts),
                "first_event_at": item["_first_ts"],
                "last_event_at": item["_last_ts"],
                "n_decisions": item["n_decisions"],
                "n_candidates_total": item["n_candidates_total"],
                "n_selected_total": item["n_selected_total"],
                "decision_time_avg_ms": round(sum(item["_decision_times"]) / len(item["_decision_times"]), 1) if item["_decision_times"] else None,
                "reuse_hit_rate": reuse_hit_rate,
                "new_profile_creation_rate": new_profile_creation_rate,
                "specialist_verify_pass_rate": specialist_verify_pass_rate,
                "profile_sprawl_ratio": profile_sprawl_ratio,
                "tool_overreach_rate": tool_overreach_rate,
                "orchestration_cost_per_completed_task": orchestration_cost_per_completed_task,
                "orchestration_cost_unit": orchestration_cost_unit,
                "time_to_verify_min": time_to_verify,
                "canonical_event_compliance_rate": canonical_event_compliance_rate,
                "non_canonical_events_total": non_canonical_events_total,
                "capability_refresh_coverage_rate": capability_refresh_coverage_rate,
                "stale_table_rate": stale_table_rate,
                "shadow_trial_completion_rate": shadow_trial_completion_rate,
                "promotion_blocked_by_stale_total": capability_stale_detected_count,
                "missing_canonical_steps": missing_canonical_steps,
                "artifact_refs_total": artifact_refs_total,
                "unknown_source_refs_total": unknown_source_refs_total,
                "unknown_semantic_refs_total": unknown_semantic_refs_total,
                "unknown_source_rate": unknown_source_rate,
                "unknown_semantic_rate": unknown_semantic_rate,
                "file_ops_v2_events_total": file_ops_v2_events_total,
                "file_ops_eligible_events": file_ops_eligible_events,
                "file_ops_explicit_events": file_ops_explicit_events,
                "file_ops_mirrored_legacy_events": file_ops_mirrored_legacy_events,
                "file_ops_step_fallback_events": file_ops_step_fallback_events,
                "file_ops_operations_total": file_ops_operations_total,
                "file_ops_delete_total": file_ops_delete_total,
                "file_ops_explicit_coverage_pct": file_ops_explicit_coverage_pct,
                "file_ops_fallback_share_pct": file_ops_fallback_share_pct,
                "taxonomy_warning_threshold_pct": TAXONOMY_UNKNOWN_WARNING_THRESHOLD_PCT,
                "taxonomy_warnings": taxonomy_warnings,
                "orchestration_counts": {
                    "profile_reused": orchestration_reused,
                    "profile_created": orchestration_created,
                    "instance_spawned": instances_spawned,
                    "instance_completed": instances_completed,
                    "instance_failed": instances_failed,
                    "retire_recommended": retire_recommended,
                    "specialist_verify_pass": specialist_verify_pass,
                    "specialist_verify_total": specialist_verify_total,
                    "created_profiles": len(item["_created_profiles"]),
                    "tool_overreach_events": tool_overreach_events,
                },
                "capability_refresh_counts": {
                    "started": capability_refresh_started_count,
                    "completed": capability_refresh_completed_count,
                    "failed": capability_refresh_failed_count,
                    "shadow_trial_plan_refreshed": shadow_trial_plan_refreshed_count,
                    "shadow_trial_judged": shadow_trial_judged_count,
                    "snapshot_published": capability_snapshot_published_count,
                    "stale_detected": capability_stale_detected_count,
                    "completed_tasks": capability_refresh_completed_tasks,
                },
            }
        )

        total_events += events_total
        total_tasks += tasks_total
        total_review_errors += int(item["review_errors_total"])
        total_trace_linked += int(item["trace_linked_events"])
        total_tokens_in += int(item["tokens_in_total"])
        total_tokens_out += int(item["tokens_out_total"])
        total_cost_usd += float(item["cost_usd_total"])
        total_orchestration_reused += orchestration_reused
        total_orchestration_created += orchestration_created
        total_instances_spawned += instances_spawned
        total_instances_completed += instances_completed
        total_instances_failed += instances_failed
        total_retire_recommended += retire_recommended
        total_specialist_verify_pass += specialist_verify_pass
        total_specialist_verify_total += specialist_verify_total
        total_tool_overreach_events += tool_overreach_events
        total_created_profiles.update(item["_created_profiles"])
        total_time_to_verify_samples.extend(instance_time_to_verify_minutes)
        total_cycle_events += cycle_events_total
        total_canonical_cycle_events += canonical_cycle_events
        total_non_canonical_events += non_canonical_events_total
        total_capability_refresh_started += capability_refresh_started_count
        total_capability_refresh_completed += capability_refresh_completed_count
        total_capability_refresh_failed += capability_refresh_failed_count
        total_shadow_trial_plan_refreshed += shadow_trial_plan_refreshed_count
        total_shadow_trial_judged += shadow_trial_judged_count
        total_capability_snapshot_published += capability_snapshot_published_count
        total_capability_stale_detected += capability_stale_detected_count
        total_capability_refresh_completed_tasks += capability_refresh_completed_tasks
        total_artifact_refs += artifact_refs_total
        total_unknown_source_refs += unknown_source_refs_total
        total_unknown_semantic_refs += unknown_semantic_refs_total
        total_file_ops_v2_events += file_ops_v2_events_total
        total_file_ops_eligible_events += file_ops_eligible_events
        total_file_ops_explicit_events += file_ops_explicit_events
        total_file_ops_mirrored_legacy_events += file_ops_mirrored_legacy_events
        total_file_ops_step_fallback_events += file_ops_step_fallback_events
        total_file_ops_operations_total += file_ops_operations_total
        total_file_ops_delete_total += file_ops_delete_total

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
    total_reuse_denominator = total_orchestration_reused + total_orchestration_created
    total_reuse_hit_rate = (
        round((total_orchestration_reused / total_reuse_denominator) * 100, 2)
        if total_reuse_denominator > 0
        else None
    )
    total_new_profile_creation_rate = (
        round((total_orchestration_created / total_reuse_denominator) * 100, 2)
        if total_reuse_denominator > 0
        else None
    )
    total_specialist_verify_pass_rate = (
        round((total_specialist_verify_pass / total_specialist_verify_total) * 100, 2)
        if total_specialist_verify_total > 0
        else None
    )
    total_profile_sprawl_ratio = (
        round((len(total_created_profiles) / total_tasks), 4)
        if total_tasks > 0
        else None
    )
    total_tool_overreach_rate = (
        round((total_tool_overreach_events / total_instances_spawned) * 100, 2)
        if total_instances_spawned > 0
        else None
    )
    total_time_to_verify = (
        round(sum(total_time_to_verify_samples) / len(total_time_to_verify_samples), 2)
        if total_time_to_verify_samples
        else None
    )
    total_orchestration_cost_per_completed_task = None
    total_orchestration_cost_unit = None
    total_completed_tasks = sum(int(agent.get("completed_tasks", 0)) for agent in agents)
    if total_completed_tasks > 0 and total_cost_usd > 0:
        total_orchestration_cost_per_completed_task = round(total_cost_usd / total_completed_tasks, 6)
        total_orchestration_cost_unit = "usd"
    elif total_completed_tasks > 0:
        total_orchestration_cost_per_completed_task = round((total_tokens_in + total_tokens_out) / total_completed_tasks, 2)
        total_orchestration_cost_unit = "token_proxy"
    total_canonical_event_compliance_rate = (
        round((total_canonical_cycle_events / total_cycle_events) * 100, 2)
        if total_cycle_events > 0
        else None
    )
    total_capability_refresh_coverage_rate = (
        round((total_capability_refresh_completed_tasks / total_tasks) * 100, 2)
        if total_tasks > 0
        else None
    )
    total_stale_table_rate = (
        round((total_capability_stale_detected / total_capability_refresh_started) * 100, 2)
        if total_capability_refresh_started > 0
        else None
    )
    total_shadow_trial_completion_rate = (
        round((total_shadow_trial_judged / total_shadow_trial_plan_refreshed) * 100, 2)
        if total_shadow_trial_plan_refreshed > 0
        else None
    )
    total_unknown_source_rate = (
        round((total_unknown_source_refs / total_artifact_refs) * 100, 2)
        if total_artifact_refs > 0
        else None
    )
    total_unknown_semantic_rate = (
        round((total_unknown_semantic_refs / total_artifact_refs) * 100, 2)
        if total_artifact_refs > 0
        else None
    )
    total_file_ops_fallback_events = total_file_ops_mirrored_legacy_events + total_file_ops_step_fallback_events
    total_file_ops_explicit_coverage_pct = (
        round((total_file_ops_explicit_events / total_file_ops_eligible_events) * 100, 2)
        if total_file_ops_eligible_events > 0
        else None
    )
    total_file_ops_fallback_share_pct = (
        round((total_file_ops_fallback_events / total_file_ops_eligible_events) * 100, 2)
        if total_file_ops_eligible_events > 0
        else None
    )
    total_taxonomy_warnings = build_taxonomy_warnings(
        {
            "artifact_refs_total": total_artifact_refs,
            "unknown_source_refs_total": total_unknown_source_refs,
            "unknown_semantic_refs_total": total_unknown_semantic_refs,
            "unknown_source_rate": total_unknown_source_rate,
            "unknown_semantic_rate": total_unknown_semantic_rate,
        }
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
            "reuse_hit_rate": total_reuse_hit_rate,
            "new_profile_creation_rate": total_new_profile_creation_rate,
            "specialist_verify_pass_rate": total_specialist_verify_pass_rate,
            "profile_sprawl_ratio": total_profile_sprawl_ratio,
            "tool_overreach_rate": total_tool_overreach_rate,
            "orchestration_cost_per_completed_task": total_orchestration_cost_per_completed_task,
            "orchestration_cost_unit": total_orchestration_cost_unit,
            "time_to_verify_min": total_time_to_verify,
            "canonical_event_compliance_rate": total_canonical_event_compliance_rate,
            "non_canonical_events_total": total_non_canonical_events,
            "capability_refresh_coverage_rate": total_capability_refresh_coverage_rate,
            "stale_table_rate": total_stale_table_rate,
            "shadow_trial_completion_rate": total_shadow_trial_completion_rate,
            "promotion_blocked_by_stale_total": total_capability_stale_detected,
            "missing_canonical_steps": total_missing_canonical_steps,
            "artifact_refs_total": total_artifact_refs,
            "unknown_source_refs_total": total_unknown_source_refs,
            "unknown_semantic_refs_total": total_unknown_semantic_refs,
            "unknown_source_rate": total_unknown_source_rate,
            "unknown_semantic_rate": total_unknown_semantic_rate,
            "file_ops_v2_events_total": total_file_ops_v2_events,
            "file_ops_eligible_events": total_file_ops_eligible_events,
            "file_ops_explicit_events": total_file_ops_explicit_events,
            "file_ops_mirrored_legacy_events": total_file_ops_mirrored_legacy_events,
            "file_ops_step_fallback_events": total_file_ops_step_fallback_events,
            "file_ops_operations_total": total_file_ops_operations_total,
            "file_ops_delete_total": total_file_ops_delete_total,
            "file_ops_explicit_coverage_pct": total_file_ops_explicit_coverage_pct,
            "file_ops_fallback_share_pct": total_file_ops_fallback_share_pct,
            "taxonomy_warning_threshold_pct": TAXONOMY_UNKNOWN_WARNING_THRESHOLD_PCT,
            "taxonomy_warnings": total_taxonomy_warnings,
            "orchestration_counts": {
                "profile_reused": total_orchestration_reused,
                "profile_created": total_orchestration_created,
                "instance_spawned": total_instances_spawned,
                "instance_completed": total_instances_completed,
                "instance_failed": total_instances_failed,
                "retire_recommended": total_retire_recommended,
                "specialist_verify_pass": total_specialist_verify_pass,
                "specialist_verify_total": total_specialist_verify_total,
                "created_profiles": len(total_created_profiles),
                "tool_overreach_events": total_tool_overreach_events,
            },
            "capability_refresh_counts": {
                "started": total_capability_refresh_started,
                "completed": total_capability_refresh_completed,
                "failed": total_capability_refresh_failed,
                "shadow_trial_plan_refreshed": total_shadow_trial_plan_refreshed,
                "shadow_trial_judged": total_shadow_trial_judged,
                "snapshot_published": total_capability_snapshot_published,
                "stale_detected": total_capability_stale_detected,
                "completed_tasks": total_capability_refresh_completed_tasks,
            },
            "invalid_lines": invalid_lines,
        },
        "warnings": total_taxonomy_warnings,
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
        f"- Reuse hit rate: {summary.get('totals', {}).get('reuse_hit_rate', 'unknown')}%",
        f"- New profile creation rate: {summary.get('totals', {}).get('new_profile_creation_rate', 'unknown')}%",
        f"- Specialist verify pass rate: {summary.get('totals', {}).get('specialist_verify_pass_rate', 'unknown')}%",
        f"- Tool overreach rate: {summary.get('totals', {}).get('tool_overreach_rate', 'unknown')}%",
        f"- Orchestration cost per completed task: {summary.get('totals', {}).get('orchestration_cost_per_completed_task', 'unknown')} {summary.get('totals', {}).get('orchestration_cost_unit', '')}",
        f"- Time to verify (min): {summary.get('totals', {}).get('time_to_verify_min', 'unknown')}",
        f"- Canonical event compliance rate: {summary.get('totals', {}).get('canonical_event_compliance_rate', 'unknown')}%",
        f"- Non-canonical events total: {summary.get('totals', {}).get('non_canonical_events_total', 'unknown')}",
        f"- Capability refresh coverage rate: {summary.get('totals', {}).get('capability_refresh_coverage_rate', 'unknown')}%",
        f"- Stale table rate: {summary.get('totals', {}).get('stale_table_rate', 'unknown')}%",
        f"- Shadow-trial completion rate: {summary.get('totals', {}).get('shadow_trial_completion_rate', 'unknown')}%",
        f"- Promotion blocked by stale total: {summary.get('totals', {}).get('promotion_blocked_by_stale_total', 'unknown')}",
        f"- Unknown source rate: {summary.get('totals', {}).get('unknown_source_rate', 'unknown')}%",
        f"- Unknown semantic rate: {summary.get('totals', {}).get('unknown_semantic_rate', 'unknown')}%",
        f"- File ops explicit coverage: {summary.get('totals', {}).get('file_ops_explicit_coverage_pct', 'unknown')}%",
        f"- File ops fallback share: {summary.get('totals', {}).get('file_ops_fallback_share_pct', 'unknown')}%",
        f"- File ops delete total: {summary.get('totals', {}).get('file_ops_delete_total', 'unknown')}",
    ]
    file_ops_gate = summary.get("file_ops_gate") if isinstance(summary.get("file_ops_gate"), dict) else None
    if file_ops_gate:
        lines.append(f"- File ops gate status: {file_ops_gate.get('status', 'unknown')}")
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
            "| Agent | Events | Tasks | Completed | Failed | Review errors | Trace coverage | Rec action rate | Unknown source % | Unknown semantic % | p95 duration ms |",
            "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
    )

    for agent in summary.get("agents", []):
        lines.append(
            "| {agent_id} | {events_total} | {tasks_total} | {completed_tasks} | {failed_tasks} | {review_errors_total} | {trace_coverage_pct}% | {recommendation_action_rate} | {unknown_source_rate} | {unknown_semantic_rate} | {p95_duration_ms} |".format(
                agent_id=agent.get("agent_id", "unknown"),
                events_total=agent.get("events_total", 0),
                tasks_total=agent.get("tasks_total", 0),
                completed_tasks=agent.get("completed_tasks", 0),
                failed_tasks=agent.get("failed_tasks", 0),
                review_errors_total=agent.get("review_errors_total", 0),
                trace_coverage_pct=agent.get("trace_coverage_pct", 0),
                recommendation_action_rate=agent.get("recommendation_action_rate", "unknown"),
                unknown_source_rate=agent.get("unknown_source_rate", "unknown"),
                unknown_semantic_rate=agent.get("unknown_semantic_rate", "unknown"),
                p95_duration_ms=agent.get("p95_duration_ms", "unknown"),
            )
        )

    warnings = summary.get("warnings") if isinstance(summary.get("warnings"), list) else []
    lines.extend(
        [
            "",
            "## Taxonomy Warnings",
            "",
        ]
    )
    if warnings:
        for warning in warnings:
            if isinstance(warning, dict):
                lines.append(
                    "- {code}: {actual_pct}% (threshold {threshold_pct}%)".format(
                        code=warning.get("code", "warning"),
                        actual_pct=warning.get("actual_pct", "unknown"),
                        threshold_pct=warning.get("threshold_pct", "unknown"),
                    )
                )
    else:
        lines.append("- none")

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
    if args.enforce_step_contract != "none":
        allowed, message = apply_step_contract(event, args.enforce_step_contract)
        if not allowed:
            print(f"[agent-telemetry] step contract violation: {message}")
            return 1
        if message:
            print(f"[agent-telemetry] step contract warning: {message}")

    log_dir = Path(args.log_dir)
    target = append_event(log_dir, event)
    print(f"[agent-telemetry] event logged: {target}")
    maybe_auto_capability_refresh(args=args, root_event=event, log_dir=log_dir)

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


def evaluate_file_ops_gate(
    summary: dict[str, Any],
    *,
    explicit_min_pct: float,
    fallback_max_pct: float,
    mode: str,
    min_events: int = 5,
) -> dict[str, Any]:
    agents = summary.get("agents") if isinstance(summary.get("agents"), list) else []
    results: list[dict[str, Any]] = []
    failed_agents: list[str] = []
    warning_agents: list[str] = []

    for entry in agents:
        if not isinstance(entry, dict):
            continue
        agent_id = safe_str(entry.get("agent_id")) or "unknown"
        eligible_events = as_int(entry.get("file_ops_eligible_events")) or 0
        explicit_pct = as_float(entry.get("file_ops_explicit_coverage_pct"))
        fallback_pct = as_float(entry.get("file_ops_fallback_share_pct"))
        detail = {
            "agent_id": agent_id,
            "eligible_events": eligible_events,
            "explicit_coverage_pct": explicit_pct,
            "fallback_share_pct": fallback_pct,
            "status": "pass",
            "message": "ok",
        }

        if eligible_events < min_events:
            detail["status"] = "warning"
            detail["message"] = f"sample_too_small(<{min_events})"
            warning_agents.append(agent_id)
            results.append(detail)
            continue

        if explicit_pct is None or fallback_pct is None:
            detail["status"] = "warning"
            detail["message"] = "metrics_missing"
            warning_agents.append(agent_id)
            results.append(detail)
            continue

        explicit_ok = explicit_pct >= explicit_min_pct
        fallback_ok = fallback_pct <= fallback_max_pct
        if explicit_ok and fallback_ok:
            results.append(detail)
            continue

        detail["status"] = "fail"
        detail["message"] = (
            f"threshold_not_met(explicit>={explicit_min_pct} and fallback<={fallback_max_pct})"
        )
        failed_agents.append(agent_id)
        results.append(detail)

    status = "passed"
    if failed_agents:
        status = "failed" if mode == "strict" else "warning"
    elif warning_agents:
        status = "warning"

    return {
        "mode": mode,
        "thresholds": {
            "explicit_min_pct": explicit_min_pct,
            "fallback_max_pct": fallback_max_pct,
            "min_events": min_events,
        },
        "status": status,
        "failed_agents": failed_agents,
        "warning_agents": warning_agents,
        "results": results,
    }


def command_report(args: argparse.Namespace) -> int:
    events, invalid_lines = read_events(Path(args.log_dir))
    summary = summarize(events=events, invalid_lines=invalid_lines, log_dir=Path(args.log_dir))
    benchmark_summary = load_benchmark_summary(Path(args.benchmark_summary_json))
    if benchmark_summary is not None:
        summary["benchmark_summary"] = benchmark_summary
    file_ops_gate = evaluate_file_ops_gate(
        summary,
        explicit_min_pct=float(getattr(args, "file_ops_explicit_min_pct", 90.0)),
        fallback_max_pct=float(getattr(args, "file_ops_fallback_max_pct", 10.0)),
        mode=str(getattr(args, "file_ops_gate_mode", "soft_warning")),
        min_events=max(1, int(getattr(args, "file_ops_min_events", 5))),
    )
    summary["file_ops_gate"] = file_ops_gate

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
    print(f"[agent-telemetry] file ops gate status: {file_ops_gate.get('status', 'warning')}")
    if file_ops_gate.get("status") == "failed" and str(getattr(args, "file_ops_gate_mode", "soft_warning")) == "strict":
        print("[agent-telemetry] strict mode: file ops gate failed")
        return 1
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
        "artifact_contract_version": ARTIFACT_CONTRACT_VERSION,
        "artifact_ops_origin": "none",
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
        "benchmark_run_id": None,
        "benchmark_case_id": None,
        "attempt_index": None,
        "profile_id": None,
        "instance_id": None,
        "parent_instance_id": None,
        "root_agent_id": None,
        "depth": None,
        "objective": None,
        "verify_status": "pending",
        "judge_model": None,
        "judge_score": None,
        "mcp_tools": [],
        "tools": [],
        "skills": [],
        "rules": [],
        "input_artifacts": [],
        "output_artifacts": [],
        "artifacts_read": [],
        "artifacts_written": [],
        "artifact_operations": [],
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
    log_parser.add_argument("--profile-id")
    log_parser.add_argument("--instance-id")
    log_parser.add_argument("--parent-instance-id")
    log_parser.add_argument("--root-agent-id")
    log_parser.add_argument("--depth", type=int)
    log_parser.add_argument("--objective")
    log_parser.add_argument("--verify-status", choices=sorted(VALID_VERIFY_STATUSES), default="pending")
    log_parser.add_argument("--judge-model")
    log_parser.add_argument("--judge-score", type=float)
    log_parser.add_argument("--mcp", action="append", default=[])
    log_parser.add_argument("--tool", action="append", default=[])
    log_parser.add_argument("--skill", action="append", default=[])
    log_parser.add_argument("--rule", action="append", default=[])
    log_parser.add_argument("--input-artifact", action="append", default=[])
    log_parser.add_argument("--output-artifact", action="append", default=[])
    log_parser.add_argument("--artifact-read", action="append", default=[])
    log_parser.add_argument("--artifact-write", action="append", default=[])
    log_parser.add_argument("--artifact-op", action="append", default=[])
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
    log_parser.add_argument("--enforce-step-contract", choices=["none", "warning", "strict"], default="none")
    log_parser.add_argument("--auto-capability-refresh", choices=sorted(AUTO_CAPABILITY_REFRESH_MODES), default="on_run")
    log_parser.add_argument("--enforce-out-json", default=None)
    log_parser.set_defaults(handler=command_log)

    report_parser = subparsers.add_parser("report", help="Build aggregated telemetry report.")
    report_parser.add_argument("--log-dir", default=".logs/agents")
    report_parser.add_argument("--out-json", default="artifacts/agent_telemetry_summary.json")
    report_parser.add_argument("--out-md", default="artifacts/agent_telemetry_summary.md")
    report_parser.add_argument("--out-cycle-json", default="artifacts/agent_cycle_validation_report.json")
    report_parser.add_argument("--out-latest-analyst-json", default="artifacts/agent_latest_cycle_analyst.json")
    report_parser.add_argument("--benchmark-summary-json", default="artifacts/agent_benchmark_summary.json")
    report_parser.add_argument("--file-ops-explicit-min-pct", type=float, default=90.0)
    report_parser.add_argument("--file-ops-fallback-max-pct", type=float, default=10.0)
    report_parser.add_argument("--file-ops-gate-mode", choices=["soft_warning", "strict"], default="soft_warning")
    report_parser.add_argument("--file-ops-min-events", type=int, default=5)
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
