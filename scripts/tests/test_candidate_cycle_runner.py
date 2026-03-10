from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "candidate_cycle_runner.py"
    spec = importlib.util.spec_from_file_location("candidate_cycle_runner", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


runner = _load_module()


class CandidateCycleRunnerTests(unittest.TestCase):
    def test_process_candidates_happy_path(self):
        pending = [
            {
                "candidate_id": "cand_a",
                "source_key": "telegram:1:1",
                "telegram_chat_id": "42",
                "telegram_message_id": "11",
                "text": "A/B workflow with evidence",
                "links": ["https://example.com/1"],
            },
            {
                "candidate_id": "cand_b",
                "source_key": "telegram:1:2",
                "telegram_chat_id": "42",
                "telegram_message_id": "12",
                "text": "Short candidate",
                "links": [],
            },
        ]
        cfg = runner.RunnerConfig(
            batch_limit=50,
            baseline_volatility=0.2,
            uplift_threshold=5.0,
            target_metric="recommendation_action_rate",
            task_id="candidate-ab-task",
            run_id="run-1",
            cutoff_iso="2026-03-06T10:00:00Z",
            reply_enabled=True,
            dry_run=False,
        )

        claims = {"telegram:1:1": True, "telegram:1:2": True}
        finalized: list[tuple[str, str, str]] = []
        upserted: list[dict] = []
        replies: list[tuple[str, str, str]] = []

        def claim_candidate(source_key: str) -> bool:
            return claims.get(source_key, False)

        def assess_fn(candidate: dict) -> dict:
            if candidate["candidate_id"] == "cand_a":
                return {
                    "candidate_id": "cand_a",
                    "decision": "accept_for_ab",
                    "applicability": "high",
                    "target_metric": "recommendation_action_rate",
                    "baseline_value": None,
                    "expected_delta": 8.3,
                    "objective_risks": [],
                    "cycles_required": 3,
                    "status": "candidate_assessed",
                    "decided_at": "2026-03-06T10:00:10Z",
                }
            return {
                "candidate_id": "cand_b",
                "decision": "candidate_rejected",
                "applicability": "low",
                "target_metric": "recommendation_action_rate",
                "baseline_value": None,
                "expected_delta": 2.0,
                "objective_risks": [
                    {
                        "risk_id": "risk_no_evidence_links",
                        "description": "Нет подтверждающих ссылок.",
                        "evidence": "candidate.links is empty",
                    }
                ],
                "cycles_required": 5,
                "status": "candidate_rejected",
                "decided_at": "2026-03-06T10:00:11Z",
            }

        def upsert_assessment(payload: dict) -> None:
            upserted.append(payload)

        def set_status(source_key: str, from_status: str, to_status: str) -> bool:
            finalized.append((source_key, from_status, to_status))
            return True

        def send_reply(chat_id: str, reply_to: str, text: str) -> None:
            replies.append((chat_id, reply_to, text))

        summary = runner.process_candidates(
            pending,
            config=cfg,
            claim_candidate=claim_candidate,
            assess_fn=assess_fn,
            upsert_assessment=upsert_assessment,
            set_status=set_status,
            send_reply=send_reply,
        )

        self.assertEqual(summary["processed"], 2)
        self.assertEqual(summary["accepted_for_ab"], 1)
        self.assertEqual(summary["rejected"], 1)
        self.assertEqual(summary["replied"], 2)
        self.assertEqual(len(upserted), 2)
        self.assertEqual(
            finalized,
            [
                ("telegram:1:1", "processing", "ab_test_started"),
                ("telegram:1:2", "processing", "candidate_rejected"),
            ],
        )

    def test_process_candidates_rolls_back_on_error(self):
        pending = [
            {
                "candidate_id": "cand_fail",
                "source_key": "telegram:2:1",
                "telegram_chat_id": "42",
                "telegram_message_id": "99",
                "text": "candidate",
                "links": [],
            }
        ]
        cfg = runner.RunnerConfig(
            batch_limit=10,
            baseline_volatility=0.2,
            uplift_threshold=5.0,
            target_metric="recommendation_action_rate",
            task_id="candidate-ab-task",
            run_id="run-2",
            cutoff_iso="2026-03-06T10:00:00Z",
            reply_enabled=True,
            dry_run=False,
        )

        statuses: list[tuple[str, str, str]] = []

        def claim_candidate(_source_key: str) -> bool:
            return True

        def assess_fn(_candidate: dict) -> dict:
            return {
                "candidate_id": "cand_fail",
                "decision": "accept_for_ab",
                "applicability": "high",
                "target_metric": "recommendation_action_rate",
                "baseline_value": None,
                "expected_delta": 9.1,
                "objective_risks": [],
                "cycles_required": 3,
                "status": "candidate_assessed",
                "decided_at": "2026-03-06T10:00:20Z",
            }

        def upsert_assessment(_payload: dict) -> None:
            raise RuntimeError("db timeout")

        def set_status(source_key: str, from_status: str, to_status: str) -> bool:
            statuses.append((source_key, from_status, to_status))
            return True

        summary = runner.process_candidates(
            pending,
            config=cfg,
            claim_candidate=claim_candidate,
            assess_fn=assess_fn,
            upsert_assessment=upsert_assessment,
            set_status=set_status,
            send_reply=None,
        )

        self.assertEqual(summary["processed"], 0)
        self.assertEqual(len(summary["errors"]), 1)
        self.assertIn("db timeout", summary["errors"][0]["error"])
        self.assertEqual(statuses, [("telegram:2:1", "processing", "candidate_received")])

    def test_process_candidates_supports_keyword_only_set_status(self):
        pending = [
            {
                "candidate_id": "cand_kw",
                "source_key": "telegram:3:1",
                "telegram_chat_id": "42",
                "telegram_message_id": "100",
                "text": "candidate",
                "links": [],
            }
        ]
        cfg = runner.RunnerConfig(
            batch_limit=10,
            baseline_volatility=0.2,
            uplift_threshold=5.0,
            target_metric="recommendation_action_rate",
            task_id="candidate-ab-task",
            run_id="run-3",
            cutoff_iso="2026-03-06T10:00:00Z",
            reply_enabled=False,
            dry_run=False,
        )

        def claim_candidate(_source_key: str) -> bool:
            return True

        def assess_fn(_candidate: dict) -> dict:
            return {
                "candidate_id": "cand_kw",
                "decision": "candidate_rejected",
                "applicability": "low",
                "target_metric": "recommendation_action_rate",
                "baseline_value": None,
                "expected_delta": 2.0,
                "objective_risks": [],
                "cycles_required": 5,
                "status": "candidate_rejected",
                "decided_at": "2026-03-06T10:00:30Z",
            }

        def upsert_assessment(_payload: dict) -> None:
            return None

        calls: list[tuple[str, str, str]] = []

        def set_status(*, source_key: str, from_status: str, to_status: str) -> bool:
            calls.append((source_key, from_status, to_status))
            return True

        summary = runner.process_candidates(
            pending,
            config=cfg,
            claim_candidate=claim_candidate,
            assess_fn=assess_fn,
            upsert_assessment=upsert_assessment,
            set_status=set_status,
            send_reply=None,
        )

        self.assertEqual(summary["processed"], 1)
        self.assertEqual(calls, [("telegram:3:1", "processing", "candidate_rejected")])

    def test_build_assessor_uses_external_decisions(self):
        cfg = runner.RunnerConfig(
            batch_limit=10,
            baseline_volatility=0.2,
            uplift_threshold=5.0,
            target_metric="recommendation_action_rate",
            task_id="candidate-ab-task",
            run_id="run-4",
            cutoff_iso="2026-03-06T10:00:00Z",
            reply_enabled=False,
            dry_run=False,
        )
        candidate = {
            "candidate_id": "cand_ext",
            "source_key": "telegram:9:9",
            "text": "candidate text",
            "links": ["https://example.com"],
        }
        decisions = {
            "source_key:telegram:9:9": {
                "candidate_id": "cand_ext",
                "source_key": "telegram:9:9",
                "decision": "accept_for_ab",
                "applicability": "high",
                "target_metric": "recommendation_action_rate",
                "expected_delta": 12.5,
                "cycles_required": 4,
                "objective_risks": [],
            }
        }
        assessor = runner.build_assessor(cfg, decisions_by_key=decisions)
        result = assessor(candidate)
        self.assertEqual(result["decision"], "accept_for_ab")
        self.assertEqual(result["status"], "candidate_assessed")
        self.assertEqual(result["cycles_required"], 4)
        self.assertEqual(result["expected_delta"], 12.5)

    def test_load_decisions_reads_expected_contract(self):
        payload = {
            "decisions": [
                {
                    "candidate_id": "cand_a",
                    "source_key": "telegram:1:1",
                    "decision": "candidate_rejected",
                }
            ]
        }
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "decisions.json"
            path.write_text(json.dumps(payload), encoding="utf-8")
            loaded = runner.load_decisions(str(path))
        self.assertIn("candidate_id:cand_a", loaded)
        self.assertIn("source_key:telegram:1:1", loaded)


if __name__ == "__main__":
    unittest.main()
