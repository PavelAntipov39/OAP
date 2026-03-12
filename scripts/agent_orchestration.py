#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import hashlib
import json
import re
from pathlib import Path
from typing import Any

DEFAULT_TEMPLATE_CATALOG = Path(__file__).resolve().parents[1] / "docs" / "agents" / "profile_templates.yaml"
DEFAULT_HOST_CAPABILITY_MATRIX = Path(__file__).resolve().parents[1] / "docs" / "agents" / "host_capability_matrix.yaml"
DEFAULT_REUSE_THRESHOLD = 0.45
DEFAULT_INSTANCE_BACKBONE_VERSION = "universal_backbone_v1"
DEFAULT_HOST_ID = "codex"
DEFAULT_CONTEXT_ISOLATION_POLICY = "per_instance_context_package"
DEFAULT_INTERACTION_MODE = "sequential"
ROUNDTABLE_MAX_ROUNDS = 4
TERMINOLOGY_TEMPLATE_ID = "terminology-consistency-audit"
TERMINOLOGY_TRIGGER_TEXT_MARKERS = {
    "glossary",
    "chip",
    "chips",
    "semantic_layer",
    "source_kind",
    "taxonomy",
    "terminology",
    "label",
    "labels",
    "термин",
    "терминолог",
    "консистент",
}
TERMINOLOGY_TRIGGER_TOKEN_MARKERS = {
    "glossary",
    "chip",
    "chips",
    "taxonomy",
    "terminology",
    "label",
    "labels",
    "термин",
    "терминология",
    "консистентность",
}
DEFAULT_ORCHESTRATION_BUDGET = {
    "max_instances": 7,
    "max_tokens": 120000,
    "max_wall_clock_minutes": 45,
    "max_no_progress_hops": 2,
}
READ_ONLY_EXECUTION_MODES = {"parallel_read_only"}
CONTRACT_TRIGGER_TOKEN_MARKERS = {
    "schema",
    "contract",
    "contracts",
    "контракт",
    "payload",
    "routing",
    "manifest",
    "api",
}
DESIGN_TRIGGER_TOKEN_MARKERS = {
    "ui",
    "ux",
    "drawer",
    "tooltip",
    "layout",
    "visual",
    "design",
    "дизайн",
    "интерфейс",
}
TELEMETRY_TRIGGER_TOKEN_MARKERS = {
    "telemetry",
    "trace",
    "otel",
    "metric",
    "metrics",
    "latency",
    "telemetry",
}


def safe_str(value: Any) -> str:
    return str(value).strip() if value is not None else ""


def safe_list_str(value: Any) -> list[str]:
    if isinstance(value, str):
        candidate = safe_str(value)
        return [candidate] if candidate else []
    if not isinstance(value, list):
        return []
    values: list[str] = []
    seen: set[str] = set()
    for item in value:
        normalized = safe_str(item)
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        values.append(normalized)
    return values


def _instance_artifact_paths(instance_id: str) -> dict[str, str]:
    base_dir = f"artifacts/agent_runs/{instance_id}"
    return {
        "run_dir": base_dir,
        "manifest_path": f"{base_dir}/run_manifest.json",
        "result_path": f"{base_dir}/result.json",
    }


def slugify(value: str) -> str:
    normalized = safe_str(value).lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return normalized[:48] if normalized else "agent"


def normalize_tokens(value: str) -> set[str]:
    text = safe_str(value).lower()
    if not text:
        return set()
    parts = re.split(r"[^a-z0-9а-яё]+", text)
    return {part for part in parts if len(part) > 1}


def _is_terminology_consistency_request(requirements: dict[str, Any]) -> bool:
    text = safe_str(requirements.get("text")).lower()
    if any(marker in text for marker in TERMINOLOGY_TRIGGER_TEXT_MARKERS):
        return True
    tokens = requirements.get("tokens") if isinstance(requirements.get("tokens"), set) else set()
    return bool(tokens.intersection(TERMINOLOGY_TRIGGER_TOKEN_MARKERS))


def _capability_from_profile(profile: dict[str, Any]) -> dict[str, Any]:
    contract = profile.get("capabilityContract")
    if isinstance(contract, dict):
        mission = safe_str(contract.get("mission"))
        entry_criteria = safe_list_str(contract.get("entryCriteria"))
        done_condition = safe_str(contract.get("doneCondition"))
        output_schema = safe_str(contract.get("outputSchema"))
        if mission and done_condition and output_schema:
            return {
                "mission": mission,
                "entryCriteria": entry_criteria,
                "doneCondition": done_condition,
                "outputSchema": output_schema,
            }

    role = safe_str(profile.get("role")) or "specialist"
    name = safe_str(profile.get("name")) or safe_str(profile.get("id")) or "agent"
    return {
        "mission": f"Deliver focused outcomes for scope: {name}.",
        "entryCriteria": [f"Task requires specialization for role `{role}`."],
        "doneCondition": "Output satisfies task acceptance criteria and verification constraints.",
        "outputSchema": "agent_output.v1",
    }


def _collect_profile_capabilities(profile: dict[str, Any]) -> dict[str, list[str]]:
    used_skills = [
        safe_str(item.get("name"))
        for item in (profile.get("usedSkills") if isinstance(profile.get("usedSkills"), list) else [])
        if isinstance(item, dict) and safe_str(item.get("name"))
    ]
    used_tools = [
        safe_str(item.get("name"))
        for item in (profile.get("usedTools") if isinstance(profile.get("usedTools"), list) else [])
        if isinstance(item, dict) and safe_str(item.get("name"))
    ]
    used_mcp = [
        safe_str(item.get("name"))
        for item in (profile.get("usedMcp") if isinstance(profile.get("usedMcp"), list) else [])
        if isinstance(item, dict) and safe_str(item.get("name"))
    ]
    rules = []
    for item in (profile.get("rulesApplied") if isinstance(profile.get("rulesApplied"), list) else []):
        if not isinstance(item, dict):
            continue
        title = safe_str(item.get("title"))
        location = safe_str(item.get("location"))
        if title:
            rules.append(title)
        elif location:
            rules.append(location)
    return {
        "skills": safe_list_str(used_skills),
        "tools": safe_list_str(used_tools),
        "mcp": safe_list_str(used_mcp),
        "rules": safe_list_str(rules),
    }


