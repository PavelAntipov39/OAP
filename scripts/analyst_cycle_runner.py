#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]


def _load_telemetry_module():
    target = Path(__file__).resolve().with_name("agent_telemetry.py")
    spec = importlib.util.spec_from_file_location("agent_telemetry", target)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot_load_agent_telemetry")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


telemetry = _load_telemetry_module()


def _load_shadow_trial_module():
    target = Path(__file__).resolve().with_name("skill_shadow_trial_runner.py")
    spec = importlib.util.spec_from_file_location("skill_shadow_trial_runner", target)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot_load_skill_shadow_trial_runner")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


shadow_trial = _load_shadow_trial_module()

CANONICAL_STEP_PLAN: list[dict[str, Any]] = [
    {"step": "step_0_intake", "status": "planned", "outcome": "task intake prepared"},
    {"step": "step_1_start", "status": "started", "outcome": "run started"},
    {"step": "step_2_preflight", "status": "started", "outcome": "health check passed"},
    {"step": "step_3_orchestration", "status": "planned", "outcome": "reuse-first orchestration selected"},
    {"step": "step_4_context_sync", "status": "started", "outcome": "evidence package updated"},
    {"step": "step_5_role_window", "status": "recommendation_suggested", "outcome": "candidate list scored"},
    {"step": "step_6_role_exit_decision", "status": "planned", "outcome": "top priority selected"},
    {"step": "step_7_apply_or_publish", "status": "recommendation_applied", "outcome": "top priority applied"},
    {"step": "step_7_contract_gate", "status": "completed", "outcome": "contract gate passed"},
    {"step": "step_8_verify", "status": "verify_started", "outcome": "verify started"},
    {"step": "step_8_verify", "status": "verify_passed", "outcome": "verify passed"},
    {"step": "step_8_error_channel", "status": "completed", "outcome": "verify error channel closed"},
    {"step": "step_9_finalize", "status": "lesson_captured", "outcome": "lesson captured"},
    {"step": "step_9_finalize", "status": "completed", "outcome": "cycle completed"},
    {"step": "step_9_publish_snapshots", "status": "completed", "outcome": "snapshots published"},
]


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def build_log_namespace(
    *,
    agent_id: str,
    task_id: str,
    run_id: str,
    trace_id: str,
    log_dir: str,
    enforce_step_contract: str,
    step: str,
    status: str,
    outcome: str,
    artifact_read: list[Any],
    artifact_write: list[Any],
    artifact_op: list[Any] | None = None,
    tokens_in: int,
    tokens_out: int,
) -> argparse.Namespace:
    timestamp = utc_now_iso()
    read_refs = telemetry.normalize_artifact_refs(artifact_read, step=step)
    write_refs = telemetry.normalize_artifact_refs(artifact_write, step=step)
    if artifact_op is not None:
        normalized_artifact_ops = artifact_op
    else:
        normalized_artifact_ops = telemetry.build_artifact_operations_from_refs(
            read_refs=read_refs,
            write_refs=write_refs,
            step=step,
            timestamp=timestamp,
            task_id=task_id,
            run_id=run_id,
            source="telemetry",
            write_op="update",
        )
        if step == "step_7_apply_or_publish":
            delete_ref = telemetry.make_artifact_ref(
                f"artifacts/tmp/{task_id}-draft.md",
                step=step,
                reason="role_decision",
            )
            if delete_ref:
                normalized_artifact_ops.append(
                    {
                        "path": delete_ref.get("path", ""),
                        "op": "delete",
                        "timestamp": timestamp,
                        "step": step,
                        "task_id": task_id,
                        "run_id": run_id,
                        "source": "telemetry",
                        "source_kind": delete_ref.get("source_kind", "unknown"),
                        "semantic_layer": delete_ref.get("semantic_layer", "unknown"),
                        "reason": delete_ref.get("reason", "unknown"),
                        "label": delete_ref.get("label", delete_ref.get("path", "")),
                    }
                )
    return argparse.Namespace(
        timestamp=timestamp,
        run_id=run_id,
        trace_id=trace_id,
        duration_ms=None,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        review_errors=None,
        agent_id=agent_id,
        process=f"{agent_id}_cycle_runner",
        span_id=None,
        task_id=task_id,
        step=step,
        status=status,
        outcome=outcome,
        recommendation_id=None,
        benchmark_run_id=None,
        benchmark_case_id=None,
        attempt_index=None,
        profile_id=None,
        instance_id=None,
        parent_instance_id=None,
        root_agent_id=None,
        depth=None,
        objective=None,
        verify_status="passed" if status in {"verify_passed", "completed"} else "pending",
        judge_model=None,
        judge_score=None,
        mcp=[],
        tool=[],
        skill=[],
        rule=[],
        input_artifact=[],
        output_artifact=[],
        artifact_read=read_refs,
        artifact_write=write_refs,
        artifact_op=normalized_artifact_ops,
        target_delta_pct=None,
        guardrail_breached=None,
        ab_sessions_required=None,
        error=None,
        log_dir=log_dir,
        enforce_cycle=False,
        enforce_mode="soft_warning",
        enforce_final_scope="latest",
        enforce_step_contract=enforce_step_contract,
        auto_capability_refresh="off",
        enforce_out_json=None,
    )


