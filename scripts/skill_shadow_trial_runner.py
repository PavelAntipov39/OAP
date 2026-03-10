#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY_PATH = ROOT_DIR / "docs" / "agents" / "registry.yaml"
DEFAULT_PLAN_PATH = ROOT_DIR / "artifacts" / "skill_shadow_trial_plan.json"
DEFAULT_JUDGEMENT_PATH = ROOT_DIR / "artifacts" / "skill_shadow_trial_judgement.json"
DEFAULT_CAPABILITY_TRIALS_DIR = ROOT_DIR / "artifacts" / "capability_trials"
CAPABILITY_SNAPSHOT_VERSION = "agent_capability_snapshot.v1"
TRUSTED_SOURCE_TIERS = {"official"}
ALLOWED_RECOMMENDATIONS = {"trial_alternative", "replace_after_trial"}
ALLOWED_TRIAL_STATUSES = {"not_started", "scheduled", "failed"}
ALLOWED_PROMOTION_STATUSES = {"human_review_required", "watchlist"}


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso8601(value: str | None) -> dt.datetime | None:
    text = safe_str(value)
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed.astimezone(dt.timezone.utc)


def safe_str(value: Any) -> str:
    return str(value or "").strip()


def safe_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def safe_list_str(value: Any) -> list[str]:
    return [safe_str(item) for item in safe_list(value) if safe_str(item)]


def safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def unique_preserve(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = safe_str(value)
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        result.append(normalized)
    return result


def load_registry(path: Path) -> dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"registry_parse_error:{path}:{exc}") from exc


def find_agent(registry: dict[str, Any], agent_id: str) -> dict[str, Any]:
    agents = registry.get("agents") if isinstance(registry.get("agents"), list) else []
    for agent in agents:
        if isinstance(agent, dict) and safe_str(agent.get("id")) == agent_id:
            return agent
    raise ValueError(f"agent_not_found:{agent_id}")


def build_skill_index(agent: dict[str, Any]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}

    for item in safe_list(agent.get("usedSkills")):
        if not isinstance(item, dict):
            continue
        name = safe_str(item.get("name"))
        if not name:
            continue
        index[name.lower()] = {
            "name": name,
            "state": "used",
            "practicalTasks": safe_list_str(item.get("practicalTasks")),
            "decisionGuidance": item.get("decisionGuidance") if isinstance(item.get("decisionGuidance"), dict) else {},
            "qualitySignals": item.get("qualitySignals") if isinstance(item.get("qualitySignals"), dict) else {},
        }

    for item in safe_list(agent.get("availableSkills")):
        if not isinstance(item, dict):
            continue
        name = safe_str(item.get("name"))
        if not name:
            continue
        if name.lower() in index:
            continue
        index[name.lower()] = {
            "name": name,
            "state": "available",
            "practicalTasks": safe_list_str(item.get("practicalTasks")),
            "decisionGuidance": item.get("decisionGuidance") if isinstance(item.get("decisionGuidance"), dict) else {},
            "qualitySignals": item.get("qualitySignals") if isinstance(item.get("qualitySignals"), dict) else {},
        }

    return index


