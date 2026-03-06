from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "visual_explainer_oap.py"
    spec = importlib.util.spec_from_file_location("visual_explainer_oap", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


visual = _load_module()


class VisualExplainerPlanParsingTests(unittest.TestCase):
    def test_extract_candidate_paths_ignores_non_path_tokens_in_backticks(self):
        text = """
        Цикл: `started` -> `applied`
        Пишет `.logs/agents/analyst-agent.jsonl` (`status=started`)
        Читает `docs/agents/registry.yaml`, `docs/subservices/oap/README.md`
        Смотрите `AGENTS.md` и `scripts/agent_telemetry.py`.
        """

        got = visual.extract_candidate_paths(text)

        self.assertIn(".logs/agents/analyst-agent.jsonl", got)
        self.assertIn("docs/agents/registry.yaml", got)
        self.assertIn("docs/subservices/oap/README.md", got)
        self.assertIn("AGENTS.md", got)
        self.assertIn("scripts/agent_telemetry.py", got)

        self.assertNotIn("started", got)
        self.assertNotIn("applied", got)
        self.assertNotIn("status=started", got)

    def test_normalize_path_resolves_leading_slash_repo_relative_paths(self):
        normalized = visual.normalize_path("/docs/subservices/oap/README.md")
        expected = visual.REPO_ROOT / "docs/subservices/oap/README.md"
        self.assertEqual(normalized, expected)