def build_structured_artifacts(
    values: list[Any],
    *,
    step: str,
    reason: str | None = None,
) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for item in values:
        if reason and hasattr(telemetry, "make_artifact_ref"):
            ref = telemetry.make_artifact_ref(item, step=step, reason=reason)
            if ref:
                refs.append(ref)
            continue
        refs.extend(telemetry.normalize_artifact_refs([item], step=step))
    return telemetry.normalize_artifact_refs(refs, step=step)


def build_report_namespace(log_dir: str, report_dir: str) -> argparse.Namespace:
    base_dir = Path(report_dir)
    return argparse.Namespace(
        log_dir=log_dir,
        out_json=str(base_dir / "agent_telemetry_summary.json"),
        out_md=str(base_dir / "agent_telemetry_summary.md"),
        out_cycle_json=str(base_dir / "agent_cycle_validation_report.json"),
        out_latest_analyst_json=str(base_dir / "agent_latest_cycle_analyst.json"),
        benchmark_summary_json=str(base_dir / "agent_benchmark_summary.json"),
        file_ops_explicit_min_pct=90.0,
        file_ops_fallback_max_pct=10.0,
        file_ops_gate_mode="soft_warning",
        file_ops_min_events=5,
    )


def log_capability_refresh_event(
    *,
    agent_id: str,
    task_id: str,
    run_id: str,
    trace_id: str,
    log_dir: str,
    status: str,
    outcome: str,
    artifact_read: list[Any],
    artifact_write: list[Any],
    tokens_in: int,
    tokens_out: int,
    error: str | None = None,
) -> int:
    reason = "publish_snapshot" if status == "capability_snapshot_published" else "capability_refresh"
    log_args = build_log_namespace(
        agent_id=agent_id,
        task_id=task_id,
        run_id=run_id,
        trace_id=trace_id,
        log_dir=log_dir,
        enforce_step_contract="warning",
        step="step_9_publish_snapshots",
        status=status,
        outcome=outcome,
        artifact_read=build_structured_artifacts(artifact_read, step="step_9_publish_snapshots", reason=reason),
        artifact_write=build_structured_artifacts(artifact_write, step="step_9_publish_snapshots", reason=reason),
        tokens_in=tokens_in,
        tokens_out=tokens_out,
    )
    log_args.error = error
    return telemetry.command_log(log_args)