def build_source_index(agent: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in safe_list(agent.get("skillSourceRegistry")):
        if not isinstance(item, dict):
            continue
        source_id = safe_str(item.get("id"))
        if not source_id:
            continue
        result[source_id] = item
    return result


def select_representative_tasks(current_skill: dict[str, Any], candidate: dict[str, Any], limit: int) -> list[str]:
    current_tasks = safe_list_str(current_skill.get("practicalTasks"))
    candidate_examples = safe_list_str(((candidate.get("decisionGuidance") or {}) if isinstance(candidate.get("decisionGuidance"), dict) else {}).get("examples"))
    combined = unique_preserve(current_tasks + candidate_examples)
    if combined:
        return combined[:limit]

    target_skills = safe_list_str(candidate.get("targetSkills"))
    if target_skills:
        return [f"Representative task for {target_skills[0]} shadow trial"]
    return ["Representative task not specified"]


def candidate_block_reasons(candidate: dict[str, Any], source: dict[str, Any] | None, skill_index: dict[str, dict[str, Any]]) -> list[str]:
    reasons: list[str] = []
    trust = safe_str(candidate.get("trust") or (source or {}).get("trust")).lower()
    recommendation = safe_str(candidate.get("recommendation")).lower()
    trial_status = safe_str(candidate.get("trialStatus")).lower()
    promotion_status = safe_str(candidate.get("promotionStatus")).lower()
    target_skills = safe_list_str(candidate.get("targetSkills"))

    if trust not in TRUSTED_SOURCE_TIERS:
        reasons.append(f"untrusted_source:{trust or 'unknown'}")
    if recommendation not in ALLOWED_RECOMMENDATIONS:
        reasons.append(f"unsupported_recommendation:{recommendation or 'unknown'}")
    if trial_status not in ALLOWED_TRIAL_STATUSES:
        reasons.append(f"trial_status_not_actionable:{trial_status or 'unknown'}")
    if promotion_status not in ALLOWED_PROMOTION_STATUSES:
        reasons.append(f"promotion_status_not_actionable:{promotion_status or 'unknown'}")
    if not target_skills:
        reasons.append("missing_target_skills")
    if target_skills and not any(skill.lower() in skill_index for skill in target_skills):
        reasons.append("missing_current_skill_match")
    if source is None:
        reasons.append("missing_source_registry_entry")

    return reasons


def build_trial_item(agent: dict[str, Any], candidate: dict[str, Any], source: dict[str, Any] | None, skill_index: dict[str, dict[str, Any]], task_limit: int) -> dict[str, Any]:
    target_skills = safe_list_str(candidate.get("targetSkills"))
    current_skill = next((skill_index[item.lower()] for item in target_skills if item.lower() in skill_index), None)
    reasons = candidate_block_reasons(candidate, source, skill_index)
    eligible = len(reasons) == 0
    representative_tasks = select_representative_tasks(current_skill or {}, candidate, task_limit)
    current_quality = current_skill.get("qualitySignals") if isinstance((current_skill or {}).get("qualitySignals"), dict) else {}
    current_recommendation = safe_str(current_quality.get("recommendation")) or "keep_current"

    return {
        "trial_id": f"shadow-trial-{uuid.uuid4().hex[:10]}",
        "candidate_id": safe_str(candidate.get("id")),
        "candidate_name": safe_str(candidate.get("name")),
        "agent_id": safe_str(agent.get("id")),
        "source": {
            "id": safe_str((source or {}).get("id") or candidate.get("sourceId")),
            "title": safe_str((source or {}).get("title") or candidate.get("sourceTitle")),
            "url": safe_str((source or {}).get("url") or candidate.get("sourceUrl")) or None,
            "trust": safe_str((source or {}).get("trust") or candidate.get("trust")) or "unknown",
        },
        "baseline_skill": {
            "name": safe_str((current_skill or {}).get("name")) or None,
            "state": safe_str((current_skill or {}).get("state")) or None,
            "contract_score": (current_quality.get("descriptionCompletenessScore") if isinstance(current_quality, dict) else None),
            "review_status": (current_quality.get("reviewStatus") if isinstance(current_quality, dict) else None),
            "current_recommendation": current_recommendation,
        },
        "candidate": {
            "summary": safe_str(candidate.get("summary")),
            "recommendation": safe_str(candidate.get("recommendation")),
            "promotion_status": safe_str(candidate.get("promotionStatus")),
            "trial_status": safe_str(candidate.get("trialStatus")),
            "target_skills": target_skills,
        },
        "representative_tasks": representative_tasks,
        "evaluation_policy": {
            "mode": "shadow",
            "promotion_gate": "human_approve",
            "baseline_compare": "same_eval_and_grader_rules",
            "hard_gates": {
                "task_success_rate_max_regression_pp": 5,
                "verification_pass_rate_max_regression_pp": 5,
                "time_to_solution_max_regression_pct": 15,
            },
            "watch_metrics": [
                "token_cost_per_completed_task",
                "fallback_rate",
                "human_correction_rate",
            ],
        },
        "eligible": eligible,
        "block_reasons": reasons,
    }


def build_trial_plan(registry: dict[str, Any], agent_id: str, task_limit: int) -> dict[str, Any]:
    agent = find_agent(registry, agent_id)
    skill_index = build_skill_index(agent)
    source_index = build_source_index(agent)
    raw_candidates = [item for item in safe_list(agent.get("externalSkillCandidates")) if isinstance(item, dict)]

    trial_items = [
        build_trial_item(agent, candidate, source_index.get(safe_str(candidate.get("sourceId"))), skill_index, task_limit)
        for candidate in raw_candidates
    ]
    eligible = [item for item in trial_items if item["eligible"]]
    blocked = [item for item in trial_items if not item["eligible"]]

    return {
        "generated_at": utc_now_iso(),
        "version": "skill_shadow_trial_plan.v1",
        "agent_id": agent_id,
        "policy": {
            "source_policy": "official-first",
            "trial_mode": "shadow",
            "promotion_gate": "human_approve",
        },
        "sources_analyzed": [
            {
                "id": safe_str(item.get("id")),
                "title": safe_str(item.get("title")),
                "trust": safe_str(item.get("trust")),
                "kind": safe_str(item.get("kind")),
                "usagePolicy": safe_str(item.get("usagePolicy")),
            }
            for item in source_index.values()
        ],
        "summary": {
            "candidates_total": len(trial_items),
            "eligible_total": len(eligible),
            "blocked_total": len(blocked),
        },
        "trials": trial_items,
    }


@dataclass
class TrialGateThresholds:
    task_success_rate_max_regression_pp: float = 5.0
    verification_pass_rate_max_regression_pp: float = 5.0
    time_to_solution_max_regression_pct: float = 15.0
    token_cost_max_regression_pct: float = 20.0
    fallback_rate_max_regression_pp: float = 10.0
    human_correction_rate_max_regression_pp: float = 5.0
    minimum_sample_size: int = 3


@dataclass
class CapabilityOptimizationPolicy:
    enabled: bool = True
    refresh_mode: str = "on_run"
    source_policy: str = "official_first"
    trial_mode: str = "shadow"
    promotion_mode: str = "human_approve"
    min_shadow_sample_size: int = 3
    stale_after_hours: int = 168


def repo_rel_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT_DIR).as_posix()
    except ValueError:
        return str(path)


