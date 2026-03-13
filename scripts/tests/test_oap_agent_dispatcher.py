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
telemetry = _load_module("agent_telemetry_for_dispatcher_tests", "scripts/agent_telemetry.py")


class OapAgentDispatcherTests(unittest.TestCase):
    def test_stage_run_reads_agent_from_registry_and_operating_plan_by_default(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            dispatcher.ROOT_DIR = root
            dispatcher.DEFAULT_RUNS_DIR = root / "artifacts" / "agent_runs"
            dispatcher.DEFAULT_AGENT_REGISTRY = root / "docs" / "agents" / "registry.yaml"
            dispatcher.DEFAULT_AGENTS_ROOT = root / "docs" / "subservices" / "oap" / "agents"

            dispatcher.DEFAULT_AGENT_REGISTRY.parent.mkdir(parents=True, exist_ok=True)
            dispatcher.DEFAULT_AGENT_REGISTRY.write_text(
                json.dumps(
                    {"agents": [{"id": "designer-agent", "agentClass": "core", "lifecycle": "active"}]},
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            plan_dir = dispatcher.DEFAULT_AGENTS_ROOT / "designer-agent"
            plan_dir.mkdir(parents=True, exist_ok=True)
            plan_dir.joinpath("OPERATING_PLAN.md").write_text(
                "---\n"
                "{\n"
                '  "id": "designer-agent",\n'
                '  "displayName": "Дизайнер",\n'
                '  "kind": "top_level",\n'
                '  "mission": "Review UI quality.",\n'
                '  "useWhen": ["Need UI review."],\n'
                '  "avoidWhen": ["Task is pure backend."],\n'
                '  "inputContract": "design_brief.v1",\n'
                '  "outputContract": "design_review_package.v1",\n'
                '  "allowedSkills": ["playwright"],\n'
                '  "allowedTools": ["Browser verification"],\n'
                '  "allowedMcp": ["playwright"],\n'
                '  "allowedRules": ["OAP Design Rule"],\n'
                '  "handoffTargets": ["analyst-agent"],\n'
                '  "executionMode": "sequential",\n'
                '  "supportedHosts": ["codex", "claude_code", "github_copilot"],\n'
                '  "hostAdapters": {"github_copilot": {"description": "Need UI review.", "tools": ["read", "search", "edit", "execute", "agent"], "agents": ["analyst-agent"]}},\n'
                '  "stopConditions": ["design_actions_ready"]\n'
                "}\n"
                "---\n\n"
                "## Capability Selection Contract (Mandatory)\n"
                "<!-- contract-marker: baseline-minimum -->\n"
                "<!-- contract-marker: dynamic-capability-selection -->\n"
                "## Self-Improvement and Lesson Gate (Mandatory)\n"
                "<!-- contract-marker: self-improvement-gate -->\n"
                "## Capability Refresh Note (Mandatory)\n"
                "<!-- contract-marker: capability-refresh -->\n",
                encoding="utf-8",
            )

            payload = dispatcher.stage_run(
                agent_id="designer-agent",
                task_id="task-direct-1",
                purpose="Review UI from direct metadata",
                context_refs=["ops-web/src/pages/AgentsPage.tsx"],
                host_id="codex",
            )

            self.assertEqual(payload["status"], "planned")
            self.assertEqual(payload["allowed_skills"], ["playwright"])
            self.assertEqual(payload["allowed_mcp"], ["playwright"])
            self.assertEqual(payload["stop_conditions"], ["design_actions_ready"])
            self.assertEqual(payload["source_refs"], ["docs/agents/registry.yaml", "docs/subservices/oap/agents"])

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
            dispatcher.DEFAULT_AGENT_FIXTURE_PATH = root / "catalog.json"
            dispatcher.DEFAULT_HOST_CATALOG = dispatcher.DEFAULT_AGENT_FIXTURE_PATH
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
            dispatcher.DEFAULT_AGENT_FIXTURE_PATH.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")

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
                path=dispatcher.DEFAULT_AGENT_FIXTURE_PATH,
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
            self.assertEqual(
                [row["status"] for row in rows],
                [
                    "orchestration_phase_started",
                    "agent_instance_spawned",
                    "orchestration_phase_completed",
                    "agent_instance_completed",
                ],
            )
            self.assertTrue(all(row["step"] == "step_4_context_sync" for row in rows))
            self.assertEqual(rows[1]["root_agent_id"], "analyst-agent")
            self.assertEqual(rows[1]["parent_instance_id"], "inst-parent")
            self.assertEqual(rows[1]["phase_id"], "phase_2_parallel_audit")
            self.assertEqual(rows[1]["interaction_mode"], "mixed_phased")
            self.assertTrue(rows[1]["read_only"])
            self.assertEqual(rows[-1]["verify_status"], "passed")

    def test_roundtable_root_run_emits_mode_and_roundtable_events(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            dispatcher.ROOT_DIR = root
            dispatcher.DEFAULT_RUNS_DIR = root / "artifacts" / "agent_runs"
            dispatcher.DEFAULT_LOG_DIR = root / ".logs" / "agents"
            dispatcher.DEFAULT_AGENT_FIXTURE_PATH = root / "catalog.json"
            dispatcher.DEFAULT_HOST_CATALOG = dispatcher.DEFAULT_AGENT_FIXTURE_PATH
            catalog = {
                "agents": [
                    {
                        "id": "orchestrator-agent",
                        "kind": "top_level",
                        "supportedHosts": ["codex"],
                        "allowedSkills": ["agent-telemetry"],
                        "allowedTools": ["Coordination policy checker"],
                        "allowedMcp": [],
                        "allowedRules": ["Universal Self-Improvement Loop"],
                        "outputContract": "orchestration_decision_package.v1",
                        "executionMode": "sequential",
                        "stopConditions": ["orchestration_decision_ready"],
                    }
                ]
            }
            dispatcher.DEFAULT_AGENT_FIXTURE_PATH.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")

            staged = dispatcher.stage_run(
                agent_id="orchestrator-agent",
                task_id="task-3",
                purpose="Moderate roundtable",
                host_id="codex",
                root_agent_id="orchestrator-agent",
                phase_id="phase_3_roundtable",
                interaction_mode="mixed_phased",
                read_only=True,
                path=dispatcher.DEFAULT_AGENT_FIXTURE_PATH,
            )
            dispatcher.start_run(staged["run_id"], log_dir=dispatcher.DEFAULT_LOG_DIR)
            dispatcher.finalize_run(
                staged["run_id"],
                final_status="completed",
                verify_status="passed",
                result_payload={"summary": "roundtable done"},
                log_dir=dispatcher.DEFAULT_LOG_DIR,
            )

            log_path = dispatcher.DEFAULT_LOG_DIR / "orchestrator-agent.jsonl"
            rows = [json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip()]
            statuses = [row["status"] for row in rows]
            self.assertIn("orchestration_mode_selected", statuses)
            self.assertIn("roundtable_started", statuses)
            self.assertIn("roundtable_round_completed", statuses)
            self.assertIn("roundtable_converged", statuses)
            self.assertIn("orchestration_phase_started", statuses)
            self.assertIn("orchestration_phase_completed", statuses)
            self.assertEqual(rows[-1]["status"], "agent_instance_completed")

    def test_execute_collaboration_plan_runs_phases_and_passes_orchestration_gate(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            dispatcher.ROOT_DIR = root
            dispatcher.DEFAULT_RUNS_DIR = root / "artifacts" / "agent_runs"
            dispatcher.DEFAULT_LOG_DIR = root / ".logs" / "agents"
            dispatcher.DEFAULT_AGENT_FIXTURE_PATH = root / "catalog.json"
            dispatcher.DEFAULT_HOST_CATALOG = dispatcher.DEFAULT_AGENT_FIXTURE_PATH
            dispatcher.DEFAULT_AGENT_FIXTURE_PATH.write_text(json.dumps({"agents": []}, ensure_ascii=False), encoding="utf-8")

            plan = {
                "interaction_mode": "mixed_phased",
                "interaction_phases": [
                    {"phase_id": "phase_1_framing", "mode": "sequential", "depends_on": [], "participants": ["orchestrator-agent"]},
                    {"phase_id": "phase_2_parallel_audit", "mode": "parallel_read_only", "depends_on": ["phase_1_framing"], "participants": ["designer-agent", "ops-agent"]},
                    {"phase_id": "phase_3_roundtable", "mode": "sequential", "depends_on": ["phase_2_parallel_audit"], "participants": ["orchestrator-agent"]},
                    {"phase_id": "phase_4_apply_merge", "mode": "sequential", "depends_on": ["phase_3_roundtable"], "participants": ["analyst-agent"]},
                    {"phase_id": "phase_5_parallel_verify", "mode": "parallel_read_only", "depends_on": ["phase_4_apply_merge"], "participants": ["designer-agent"]},
                    {"phase_id": "phase_6_finalize", "mode": "sequential", "depends_on": ["phase_5_parallel_verify"], "participants": ["orchestrator-agent"]},
                ],
                "spawned_instances": [
                    {
                        "instance_id": "inst-phase-1",
                        "profile_id": "orchestrator-agent",
                        "task_id": "task-execute-plan",
                        "purpose": "Frame orchestration",
                        "depth": 0,
                        "phase_id": "phase_1_framing",
                        "execution_mode": "sequential",
                        "execution_backend": "dispatcher_backed_child_runs",
                        "read_only": False,
                    },
                    {
                        "instance_id": "inst-phase-2a",
                        "profile_id": "designer-agent",
                        "task_id": "task-execute-plan",
                        "purpose": "UI audit",
                        "parent_instance_id": "inst-phase-1",
                        "root_agent_id": "orchestrator-agent",
                        "depth": 1,
                        "phase_id": "phase_2_parallel_audit",
                        "execution_mode": "parallel_read_only",
                        "execution_backend": "dispatcher_backed_child_runs",
                        "read_only": True,
                    },
                    {
                        "instance_id": "inst-phase-2b",
                        "profile_id": "ops-agent",
                        "task_id": "task-execute-plan",
                        "purpose": "Telemetry audit",
                        "parent_instance_id": "inst-phase-1",
                        "root_agent_id": "orchestrator-agent",
                        "depth": 1,
                        "phase_id": "phase_2_parallel_audit",
                        "execution_mode": "parallel_read_only",
                        "execution_backend": "dispatcher_backed_child_runs",
                        "read_only": True,
                    },
                    {
                        "instance_id": "inst-phase-3",
                        "profile_id": "orchestrator-agent",
                        "task_id": "task-execute-plan",
                        "purpose": "Moderate roundtable",
                        "parent_instance_id": "inst-phase-1",
                        "root_agent_id": "orchestrator-agent",
                        "depth": 1,
                        "phase_id": "phase_3_roundtable",
                        "execution_mode": "sequential",
                        "execution_backend": "dispatcher_backed_child_runs",
                        "read_only": True,
                    },
                    {
                        "instance_id": "inst-phase-4",
                        "profile_id": "analyst-agent",
                        "task_id": "task-execute-plan",
                        "purpose": "Apply merge",
                        "parent_instance_id": "inst-phase-1",
                        "root_agent_id": "orchestrator-agent",
                        "depth": 1,
                        "phase_id": "phase_4_apply_merge",
                        "execution_mode": "sequential",
                        "execution_backend": "dispatcher_backed_child_runs",
                        "read_only": False,
                    },
                    {
                        "instance_id": "inst-phase-5",
                        "profile_id": "designer-agent",
                        "task_id": "task-execute-plan",
                        "purpose": "Verify UI",
                        "parent_instance_id": "inst-phase-1",
                        "root_agent_id": "orchestrator-agent",
                        "depth": 1,
                        "phase_id": "phase_5_parallel_verify",
                        "execution_mode": "parallel_read_only",
                        "execution_backend": "dispatcher_backed_child_runs",
                        "read_only": True,
                    },
                    {
                        "instance_id": "inst-phase-6",
                        "profile_id": "orchestrator-agent",
                        "task_id": "task-execute-plan",
                        "purpose": "Finalize answer",
                        "parent_instance_id": "inst-phase-1",
                        "root_agent_id": "orchestrator-agent",
                        "depth": 1,
                        "phase_id": "phase_6_finalize",
                        "execution_mode": "sequential",
                        "execution_backend": "dispatcher_backed_child_runs",
                        "read_only": False,
                    },
                ],
            }

            payload = dispatcher.execute_collaboration_plan(
                task_id="task-execute-plan",
                collaboration_plan=plan,
                log_dir=dispatcher.DEFAULT_LOG_DIR,
            )

            self.assertEqual(payload["status"], "completed")
            self.assertEqual(payload["runs_total"], 7)
            self.assertEqual([phase["phase_id"] for phase in payload["phases"]], [phase["phase_id"] for phase in plan["interaction_phases"]])

            manifest_paths = list((root / "artifacts" / "agent_runs").glob("*/run_manifest.json"))
            self.assertEqual(len(manifest_paths), 7)
            result_paths = list((root / "artifacts" / "agent_runs").glob("*/result.json"))
            self.assertEqual(len(result_paths), 7)

            events = []
            for log_path in dispatcher.DEFAULT_LOG_DIR.glob("*.jsonl"):
                events.extend(json.loads(line) for line in log_path.read_text(encoding="utf-8").splitlines() if line.strip())

            gate = telemetry.evaluate_orchestration_gate(events, mode="strict")
            self.assertEqual(gate["status"], "passed")
            self.assertEqual(gate["orchestrated_tasks_total"], 1)

    def test_execute_collaboration_plan_rejects_write_capable_parallel_branch(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            dispatcher.ROOT_DIR = root
            dispatcher.DEFAULT_RUNS_DIR = root / "artifacts" / "agent_runs"
            dispatcher.DEFAULT_LOG_DIR = root / ".logs" / "agents"

            plan = {
                "interaction_mode": "mixed_phased",
                "interaction_phases": [
                    {"phase_id": "phase_1_framing", "mode": "sequential", "depends_on": []},
                    {"phase_id": "phase_2_parallel_audit", "mode": "parallel_read_only", "depends_on": ["phase_1_framing"]},
                ],
                "spawned_instances": [
                    {
                        "instance_id": "inst-safe-root",
                        "profile_id": "orchestrator-agent",
                        "task_id": "task-invalid-parallel",
                        "purpose": "Frame orchestration",
                        "depth": 0,
                        "phase_id": "phase_1_framing",
                        "execution_mode": "sequential",
                        "read_only": False,
                    },
                    {
                        "instance_id": "inst-invalid-write",
                        "profile_id": "designer-agent",
                        "task_id": "task-invalid-parallel",
                        "purpose": "Invalid write branch",
                        "parent_instance_id": "inst-safe-root",
                        "root_agent_id": "orchestrator-agent",
                        "depth": 1,
                        "phase_id": "phase_2_parallel_audit",
                        "execution_mode": "parallel_read_only",
                        "read_only": False,
                    },
                ],
            }

            with self.assertRaises(ValueError):
                dispatcher.execute_collaboration_plan(
                    task_id="task-invalid-parallel",
                    collaboration_plan=plan,
                    log_dir=dispatcher.DEFAULT_LOG_DIR,
                )


if __name__ == "__main__":
    unittest.main()
