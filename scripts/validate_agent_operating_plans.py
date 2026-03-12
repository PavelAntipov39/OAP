#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = REPO_ROOT / "docs/agents/registry.yaml"
DEFAULT_AGENTS_ROOT = REPO_ROOT / "docs/subservices/oap/agents"

DEFAULT_REQUIRED_FILES = ["OPERATING_PLAN.md"]
AGENT_REQUIRED_FILES: dict[str, list[str]] = {
    "analyst-agent": [
        "OPERATING_PLAN.md",
        "CARD_DATA_SOURCES_MAP.md",
        "FLOW.md",
        "CARD_FULL_FLOW.md",
    ],
}
REQUIRED_OPERATING_PLAN_MARKERS = [
    "<!-- contract-marker: baseline-minimum -->",
    "<!-- contract-marker: dynamic-capability-selection -->",
    "<!-- contract-marker: self-improvement-gate -->",
    "<!-- contract-marker: capability-refresh -->",
]


def load_registry(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"invalid_registry:{path}")
    return payload


def extract_agent_ids(registry: dict[str, Any]) -> list[str]:
    raw_agents = registry.get("agents")
    if not isinstance(raw_agents, list):
        return []
    ids: list[str] = []
    seen: set[str] = set()
    for item in raw_agents:
        if not isinstance(item, dict):
            continue
        agent_id = str(item.get("id") or "").strip()
        if not agent_id or not agent_id.endswith("-agent"):
            continue
        if agent_id in seen:
            continue
        seen.add(agent_id)
        ids.append(agent_id)
    return ids


def required_files_for_agent(agent_id: str) -> list[str]:
    return AGENT_REQUIRED_FILES.get(agent_id, DEFAULT_REQUIRED_FILES)


def validate_operating_plan_content(path: Path) -> list[str]:
    try:
        content = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read agent doc: {path} ({exc})"]

    missing_markers = [
        marker
        for marker in REQUIRED_OPERATING_PLAN_MARKERS
        if marker not in content
    ]
    return [
        f"missing operating plan marker: {path} :: {marker}"
        for marker in missing_markers
    ]


def validate_operating_plan_layout(agent_ids: list[str], agents_root: Path) -> list[str]:
    errors: list[str] = []
    for agent_id in agent_ids:
        for relative_name in required_files_for_agent(agent_id):
            expected = agents_root / agent_id / relative_name
            if not expected.exists():
                errors.append(f"missing agent doc: {expected}")
                continue
            if relative_name == "OPERATING_PLAN.md":
                errors.extend(validate_operating_plan_content(expected))
    return errors


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate per-agent operating plan layout.")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    parser.add_argument("--agents-root", default=str(DEFAULT_AGENTS_ROOT))
    parser.add_argument("--json", action="store_true", dest="json_output")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    registry_path = Path(args.registry)
    agents_root = Path(args.agents_root)

    registry = load_registry(registry_path)
    agent_ids = extract_agent_ids(registry)
    errors = validate_operating_plan_layout(agent_ids, agents_root)

    if args.json_output:
        print(
            json.dumps(
                {
                    "registry": str(registry_path),
                    "agentsRoot": str(agents_root),
                    "agentIds": agent_ids,
                    "requiredFiles": {
                        agent_id: required_files_for_agent(agent_id)
                        for agent_id in agent_ids
                    },
                    "errors": errors,
                    "ok": not errors,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        if errors:
            print("[validate-agent-operating-plans] failed")
            for error in errors:
                print(f"- {error}")
        else:
            print(f"[validate-agent-operating-plans] ok: agents={len(agent_ids)} required docs layout is valid")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
