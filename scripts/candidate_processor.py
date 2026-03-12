#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
import re
import sys
from typing import Any


URL_RE = re.compile(r"https?://[^\s]+", re.IGNORECASE)
PUNCT_TRIM_RE = re.compile(r"[),.;!?]+$")
HIGH_APPLICABILITY_TERMS = {
    "oap",
    "агент",
    "agent",
    "telemetry",
    "метрик",
    "metric",
    "workflow",
    "ab",
    "a/b",
    "mcp",
    "rls",
}
PASS_RULE_TARGET_PLUS_GUARDRAILS = "target_plus_guardrails"
DEFAULT_AB_GUARDRAILS = ["review_error_rate", "verification_pass_rate", "lesson_capture_rate"]

COLLABORATION_HINT_KEYWORDS: dict[str, tuple[str, ...]] = {
    "designer-agent": ("ui", "ux", "design", "дизайн", "карточк", "tooltip", "m3", "mui"),
    "reader-agent": ("knowledge", "kb", "докум", "retrieval", "context"),
    "analyst-agent": ("metric", "telemetry", "quality", "review", "risk", "benchmark"),
}


def utc_now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def extract_links(text: str) -> list[str]:
    if not text:
        return []
    links: list[str] = []
    seen: set[str] = set()
    for match in URL_RE.findall(text):
        normalized = PUNCT_TRIM_RE.sub("", match.strip())
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        links.append(normalized)
    return links


def make_source_key(chat_id: str, message_id: str) -> str:
    return f"telegram:{chat_id.strip()}:{message_id.strip()}"


def make_candidate_id(source_key: str, text: str) -> str:
    payload = f"{source_key}|{text.strip()}".encode("utf-8")
    digest = hashlib.sha1(payload).hexdigest()[:16]
    return f"cand_{digest}"


def parse_message(payload: dict[str, Any]) -> dict[str, Any]:
    message = payload.get("message")
    if not isinstance(message, dict):
        raise ValueError("telegram_payload_missing_message")

    chat = message.get("chat") if isinstance(message.get("chat"), dict) else {}
    chat_id = str(chat.get("id") or "").strip()
    message_id = str(message.get("message_id") or "").strip()
    if not chat_id or not message_id:
        raise ValueError("telegram_payload_missing_chat_or_message_id")

    raw_text = [message.get("text"), message.get("caption")]
    text = "\n".join(str(item).strip() for item in raw_text if isinstance(item, str) and item.strip()).strip()
    links = extract_links(text)
    source_key = make_source_key(chat_id, message_id)
    candidate_id = make_candidate_id(source_key, text)

    return {
        "candidate_id": candidate_id,
        "source": "telegram",
        "source_key": source_key,
        "telegram_chat_id": chat_id,
        "telegram_message_id": message_id,
        "text": text,
        "links": links,
        "status": "candidate_received",
        "received_at": utc_now_iso(),
    }


def infer_applicability(text: str, links: list[str]) -> str:
    lower = text.lower()
    if len(lower) < 20:
        return "low"
    has_domain_term = any(term in lower for term in HIGH_APPLICABILITY_TERMS)
    if has_domain_term and links:
        return "high"
    if has_domain_term or links:
        return "medium"
    return "low"


def infer_expected_delta(text: str, links: list[str]) -> float:
    score = 2.0
    if links:
        score += min(4.0, float(len(links)))
    lower = text.lower()
    for term in HIGH_APPLICABILITY_TERMS:
        if term in lower:
            score += 0.7
    return round(min(score, 25.0), 2)


def infer_objective_risks(candidate: dict[str, Any]) -> list[dict[str, str]]:
    text = str(candidate.get("text") or "")
    links = candidate.get("links") if isinstance(candidate.get("links"), list) else []
    risks: list[dict[str, str]] = []
    if not links:
        risks.append(
            {
                "risk_id": "risk_no_evidence_links",
                "severity": "medium",
                "evidence": "candidate.links is empty",
                "description": "Нет подтверждающих ссылок, проверяемость практики ограничена.",
            }
        )
    lower = text.lower()
    if "delete" in lower and "rollback" not in lower:
        risks.append(
            {
                "risk_id": "risk_destructive_change_without_rollback",
                "severity": "critical",
                "evidence": "Detected 'delete' intent without rollback mention in candidate text.",
                "description": "Обнаружено потенциально разрушительное изменение без стратегии отката.",
            }
        )
    return risks


def compute_cycles_required(expected_delta_pct: float, baseline_volatility: float) -> int:
    eps = 0.1
    sigma = max(float(baseline_volatility), eps)
    delta = max(float(expected_delta_pct), eps)
    cycles = int(math.ceil(((1.96 * sigma) / delta) ** 2))
    return max(3, min(8, cycles))


def infer_collaboration_hints(text: str) -> dict[str, Any]:
    lower = text.lower()
    suggested: list[str] = []
    for agent_id, keywords in COLLABORATION_HINT_KEYWORDS.items():
        if any(keyword in lower for keyword in keywords):
            suggested.append(agent_id)
    return {
        "suggested_agents": sorted(set(suggested)),
        "rationale": "Auto-hints from candidate text keywords for cross-agent execution planning.",
    }


