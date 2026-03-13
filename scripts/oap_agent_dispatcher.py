#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from agent_plan_metadata import load_active_agent_entries

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_AGENT_REGISTRY = ROOT_DIR / "docs" / "agents" / "registry.yaml"
DEFAULT_AGENTS_ROOT = ROOT_DIR / "docs" / "subservices" / "oap" / "agents"
DEFAULT_AGENT_FIXTURE_PATH = ROOT_DIR / "docs" / "agents" / "host_agnostic_agent_catalog.yaml"
# Backward-compatible alias for older tests or scripts that still pass a catalog fixture explicitly.
DEFAULT_HOST_CATALOG = DEFAULT_AGENT_FIXTURE_PATH
DEFAULT_RUNS_DIR = ROOT_DIR / "artifacts" / "agent_runs"
DEFAULT_LOG_DIR = ROOT_DIR / ".logs" / "agents"


def safe_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def safe_list_str(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    values: list[str] = []
    seen: set[str] = set()
    for item in value:
        normalized = safe_str(item)
        if not normalized:
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        values.append(normalized)
    return values


def parse_optional_bool(value: Any) -> bool | None:
    normalized = safe_str(value).lower()
    if normalized in {"true", "1", "yes", "y", "on"}:
        return True
    if normalized in {"false", "0", "no", "n", "off"}:
        return False
    return None


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _load_telemetry_module():
    module_path = ROOT_DIR / "scripts" / "agent_telemetry.py"
    spec = importlib.util.spec_from_file_location("agent_telemetry", module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load telemetry module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


TELEMETRY = _load_telemetry_module()


def _load_fixture_agents(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    agents = payload.get("agents") if isinstance(payload, dict) else None
    if not isinstance(agents, list):
        raise ValueError(f"Invalid dispatcher compatibility fixture payload: {path}")
    return [item for item in agents if isinstance(item, dict)]


def load_agents(
    *,
    registry_path: Path | None = None,
    agents_root: Path | None = None,
    fixture_path: Path | None = None,
) -> list[dict[str, Any]]:
    if fixture_path is not None:
        return _load_fixture_agents(fixture_path)
    return load_active_agent_entries(registry_path or DEFAULT_AGENT_REGISTRY, agents_root or DEFAULT_AGENTS_ROOT)


def list_agents(
    *,
    host: str | None = None,
    kind: str | None = None,
    path: Path | None = None,
    registry_path: Path | None = None,
    agents_root: Path | None = None,
) -> list[dict[str, Any]]:
    agents = load_agents(registry_path=registry_path, agents_root=agents_root, fixture_path=path)
    results: list[dict[str, Any]] = []
    for raw in agents:
        supported_hosts = safe_list_str(raw.get("supportedHosts"))
        if host and supported_hosts and host not in supported_hosts:
            continue
        if kind and safe_str(raw.get("kind")) != kind:
            continue
        results.append(raw)
    return results


def _build_run_id(agent_id: str, task_id: str, purpose: str) -> str:
    digest = hashlib.sha1(f"{agent_id}:{task_id}:{purpose}".encode("utf-8")).hexdigest()[:12]
    return f"run-{digest}"


def _build_trace_id(run_id: str) -> str:
    return f"trace-{run_id.removeprefix('run-')}"


def _build_instance_id(run_id: str) -> str:
    return f"inst-{run_id.removeprefix('run-')}"


def _artifact_paths(run_id: str) -> dict[str, str]:
    base_dir = DEFAULT_RUNS_DIR / run_id
    return {
        "run_dir": str(base_dir.relative_to(ROOT_DIR)),
        "manifest_path": str((base_dir / "run_manifest.json").relative_to(ROOT_DIR)),
        "result_path": str((base_dir / "result.json").relative_to(ROOT_DIR)),
    }


def stage_instance_run(
    instance: dict[str, Any],
    *,
    interaction_mode: str | None = None,
) -> dict[str, Any]:
    profile_id = safe_str(instance.get("profile_id")) or safe_str(instance.get("agent_id")) or "unknown-agent"
    task_id = safe_str(instance.get("task_id")) or "unknown-task"
    purpose = safe_str(instance.get("purpose")) or "Task-local specialist execution"
    run_id = safe_str(instance.get("run_id")) or safe_str(instance.get("instance_id")) or _build_run_id(profile_id, task_id, purpose)
    trace_id = safe_str(instance.get("trace_id")) or _build_trace_id(run_id)
    instance_id = safe_str(instance.get("instance_id")) or run_id
    artifact_paths = _artifact_paths(run_id)
    payload = {
        "run_id": run_id,
        "trace_id": trace_id,
        "instance_id": instance_id,
        "agent_id": profile_id,
        "profile_id": profile_id,
        "kind": safe_str(instance.get("kind")) or ("runtime_specialist" if int(instance.get("depth", 0) or 0) > 0 else "top_level"),
        "host_id": safe_str(instance.get("host_id")) or "dispatcher",
        "mode": safe_str(instance.get("mode")) or "normal",
        "task_id": task_id,
        "purpose": purpose,
        "status": "planned",
        "created_at": now_iso(),
        "started_at": None,
        "finished_at": None,
        "parent_instance_id": safe_str(instance.get("parent_instance_id")) or None,
        "root_agent_id": safe_str(instance.get("root_agent_id")) or profile_id,
        "depth": max(int(instance.get("depth", 0) or 0), 0),
        "phase_id": safe_str(instance.get("phase_id")) or None,
        "interaction_mode": safe_str(interaction_mode) or safe_str(instance.get("interaction_mode")) or None,
        "input_refs": safe_list_str(instance.get("input_refs")),
        "output_refs": safe_list_str(instance.get("output_refs")),
        "allowed_skills": safe_list_str(instance.get("allowed_skills")),
        "allowed_tools": safe_list_str(instance.get("allowed_tools")),
        "allowed_mcp": safe_list_str(instance.get("allowed_mcp")),
        "allowed_rules": safe_list_str(instance.get("applied_rules")),
        "output_contract": safe_str(instance.get("output_contract")) or "agent_output.v1",
        "execution_mode": safe_str(instance.get("execution_mode")) or "sequential",
        "execution_backend": safe_str(instance.get("execution_backend")) or "dispatcher_backed_child_runs",
        "context_window_id": safe_str(instance.get("context_window_id")) or f"ctx-{instance_id}",
        "isolation_mode": safe_str(instance.get("isolation_mode")) or "per_instance_context_package",
        "read_only": _safe_bool(instance.get("read_only"), default=False),
        "ownership_scope": safe_list_str(instance.get("ownership_scope")),
        "depends_on": safe_list_str(instance.get("depends_on")),
        "merge_target": safe_str(instance.get("merge_target")) or None,
        "stop_conditions": safe_list_str(instance.get("stop_conditions")),
        "verify_status": safe_str(instance.get("verify_status")) or "pending",
        "artifacts": artifact_paths,
    }
    run_dir = ROOT_DIR / artifact_paths["run_dir"]
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "run_manifest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def stage_run(
    *,
    agent_id: str,
    task_id: str,
    purpose: str,
    context_refs: list[str] | None = None,
    host_id: str = "dispatcher",
    mode: str = "normal",
    root_agent_id: str | None = None,
    parent_instance_id: str | None = None,
    depth: int = 0,
    phase_id: str | None = None,
    interaction_mode: str | None = None,
    execution_backend: str | None = None,
    context_window_id: str | None = None,
    isolation_mode: str = "per_instance_context_package",
    read_only: bool | None = None,
    ownership_scope: list[str] | None = None,
    depends_on: list[str] | None = None,
    merge_target: str | None = None,
    path: Path | None = None,
    registry_path: Path | None = None,
    agents_root: Path | None = None,
) -> dict[str, Any]:
    candidates = [
        agent
        for agent in list_agents(path=path, registry_path=registry_path, agents_root=agents_root)
        if safe_str(agent.get("id")) == agent_id
    ]
    if not candidates:
        raise ValueError(f"Unknown agent id: {agent_id}")
    agent = candidates[0]
    run_id = _build_run_id(agent_id, task_id, purpose)
    trace_id = _build_trace_id(run_id)
    instance_id = _build_instance_id(run_id)
    artifact_paths = _artifact_paths(run_id)
    derived_execution_mode = safe_str(agent.get("executionMode")) or "sequential"
    derived_execution_backend = safe_str(execution_backend) or ("dispatcher_backed_child_runs" if host_id == "codex" else "native_isolated_windows")
    payload = {
        "run_id": run_id,
        "trace_id": trace_id,
        "instance_id": instance_id,
        "agent_id": agent_id,
        "profile_id": agent_id,
        "kind": safe_str(agent.get("kind")) or "top_level",
        "host_id": host_id,
        "mode": mode,
        "task_id": task_id,
        "purpose": purpose,
        "status": "planned",
        "created_at": now_iso(),
        "started_at": None,
        "finished_at": None,
        "parent_instance_id": safe_str(parent_instance_id) or None,
        "root_agent_id": safe_str(root_agent_id) or agent_id,
        "depth": max(int(depth or 0), 0),
        "phase_id": safe_str(phase_id) or None,
        "interaction_mode": safe_str(interaction_mode) or None,
        "input_refs": safe_list_str(context_refs),
        "output_refs": [],
        "allowed_skills": safe_list_str(agent.get("allowedSkills")),
        "allowed_tools": safe_list_str(agent.get("allowedTools")),
        "allowed_mcp": safe_list_str(agent.get("allowedMcp")),
        "allowed_rules": safe_list_str(agent.get("allowedRules")),
        "output_contract": safe_str(agent.get("outputContract")) or "agent_output.v1",
        "execution_mode": derived_execution_mode,
        "execution_backend": derived_execution_backend,
        "context_window_id": safe_str(context_window_id) or f"ctx-{instance_id}",
        "isolation_mode": safe_str(isolation_mode) or "per_instance_context_package",
        "read_only": _safe_bool(read_only, default=derived_execution_mode == "parallel_read_only"),
        "ownership_scope": safe_list_str(ownership_scope),
        "depends_on": safe_list_str(depends_on),
        "merge_target": safe_str(merge_target) or None,
        "stop_conditions": safe_list_str(agent.get("stopConditions")),
        "verify_status": "pending",
        "artifacts": artifact_paths,
        "source_refs": [
            str(path.relative_to(ROOT_DIR)) if path is not None else str((registry_path or DEFAULT_AGENT_REGISTRY).relative_to(ROOT_DIR)),
            str((agents_root or DEFAULT_AGENTS_ROOT).relative_to(ROOT_DIR)) if path is None else None,
        ],
    }
    run_dir = ROOT_DIR / artifact_paths["run_dir"]
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "run_manifest.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return payload


def _safe_bool(value: Any, *, default: bool = False) -> bool:
    return value if isinstance(value, bool) else default


def load_run(run_id: str) -> tuple[Path, dict[str, Any]]:
    run_dir = DEFAULT_RUNS_DIR / run_id
    manifest_path = run_dir / "run_manifest.json"
    if not manifest_path.exists():
        raise ValueError(f"Unknown run id: {run_id}")
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"Invalid run manifest for: {run_id}")
    return manifest_path, payload


def save_run(manifest_path: Path, payload: dict[str, Any]) -> None:
    manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _telemetry_event_kwargs(payload: dict[str, Any], *, status: str, step: str, outcome: str | None = None, verify_status: str | None = None, error: str | None = None) -> dict[str, Any]:
    artifacts = payload.get("artifacts") if isinstance(payload.get("artifacts"), dict) else {}
    source_refs = [
        safe_str(item)
        for item in (payload.get("source_refs") if isinstance(payload.get("source_refs"), list) else [])
        if safe_str(item)
    ]
    return {
        "agent_id": safe_str(payload.get("agent_id")),
        "task_id": safe_str(payload.get("task_id")),
        "run_id": safe_str(payload.get("run_id")),
        "trace_id": safe_str(payload.get("trace_id")),
        "profile_id": safe_str(payload.get("profile_id")) or safe_str(payload.get("agent_id")),
        "instance_id": safe_str(payload.get("instance_id")),
        "parent_instance_id": safe_str(payload.get("parent_instance_id")) or None,
        "root_agent_id": safe_str(payload.get("root_agent_id")) or safe_str(payload.get("agent_id")) or None,
        "depth": int(payload.get("depth", 0) or 0),
        "phase_id": safe_str(payload.get("phase_id")) or None,
        "execution_mode": safe_str(payload.get("execution_mode")) or None,
        "execution_backend": safe_str(payload.get("execution_backend")) or None,
        "context_window_id": safe_str(payload.get("context_window_id")) or None,
        "isolation_mode": safe_str(payload.get("isolation_mode")) or None,
        "read_only": _safe_bool(payload.get("read_only"), default=False),
        "ownership_scope": safe_list_str(payload.get("ownership_scope")),
        "depends_on": safe_list_str(payload.get("depends_on")),
        "merge_target": safe_str(payload.get("merge_target")) or None,
        "interaction_mode": safe_str(payload.get("interaction_mode")) or None,
        "objective": safe_str(payload.get("purpose")),
        "status": status,
        "step": step,
        "verify_status": verify_status if verify_status is not None else safe_str(payload.get("verify_status")) or "pending",
        "rules": safe_list_str(payload.get("allowed_rules")),
        "tools": safe_list_str(payload.get("allowed_tools")),
        "skills": safe_list_str(payload.get("allowed_skills")),
        "mcp_tools": safe_list_str(payload.get("allowed_mcp")),
        "input_artifacts": safe_list_str(payload.get("input_refs")),
        "output_artifacts": safe_list_str(payload.get("output_refs")),
        "artifact_read": source_refs,
        "artifact_write": [safe_str(artifacts.get("manifest_path")), safe_str(artifacts.get("result_path"))],
        "metrics": {},
        "outcome": outcome,
        "error": error,
    }


def _phase_step(phase_id: Any, *, default_step: str) -> str:
    normalized = safe_str(phase_id).lower()
    if normalized == "phase_1_framing":
        return "step_3_orchestration"
    if normalized == "phase_2_parallel_audit":
        return "step_4_context_sync"
    if normalized == "phase_3_roundtable":
        return "step_5_role_window"
    if normalized == "phase_4_apply_merge":
        return "step_7_apply_or_publish"
    if normalized == "phase_5_parallel_verify":
        return "step_8_verify"
    if normalized == "phase_6_finalize":
        return "step_9_finalize"
    return default_step


def _is_root_instance(payload: dict[str, Any]) -> bool:
    depth = int(payload.get("depth", 0) or 0)
    parent_instance_id = safe_str(payload.get("parent_instance_id"))
    return depth <= 0 and not parent_instance_id


def _is_roundtable_phase(phase_id: Any) -> bool:
    return safe_str(phase_id).lower() == "phase_3_roundtable"


def _is_merge_phase(phase_id: Any) -> bool:
    return safe_str(phase_id).lower() == "phase_4_apply_merge"


def _normalize_phase(item: Any) -> dict[str, Any] | None:
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


def _validate_phase_instances(phase: dict[str, Any], phase_instances: list[dict[str, Any]]) -> None:
    phase_mode = safe_str(phase.get("mode")).lower() or "sequential"
    non_read_only = [item for item in phase_instances if not _safe_bool(item.get("read_only"), default=False)]
    if phase_mode == "parallel_read_only" and non_read_only:
        raise ValueError(
            f"Phase {safe_str(phase.get('phase_id'))} is parallel_read_only but has write-capable instances: "
            + ", ".join(safe_str(item.get("instance_id")) or safe_str(item.get("profile_id")) for item in non_read_only)
        )
    if phase_mode != "sequential" and len(non_read_only) > 1:
        raise ValueError(
            f"Phase {safe_str(phase.get('phase_id'))} has multiple write-capable instances; single-owner rule violated."
        )


def execute_collaboration_plan(
    *,
    task_id: str,
    collaboration_plan: dict[str, Any],
    log_dir: Path = DEFAULT_LOG_DIR,
) -> dict[str, Any]:
    interaction_mode = safe_str(collaboration_plan.get("interaction_mode")) or "sequential"
    raw_instances = collaboration_plan.get("spawned_instances") if isinstance(collaboration_plan.get("spawned_instances"), list) else []
    instances = [item for item in raw_instances if isinstance(item, dict)]
    phases = [
        normalized
        for normalized in (
            _normalize_phase(item)
            for item in (
                collaboration_plan.get("interaction_phases")
                if isinstance(collaboration_plan.get("interaction_phases"), list)
                else []
            )
        )
        if normalized is not None
    ]
    if not phases:
        seen_phase_ids: set[str] = set()
        for instance in instances:
            phase_id = safe_str(instance.get("phase_id"))
            if not phase_id or phase_id in seen_phase_ids:
                continue
            seen_phase_ids.add(phase_id)
            phases.append(
                {
                    "phase_id": phase_id,
                    "label": phase_id,
                    "mode": safe_str(instance.get("execution_mode")) or "sequential",
                    "goal": "",
                    "participants": safe_list_str([safe_str(instance.get("profile_id"))]),
                    "depends_on": [],
                    "outputs": [],
                    "status": "planned",
                    "merge_into": None,
                }
            )

    completed_phase_ids: set[str] = set()
    phase_reports: list[dict[str, Any]] = []
    run_reports: list[dict[str, Any]] = []
    last_completed_payload: dict[str, Any] | None = None

    for phase in phases:
        phase_id = safe_str(phase.get("phase_id"))
        missing_dependencies = [dep for dep in safe_list_str(phase.get("depends_on")) if dep not in completed_phase_ids]
        if missing_dependencies:
            raise ValueError(
                f"Phase {phase_id} cannot start before dependencies are completed: {', '.join(missing_dependencies)}"
            )
        phase_instances = [item for item in instances if safe_str(item.get("phase_id")) == phase_id]
        _validate_phase_instances(phase, phase_instances)
        phase_status = "completed"
        started_runs: list[str] = []

        for instance in phase_instances:
            staged = stage_instance_run(instance, interaction_mode=interaction_mode)
            started = start_run(staged["run_id"], log_dir=log_dir)
            result_payload = {
                "task_id": task_id,
                "phase_id": phase_id,
                "agent_id": safe_str(started.get("agent_id")),
                "instance_id": safe_str(started.get("instance_id")),
                "summary": f"{safe_str(started.get('agent_id'))} completed {phase_id}",
                "merge_target": safe_str(started.get("merge_target")) or None,
            }
            completed = finalize_run(
                started["run_id"],
                final_status="completed",
                verify_status="passed",
                result_payload=result_payload,
                log_dir=log_dir,
            )
            last_completed_payload = completed
            started_runs.append(staged["run_id"])
            run_reports.append(
                {
                    "run_id": safe_str(completed.get("run_id")),
                    "instance_id": safe_str(completed.get("instance_id")),
                    "agent_id": safe_str(completed.get("agent_id")),
                    "phase_id": phase_id,
                    "status": safe_str(completed.get("status")) or "completed",
                    "verify_status": safe_str(completed.get("verify_status")) or "passed",
                    "result_path": safe_str((completed.get("artifacts") or {}).get("result_path")),
                }
            )

        if not phase_instances:
            phase_status = "skipped"
        completed_phase_ids.add(phase_id)
        phase_reports.append(
            {
                "phase_id": phase_id,
                "mode": safe_str(phase.get("mode")) or "sequential",
                "status": phase_status,
                "run_ids": started_runs,
                "participants": safe_list_str(phase.get("participants")),
            }
        )

    if last_completed_payload is not None:
        final_phase_id = safe_str((phase_reports[-1] if phase_reports else {}).get("phase_id"))
        TELEMETRY.append_orchestration_event(
            log_dir,
            **_telemetry_event_kwargs(
                last_completed_payload,
                status="completed",
                step=_phase_step(final_phase_id, default_step="step_9_finalize"),
                outcome="collaboration_plan_completed",
                verify_status="passed",
            ),
        )

    return {
        "task_id": task_id,
        "interaction_mode": interaction_mode,
        "status": "completed",
        "phases": phase_reports,
        "runs": run_reports,
        "runs_total": len(run_reports),
    }


def load_json_file(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON object expected: {path}")
    return payload


def start_run(run_id: str, *, log_dir: Path = DEFAULT_LOG_DIR) -> dict[str, Any]:
    manifest_path, payload = load_run(run_id)
    if safe_str(payload.get("status")) == "running":
        return payload
    payload["status"] = "running"
    payload["started_at"] = now_iso()
    save_run(manifest_path, payload)
    phase_id = safe_str(payload.get("phase_id"))
    phase_step = _phase_step(phase_id, default_step="step_3_orchestration")
    interaction_mode = safe_str(payload.get("interaction_mode"))
    if _is_root_instance(payload) and interaction_mode:
        TELEMETRY.append_orchestration_event(
            log_dir,
            **_telemetry_event_kwargs(
                payload,
                status=TELEMETRY.ORCHESTRATION_MODE_SELECTED_STATUS,
                step="step_3_orchestration",
                outcome="mode_selected",
            ),
        )
    if phase_id:
        TELEMETRY.append_orchestration_event(
            log_dir,
            **_telemetry_event_kwargs(
                payload,
                status=TELEMETRY.ORCHESTRATION_PHASE_STARTED_STATUS,
                step=phase_step,
                outcome="phase_started",
            ),
        )
    if _is_roundtable_phase(phase_id):
        TELEMETRY.append_orchestration_event(
            log_dir,
            **_telemetry_event_kwargs(
                payload,
                status=TELEMETRY.ROUNDTABLE_STARTED_STATUS,
                step=phase_step,
                outcome="roundtable_started",
            ),
            round_index=1,
        )
    if _is_merge_phase(phase_id):
        TELEMETRY.append_orchestration_event(
            log_dir,
            **_telemetry_event_kwargs(
                payload,
                status=TELEMETRY.ORCHESTRATION_MERGE_STARTED_STATUS,
                step=phase_step,
                outcome="merge_started",
            ),
        )
    TELEMETRY.append_orchestration_event(
        log_dir,
        **_telemetry_event_kwargs(payload, status=TELEMETRY.ORCHESTRATION_INSTANCE_SPAWNED_STATUS, step=phase_step, outcome="dispatcher_started"),
    )
    return payload


def finalize_run(
    run_id: str,
    *,
    final_status: str,
    verify_status: str = "pending",
    result_payload: dict[str, Any] | None = None,
    error: str | None = None,
    log_dir: Path = DEFAULT_LOG_DIR,
) -> dict[str, Any]:
    manifest_path, payload = load_run(run_id)
    artifacts = payload.get("artifacts") if isinstance(payload.get("artifacts"), dict) else {}
    result_path = ROOT_DIR / safe_str(artifacts.get("result_path"))
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_body = result_payload if isinstance(result_payload, dict) else {}
    result_body.setdefault("run_id", run_id)
    result_body.setdefault("status", final_status)
    if error:
        result_body["error"] = error
    result_path.write_text(json.dumps(result_body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    payload["status"] = final_status
    payload["verify_status"] = verify_status
    payload["finished_at"] = now_iso()
    payload["output_refs"] = safe_list_str(payload.get("output_refs")) + [safe_str(artifacts.get("result_path"))]
    save_run(manifest_path, payload)
    phase_id = safe_str(payload.get("phase_id"))
    phase_step = _phase_step(phase_id, default_step="step_6_role_exit_decision")
    if final_status == "completed" and phase_id:
        TELEMETRY.append_orchestration_event(
            log_dir,
            **_telemetry_event_kwargs(
                payload,
                status=TELEMETRY.ORCHESTRATION_PHASE_COMPLETED_STATUS,
                step=phase_step,
                outcome="phase_completed",
                verify_status=verify_status,
            ),
        )
    if _is_roundtable_phase(phase_id):
        if final_status == "completed":
            TELEMETRY.append_orchestration_event(
                log_dir,
                **_telemetry_event_kwargs(
                    payload,
                    status=TELEMETRY.ROUNDTABLE_ROUND_COMPLETED_STATUS,
                    step=phase_step,
                    outcome="roundtable_round_completed",
                    verify_status=verify_status,
                ),
                round_index=1,
            )
            TELEMETRY.append_orchestration_event(
                log_dir,
                **_telemetry_event_kwargs(
                    payload,
                    status=TELEMETRY.ROUNDTABLE_CONVERGED_STATUS,
                    step=phase_step,
                    outcome="roundtable_converged",
                    verify_status=verify_status,
                ),
            )
    if _is_merge_phase(phase_id):
        if final_status == "completed":
            TELEMETRY.append_orchestration_event(
                log_dir,
                **_telemetry_event_kwargs(
                    payload,
                    status=TELEMETRY.ORCHESTRATION_MERGE_COMPLETED_STATUS,
                    step=phase_step,
                    outcome="merge_completed",
                    verify_status=verify_status,
                ),
            )
        elif final_status in {"failed", "cancelled"}:
            TELEMETRY.append_orchestration_event(
                log_dir,
                **_telemetry_event_kwargs(
                    payload,
                    status=TELEMETRY.ORCHESTRATION_CONFLICT_DETECTED_STATUS,
                    step=phase_step,
                    outcome="merge_conflict_detected",
                    verify_status=verify_status,
                    error=error,
                ),
            )
    telemetry_status = TELEMETRY.ORCHESTRATION_INSTANCE_COMPLETED_STATUS if final_status == "completed" else TELEMETRY.ORCHESTRATION_INSTANCE_FAILED_STATUS
    outcome = "dispatcher_completed" if final_status == "completed" else "dispatcher_failed"
    TELEMETRY.append_orchestration_event(
        log_dir,
        **_telemetry_event_kwargs(
            payload,
            status=telemetry_status,
            step=phase_step,
            outcome=outcome,
            verify_status=verify_status,
            error=error,
        ),
    )
    return payload


def cancel_run(run_id: str, *, log_dir: Path = DEFAULT_LOG_DIR) -> dict[str, Any]:
    return finalize_run(
        run_id,
        final_status="cancelled",
        verify_status="skipped",
        result_payload={"cancelled": True},
        error="cancelled_by_dispatcher",
        log_dir=log_dir,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Stage cross-host OAP agent runs from direct OPERATING_PLAN metadata.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list-agents", help="List available agents from active OPERATING_PLAN metadata.")
    list_parser.add_argument("--host", default="", help="Optional host filter: codex | claude_code | github_copilot")
    list_parser.add_argument("--kind", default="", help="Optional kind filter: top_level | runtime_specialist")
    list_parser.add_argument("--registry", default=str(DEFAULT_AGENT_REGISTRY))
    list_parser.add_argument("--agents-root", default=str(DEFAULT_AGENTS_ROOT))

    stage_parser = subparsers.add_parser("stage-run", help="Create a staged run manifest for a selected agent.")
    stage_parser.add_argument("--agent-id", required=True)
    stage_parser.add_argument("--task-id", required=True)
    stage_parser.add_argument("--purpose", required=True)
    stage_parser.add_argument("--host-id", default="dispatcher")
    stage_parser.add_argument("--mode", default="normal")
    stage_parser.add_argument("--context-ref", action="append", default=[])
    stage_parser.add_argument("--root-agent-id", default="")
    stage_parser.add_argument("--parent-instance-id", default="")
    stage_parser.add_argument("--depth", type=int, default=0)
    stage_parser.add_argument("--phase-id", default="")
    stage_parser.add_argument("--interaction-mode", default="")
    stage_parser.add_argument("--execution-backend", default="")
    stage_parser.add_argument("--context-window-id", default="")
    stage_parser.add_argument("--isolation-mode", default="per_instance_context_package")
    stage_parser.add_argument("--read-only", default="", help="Optional bool: true/false")
    stage_parser.add_argument("--ownership-scope", action="append", default=[])
    stage_parser.add_argument("--depends-on", action="append", default=[])
    stage_parser.add_argument("--merge-target", default="")
    stage_parser.add_argument("--registry", default=str(DEFAULT_AGENT_REGISTRY))
    stage_parser.add_argument("--agents-root", default=str(DEFAULT_AGENTS_ROOT))

    start_parser = subparsers.add_parser("start-run", help="Move a staged run into running state and write spawn telemetry.")
    start_parser.add_argument("--run-id", required=True)
    start_parser.add_argument("--log-dir", default=str(DEFAULT_LOG_DIR))

    complete_parser = subparsers.add_parser("complete-run", help="Complete a run, write result.json and completion telemetry.")
    complete_parser.add_argument("--run-id", required=True)
    complete_parser.add_argument("--verify-status", default="passed")
    complete_parser.add_argument("--result-json", default="")
    complete_parser.add_argument("--log-dir", default=str(DEFAULT_LOG_DIR))

    fail_parser = subparsers.add_parser("fail-run", help="Fail a run, write result.json and failure telemetry.")
    fail_parser.add_argument("--run-id", required=True)
    fail_parser.add_argument("--verify-status", default="failed")
    fail_parser.add_argument("--error", required=True)
    fail_parser.add_argument("--result-json", default="")
    fail_parser.add_argument("--log-dir", default=str(DEFAULT_LOG_DIR))

    get_parser = subparsers.add_parser("get-run", help="Read a staged run manifest.")
    get_parser.add_argument("--run-id", required=True)

    cancel_parser = subparsers.add_parser("cancel-run", help="Cancel a run and log terminal telemetry.")
    cancel_parser.add_argument("--run-id", required=True)
    cancel_parser.add_argument("--log-dir", default=str(DEFAULT_LOG_DIR))

    execute_parser = subparsers.add_parser(
        "execute-plan",
        help="Execute a full collaboration_plan by phases and write manifests + telemetry for every spawned instance.",
    )
    execute_parser.add_argument("--task-id", required=True)
    execute_parser.add_argument("--plan-json-path", required=True)
    execute_parser.add_argument("--log-dir", default=str(DEFAULT_LOG_DIR))

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "list-agents":
        payload = list_agents(
            host=safe_str(args.host) or None,
            kind=safe_str(args.kind) or None,
            registry_path=Path(args.registry),
            agents_root=Path(args.agents_root),
        )
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "stage-run":
        payload = stage_run(
            agent_id=args.agent_id,
            task_id=args.task_id,
            purpose=args.purpose,
            context_refs=args.context_ref,
            host_id=args.host_id,
            mode=args.mode,
            root_agent_id=safe_str(args.root_agent_id) or None,
            parent_instance_id=safe_str(args.parent_instance_id) or None,
            depth=args.depth,
            phase_id=safe_str(args.phase_id) or None,
            interaction_mode=safe_str(args.interaction_mode) or None,
            execution_backend=safe_str(args.execution_backend) or None,
            context_window_id=safe_str(args.context_window_id) or None,
            isolation_mode=safe_str(args.isolation_mode) or "per_instance_context_package",
            read_only=parse_optional_bool(args.read_only),
            ownership_scope=safe_list_str(args.ownership_scope),
            depends_on=safe_list_str(args.depends_on),
            merge_target=safe_str(args.merge_target) or None,
            registry_path=Path(args.registry),
            agents_root=Path(args.agents_root),
        )
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "start-run":
        payload = start_run(args.run_id, log_dir=Path(args.log_dir))
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "complete-run":
        result_payload = json.loads(args.result_json) if safe_str(args.result_json) else {}
        payload = finalize_run(
            args.run_id,
            final_status="completed",
            verify_status=args.verify_status,
            result_payload=result_payload,
            log_dir=Path(args.log_dir),
        )
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "fail-run":
        result_payload = json.loads(args.result_json) if safe_str(args.result_json) else {}
        payload = finalize_run(
            args.run_id,
            final_status="failed",
            verify_status=args.verify_status,
            result_payload=result_payload,
            error=args.error,
            log_dir=Path(args.log_dir),
        )
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "get-run":
        _, payload = load_run(args.run_id)
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "cancel-run":
        payload = cancel_run(args.run_id, log_dir=Path(args.log_dir))
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    if args.command == "execute-plan":
        payload = execute_collaboration_plan(
            task_id=args.task_id,
            collaboration_plan=load_json_file(Path(args.plan_json_path)),
            log_dir=Path(args.log_dir),
        )
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0
    parser.error("Unsupported command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
