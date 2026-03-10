#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib import error, parse, request

try:
    import candidate_processor  # type: ignore[import-not-found]
except ModuleNotFoundError:
    _candidate_path = Path(__file__).resolve().with_name("candidate_processor.py")
    _candidate_spec = importlib.util.spec_from_file_location("candidate_processor", _candidate_path)
    if _candidate_spec is None or _candidate_spec.loader is None:
        raise
    candidate_processor = importlib.util.module_from_spec(_candidate_spec)  # type: ignore[assignment]
    _candidate_spec.loader.exec_module(candidate_processor)  # type: ignore[attr-defined]


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")


def to_iso_utc(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def as_text(value: Any) -> str:
    return str(value or "").strip()


def parse_float(value: str, default: float) -> float:
    raw = as_text(value)
    if not raw:
        return float(default)
    try:
        return float(raw)
    except ValueError:
        return float(default)


def parse_int(value: str, default: int) -> int:
    raw = as_text(value)
    if not raw:
        return int(default)
    try:
        return int(raw)
    except ValueError:
        return int(default)


class HttpJsonClient:
    def __init__(self, timeout_sec: int = 30):
        self.timeout_sec = int(timeout_sec)

    def request_json(
        self,
        *,
        method: str,
        url: str,
        headers: dict[str, str] | None = None,
        payload: Any | None = None,
    ) -> Any:
        data: bytes | None = None
        request_headers: dict[str, str] = {}
        if headers:
            request_headers.update(headers)
        if payload is not None:
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            request_headers.setdefault("Content-Type", "application/json")
        req = request.Request(url=url, data=data, method=method.upper(), headers=request_headers)
        try:
            with request.urlopen(req, timeout=self.timeout_sec) as response:
                body = response.read().decode("utf-8")
                if not body:
                    return None
                return json.loads(body)
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"http_error:{method.upper()}:{url}:{exc.code}:{detail[:240]}") from exc


@dataclass
class RunnerConfig:
    batch_limit: int
    baseline_volatility: float
    uplift_threshold: float
    target_metric: str
    task_id: str
    run_id: str
    cutoff_iso: str
    reply_enabled: bool
    dry_run: bool


class SupabaseRuntime:
    def __init__(self, *, base_url: str, service_role_key: str, http: HttpJsonClient):
        self.base_url = base_url.rstrip("/")
        self.service_role_key = service_role_key
        self.http = http

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    def _build_url(self, table: str, params: list[tuple[str, str]] | None = None) -> str:
        query = parse.urlencode(params or [], doseq=True, safe=".:,_-+")
        if query:
            return f"{self.base_url}/rest/v1/{table}?{query}"
        return f"{self.base_url}/rest/v1/{table}"

    def fetch_pending(self, *, cutoff_iso: str, limit: int) -> list[dict[str, Any]]:
        params = [
            ("select", "candidate_id,source_key,telegram_chat_id,telegram_message_id,text,links,status,received_at"),
            ("status", "eq.candidate_received"),
            ("received_at", f"lte.{cutoff_iso}"),
            ("order", "received_at.asc"),
            ("limit", str(limit)),
        ]
        url = self._build_url("candidate_inbox", params)
        data = self.http.request_json(method="GET", url=url, headers=self._headers)
        if not isinstance(data, list):
            return []
        return [item for item in data if isinstance(item, dict)]

    def claim_candidate(self, source_key: str) -> bool:
        params = [("source_key", f"eq.{source_key}"), ("status", "eq.candidate_received")]
        headers = dict(self._headers)
        headers["Prefer"] = "return=representation"
        url = self._build_url("candidate_inbox", params)
        data = self.http.request_json(method="PATCH", url=url, headers=headers, payload={"status": "processing"})
        return isinstance(data, list) and len(data) > 0

    def set_status(self, *, source_key: str, from_status: str, to_status: str) -> bool:
        params = [("source_key", f"eq.{source_key}"), ("status", f"eq.{from_status}")]
        headers = dict(self._headers)
        headers["Prefer"] = "return=representation"
        url = self._build_url("candidate_inbox", params)
        data = self.http.request_json(method="PATCH", url=url, headers=headers, payload={"status": to_status})
        return isinstance(data, list) and len(data) > 0

    def upsert_assessment(self, payload: dict[str, Any]) -> None:
        params = [("on_conflict", "candidate_id")]
        headers = dict(self._headers)
        headers["Prefer"] = "resolution=merge-duplicates,return=representation"
        url = self._build_url("candidate_assessment", params)
        self.http.request_json(method="POST", url=url, headers=headers, payload=payload)


