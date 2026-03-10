from __future__ import annotations

import importlib.util
import io
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "analyst_cycle_runner.py"
    spec = importlib.util.spec_from_file_location("analyst_cycle_runner", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


runner = _load_module()


class AnalystCycleRunnerTests(unittest.TestCase):
    def test_build_log_namespace_respects_agent_id(self):
        args = runner.build_log_namespace(
            agent_id="designer-agent",
            task_id="task-1",
            run_id="run-1",
            trace_id="trace-1",
            log_dir=".logs/agents",
            enforce_step_contract="strict",
            step="step_1_start",
            status="started",
            outcome="ok",
            artifact_read=[],
            artifact_write=[],
            tokens_in=10,
            tokens_out=5,
        )
        self.assertEqual(args.agent_id, "designer-agent")
        self.assertEqual(args.process, "designer-agent_cycle_runner")
        self.assertTrue(isinstance(args.artifact_op, list))
        self.assertEqual(len(args.artifact_op), 0)

    def test_build_log_namespace_generates_explicit_artifact_ops_with_delete(self):
        args = runner.build_log_namespace(
            agent_id="analyst-agent",
            task_id="task-ops",
            run_id="run-ops",
            trace_id="trace-ops",
            log_dir=".logs/agents",
            enforce_step_contract="warning",
            step="step_7_apply_or_publish",
            status="recommendation_applied",
            outcome="ok",
            artifact_read=["docs/agents/registry.yaml"],
            artifact_write=["artifacts/agent_cycle_validation_report.json"],
            tokens_in=12,
            tokens_out=8,
        )
        ops = args.artifact_op
        self.assertGreaterEqual(len(ops), 3)
        self.assertIn(("read", "docs/agents/registry.yaml"), {(item.get("op"), item.get("path")) for item in ops})
        self.assertIn(("update", "artifacts/agent_cycle_validation_report.json"), {(item.get("op"), item.get("path")) for item in ops})
        self.assertIn(("delete", "artifacts/tmp/task-ops-draft.md"), {(item.get("op"), item.get("path")) for item in ops})

    def test_run_cycle_dry_run_includes_target_agent_id(self):
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            rc = runner.run_cycle(
                agent_id="reader-agent",
                task_id="task-dry",
                run_id="run-dry",
                trace_id="trace-dry",
                phase="strict",
                log_dir=".logs/agents",
                dry_run=True,
            )
        self.assertEqual(rc, 0)
        output = buffer.getvalue()
        self.assertIn('"agent_id": "reader-agent"', output)
        self.assertIn('"enforce_step_contract": "strict"', output)

    def test_build_report_namespace_supports_isolated_report_dir(self):
        args = runner.build_report_namespace(
            log_dir=".logs/agents-experiments",
            report_dir="artifacts/experiments/strict-smoke",
        )
        self.assertEqual(args.log_dir, ".logs/agents-experiments")
        self.assertEqual(args.out_json, "artifacts/experiments/strict-smoke/agent_telemetry_summary.json")
        self.assertEqual(args.out_cycle_json, "artifacts/experiments/strict-smoke/agent_cycle_validation_report.json")

    def test_refresh_capability_optimization_uses_provided_report_dir(self):
        class _ShadowTrialStub:
            DEFAULT_REGISTRY_PATH = Path("docs/agents/registry.yaml")

            @staticmethod
            def load_registry(_path):
                return {"agents": [{"id": "designer-agent"}]}

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

        original_shadow = runner.shadow_trial
        original_command_log = runner.telemetry.command_log
        original_command_report = runner.telemetry.command_report
        original_subprocess_run = runner.subprocess.run
        report_calls: list[SimpleNamespace] = []
        try:
            runner.shadow_trial = _ShadowTrialStub()
            runner.telemetry.command_log = lambda _args: 0
            runner.telemetry.command_report = lambda ns: report_calls.append(ns) or 0
            runner.subprocess.run = lambda *_args, **_kwargs: SimpleNamespace(returncode=0, stderr="", stdout="")

            rc = runner.refresh_capability_optimization(
                agent_id="designer-agent",
                task_id="task-refresh",
                run_id="run-refresh",
                trace_id="trace-refresh",
                log_dir=".logs/agents-experiments",
                report_dir="artifacts/experiments/designer-strict",
            )
            self.assertEqual(rc, 0)
            self.assertEqual(len(report_calls), 1)
            self.assertEqual(
                report_calls[0].out_json,
                "artifacts/experiments/designer-strict/agent_telemetry_summary.json",
            )
        finally:
            runner.shadow_trial = original_shadow
            runner.telemetry.command_log = original_command_log
            runner.telemetry.command_report = original_command_report
            runner.subprocess.run = original_subprocess_run


if __name__ == "__main__":
    unittest.main()