def normalize_profile(profile: dict[str, Any]) -> dict[str, Any]:
    profile_id = safe_str(profile.get("id"))
    role = safe_str(profile.get("role"))
    default_agent_class = "core" if profile_id in {"orchestrator-agent", "analyst-agent", "designer-agent", "reader-agent"} else "specialist"
    agent_class = safe_str(profile.get("agentClass")) or default_agent_class
    default_execution_mode = safe_str(profile.get("executionMode")) or ("parallel_read_only" if agent_class == "specialist" else "sequential")
    normalized: dict[str, Any] = {
        "id": profile_id,
        "name": safe_str(profile.get("name")) or profile_id,
        "role": role,
        "agentClass": agent_class,
        "coordinationRole": safe_str(profile.get("coordinationRole")) or ("coordinator" if profile_id == "orchestrator-agent" else "domain"),
        "defaultParticipationPolicy": safe_str(profile.get("defaultParticipationPolicy")) or ("always_core" if profile_id in {"orchestrator-agent", "analyst-agent"} else "conditional"),
        "preferredExecutionModes": safe_list_str(profile.get("preferredExecutionModes")) or [default_execution_mode],
        "origin": safe_str(profile.get("origin")) or "manual",
        "createdByAgentId": safe_str(profile.get("createdByAgentId")) or None,
        "parentTemplateId": safe_str(profile.get("parentTemplateId")) or None,
        "derivedFromAgentId": safe_str(profile.get("derivedFromAgentId")) or None,
        "specializationScope": safe_str(profile.get("specializationScope")) or role or "general",
        "lifecycle": safe_str(profile.get("lifecycle")) or "active",
        "creationReason": safe_str(profile.get("creationReason")) or None,
        "capabilityContract": _capability_from_profile(profile),
        "workflowBackbone": profile.get("workflowBackbone") if isinstance(profile.get("workflowBackbone"), dict) else {},
        "executionMode": default_execution_mode,
    }
    normalized.update(_collect_profile_capabilities(profile))
    return normalized


def load_template_catalog(path: Path | None = None) -> list[dict[str, Any]]:
    target = path or DEFAULT_TEMPLATE_CATALOG
    if not target.exists():
        return []
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    templates = payload.get("templates") if isinstance(payload, dict) else None
    if not isinstance(templates, list):
        return []

    normalized: list[dict[str, Any]] = []
    for index, raw in enumerate(templates):
        if not isinstance(raw, dict):
            continue
        template_id = safe_str(raw.get("id")) or f"template-{index+1}"
        scope = safe_str(raw.get("specializationScope")) or safe_str(raw.get("name")) or template_id
        capability = raw.get("capabilityContract") if isinstance(raw.get("capabilityContract"), dict) else {}
        mission = safe_str(capability.get("mission")) or f"Deliver specialist output for `{template_id}` scope."
        done_condition = safe_str(capability.get("doneCondition")) or "Deliver verified specialist output."
        output_schema = safe_str(capability.get("outputSchema")) or "specialist_output.v1"
        entry = {
            "id": template_id,
            "name": safe_str(raw.get("name")) or template_id,
            "specializationScope": scope,
            "defaultSkills": safe_list_str(raw.get("defaultSkills")),
            "defaultTools": safe_list_str(raw.get("defaultTools")),
            "defaultMcp": safe_list_str(raw.get("defaultMcp")),
            "defaultRules": safe_list_str(raw.get("defaultRules")),
            "capabilityContract": {
                "mission": mission,
                "entryCriteria": safe_list_str(capability.get("entryCriteria")),
                "doneCondition": done_condition,
                "outputSchema": output_schema,
            },
            "workflowBackbone": raw.get("workflowBackbone") if isinstance(raw.get("workflowBackbone"), dict) else {},
            "executionMode": safe_str(raw.get("executionMode")) or "parallel_read_only",
        }
        normalized.append(entry)
    return normalized


def load_host_capability_matrix(path: Path | None = None) -> list[dict[str, Any]]:
    target = path or DEFAULT_HOST_CAPABILITY_MATRIX
    if not target.exists():
        return []
    try:
        payload = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    hosts = payload.get("hosts") if isinstance(payload, dict) else None
    if not isinstance(hosts, list):
        return []
    return [item for item in hosts if isinstance(item, dict) and safe_str(item.get("id"))]


def _find_host_capability(hosts: list[dict[str, Any]], host_id: str) -> dict[str, Any] | None:
    normalized = safe_str(host_id).lower()
    for host in hosts:
        if safe_str(host.get("id")).lower() == normalized:
            return host
    return None


def _build_host_execution_strategy(
    *,
    hosts: list[dict[str, Any]],
    default_host_id: str = DEFAULT_HOST_ID,
) -> dict[str, Any]:
    host_policies: dict[str, dict[str, Any]] = {}
    for host in hosts:
        host_id = safe_str(host.get("id"))
        capabilities = host.get("capabilities") if isinstance(host.get("capabilities"), dict) else {}
        native_delegation = bool(capabilities.get("nativeDelegation"))
        isolated_contexts = bool(capabilities.get("isolatedContextWindows"))
        dispatcher_required = bool(capabilities.get("dispatcherRequiredForDelegation"))
        execution_backend = "native_isolated_windows" if native_delegation and isolated_contexts and not dispatcher_required else "dispatcher_backed_child_runs"
        host_policies[host_id] = {
            "display_name": safe_str(host.get("displayName")) or host_id,
            "execution_backend": execution_backend,
            "native_delegation": native_delegation,
            "isolated_context_windows": isolated_contexts,
            "dispatcher_required": dispatcher_required,
            "fallback_mode": safe_str(host.get("fallbackMode")) or "dispatcher_backed",
            "adapter_strategy": safe_str(host.get("adapterStrategy")) or "unknown",
        }

    default_policy = host_policies.get(default_host_id) or next(iter(host_policies.values()), None) or {
        "execution_backend": "dispatcher_backed_child_runs",
        "native_delegation": False,
        "isolated_context_windows": False,
        "dispatcher_required": True,
        "fallback_mode": "dispatcher_only",
        "adapter_strategy": "dispatcher_first",
    }
    return {
        "default_host_id": default_host_id if default_host_id in host_policies else DEFAULT_HOST_ID,
        "selected_backend_by_default": safe_str(default_policy.get("execution_backend")) or "dispatcher_backed_child_runs",
        "context_isolation_policy": DEFAULT_CONTEXT_ISOLATION_POLICY,
        "host_policies": host_policies,
    }


