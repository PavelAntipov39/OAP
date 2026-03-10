#!/usr/bin/env python3
"""Generate local OAP visual review pages (diff-review / plan-review / cycle-review)."""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import shutil
import subprocess
import sys
from collections import Counter
from pathlib import Path
from typing import Iterable, Sequence


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTDIR = Path.home() / ".agent" / "diagrams"


def run(cmd: Sequence[str], cwd: Path | None = None) -> str:
    proc = subprocess.run(
        list(cmd),
        cwd=str(cwd or REPO_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}\n{proc.stderr.strip()}")
    return proc.stdout


def try_run(cmd: Sequence[str], cwd: Path | None = None) -> str | None:
    try:
        return run(cmd, cwd)
    except RuntimeError:
        return None


def resolve_base_ref(preferred: str) -> str:
    if try_run(["git", "rev-parse", "--verify", preferred], REPO_ROOT):
        return preferred
    if try_run(["git", "rev-parse", "--verify", "origin/main"], REPO_ROOT):
        return "origin/main"
    fallback = try_run(["git", "rev-parse", "--verify", "HEAD~1"], REPO_ROOT)
    if fallback:
        return "HEAD~1"
    return "HEAD"


def bucket_for(path: str) -> str:
    if path.startswith("supabase/"):
        return "DB/RPC"
    if path.startswith("ops-web/"):
        return "Ops UI"
    if path.startswith("web/"):
        return "App UI"
    if path.startswith("scripts/"):
        return "Automation"
    if path.startswith("docs/"):
        return "Docs"
    return "Other"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "task"


def filter_rows_by_artifacts(rows: Sequence[tuple[str, str]], artifact_prefixes: Sequence[str]) -> list[tuple[str, str]]:
    prefixes = [prefix.strip().lstrip("./").rstrip("/") for prefix in artifact_prefixes if prefix.strip()]
    if not prefixes:
        return list(rows)

    filtered: list[tuple[str, str]] = []
    for status, path in rows:
        normalized = path.strip().lstrip("./")
        for prefix in prefixes:
            if normalized == prefix or normalized.startswith(prefix + "/"):
                filtered.append((status, path))
                break
    return filtered


def build_diff_payload(base_ref: str, task_key: str | None = None, artifact_prefixes: Sequence[str] = ()) -> dict:
    compare_ref = f"{base_ref}...HEAD"
    diff_raw = run(["git", "diff", "--name-status", compare_ref], REPO_ROOT)
    rows_all: list[tuple[str, str]] = []
    for line in diff_raw.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t", 1)
        if len(parts) != 2:
            continue
        status, path = parts[0].strip(), parts[1].strip()
        rows_all.append((status, path))

    rows = filter_rows_by_artifacts(rows_all, artifact_prefixes)
    buckets = Counter(bucket_for(path) for _, path in rows)
    status_counts = Counter(status for status, _ in rows)
    head_sha = run(["git", "rev-parse", "--short", "HEAD"], REPO_ROOT).strip()
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "mode": "diff-review",
        "base_ref": base_ref,
        "compare_ref": compare_ref,
        "generated_at": now,
        "head_sha": head_sha,
        "task_key": task_key or "",
        "artifact_prefixes": list(artifact_prefixes),
        "rows_all_count": len(rows_all),
        "rows": rows,
        "buckets": buckets,
        "status_counts": status_counts,
    }


PATH_PATTERN = re.compile(
    r"(?:`([^`]+)`|(/Users/[^\s)]+)|((?:docs|ops-web|web|scripts|supabase|etl)/[^\s)]+))"
)

KNOWN_PATH_PREFIXES = (
    "docs/",
    "ops-web/",
    "web/",
    "scripts/",
    "supabase/",
    "etl/",
    "artifacts/",
    ".logs/",
    "logs/",
    "output/",
    "data/",
    "client/",
)
KNOWN_ROOT_FILES = {
    "AGENTS.md",
    "README.md",
    "Makefile",
    ".env.example",
    ".gitignore",
}
KNOWN_FILE_EXTENSIONS = (
    ".md",
    ".json",
    ".jsonl",
    ".yaml",
    ".yml",
    ".py",
    ".ts",
    ".tsx",
    ".sql",
    ".sh",
    ".txt",
)


def sanitize_candidate(candidate: str) -> str:
    value = candidate.strip().strip("`\"'")
    value = value.rstrip(",.;:)")
    value = value.lstrip("(")
    return value


