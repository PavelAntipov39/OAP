from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "export_host_agents.py"
    spec = importlib.util.spec_from_file_location("export_host_agents", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


exporter = _load_module()


CATALOG = {
    "agents": [
        {
            "id": "analyst-agent",
            "displayName": "Аналитик",
            "kind": "top_level",
            "mission": "Analyze workflows and recommend measurable improvements.",
            "useWhen": ["Need KPI and workflow analysis."],
            "avoidWhen": ["Task is pure UI implementation."],
            "inputContract": "task_brief.v1",
            "outputContract": "analyst_decision_package.v1",
            "allowedSkills": ["doc", "spreadsheet"],
            "allowedTools": ["QMD retrieval", "Telemetry report builder"],
            "allowedMcp": ["qmd", "context7"],
            "allowedRules": ["Universal workflow backbone"],
            "handoffTargets": ["designer-agent", "retrieval-audit"],
            "executionMode": "sequential",
            "supportedHosts": ["claude_code", "github_copilot", "codex"],
            "stopConditions": ["decision_package_ready"],
        },
        {
            "id": "designer-agent",
            "displayName": "Дизайнер",
            "kind": "top_level",
            "mission": "Review UI quality and design consistency.",
            "useWhen": ["Need UI review."],
            "avoidWhen": ["Task is pure backend."],
            "inputContract": "design_brief.v1",
            "outputContract": "design_review_package.v1",
            "allowedSkills": ["playwright"],
            "allowedTools": ["Browser verification"],
            "allowedMcp": ["playwright"],
            "allowedRules": ["Universal workflow backbone"],
            "handoffTargets": ["analyst-agent"],
            "executionMode": "sequential",
            "supportedHosts": ["claude_code", "github_copilot", "codex"],
            "stopConditions": ["design_review_ready"],
        },
        {
            "id": "retrieval-audit",
            "displayName": "Retrieval Audit Specialist",
            "kind": "runtime_specialist",
            "mission": "Audit evidence quality.",
            "useWhen": ["Need retrieval audit."],
            "avoidWhen": ["Exact file is already known."],
            "inputContract": "retrieval_audit_request.v1",
            "outputContract": "retrieval_audit_report.v1",
            "allowedSkills": ["doc"],
            "allowedTools": ["QMD retrieval"],
            "allowedMcp": ["qmd"],
            "allowedRules": ["QMD Retrieval Policy"],
            "handoffTargets": [],
            "executionMode": "parallel_read_only",
            "supportedHosts": ["claude_code", "github_copilot", "codex"],
            "stopConditions": ["audit_report_ready"],
        },
    ]
}

MATRIX = {
    "hosts": [
        {"id": "claude_code"},
        {"id": "github_copilot"},
        {"id": "codex"},
    ]
}


class ExportHostAgentsTests(unittest.TestCase):
    def test_build_output_specs_for_claude(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            repo_root = Path(tmp_dir)
            specs = exporter.build_output_specs(
                host_id="claude_code",
                catalog=CATALOG,
                matrix=MATRIX,
                agent_id="retrieval-audit",
                repo_root=repo_root,
            )
            self.assertEqual(len(specs), 1)
            self.assertTrue(specs[0]["path"].endswith(".claude/agents/retrieval-audit.md"))
            content = specs[0]["content"]
            self.assertIn("name: retrieval-audit", content)
            self.assertIn("permissionMode: plan", content)
            self.assertIn('"doc"', content)
            self.assertIn('"qmd"', content)
            self.assertIn("Stay within Universal Session Backbone v1.", content)

    def test_build_output_specs_for_claude_with_agent_delegation(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            repo_root = Path(tmp_dir)
            specs = exporter.build_output_specs(
                host_id="claude_code",
                catalog=CATALOG,
                matrix=MATRIX,
                agent_id="analyst-agent",
                repo_root=repo_root,
            )
            self.assertEqual(len(specs), 1)
            content = specs[0]["content"]
            self.assertIn('"Agent(designer-agent, retrieval-audit)"', content)
            self.assertIn("Delegation targets: designer-agent, retrieval-audit", content)

    def test_build_output_specs_for_github_copilot(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            repo_root = Path(tmp_dir)
            specs = exporter.build_output_specs(
                host_id="github_copilot",
                catalog=CATALOG,
                matrix=MATRIX,
                agent_id="analyst-agent",
                repo_root=repo_root,
            )
            self.assertEqual(len(specs), 1)
            self.assertTrue(specs[0]["path"].endswith(".github/agents/analyst-agent.agent.md"))
            content = specs[0]["content"]
            self.assertIn("tools:", content)
            self.assertIn('"read"', content)
            self.assertIn('"search"', content)
            self.assertIn('"edit"', content)
            self.assertIn('"execute"', content)
            self.assertIn('"custom-agent"', content)
            self.assertIn('"qmd/*"', content)
            self.assertIn("agents:", content)
            self.assertIn('"designer-agent"', content)
            self.assertIn('"retrieval-audit"', content)

    def test_write_output_specs_for_codex(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            codex_dir = Path(tmp_dir) / "skills-generated"
            specs = exporter.build_output_specs(
                host_id="codex",
                catalog=CATALOG,
                matrix=MATRIX,
                agent_id="analyst-agent",
                codex_skills_dir=codex_dir,
            )
            written = exporter.write_output_specs(specs)
            self.assertEqual(len(written), 2)
            skill_path = codex_dir / "analyst-agent" / "SKILL.md"
            config_path = codex_dir / "analyst-agent" / "agents" / "openai.yaml"
            self.assertTrue(skill_path.exists())
            self.assertTrue(config_path.exists())
            openai_yaml = config_path.read_text(encoding="utf-8")
            self.assertIn("display_name", openai_yaml)
            self.assertIn("default_prompt", openai_yaml)
            skill_body = skill_path.read_text(encoding="utf-8")
            self.assertIn("Canonical id: `analyst-agent`", skill_body)
            self.assertIn("Workflow invariant:", skill_body)

    def test_smoke_active_set_passes_for_matching_generated_outputs(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            repo_root = Path(tmp_dir)
            for host_id in ("claude_code", "github_copilot"):
                specs = exporter.build_output_specs(
                    host_id=host_id,
                    catalog=CATALOG,
                    matrix=MATRIX,
                    repo_root=repo_root,
                )
                exporter.write_output_specs(specs)

            report = exporter.smoke_active_set(
                catalog=CATALOG,
                matrix=MATRIX,
                repo_root=repo_root,
                codex_skills_dir=repo_root / ".codex-smoke",
            )

            self.assertTrue(report["ok"])
            self.assertTrue(report["hosts"]["claude_code"]["ok"])
            self.assertTrue(report["hosts"]["github_copilot"]["ok"])
            self.assertTrue(report["hosts"]["codex"]["ok"])
            self.assertEqual(report["active_top_level_agents"], ["analyst-agent", "designer-agent"])

    def test_smoke_active_set_fails_on_repo_drift(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            repo_root = Path(tmp_dir)
            specs = exporter.build_output_specs(
                host_id="claude_code",
                catalog=CATALOG,
                matrix=MATRIX,
                repo_root=repo_root,
            )
            exporter.write_output_specs(specs)
            claude_file = repo_root / ".claude" / "agents" / "analyst-agent.md"
            claude_file.write_text("stale", encoding="utf-8")

            report = exporter.smoke_active_set(
                catalog=CATALOG,
                matrix=MATRIX,
                repo_root=repo_root,
                codex_skills_dir=repo_root / ".codex-smoke",
            )

            self.assertFalse(report["ok"])
            self.assertFalse(report["hosts"]["claude_code"]["ok"])
            self.assertFalse(report["hosts"]["claude_code"]["agents"][0]["specs"][0]["matches"])


if __name__ == "__main__":
    unittest.main()