def _is_read_only_mode(execution_mode: Any) -> bool:
    return safe_str(execution_mode).lower() in READ_ONLY_EXECUTION_MODES


def build_requirements(
    *,
    hint_text: str,
    target_metric: str = "",
    owner_section: str = "",
    linked_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    text_parts = [
        hint_text,
        target_metric,
        owner_section,
        safe_str(linked_snapshot.get("problem")) if isinstance(linked_snapshot, dict) else "",
        safe_str(linked_snapshot.get("solution")) if isinstance(linked_snapshot, dict) else "",
    ]
    text = " ".join(part for part in text_parts if safe_str(part))
    tokens = normalize_tokens(text)

    required_tools: set[str] = set()
    required_mcp: set[str] = set()
    required_skills: set[str] = set()
    required_rules: set[str] = set()
    ui_related = any(token in tokens for token in DESIGN_TRIGGER_TOKEN_MARKERS)
    telemetry_related = any(token in tokens for token in TELEMETRY_TRIGGER_TOKEN_MARKERS)
    contract_related = any(token in tokens for token in CONTRACT_TRIGGER_TOKEN_MARKERS)
    retrieval_related = any(token in tokens for token in {"retrieval", "evidence", "контекст", "докум", "qmd"})

    if retrieval_related:
        required_tools.add("QMD retrieval")
        required_mcp.add("qmd")
        required_skills.add("doc")
        required_rules.add("QMD Retrieval Policy")
    if ui_related:
        required_skills.add("playwright")
        required_tools.add("Browser verification")
    if telemetry_related:
        required_skills.add("agent-telemetry")
        required_tools.add("Telemetry report builder")
        required_rules.add("Agent Telemetry Logging")
    if contract_related:
        required_skills.add("doc")
        required_rules.add("Source of truth: спецификация проекта")
    if _is_terminology_consistency_request({
        "text": text,
        "tokens": tokens,
    }):
        required_skills.add("doc")
        required_tools.add("Terminology consistency audit")
        required_rules.add("Consistency Sync")

    return {
        "text": text,
        "tokens": tokens,
        "skills": sorted(required_skills),
        "tools": sorted(required_tools),
        "mcp": sorted(required_mcp),
        "rules": sorted(required_rules),
        "retrieval_related": retrieval_related,
        "ui_related": ui_related,
        "telemetry_related": telemetry_related,
        "contract_related": contract_related,
        "complexity": "high" if sum(bool(flag) for flag in (retrieval_related, ui_related, telemetry_related, contract_related)) >= 2 else "normal",
    }


def _overlap_score(required: set[str], available: set[str]) -> float:
    if not required:
        return 0.0
    if not available:
        return 0.0
    return len(required.intersection(available)) / len(required)


def score_profile(profile: dict[str, Any], requirements: dict[str, Any]) -> float:
    req_tokens = requirements.get("tokens") if isinstance(requirements.get("tokens"), set) else set()
    scope_tokens = normalize_tokens(f"{safe_str(profile.get('specializationScope'))} {safe_str(profile.get('name'))} {safe_str(profile.get('role'))}")
    lexical = _overlap_score(req_tokens, scope_tokens) if req_tokens else 0.0

    req_skills = {item.lower() for item in safe_list_str(requirements.get("skills"))}
    req_tools = {item.lower() for item in safe_list_str(requirements.get("tools"))}
    req_mcp = {item.lower() for item in safe_list_str(requirements.get("mcp"))}

    profile_skills = {item.lower() for item in safe_list_str(profile.get("skills"))}
    profile_tools = {item.lower() for item in safe_list_str(profile.get("tools"))}
    profile_mcp = {item.lower() for item in safe_list_str(profile.get("mcp"))}

    skill_score = _overlap_score(req_skills, profile_skills)
    tool_score = _overlap_score(req_tools, profile_tools)
    mcp_score = _overlap_score(req_mcp, profile_mcp)

    core_bonus = 0.05 if safe_str(profile.get("agentClass")).lower() == "core" else 0.0
    score = (lexical * 0.45) + (skill_score * 0.2) + (tool_score * 0.25) + (mcp_score * 0.1) + core_bonus
    return round(min(max(score, 0.0), 1.0), 4)


def select_reuse_candidates(
    *,
    profiles: list[dict[str, Any]],
    requirements: dict[str, Any],
    threshold: float = DEFAULT_REUSE_THRESHOLD,
    max_candidates: int = 5,
) -> list[dict[str, Any]]:
    scored: list[dict[str, Any]] = []
    for profile in profiles:
        profile_id = safe_str(profile.get("id"))
        if not profile_id:
            continue
        lifecycle = safe_str(profile.get("lifecycle")).lower() or "active"
        if lifecycle == "retired":
            continue
        score = score_profile(profile, requirements)
        decision = "accepted" if score >= threshold else "considered"
        rationale = (
            "Strong fit by specialization scope and capability overlap."
            if decision == "accepted"
            else "Partial fit, can be reused with refinement."
        )
        scored.append(
            {
                "profile_id": profile_id,
                "name": safe_str(profile.get("name")) or profile_id,
                "score": score,
                "decision": decision,
                "rationale": rationale,
            }
        )
    scored.sort(key=lambda item: (-float(item.get("score") or 0), safe_str(item.get("profile_id"))))
    return scored[:max_candidates]


def _score_template(template: dict[str, Any], requirements: dict[str, Any]) -> float:
    template_tokens = normalize_tokens(f"{safe_str(template.get('name'))} {safe_str(template.get('specializationScope'))}")
    req_tokens = requirements.get("tokens") if isinstance(requirements.get("tokens"), set) else set()
    lexical = _overlap_score(req_tokens, template_tokens) if req_tokens else 0.0

    req_tools = {item.lower() for item in safe_list_str(requirements.get("tools"))}
    req_skills = {item.lower() for item in safe_list_str(requirements.get("skills"))}
    req_mcp = {item.lower() for item in safe_list_str(requirements.get("mcp"))}
    tmpl_tools = {item.lower() for item in safe_list_str(template.get("defaultTools"))}
    tmpl_skills = {item.lower() for item in safe_list_str(template.get("defaultSkills"))}
    tmpl_mcp = {item.lower() for item in safe_list_str(template.get("defaultMcp"))}

    tool_score = _overlap_score(req_tools, tmpl_tools)
    skill_score = _overlap_score(req_skills, tmpl_skills)
    mcp_score = _overlap_score(req_mcp, tmpl_mcp)

    return round(min(max((lexical * 0.4) + (tool_score * 0.3) + (skill_score * 0.2) + (mcp_score * 0.1), 0.0), 1.0), 4)


def _build_created_profile(
    *,
    template: dict[str, Any],
    task_id: str,
    created_by_agent_id: str,
) -> dict[str, Any]:
    scope_slug = slugify(safe_str(template.get("id")) or safe_str(template.get("name")) or "specialist")
    task_slug = slugify(task_id) or "task"
    digest = hashlib.sha1(f"{scope_slug}:{task_slug}".encode("utf-8")).hexdigest()[:8]
    profile_id = f"specialist-{scope_slug}-{digest}"
    name = f"{safe_str(template.get('name'))} [{task_slug}]"
    return {
        "id": profile_id,
        "name": name,
        "agentClass": "specialist",
        "origin": "dynamic",
        "createdByAgentId": created_by_agent_id or None,
        "parentTemplateId": safe_str(template.get("id")) or None,
        "derivedFromAgentId": None,
        "specializationScope": safe_str(template.get("specializationScope")) or safe_str(template.get("name")) or "specialist scope",
        "lifecycle": "active",
        "creationReason": "No sufficient reuse candidate; created from specialist template.",
        "capabilityContract": template.get("capabilityContract") if isinstance(template.get("capabilityContract"), dict) else {
            "mission": "Deliver specialist output.",
            "entryCriteria": [],
            "doneCondition": "Task constraints satisfied.",
            "outputSchema": "specialist_output.v1",
        },
        "workflowBackbone": template.get("workflowBackbone") if isinstance(template.get("workflowBackbone"), dict) else {},
        "executionMode": safe_str(template.get("executionMode")) or "parallel_read_only",
        "skills": safe_list_str(template.get("defaultSkills")),
        "tools": safe_list_str(template.get("defaultTools")),
        "mcp": safe_list_str(template.get("defaultMcp")),
        "rules": safe_list_str(template.get("defaultRules")),
    }


def choose_template(templates: list[dict[str, Any]], requirements: dict[str, Any]) -> dict[str, Any] | None:
    if not templates:
        return None

    if _is_terminology_consistency_request(requirements):
        for template in templates:
            if safe_str(template.get("id")) == TERMINOLOGY_TEMPLATE_ID:
                return template

    scored = [
        (template, _score_template(template, requirements))
        for template in templates
    ]
    scored.sort(key=lambda item: (-item[1], safe_str(item[0].get("id"))))
    return scored[0][0]


def _scope_key(value: Any) -> str:
    tokens = sorted(normalize_tokens(safe_str(value)))
    if tokens:
        return " ".join(tokens)
    return safe_str(value).lower()


def _tool_envelope_key(values: list[str]) -> tuple[str, ...]:
    return tuple(sorted({safe_str(item).lower() for item in values if safe_str(item)}))


def find_duplicate_profile_by_scope_and_tools(
    *,
    profiles: list[dict[str, Any]],
    specialization_scope: str,
    tools: list[str],
) -> dict[str, Any] | None:
    candidate_scope_key = _scope_key(specialization_scope)
    candidate_tool_key = _tool_envelope_key(tools)
    if not candidate_scope_key and not candidate_tool_key:
        return None

    for profile in profiles:
        lifecycle = safe_str(profile.get("lifecycle")).lower() or "active"
        if lifecycle == "retired":
            continue
        profile_scope_key = _scope_key(profile.get("specializationScope"))
        if profile_scope_key != candidate_scope_key:
            continue
        profile_tool_key = _tool_envelope_key(safe_list_str(profile.get("tools")))
        if profile_tool_key == candidate_tool_key:
            return profile
    return None


def _profile_by_id(profiles: list[dict[str, Any]], profile_id: str) -> dict[str, Any] | None:
    normalized = safe_str(profile_id)
    if not normalized:
        return None
    return next((profile for profile in profiles if safe_str(profile.get("id")) == normalized), None)


def _build_fallback_profile(profile_id: str) -> dict[str, Any]:
    normalized = safe_str(profile_id) or "unknown-agent"
    return {
        "id": normalized,
        "name": normalized,
        "skills": [],
        "tools": [],
        "mcp": [],
        "rules": [],
        "agentClass": "core",
        "coordinationRole": "domain",
        "defaultParticipationPolicy": "conditional",
        "preferredExecutionModes": ["sequential"],
        "origin": "manual",
        "specializationScope": "fallback",
        "lifecycle": "active",
        "capabilityContract": {
            "mission": "Fallback execution profile.",
            "entryCriteria": ["No reusable profile found."],
            "doneCondition": "Task resolved with explicit verification.",
            "outputSchema": "agent_output.v1",
        },
        "workflowBackbone": {},
        "executionMode": "sequential",
    }


def _pick_specialist_participants(requirements: dict[str, Any], available_ids: set[str]) -> list[str]:
    participants: list[str] = []
    if requirements.get("retrieval_related") and "retrieval-audit" in available_ids:
        participants.append("retrieval-audit")
    if requirements.get("contract_related") and "contract-audit" in available_ids:
        participants.append("contract-audit")
    if requirements.get("telemetry_related") and "telemetry-audit" in available_ids:
        participants.append("telemetry-audit")
    if requirements.get("ui_related") and "designer-agent" in available_ids:
        participants.append("designer-agent")
    return safe_list_str(participants)


def _pick_verify_participants(requirements: dict[str, Any], available_ids: set[str]) -> list[str]:
    participants: list[str] = []
    if requirements.get("ui_related") and "ui-verification" in available_ids:
        participants.append("ui-verification")
    if (requirements.get("telemetry_related") or requirements.get("contract_related")) and "telemetry-audit" in available_ids:
        participants.append("telemetry-audit")
    return safe_list_str(participants)


def _choose_interaction_mode(
    *,
    merge_owner_id: str,
    parallel_participants: list[str],
    verify_participants: list[str],
) -> str:
    if parallel_participants or verify_participants:
        return "mixed_phased"
    if merge_owner_id:
        return DEFAULT_INTERACTION_MODE
    return DEFAULT_INTERACTION_MODE


def _build_interaction_phases(
    *,
    interaction_mode: str,
    coordinator_id: str,
    merge_owner_id: str,
    final_synthesizer_agent_id: str,
    parallel_participants: list[str],
    verify_participants: list[str],
) -> list[dict[str, Any]]:
    phases: list[dict[str, Any]] = [
        {
            "phase_id": "phase_1_framing",
            "label": "Формирование рамки задачи",
            "mode": "sequential",
            "goal": "Определить состав участников, границы контекста и merge owner.",
            "participants": safe_list_str([coordinator_id]),
            "depends_on": [],
            "outputs": ["orchestration_decision_package.v1"],
            "status": "planned",
            "merge_into": None,
        }
    ]

    if interaction_mode == "mixed_phased":
        phases.append(
            {
                "phase_id": "phase_2_parallel_audit",
                "label": "Параллельные read-only ветки",
                "mode": "parallel_read_only",
                "goal": "Собрать независимые review/audit пакеты в изолированных контекстных окнах.",
                "participants": safe_list_str(parallel_participants),
                "depends_on": ["phase_1_framing"],
                "outputs": ["review_package.v1", "audit_report.v1"],
                "status": "planned",
                "merge_into": "phase_4_apply_merge",
            }
        )
        phases.append(
            {
                "phase_id": "phase_3_roundtable",
                "label": "Управляемый roundtable",
                "mode": "roundtable",
                "goal": "Свести позиции агентов, снять противоречия и подготовить решение для merge owner.",
                "participants": safe_list_str([coordinator_id, merge_owner_id, *parallel_participants]),
                "depends_on": ["phase_2_parallel_audit"],
                "outputs": ["roundtable_summary.v1"],
                "status": "planned",
                "merge_into": "phase_4_apply_merge",
            }
        )
        phases.append(
            {
                "phase_id": "phase_4_apply_merge",
                "label": "Единый apply/merge",
                "mode": "sequential",
                "goal": "Принять финальное решение по изменениям и применить его через одного owner.",
                "participants": safe_list_str([merge_owner_id]),
                "depends_on": ["phase_3_roundtable"],
                "outputs": ["merge_summary.v1"],
                "status": "planned",
                "merge_into": None,
            }
        )
        if verify_participants:
            phases.append(
                {
                    "phase_id": "phase_5_parallel_verify",
                    "label": "Параллельная проверка",
                    "mode": "parallel_read_only",
                    "goal": "Проверить runtime/UI/telemetry после merge без прямой записи в общий артефакт.",
                    "participants": safe_list_str(verify_participants),
                    "depends_on": ["phase_4_apply_merge"],
                    "outputs": ["verification_report.v1"],
                    "status": "planned",
                    "merge_into": "phase_6_finalize",
                }
            )
        phases.append(
            {
                "phase_id": "phase_6_finalize",
                "label": "Финальная сборка ответа",
                "mode": "sequential",
                "goal": "Собрать итоговое резюме оркестратора и вернуть один ответ в чат.",
                "participants": safe_list_str([final_synthesizer_agent_id]),
                "depends_on": ["phase_5_parallel_verify" if verify_participants else "phase_4_apply_merge"],
                "outputs": ["orchestrator_summary.v1"],
                "status": "planned",
                "merge_into": None,
            }
        )
        return phases

    phases.append(
        {
            "phase_id": "phase_2_apply",
            "label": "Основное выполнение",
            "mode": "sequential",
            "goal": "Выполнить задачу без параллельных веток через одного owner.",
            "participants": safe_list_str([merge_owner_id]),
            "depends_on": ["phase_1_framing"],
            "outputs": ["implementation_result_package.v1"],
            "status": "planned",
            "merge_into": None,
        }
    )
    phases.append(
        {
            "phase_id": "phase_3_finalize",
            "label": "Финальное резюме",
            "mode": "sequential",
            "goal": "Сформировать один итоговый ответ без roundtable и merge-ветвления.",
            "participants": safe_list_str([final_synthesizer_agent_id]),
            "depends_on": ["phase_2_apply"],
            "outputs": ["orchestrator_summary.v1"],
            "status": "planned",
            "merge_into": None,
        }
    )
    return phases


def _build_spawned_instance(
    *,
    profile: dict[str, Any],
    task_id: str,
    root_agent_id: str,
    purpose: str,
    parent_instance_id: str | None = None,
    depth: int = 0,
    input_refs: list[str] | None = None,
    phase_id: str | None = None,
    execution_backend: str = "dispatcher",
    context_window_id: str | None = None,
    isolation_mode: str = DEFAULT_CONTEXT_ISOLATION_POLICY,
    read_only: bool | None = None,
    ownership_scope: list[str] | None = None,
    depends_on: list[str] | None = None,
    merge_target: str | None = None,
) -> dict[str, Any]:
    profile_id = safe_str(profile.get("id")) or "unknown-profile"
    digest = hashlib.sha1(f"{task_id}:{profile_id}:{depth}:{safe_str(parent_instance_id)}".encode("utf-8")).hexdigest()[:10]
    instance_id = f"inst-{digest}"
    workflow_backbone = profile.get("workflowBackbone") if isinstance(profile.get("workflowBackbone"), dict) else {}
    capability_contract = profile.get("capabilityContract") if isinstance(profile.get("capabilityContract"), dict) else {}
    return {
        "instance_id": instance_id,
        "profile_id": profile_id,
        "source_template_id": safe_str(profile.get("parentTemplateId")) or None,
        "parent_instance_id": parent_instance_id,
        "root_agent_id": root_agent_id,
        "task_id": task_id,
        "purpose": safe_str(purpose) or "Task-local specialist execution",
        "depth": max(depth, 0),
        "allowed_skills": safe_list_str(profile.get("skills")),
        "allowed_tools": safe_list_str(profile.get("tools")),
        "allowed_mcp": safe_list_str(profile.get("mcp")),
        "applied_rules": safe_list_str(profile.get("rules")),
        "input_refs": safe_list_str(input_refs),
        "output_refs": [],
        "status": "planned",
        "verify_status": "pending",
        "workflow_backbone_version": safe_str(workflow_backbone.get("version")) or DEFAULT_INSTANCE_BACKBONE_VERSION,
        "output_contract": safe_str(capability_contract.get("outputSchema")) or "agent_output.v1",
        "execution_mode": safe_str(profile.get("executionMode")) or "sequential",
        "execution_backend": execution_backend,
        "phase_id": safe_str(phase_id) or None,
        "context_window_id": safe_str(context_window_id) or f"ctx-{instance_id}",
        "isolation_mode": safe_str(isolation_mode) or DEFAULT_CONTEXT_ISOLATION_POLICY,
        "read_only": _is_read_only_mode(profile.get("executionMode")) if read_only is None else bool(read_only),
        "ownership_scope": safe_list_str(ownership_scope),
        "depends_on": safe_list_str(depends_on),
        "merge_target": safe_str(merge_target) or None,
        "timings": {
            "queued_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
            "started_at": None,
            "finished_at": None,
        },
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
        },
        "artifacts": _instance_artifact_paths(instance_id),
    }


