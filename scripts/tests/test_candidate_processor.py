from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "candidate_processor.py"
    spec = importlib.util.spec_from_file_location("candidate_processor", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


candidate = _load_module()


class CandidateProcessorTests(unittest.TestCase):
    def test_parse_message_extracts_links_and_source_key(self):
        payload = {
            "message": {
                "message_id": 77,
                "chat": {"id": 100500},
                "text": "Полезная практика для OAP https://example.com/docs https://example.com/docs.",
            }
        }
        parsed = candidate.parse_message(payload)
        self.assertEqual(parsed["source_key"], "telegram:100500:77")
        self.assertEqual(parsed["telegram_chat_id"], "100500")
        self.assertEqual(parsed["telegram_message_id"], "77")
        self.assertEqual(parsed["links"], ["https://example.com/docs"])
        self.assertTrue(parsed["candidate_id"].startswith("cand_"))

    def test_candidate_id_is_idempotent(self):
        key = "telegram:1:2"
        text = "same"
        first = candidate.make_candidate_id(key, text)
        second = candidate.make_candidate_id(key, text)
        self.assertEqual(first, second)

    def test_assess_rejects_low_quality_candidate(self):
        item = {
            "candidate_id": "cand_x",
            "text": "коротко",
            "links": [],
        }
        result = candidate.assess_candidate(
            item,
            baseline_volatility=0.2,
            uplift_threshold=5.0,
            target_metric="recommendation_action_rate",
            task_id="task-1",
        )
        self.assertEqual(result["decision"], "candidate_rejected")
        self.assertEqual(result["status"], "candidate_rejected")
        self.assertIn("ab_plan", result)
        self.assertFalse(result["ab_plan"]["enabled"])
        self.assertEqual(result["ab_plan"]["pass_rule"], "target_plus_guardrails")

    def test_compute_cycles_required_is_clamped(self):
        self.assertEqual(candidate.compute_cycles_required(20.0, 0.2), 3)
        self.assertEqual(candidate.compute_cycles_required(0.2, 3.0), 8)

    def test_cohort_assignment_is_stable(self):
        first = candidate.pick_cohort("cand_1", "task-7")
        second = candidate.pick_cohort("cand_1", "task-7")
        self.assertEqual(first, second)
        self.assertIn(first["cohort"], {"control", "test"})
        self.assertTrue(0 <= first["bucket"] <= 99)

    def test_assessment_contains_collaboration_hints(self):
        item = {
            "candidate_id": "cand_ui_ops",
            "text": "UI redesign and retrieval validation for release safety",
            "links": ["https://example.com/ui"],
        }
        result = candidate.assess_candidate(
            item,
            baseline_volatility=0.2,
            uplift_threshold=5.0,
            target_metric="recommendation_action_rate",
            task_id="task-ui-1",
        )
        self.assertIn("collaboration_hints", result)
        suggested = result["collaboration_hints"]["suggested_agents"]
        self.assertIn("designer-agent", suggested)
        self.assertIn("reader-agent", suggested)
        self.assertIn("ab_plan", result)
        self.assertGreaterEqual(int(result["ab_plan"]["sessions_required"]), 3)
        self.assertLessEqual(int(result["ab_plan"]["sessions_required"]), 8)


if __name__ == "__main__":
    unittest.main()
