#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONTRACT = REPO_ROOT / ".specify/specs/001-oap/contracts/verification.yaml"
DEFAULT_SPEC = REPO_ROOT / ".specify/specs/001-oap/spec.md"
DEFAULT_README = REPO_ROOT / "README.md"
DEFAULT_CI = REPO_ROOT / ".github/workflows/ci.yml"
CONTRACT_REFERENCE = "/.specify/specs/001-oap/contracts/verification.yaml"


def load_verification_contract(path: Path) -> list[str]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    commands = payload.get("commands")
    if not isinstance(commands, list) or not all(isinstance(item, str) and item.strip() for item in commands):
        raise ValueError(f"invalid_verification_contract:{path}")
    return [item.strip() for item in commands]


def spec_references_contract(path: Path) -> bool:
    inside_runbook = False
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "## 7. Verification Runbook":
            inside_runbook = True
            continue
        if inside_runbook and stripped.startswith("## "):
            break
        if inside_runbook and CONTRACT_REFERENCE in stripped:
            return True
    return False


def parse_readme_commands(path: Path, expected_commands: list[str]) -> list[str]:
    commands: list[str] = []
    inside_code_block = False
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped == "```bash":
            inside_code_block = True
            continue
        if inside_code_block and stripped == "```":
            inside_code_block = False
            continue
        if inside_code_block and any(stripped.startswith(prefix) for prefix in ("npm --prefix ops-web run ", "python3 -m unittest", "python3 -m py_compile")):
            commands.append(stripped)
    relevant = [command for command in commands if command in expected_commands]
    return relevant


def parse_ci_commands(path: Path, expected_commands: list[str]) -> list[str]:
    commands: list[str] = []
    pattern = re.compile(r"^\s*run:\s*(.+)$")
    for line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line)
        if not match:
            continue
        command = match.group(1).strip()
        if command in expected_commands:
            commands.append(command)
    return commands


def validate_contract(spec_has_contract_reference: bool, readme_commands: list[str], ci_commands: list[str], expected_commands: list[str]) -> list[str]:
    errors: list[str] = []
    if not spec_has_contract_reference:
        errors.append(f"spec must reference canonical verification contract: {CONTRACT_REFERENCE}")

    for name, commands in {
        "README": readme_commands,
        "CI": ci_commands,
    }.items():
        missing = [command for command in expected_commands if command not in commands]
        extra = [command for command in commands if command not in expected_commands]
        if missing:
            errors.append(f"{name} missing commands: {', '.join(missing)}")
        if extra:
            errors.append(f"{name} unexpected commands: {', '.join(extra)}")

    if readme_commands != expected_commands:
        errors.append("README command order mismatch with canonical verification contract")
    if ci_commands != expected_commands:
        errors.append("CI command order mismatch with canonical verification contract")

    return errors


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate verification command parity between spec, README, and CI.")
    parser.add_argument("--contract", default=str(DEFAULT_CONTRACT))
    parser.add_argument("--spec", default=str(DEFAULT_SPEC))
    parser.add_argument("--readme", default=str(DEFAULT_README))
    parser.add_argument("--ci", default=str(DEFAULT_CI))
    parser.add_argument("--json", action="store_true", dest="json_output")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    contract_path = Path(args.contract)
    spec_path = Path(args.spec)
    readme_path = Path(args.readme)
    ci_path = Path(args.ci)

    expected_commands = load_verification_contract(contract_path)
    spec_has_contract_reference = spec_references_contract(spec_path)
    readme_commands = parse_readme_commands(readme_path, expected_commands)
    ci_commands = parse_ci_commands(ci_path, expected_commands)
    errors = validate_contract(spec_has_contract_reference, readme_commands, ci_commands, expected_commands)

    if args.json_output:
        print(
            json.dumps(
                {
                    "contract": str(contract_path),
                    "specHasContractReference": spec_has_contract_reference,
                    "readme": readme_commands,
                    "ci": ci_commands,
                    "expected": expected_commands,
                    "errors": errors,
                    "ok": not errors,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        if errors:
            print("[validate-verification-contract] failed")
            for error in errors:
                print(f"- {error}")
        else:
            print("[validate-verification-contract] ok: spec, README, and CI share the same verification contract")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())