class TelegramRuntime:
    def __init__(self, *, bot_token: str, http: HttpJsonClient):
        self.bot_token = bot_token
        self.http = http

    def send_reply(self, *, chat_id: str, reply_to_message_id: str, text: str) -> None:
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            "chat_id": as_text(chat_id),
            "reply_to_message_id": parse_int(as_text(reply_to_message_id), 0),
            "text": text,
            "disable_web_page_preview": True,
        }
        self.http.request_json(method="POST", url=url, payload=payload)


class WebhookRelayRuntime:
    def __init__(self, *, webhook_url: str, http: HttpJsonClient):
        self.webhook_url = webhook_url
        self.http = http

    def send_reply(self, *, chat_id: str, reply_to_message_id: str, text: str) -> None:
        payload = {
            "chat_id": as_text(chat_id),
            "reply_to_message_id": parse_int(as_text(reply_to_message_id), 0),
            "text": text,
        }
        self.http.request_json(method="POST", url=self.webhook_url, payload=payload)


def format_objective_risks(risks: list[dict[str, Any]]) -> str:
    if not risks:
        return "- объективные риски не подтверждены"
    lines: list[str] = []
    for item in risks:
        if not isinstance(item, dict):
            continue
        risk_id = as_text(item.get("risk_id")) or "risk"
        description = as_text(item.get("description")) or "описание отсутствует"
        evidence = as_text(item.get("evidence")) or "evidence_missing"
        lines.append(f"- {risk_id}: {description} (evidence: {evidence})")
    if not lines:
        return "- объективные риски не подтверждены"
    return "\n".join(lines)


def build_decision_message(assessment: dict[str, Any], *, run_id: str) -> str:
    candidate_id = as_text(assessment.get("candidate_id")).replace("_", "-") or "n/a"
    decision = as_text(assessment.get("decision"))
    applicability = as_text(assessment.get("applicability")) or "n/a"
    target_metric = as_text(assessment.get("target_metric")) or "n/a"
    expected_delta = assessment.get("expected_delta", 0)
    cycles_required = assessment.get("cycles_required", 3)
    risks = assessment.get("objective_risks")
    objective_risks = risks if isinstance(risks, list) else []
    risks_text = format_objective_risks(objective_risks)

    if decision == "accept_for_ab":
        status_line = "Статус: взят в A/B (через daily-cycle analyst-agent)"
        title = "Решение по candidate: взят в A/B"
    else:
        status_line = "Статус: в A/B не взят"
        title = "Решение по candidate: отклонен"

    return "\n".join(
        [
            title,
            f"ID: {candidate_id}",
            f"Применимость: {applicability}",
            f"Целевая метрика: {target_metric}",
            f"Ожидаемый эффект: +{expected_delta}%",
            f"Циклов до решения: {cycles_required}",
            "Риски:",
            risks_text,
            status_line,
            f"Run-ID: {run_id}",
        ]
    )


def build_assessment_payload(candidate: dict[str, Any], assessment: dict[str, Any]) -> dict[str, Any]:
    return {
        "candidate_id": as_text(assessment.get("candidate_id")),
        "source_key": as_text(candidate.get("source_key")),
        "decision": as_text(assessment.get("decision")),
        "applicability": as_text(assessment.get("applicability")),
        "target_metric": as_text(assessment.get("target_metric")),
        "baseline_value": assessment.get("baseline_value"),
        "expected_delta": assessment.get("expected_delta"),
        "objective_risks": assessment.get("objective_risks"),
        "cycles_required": assessment.get("cycles_required"),
        "status": as_text(assessment.get("status")),
        "decided_at": as_text(assessment.get("decided_at")),
    }


def final_status_from_decision(decision: str) -> str:
    if as_text(decision) == "accept_for_ab":
        return "ab_test_started"
    return "candidate_rejected"


