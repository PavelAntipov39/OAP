#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROUTER_CONTRACT = REPO_ROOT / "docs/subservices/oap/REQUEST_ROUTING_CONTRACT.yaml"
REQUIRED_FALLBACK_KEYS = {
    "unknownDomain": "capability_first",
    "conflictingDomain": "capability_first_with_escalation",
    "missingCapabilities": "authority_then_repo_ops",
}


def load_router_contract(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"invalid_router_contract:{path}")
    return payload


def validate_router_contract(contract: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    origins = contract.get("origins")
    capabilities = contract.get("capabilities")
    fallback = contract.get("fallback")
    domains = contract.get("domains")
    routes = contract.get("routes")

    if not isinstance(origins, list) or not all(isinstance(item, str) and item.strip() for item in origins):
        errors.append("contract origins must be a non-empty string list")
    if not isinstance(capabilities, list) or not all(isinstance(item, str) and item.strip() for item in capabilities):
        errors.append("contract capabilities must be a non-empty string list")
    if not isinstance(fallback, dict):
        errors.append("contract fallback must be an object")
    if not isinstance(domains, list) or not all(isinstance(item, dict) for item in domains):
        errors.append("contract domains must be a list of objects")
    if not isinstance(routes, list) or not all(isinstance(item, dict) for item in routes):
        errors.append("contract routes must be a list of objects")
    if errors:
        return errors

    origin_set = {item.strip() for item in origins}
    capability_set = {item.strip() for item in capabilities}
    domain_ids: list[str] = []
    for domain in domains:
        domain_id = str(domain.get("id") or "").strip()
        if not domain_id:
            errors.append("domain entry missing id")
            continue
        domain_ids.append(domain_id)
    if len(set(domain_ids)) != len(domain_ids):
        errors.append("domain ids must be unique")
    domain_set = set(domain_ids)

    for key, expected_value in REQUIRED_FALLBACK_KEYS.items():
        actual_value = str(fallback.get(key) or "").strip()
        if actual_value != expected_value:
            errors.append(
                f"fallback `{key}` mismatch: expected={expected_value} actual={actual_value or '<missing>'}"
            )

    route_ids: list[str] = []
    for route in routes:
        route_id = str(route.get("id") or "").strip()
        origin = str(route.get("origin") or "").strip()
        domain = str(route.get("domain") or "").strip()
        route_capabilities = route.get("capabilities")
        read_first = route.get("readFirst")
        verify = route.get("verify")

        if not route_id:
            errors.append("route entry missing id")
            continue
        route_ids.append(route_id)
        if origin not in origin_set:
            errors.append(f"route `{route_id}` uses unknown origin: {origin or '<missing>'}")
        if domain not in domain_set:
            errors.append(f"route `{route_id}` uses unknown domain: {domain or '<missing>'}")
        if not isinstance(route_capabilities, list) or not route_capabilities:
            errors.append(f"route `{route_id}` capabilities must be a non-empty list")
        else:
            unknown_capabilities = [item for item in route_capabilities if not isinstance(item, str) or item not in capability_set]
            if unknown_capabilities:
                errors.append(f"route `{route_id}` uses unknown capabilities: {unknown_capabilities}")
        if not isinstance(read_first, list) or not read_first:
            errors.append(f"route `{route_id}` must define readFirst")
        if not isinstance(verify, list) or not verify:
            errors.append(f"route `{route_id}` must define verify")

    if len(set(route_ids)) != len(route_ids):
        errors.append("route ids must be unique")

    return errors


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate canonical OAP routing contract.")
    parser.add_argument("--router-contract", default=str(DEFAULT_ROUTER_CONTRACT))
    parser.add_argument("--json", action="store_true", dest="json_output")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    router_contract = Path(args.router_contract)

    contract = load_router_contract(router_contract)
    routes = contract.get("routes") if isinstance(contract.get("routes"), list) else []
    domains = contract.get("domains") if isinstance(contract.get("domains"), list) else []
    errors = validate_router_contract(contract)

    if args.json_output:
        print(
            json.dumps(
                {
                    "routerContract": str(router_contract),
                    "routeIds": [str(item.get("id") or "") for item in routes if isinstance(item, dict)],
                    "domainIds": [str(item.get("id") or "") for item in domains if isinstance(item, dict)],
                    "errors": errors,
                    "ok": not errors,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        if errors:
            print("[validate-request-router] failed")
            for error in errors:
                print(f"- {error}")
        else:
            print(f"[validate-request-router] ok: routes={len(routes)} domains={len(domains)} canonical contract is valid")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())