def build_ab_plan(
    *,
    decision: str,
    target_metric: str,
    expected_delta_pct: float,
    cycles_required: int,
) -> dict[str, Any]:
    return {
        "enabled": decision == "accept_for_ab",
        "sessions_required": max(3, min(8, int(cycles_required))),
        "pass_rule": PASS_RULE_TARGET_PLUS_GUARDRAILS,
        "target_metric": target_metric,
        "expected_delta_pct": round(float(expected_delta_pct), 2),
        "guardrails": list(DEFAULT_AB_GUARDRAILS),
        "rollback_on_fail": True,
    }


def pick_cohort(candidate_id: str, task_id: str) -> dict[str, Any]:
    seed = f"{candidate_id}|{task_id}".encode("utf-8")
    bucket = int(hashlib.sha1(seed).hexdigest(), 16) % 100
    return {
        "cohort": "control" if bucket < 50 else "test",
        "bucket": bucket,
    }


def assess_candidate(
    candidate: dict[str, Any],
    *,
    baseline_volatility: float,
    uplift_threshold: float,
    target_metric: str,
    task_id: str,
) -> dict[str, Any]:
    applicability = infer_applicability(str(candidate.get("text") or ""), candidate.get("links") or [])
    expected_delta = infer_expected_delta(str(candidate.get("text") or ""), candidate.get("links") or [])
    objective_risks = infer_objective_risks(candidate)
    has_critical_risk = any(str(item.get("severity") or "").lower() == "critical" for item in objective_risks)
    decision = (
        "accept_for_ab"
        if applicability in {"high", "medium"} and expected_delta >= float(uplift_threshold) and not has_critical_risk
        else "candidate_rejected"
    )
    cycles_required = compute_cycles_required(expected_delta, baseline_volatility)
    collaboration_hints = infer_collaboration_hints(str(candidate.get("text") or ""))
    ab_plan = build_ab_plan(
        decision=decision,
        target_metric=target_metric,
        expected_delta_pct=expected_delta,
        cycles_required=cycles_required,
    )

    return {
        "candidate_id": str(candidate.get("candidate_id") or "").strip(),
        "decision": decision,
        "applicability": applicability,
        "target_metric": target_metric,
        "baseline_value": None,
        "expected_delta": expected_delta,
        "objective_risks": objective_risks,
        "cycles_required": cycles_required,
        "ab_plan": ab_plan,
        "collaboration_hints": collaboration_hints,
        "cohort_assignment": pick_cohort(str(candidate.get("candidate_id") or "").strip(), task_id),
        "decided_at": utc_now_iso(),
        "status": "candidate_assessed" if decision == "accept_for_ab" else "candidate_rejected",
    }


def load_json(path: str | None) -> Any:
    if path:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)
    raw = sys.stdin.read().strip()
    if not raw:
        raise ValueError("stdin_json_payload_required")
    return json.loads(raw)


def write_json(payload: Any, out_path: str | None) -> None:
    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if out_path:
        with open(out_path, "w", encoding="utf-8") as file:
            file.write(rendered)
        return
    sys.stdout.write(rendered)


def command_ingest(args: argparse.Namespace) -> int:
    payload = load_json(args.input_json)
    if not isinstance(payload, dict):
        raise ValueError("telegram_payload_must_be_object")
    candidate = parse_message(payload)
    write_json(candidate, args.out_json)
    return 0


def command_assess(args: argparse.Namespace) -> int:
    payload = load_json(args.input_json)
    if not isinstance(payload, dict):
        raise ValueError("candidate_payload_must_be_object")
    candidate = payload if "candidate_id" in payload else parse_message(payload)
    assessment = assess_candidate(
        candidate,
        baseline_volatility=float(args.baseline_volatility),
        uplift_threshold=float(args.uplift_threshold),
        target_metric=str(args.target_metric),
        task_id=str(args.task_id),
    )
    write_json(assessment, args.out_json)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Candidate intake and guarded-auto assessment utilities.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest = subparsers.add_parser("ingest", help="Normalize Telegram message payload to candidate contract.")
    ingest.add_argument("--input-json", default=None)
    ingest.add_argument("--out-json", default=None)
    ingest.set_defaults(handler=command_ingest)

    assess = subparsers.add_parser("assess", help="Assess candidate and decide guard-auto A/B start.")
    assess.add_argument("--input-json", default=None)
    assess.add_argument("--out-json", default=None)
    assess.add_argument("--baseline-volatility", type=float, default=0.2)
    assess.add_argument("--uplift-threshold", type=float, default=5.0)
    assess.add_argument("--target-metric", default="recommendation_action_rate")
    assess.add_argument("--task-id", default="candidate-ab-task")
    assess.set_defaults(handler=command_assess)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return int(args.handler(args))


if __name__ == "__main__":
    raise SystemExit(main())