def _normalize_risks(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _normalize_decision_value(
    candidate: dict[str, Any],
    raw: dict[str, Any],
    *,
    config: RunnerConfig,
) -> dict[str, Any]:
    decision = as_text(raw.get("decision")).lower()
    if decision not in {"accept_for_ab", "candidate_rejected"}:
        raise ValueError("invalid_decision")
    applicability = as_text(raw.get("applicability")).lower() or "medium"
    if applicability not in {"low", "medium", "high"}:
        applicability = "medium"
    cycles_required = max(3, min(8, parse_int(as_text(raw.get("cycles_required")), 3)))
    expected_delta = parse_float(as_text(raw.get("expected_delta")), 0.0)
    target_metric = as_text(raw.get("target_metric")) or config.target_metric
    objective_risks = _normalize_risks(raw.get("objective_risks"))
    status = "candidate_assessed" if decision == "accept_for_ab" else "candidate_rejected"
    return {
        "candidate_id": as_text(candidate.get("candidate_id")),
        "decision": decision,
        "applicability": applicability,
        "target_metric": target_metric,
        "baseline_value": None,
        "expected_delta": round(float(expected_delta), 2),
        "objective_risks": objective_risks,
        "cycles_required": cycles_required,
        "status": status,
        "decided_at": utc_now_iso(),
    }


def load_decisions(path: str) -> dict[str, dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as file:
        payload = json.load(file)
    if not isinstance(payload, dict):
        raise ValueError("decisions_json_must_be_object")
    by_key: dict[str, dict[str, Any]] = {}
    rows = payload.get("decisions")
    if not isinstance(rows, list):
        raise ValueError("decisions_json_missing_decisions_array")
    for row in rows:
        if not isinstance(row, dict):
            continue
        source_key = as_text(row.get("source_key"))
        candidate_id = as_text(row.get("candidate_id"))
        if source_key:
            by_key[f"source_key:{source_key}"] = row
        if candidate_id:
            by_key[f"candidate_id:{candidate_id}"] = row
    return by_key


def process_candidates(
    pending_rows: list[dict[str, Any]],
    *,
    config: RunnerConfig,
    claim_candidate: Callable[[str], bool],
    assess_fn: Callable[[dict[str, Any]], dict[str, Any]],
    upsert_assessment: Callable[[dict[str, Any]], None],
    set_status: Callable[..., bool],
    send_reply: Callable[[str, str, str], None] | None,
) -> dict[str, Any]:
    def _set_status(source_key: str, from_status: str, to_status: str) -> bool:
        try:
            return bool(set_status(source_key=source_key, from_status=from_status, to_status=to_status))
        except TypeError:
            return bool(set_status(source_key, from_status, to_status))

    def _send_reply(chat_id: str, reply_to_message_id: str, text: str) -> None:
        if send_reply is None:
            return None
        try:
            send_reply(chat_id=chat_id, reply_to_message_id=reply_to_message_id, text=text)
        except TypeError:
            send_reply(chat_id, reply_to_message_id, text)

    summary: dict[str, Any] = {
        "run_id": config.run_id,
        "cutoff_iso": config.cutoff_iso,
        "fetched": len(pending_rows),
        "claimed": 0,
        "processed": 0,
        "accepted_for_ab": 0,
        "rejected": 0,
        "replied": 0,
        "skipped_already_processing": 0,
        "errors": [],
    }

    for candidate in pending_rows:
        source_key = as_text(candidate.get("source_key"))
        candidate_id = as_text(candidate.get("candidate_id")) or "n/a"
        if not source_key:
            summary["errors"].append({"candidate_id": candidate_id, "error": "missing_source_key"})
            continue

        if not claim_candidate(source_key):
            summary["skipped_already_processing"] += 1
            continue
        summary["claimed"] += 1

        try:
            assessed = assess_fn(candidate)
            payload = build_assessment_payload(candidate, assessed)
            final_status = final_status_from_decision(as_text(assessed.get("decision")))
            upsert_assessment(payload)
            if not _set_status(source_key=source_key, from_status="processing", to_status=final_status):
                raise RuntimeError("failed_to_finalize_status")

            summary["processed"] += 1
            if final_status == "ab_test_started":
                summary["accepted_for_ab"] += 1
            else:
                summary["rejected"] += 1

            if send_reply is not None:
                chat_id = as_text(candidate.get("telegram_chat_id"))
                reply_to = as_text(candidate.get("telegram_message_id"))
                if chat_id and reply_to:
                    text = build_decision_message(assessed, run_id=config.run_id)
                    _send_reply(chat_id, reply_to, text)
                    summary["replied"] += 1
        except Exception as exc:  # pragma: no cover - defensive rollback path
            _set_status(source_key=source_key, from_status="processing", to_status="candidate_received")
            summary["errors"].append({"candidate_id": candidate_id, "error": str(exc)})

    return summary


def build_assessor(
    config: RunnerConfig,
    decisions_by_key: dict[str, dict[str, Any]] | None = None,
) -> Callable[[dict[str, Any]], dict[str, Any]]:
    def _assess(candidate: dict[str, Any]) -> dict[str, Any]:
        if decisions_by_key:
            source_key = as_text(candidate.get("source_key"))
            candidate_id = as_text(candidate.get("candidate_id"))
            row = decisions_by_key.get(f"source_key:{source_key}") or decisions_by_key.get(f"candidate_id:{candidate_id}")
            if row is None:
                raise ValueError("missing_external_decision_for_candidate")
            return _normalize_decision_value(candidate, row, config=config)
        return candidate_processor.assess_candidate(
            candidate,
            baseline_volatility=float(config.baseline_volatility),
            uplift_threshold=float(config.uplift_threshold),
            target_metric=config.target_metric,
            task_id=config.task_id,
        )

    return _assess


def load_env(name: str, fallback: str = "") -> str:
    return as_text(os.getenv(name, fallback))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run daily candidate queue cycle for analyst-agent.")
    parser.add_argument("--batch-limit", type=int, default=50)
    parser.add_argument("--cutoff-iso", default="")
    parser.add_argument("--run-id", default="")
    parser.add_argument("--baseline-volatility", type=float, default=0.2)
    parser.add_argument("--uplift-threshold", type=float, default=5.0)
    parser.add_argument("--target-metric", default="recommendation_action_rate")
    parser.add_argument("--task-id", default="candidate-ab-task")
    parser.add_argument("--pending-out-json", default="")
    parser.add_argument("--decisions-json", default="")
    parser.add_argument("--reply-webhook-url", default="")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--reply-enabled", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()

    supabase_url = load_env("SUPABASE_URL")
    supabase_service_role = load_env("SUPABASE_SERVICE_ROLE_KEY")
    telegram_bot_token = load_env("TELEGRAM_BOT_TOKEN")
    reply_webhook_url = as_text(args.reply_webhook_url) or load_env("CANDIDATE_REPLY_WEBHOOK_URL")

    if not supabase_url or not supabase_service_role:
        sys.stderr.write("missing_env: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required\n")
        return 2

    run_id = as_text(args.run_id) or f"candidate-cycle-{uuid.uuid4().hex[:12]}"
    cutoff_iso = as_text(args.cutoff_iso) or to_iso_utc(utc_now())
    requested_reply = bool(args.reply_enabled)

    config = RunnerConfig(
        batch_limit=max(1, int(args.batch_limit)),
        baseline_volatility=float(args.baseline_volatility),
        uplift_threshold=float(args.uplift_threshold),
        target_metric=as_text(args.target_metric) or "recommendation_action_rate",
        task_id=as_text(args.task_id) or "candidate-ab-task",
        run_id=run_id,
        cutoff_iso=cutoff_iso,
        reply_enabled=requested_reply,
        dry_run=bool(args.dry_run),
    )

    http = HttpJsonClient(timeout_sec=parse_int(load_env("OAP_HTTP_TIMEOUT_SEC"), 30))
    supabase = SupabaseRuntime(base_url=supabase_url, service_role_key=supabase_service_role, http=http)
    send_reply_fn: Callable[[str, str, str], None] | None = None
    reply_channel = "disabled"
    if requested_reply and not args.dry_run:
        if telegram_bot_token:
            telegram = TelegramRuntime(bot_token=telegram_bot_token, http=http)
            send_reply_fn = telegram.send_reply
            reply_channel = "telegram_api"
        elif reply_webhook_url:
            relay = WebhookRelayRuntime(webhook_url=reply_webhook_url, http=http)
            send_reply_fn = relay.send_reply
            reply_channel = "n8n_webhook"
        else:
            sys.stderr.write("missing_env: TELEGRAM_BOT_TOKEN or CANDIDATE_REPLY_WEBHOOK_URL is required for --reply-enabled\n")
            return 2

    pending = supabase.fetch_pending(cutoff_iso=config.cutoff_iso, limit=config.batch_limit)
    pending_out_json = as_text(args.pending_out_json)
    if pending_out_json:
        out_path = Path(pending_out_json)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps({"run_id": config.run_id, "cutoff_iso": config.cutoff_iso, "items": pending}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    decisions_by_key: dict[str, dict[str, Any]] | None = None
    decisions_json = as_text(args.decisions_json)
    if decisions_json:
        decisions_by_key = load_decisions(decisions_json)

    assessor = build_assessor(config, decisions_by_key=decisions_by_key)

    if args.dry_run:
        def claim_candidate(_source_key: str) -> bool:
            return True

        def upsert_assessment(_payload: dict[str, Any]) -> None:
            return None

        def set_status(*, source_key: str, from_status: str, to_status: str) -> bool:
            return True

        send_reply_fn = None
    else:
        claim_candidate = supabase.claim_candidate
        upsert_assessment = supabase.upsert_assessment
        set_status = supabase.set_status
        send_reply_fn = send_reply_fn

    started = time.time()
    summary = process_candidates(
        pending,
        config=config,
        claim_candidate=claim_candidate,
        assess_fn=assessor,
        upsert_assessment=upsert_assessment,
        set_status=set_status,
        send_reply=send_reply_fn,
    )
    summary["duration_sec"] = round(time.time() - started, 3)
    summary["reply_enabled"] = bool(send_reply_fn is not None and not args.dry_run)
    summary["reply_channel"] = reply_channel if summary["reply_enabled"] else "disabled"
    summary["dry_run"] = bool(args.dry_run)
    summary["generated_at"] = utc_now_iso()

    sys.stdout.write(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