def build_collaboration_plan(
    *,
    task_id: str,
    root_agent_id: str,
    purpose: str,
    hint_text: str,
    registry: dict[str, Any],
    suggested_agents: list[str] | None = None,
    target_metric: str = "",
    owner_section: str = "",
    linked_snapshot: dict[str, Any] | None = None,
    template_catalog_path: Path | None = None,
    orchestration_budget: dict[str, Any] | None = None,
    reuse_threshold: float = DEFAULT_REUSE_THRESHOLD,
    host_matrix_path: Path | None = None,
    default_host_id: str = DEFAULT_HOST_ID,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    raw_agents = registry.get("agents") if isinstance(registry, dict) else None
    profiles = [
        normalize_profile(item)
        for item in (raw_agents if isinstance(raw_agents, list) else [])
        if isinstance(item, dict) and safe_str(item.get("id"))
    ]

    requirements = build_requirements(
        hint_text=hint_text,
        target_metric=target_metric,
        owner_section=owner_section,
        linked_snapshot=linked_snapshot,
    )
    reuse_candidates = select_reuse_candidates(
        profiles=profiles,
        requirements=requirements,
        threshold=reuse_threshold,
    )

    selected_profile: dict[str, Any] | None = None
    created_profiles: list[dict[str, Any]] = []
    strategy = "reuse_existing"

    accepted = [candidate for candidate in reuse_candidates if candidate.get("decision") == "accepted"]
    if accepted:
        selected_id = safe_str(accepted[0].get("profile_id"))
        selected_profile = next((profile for profile in profiles if safe_str(profile.get("id")) == selected_id), None)

    if selected_profile is None:
        templates = load_template_catalog(template_catalog_path)
        template = choose_template(templates, requirements)
        if template:
            candidate_profile = _build_created_profile(
                template=template,
                task_id=task_id,
                created_by_agent_id=root_agent_id,
            )
            duplicate_profile = find_duplicate_profile_by_scope_and_tools(
                profiles=profiles,
                specialization_scope=safe_str(candidate_profile.get("specializationScope")),
                tools=safe_list_str(candidate_profile.get("tools")),
            )
            if duplicate_profile is not None:
                selected_profile = duplicate_profile
                strategy = "reuse_existing" if len(reuse_candidates) == 0 else "mixed"
            else:
                selected_profile = candidate_profile
                created_profiles.append(selected_profile)
                strategy = "create_new" if len(reuse_candidates) == 0 else "mixed"
        elif profiles:
            selected_profile = profiles[0]
            strategy = "reuse_existing"

    if selected_profile is None:
        selected_profile = _build_fallback_profile(root_agent_id)

    selected_agents = safe_list_str(suggested_agents)
    selected_profile_id = safe_str(selected_profile.get("id"))
    if selected_profile_id and selected_profile_id != root_agent_id and selected_profile_id not in selected_agents:
        selected_agents.insert(0, selected_profile_id)

    budget = DEFAULT_ORCHESTRATION_BUDGET.copy()
    if isinstance(orchestration_budget, dict):
        for key in budget:
            value = orchestration_budget.get(key)
            if isinstance(value, int) and value > 0:
                budget[key] = value

    profile_ids = {safe_str(profile.get("id")) for profile in profiles if safe_str(profile.get("id"))}
    coordinator_id = "orchestrator-agent" if "orchestrator-agent" in profile_ids else root_agent_id
    coordinator_profile = _profile_by_id(profiles, coordinator_id) or (_build_fallback_profile(coordinator_id) if coordinator_id != selected_profile_id else selected_profile)

    merge_owner_id = selected_profile_id or root_agent_id
    if _is_read_only_mode(selected_profile.get("executionMode")):
        merge_owner_id = root_agent_id
    merge_owner_profile = _profile_by_id(profiles, merge_owner_id) or (_build_fallback_profile(merge_owner_id) if merge_owner_id != selected_profile_id else selected_profile)

    final_synthesizer_agent_id = coordinator_id or merge_owner_id
    available_ids = profile_ids.union({safe_str(item.get("id")) for item in created_profiles if safe_str(item.get("id"))})
    requested_review_agents = [
        agent_id
        for agent_id in safe_list_str(selected_agents)
        if agent_id not in {coordinator_id, merge_owner_id}
    ]
    if root_agent_id not in {coordinator_id, merge_owner_id}:
        requested_review_agents.insert(0, root_agent_id)
    parallel_participants = safe_list_str(requested_review_agents + _pick_specialist_participants(requirements, available_ids))
    verify_participants = [
        participant
        for participant in _pick_verify_participants(requirements, available_ids)
        if participant not in parallel_participants
    ]
    interaction_mode = _choose_interaction_mode(
        merge_owner_id=merge_owner_id,
        parallel_participants=parallel_participants,
        verify_participants=verify_participants,
    )
    interaction_phases = _build_interaction_phases(
        interaction_mode=interaction_mode,
        coordinator_id=coordinator_id,
        merge_owner_id=merge_owner_id,
        final_synthesizer_agent_id=final_synthesizer_agent_id,
        parallel_participants=parallel_participants,
        verify_participants=verify_participants,
    )
    discussion_rounds: list[dict[str, Any]] = []
    roundtable_policy = {
        "enabled": interaction_mode == "mixed_phased",
        "moderated_by": coordinator_id,
        "max_rounds": ROUNDTABLE_MAX_ROUNDS,
        "transcript_visibility": "summary_only",
        "allow_free_chat": False,
        "allow_position_sharing": True,
        "summary_required_each_round": True,
    }
    host_strategy = _build_host_execution_strategy(
        hosts=load_host_capability_matrix(host_matrix_path),
        default_host_id=default_host_id,
    )
    default_backend = safe_str(host_strategy.get("selected_backend_by_default")) or "dispatcher_backed_child_runs"

    coordinator_instance = _build_spawned_instance(
        profile=coordinator_profile,
        task_id=task_id,
        root_agent_id=coordinator_id,
        purpose="Определить orchestration mode, фазы и merge owner.",
        parent_instance_id=None,
        depth=0,
        input_refs=[],
        phase_id="phase_1_framing",
        execution_backend=default_backend,
        read_only=False,
        ownership_scope=["orchestration"],
        merge_target="phase_4_apply_merge" if interaction_mode == "mixed_phased" else "phase_2_apply",
    )
    spawned_instances: list[dict[str, Any]] = [coordinator_instance]

    for participant_id in parallel_participants:
        participant_profile = _profile_by_id(profiles, participant_id)
        if participant_profile is None and participant_id == selected_profile_id:
            participant_profile = selected_profile
        if participant_profile is None:
            continue
        spawned_instances.append(
            _build_spawned_instance(
                profile=participant_profile,
                task_id=task_id,
                root_agent_id=coordinator_id,
                purpose=f"Подготовить read-only пакет для phase_2_parallel_audit ({participant_id}).",
                parent_instance_id=coordinator_instance["instance_id"],
                depth=1,
                input_refs=["phase_1_framing"],
                phase_id="phase_2_parallel_audit",
                execution_backend=default_backend,
                read_only=True,
                ownership_scope=["read_only_analysis"],
                depends_on=["phase_1_framing"],
                merge_target="phase_4_apply_merge",
            )
        )

    apply_phase_id = "phase_4_apply_merge" if interaction_mode == "mixed_phased" else "phase_2_apply"
    apply_parent_id = coordinator_instance["instance_id"]
    if merge_owner_id != coordinator_id or interaction_mode != "sequential":
        spawned_instances.append(
            _build_spawned_instance(
                profile=merge_owner_profile,
                task_id=task_id,
                root_agent_id=coordinator_id,
                purpose="Единый owner для apply/merge после завершения review-веток.",
                parent_instance_id=apply_parent_id,
                depth=1,
                input_refs=["phase_1_framing"],
                phase_id=apply_phase_id,
                execution_backend=default_backend,
                read_only=False,
                ownership_scope=["merge_owner", "apply"],
                depends_on=["phase_3_roundtable"] if interaction_mode == "mixed_phased" else ["phase_1_framing"],
                merge_target="phase_6_finalize" if interaction_mode == "mixed_phased" else "phase_3_finalize",
            )
        )

    if interaction_mode == "mixed_phased":
        for participant_id in verify_participants:
            participant_profile = _profile_by_id(profiles, participant_id)
            if participant_profile is None:
                continue
            spawned_instances.append(
                _build_spawned_instance(
                    profile=participant_profile,
                    task_id=task_id,
                    root_agent_id=coordinator_id,
                    purpose=f"Проверить итог после merge ({participant_id}).",
                    parent_instance_id=coordinator_instance["instance_id"],
                    depth=1,
                    input_refs=[apply_phase_id],
                    phase_id="phase_5_parallel_verify",
                    execution_backend=default_backend,
                    read_only=True,
                    ownership_scope=["verify"],
                    depends_on=[apply_phase_id],
                    merge_target="phase_6_finalize",
                )
            )

    if final_synthesizer_agent_id != coordinator_id:
        final_profile = _profile_by_id(profiles, final_synthesizer_agent_id) or _build_fallback_profile(final_synthesizer_agent_id)
        spawned_instances.append(
            _build_spawned_instance(
                profile=final_profile,
                task_id=task_id,
                root_agent_id=coordinator_id,
                purpose="Собрать один финальный ответ по результатам фаз.",
                parent_instance_id=coordinator_instance["instance_id"],
                depth=1,
                input_refs=[apply_phase_id],
                phase_id="phase_6_finalize" if interaction_mode == "mixed_phased" else "phase_3_finalize",
                execution_backend=default_backend,
                read_only=False,
                ownership_scope=["final_synthesis"],
                depends_on=["phase_5_parallel_verify"] if interaction_mode == "mixed_phased" and verify_participants else [apply_phase_id],
                merge_target=None,
            )
        )

    rationale = (
        "Reuse-first matching completed. "
        f"Selected profile: {selected_profile_id or root_agent_id}. "
        f"Strategy: {strategy}. "
        f"Interaction mode: {interaction_mode}. "
        f"Coordinator: {coordinator_id}. Merge owner: {merge_owner_id}."
    )
    plan = {
        "analysis_required": True,
        "suggested_agents": safe_list_str(suggested_agents),
        "selected_agents": selected_agents,
        "rationale": rationale,
        "reviewed_at": None,
        "strategy": strategy,
        "reuse_candidates": reuse_candidates,
        "created_profiles": [
            {
                "id": safe_str(profile.get("id")),
                "name": safe_str(profile.get("name")),
                "created_by_agent_id": safe_str(profile.get("createdByAgentId")) or None,
                "parent_template_id": safe_str(profile.get("parentTemplateId")) or None,
                "derived_from_agent_id": safe_str(profile.get("derivedFromAgentId")) or None,
                "specialization_scope": safe_str(profile.get("specializationScope")),
                "lifecycle": safe_str(profile.get("lifecycle")) or "active",
                "creation_reason": safe_str(profile.get("creationReason")) or None,
                "capability_contract": profile.get("capabilityContract"),
            }
            for profile in created_profiles
        ],
        "primary_coordinator_agent_id": coordinator_id,
        "final_synthesizer_agent_id": final_synthesizer_agent_id,
        "merge_owner_agent_id": merge_owner_id,
        "interaction_mode": interaction_mode,
        "interaction_phases": interaction_phases,
        "selection_basis": [
            "reuse_first_matching",
            "host_capability_matrix",
            "bounded_parallel_read_only",
            "orchestrator_moderated_roundtable" if interaction_mode == "mixed_phased" else "single_owner_apply",
        ],
        "merge_strategy": "single_owner_apply_after_parallel_branches" if interaction_mode == "mixed_phased" else "single_owner_apply",
        "conflict_policy": "orchestrator_moderated_roundtable_then_merge_owner_decision" if interaction_mode == "mixed_phased" else "merge_owner_decision",
        "host_execution_strategy": host_strategy,
        "context_isolation_policy": DEFAULT_CONTEXT_ISOLATION_POLICY,
        "roundtable_policy": roundtable_policy,
        "discussion_rounds": discussion_rounds,
        "spawned_instances": spawned_instances,
        "orchestration_budget": budget,
        "delegation_depth": 1 if spawned_instances else 0,
    }
    return plan, created_profiles


def append_created_profiles_to_registry(
    *,
    registry: dict[str, Any],
    created_profiles: list[dict[str, Any]],
) -> dict[str, Any]:
    if not created_profiles:
        return registry
    agents = registry.get("agents")
    if not isinstance(agents, list):
        return registry
    existing_ids = {safe_str(item.get("id")) for item in agents if isinstance(item, dict)}
    for created in created_profiles:
        created_id = safe_str(created.get("id"))
        if not created_id or created_id in existing_ids:
            continue
        existing_ids.add(created_id)
        agents.append(
            {
                "id": created_id,
                "name": safe_str(created.get("name")) or created_id,
                "role": safe_str(created.get("specializationScope")) or "Dynamic specialist",
                "status": "healthy",
                "skills": safe_list_str(created.get("skills")),
                "usedSkills": [{"name": item, "usage": "Dynamic specialist scope", "fullText": "Scoped specialist skill.", "practicalTasks": []} for item in safe_list_str(created.get("skills"))],
                "availableSkills": [],
                "usedTools": [{"name": item, "usage": "Scoped specialist tool", "fullText": "Scoped specialist capability.", "source": "docs/agents/profile_templates.yaml", "practicalTasks": []} for item in safe_list_str(created.get("tools"))],
                "availableTools": [],
                "repositories": [],
                "mcpServers": [{"name": item, "status": "online"} for item in safe_list_str(created.get("mcp"))],
                "usedMcp": [{"name": item, "status": "active", "note": "Dynamic specialist runtime envelope.", "practicalTasks": [], "impactInNumbers": ""} for item in safe_list_str(created.get("mcp"))],
                "availableMcp": [],
                "contextRefs": [],
                "rulesApplied": [{"title": rule, "location": "AGENTS.md", "description": "Dynamic specialist rule.", "fullText": "", "sourceUrl": None} for rule in safe_list_str(created.get("rules"))],
                "tasks": {
                    "queued": 0,
                    "running": 0,
                    "retrying": 0,
                    "waiting_review": 0,
                    "blocked": 0,
                    "waiting_external": 0,
                    "overdue": 0,
                    "in_work": 0,
                    "on_control": 0,
                },
                "taskEvents": [],
                "analystRecommendations": [],
                "improvements": [],
                "updatedAt": registry.get("updatedAt"),
                "source": "dynamic-orchestration",
                "agentClass": "specialist",
                "coordinationRole": "audit",
                "defaultParticipationPolicy": "specialist_runtime",
                "preferredExecutionModes": [safe_str(created.get("executionMode")) or "parallel_read_only"],
                "origin": "dynamic",
                "createdByAgentId": safe_str(created.get("createdByAgentId")) or None,
                "parentTemplateId": safe_str(created.get("parentTemplateId")) or None,
                "derivedFromAgentId": safe_str(created.get("derivedFromAgentId")) or None,
                "specializationScope": safe_str(created.get("specializationScope")) or "Dynamic specialist scope",
                "lifecycle": safe_str(created.get("lifecycle")) or "active",
                "creationReason": safe_str(created.get("creationReason")) or "Created by reuse-first orchestration.",
                "capabilityContract": created.get("capabilityContract") if isinstance(created.get("capabilityContract"), dict) else {
                    "mission": "Dynamic specialist execution.",
                    "entryCriteria": [],
                    "doneCondition": "Task finished.",
                    "outputSchema": "specialist_output.v1",
                },
                "workflowBackbone": created.get("workflowBackbone") if isinstance(created.get("workflowBackbone"), dict) else {
                    "version": DEFAULT_INSTANCE_BACKBONE_VERSION,
                    "commonCoreSteps": [],
                    "roleWindow": {},
                    "stepExecutionPolicy": {"skippedStepsAllowed": True, "skippedStepStatus": "skipped"},
                    "supportsDynamicInstances": True,
                },
                "executionMode": safe_str(created.get("executionMode")) or "parallel_read_only",
                "auditDisposition": "keep",
                "auditNote": "Dynamic specialist created by orchestration.",
            }
        )
    return registry
