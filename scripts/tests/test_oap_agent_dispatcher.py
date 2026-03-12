from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def _load_module(module_name: str, relative_path: str):
    root = Path(__file__).resolve().parents[2]
    target = root / relative_path
    spec = importlib.util.spec_from_file_location(module_name, target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


dispatcher = _load_module("oap_agent_dispatcher", "scripts/oap_agent_dispatcher.py")


class OapAgentDispatcherTests(unittest.TestCase):
    def test_stage_run_writes_planned_manifest(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            dispatcher.ROOT_DIR = root
            dispatcher.DEFAULT_RUNS_DIR = root / "artifacts" / "agent_runs"
            catalog = {
                "agents": [
                    {
                        "id": "designer-agent",
                        "kind": "top_level",
                        "supportedHosts": ["codex"],
                        "allowedSkills": ["playwright"],
                        "allowedTools": ["Browser verification"],
                        "allowedMcp": ["playwright"],
                        "allowedRules": ["OAP Design Rule"],
                        "outputContract": "design_review_package.v1",
                        "executionMode": "sequential",
                        "stopConditions": ["design_actions_ready"],
                    }
                ]
            }
            catalog_path = root / "catalog.json"
            catalog_path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")

            payload = dispatcher.stage_run(
                agent_id="designer-agent",
                task_id="task-1",
                purpose="Review UI",
                context_refs=["ops-web/src/pages/AgentsPage.tsx"],
                host_id="codex",
                path=catalog_path,
            )

            self.assertEqual(payload["status"], "planned")
            self.assertEqual(payload["trace_id"], "trace-" + payload["run_id"].removeprefix("run-"))
            self.assertEqual(payload["execution_backend"], "dispatcher_backed_child_runs")
            self.assertTrue(payload["context_window_id"].startswith("ctx-inst-"))
            manifest_path = root / payload["artifacts"]["manifest_path"]
            self.assertTrue(manifest_path.exists())
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["instance_id"], payload["instance_id"])
            self.assertEqual(manifest["input_refs"], ["ops-web/src/pages/AgentsPage.tsx"])

    def test_start_and_complete_run_write_telemetry(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            dispatcher.ROOT_DIR = root
            dispatcher.DEFAULT_RUNS_DIR = root / "artifacts" / "agent_runs"
            dispatcher.DEFAULT_LOG_DIR = root / ".logs" / "agents"
            dispatcher.DEFAULT_HOST_CATALOG = root / "catalog.json"
            catalog = {
                "agents": [
                    {
                        "id": "retrieval-audit",
                        "kind": "runtime_specialist",
                        "supportedHosts": ["codex"],
                        "allowedSkills": ["doc"],
                        "allowedTools": ["QMD retrieval"],
                        "allowedMcp": ["qmd"],
                        "allowedRules": ["QMD Retrieval Policy"],
                        "outputContract": "retrieval_audit_report.v1",
                        "executionMode": "parallel_read_only",
                        "stopConditions": ["audit_report_ready"],
                    }
                ]
            }
            dispatcher.DEFAULT_HOST_CATALOG.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")

            staged = dispatcher.stage_run(
                agent_id="retrieval-audit",
                task_id="task-2",
                purpose="Audit evidence coverage",
                host_id="codex",
                root_agent_id="analyst-agent",
                parent_instance_id="inst-parent",
                depth=1,
                phase_id="phase_2_parallel_audit",
                interaction_mode="mixed_phased",
                read_only=True,
                ownership_scope=["read_only_analysis"],
                depends_on=["phase_1_framing"],
                merge_target="phase_4_apply_merge",
                path=dispatcher.DEFAULT_HOST_CATALOG,
            )
            running = dispatcher.start_run(staged["run_id"], log_dir=dispatcher.DEFAULT_LOG_DIR)
            self.assertEqual(running["status"], "running")

            completed = dispatcher.finalize_run(
                staged["run_id"],
                final_status="completed",
                verify_status="passed",
                result_payload={"summary": "ok"},
                log_dir=dispatcher.DEFAULT_LOG_DIR,
            )
            self.assertEqual(completed["status"], "completed")
            self.assertEqual(completed["verify_status"], "passed")

            result_path = root / completed["artifacts"]["result_path"]
            self.assertTrue(result_path.exists())
            result_payload = json.loads(result_path.read_text(encoding="utf-8"))
            self.assertEqual(result_payload["summary"], "ok")

            log_path = dispatcher.DEFAULT_LOG_DIR / "retrieval-audit.jsonl"
            self.assertTrue(log_path.exists())
            rows = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
            self.assertEqual([row["status"] for row in rows], ["agent_instance_spawned", "agent_instance_completed"])
            self.assertEqual(rows[0]["step"], "step_3_orchestration")
            self.assertEqual(rows[1]["step"], "step_6_role_exit_decision")
            self.assertEqual(rows[0]["root_agent_id"], "analyst-agent")
            self.assertEqual(rows[0]["parent_instance_id"], "inst-parent")
            self.assertEqual(rows[0]["phase_id"], "phase_2_parallel_audit")
            self.assertEqual(rows[0]["interaction_mode"], "mixed_phased")
            self.assertTrue(rows[0]["read_only"])
            self.assertEqual(rows[1]["verify_status"], "passed")


if __name__ == "__main__":
    unittest.main()
