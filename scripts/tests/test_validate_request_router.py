from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import textwrap
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "validate_request_router.py"
    spec = importlib.util.spec_from_file_location("validate_request_router", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


router = _load_module()


class ValidateRequestRouterTests(unittest.TestCase):
    def test_load_router_contract_extracts_routes(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "contract.yaml"
            path.write_text(
                textwrap.dedent(
                    """
                    {
                        "origins": ["user_chat", "automation"],
                        "capabilities": ["rules", "session_state", "tools"],
                        "fallback": {
                            "unknownDomain": "capability_first",
                            "conflictingDomain": "capability_first_with_escalation",
                            "missingCapabilities": "authority_then_repo_ops"
                        },
                        "domains": [
                            {"id": "agent-card/content"},
                            {"id": "repo-ops"}
                        ],
                        "routes": [
                            {
                                "id": "ui_card_content",
                                "origin": "user_chat",
                                "domain": "agent-card/content",
                                "capabilities": ["rules", "session_state"],
                                "readFirst": ["a"],
                                "verify": ["b"]
                            },
                            {
                                "id": "docs_search_index_refresh",
                                "origin": "automation",
                                "domain": "repo-ops",
                                "capabilities": ["tools", "session_state"],
                                "readFirst": ["a"],
                                "verify": ["b"]
                            }
                        ]
                    }
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            contract = router.load_router_contract(path)

            self.assertEqual(len(contract["routes"]), 2)
            self.assertEqual(contract["routes"][0]["capabilities"], ["rules", "session_state"])

    def test_validate_router_contract_reports_unknown_domain_and_duplicate_id(self):
        contract = {
            "origins": ["user_chat"],
            "capabilities": ["rules", "session_state"],
            "fallback": {
                "unknownDomain": "capability_first",
                "conflictingDomain": "capability_first_with_escalation",
                "missingCapabilities": "authority_then_repo_ops",
            },
            "domains": [{"id": "agent-card/content"}],
            "routes": [
                {
                    "id": "ui_card_content",
                    "origin": "user_chat",
                    "domain": "agent-card/content",
                    "capabilities": ["rules", "session_state"],
                    "readFirst": ["a"],
                    "verify": ["b"],
                },
                {
                    "id": "ui_card_content",
                    "origin": "user_chat",
                    "domain": "unknown-domain",
                    "capabilities": ["rules", "session_state"],
                    "readFirst": ["a"],
                    "verify": ["b"],
                },
            ],
        }

        errors = router.validate_router_contract(contract)

        self.assertTrue(any("unknown domain" in item for item in errors))
        self.assertTrue(any("route ids must be unique" in item for item in errors))

    def test_validate_router_contract_accepts_valid_contract(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "contract.yaml"
            path.write_text(
                textwrap.dedent(
                    """
                    {
                        "origins": ["user_chat"],
                        "capabilities": ["rules", "session_state"],
                        "fallback": {
                            "unknownDomain": "capability_first",
                            "conflictingDomain": "capability_first_with_escalation",
                            "missingCapabilities": "authority_then_repo_ops"
                        },
                        "domains": [{"id": "agent-card/content"}],
                        "routes": [
                            {
                                "id": "ui_card_content",
                                "origin": "user_chat",
                                "domain": "agent-card/content",
                                "capabilities": ["rules", "session_state"],
                                "readFirst": ["a"],
                                "verify": ["b"]
                            }
                        ]
                    }
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )
            contract = router.load_router_contract(path)
            errors = router.validate_router_contract(contract)

            self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()