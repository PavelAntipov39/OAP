from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "validate_agent_operating_plans.py"
    spec = importlib.util.spec_from_file_location("validate_agent_operating_plans", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


validator = _load_module()

MIN_OPERATING_PLAN = """---
{
    "id": "reader-agent",
    "displayName": "Разработчик",
    "kind": "top_level",
    "mission": "Implement changes.",
    "useWhen": ["Need implementation."],
    "avoidWhen": ["Need only analysis."],
    "inputContract": "implementation_task.v1",
    "outputContract": "implementation_result_package.v1",
    "allowedSkills": ["doc"],
    "allowedTools": ["QMD retrieval"],
    "allowedMcp": ["qmd"],
    "allowedRules": ["Universal workflow backbone"],
    "handoffTargets": ["ui-verification"],
    "executionMode": "sequential",
    "supportedHosts": ["codex", "claude_code", "github_copilot"],
    "hostAdapters": {
        "github_copilot": {
            "description": "Need implementation.",
            "tools": ["read", "search", "edit", "execute", "agent"],
            "agents": ["ui-verification"]
        }
    },
    "stopConditions": ["implementation_ready"]
}
---

## Universal Backbone Mapping
## Capability Selection Contract (Mandatory)
<!-- contract-marker: baseline-minimum -->
<!-- contract-marker: dynamic-capability-selection -->
## Self-Improvement and Lesson Gate (Mandatory)
<!-- contract-marker: self-improvement-gate -->
## Capability Refresh Note (Mandatory)
<!-- contract-marker: capability-refresh -->
"""


class ValidateAgentOperatingPlansTests(unittest.TestCase):
    def test_extract_agent_ids(self):
        registry = {
            "agents": [
                {"id": "reader-agent"},
                {"id": "data-agent"},
                {"id": "retrieval-audit", "agentClass": "specialist", "lifecycle": "active"},
                {"id": "reader-agent"},
                {"id": "notagent"},
                {"id": ""},
            ]
        }
        ids = validator.extract_agent_ids(registry)
        self.assertEqual(ids, ["reader-agent", "data-agent", "retrieval-audit"])

    def test_required_files_for_agent(self):
        self.assertEqual(
            validator.required_files_for_agent("analyst-agent"),
            [
                "OPERATING_PLAN.md",
                "CARD_DATA_SOURCES_MAP.md",
                "FLOW.md",
                "CARD_FULL_FLOW.md",
            ],
        )
        self.assertEqual(validator.required_files_for_agent("reader-agent"), ["OPERATING_PLAN.md"])

    def test_validate_layout_reports_missing(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "reader-agent").mkdir(parents=True)
            (root / "reader-agent" / "OPERATING_PLAN.md").write_text(MIN_OPERATING_PLAN, encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["reader-agent", "ops-agent"], root)
            self.assertEqual(len(errors), 1)
            self.assertIn("ops-agent/OPERATING_PLAN.md", errors[0])

    def test_validate_layout_reports_missing_analyst_docs(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "analyst-agent").mkdir(parents=True)
            content = MIN_OPERATING_PLAN.replace('"reader-agent"', '"analyst-agent"', 1)
            (root / "analyst-agent" / "OPERATING_PLAN.md").write_text(content, encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["analyst-agent"], root)
            self.assertEqual(len(errors), 3)
            self.assertTrue(any("CARD_DATA_SOURCES_MAP.md" in item for item in errors))
            self.assertTrue(any("FLOW.md" in item for item in errors))
            self.assertTrue(any("CARD_FULL_FLOW.md" in item for item in errors))

    def test_validate_layout_reports_missing_operating_plan_markers(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "reader-agent").mkdir(parents=True)
            (root / "reader-agent" / "OPERATING_PLAN.md").write_text("---\n{}\n---\n# missing markers\n", encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["reader-agent"], root)
            self.assertTrue(any("missing operating plan marker" in item for item in errors))
            self.assertTrue(any("baseline-minimum" in item for item in errors))

    def test_validate_layout_reports_missing_frontmatter(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "reader-agent").mkdir(parents=True)
            (root / "reader-agent" / "OPERATING_PLAN.md").write_text("# no frontmatter\n", encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["reader-agent"], root)
            self.assertTrue(any("missing_frontmatter" in item for item in errors))

    def test_validate_layout_reports_frontmatter_id_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "reader-agent").mkdir(parents=True)
            content = MIN_OPERATING_PLAN.replace('"reader-agent"', '"designer-agent"', 1)
            (root / "reader-agent" / "OPERATING_PLAN.md").write_text(content, encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["reader-agent"], root)
            self.assertTrue(any("frontmatter_id_mismatch" in item for item in errors))

    def test_validate_layout_reports_invalid_github_copilot_tool(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "reader-agent").mkdir(parents=True)
            content = MIN_OPERATING_PLAN.replace('"agent"', '"qmd/*"', 1)
            (root / "reader-agent" / "OPERATING_PLAN.md").write_text(content, encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["reader-agent"], root)
            self.assertTrue(any("invalid_host_adapter_tools" in item for item in errors))

    def test_validate_layout_reports_missing_agent_tool_for_handoffs(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "reader-agent").mkdir(parents=True)
            content = MIN_OPERATING_PLAN.replace(', "agent"', "")
            (root / "reader-agent" / "OPERATING_PLAN.md").write_text(content, encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["reader-agent"], root)
            self.assertTrue(any("missing_host_adapter_agent_tool" in item for item in errors))

    def test_load_registry_and_full_check(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            registry_path = root / "registry.yaml"
            agents_root = root / "agents"
            (agents_root / "reader-agent").mkdir(parents=True)
            (agents_root / "reader-agent" / "OPERATING_PLAN.md").write_text(MIN_OPERATING_PLAN, encoding="utf-8")
            registry_path.write_text(json.dumps({"agents": [{"id": "reader-agent"}]}, ensure_ascii=False), encoding="utf-8")

            registry = validator.load_registry(registry_path)
            ids = validator.extract_agent_ids(registry)
            errors = validator.validate_operating_plan_layout(ids, agents_root)
            self.assertEqual(errors, [])

    def test_full_check_accepts_complete_analyst_layout(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            registry_path = root / "registry.yaml"
            agents_root = root / "agents"
            (agents_root / "analyst-agent").mkdir(parents=True)
            for relative_name in ["OPERATING_PLAN.md", "CARD_DATA_SOURCES_MAP.md", "FLOW.md", "CARD_FULL_FLOW.md"]:
                content = MIN_OPERATING_PLAN.replace('"reader-agent"', '"analyst-agent"', 1) if relative_name == "OPERATING_PLAN.md" else f"# {relative_name}\n"
                (agents_root / "analyst-agent" / relative_name).write_text(content, encoding="utf-8")
            registry_path.write_text(json.dumps({"agents": [{"id": "analyst-agent"}]}, ensure_ascii=False), encoding="utf-8")

            registry = validator.load_registry(registry_path)
            ids = validator.extract_agent_ids(registry)
            errors = validator.validate_operating_plan_layout(ids, agents_root)
            self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
