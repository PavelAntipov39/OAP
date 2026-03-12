from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "agent_telemetry.py"
    spec = importlib.util.spec_from_file_location("agent_telemetry", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


telemetry = _load_module()


def build_log_args(**overrides):
    payload = {
        "timestamp": "2026-03-07T10:00:00Z",
        "run_id": "run-test",
        "trace_id": "trace-test",
        "duration_ms": None,
        "tokens_in": 0,
        "tokens_out": 0,
        "review_errors": None,
        "agent_id": "analyst-agent",
        "process": "test",
        "span_id": None,
        "task_id": "task-step-contract",
        "step": "step_1_start",
        "status": "started",
        "outcome": None,
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
        "mcp": [],
        "tool": [],
        "skill": [],
        "rule": [],
        "input_artifact": [],
        "output_artifact": [],
        "artifact_read": [],
        "artifact_write": [],
        "artifact_op": [],
        "target_delta_pct": None,
        "guardrail_breached": None,
        "ab_sessions_required": None,
        "error": None,
        "log_dir": "",
        "enforce_cycle": False,
        "enforce_mode": "soft_warning",
        "enforce_final_scope": "latest",
        "enforce_step_contract": "none",
        "auto_capability_refresh": "on_run",
        "enforce_out_json": None,
    }
    payload.update(overrides)
    return argparse.Namespace(**payload)


class AgentTelemetryTests(unittest.TestCase):
    def test_normalize_artifact_list_accepts_csv_and_list(self):
        self.assertEqual(
            telemetry.normalize_artifact_list(["docs/a.md, docs/b.md", "docs/a.md", "artifacts/x.json"]),
            ["docs/a.md", "docs/b.md", "artifacts/x.json"],
        )
        self.assertEqual(
            telemetry.normalize_artifact_list(
                [
                    {"path": "docs/agents/registry.yaml", "source_kind": "registry"},
                    {"path": "docs/agents/profile_templates.yaml", "source_kind": "template_catalog"},
                ]
            ),
            ["docs/agents/registry.yaml", "docs/agents/profile_templates.yaml"],
        )
        self.assertEqual(telemetry.normalize_artifact_list(None), [])

    def test_build_log_event_writes_structured_artifact_refs(self):
        args = build_log_args(
            step="step_3_orchestration",
            artifact_read=["docs/agents/registry.yaml", "docs/agents/profile_templates.yaml"],
            artifact_write=["agent_tasks.task_brief.context_package"],
        )
        event = telemetry.build_log_event(args)
        self.assertIsInstance(event["artifacts_read"], list)
        self.assertEqual(event["artifacts_read"][0]["path"], "docs/agents/registry.yaml")
        self.assertEqual(event["artifacts_read"][0]["source_kind"], "registry")
        self.assertEqual(event["artifacts_read"][0]["semantic_layer"], "tools")
        self.assertEqual(event["artifacts_read"][0]["reason"], "orchestration_lookup")
        self.assertEqual(event["artifacts_read"][1]["source_kind"], "template_catalog")
        self.assertEqual(event["artifacts_read"][1]["semantic_layer"], "tools")
        self.assertEqual(event["artifacts_written"][0]["path"], "agent_tasks.task_brief.context_package")
        self.assertEqual(event["artifacts_written"][0]["semantic_layer"], "tasks")

    def test_infer_artifact_semantic_layer_is_step_aware_for_registry(self):
        self.assertEqual(
            telemetry.infer_artifact_semantic_layer("docs/agents/registry.yaml", step="step_3_orchestration"),
            "tools",
        )
        self.assertEqual(
            telemetry.infer_artifact_semantic_layer("docs/agents/registry.yaml", step="step_1_start"),
            "rules",
        )
        self.assertEqual(
            telemetry.infer_artifact_semantic_layer("docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md", step="step_1_start"),
            "rules",
        )
        self.assertEqual(
            telemetry.infer_artifact_semantic_layer(".specify/specs/001-oap/spec.md", step="step_4_context_sync"),
            "schema",
        )
        self.assertEqual(
            telemetry.infer_artifact_semantic_layer("agent_tasks.task_brief.context_package", step="step_3_orchestration"),
            "tasks",
        )

    def test_build_log_event_accepts_artifact_op_and_mirrors_legacy_fields(self):
        args = build_log_args(
            step="step_4_context_sync",
            artifact_op=[
                "read:docs/agents/registry.yaml",
                "delete:artifacts/tmp/draft.md",
            ],
        )
        event = telemetry.build_log_event(args)
        operations = event["artifact_operations"]
        self.assertEqual([item["op"] for item in operations], ["read", "delete"])
        self.assertEqual([item["path"] for item in operations], ["docs/agents/registry.yaml", "artifacts/tmp/draft.md"])
        self.assertEqual(event["artifacts_read"][0]["path"], "docs/agents/registry.yaml")
        self.assertEqual(event["artifacts_written"][0]["path"], "artifacts/tmp/draft.md")
        self.assertEqual(event["artifact_contract_version"], telemetry.ARTIFACT_CONTRACT_VERSION)
        self.assertEqual(event["artifact_ops_origin"], "explicit")

    def test_build_log_event_builds_fallback_artifact_operations_from_legacy_refs(self):
        args = build_log_args(
            step="step_3_orchestration",
            artifact_read=["docs/agents/registry.yaml"],
            artifact_write=["artifacts/agent_cycle_validation_report.json"],
        )
        event = telemetry.build_log_event(args)
        self.assertEqual(
            [(item["op"], item["path"]) for item in event["artifact_operations"]],
            [
                ("read", "docs/agents/registry.yaml"),
                ("write", "artifacts/agent_cycle_validation_report.json"),
            ],
        )
        self.assertEqual(event["artifact_contract_version"], telemetry.ARTIFACT_CONTRACT_VERSION)
        self.assertEqual(event["artifact_ops_origin"], "mirrored_legacy")

    def test_build_log_event_mirrors_create_update_delete_into_artifacts_written(self):
        args = build_log_args(
            step="step_7_apply_or_publish",
            artifact_op=[
                "create:artifacts/new_result.json",
                "update:artifacts/new_result.json",
                "delete:artifacts/old_result.json",
                "invalid:artifacts/ignored.json",
            ],
        )
        event = telemetry.build_log_event(args)
        self.assertEqual(
            [item["op"] for item in event["artifact_operations"]],
            ["create", "update", "delete"],
        )
        self.assertEqual(
            sorted(ref["path"] for ref in event["artifacts_written"]),
            ["artifacts/new_result.json", "artifacts/old_result.json"],
        )

    def test_normalize_step_name_maps_legacy_implement_alias(self):
        self.assertEqual(telemetry.normalize_step_name("implement"), "step_7_apply_or_publish")

    def test_command_log_rejects_non_canonical_step_in_strict_mode(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = build_log_args(
                log_dir=tmp,
                step="legacy_unknown_step",
                enforce_step_contract="strict",
            )
            rc = telemetry.command_log(args)
            self.assertEqual(rc, 1)
            self.assertFalse((Path(tmp) / "analyst-agent.jsonl").exists())

    def test_command_log_accepts_non_canonical_step_in_warning_mode_and_marks_violation(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = build_log_args(
                log_dir=tmp,
                step="legacy_unknown_step",
                enforce_step_contract="warning",
            )
            rc = telemetry.command_log(args)
            self.assertEqual(rc, 0)
            target = Path(tmp) / "analyst-agent.jsonl"
            self.assertTrue(target.exists())
            rows = [line for line in target.read_text(encoding="utf-8").splitlines() if line.strip()]
            self.assertEqual(len(rows), 1)
            payload = json.loads(rows[0])
            self.assertEqual(payload.get("step"), "legacy_unknown_step")
            self.assertTrue(bool(payload.get("metrics", {}).get("step_contract_violation")))
            self.assertEqual(payload.get("step_contract", {}).get("mode"), "warning")

    def test_command_log_invokes_auto_capability_refresh_hook_on_final_step(self):
        with tempfile.TemporaryDirectory() as tmp:
            calls: list[str] = []
            original = telemetry.maybe_auto_capability_refresh

            def fake_hook(*, args, root_event, log_dir):
                calls.append(f"{root_event.get('step')}:{root_event.get('status')}")

            telemetry.maybe_auto_capability_refresh = fake_hook
            try:
                args = build_log_args(
                    log_dir=tmp,
                    step="step_9_finalize",
                    status="completed",
                    auto_capability_refresh="on_run",
                )
                rc = telemetry.command_log(args)
                self.assertEqual(rc, 0)
                self.assertEqual(calls, ["step_9_finalize:completed"])
            finally:
                telemetry.maybe_auto_capability_refresh = original

    def test_command_log_does_not_invoke_auto_capability_refresh_hook_when_disabled(self):
        with tempfile.TemporaryDirectory() as tmp:
            args = build_log_args(
                log_dir=tmp,
                step="step_9_finalize",
                status="completed",
                auto_capability_refresh="off",
            )
            rc = telemetry.command_log(args)
            self.assertEqual(rc, 0)
            target = Path(tmp) / "analyst-agent.jsonl"
            rows = [line for line in target.read_text(encoding="utf-8").splitlines() if line.strip()]
            self.assertEqual(len(rows), 1)
            payload = json.loads(rows[0])
            self.assertEqual(payload.get("status"), "completed")

    def test_command_log_auto_capability_refresh_appends_refresh_events(self):
        with tempfile.TemporaryDirectory() as tmp:
            class _Policy:
                enabled = True
                refresh_mode = "on_run"
                min_shadow_sample_size = 3

            class _ShadowTrialStub:
                DEFAULT_REGISTRY_PATH = Path("docs/agents/registry.yaml")

                @staticmethod
                def load_registry(_path):
                    return {"agents": [{"id": "designer-agent"}]}

                @staticmethod
                def find_agent(registry, agent_id):
                    for item in registry.get("agents", []):
                        if item.get("id") == agent_id:
                            return item
                    return None

                @staticmethod
                def resolve_capability_optimization(_agent):
                    return _Policy()

                @staticmethod
                def refresh_agent_capabilities(*, registry, agent_id, last_run_id=None, tasks_per_trial=3):
                    return {
                        "agent_id": agent_id,
                        "enabled": True,
                        "plan_path": f"artifacts/capability_trials/{agent_id}/shadow_trial_plan.json",
                        "judgement_path": "",
                        "snapshot_path": f"artifacts/capability_trials/{agent_id}/capability_snapshot.json",
                        "stale_before_refresh": False,
                        "stale_before_refresh_reason": None,
                        "judgements_total": 0,
                    }

            original_loader = telemetry._load_skill_shadow_trial_module
            telemetry._load_skill_shadow_trial_module = lambda: _ShadowTrialStub()
            try:
                args = build_log_args(
                    agent_id="designer-agent",
                    task_id="task-auto-refresh-test",
                    run_id="run-auto-refresh-test",
                    trace_id="trace-auto-refresh-test",
                    log_dir=tmp,
                    step="step_9_finalize",
                    status="completed",
                    auto_capability_refresh="on_run",
                )
                rc = telemetry.command_log(args)
                self.assertEqual(rc, 0)
                target = Path(tmp) / "designer-agent.jsonl"
                rows = [json.loads(line) for line in target.read_text(encoding="utf-8").splitlines() if line.strip()]
                statuses = [row.get("status") for row in rows]
                self.assertIn("capability_refresh_started", statuses)
                self.assertIn("capability_snapshot_published", statuses)
                self.assertIn("capability_refresh_completed", statuses)
            finally:
                telemetry._load_skill_shadow_trial_module = original_loader

    def test_build_latest_cycle_analyst_payload_uses_latest_completed_task(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "older-task",
                "timestamp": "2026-02-27T10:00:00Z",
                "step": "finalize",
                "status": "completed",
                "run_id": "run-1",
                "trace_id": "trace-1",
                "artifacts_read": [],
                "artifacts_written": [],
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "latest-task",
                "timestamp": "2026-02-28T11:00:00Z",
                "step": "plan",
                "status": "planned",
                "run_id": "run-2",
                "trace_id": "trace-2",
                "artifacts_read": [],
                "artifacts_written": [],
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "latest-task",
                "timestamp": "2026-02-28T11:05:00Z",
                "step": "finalize",
                "status": "completed",
                "run_id": "run-2",
                "trace_id": "trace-2",
                "artifacts_read": ["artifacts/agent_telemetry_summary.json"],
                "artifacts_written": ["artifacts/agent_latest_cycle_analyst.json"],
            },
        ]
        summary = {
            "agents": [
                {
                    "agent_id": "analyst-agent",
                    "verification_pass_rate": 100.0,
                    "lesson_capture_rate": 100.0,
                    "review_error_rate": 0.0,
                    "recommendation_action_rate": 50.0,
                }
            ]
        }
        cycle_report = {
            "tasks": [
                {
                    "agent_id": "analyst-agent",
                    "task_id": "older-task",
                    "has_final_status": True,
                    "first_event_at": "2026-02-27T10:00:00Z",
                    "last_event_at": "2026-02-27T10:00:00Z",
                    "latest_final_status": "completed",
                    "events_total": 1,
                    "final_scope": "latest",
                },
                {
                    "agent_id": "analyst-agent",
                    "task_id": "latest-task",
                    "has_final_status": True,
                    "first_event_at": "2026-02-28T11:00:00Z",
                    "last_event_at": "2026-02-28T11:05:00Z",
                    "latest_final_status": "completed",
                    "events_total": 2,
                    "final_scope": "latest",
                },
            ]
        }

        payload = telemetry.build_latest_cycle_analyst_payload(
            events=events,
            summary=summary,
            cycle_report=cycle_report,
        )

        self.assertTrue(payload["available"])
        self.assertEqual(payload["latest_cycle"]["task_id"], "latest-task")
        self.assertEqual(len(payload["timeline"]), 2)
        self.assertGreaterEqual(len(payload["file_trace"]["edges"]), 2)
        self.assertEqual(payload["timeline"][1]["artifacts_read"][0]["path"], "artifacts/agent_telemetry_summary.json")
        self.assertEqual(payload["timeline"][1]["artifacts_read"][0]["source_kind"], "generated_artifact")

    def test_build_latest_cycle_analyst_payload_enriches_legacy_artifact_paths(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-legacy-artifacts",
                "timestamp": "2026-03-10T04:05:57Z",
                "step": "step_3_orchestration",
                "status": "planned",
                "run_id": "run-legacy",
                "trace_id": "trace-legacy",
                "artifacts_read": ["docs/agents/registry.yaml", "docs/agents/profile_templates.yaml"],
                "artifacts_written": ["agent_tasks.task_brief.context_package"],
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-legacy-artifacts",
                "timestamp": "2026-03-10T04:06:57Z",
                "step": "step_9_finalize",
                "status": "completed",
                "run_id": "run-legacy",
                "trace_id": "trace-legacy",
                "artifacts_read": [],
                "artifacts_written": [],
            },
        ]
        cycle_report = {
            "tasks": [
                {
                    "agent_id": "analyst-agent",
                    "task_id": "task-legacy-artifacts",
                    "has_final_status": True,
                    "first_event_at": "2026-03-10T04:05:57Z",
                    "last_event_at": "2026-03-10T04:06:57Z",
                    "latest_final_status": "completed",
                    "events_total": 2,
                    "final_scope": "latest",
                }
            ]
        }

        payload = telemetry.build_latest_cycle_analyst_payload(
            events=events,
            summary={"agents": []},
            cycle_report=cycle_report,
        )

        self.assertEqual(payload["timeline"][0]["artifacts_read"][0]["source_kind"], "registry")
        self.assertEqual(payload["timeline"][0]["artifacts_read"][1]["source_kind"], "template_catalog")
        self.assertEqual(payload["timeline"][0]["artifacts_read"][0]["semantic_layer"], "tools")
        self.assertEqual(payload["timeline"][0]["artifacts_read"][1]["semantic_layer"], "tools")
        self.assertEqual(payload["timeline"][0]["artifacts_read"][0]["reason"], "orchestration_lookup")

    def test_build_latest_cycle_analyst_payload_keeps_artifact_operations_and_delete_edge(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-artifact-ops",
                "timestamp": "2026-03-10T10:00:00Z",
                "step": "step_7_apply_or_publish",
                "status": "started",
                "run_id": "run-artifact-ops",
                "trace_id": "trace-artifact-ops",
                "artifact_operations": [
                    {
                        "path": "docs/agents/registry.yaml",
                        "op": "read",
                        "timestamp": "2026-03-10T10:00:00Z",
                        "step": "step_7_apply_or_publish",
                        "task_id": "task-artifact-ops",
                        "run_id": "run-artifact-ops",
                    },
                    {
                        "path": "artifacts/tmp/deprecated.md",
                        "op": "delete",
                        "timestamp": "2026-03-10T10:00:00Z",
                        "step": "step_7_apply_or_publish",
                        "task_id": "task-artifact-ops",
                        "run_id": "run-artifact-ops",
                    },
                ],
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-artifact-ops",
                "timestamp": "2026-03-10T10:02:00Z",
                "step": "step_9_finalize",
                "status": "completed",
                "run_id": "run-artifact-ops",
                "trace_id": "trace-artifact-ops",
                "artifacts_read": [],
                "artifacts_written": [],
            },
        ]
        cycle_report = {
            "tasks": [
                {
                    "agent_id": "analyst-agent",
                    "task_id": "task-artifact-ops",
                    "has_final_status": True,
                    "first_event_at": "2026-03-10T10:00:00Z",
                    "last_event_at": "2026-03-10T10:02:00Z",
                    "latest_final_status": "completed",
                    "events_total": 2,
                    "final_scope": "latest",
                }
            ]
        }

        payload = telemetry.build_latest_cycle_analyst_payload(
            events=events,
            summary={"agents": []},
            cycle_report=cycle_report,
        )

        timeline_ops = payload["timeline"][0]["artifact_operations"]
        self.assertEqual([(item["op"], item["path"]) for item in timeline_ops], [("read", "docs/agents/registry.yaml"), ("delete", "artifacts/tmp/deprecated.md")])
        delete_edges = [
            edge
            for edge in payload["file_trace"]["edges"]
            if edge.get("kind") == "delete" and edge.get("path") == "artifacts/tmp/deprecated.md"
        ]
        self.assertEqual(len(delete_edges), 1)

    def test_build_latest_cycle_analyst_payload_marks_fallback_when_no_artifacts(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-1",
                "timestamp": "2026-02-28T11:00:00Z",
                "step": "verify",
                "status": "verify_started",
                "run_id": "run-1",
                "trace_id": "trace-1",
            }
        ]
        cycle_report = {
            "tasks": [
                {
                    "agent_id": "analyst-agent",
                    "task_id": "task-1",
                    "has_final_status": True,
                    "first_event_at": "2026-02-28T11:00:00Z",
                    "last_event_at": "2026-02-28T11:00:00Z",
                    "latest_final_status": "completed",
                    "events_total": 1,
                    "final_scope": "latest",
                }
            ]
        }

        payload = telemetry.build_latest_cycle_analyst_payload(
            events=events,
            summary={"agents": []},
            cycle_report=cycle_report,
        )

        self.assertTrue(payload["available"])
        self.assertTrue(payload["file_trace"]["fallback_used"])
        self.assertGreaterEqual(len(payload["timeline"][0]["artifacts_read"]), 1)
        self.assertEqual(payload["timeline"][0]["artifacts_read"][0]["semantic_layer"], "telemetry")

    def test_build_latest_cycle_analyst_payload_adds_taxonomy_guard_metrics(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-taxonomy-guard",
                "timestamp": "2026-03-10T10:00:00Z",
                "step": "step_1_start",
                "status": "started",
                "run_id": "run-taxonomy-guard",
                "trace_id": "trace-taxonomy-guard",
                "artifacts_read": [
                    {"path": "docs/agents/registry.yaml", "source_kind": "unknown", "semantic_layer": "unknown"},
                    "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
                ],
                "artifacts_written": [],
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-taxonomy-guard",
                "timestamp": "2026-03-10T10:02:00Z",
                "step": "step_9_finalize",
                "status": "completed",
                "run_id": "run-taxonomy-guard",
                "trace_id": "trace-taxonomy-guard",
                "artifacts_read": [],
                "artifacts_written": [],
            },
        ]
        cycle_report = {
            "tasks": [
                {
                    "agent_id": "analyst-agent",
                    "task_id": "task-taxonomy-guard",
                    "has_final_status": True,
                    "first_event_at": "2026-03-10T10:00:00Z",
                    "last_event_at": "2026-03-10T10:02:00Z",
                    "latest_final_status": "completed",
                    "events_total": 2,
                    "final_scope": "latest",
                }
            ]
        }
        payload = telemetry.build_latest_cycle_analyst_payload(
            events=events,
            summary={"agents": []},
            cycle_report=cycle_report,
        )
        self.assertIn("taxonomy_guard", payload)
        self.assertIsNotNone(payload["metrics"]["unknown_source_rate"])
        self.assertIsNotNone(payload["metrics"]["unknown_semantic_rate"])
        self.assertGreater(payload["taxonomy_guard"]["artifact_refs_total"], 0)
        self.assertGreaterEqual(len(payload["taxonomy_guard"]["warnings"]), 1)

    def test_build_log_event_supports_benchmark_context_fields(self):
        args = argparse.Namespace(
            timestamp="2026-03-05T10:00:00Z",
            run_id="run-1",
            trace_id="trace-1",
            duration_ms=1000,
            tokens_in=200,
            tokens_out=100,
            review_errors=0,
            agent_id="analyst-agent",
            process="benchmark",
            span_id=None,
            task_id="bench-task-1",
            step="judge",
            status="completed",
            outcome="ok",
            recommendation_id="rec-1",
            benchmark_run_id="bench-2026-03-05-01",
            benchmark_case_id="prod-001",
            attempt_index=3,
            judge_model="gpt-4.1-mini",
            judge_score=0.91,
            mcp=[],
            skill=[],
            artifact_read=[],
            artifact_write=[],
            target_delta_pct=7.5,
            guardrail_breached=False,
            ab_sessions_required=5,
            error=None,
        )

        event = telemetry.build_log_event(args)
        self.assertEqual(event["benchmark_run_id"], "bench-2026-03-05-01")
        self.assertEqual(event["benchmark_case_id"], "prod-001")
        self.assertEqual(event["attempt_index"], 3)
        self.assertEqual(event["judge_model"], "gpt-4.1-mini")
        self.assertEqual(event["judge_score"], 0.91)
        self.assertEqual(event["metrics"]["target_delta_pct"], 7.5)
        self.assertEqual(event["metrics"]["guardrail_breached"], False)
        self.assertEqual(event["metrics"]["ab_sessions_required"], 5)

    def test_summarize_plan_coverage_uses_plan_started_signal(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-1",
                "timestamp": "2026-03-05T10:00:00Z",
                "step": "plan",
                "status": "started",
                "run_id": "run-1",
                "trace_id": "trace-1",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-1",
                "timestamp": "2026-03-05T10:05:00Z",
                "step": "finalize",
                "status": "completed",
                "run_id": "run-1",
                "trace_id": "trace-1",
                "metrics": {},
            },
        ]
        summary = telemetry.summarize(events=events, invalid_lines=0, log_dir=Path(".logs/agents"))
        self.assertEqual(summary["totals"]["tasks_total"], 1)
        self.assertEqual(summary["totals"]["plan_coverage_rate"], 100.0)
        self.assertEqual(summary["agents"][0]["plan_signal_tasks"], 1)

    def test_build_benchmark_summary_calculates_pass_at_k_and_gate(self):
        root = Path(__file__).resolve().parents[2]
        run_fixture = root / "scripts" / "tests" / "fixtures" / "benchmark_run_sample.json"
        run_payload = json.loads(run_fixture.read_text(encoding="utf-8"))

        dataset = {
            "version": "oap_agent_benchmark_cases.v1",
            "agent_id": "analyst-agent",
            "judge_rubric_version": "analyst-rubric.v1",
            "cases": [
                {
                    "case_id": "prod-001",
                    "agent_id": "analyst-agent",
                    "case_source": "prod",
                    "difficulty": "mid",
                    "input_payload": {"question": "q1"},
                    "expected_facts": ["f1", "f2"],
                    "critical_must_not": ["must_not_1"],
                    "judge_rubric_version": "analyst-rubric.v1",
                    "owner": "analyst-team",
                    "last_validated_at": "2026-03-04",
                },
                {
                    "case_id": "feedback-001",
                    "agent_id": "analyst-agent",
                    "case_source": "feedback",
                    "difficulty": "mid",
                    "input_payload": {"question": "q2"},
                    "expected_facts": ["f1"],
                    "critical_must_not": ["must_not_1"],
                    "judge_rubric_version": "analyst-rubric.v1",
                    "owner": "analyst-team",
                    "last_validated_at": "2026-03-04",
                },
            ],
        }
        telemetry_summary = {
            "agents": [
                {
                    "agent_id": "analyst-agent",
                    "recommendation_action_rate": 0.42,
                }
            ]
        }

        summary = telemetry.build_benchmark_summary(
            dataset=dataset,
            run_payload=run_payload,
            telemetry_summary=telemetry_summary,
            source_paths={
                "dataset_path": "artifacts/analyst_benchmark_dataset.json",
                "run_path": "artifacts/agent_benchmark_run_results.json",
                "telemetry_summary_path": "artifacts/agent_telemetry_summary.json",
            },
            gate_mode="soft_warning",
        )

        self.assertEqual(summary["version"], telemetry.BENCHMARK_SUMMARY_VERSION)
        self.assertEqual(summary["metrics"]["cases_total"], 2)
        self.assertEqual(summary["metrics"]["attempts_total"], 10)
        self.assertAlmostEqual(summary["metrics"]["pass_at_5"], 1.0)
        self.assertIsNotNone(summary["metrics"]["fact_coverage_mean"])
        self.assertEqual(summary["gate"]["status"], "warning")
        self.assertEqual(summary["telemetry_metrics"]["recommendation_action_rate"], 0.42)
        self.assertAlmostEqual(summary["impact_metrics"]["time_to_action_p50"], 8.0)

    def test_summarize_calculates_ab_metrics(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-ab-1",
                "timestamp": "2026-03-05T10:00:00Z",
                "step": "ab",
                "status": "ab_test_started",
                "run_id": "run-ab-1",
                "trace_id": "trace-ab-1",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-ab-1",
                "timestamp": "2026-03-05T10:02:00Z",
                "step": "ab",
                "status": "ab_test_checkpoint",
                "run_id": "run-ab-1",
                "trace_id": "trace-ab-1",
                "metrics": {
                    "target_delta_pct": 6.2,
                    "guardrail_breached": True,
                    "ab_sessions_required": 5,
                },
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-ab-1",
                "timestamp": "2026-03-05T10:03:00Z",
                "step": "ab",
                "status": "ab_test_checkpoint",
                "run_id": "run-ab-1",
                "trace_id": "trace-ab-1",
                "metrics": {
                    "target_delta_pct": 8.4,
                    "guardrail_breached": False,
                    "ab_sessions_required": 5,
                },
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-ab-1",
                "timestamp": "2026-03-05T10:05:00Z",
                "step": "ab",
                "status": "ab_test_failed",
                "run_id": "run-ab-1",
                "trace_id": "trace-ab-1",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-ab-1",
                "timestamp": "2026-03-05T10:06:00Z",
                "step": "rollback",
                "status": "rollback_applied",
                "run_id": "run-ab-1",
                "trace_id": "trace-ab-1",
                "metrics": {},
            },
        ]
        summary = telemetry.summarize(events=events, invalid_lines=0, log_dir=Path(".logs/agents"))
        agent = summary["agents"][0]
        self.assertEqual(agent["ab_test_started_count"], 1)
        self.assertEqual(agent["ab_test_checkpoint_count"], 2)
        self.assertEqual(agent["ab_test_failed_count"], 1)
        self.assertEqual(agent["rollback_applied_count"], 1)
        self.assertEqual(agent["rollback_rate"], 100.0)
        self.assertEqual(agent["ab_guardrail_breached_count"], 1)
        self.assertEqual(agent["ab_guardrail_breach_rate"], 50.0)
        self.assertEqual(agent["ab_sessions_required"], 5)
        self.assertEqual(agent["ab_sessions_progress_rate"], 40.0)

    def test_summarize_adds_canonical_step_metrics_and_missing_steps(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-1",
                "timestamp": "2026-03-05T10:00:00Z",
                "step": "step_1_start",
                "status": "started",
                "run_id": "run-1",
                "trace_id": "trace-1",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-1",
                "timestamp": "2026-03-05T10:01:00Z",
                "step": "legacy_unknown_step",
                "status": "started",
                "run_id": "run-1",
                "trace_id": "trace-1",
                "metrics": {},
            },
        ]
        summary = telemetry.summarize(events=events, invalid_lines=0, log_dir=Path(".logs/agents"))
        agent = summary["agents"][0]
        self.assertEqual(agent["non_canonical_events_total"], 1)
        self.assertEqual(agent["canonical_event_compliance_rate"], 50.0)
        self.assertEqual(len(agent["missing_canonical_steps"]), 1)
        self.assertIn("step_0_intake", agent["missing_canonical_steps"][0]["missing_steps"])
        self.assertIn("legacy_unknown_step", agent["missing_canonical_steps"][0]["non_canonical_steps"])
        self.assertEqual(summary["totals"]["non_canonical_events_total"], 1)

    def test_summarize_adds_agent_viability_metrics(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-shared",
                "timestamp": "2026-03-10T10:00:00Z",
                "step": "step_3_orchestration",
                "status": "started",
                "run_id": "run-analyst-1",
                "trace_id": "trace-shared",
                "metrics": {},
            },
            {
                "agent_id": "reader-agent",
                "task_id": "task-shared",
                "timestamp": "2026-03-10T10:01:00Z",
                "step": "step_3_orchestration",
                "status": "agent_instance_spawned",
                "run_id": "run-reader-1",
                "trace_id": "trace-shared",
                "metrics": {},
            },
            {
                "agent_id": "reader-agent",
                "task_id": "task-shared",
                "timestamp": "2026-03-10T10:02:00Z",
                "step": "step_9_finalize",
                "status": "completed",
                "run_id": "run-reader-1",
                "trace_id": "trace-shared",
                "metrics": {},
            },
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".claude" / "agents").mkdir(parents=True, exist_ok=True)
            (root / ".github" / "agents").mkdir(parents=True, exist_ok=True)
            (root / ".claude" / "agents" / "reader-agent.md").write_text("---\n---\n", encoding="utf-8")
            (root / ".github" / "agents" / "reader-agent.agent.md").write_text("---\n---\n", encoding="utf-8")
            (root / ".claude" / "agents" / "analyst-agent.md").write_text("---\n---\n", encoding="utf-8")
            original_root = telemetry.REPO_ROOT
            telemetry.REPO_ROOT = root
            try:
                summary = telemetry.summarize(events=events, invalid_lines=0, log_dir=Path(".logs/agents"))
            finally:
                telemetry.REPO_ROOT = original_root

        reader_agent = next(item for item in summary["agents"] if item["agent_id"] == "reader-agent")
        analyst_agent = next(item for item in summary["agents"] if item["agent_id"] == "analyst-agent")
        self.assertEqual(reader_agent["invocation_count"], 1)
        self.assertEqual(reader_agent["completed_task_count"], 1)
        self.assertEqual(reader_agent["handoff_use_rate"], 100.0)
        self.assertEqual(reader_agent["overlap_with_analyst_rate"], 100.0)
        self.assertEqual(reader_agent["host_adapter_sync_status"], "synced")
        self.assertEqual(analyst_agent["host_adapter_sync_status"], "partial")
        self.assertIsNone(analyst_agent["overlap_with_analyst_rate"])

    def test_summarize_tracks_capability_refresh_metrics(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-cap-refresh",
                "timestamp": "2026-03-09T11:00:00Z",
                "step": "step_9_publish_snapshots",
                "status": "capability_refresh_started",
                "run_id": "run-cap-refresh",
                "trace_id": "trace-cap-refresh",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-cap-refresh",
                "timestamp": "2026-03-09T11:00:10Z",
                "step": "step_9_publish_snapshots",
                "status": "capability_stale_detected",
                "run_id": "run-cap-refresh",
                "trace_id": "trace-cap-refresh",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-cap-refresh",
                "timestamp": "2026-03-09T11:00:20Z",
                "step": "step_9_publish_snapshots",
                "status": "shadow_trial_plan_refreshed",
                "run_id": "run-cap-refresh",
                "trace_id": "trace-cap-refresh",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-cap-refresh",
                "timestamp": "2026-03-09T11:00:30Z",
                "step": "step_9_publish_snapshots",
                "status": "shadow_trial_judged",
                "run_id": "run-cap-refresh",
                "trace_id": "trace-cap-refresh",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-cap-refresh",
                "timestamp": "2026-03-09T11:00:40Z",
                "step": "step_9_publish_snapshots",
                "status": "capability_snapshot_published",
                "run_id": "run-cap-refresh",
                "trace_id": "trace-cap-refresh",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-cap-refresh",
                "timestamp": "2026-03-09T11:00:50Z",
                "step": "step_9_publish_snapshots",
                "status": "capability_refresh_completed",
                "run_id": "run-cap-refresh",
                "trace_id": "trace-cap-refresh",
                "metrics": {},
            },
        ]

        summary = telemetry.summarize(events=events, invalid_lines=0, log_dir=Path(".logs/agents"))
        agent = summary["agents"][0]
        self.assertEqual(agent["capability_refresh_coverage_rate"], 100.0)
        self.assertEqual(agent["stale_table_rate"], 100.0)
        self.assertEqual(agent["shadow_trial_completion_rate"], 100.0)
        self.assertEqual(agent["promotion_blocked_by_stale_total"], 1)
        self.assertEqual(agent["capability_refresh_counts"]["started"], 1)
        self.assertEqual(agent["capability_refresh_counts"]["completed"], 1)
        self.assertEqual(summary["totals"]["promotion_blocked_by_stale_total"], 1)

    def test_summarize_caps_verification_pass_rate_by_unique_verify_started_tasks(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-verify-1",
                "timestamp": "2026-03-09T11:00:00Z",
                "step": "step_8_verify",
                "status": "verify_started",
                "run_id": "run-verify-1",
                "trace_id": "trace-verify",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-verify-1",
                "timestamp": "2026-03-09T11:00:10Z",
                "step": "step_8_verify",
                "status": "verify_passed",
                "run_id": "run-verify-1",
                "trace_id": "trace-verify",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-verify-1",
                "timestamp": "2026-03-09T11:00:20Z",
                "step": "step_8_verify",
                "status": "verify_passed",
                "run_id": "run-verify-1",
                "trace_id": "trace-verify",
                "metrics": {},
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-verify-without-start",
                "timestamp": "2026-03-09T11:00:30Z",
                "step": "step_8_verify",
                "status": "verify_passed",
                "run_id": "run-verify-2",
                "trace_id": "trace-verify",
                "metrics": {},
            },
        ]

        summary = telemetry.summarize(events=events, invalid_lines=0, log_dir=Path(".logs/agents"))
        agent = summary["agents"][0]
        self.assertEqual(agent["status_counts"]["verify_started"], 1)
        self.assertEqual(agent["status_counts"]["verify_passed"], 3)
        self.assertEqual(agent["verification_pass_rate"], 100.0)
        self.assertEqual(summary["totals"]["verification_pass_rate"], 100.0)

    def test_summarize_adds_taxonomy_unknown_rates_and_warnings(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-taxonomy-summary",
                "timestamp": "2026-03-09T11:00:00Z",
                "step": "step_1_start",
                "status": "started",
                "run_id": "run-taxonomy-summary",
                "trace_id": "trace-taxonomy-summary",
                "artifacts_read": [
                    {"path": "docs/agents/registry.yaml", "source_kind": "unknown", "semantic_layer": "unknown"},
                    {"path": "docs/agents/profile_templates.yaml", "source_kind": "unknown", "semantic_layer": "unknown"},
                    {"path": "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md", "source_kind": "operating_plan", "semantic_layer": "rules"},
                ],
                "artifacts_written": [],
                "metrics": {},
            }
        ]
        summary = telemetry.summarize(events=events, invalid_lines=0, log_dir=Path(".logs/agents"))
        agent = summary["agents"][0]
        self.assertEqual(agent["artifact_refs_total"], 3)
        self.assertEqual(agent["unknown_source_refs_total"], 2)
        self.assertEqual(agent["unknown_semantic_refs_total"], 2)
        self.assertGreater(agent["unknown_source_rate"], 10)
        self.assertGreater(agent["unknown_semantic_rate"], 10)
        self.assertGreaterEqual(len(agent["taxonomy_warnings"]), 1)
        self.assertGreaterEqual(len(summary["totals"]["taxonomy_warnings"]), 1)

    def test_summarize_tracks_file_ops_quality_metrics_for_v2_contract(self):
        events = [
            {
                "agent_id": "analyst-agent",
                "task_id": "task-file-ops",
                "timestamp": "2026-03-09T11:00:00Z",
                "step": "step_7_apply_or_publish",
                "status": "started",
                "run_id": "run-file-ops",
                "trace_id": "trace-file-ops",
                "artifact_contract_version": "v2",
                "artifact_ops_origin": "explicit",
                "artifact_operations": [
                    {"path": "artifacts/tmp/draft.md", "op": "delete"},
                ],
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-file-ops",
                "timestamp": "2026-03-09T11:01:00Z",
                "step": "step_4_context_sync",
                "status": "started",
                "run_id": "run-file-ops",
                "trace_id": "trace-file-ops",
                "artifact_contract_version": "v2",
                "artifact_ops_origin": "mirrored_legacy",
                "artifacts_read": ["docs/agents/registry.yaml"],
                "artifacts_written": ["artifacts/agent_cycle_validation_report.json"],
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-file-ops",
                "timestamp": "2026-03-09T11:02:00Z",
                "step": "step_8_verify",
                "status": "verify_started",
                "run_id": "run-file-ops",
                "trace_id": "trace-file-ops",
                "artifact_contract_version": "v2",
                "artifact_ops_origin": "none",
            },
            {
                "agent_id": "analyst-agent",
                "task_id": "task-legacy",
                "timestamp": "2026-03-09T11:03:00Z",
                "step": "step_8_verify",
                "status": "verify_started",
                "run_id": "run-legacy",
                "trace_id": "trace-legacy",
                "artifacts_read": ["docs/subservices/oap/README.md"],
            },
        ]

        summary = telemetry.summarize(events=events, invalid_lines=0, log_dir=Path(".logs/agents"))
        agent = summary["agents"][0]
        self.assertEqual(agent["file_ops_v2_events_total"], 3)
        self.assertEqual(agent["file_ops_eligible_events"], 2)
        self.assertEqual(agent["file_ops_explicit_events"], 1)
        self.assertEqual(agent["file_ops_mirrored_legacy_events"], 1)
        self.assertEqual(agent["file_ops_step_fallback_events"], 0)
        self.assertEqual(agent["file_ops_operations_total"], 3)
        self.assertEqual(agent["file_ops_delete_total"], 1)
        self.assertEqual(agent["file_ops_explicit_coverage_pct"], 50.0)
        self.assertEqual(agent["file_ops_fallback_share_pct"], 50.0)
        self.assertEqual(summary["totals"]["file_ops_explicit_events"], 1)
        self.assertEqual(summary["totals"]["file_ops_delete_total"], 1)

    def test_evaluate_file_ops_gate_respects_thresholds_and_sample_size(self):
        summary = {
            "agents": [
                {
                    "agent_id": "pass-agent",
                    "file_ops_eligible_events": 12,
                    "file_ops_explicit_coverage_pct": 96.0,
                    "file_ops_fallback_share_pct": 4.0,
                },
                {
                    "agent_id": "fail-agent",
                    "file_ops_eligible_events": 10,
                    "file_ops_explicit_coverage_pct": 80.0,
                    "file_ops_fallback_share_pct": 20.0,
                },
                {
                    "agent_id": "small-sample-agent",
                    "file_ops_eligible_events": 3,
                    "file_ops_explicit_coverage_pct": 100.0,
                    "file_ops_fallback_share_pct": 0.0,
                },
            ]
        }
        gate = telemetry.evaluate_file_ops_gate(
            summary,
            explicit_min_pct=90.0,
            fallback_max_pct=10.0,
            mode="strict",
            min_events=5,
        )
        self.assertEqual(gate["status"], "failed")
        self.assertIn("fail-agent", gate["failed_agents"])
        self.assertIn("small-sample-agent", gate["warning_agents"])

    def test_command_report_strict_file_ops_gate_fails_when_threshold_not_met(self):
        with tempfile.TemporaryDirectory() as tmp:
            log_dir = Path(tmp) / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / "analyst-agent.jsonl"
            rows = []
            for index in range(5):
                args = build_log_args(
                    timestamp=f"2026-03-10T10:00:0{index}Z",
                    task_id=f"task-file-ops-{index}",
                    run_id=f"run-file-ops-{index}",
                    trace_id=f"trace-file-ops-{index}",
                    step="step_4_context_sync",
                    artifact_read=["docs/agents/registry.yaml"],
                    artifact_write=["artifacts/agent_cycle_validation_report.json"],
                )
                rows.append(json.dumps(telemetry.build_log_event(args), ensure_ascii=False))
            log_file.write_text("\n".join(rows) + "\n", encoding="utf-8")

            args = argparse.Namespace(
                log_dir=str(log_dir),
                out_json=str(Path(tmp) / "agent_telemetry_summary.json"),
                out_md=str(Path(tmp) / "agent_telemetry_summary.md"),
                out_cycle_json=str(Path(tmp) / "agent_cycle_validation_report.json"),
                out_latest_analyst_json=str(Path(tmp) / "agent_latest_cycle_analyst.json"),
                benchmark_summary_json=str(Path(tmp) / "agent_benchmark_summary.json"),
                file_ops_explicit_min_pct=90.0,
                file_ops_fallback_max_pct=10.0,
                file_ops_gate_mode="strict",
                file_ops_min_events=5,
            )
            rc = telemetry.command_report(args)
            self.assertEqual(rc, 1)
            payload = json.loads(Path(args.out_json).read_text(encoding="utf-8"))
            self.assertEqual(payload["file_ops_gate"]["status"], "failed")


if __name__ == "__main__":
    unittest.main()
