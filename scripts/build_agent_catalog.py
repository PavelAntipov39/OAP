#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from agent_plan_metadata import extract_active_agents, load_active_agent_entries, load_json


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = REPO_ROOT / "docs/agents/registry.yaml"
DEFAULT_AGENTS_ROOT = REPO_ROOT / "docs/subservices/oap/agents"
DEFAULT_OUTPUT = REPO_ROOT / "docs/agents/host_agnostic_agent_catalog.yaml"

def build_catalog(registry_path: Path, agents_root: Path) -> dict[str, Any]:
    agents = load_active_agent_entries(registry_path, agents_root)
    return {
        "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source": "generated-from-operating-plans",
        "version": "v2",
        "sourceRefs": {
            "registry": "docs/agents/registry.yaml",
            "operatingPlansRoot": "docs/subservices/oap/agents",
            "governance": ".specify/specs/001-oap/spec.md",
            "generator": "scripts/build_agent_catalog.py",
        },
        "agents": agents,
    }


def serialize_catalog(payload: dict[str, Any]) -> str:
    return f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n"


def catalogs_equivalent(left: dict[str, Any], right: dict[str, Any]) -> bool:
    def normalize(value: dict[str, Any]) -> dict[str, Any]:
        return {key: item for key, item in value.items() if key != "updatedAt"}

    return normalize(left) == normalize(right)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build compatibility-only host catalog from operating plans.")
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    parser.add_argument("--agents-root", default=str(DEFAULT_AGENTS_ROOT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--stdout", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--json", action="store_true", dest="json_output")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    registry_path = Path(args.registry)
    agents_root = Path(args.agents_root)
    output_path = Path(args.output)

    payload = build_catalog(registry_path, agents_root)
    serialized = serialize_catalog(payload)

    if args.check:
        try:
            current_payload = load_json(output_path)
        except OSError:
            current_payload = None
        ok = isinstance(current_payload, dict) and catalogs_equivalent(current_payload, payload)
        if args.json_output:
            print(
                json.dumps(
                    {
                        "ok": ok,
                        "output": str(output_path),
                        "agentCount": len(payload.get("agents", [])),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
        elif not ok:
            print(f"[build-agent-catalog] stale: {output_path}")
        return 0 if ok else 1

    if args.stdout:
        sys.stdout.write(serialized)
        return 0

    try:
        current_payload = load_json(output_path)
    except OSError:
        current_payload = None

    if not (isinstance(current_payload, dict) and catalogs_equivalent(current_payload, payload)):
        output_path.write_text(serialized, encoding="utf-8")

    if args.json_output:
        print(
            json.dumps(
                {
                    "ok": True,
                    "output": str(output_path),
                    "agentCount": len(payload.get("agents", [])),
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print(f"[build-agent-catalog] wrote {output_path} agents={len(payload.get('agents', []))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())