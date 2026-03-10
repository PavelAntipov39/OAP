#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

DEFAULT_TEMPLATE_CATALOG = Path(__file__).resolve().parents[1] / "docs" / "agents" / "profile_templates.yaml"
DEFAULT_REUSE_THRESHOLD = 0.45
DEFAULT_ORCHESTRATION_BUDGET = {
    "max_instances": 7,
    "max_tokens": 120000,
    "max_wall_clock_minutes": 45,
    "max_no_progress_hops": 2,
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
    normalized: dict[str, Any] = {
        "id": profile_id,
        "name": safe_str(profile.get("name")) or profile_id,
        "role": role,
        "agentClass": safe_str(profile.get("agentClass")) or ("core" if profile_id in {"analyst-agent", "designer-agent"} else "specialist"),
        "origin": safe_str(profile.get("origin")) or "manual",
        "createdByAgentId": safe_str(profile.get("createdByAgentId")) or None,
        "parentTemplateId": safe_str(profile.get("parentTemplateId")) or None,
        "derivedFromAgentId": safe_str(profile.get("derivedFromAgentId")) or None,
        "specializationScope": safe_str(profile.get("specializationScope")) or role or "general",
        "lifecycle": safe_str(profile.get("lifecycle")) or "active",
        "creationReason": safe_str(profile.get("creationReason")) or None,
        "capabilityContract": _capability_from_profile(profile),
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
        }
        normalized.append(entry)
    return normalized


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

    if any(token in tokens for token in {"retrieval", "evidence", "контекст", "докум", "qmd"}):
        required_tools.add("QMD retrieval")
        required_mcp.add("qmd")
        required_skills.add("doc")
        required_rules.add("QMD Retrieval Policy")
    if any(token in tokens for token in {"ui", "ux", "playwright", "интерфейс", "drawer", "tooltip"}):
        required_skills.add("playwright")
        required_tools.add("Browser verification")
    if any(token in tokens for token in {"telemetry", "trace", "metric", "otel"}):
        required_skills.add("agent-telemetry")
        required_tools.add("Telemetry report builder")
        required_rules.add("Agent Telemetry Logging")
    if any(token in tokens for token in {"schema", "contract", "контракт"}):
        required_skills.add("doc")
        required_rules.add("Source of truth: спецификация проекта")

    return {
        "text": text,
        "tokens": tokens,
        "skills": sorted(required_skills),
        "tools": sorted(required_tools),
        "mcp": sorted(required_mcp),
        "rules": sorted(required_rules),
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
        "skills": safe_list_str(template.get("defaultSkills")),
        "tools": safe_list_str(template.get("defaultTools")),
        "mcp": safe_list_str(template.get("defaultMcp")),
        "rules": safe_list_str(template.get("defaultRules")),
    }


def choose_template(templates: list[dict[str, Any]], requirements: dict[str, Any]) -> dict[str, Any] | None:
    if not templates:
        return None
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


def _build_spawned_instance(
    *,
    profile: dict[str, Any],
    task_id: str,
    root_agent_id: str,
    purpose: str,
    parent_instance_id: str | None = None,
    depth: int = 0,
    input_refs: list[str] | None = None,
) -> dict[str, Any]:
    profile_id = safe_str(profile.get("id")) or "unknown-profile"
    digest = hashlib.sha1(f"{task_id}:{profile_id}:{depth}:{safe_str(parent_instance_id)}".encode("utf-8")).hexdigest()[:10]
    instance_id = f"inst-{digest}"
    return {
        "instance_id": instance_id,
        "profile_id": profile_id,
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
        selected_profile = {
            "id": root_agent_id,
            "name": root_agent_id,
            "skills": [],
            "tools": [],
            "mcp": [],
            "rules": [],
            "agentClass": "core",
            "origin": "manual",
            "specializationScope": "fallback",
            "lifecycle": "active",
            "capabilityContract": {
                "mission": "Fallback execution profile.",
                "entryCriteria": ["No reusable profile found."],
                "doneCondition": "Task resolved with explicit verification.",
                "outputSchema": "agent_output.v1",
            },
        }

    selected_agents = safe_list_str(suggested_agents)
    selected_profile_id = safe_str(selected_profile.get("id"))
    if selected_profile_id and selected_profile_id != root_agent_id and selected_profile_id not in selected_agents:
        selected_agents.insert(0, selected_profile_id)

    instance = _build_spawned_instance(
        profile=selected_profile,
        task_id=task_id,
        root_agent_id=root_agent_id,
        purpose=purpose,
        parent_instance_id=None,
        depth=0,
        input_refs=[],
    )

    budget = DEFAULT_ORCHESTRATION_BUDGET.copy()
    if isinstance(orchestration_budget, dict):
        for key in budget:
            value = orchestration_budget.get(key)
            if isinstance(value, int) and value > 0:
                budget[key] = value

    rationale = (
        "Reuse-first matching completed. "
        f"Selected profile: {selected_profile_id or root_agent_id}. "
        f"Strategy: {strategy}."
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
        "spawned_instances": [instance],
        "orchestration_budget": budget,
        "delegation_depth": 0,
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
                "auditDisposition": "keep",
                "auditNote": "Dynamic specialist created by orchestration.",
            }
        )
    return registry
