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


class ValidateAgentOperatingPlansTests(unittest.TestCase):
    def test_extract_agent_ids(self):
        registry = {
            "agents": [
                {"id": "reader-agent"},
                {"id": "data-agent"},
                {"id": "reader-agent"},
                {"id": "notagent"},
                {"id": ""},
            ]
        }
        ids = validator.extract_agent_ids(registry)
        self.assertEqual(ids, ["reader-agent", "data-agent"])

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
            (root / "reader-agent" / "OPERATING_PLAN.md").write_text("# x\n", encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["reader-agent", "ops-agent"], root)
            self.assertEqual(len(errors), 1)
            self.assertIn("ops-agent/OPERATING_PLAN.md", errors[0])

    def test_validate_layout_reports_missing_analyst_docs(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            (root / "analyst-agent").mkdir(parents=True)
            (root / "analyst-agent" / "OPERATING_PLAN.md").write_text("# analyst\n", encoding="utf-8")
            errors = validator.validate_operating_plan_layout(["analyst-agent"], root)
            self.assertEqual(len(errors), 3)
            self.assertTrue(any("CARD_DATA_SOURCES_MAP.md" in item for item in errors))
            self.assertTrue(any("FLOW.md" in item for item in errors))
            self.assertTrue(any("CARD_FULL_FLOW.md" in item for item in errors))

    def test_load_registry_and_full_check(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            registry_path = root / "registry.yaml"
            agents_root = root / "agents"
            (agents_root / "reader-agent").mkdir(parents=True)
            (agents_root / "reader-agent" / "OPERATING_PLAN.md").write_text("# reader\n", encoding="utf-8")
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
                (agents_root / "analyst-agent" / relative_name).write_text(f"# {relative_name}\n", encoding="utf-8")
            registry_path.write_text(json.dumps({"agents": [{"id": "analyst-agent"}]}, ensure_ascii=False), encoding="utf-8")

            registry = validator.load_registry(registry_path)
            ids = validator.extract_agent_ids(registry)
            errors = validator.validate_operating_plan_layout(ids, agents_root)
            self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