def is_path_like(candidate: str) -> bool:
    value = candidate.strip()
    if not value:
        return False
    if any(ch.isspace() for ch in value):
        return False
    if value.startswith(("http://", "https://")):
        return False
    if "=" in value and "/" not in value and "." not in value:
        return False
    if value in KNOWN_ROOT_FILES:
        return True
    if value.startswith(("/Users/", "./", "../")):
        return True
    if value.startswith(KNOWN_PATH_PREFIXES):
        return True
    if value.startswith("/"):
        normalized = value.lstrip("/")
        if normalized.startswith(KNOWN_PATH_PREFIXES):
            return True
    if value.endswith(KNOWN_FILE_EXTENSIONS):
        return True
    if "/" in value:
        normalized = value.lstrip("./")
        first = normalized.split("/", 1)[0]
        if f"{first}/" in KNOWN_PATH_PREFIXES:
            return True
        return any(segment.endswith(KNOWN_FILE_EXTENSIONS) for segment in normalized.split("/"))
    return False


def extract_candidate_paths(text: str) -> list[str]:
    found: list[str] = []
    for match in PATH_PATTERN.finditer(text):
        candidate = match.group(1) or match.group(2) or match.group(3)
        if not candidate:
            continue
        normalized = sanitize_candidate(candidate)
        if normalized and is_path_like(normalized):
            found.append(normalized)
    return found


def normalize_path(candidate: str) -> Path:
    value = candidate.strip()
    path = Path(value)
    if path.is_absolute():
        if path.exists():
            return path
        # Treat "/docs/..." style references as repo-root-relative declarations.
        repo_relative = value.lstrip("/")
        if repo_relative:
            return REPO_ROOT / repo_relative
        return path
    return REPO_ROOT / value.lstrip("./")


def build_plan_payload(plan_path: Path) -> dict:
    text = plan_path.read_text(encoding="utf-8")
    candidates = extract_candidate_paths(text)
    unique_candidates = list(dict.fromkeys(candidates))

    file_rows: list[dict] = []
    for item in unique_candidates:
        normalized = normalize_path(item)
        file_rows.append(
            {
                "declared": item,
                "resolved": str(normalized),
                "exists": normalized.exists(),
            }
        )

    coverage = 0.0
    if file_rows:
        coverage = sum(1 for row in file_rows if row["exists"]) / len(file_rows)

    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "mode": "plan-review",
        "plan_path": str(plan_path),
        "generated_at": now,
        "file_rows": file_rows,
        "coverage": coverage,
        "plan_excerpt": text[:4000],
    }


def h(text: str) -> str:
    return html.escape(text, quote=True)


def make_diff_mermaid(payload: dict) -> str:
    buckets = payload["buckets"]
    parts = [
        'A["Diff scope"] --> B["DB/RPC: %d"]' % buckets.get("DB/RPC", 0),
        'A --> C["Ops UI: %d"]' % buckets.get("Ops UI", 0),
        'A --> D["App UI: %d"]' % buckets.get("App UI", 0),
        'A --> E["Automation: %d"]' % buckets.get("Automation", 0),
        'A --> F["Docs: %d"]' % buckets.get("Docs", 0),
    ]
    return "flowchart LR\n  " + "\n  ".join(parts)


def make_plan_mermaid(payload: dict) -> str:
    total = len(payload["file_rows"])
    found = sum(1 for row in payload["file_rows"] if row["exists"])
    missing = total - found
    return (
        "flowchart LR\n"
        '  A["Plan input"] --> B["File refs: %d"]\n'
        '  B --> C["Found in repo: %d"]\n'
        '  B --> D["Missing refs: %d"]\n'
        '  C --> E["Ready for handoff"]\n'
        '  D --> F["Needs clarification"]'
    ) % (total, found, missing)


def make_cycle_mermaid(payload: dict) -> str:
    timeline = payload.get("timeline", [])
    if not timeline:
        return 'flowchart LR\n  A["No cycle data"] --> B["Run make agent-telemetry-report"]'

    lines = ["flowchart LR"]
    prev_id = None
    for idx, event in enumerate(timeline):
        node_id = f"S{idx + 1}"
        step = str(event.get("step") or "unknown")
        status = str(event.get("status") or "unknown")
        label = f"{idx + 1}) {step}\\n{status}"
        lines.append(f'  {node_id}["{label}"]')
        if prev_id:
            lines.append(f"  {prev_id} --> {node_id}")
        prev_id = node_id
    return "\n".join(lines)


