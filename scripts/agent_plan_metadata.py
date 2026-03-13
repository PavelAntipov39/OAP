from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
VALID_AGENT_CLASSES = {"core", "specialist"}
VALID_KINDS = {"top_level", "runtime_specialist"}
VALID_EXECUTION_MODES = {"sequential", "parallel_read_only"}
REQUIRED_STRING_FIELDS = [
    "id",
    "displayName",
    "kind",
    "mission",
    "inputContract",
    "outputContract",
    "executionMode",
]
REQUIRED_LIST_FIELDS = [
    "useWhen",
    "avoidWhen",
    "allowedSkills",
    "allowedTools",
    "allowedMcp",
    "allowedRules",
    "handoffTargets",
    "supportedHosts",
    "stopConditions",
]
NON_EMPTY_LIST_FIELDS = [
    "useWhen",
    "avoidWhen",
    "allowedSkills",
    "allowedTools",
    "allowedRules",
    "supportedHosts",
    "stopConditions",
]
REQUIRED_HOST_ADAPTERS = {"github_copilot"}
VALID_GITHUB_COPILOT_TOOLS = {"read", "search", "edit", "execute", "agent"}


def safe_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def safe_list_str(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    seen: set[str] = set()
    for item in value:
        normalized = safe_str(item)
        if not normalized:
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(normalized)
    return result


def load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"invalid_json_object:{path}")
    return payload


def parse_frontmatter(path: Path) -> dict[str, Any]:
    content = path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(content)
    if not match:
        raise ValueError(f"missing_frontmatter:{path}")
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid_frontmatter_json:{path}:{exc.msg}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"invalid_frontmatter_object:{path}")
    return payload


def validate_host_adapters(payload: dict[str, Any], *, path: Path) -> None:
    host_adapters = payload.get("hostAdapters")
    if not isinstance(host_adapters, dict):
        raise ValueError(f"invalid_host_adapters:{path}")

    supported_hosts = {value.lower() for value in safe_list_str(payload.get("supportedHosts"))}
    for host_id in sorted(REQUIRED_HOST_ADAPTERS & supported_hosts):
        host_adapter = host_adapters.get(host_id)
        if not isinstance(host_adapter, dict):
            raise ValueError(f"missing_host_adapter:{path}:{host_id}")
        description = host_adapter.get("description")
        tools = host_adapter.get("tools")
        agents = host_adapter.get("agents")
        if not isinstance(description, str) or not description.strip():
            raise ValueError(f"invalid_host_adapter_field:{path}:{host_id}:description")
        if not isinstance(tools, list) or not tools or not all(isinstance(item, str) and item.strip() for item in tools):
            raise ValueError(f"invalid_host_adapter_field:{path}:{host_id}:tools")
        if not isinstance(agents, list) or not all(isinstance(item, str) and item.strip() for item in agents):
            raise ValueError(f"invalid_host_adapter_field:{path}:{host_id}:agents")
        normalized_tools = safe_list_str(tools)
        invalid_tools = [item for item in normalized_tools if item not in VALID_GITHUB_COPILOT_TOOLS]
        if invalid_tools:
            raise ValueError(f"invalid_host_adapter_tools:{path}:{host_id}:{','.join(invalid_tools)}")
        if safe_list_str(agents) and "agent" not in normalized_tools:
            raise ValueError(f"missing_host_adapter_agent_tool:{path}:{host_id}")


