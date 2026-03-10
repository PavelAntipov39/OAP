from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile
import textwrap
import unittest


def _load_module():
    root = Path(__file__).resolve().parents[2]
    target = root / "scripts" / "validate_verification_contract.py"
    spec = importlib.util.spec_from_file_location("validate_verification_contract", target)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)  # type: ignore[attr-defined]
    return module


verification = _load_module()


class ValidateVerificationContractTests(unittest.TestCase):
    def test_spec_references_contract(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "spec.md"
            path.write_text(
                textwrap.dedent(
                    """
                    ## 7. Verification Runbook
                    - Canonical verification contract: `/.specify/specs/001-oap/contracts/verification.yaml`

                    CI merge-gate:
                    - same commands
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )

            has_reference = verification.spec_references_contract(path)

        self.assertTrue(has_reference)

    def test_load_verification_contract_extracts_commands(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "verification.yaml"
            path.write_text(
                textwrap.dedent(
                    """
                    {
                      "commands": [
                        "npm --prefix ops-web run check",
                        "npm --prefix ops-web run test:e2e:smoke",
                        "python3 -m unittest discover -s scripts/tests -p 'test_*.py'",
                        "python3 -m py_compile scripts/agent_telemetry.py scripts/sync_agent_tasks.py scripts/agent_orchestration.py scripts/validate_request_router.py scripts/validate_agent_operating_plans.py scripts/validate_verification_contract.py"
                      ]
                    }
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )

            commands = verification.load_verification_contract(path)

        self.assertEqual(len(commands), 4)

    def test_parse_readme_commands_extracts_expected_commands(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "README.md"
            path.write_text(
                textwrap.dedent(
                    """
                    ```bash
                    npm --prefix ops-web run check
                    ```

                    ```bash
                    npm --prefix ops-web run test:e2e:smoke
                    ```

                    ```bash
                    python3 -m unittest discover -s scripts/tests -p 'test_*.py'
                    python3 -m py_compile scripts/agent_telemetry.py scripts/sync_agent_tasks.py scripts/agent_orchestration.py scripts/validate_request_router.py scripts/validate_agent_operating_plans.py scripts/validate_verification_contract.py
                    ```
                    """
                ).strip()
                + "\n",
                encoding="utf-8",
            )

            expected = [
                "npm --prefix ops-web run check",
                "npm --prefix ops-web run test:e2e:smoke",
                "python3 -m unittest discover -s scripts/tests -p 'test_*.py'",
                "python3 -m py_compile scripts/agent_telemetry.py scripts/sync_agent_tasks.py scripts/agent_orchestration.py scripts/validate_request_router.py scripts/validate_agent_operating_plans.py scripts/validate_verification_contract.py",
            ]
            commands = verification.parse_readme_commands(path, expected)

        self.assertEqual(commands, expected)

    def test_validate_contract_reports_missing_command(self):
        expected = [
            "npm --prefix ops-web run check",
            "npm --prefix ops-web run test:e2e:smoke",
            "python3 -m unittest discover -s scripts/tests -p 'test_*.py'",
            "python3 -m py_compile scripts/agent_telemetry.py scripts/sync_agent_tasks.py scripts/agent_orchestration.py scripts/validate_request_router.py scripts/validate_agent_operating_plans.py scripts/validate_verification_contract.py",
        ]
        readme_commands = expected[:-1]
        ci_commands = expected.copy()

        errors = verification.validate_contract(True, readme_commands, ci_commands, expected)

        self.assertTrue(any("README missing commands" in error for error in errors))
        self.assertTrue(any("README command order mismatch" in error for error in errors))


if __name__ == "__main__":
    unittest.main()