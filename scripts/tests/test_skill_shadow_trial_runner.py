from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "skill_shadow_trial_runner.py"
    spec = importlib.util.spec_from_file_location("skill_shadow_trial_runner", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


runner = _load_module()


class SkillShadowTrialRunnerTests(unittest.TestCase):
    def test_build_trial_plan_marks_official_candidate_as_eligible(self):
        registry = {
            "agents": [
                {
                    "id": "analyst-agent",
                    "usedSkills": [
                        {
                            "name": "doc",
                            "practicalTasks": ["ADR for analytics workflow"],
                            "qualitySignals": {
                                "descriptionCompletenessScore": 88,
                                "reviewStatus": "approved",
                                "recommendation": "keep_current",
                            },
                        }
                    ],
                    "availableSkills": [],
                    "skillSourceRegistry": [
                        {
                            "id": "openai-guidance",
                            "title": "OpenAI Platform Docs",
                            "url": "https://platform.openai.com/docs/guides/tools",
                            "trust": "official",
                            "kind": "official_docs",
                            "description": "Trusted source",
                            "usagePolicy": "official-first",
                        }
                    ],
                    "externalSkillCandidates": [
                        {
                            "id": "cand-openai-docs",
                            "name": "openai-docs",
                            "sourceId": "openai-guidance",
                            "sourceTitle": "OpenAI Platform Docs",
                            "trust": "official",
                            "summary": "Use official docs for OpenAI-specific answers.",
                            "targetSkills": ["doc"],
                            "recommendation": "trial_alternative",
                            "trialStatus": "scheduled",
                            "promotionStatus": "human_review_required",
                            "decisionGuidance": {
                                "examples": ["Compare OpenAI docs against local guidance"]
                            },
                        }
                    ],
                }
            ]
        }

        plan = runner.build_trial_plan(registry, "analyst-agent", 3)

        self.assertEqual(plan["summary"]["eligible_total"], 1)
        self.assertEqual(plan["summary"]["blocked_total"], 0)
        trial = plan["trials"][0]
        self.assertTrue(trial["eligible"])
        self.assertEqual(trial["baseline_skill"]["name"], "doc")
        self.assertEqual(trial["source"]["trust"], "official")
        self.assertIn("ADR for analytics workflow", trial["representative_tasks"])

    def test_build_trial_plan_blocks_discovery_only_candidate(self):
        registry = {
            "agents": [
                {
                    "id": "analyst-agent",
                    "usedSkills": [{"name": "doc"}],
                    "skillSourceRegistry": [
                        {
                            "id": "skills-sh",
                            "title": "skills.sh",
                            "url": "https://skills.sh/",
                            "trust": "discovery_only",
                            "kind": "catalog_index",
                            "description": "Index only",
                            "usagePolicy": "No direct trust",
                        }
                    ],
                    "externalSkillCandidates": [
                        {
                            "id": "cand-catalog-only",
                            "name": "some-skill",
                            "sourceId": "skills-sh",
                            "sourceTitle": "skills.sh",
                            "trust": "discovery_only",
                            "summary": "Catalog-only skill",
                            "targetSkills": ["doc"],
                            "recommendation": "trial_alternative",
                            "trialStatus": "scheduled",
                            "promotionStatus": "human_review_required",
                        }
                    ],
                }
            ]
        }

        plan = runner.build_trial_plan(registry, "analyst-agent", 2)

        self.assertEqual(plan["summary"]["eligible_total"], 0)
        self.assertEqual(plan["summary"]["blocked_total"], 1)
        self.assertIn("untrusted_source:discovery_only", plan["trials"][0]["block_reasons"])

    def test_judge_trial_result_promotes_when_shadow_is_better_without_blockers(self):
        payload = {
            "trial_id": "trial-1",
            "candidate_id": "cand-openai-docs",
            "agent_id": "analyst-agent",
            "baseline_skill": {
                "contract_score": 88,
            },
            "baseline": {
                "taskSuccessRate": 82,
                "verificationPassRate": 90,
                "timeToSolutionMin": 20,
                "tokenCostPerCompletedTask": 1.0,
                "fallbackRate": 14,
                "humanCorrectionRate": 10,
            },
            "shadow": {
                "taskSuccessRate": 86,
                "verificationPassRate": 93,
                "timeToSolutionMin": 18,
                "tokenCostPerCompletedTask": 1.05,
                "fallbackRate": 9,
                "humanCorrectionRate": 7,
            },
        }

        result = runner.judge_trial_result(payload, runner.TrialGateThresholds())

        self.assertEqual(result["recommendation"], "replace_after_trial")
        self.assertEqual(result["blockers"], [])
        self.assertTrue(result["human_approval_required"])

    def test_judge_trial_result_falls_back_to_rewrite_current_on_blocker_and_weak_contract(self):
        payload = {
            "trial_id": "trial-2",
            "candidate_id": "cand-failed",
            "agent_id": "analyst-agent",
            "baseline_skill": {
                "contract_score": 62,
            },
            "baseline": {
                "taskSuccessRate": 88,
                "verificationPassRate": 94,
                "timeToSolutionMin": 18,
            },
            "shadow": {
                "taskSuccessRate": 76,
                "verificationPassRate": 80,
                "timeToSolutionMin": 25,
            },
        }

        result = runner.judge_trial_result(payload, runner.TrialGateThresholds())

        self.assertEqual(result["recommendation"], "rewrite_current")
        self.assertIn("task_success_rate", result["blockers"])
        self.assertIn("verification_pass_rate", result["blockers"])

    def test_judge_trial_result_blocks_promotion_when_sample_size_is_too_small(self):
        payload = {
            "trial_id": "trial-3",
            "candidate_id": "cand-playwright",
            "agent_id": "analyst-agent",
            "task_id": "task-20260306-work-contour-model",
            "sample_size": 1,
            "evidence_note": "Single manual Playwright shadow-run for capability comparison modal.",
            "evidence_refs": [
                "artifacts/skill_shadow_trial_plan.json",
                "Playwright MCP manual verification of #/agents capability modal",
            ],
            "baseline_skill": {
                "contract_score": 84,
            },
            "baseline": {
                "taskSuccessRate": None,
                "verificationPassRate": None,
                "timeToSolutionMin": None,
            },
            "shadow": {
                "taskSuccessRate": 100,
                "verificationPassRate": 100,
                "timeToSolutionMin": 2.0,
            },
        }

        result = runner.judge_trial_result(payload, runner.TrialGateThresholds())

        self.assertEqual(result["recommendation"], "keep_current")
        self.assertIn("insufficient_sample_size:1/3", result["blockers"])
        self.assertEqual(result["sample_size"], 1)
        self.assertEqual(result["task_id"], "task-20260306-work-contour-model")

    def test_refresh_agent_capabilities_writes_plan_and_snapshot_for_agent(self):
        registry = {
            "agents": [
                {
                    "id": "analyst-agent",
                    "capabilityOptimization": {
                        "enabled": True,
                        "refreshMode": "on_run",
                        "sourcePolicy": "official_first",
                        "trialMode": "shadow",
                        "promotionMode": "human_approve",
                        "minShadowSampleSize": 3,
                        "staleAfterHours": 168,
                    },
                    "usedSkills": [
                        {
                            "name": "doc",
                            "skillFilePath": "/Users/pavelantipov/.codex/skills/doc/SKILL.md",
                            "decisionGuidance": {
                                "useWhen": "Когда нужен локальный Markdown/source-of-truth контекст."
                            },
                            "qualitySignals": {
                                "reviewStatus": "approved",
                                "descriptionCompletenessScore": 88,
                                "recommendation": "keep_current",
                            },
                        }
                    ],
                    "availableSkills": [],
                    "usedTools": [],
                    "availableTools": [],
                    "usedMcp": [],
                    "availableMcp": [],
                    "rulesApplied": [],
                    "skillSourceRegistry": [
                        {
                            "id": "openai-guidance",
                            "title": "OpenAI Platform Docs",
                            "url": "https://platform.openai.com/docs/guides/tools",
                            "trust": "official",
                            "kind": "official_docs",
                            "description": "Trusted source",
                            "usagePolicy": "official-first",
                        }
                    ],
                    "externalSkillCandidates": [
                        {
                            "id": "cand-openai-docs",
                            "name": "openai-docs",
                            "sourceId": "openai-guidance",
                            "sourceTitle": "OpenAI Platform Docs",
                            "trust": "official",
                            "summary": "Use official docs for OpenAI-specific answers.",
                            "targetSkills": ["doc"],
                            "recommendation": "trial_alternative",
                            "trialStatus": "scheduled",
                            "promotionStatus": "human_review_required",
                            "decisionGuidance": {},
                        }
                    ],
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            original_root_dir = runner.ROOT_DIR
            original_trials_dir = runner.DEFAULT_CAPABILITY_TRIALS_DIR
            original_default_registry = runner.DEFAULT_REGISTRY_PATH
            try:
                runner.ROOT_DIR = root
                runner.DEFAULT_CAPABILITY_TRIALS_DIR = root / "artifacts" / "capability_trials"
                runner.DEFAULT_REGISTRY_PATH = root / "docs" / "agents" / "registry.yaml"
                result = runner.refresh_agent_capabilities(
                    registry=registry,
                    agent_id="analyst-agent",
                    last_run_id="run-analyst-1",
                    tasks_per_trial=3,
                )
            finally:
                runner.ROOT_DIR = original_root_dir
                runner.DEFAULT_CAPABILITY_TRIALS_DIR = original_trials_dir
                runner.DEFAULT_REGISTRY_PATH = original_default_registry

            snapshot_path = root / result["snapshot_path"]
            plan_path = root / result["plan_path"]
            self.assertTrue(snapshot_path.exists())
            self.assertTrue(plan_path.exists())

            snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
            self.assertEqual(snapshot["agentId"], "analyst-agent")
            self.assertEqual(snapshot["lastRunId"], "run-analyst-1")
            self.assertEqual(snapshot["freshnessStatus"], "fresh")
            self.assertEqual(snapshot["refreshMode"], "on_run")
            self.assertGreater(len(snapshot["tableRows"]), 0)
            self.assertEqual(snapshot["tableRows"][0]["decisionStatus"], "trial_alternative")

    def test_cli_plan_writes_json_report(self):
        registry = {
            "agents": [
                {
                    "id": "analyst-agent",
                    "usedSkills": [{"name": "doc"}],
                    "skillSourceRegistry": [],
                    "externalSkillCandidates": [],
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            registry_path = Path(tmp_dir) / "registry.yaml"
            out_path = Path(tmp_dir) / "plan.json"
            registry_path.write_text(json.dumps(registry, ensure_ascii=False), encoding="utf-8")
            code = runner.main.__wrapped__ if hasattr(runner.main, "__wrapped__") else None
            self.assertIsNone(code)
            loaded = runner.load_registry(registry_path)
            plan = runner.build_trial_plan(loaded, "analyst-agent", 2)
            runner.write_json(out_path, plan)
            written = json.loads(out_path.read_text(encoding="utf-8"))

        self.assertEqual(written["agent_id"], "analyst-agent")
        self.assertEqual(written["summary"]["candidates_total"], 0)


if __name__ == "__main__":
    unittest.main()