def validate_frontmatter(payload: dict[str, Any], *, agent_id: str, path: Path) -> None:
    for field in REQUIRED_STRING_FIELDS:
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"invalid_frontmatter_field:{path}:{field}")

    for field in REQUIRED_LIST_FIELDS:
        value = payload.get(field)
        if not isinstance(value, list):
            raise ValueError(f"invalid_frontmatter_field:{path}:{field}")
        if not all(isinstance(item, str) and item.strip() for item in value):
            raise ValueError(f"invalid_frontmatter_list_item:{path}:{field}")

    for field in NON_EMPTY_LIST_FIELDS:
        if not payload.get(field):
            raise ValueError(f"empty_frontmatter_list:{path}:{field}")

    if payload.get("id") != agent_id:
        raise ValueError(f"frontmatter_id_mismatch:{path}:{payload.get('id')}!={agent_id}")

    kind = safe_str(payload.get("kind"))
    if kind not in VALID_KINDS:
        raise ValueError(f"invalid_kind:{path}:{kind}")

    execution_mode = safe_str(payload.get("executionMode"))
    if execution_mode not in VALID_EXECUTION_MODES:
        raise ValueError(f"invalid_execution_mode:{path}:{execution_mode}")

    validate_host_adapters(payload, path=path)


def extract_active_agents(registry: dict[str, Any]) -> list[dict[str, Any]]:
    raw_agents = registry.get("agents")
    if not isinstance(raw_agents, list):
        raise ValueError("invalid_registry_agents")

    active_agents: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw_agents:
        if not isinstance(item, dict):
            continue
        agent_id = safe_str(item.get("id"))
        if not agent_id or "-" not in agent_id:
            continue
        lifecycle = safe_str(item.get("lifecycle"))
        if lifecycle and lifecycle != "active":
            continue
        agent_class = safe_str(item.get("agentClass"))
        if agent_class and agent_class not in VALID_AGENT_CLASSES:
            continue
        if agent_id in seen:
            continue
        seen.add(agent_id)
        active_agents.append(item)
    return active_agents


def _supported_scopes(kind: str) -> list[str]:
    return ["repo", "session"] if kind == "top_level" else ["session"]


def build_agent_entry(agent_record: dict[str, Any], agents_root: Path) -> dict[str, Any]:
    agent_id = safe_str(agent_record.get("id"))
    plan_path = agents_root / agent_id / "OPERATING_PLAN.md"
    if not plan_path.exists():
        raise ValueError(f"missing_operating_plan:{plan_path}")

    metadata = parse_frontmatter(plan_path)
    validate_frontmatter(metadata, agent_id=agent_id, path=plan_path)

    agent_class = safe_str(agent_record.get("agentClass"))
    kind = safe_str(metadata.get("kind"))
    if agent_class == "core" and kind != "top_level":
        raise ValueError(f"kind_registry_mismatch:{plan_path}:{kind}!=top_level")
    if agent_class == "specialist" and kind != "runtime_specialist":
        raise ValueError(f"kind_registry_mismatch:{plan_path}:{kind}!=runtime_specialist")

    entry: dict[str, Any] = {
        "id": metadata["id"],
        "displayName": metadata["displayName"],
        "kind": metadata["kind"],
        "mission": metadata["mission"],
        "useWhen": metadata["useWhen"],
        "avoidWhen": metadata["avoidWhen"],
        "inputContract": metadata["inputContract"],
        "outputContract": metadata["outputContract"],
        "allowedSkills": metadata["allowedSkills"],
        "allowedTools": metadata["allowedTools"],
        "allowedMcp": metadata["allowedMcp"],
        "allowedRules": metadata["allowedRules"],
        "handoffTargets": metadata["handoffTargets"],
        "executionMode": metadata["executionMode"],
        "supportedHosts": metadata["supportedHosts"],
        "supportedScopes": _supported_scopes(kind),
        "stopConditions": metadata["stopConditions"],
        "hostAdapters": metadata["hostAdapters"],
    }

    if kind == "top_level":
        entry["sourceProfileId"] = agent_id
    else:
        parent_template_id = safe_str(agent_record.get("parentTemplateId"))
        entry["sourceTemplateId"] = parent_template_id or agent_id

    return entry


def load_active_agent_entries(registry_path: Path, agents_root: Path) -> list[dict[str, Any]]:
    registry = load_json(registry_path)
    active_agents = extract_active_agents(registry)
    return [build_agent_entry(agent_record, agents_root) for agent_record in active_agents]