def refresh_capability_optimization(
    *,
    agent_id: str,
    task_id: str,
    run_id: str,
    trace_id: str,
    log_dir: str,
    report_dir: str,
) -> int:
    start_rc = log_capability_refresh_event(
        agent_id=agent_id,
        task_id=task_id,
        run_id=run_id,
        trace_id=trace_id,
        log_dir=log_dir,
        status="capability_refresh_started",
        outcome="capability refresh subflow started",
        artifact_read=["docs/agents/registry.yaml"],
        artifact_write=[],
        tokens_in=84,
        tokens_out=22,
    )
    if start_rc != 0:
        return start_rc

    registry = shadow_trial.load_registry(shadow_trial.DEFAULT_REGISTRY_PATH)
    refresh_result = shadow_trial.refresh_agent_capabilities(
        registry=registry,
        agent_id=agent_id,
        last_run_id=run_id,
        tasks_per_trial=3,
    )

    if refresh_result.get("stale_before_refresh"):
        stale_reason = str(refresh_result.get("stale_before_refresh_reason") or "snapshot_missing")
        stale_rc = log_capability_refresh_event(
            agent_id=agent_id,
            task_id=task_id,
            run_id=run_id,
            trace_id=trace_id,
            log_dir=log_dir,
            status="capability_stale_detected",
            outcome=f"stale detected before refresh: {stale_reason}",
            artifact_read=[str(refresh_result.get("snapshot_path") or "artifacts/capability_trials/analyst-agent/capability_snapshot.json")],
            artifact_write=[],
            tokens_in=18,
            tokens_out=12,
        )
        if stale_rc != 0:
            return stale_rc

    plan_rc = log_capability_refresh_event(
        agent_id=agent_id,
        task_id=task_id,
        run_id=run_id,
        trace_id=trace_id,
        log_dir=log_dir,
        status="shadow_trial_plan_refreshed",
        outcome="shadow trial plan refreshed",
        artifact_read=["docs/agents/registry.yaml"],
        artifact_write=[str(refresh_result.get("plan_path") or "")],
        tokens_in=46,
        tokens_out=28,
    )
    if plan_rc != 0:
        return plan_rc

    if int(refresh_result.get("judgements_total") or 0) > 0:
        judged_rc = log_capability_refresh_event(
            agent_id=agent_id,
            task_id=task_id,
            run_id=run_id,
            trace_id=trace_id,
            log_dir=log_dir,
            status="shadow_trial_judged",
            outcome="existing shadow judgement linked into capability snapshot",
            artifact_read=[str(refresh_result.get("judgement_path") or "")],
            artifact_write=[str(refresh_result.get("snapshot_path") or "")],
            tokens_in=28,
            tokens_out=18,
        )
        if judged_rc != 0:
            return judged_rc

    publish_rc = log_capability_refresh_event(
        agent_id=agent_id,
        task_id=task_id,
        run_id=run_id,
        trace_id=trace_id,
        log_dir=log_dir,
        status="capability_snapshot_published",
        outcome="capability snapshot written",
        artifact_read=[str(refresh_result.get("plan_path") or ""), str(refresh_result.get("judgement_path") or "")],
        artifact_write=[str(refresh_result.get("snapshot_path") or "")],
        tokens_in=38,
        tokens_out=26,
    )
    if publish_rc != 0:
        return publish_rc

    complete_rc = log_capability_refresh_event(
        agent_id=agent_id,
        task_id=task_id,
        run_id=run_id,
        trace_id=trace_id,
        log_dir=log_dir,
        status="capability_refresh_completed",
        outcome="capability refresh subflow completed",
        artifact_read=[str(refresh_result.get("snapshot_path") or "")],
        artifact_write=[
            "artifacts/agent_telemetry_summary.json",
            "artifacts/agent_latest_cycle_analyst.json",
        ],
        tokens_in=24,
        tokens_out=16,
    )
    if complete_rc != 0:
        return complete_rc

    report_rc = telemetry.command_report(build_report_namespace(log_dir, report_dir))
    if report_rc != 0:
        return report_rc

    for command in (
        ["node", "ops-web/scripts/build_content_index.mjs"],
        ["node", "ops-web/scripts/check_agents_manifest.mjs"],
    ):
        completed = subprocess.run(command, cwd=ROOT_DIR, capture_output=True, text=True)
        if completed.returncode != 0:
            error_text = (completed.stderr or completed.stdout or "capability_refresh_command_failed").strip()
            log_capability_refresh_event(
                agent_id=agent_id,
                task_id=task_id,
                run_id=run_id,
                trace_id=trace_id,
                log_dir=log_dir,
                status="capability_refresh_failed",
                outcome=f"failed while running {' '.join(command)}",
                artifact_read=[str(refresh_result.get("snapshot_path") or "")],
                artifact_write=[],
                tokens_in=12,
                tokens_out=8,
                error=error_text,
            )
            return completed.returncode
    return 0


