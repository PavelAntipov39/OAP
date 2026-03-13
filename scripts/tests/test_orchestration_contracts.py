from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def _load_module(name: str, relative_path: str):
    root = Path(__file__).resolve().parents[2]
    target = root / relative_path
    spec = importlib.util.spec_from_file_location(name, target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


sync = _load_module("sync_agent_tasks", "scripts/sync_agent_tasks.py")
telemetry = _load_module("agent_telemetry", "scripts/agent_telemetry.py")


class OrchestrationContractTests(unittest.TestCase):
    def test_build_collaboration_plan_adds_delegated_routing_decision_for_complex_task(self):
        registry = {
            "agents": [
                {"id": "analyst-agent", "role": "analyst"},
                {"id": "orchestrator-agent", "role": "orchestrator"},
                {"id": "designer-agent", "role": "designer", "skills": ["playwright"]},
                {"id": "ops-agent", "role": "ops", "skills": ["agent-telemetry"]},
            ]
        }

        plan = sync.build_collaboration_plan(
            task_id="task-complex-routing",
            root_agent_id="analyst-agent",
            hint_text="ui telemetry evidence schema validation tooltip context",
            suggested_agents=["designer-agent", "ops-agent"],
            rationale="Нужен сложный orchestration routing.",
            registry=registry,
            target_metric="recommendation_action_rate",
            owner_section="tasks_quality",
            linked_snapshot={"problem": "Missing contract fields", "solution": "Add validation and verify UI"},
        )

        routing = plan["routing_decision"]
        self.assertEqual(routing["primary_executor_agent_id"], "analyst-agent")
        self.assertEqual(routing["fallback_route"], "single_agent_path")
        self.assertEqual(routing["comparison_basis"], "baseline_vs_selected")
        self.assertIn("single_agent_path", routing["considered_routes"])
        self.assertIn("delegated_path", routing["route_id"])
        self.assertIn("orchestrator-agent", routing["process_agents"])
        self.assertGreaterEqual(len(routing["comparison_metrics"]), 3)

    def test_build_collaboration_plan_adds_single_agent_routing_decision_for_simple_task(self):
        registry = {
            "agents": [
                {"id": "analyst-agent", "role": "analyst"},
            ]
        }

        plan = sync.build_collaboration_plan(
            task_id="task-simple-routing",
            root_agent_id="analyst-agent",
            hint_text="rename label",
            suggested_agents=[],
            rationale="Простая одиночная задача.",
            registry=registry,
            target_metric="",
            owner_section="",
            linked_snapshot=None,
        )

        routing = plan["routing_decision"]
        self.assertEqual(routing["primary_executor_agent_id"], "analyst-agent")
        self.assertEqual(routing["fallback_route"], "delegated_path")
        self.assertEqual(routing["process_agents"], ["analyst-agent"])
        self.assertIn("single_agent_path", routing["route_id"])

    def test_evaluate_orchestration_gate_warns_when_mixed_phased_events_are_incomplete(self):
        events = [
            {
                "agent_id": "orchestrator-agent",
                "task_id": "task-mixed-missing",
                "status": telemetry.ORCHESTRATION_MODE_SELECTED_STATUS,
                "interaction_mode": "mixed_phased",
            },
            {
                "agent_id": "orchestrator-agent",
                "task_id": "task-mixed-missing",
                "status": "completed",
            },
        ]

        gate = telemetry.evaluate_orchestration_gate(events, mode="soft_warning")
        self.assertEqual(gate["status"], "warning")
        self.assertEqual(gate["orchestrated_tasks_total"], 1)
        self.assertEqual(gate["results"][0]["task_id"], "task-mixed-missing")
        self.assertIn(telemetry.ORCHESTRATION_PHASE_STARTED_STATUS, gate["results"][0]["missing_statuses"])
        self.assertIn(telemetry.ORCHESTRATION_MERGE_COMPLETED_STATUS, gate["results"][0]["missing_statuses"])

    def test_evaluate_orchestration_gate_passes_when_mixed_phased_events_are_complete(self):
        statuses = [
            telemetry.ORCHESTRATION_MODE_SELECTED_STATUS,
            telemetry.ORCHESTRATION_PHASE_STARTED_STATUS,
            telemetry.ROUNDTABLE_STARTED_STATUS,
            telemetry.ROUNDTABLE_ROUND_COMPLETED_STATUS,
            telemetry.ROUNDTABLE_CONVERGED_STATUS,
            telemetry.ORCHESTRATION_MERGE_STARTED_STATUS,
            telemetry.ORCHESTRATION_PHASE_COMPLETED_STATUS,
            telemetry.ORCHESTRATION_MERGE_COMPLETED_STATUS,
            "completed",
        ]
        events = [
            {
                "agent_id": "orchestrator-agent",
                "task_id": "task-mixed-complete",
                "status": status,
                "interaction_mode": "mixed_phased" if index == 0 else "",
            }
            for index, status in enumerate(statuses)
        ]

        gate = telemetry.evaluate_orchestration_gate(events, mode="strict")
        self.assertEqual(gate["status"], "passed")
        self.assertEqual(gate["results"][0]["missing_statuses"], [])

    def test_command_report_fails_in_strict_mode_when_orchestration_gate_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            log_dir = Path(tmp) / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_file = log_dir / "orchestrator-agent.jsonl"
            rows = [
                {
                    "agent_id": "orchestrator-agent",
                    "task_id": "task-gate-fail",
                    "timestamp": "2026-03-12T10:00:00Z",
                    "step": "step_3_orchestration",
                    "status": telemetry.ORCHESTRATION_MODE_SELECTED_STATUS,
                    "run_id": "run-gate-fail",
                    "trace_id": "trace-gate-fail",
                    "interaction_mode": "mixed_phased",
                    "metrics": {},
                },
                {
                    "agent_id": "orchestrator-agent",
                    "task_id": "task-gate-fail",
                    "timestamp": "2026-03-12T10:05:00Z",
                    "step": "step_9_finalize",
                    "status": "completed",
                    "run_id": "run-gate-fail",
                    "trace_id": "trace-gate-fail",
                    "metrics": {},
                },
            ]
            log_file.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")

            args = argparse.Namespace(
                log_dir=str(log_dir),
                out_json=str(Path(tmp) / "agent_telemetry_summary.json"),
                out_md=str(Path(tmp) / "agent_telemetry_summary.md"),
                out_cycle_json=str(Path(tmp) / "agent_cycle_validation_report.json"),
                out_latest_analyst_json=str(Path(tmp) / "agent_latest_cycle_analyst.json"),
                benchmark_summary_json=str(Path(tmp) / "agent_benchmark_summary.json"),
                file_ops_explicit_min_pct=90.0,
                file_ops_fallback_max_pct=10.0,
                file_ops_gate_mode="soft_warning",
                file_ops_min_events=5,
                orchestration_gate_mode="strict",
            )

            rc = telemetry.command_report(args)
            self.assertEqual(rc, 1)
            payload = json.loads(Path(args.out_json).read_text(encoding="utf-8"))
            self.assertEqual(payload["orchestration_gate"]["status"], "failed")
            self.assertIn("task-gate-fail", payload["orchestration_gate"]["failed_tasks"])


if __name__ == "__main__":
    unittest.main()
