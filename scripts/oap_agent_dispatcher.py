#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_HOST_CATALOG = ROOT_DIR / "docs" / "agents" / "host_agnostic_agent_catalog.yaml"
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


def load_catalog(path: Path = DEFAULT_HOST_CATALOG) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def list_agents(*, host: str | None = None, kind: str | None = None, path: Path = DEFAULT_HOST_CATALOG) -> list[dict[str, Any]]:
    payload = load_catalog(path)
    agents = payload.get("agents") if isinstance(payload, dict) else None
    if not isinstance(agents, list):
        return []
    results: list[dict[str, Any]] = []
    for raw in agents:
        if not isinstance(raw, dict):
            continue
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
    path: Path = DEFAULT_HOST_CATALOG,
) -> dict[str, Any]:
    candidates = [agent for agent in list_agents(path=path) if safe_str(agent.get("id")) == agent_id]
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
        "artifact_read": [str(DEFAULT_HOST_CATALOG.relative_to(ROOT_DIR))],
        "artifact_write": [safe_str(artifacts.get("manifest_path")), safe_str(artifacts.get("result_path"))],
        "metrics": {},
        "outcome": outcome,
        "error": error,
    }


def start_run(run_id: str, *, log_dir: Path = DEFAULT_LOG_DIR) -> dict[str, Any]:
    manifest_path, payload = load_run(run_id)
    if safe_str(payload.get("status")) == "running":
        return payload
    payload["status"] = "running"
    payload["started_at"] = now_iso()
    save_run(manifest_path, payload)
    TELEMETRY.append_orchestration_event(
        log_dir,
        **_telemetry_event_kwargs(payload, status=TELEMETRY.ORCHESTRATION_INSTANCE_SPAWNED_STATUS, step="step_3_orchestration", outcome="dispatcher_started"),
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
    telemetry_status = TELEMETRY.ORCHESTRATION_INSTANCE_COMPLETED_STATUS if final_status == "completed" else TELEMETRY.ORCHESTRATION_INSTANCE_FAILED_STATUS
    outcome = "dispatcher_completed" if final_status == "completed" else "dispatcher_failed"
    TELEMETRY.append_orchestration_event(
        log_dir,
        **_telemetry_event_kwargs(
            payload,
            status=telemetry_status,
            step="step_6_role_exit_decision",
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
    parser = argparse.ArgumentParser(description="Stage cross-host OAP agent runs from the canonical host-agnostic catalog.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list-agents", help="List available agents from the canonical host catalog.")
    list_parser.add_argument("--host", default="", help="Optional host filter: codex | claude_code | github_copilot")
    list_parser.add_argument("--kind", default="", help="Optional kind filter: top_level | runtime_specialist")

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

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "list-agents":
        payload = list_agents(host=safe_str(args.host) or None, kind=safe_str(args.kind) or None)
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
    parser.error("Unsupported command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