def run_cycle(
    *,
    agent_id: str,
    task_id: str,
    run_id: str,
    trace_id: str,
    phase: str,
    log_dir: str,
    dry_run: bool,
) -> int:
    enforce_mode = "warning" if phase == "warning" else "strict"
    fallback_artifacts = getattr(telemetry, "ANALYST_STEP_FALLBACK_ARTIFACTS", {})

    if dry_run:
        payload = {
            "agent_id": agent_id,
            "task_id": task_id,
            "run_id": run_id,
            "trace_id": trace_id,
            "phase": phase,
            "enforce_step_contract": enforce_mode,
            "events": CANONICAL_STEP_PLAN,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    for index, event in enumerate(CANONICAL_STEP_PLAN, start=1):
        step = str(event["step"])
        status = str(event["status"])
        outcome = str(event.get("outcome") or "")
        fallback = fallback_artifacts.get(step, {})
        artifact_read = build_structured_artifacts(list(fallback.get("read", [])), step=step)
        artifact_write = build_structured_artifacts(list(fallback.get("write", [])), step=step)
        log_args = build_log_namespace(
            agent_id=agent_id,
            task_id=task_id,
            run_id=run_id,
            trace_id=trace_id,
            log_dir=log_dir,
            enforce_step_contract=enforce_mode,
            step=step,
            status=status,
            outcome=outcome,
            artifact_read=artifact_read,
            artifact_write=artifact_write,
            tokens_in=120 + index * 7,
            tokens_out=90 + index * 5,
        )
        rc = telemetry.command_log(log_args)
        if rc != 0:
            print(
                f"[analyst-cycle-runner] failed at step #{index}: step={step} status={status} "
                f"(phase={phase}, enforce={enforce_mode})"
            )
            return rc
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run canonical step_0..step_9.1 cycle for selected OAP agent (warning/strict rollout).",
    )
    parser.add_argument("--agent-id", default="analyst-agent")
    parser.add_argument("--task-id", default=None)
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--trace-id", default=None)
    parser.add_argument("--phase", choices=["warning", "strict"], default="warning")
    parser.add_argument("--log-dir", default=".logs/agents")
    parser.add_argument("--report-dir", default="artifacts")
    parser.add_argument("--skip-report", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    timestamp_id = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M%S")
    agent_id = str(args.agent_id or "analyst-agent").strip()
    task_id = args.task_id or f"task-canonical-cycle-{agent_id}-{timestamp_id}"
    run_id = args.run_id or f"run-{task_id}"
    trace_id = args.trace_id or f"trace-{task_id}"

    rc = run_cycle(
        agent_id=agent_id,
        task_id=task_id,
        run_id=run_id,
        trace_id=trace_id,
        phase=args.phase,
        log_dir=args.log_dir,
        dry_run=args.dry_run,
    )
    if rc != 0:
        return rc

    if args.dry_run or args.skip_report:
        return 0

    report_rc = telemetry.command_report(build_report_namespace(args.log_dir, args.report_dir))
    if report_rc != 0:
        return report_rc

    refresh_rc = refresh_capability_optimization(
        agent_id=agent_id,
        task_id=task_id,
        run_id=run_id,
        trace_id=trace_id,
        log_dir=args.log_dir,
        report_dir=args.report_dir,
    )
    if refresh_rc != 0:
        return refresh_rc

    print(
        f"[canonical-cycle-runner] completed: agent_id={agent_id} task_id={task_id} run_id={run_id} "
        f"phase={args.phase} enforce_step_contract={args.phase}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