def capability_trials_dir(agent_id: str) -> Path:
    return DEFAULT_CAPABILITY_TRIALS_DIR / safe_str(agent_id)


def default_agent_plan_path(agent_id: str) -> Path:
    return capability_trials_dir(agent_id) / "shadow_trial_plan.json"


def default_agent_judgement_path(agent_id: str) -> Path:
    return capability_trials_dir(agent_id) / "shadow_trial_judgement.json"


def default_agent_snapshot_path(agent_id: str) -> Path:
    return capability_trials_dir(agent_id) / "capability_snapshot.json"


def load_json_if_exists(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def resolve_capability_optimization(agent: dict[str, Any]) -> CapabilityOptimizationPolicy:
    raw = safe_dict(agent.get("capabilityOptimization"))

    def _int_value(key: str, default: int) -> int:
        value = raw.get(key)
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        try:
            return int(str(value).strip())
        except (TypeError, ValueError):
            return default

    return CapabilityOptimizationPolicy(
        enabled=bool(raw.get("enabled", True)),
        refresh_mode=safe_str(raw.get("refreshMode")) or "on_run",
        source_policy=safe_str(raw.get("sourcePolicy")) or "official_first",
        trial_mode=safe_str(raw.get("trialMode")) or "shadow",
        promotion_mode=safe_str(raw.get("promotionMode")) or "human_approve",
        min_shadow_sample_size=max(1, _int_value("minShadowSampleSize", 3)),
        stale_after_hours=max(1, _int_value("staleAfterHours", 168)),
    )


def stable_json_dumps(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def build_source_fingerprint_payload(agent: dict[str, Any]) -> dict[str, Any]:
    return {
        "capabilityOptimization": safe_dict(agent.get("capabilityOptimization")),
        "usedSkills": safe_list(agent.get("usedSkills")),
        "availableSkills": safe_list(agent.get("availableSkills")),
        "usedTools": safe_list(agent.get("usedTools")),
        "availableTools": safe_list(agent.get("availableTools")),
        "usedMcp": safe_list(agent.get("usedMcp")),
        "availableMcp": safe_list(agent.get("availableMcp")),
        "rulesApplied": safe_list(agent.get("rulesApplied")),
        "skillSourceRegistry": safe_list(agent.get("skillSourceRegistry")),
        "externalSkillCandidates": safe_list(agent.get("externalSkillCandidates")),
    }


def compute_source_fingerprint(agent: dict[str, Any]) -> str:
    payload = stable_json_dumps(build_source_fingerprint_payload(agent)).encode("utf-8")
    return hashlib.sha1(payload).hexdigest()


def evaluate_snapshot_freshness(
    snapshot: dict[str, Any] | None,
    current_fingerprint: str,
    stale_after_hours: int,
) -> tuple[str, str | None]:
    if not snapshot:
        return "stale", "snapshot_missing"
    last_refreshed_at = parse_iso8601(
        safe_str(snapshot.get("lastRefreshedAt")) or safe_str(snapshot.get("generated_at"))
    )
    if last_refreshed_at is None:
        return "stale", "missing_last_refreshed_at"
    snapshot_fingerprint = safe_str(snapshot.get("sourceFingerprint"))
    if snapshot_fingerprint != current_fingerprint:
        return "stale", "source_fingerprint_changed"
    age_hours = (dt.datetime.now(dt.timezone.utc) - last_refreshed_at).total_seconds() / 3600.0
    if age_hours > stale_after_hours:
        return "stale", f"stale_after_hours:{round(age_hours, 1)}>{stale_after_hours}"
    return "fresh", None


def select_best_external_candidate(skill_name: str, candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    trust_rank = {"official": 0, "curated": 1, "discovery_only": 2, "rejected": 3}
    recommendation_rank = {
        "replace_after_trial": 0,
        "trial_alternative": 1,
        "keep_current": 2,
        "rewrite_current": 3,
    }
    trial_rank = {
        "passed": 0,
        "running": 1,
        "scheduled": 2,
        "not_started": 3,
        "failed": 4,
    }
    skill_key = safe_str(skill_name).lower()
    ranked = [
        item
        for item in candidates
        if skill_key in {name.lower() for name in safe_list_str(item.get("targetSkills"))}
    ]
    ranked.sort(
        key=lambda item: (
            trust_rank.get(safe_str(item.get("trust")).lower(), 99),
            recommendation_rank.get(safe_str(item.get("recommendation")).lower(), 99),
            trial_rank.get(safe_str(item.get("trialStatus")).lower(), 99),
        )
    )
    return ranked[0] if ranked else None


def load_agent_judgements(agent_id: str, judgement_path: Path | None = None) -> tuple[list[dict[str, Any]], str | None]:
    candidate_paths: list[Path] = []
    explicit = judgement_path or default_agent_judgement_path(agent_id)
    candidate_paths.append(explicit)
    if safe_str(agent_id) == "analyst-agent":
        candidate_paths.append(DEFAULT_JUDGEMENT_PATH)

    for path in candidate_paths:
        if not path.exists():
            continue
        try:
            parsed = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        raw_items = parsed if isinstance(parsed, list) else [parsed]
        items = [
            item
            for item in raw_items
            if isinstance(item, dict) and safe_str(item.get("agent_id")) == safe_str(agent_id)
        ]
        if items:
            return items, repo_rel_path(path)
    return [], None


def index_judgements_by_candidate(judgements: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for item in judgements:
        candidate_id = safe_str(item.get("candidate_id"))
        if candidate_id:
            index[candidate_id] = item
    return index


def index_trials_by_candidate(plan_payload: dict[str, Any]) -> dict[str, dict[str, Any]]:
    index: dict[str, dict[str, Any]] = {}
    for item in safe_list(plan_payload.get("trials")):
        if not isinstance(item, dict):
            continue
        candidate_id = safe_str(item.get("candidate_id"))
        if candidate_id:
            index[candidate_id] = item
    return index


def build_capability_rows(
    agent: dict[str, Any],
    *,
    plan_payload: dict[str, Any],
    judgements: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    candidates = [item for item in safe_list(agent.get("externalSkillCandidates")) if isinstance(item, dict)]
    judgements_by_candidate = index_judgements_by_candidate(judgements)
    trials_by_candidate = index_trials_by_candidate(plan_payload)

    def build_row(
        *,
        capability_type: str,
        name: str,
        state_label: str,
        source_label: str,
        source_url: str | None,
        trust_label: str,
        decision_guidance: dict[str, Any],
        quality_signals: dict[str, Any],
        best_candidate: dict[str, Any] | None,
    ) -> dict[str, Any]:
        candidate_id = safe_str((best_candidate or {}).get("id"))
        plan_trial = trials_by_candidate.get(candidate_id) if candidate_id else None
        judgement = judgements_by_candidate.get(candidate_id) if candidate_id else None
        decision_status = (
            safe_str((judgement or {}).get("recommendation"))
            or safe_str((best_candidate or {}).get("recommendation"))
            or safe_str(quality_signals.get("recommendation"))
            or "keep_current"
        )
        decision_reason = (
            safe_str((best_candidate or {}).get("recommendationReason"))
            or safe_str((judgement or {}).get("evidence_note"))
            or (safe_list_str((judgement or {}).get("blockers"))[0] if judgement else "")
            or (
                safe_list_str((plan_trial or {}).get("block_reasons"))[0]
                if plan_trial and safe_list_str((plan_trial or {}).get("block_reasons"))
                else ""
            )
            or None
        )
        return {
            "key": f"{capability_type}:{safe_str(name).lower()}",
            "type": capability_type,
            "name": safe_str(name),
            "stateLabel": state_label,
            "sourceLabel": source_label,
            "sourceUrl": source_url,
            "trustLabel": trust_label,
            "decisionGuidance": decision_guidance,
            "qualitySignals": quality_signals,
            "bestCandidate": best_candidate,
            "planTrial": plan_trial,
            "judgement": judgement,
            "decisionStatus": decision_status,
            "decisionReason": decision_reason,
        }

    for item in safe_list(agent.get("usedSkills")):
        if not isinstance(item, dict):
            continue
        name = safe_str(item.get("name"))
        if not name:
            continue
        rows.append(
            build_row(
                capability_type="skill",
                name=name,
                state_label="used",
                source_label=safe_str(item.get("skillFilePath")) or "SKILL.md",
                source_url=None,
                trust_label="approved",
                decision_guidance=safe_dict(item.get("decisionGuidance")),
                quality_signals=safe_dict(item.get("qualitySignals")),
                best_candidate=select_best_external_candidate(name, candidates),
            )
        )

    for item in safe_list(agent.get("availableSkills")):
        if not isinstance(item, dict):
            continue
        name = safe_str(item.get("name"))
        if not name:
            continue
        rows.append(
            build_row(
                capability_type="skill",
                name=name,
                state_label="available",
                source_label=safe_str(item.get("link")) or "docs/agents/registry.yaml#availableSkills",
                source_url=safe_str(item.get("link")) or None,
                trust_label="approved",
                decision_guidance=safe_dict(item.get("decisionGuidance")),
                quality_signals=safe_dict(item.get("qualitySignals")),
                best_candidate=select_best_external_candidate(name, candidates),
            )
        )

    for item in safe_list(agent.get("usedTools")):
        if not isinstance(item, dict):
            continue
        name = safe_str(item.get("name"))
        if not name:
            continue
        rows.append(
            build_row(
                capability_type="tool",
                name=name,
                state_label="used",
                source_label=safe_str(item.get("source")) or "docs/agents/registry.yaml#usedTools",
                source_url=safe_str(item.get("source")) or None,
                trust_label="approved",
                decision_guidance=safe_dict(item.get("decisionGuidance")),
                quality_signals=safe_dict(item.get("qualitySignals")),
                best_candidate=None,
            )
        )

    for item in safe_list(agent.get("availableTools")):
        if not isinstance(item, dict):
            continue
        name = safe_str(item.get("name"))
        if not name:
            continue
        rows.append(
            build_row(
                capability_type="tool",
                name=name,
                state_label="available",
                source_label=safe_str(item.get("source")) or "docs/agents/registry.yaml#availableTools",
                source_url=safe_str(item.get("source")) or None,
                trust_label="approved",
                decision_guidance=safe_dict(item.get("decisionGuidance")),
                quality_signals=safe_dict(item.get("qualitySignals")),
                best_candidate=None,
            )
        )

    for item in safe_list(agent.get("usedMcp")):
        if not isinstance(item, dict):
            continue
        name = safe_str(item.get("name"))
        if not name:
            continue
        rows.append(
            build_row(
                capability_type="mcp",
                name=name,
                state_label="used",
                source_label="docs/agents/registry.yaml#usedMcp",
                source_url=None,
                trust_label="approved",
                decision_guidance=safe_dict(item.get("decisionGuidance")),
                quality_signals=safe_dict(item.get("qualitySignals")),
                best_candidate=None,
            )
        )

    for item in safe_list(agent.get("availableMcp")):
        if not isinstance(item, dict):
            continue
        name = safe_str(item.get("name"))
        if not name:
            continue
        rows.append(
            build_row(
                capability_type="mcp",
                name=name,
                state_label="available",
                source_label=safe_str(item.get("link")) or "docs/agents/registry.yaml#availableMcp",
                source_url=safe_str(item.get("link")) or None,
                trust_label="approved",
                decision_guidance=safe_dict(item.get("decisionGuidance")),
                quality_signals=safe_dict(item.get("qualitySignals")),
                best_candidate=None,
            )
        )

    for item in safe_list(agent.get("rulesApplied")):
        if not isinstance(item, dict):
            continue
        title = safe_str(item.get("title"))
        if not title:
            continue
        rows.append(
            build_row(
                capability_type="rule",
                name=title,
                state_label="applied",
                source_label=safe_str(item.get("location")) or safe_str(item.get("sourceUrl")) or "docs/agents/registry.yaml#rulesApplied",
                source_url=safe_str(item.get("sourceUrl")) or None,
                trust_label="approved",
                decision_guidance=safe_dict(item.get("decisionGuidance")),
                quality_signals=safe_dict(item.get("qualitySignals")),
                best_candidate=None,
            )
        )

    order = {"skill": 0, "tool": 1, "mcp": 2, "rule": 3}
    rows.sort(key=lambda item: (order.get(safe_str(item.get("type")), 99), safe_str(item.get("name")).lower()))
    return rows


def build_capability_snapshot(
    registry: dict[str, Any],
    agent_id: str,
    *,
    last_run_id: str | None,
    plan_payload: dict[str, Any],
    judgements: list[dict[str, Any]],
    judgement_path: str | None,
    snapshot_path: Path,
) -> dict[str, Any]:
    agent = find_agent(registry, agent_id)
    policy = resolve_capability_optimization(agent)
    rows = build_capability_rows(agent, plan_payload=plan_payload, judgements=judgements)
    source_fingerprint = compute_source_fingerprint(agent)
    generated_at = utc_now_iso()
    judged_total = sum(1 for row in rows if isinstance(row.get("judgement"), dict))
    external_candidates_total = len([row for row in rows if isinstance(row.get("bestCandidate"), dict)])
    blocked_by_policy_total = sum(
        1
        for row in rows
        if safe_list_str(safe_dict(row.get("planTrial")).get("block_reasons"))
    )

    return {
        "generated_at": generated_at,
        "version": CAPABILITY_SNAPSHOT_VERSION,
        "agentId": agent_id,
        "lastRefreshedAt": generated_at,
        "lastRunId": last_run_id,
        "refreshMode": policy.refresh_mode,
        "sourceFingerprint": source_fingerprint,
        "freshnessStatus": "fresh",
        "staleReason": None,
        "staleAfterHours": policy.stale_after_hours,
        "planArtifactPath": repo_rel_path(default_agent_plan_path(agent_id)),
        "judgementArtifactPath": judgement_path,
        "snapshotArtifactPath": repo_rel_path(snapshot_path),
        "tableRows": rows,
        "summary": {
            "rowsTotal": len(rows),
            "externalCandidatesTotal": external_candidates_total,
            "judgedTotal": judged_total,
            "blockedByPolicyTotal": blocked_by_policy_total,
            "eligibleTrialsTotal": int(safe_dict(plan_payload.get("summary")).get("eligible_total") or 0),
        },
    }


def refresh_agent_capabilities(
    *,
    registry: dict[str, Any],
    agent_id: str,
    last_run_id: str | None = None,
    tasks_per_trial: int = 3,
) -> dict[str, Any]:
    agent = find_agent(registry, agent_id)
    policy = resolve_capability_optimization(agent)
    if not policy.enabled:
        return {
            "agent_id": agent_id,
            "enabled": False,
            "reason": "capability_optimization_disabled",
        }

    plan_path = default_agent_plan_path(agent_id)
    snapshot_path = default_agent_snapshot_path(agent_id)
    existing_snapshot = load_json_if_exists(snapshot_path)
    current_fingerprint = compute_source_fingerprint(agent)
    stale_before_status, stale_before_reason = evaluate_snapshot_freshness(
        existing_snapshot,
        current_fingerprint,
        policy.stale_after_hours,
    )

    trial_task_limit = max(tasks_per_trial, policy.min_shadow_sample_size)
    plan_payload = build_trial_plan(registry, agent_id, trial_task_limit)
    write_json(plan_path, plan_payload)

    judgements, judgement_path = load_agent_judgements(agent_id)
    snapshot = build_capability_snapshot(
        registry,
        agent_id,
        last_run_id=last_run_id,
        plan_payload=plan_payload,
        judgements=judgements,
        judgement_path=judgement_path,
        snapshot_path=snapshot_path,
    )
    snapshot["staleBeforeRefresh"] = stale_before_status == "stale"
    snapshot["staleBeforeRefreshReason"] = stale_before_reason
    write_json(snapshot_path, snapshot)

    return {
        "agent_id": agent_id,
        "enabled": True,
        "plan_path": repo_rel_path(plan_path),
        "judgement_path": judgement_path,
        "snapshot_path": repo_rel_path(snapshot_path),
        "stale_before_refresh": stale_before_status == "stale",
        "stale_before_refresh_reason": stale_before_reason,
        "plan_summary": safe_dict(plan_payload.get("summary")),
        "judgements_total": len(judgements),
        "snapshot": snapshot,
    }


def _metric(payload: dict[str, Any], key: str) -> float | None:
    value = payload.get(key)
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def judge_trial_result(payload: dict[str, Any], thresholds: TrialGateThresholds) -> dict[str, Any]:
    baseline = payload.get("baseline") if isinstance(payload.get("baseline"), dict) else {}
    shadow = payload.get("shadow") if isinstance(payload.get("shadow"), dict) else {}
    baseline_contract_score = _metric(payload.get("baseline_skill") if isinstance(payload.get("baseline_skill"), dict) else {}, "contract_score")
    comparisons: list[dict[str, Any]] = []
    blockers: list[str] = []
    hard_gate_blockers: list[str] = []
    improvements = 0
    sample_size_raw = payload.get("sample_size")
    sample_size = int(sample_size_raw) if isinstance(sample_size_raw, (int, float)) else None
    evidence_refs = safe_list_str(payload.get("evidence_refs"))
    evidence_note = safe_str(payload.get("evidence_note")) or None
    trial_task_id = safe_str(payload.get("task_id")) or None

    def compare_not_worse(metric_key: str, label: str, max_regression_pp: float) -> None:
        nonlocal improvements
        base = _metric(baseline, metric_key)
        cand = _metric(shadow, metric_key)
        if base is None or cand is None:
            comparisons.append({"metric": label, "status": "missing", "baseline": base, "shadow": cand})
            return
        delta = cand - base
        status = "pass" if delta >= -max_regression_pp else "fail"
        if status == "fail":
            hard_gate_blockers.append(label)
        if delta > 0:
            improvements += 1
        comparisons.append({"metric": label, "status": status, "baseline": base, "shadow": cand, "delta_pp": round(delta, 2)})

    def compare_time(metric_key: str, label: str, max_regression_pct: float) -> None:
        nonlocal improvements
        base = _metric(baseline, metric_key)
        cand = _metric(shadow, metric_key)
        if base is None or cand is None or base == 0:
            comparisons.append({"metric": label, "status": "missing", "baseline": base, "shadow": cand})
            return
        regression_pct = ((cand - base) / base) * 100
        status = "pass" if regression_pct <= max_regression_pct else "fail"
        if status == "fail":
            hard_gate_blockers.append(label)
        if regression_pct < 0:
            improvements += 1
        comparisons.append({"metric": label, "status": status, "baseline": base, "shadow": cand, "delta_pct": round(regression_pct, 2)})

    def compare_watch(metric_key: str, label: str, max_regression_pp: float) -> None:
        nonlocal improvements
        base = _metric(baseline, metric_key)
        cand = _metric(shadow, metric_key)
        if base is None or cand is None:
            comparisons.append({"metric": label, "status": "missing", "baseline": base, "shadow": cand})
            return
        delta = cand - base
        status = "watch" if delta <= max_regression_pp else "regression"
        if delta < 0:
            improvements += 1
        comparisons.append({"metric": label, "status": status, "baseline": base, "shadow": cand, "delta_pp": round(delta, 2)})

    compare_not_worse("taskSuccessRate", "task_success_rate", thresholds.task_success_rate_max_regression_pp)
    compare_not_worse("verificationPassRate", "verification_pass_rate", thresholds.verification_pass_rate_max_regression_pp)
    compare_time("timeToSolutionMin", "time_to_solution_min", thresholds.time_to_solution_max_regression_pct)
    compare_watch("tokenCostPerCompletedTask", "token_cost_per_completed_task", thresholds.token_cost_max_regression_pct)
    compare_watch("fallbackRate", "fallback_rate", thresholds.fallback_rate_max_regression_pp)
    compare_watch("humanCorrectionRate", "human_correction_rate", thresholds.human_correction_rate_max_regression_pp)

    blockers.extend(hard_gate_blockers)
    if sample_size is not None and sample_size < thresholds.minimum_sample_size:
        blockers.append(f"insufficient_sample_size:{sample_size}/{thresholds.minimum_sample_size}")

    if hard_gate_blockers:
        if baseline_contract_score is not None and baseline_contract_score < 75:
            recommendation = "rewrite_current"
        else:
            recommendation = "keep_current"
    elif sample_size is not None and sample_size < thresholds.minimum_sample_size:
        recommendation = "keep_current"
    else:
        recommendation = "replace_after_trial" if improvements >= 2 else "keep_current"

    return {
        "generated_at": utc_now_iso(),
        "version": "skill_shadow_trial_judgement.v1",
        "trial_id": safe_str(payload.get("trial_id")),
        "candidate_id": safe_str(payload.get("candidate_id")),
        "agent_id": safe_str(payload.get("agent_id")),
        "task_id": trial_task_id,
        "sample_size": sample_size,
        "minimum_sample_size": thresholds.minimum_sample_size,
        "evidence_note": evidence_note,
        "evidence_refs": evidence_refs,
        "recommendation": recommendation,
        "human_approval_required": True,
        "comparisons": comparisons,
        "blockers": blockers,
    }


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Plan and judge shadow-trials for external skill candidates.")
    sub = parser.add_subparsers(dest="command", required=True)

    plan = sub.add_parser("plan", help="Build a shadow-trial plan from registry externalSkillCandidates.")
    plan.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    plan.add_argument("--agent-id", default="analyst-agent")
    plan.add_argument("--tasks-per-trial", type=int, default=3)
    plan.add_argument("--out-json", default=str(DEFAULT_PLAN_PATH))

    judge = sub.add_parser("judge", help="Judge baseline vs shadow metrics and emit promotion recommendation.")
    judge.add_argument("--input-json", required=True)
    judge.add_argument("--out-json", default=str(DEFAULT_JUDGEMENT_PATH))

    refresh = sub.add_parser("refresh", help="Refresh per-agent capability plan/snapshot from registry.")
    refresh.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    refresh.add_argument("--agent-id", default=None)
    refresh.add_argument("--all-agents", action="store_true")
    refresh.add_argument("--run-id", default=None)
    refresh.add_argument("--tasks-per-trial", type=int, default=3)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)

    if args.command == "plan":
        registry = load_registry(Path(args.registry))
        payload = build_trial_plan(registry, args.agent_id, args.tasks_per_trial)
        write_json(Path(args.out_json), payload)
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    if args.command == "refresh":
        registry = load_registry(Path(args.registry))
        if args.all_agents:
            agent_ids = [
                safe_str(item.get("id"))
                for item in safe_list(registry.get("agents"))
                if isinstance(item, dict) and safe_str(item.get("id"))
            ]
        else:
            agent_ids = [safe_str(args.agent_id) or "analyst-agent"]
        results = [
            refresh_agent_capabilities(
                registry=registry,
                agent_id=agent_id,
                last_run_id=safe_str(args.run_id) or None,
                tasks_per_trial=int(args.tasks_per_trial),
            )
            for agent_id in agent_ids
        ]
        payload = {
            "generated_at": utc_now_iso(),
            "version": "capability_refresh_batch.v1",
            "results": results,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    trial_input = json.loads(Path(args.input_json).read_text(encoding="utf-8"))
    payload = judge_trial_result(trial_input, TrialGateThresholds())
    write_json(Path(args.out_json), payload)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