def page_html(title: str, subtitle: str, mermaid: str, table_headers: Iterable[str], table_rows: Iterable[Iterable[str]], note: str) -> str:
    rows_html = "\n".join(
        "<tr>%s</tr>" % "".join(f"<td>{h(cell)}</td>" for cell in row) for row in table_rows
    )
    headers_html = "".join(f"<th>{h(col)}</th>" for col in table_headers)
    return f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{h(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    :root {{
      --bg: #f8fafc; --card: #ffffff; --line: #dbe3ed; --text: #0f172a; --muted: #475569; --accent: #0ea5e9;
    }}
    @media (prefers-color-scheme: dark) {{
      :root {{ --bg:#0b1220; --card:#0f172a; --line:#334155; --text:#e2e8f0; --muted:#94a3b8; --accent:#38bdf8; }}
    }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; background: var(--bg); color: var(--text); font-family: Roboto, system-ui, sans-serif; padding: 28px; }}
    .wrap {{ max-width: 1120px; margin: 0 auto; }}
    h1 {{ margin: 0 0 8px; font-size: 34px; }}
    .subtitle {{ margin: 0 0 18px; color: var(--muted); }}
    .card {{ background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; margin-top: 14px; }}
    .meta {{ font-family: 'Roboto Mono', monospace; font-size: 12px; color: var(--muted); margin-bottom: 10px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ border-bottom: 1px solid var(--line); text-align: left; padding: 10px 8px; vertical-align: top; }}
    th {{ font-size: 13px; color: var(--muted); font-weight: 600; }}
    td {{ font-size: 14px; }}
    .note {{ color: var(--muted); font-size: 13px; }}
    .mermaid {{ overflow: auto; }}
  </style>
</head>
<body>
  <div class="wrap">
    <h1>{h(title)}</h1>
    <p class="subtitle">{h(subtitle)}</p>

    <div class="card">
      <div class="meta">Visual Explainer OAP</div>
      <pre class="mermaid">
{h(mermaid)}
      </pre>
    </div>

    <div class="card">
      <table>
        <thead><tr>{headers_html}</tr></thead>
        <tbody>{rows_html or '<tr><td colspan="5">Данные отсутствуют</td></tr>'}</tbody>
      </table>
    </div>

    <p class="note">{h(note)}</p>
  </div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({{
      startOnLoad: true,
      theme: 'base',
      themeVariables: {{
        primaryColor: '#dbeafe',
        primaryTextColor: '#0f172a',
        primaryBorderColor: '#93c5fd',
        lineColor: '#0ea5e9',
        fontFamily: 'Roboto, sans-serif'
      }}
    }});
  </script>
</body>
</html>"""


def open_file(path: Path) -> None:
    if sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=False)
        return
    if shutil.which("xdg-open"):
        subprocess.run(["xdg-open", str(path)], check=False)


def write_json_sidecar(path: Path, payload: dict) -> None:
    path.with_suffix(".json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def render_diff(base_ref: str, outdir: Path, should_open: bool, task_key: str | None = None, artifact_prefixes: Sequence[str] = ()) -> Path:
    payload = build_diff_payload(base_ref, task_key=task_key, artifact_prefixes=artifact_prefixes)
    rows = [
        [status, bucket_for(path), path]
        for status, path in payload["rows"][:120]
    ]
    task_suffix = f" - {task_key}" if task_key else ""
    note = "Этот отчет показывает текущий технический срез diff для handoff и review."
    if artifact_prefixes:
        note = (
            "Скоуп ограничен артефактами задачи: "
            + ", ".join(artifact_prefixes)
            + f". Совпало файлов: {len(payload['rows'])} из {payload['rows_all_count']}."
        )
    html_text = page_html(
        title=f"OAP Diff Review{task_suffix}",
        subtitle=f"{payload['compare_ref']} | HEAD {payload['head_sha']}",
        mermaid=make_diff_mermaid(payload),
        table_headers=["Статус", "Область", "Файл"],
        table_rows=rows,
        note=note,
    )
    outdir.mkdir(parents=True, exist_ok=True)
    output = outdir / f"oap-diff-review-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.html"
    output.write_text(html_text, encoding="utf-8")
    write_json_sidecar(output, payload)
    latest = outdir / "oap-diff-review-latest.html"
    latest.write_text(html_text, encoding="utf-8")
    write_json_sidecar(latest, payload)
    if task_key:
        task_latest = outdir / f"oap-diff-review-task-{slugify(task_key)}-latest.html"
        task_latest.write_text(html_text, encoding="utf-8")
        write_json_sidecar(task_latest, payload)
    if should_open:
        open_file(output)
    return output


def render_plan(plan_path: Path, outdir: Path, should_open: bool, task_key: str | None = None) -> Path:
    payload = build_plan_payload(plan_path)
    rows = [
        [row["declared"], "Да" if row["exists"] else "Нет", row["resolved"]]
        for row in payload["file_rows"][:160]
    ]
    task_suffix = f" - {task_key}" if task_key else ""
    html_text = page_html(
        title=f"OAP Plan Review{task_suffix}",
        subtitle=f"План: {payload['plan_path']}",
        mermaid=make_plan_mermaid(payload),
        table_headers=["Ссылка в плане", "Найдено в репо", "Разрешенный путь"],
        table_rows=rows,
        note="Проверка полноты контекста: ссылки плана должны разрешаться в реальные артефакты.",
    )
    outdir.mkdir(parents=True, exist_ok=True)
    output = outdir / f"oap-plan-review-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.html"
    output.write_text(html_text, encoding="utf-8")
    write_json_sidecar(output, payload)
    latest = outdir / "oap-plan-review-latest.html"
    latest.write_text(html_text, encoding="utf-8")
    write_json_sidecar(latest, payload)
    if task_key:
        task_latest = outdir / f"oap-plan-review-task-{slugify(task_key)}-latest.html"
        task_latest.write_text(html_text, encoding="utf-8")
        write_json_sidecar(task_latest, payload)
    if should_open:
        open_file(output)
    return output


def render_cycle(input_path: Path, outdir: Path, should_open: bool, agent_id: str = "analyst-agent") -> Path:
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    timeline = payload.get("timeline", []) if isinstance(payload, dict) else []
    rows = []
    for event in timeline[:160]:
        rows.append(
            [
                str(event.get("timestamp") or ""),
                str(event.get("step") or ""),
                str(event.get("status") or ""),
                str(event.get("run_id") or ""),
                str(event.get("trace_id") or ""),
                str(len(event.get("artifacts_read") or [])),
                str(len(event.get("artifacts_written") or [])),
            ]
        )

    latest_cycle = payload.get("latest_cycle") if isinstance(payload, dict) else None
    subtitle = f"Agent: {agent_id}"
    if isinstance(latest_cycle, dict):
        subtitle = (
            f"Agent: {agent_id} | task: {latest_cycle.get('task_id', 'n/a')} | "
            f"final: {latest_cycle.get('latest_final_status', 'n/a')}"
        )

    html_text = page_html(
        title="OAP Analyst Cycle Review",
        subtitle=subtitle,
        mermaid=make_cycle_mermaid(payload if isinstance(payload, dict) else {}),
        table_headers=[
            "Timestamp",
            "Step",
            "Status",
            "Run ID",
            "Trace ID",
            "Read artifacts",
            "Write artifacts",
        ],
        table_rows=rows,
        note="Отчет построен из artifacts/agent_latest_cycle_analyst.json.",
    )
    outdir.mkdir(parents=True, exist_ok=True)
    output = outdir / f"oap-cycle-review-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.html"
    output.write_text(html_text, encoding="utf-8")
    write_json_sidecar(output, payload if isinstance(payload, dict) else {})
    latest = outdir / "oap-cycle-review-latest.html"
    latest.write_text(html_text, encoding="utf-8")
    write_json_sidecar(latest, payload if isinstance(payload, dict) else {})
    if should_open:
        open_file(output)
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate OAP visual explainer pages.")
    parser.add_argument("mode", choices=["diff-review", "plan-review", "cycle-review"])
    parser.add_argument("--base-ref", default="main", help="Git base ref for diff-review.")
    parser.add_argument("--plan", help="Path to plan markdown for plan-review.")
    parser.add_argument("--input", help="Path to cycle payload JSON for cycle-review.")
    parser.add_argument("--agent-id", default="analyst-agent", help="Agent id for cycle-review subtitle.")
    parser.add_argument("--task-key", default="", help="Optional task key for task-scoped report aliases.")
    parser.add_argument(
        "--artifact-prefix",
        action="append",
        default=[],
        help="Optional artifact path prefix for task-scoped diff filtering. Repeat flag for multiple values.",
    )
    parser.add_argument("--outdir", default=str(DEFAULT_OUTDIR), help="Output directory for html reports.")
    parser.add_argument("--no-open", action="store_true", help="Do not open report in browser.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    outdir = Path(args.outdir).expanduser().resolve()
    should_open = not args.no_open

    if args.mode == "diff-review":
        base_ref = resolve_base_ref(args.base_ref)
        output = render_diff(
            base_ref,
            outdir,
            should_open,
            task_key=args.task_key or None,
            artifact_prefixes=args.artifact_prefix,
        )
        print(output)
        return 0

    if args.mode == "cycle-review":
        input_path = Path(args.input).expanduser().resolve() if args.input else None
        if not input_path or not input_path.exists():
            print("Set --input /path/to/agent_latest_cycle_analyst.json for cycle-review", file=sys.stderr)
            return 2
        output = render_cycle(input_path, outdir, should_open, agent_id=args.agent_id)
        print(output)
        return 0

    plan = Path(args.plan).expanduser().resolve() if args.plan else None
    if not plan or not plan.exists():
        print("Set --plan /path/to/plan.md for plan-review", file=sys.stderr)
        return 2
    output = render_plan(plan, outdir, should_open, task_key=args.task_key or None)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
