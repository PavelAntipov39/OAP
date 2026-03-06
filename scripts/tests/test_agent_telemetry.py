from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
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


class AgentTelemetryTests(unittest.TestCase):
    def test_normalize_artifact_list_accepts_csv_and_list(self):
        self.assertEqual(
            telemetry.normalize_artifact_list(["docs/a.md, docs/b.md", "docs/a.md", "artifacts/x.json"]),
            ["docs/a.md", "docs/b.md", "artifacts/x.json"],
        )
        self.assertEqual(telemetry.normalize_artifact_list(None), [])

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


if __name__ == "__main__":
    unittest.main()
