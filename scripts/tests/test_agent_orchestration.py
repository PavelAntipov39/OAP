from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "agent_orchestration.py"
    spec = importlib.util.spec_from_file_location("agent_orchestration", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


orch = _load_module()


class AgentOrchestrationTests(unittest.TestCase):
    def test_reuse_existing_profile_when_fit_is_sufficient(self):
        registry = {
            "agents": [
                {
                    "id": "designer-agent",
                    "name": "Designer",
                    "role": "UI specialist",
                    "usedSkills": [{"name": "playwright"}],
                    "usedTools": [{"name": "Browser verification"}],
                    "usedMcp": [{"name": "playwright"}],
                    "rulesApplied": [{"title": "OAP Design Rule"}],
                }
            ]
        }
        plan, created_profiles = orch.build_collaboration_plan(
            task_id="rec:analyst:ui-tooltip",
            root_agent_id="analyst-agent",
            purpose="Validate tooltip behavior in UI",
            hint_text="ui tooltip playwright verification",
            registry=registry,
            suggested_agents=["designer-agent"],
            target_metric="ux_clarity_score",
            owner_section="UI",
        )
        self.assertEqual(plan["strategy"], "reuse_existing")
        self.assertEqual(created_profiles, [])
        self.assertGreaterEqual(len(plan["reuse_candidates"]), 1)
        self.assertGreaterEqual(len(plan["spawned_instances"]), 1)
        self.assertTrue(any(item["profile_id"] == "designer-agent" for item in plan["spawned_instances"]))
        self.assertEqual(plan["interaction_mode"], "mixed_phased")
        self.assertEqual(plan["primary_coordinator_agent_id"], "analyst-agent")

    def test_create_profile_from_template_when_no_reuse_candidate(self):
        template_payload = {
            "templates": [
                {
                    "id": "retrieval-audit",
                    "name": "Retrieval Audit Specialist",
                    "specializationScope": "Audit retrieval evidence quality",
                    "defaultSkills": ["doc"],
                    "defaultTools": ["QMD retrieval"],
                    "defaultMcp": ["qmd"],
                    "defaultRules": ["QMD Retrieval Policy"],
                    "capabilityContract": {
                        "mission": "Validate retrieval quality.",
                        "entryCriteria": ["Task requires retrieval audit."],
                        "doneCondition": "Evidence map is validated.",
                        "outputSchema": "retrieval_audit_report.v1",
                    },
                }
            ]
        }
        with tempfile.TemporaryDirectory() as tmp_dir:
            catalog_path = Path(tmp_dir) / "templates.yaml"
            catalog_path.write_text(json.dumps(template_payload, ensure_ascii=False), encoding="utf-8")
            plan, created_profiles = orch.build_collaboration_plan(
                task_id="imp:reader:evidence-check",
                root_agent_id="analyst-agent",
                purpose="Audit retrieval evidence map",
                hint_text="retrieval evidence qmd quality check",
                registry={"agents": []},
                suggested_agents=[],
                target_metric="evidence_link_coverage",
                owner_section="Memory and context",
                template_catalog_path=catalog_path,
            )

        self.assertIn(plan["strategy"], {"create_new", "mixed"})
        self.assertEqual(len(created_profiles), 1)
        self.assertEqual(len(plan["created_profiles"]), 1)
        self.assertTrue(any(item["profile_id"] == created_profiles[0]["id"] for item in plan["spawned_instances"]))
        self.assertTrue(any(item["verify_status"] == "pending" for item in plan["spawned_instances"]))
        self.assertEqual(plan["interaction_mode"], "mixed_phased")
        self.assertTrue(any(phase["mode"] == "roundtable" for phase in plan["interaction_phases"]))
        self.assertTrue(any(item.get("phase_id") == "phase_3_roundtable" for item in plan["spawned_instances"]))

    def test_duplicate_specialist_is_reused_by_scope_and_tool_envelope(self):
        template_payload = {
            "templates": [
                {
                    "id": "retrieval-audit",
                    "name": "Retrieval Audit Specialist",
                    "specializationScope": "Audit retrieval evidence quality",
                    "defaultSkills": ["doc"],
                    "defaultTools": ["QMD retrieval"],
                    "defaultMcp": ["qmd"],
                    "defaultRules": ["QMD Retrieval Policy"],
                    "capabilityContract": {
                        "mission": "Validate retrieval quality.",
                        "entryCriteria": ["Task requires retrieval audit."],
                        "doneCondition": "Evidence map is validated.",
                        "outputSchema": "retrieval_audit_report.v1",
                    },
                }
            ]
        }
        registry = {
            "agents": [
                {
                    "id": "specialist-retrieval-existing",
                    "name": "Retrieval Specialist",
                    "role": "Specialist",
                    "specializationScope": "Audit retrieval evidence quality",
                    "lifecycle": "active",
                    "usedSkills": [{"name": "doc"}],
                    "usedTools": [{"name": "QMD retrieval"}],
                    "usedMcp": [{"name": "qmd"}],
                    "rulesApplied": [{"title": "QMD Retrieval Policy"}],
                }
            ]
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            catalog_path = Path(tmp_dir) / "templates.yaml"
            catalog_path.write_text(json.dumps(template_payload, ensure_ascii=False), encoding="utf-8")
            plan, created_profiles = orch.build_collaboration_plan(
                task_id="imp:reader:generic-audit",
                root_agent_id="analyst-agent",
                purpose="Generic audit execution",
                hint_text="generic task without specialist overlap hints",
                registry=registry,
                suggested_agents=[],
                target_metric="",
                owner_section="",
                template_catalog_path=catalog_path,
            )

        self.assertEqual(created_profiles, [])
        self.assertEqual(plan["created_profiles"], [])
        self.assertTrue(any(item["profile_id"] == "specialist-retrieval-existing" for item in plan["spawned_instances"]))
        self.assertEqual(plan["merge_owner_agent_id"], "analyst-agent")

    def test_low_score_template_does_not_create_dynamic_profile(self):
        template_payload = {
            "templates": [
                {
                    "id": "retrieval-audit",
                    "name": "Retrieval Audit Specialist",
                    "specializationScope": "Audit retrieval evidence quality",
                    "defaultSkills": ["doc"],
                    "defaultTools": ["QMD retrieval"],
                    "defaultMcp": ["qmd"],
                    "defaultRules": ["QMD Retrieval Policy"],
                    "capabilityContract": {
                        "mission": "Validate retrieval quality.",
                        "entryCriteria": ["Task requires retrieval audit."],
                        "doneCondition": "Evidence map is validated.",
                        "outputSchema": "retrieval_audit_report.v1",
                    },
                }
            ]
        }
        with tempfile.TemporaryDirectory() as tmp_dir:
            catalog_path = Path(tmp_dir) / "templates.yaml"
            catalog_path.write_text(json.dumps(template_payload, ensure_ascii=False), encoding="utf-8")
            plan, created_profiles = orch.build_collaboration_plan(
                task_id="imp:reader:weak-template-match",
                root_agent_id="analyst-agent",
                purpose="General cleanup task",
                hint_text="rename one label and tidy docs",
                registry={"agents": []},
                suggested_agents=[],
                target_metric="",
                owner_section="",
                template_catalog_path=catalog_path,
            )

        self.assertEqual(created_profiles, [])
        self.assertEqual(plan["created_profiles"], [])
        self.assertEqual(plan["strategy"], "reuse_existing")
        self.assertFalse(any(str(item.get("profile_id", "")).startswith("specialist-") for item in plan["spawned_instances"]))

    def test_terminology_triggers_prioritize_terminology_consistency_template(self):
        template_payload = {
            "templates": [
                {
                    "id": "retrieval-audit",
                    "name": "Retrieval Audit Specialist",
                    "specializationScope": "Audit retrieval evidence quality",
                    "defaultSkills": ["doc"],
                    "defaultTools": ["QMD retrieval"],
                    "defaultMcp": ["qmd"],
                    "defaultRules": ["QMD Retrieval Policy"],
                    "capabilityContract": {
                        "mission": "Validate retrieval quality.",
                        "entryCriteria": ["Task requires retrieval audit."],
                        "doneCondition": "Evidence map is validated.",
                        "outputSchema": "retrieval_audit_report.v1",
                    },
                },
                {
                    "id": "terminology-consistency-audit",
                    "name": "Terminology Consistency Specialist",
                    "specializationScope": "Validate glossary-driven labels and taxonomy consistency.",
                    "defaultSkills": ["doc"],
                    "defaultTools": ["Terminology consistency audit", "QMD retrieval"],
                    "defaultMcp": ["qmd"],
                    "defaultRules": ["Consistency Sync"],
                    "capabilityContract": {
                        "mission": "Keep labels and taxonomy canonical.",
                        "entryCriteria": ["Task changes labels, chips, or glossary terms."],
                        "doneCondition": "Drifts are detected and canonical labels are enforced.",
                        "outputSchema": "terminology_consistency_report.v1",
                    },
                },
            ]
        }
        with tempfile.TemporaryDirectory() as tmp_dir:
            catalog_path = Path(tmp_dir) / "templates.yaml"
            catalog_path.write_text(json.dumps(template_payload, ensure_ascii=False), encoding="utf-8")
            plan, created_profiles = orch.build_collaboration_plan(
                task_id="imp:reader:chip-taxonomy",
                root_agent_id="analyst-agent",
                purpose="Validate glossary labels for source_kind and semantic_layer chips",
                hint_text="glossary chip semantic_layer source_kind терминология консистентность",
                registry={"agents": []},
                suggested_agents=[],
                target_metric="terminology_consistency_rate",
                owner_section="memory_context",
                template_catalog_path=catalog_path,
            )

        self.assertEqual(len(created_profiles), 1)
        self.assertEqual(created_profiles[0]["parentTemplateId"], "terminology-consistency-audit")
        self.assertIn("Terminology consistency audit", created_profiles[0]["tools"])
        self.assertTrue(any(item["source_template_id"] == "terminology-consistency-audit" for item in plan["spawned_instances"]))


if __name__ == "__main__":
    unittest.main()
