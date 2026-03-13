from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "build_agent_catalog.py"
    spec = importlib.util.spec_from_file_location("build_agent_catalog", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


builder = _load_module()


def plan_frontmatter(agent_id: str, *, kind: str, execution_mode: str = "sequential") -> str:
    github_tools = ["read", "search"]
    if execution_mode != "parallel_read_only":
        github_tools.extend(["edit", "execute"])
    if kind == "top_level":
        github_tools.append("agent")
    payload = {
        "id": agent_id,
        "displayName": agent_id,
        "kind": kind,
        "mission": f"Mission for {agent_id}",
        "useWhen": [f"Use {agent_id}"],
        "avoidWhen": [f"Avoid {agent_id}"],
        "inputContract": f"{agent_id}.input.v1",
        "outputContract": f"{agent_id}.output.v1",
        "allowedSkills": ["doc"],
        "allowedTools": ["QMD retrieval"],
        "allowedMcp": ["qmd"] if kind == "top_level" else [],
        "allowedRules": ["Universal workflow backbone"],
        "handoffTargets": ["reader-agent"] if kind == "top_level" else [],
        "executionMode": execution_mode,
        "supportedHosts": ["codex", "claude_code", "github_copilot"],
        "hostAdapters": {
            "github_copilot": {
                "description": f"Use {agent_id}",
                "tools": github_tools,
                "agents": ["reader-agent"] if kind == "top_level" else [],
            }
        },
        "stopConditions": ["done"],
    }
    return f"---\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n---\n\n# {agent_id}\n"


class BuildAgentCatalogTests(unittest.TestCase):
    def test_extract_active_agents_keeps_registry_order(self):
        registry = {
            "agents": [
                {"id": "orchestrator-agent", "agentClass": "core", "lifecycle": "active"},
                {"id": "draft-agent", "agentClass": "core", "lifecycle": "draft"},
                {"id": "retrieval-audit", "agentClass": "specialist", "lifecycle": "active"},
            ]
        }
        active = builder.extract_active_agents(registry)
        self.assertEqual([item["id"] for item in active], ["orchestrator-agent", "retrieval-audit"])

    def test_build_catalog_derives_fields_from_operating_plans(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            registry_path = root / "registry.yaml"
            agents_root = root / "agents"

            registry_path.write_text(
                json.dumps(
                    {
                        "agents": [
                            {"id": "orchestrator-agent", "agentClass": "core", "lifecycle": "active"},
                            {
                                "id": "retrieval-audit",
                                "agentClass": "specialist",
                                "lifecycle": "active",
                                "parentTemplateId": "retrieval-audit",
                            },
                        ]
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            (agents_root / "orchestrator-agent").mkdir(parents=True)
            (agents_root / "retrieval-audit").mkdir(parents=True)
            (agents_root / "orchestrator-agent" / "OPERATING_PLAN.md").write_text(
                plan_frontmatter("orchestrator-agent", kind="top_level"),
                encoding="utf-8",
            )
            (agents_root / "retrieval-audit" / "OPERATING_PLAN.md").write_text(
                plan_frontmatter("retrieval-audit", kind="runtime_specialist", execution_mode="parallel_read_only"),
                encoding="utf-8",
            )

            catalog = builder.build_catalog(registry_path, agents_root)
            self.assertEqual(catalog["source"], "generated-from-operating-plans")
            self.assertEqual([item["id"] for item in catalog["agents"]], ["orchestrator-agent", "retrieval-audit"])
            self.assertEqual(catalog["agents"][0]["sourceProfileId"], "orchestrator-agent")
            self.assertEqual(catalog["agents"][0]["supportedScopes"], ["repo", "session"])
            self.assertEqual(catalog["agents"][1]["sourceTemplateId"], "retrieval-audit")
            self.assertEqual(catalog["agents"][1]["supportedScopes"], ["session"])

    def test_build_catalog_requires_operating_plan(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            root = Path(tmp_dir)
            registry_path = root / "registry.yaml"
            agents_root = root / "agents"
            registry_path.write_text(
                json.dumps(
                    {"agents": [{"id": "reader-agent", "agentClass": "core", "lifecycle": "active"}]},
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "missing_operating_plan"):
                builder.build_catalog(registry_path, agents_root)


if __name__ == "__main__":
    unittest.main()