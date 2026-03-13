#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import tempfile
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from agent_plan_metadata import load_active_agent_entries, safe_list_str, safe_str

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY_PATH = ROOT_DIR / "docs" / "agents" / "registry.yaml"
DEFAULT_AGENTS_ROOT = ROOT_DIR / "docs" / "subservices" / "oap" / "agents"
DEFAULT_MATRIX_PATH = ROOT_DIR / "docs" / "agents" / "host_capability_matrix.yaml"
DEFAULT_CODEX_SKILLS_DIR = Path.home() / ".codex" / "skills-generated"

HOST_IDS = {"claude_code", "github_copilot", "codex"}


def yaml_quote(value: str) -> str:
    return json.dumps(safe_str(value), ensure_ascii=False)


def yaml_list(items: list[str], indent: int = 0) -> str:
    prefix = " " * indent
    if not items:
        return f"{prefix}[]"
    return "\n".join(f"{prefix}- {yaml_quote(item)}" for item in items)


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_matrix(path: Path = DEFAULT_MATRIX_PATH) -> dict[str, Any]:
    payload = load_json(path)
    hosts = payload.get("hosts")
    if not isinstance(hosts, list):
        raise ValueError(f"Invalid host capability matrix at {path}")
    return payload


def find_host_matrix(host_id: str, matrix: dict[str, Any]) -> dict[str, Any]:
    for item in matrix.get("hosts", []):
        if isinstance(item, dict) and safe_str(item.get("id")) == host_id:
            return item
    raise ValueError(f"Unknown host id: {host_id}")


def load_agents(
    *,
    registry_path: Path = DEFAULT_REGISTRY_PATH,
    agents_root: Path = DEFAULT_AGENTS_ROOT,
) -> list[dict[str, Any]]:
    return load_active_agent_entries(registry_path, agents_root)


def select_agents(agents: list[dict[str, Any]], *, host_id: str, agent_id: str | None = None) -> list[dict[str, Any]]:
    selected: list[dict[str, Any]] = []
    for item in agents:
        if agent_id and safe_str(item.get("id")) != agent_id:
            continue
        supported_hosts = {value.lower() for value in safe_list_str(item.get("supportedHosts"))}
        if supported_hosts and host_id.lower() not in supported_hosts:
            continue
        selected.append(item)
    if agent_id and not selected:
        raise ValueError(f"Agent `{agent_id}` is not available for host `{host_id}`")
    return selected


def claude_tools(agent: dict[str, Any]) -> list[str]:
    execution_mode = safe_str(agent.get("executionMode")).lower()
    tools = ["Read", "Grep", "Glob", "Bash"]
    if execution_mode != "parallel_read_only":
        tools.extend(["Edit", "Write"])
    handoff_targets = safe_list_str(agent.get("handoffTargets"))
    if handoff_targets:
        tools.append(f"Agent({', '.join(handoff_targets)})")
    return tools


def copilot_adapter(agent: dict[str, Any]) -> dict[str, Any]:
    host_adapters = agent.get("hostAdapters")
    if not isinstance(host_adapters, dict):
        raise ValueError(f"Missing hostAdapters for agent `{safe_str(agent.get('id'))}`")
    github_adapter = host_adapters.get("github_copilot")
    if not isinstance(github_adapter, dict):
        raise ValueError(f"Missing github_copilot adapter metadata for `{safe_str(agent.get('id'))}`")
    return github_adapter


def _operating_plan_path(agent: dict[str, Any]) -> str:
    agent_id = safe_str(agent.get("id"))
    return f"docs/subservices/oap/agents/{agent_id}/OPERATING_PLAN.md"


def codex_prompt(agent: dict[str, Any]) -> str:
    agent_id = safe_str(agent.get("id"))
    plan_path = _operating_plan_path(agent)
    return (
        f"Use {agent_id} for this task. "
        f"You MUST read `{plan_path}` before performing any action. "
        f"It contains your mission, rules, contract, and workflow."
    )


def prompt_body(agent: dict[str, Any], host_id: str) -> str:
    agent_id = safe_str(agent.get("id"))
    plan_path = _operating_plan_path(agent)
    return (
        f"You are `{agent_id}` for the OAP project.\n"
        f"\n"
        f"You MUST read `{plan_path}` before performing any action.\n"
        f"It contains your mission, rules, contract, and workflow.\n"
        f"\n"
        f"Host adapter: `{host_id}`\n"
    )


def render_claude_agent(agent: dict[str, Any]) -> str:
    frontmatter = [
        "---",
        f"name: {safe_str(agent.get('id'))}",
        f"description: {yaml_quote(safe_list_str(agent.get('useWhen'))[0] if safe_list_str(agent.get('useWhen')) else safe_str(agent.get('mission')))}",
        "tools:",
        yaml_list(claude_tools(agent), indent=2),
    ]
    allowed_skills = safe_list_str(agent.get("allowedSkills"))
    if allowed_skills:
        frontmatter.extend(["skills:", yaml_list(allowed_skills, indent=2)])
    allowed_mcp = safe_list_str(agent.get("allowedMcp"))
    if allowed_mcp:
        frontmatter.extend(["mcpServers:", yaml_list(allowed_mcp, indent=2)])
    execution_mode = safe_str(agent.get("executionMode")).lower()
    frontmatter.append(f"permissionMode: {'plan' if execution_mode == 'parallel_read_only' else 'default'}")
    frontmatter.append("model: inherit")
    frontmatter.append("---")
    return "\n".join(frontmatter) + "\n" + prompt_body(agent, "claude_code")


def render_copilot_agent(agent: dict[str, Any]) -> str:
    github_adapter = copilot_adapter(agent)
    frontmatter = [
        "---",
        f"name: {safe_str(agent.get('id'))}",
        f"description: {yaml_quote(safe_str(github_adapter.get('description')))}",
        "tools:",
        yaml_list(safe_list_str(github_adapter.get("tools")), indent=2),
    ]
    frontmatter.extend(["agents:", yaml_list(safe_list_str(github_adapter.get("agents")), indent=2)])
    frontmatter.append("---")
    return "\n".join(frontmatter) + "\n" + prompt_body(agent, "github_copilot")


def render_codex_openai(agent: dict[str, Any]) -> str:
    display_name = safe_str(agent.get("displayName")) or safe_str(agent.get("id"))
    short_description = safe_list_str(agent.get("useWhen"))[0] if safe_list_str(agent.get("useWhen")) else safe_str(agent.get("mission"))
    default_prompt = codex_prompt(agent)
    lines = [
        "interface:",
        f"  display_name: {yaml_quote(display_name)}",
        f"  short_description: {yaml_quote(short_description)}",
        f"  default_prompt: {yaml_quote(default_prompt)}",
    ]
    return "\n".join(lines) + "\n"


def render_codex_skill(agent: dict[str, Any]) -> str:
    agent_id = safe_str(agent.get("id"))
    display_name = safe_str(agent.get("displayName")) or agent_id
    plan_path = _operating_plan_path(agent)
    return (
        f"# {display_name}\n"
        f"\n"
        f"Canonical id: `{agent_id}`\n"
        f"\n"
        f"You MUST read `{plan_path}` before performing any action.\n"
        f"It contains your mission, rules, contract, and workflow.\n"
    )


def build_output_specs(
    *,
    host_id: str,
    agents: list[dict[str, Any]],
    matrix: dict[str, Any],
    agent_id: str | None = None,
    repo_root: Path = ROOT_DIR,
    codex_skills_dir: Path = DEFAULT_CODEX_SKILLS_DIR,
) -> list[dict[str, str]]:
    if host_id not in HOST_IDS:
        raise ValueError(f"Unsupported host id: {host_id}")
    find_host_matrix(host_id, matrix)
    selected_agents = select_agents(agents, host_id=host_id, agent_id=agent_id)
    specs: list[dict[str, str]] = []
    for agent in selected_agents:
        current_id = safe_str(agent.get("id"))
        if host_id == "claude_code":
            path = repo_root / ".claude" / "agents" / f"{current_id}.md"
            specs.append({"path": str(path), "content": render_claude_agent(agent)})
        elif host_id == "github_copilot":
            path = repo_root / ".github" / "agents" / f"{current_id}.agent.md"
            specs.append({"path": str(path), "content": render_copilot_agent(agent)})
        elif host_id == "codex":
            base = codex_skills_dir / current_id
            specs.append({"path": str(base / "SKILL.md"), "content": render_codex_skill(agent)})
            specs.append({"path": str(base / "agents" / "openai.yaml"), "content": render_codex_openai(agent)})
    return specs


def write_output_specs(specs: list[dict[str, str]]) -> list[str]:
    written: list[str] = []
    for spec in specs:
        path = Path(spec["path"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(spec["content"], encoding="utf-8")
        written.append(str(path))
    return written


def get_active_top_level_agent_ids(agents: list[dict[str, Any]]) -> list[str]:
    result: list[str] = []
    for item in agents:
        if safe_str(item.get("kind")) != "top_level":
            continue
        agent_id = safe_str(item.get("id"))
        if agent_id:
            result.append(agent_id)
    return result


def smoke_active_set(
    *,
    agents: list[dict[str, Any]],
    matrix: dict[str, Any],
    repo_root: Path = ROOT_DIR,
    codex_skills_dir: Path | None = None,
) -> dict[str, Any]:
    active_agent_ids = get_active_top_level_agent_ids(agents)
    known_agent_ids = {
        safe_str(item.get("id"))
        for item in agents
        if isinstance(item, dict) and safe_str(item.get("id"))
    }
    report: dict[str, Any] = {
        "ok": True,
        "active_top_level_agents": active_agent_ids,
        "agents": agents,
        "hosts": {},
        "handoff_validation": {"ok": True, "issues": []},
    }

    for agent in agents:
        agent_id = safe_str(agent.get("id"))
        for target in safe_list_str(agent.get("handoffTargets")):
            if target not in known_agent_ids:
                report["handoff_validation"]["ok"] = False
                report["handoff_validation"]["issues"].append({
                    "agent_id": agent_id,
                    "target": target,
                    "issue": "unknown_handoff_target",
                })

    for host_id in ("claude_code", "github_copilot"):
        host_rows: list[dict[str, Any]] = []
        host_ok = True
        for agent_id in active_agent_ids:
            specs = build_output_specs(
                host_id=host_id,
                agents=agents,
                matrix=matrix,
                agent_id=agent_id,
                repo_root=repo_root,
            )
            agent_ok = True
            spec_rows: list[dict[str, Any]] = []
            for spec in specs:
                path = Path(spec["path"])
                exists = path.exists()
                matches = exists and path.read_text(encoding="utf-8") == spec["content"]
                if not exists or not matches:
                    agent_ok = False
                    host_ok = False
                spec_rows.append({
                    "path": str(path),
                    "exists": exists,
                    "matches": matches,
                })
            host_rows.append({
                "agent_id": agent_id,
                "ok": agent_ok,
                "specs": spec_rows,
            })
        report["hosts"][host_id] = {
            "ok": host_ok,
            "agents": host_rows,
        }

    if codex_skills_dir is None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            codex_report = smoke_active_set(
                agents=agents,
                matrix=matrix,
                repo_root=repo_root,
                codex_skills_dir=Path(tmp_dir) / "skills-generated",
            )["hosts"]["codex"]
    else:
        codex_rows: list[dict[str, Any]] = []
        codex_ok = True
        for agent_id in active_agent_ids:
            specs = build_output_specs(
                host_id="codex",
                agents=agents,
                matrix=matrix,
                agent_id=agent_id,
                codex_skills_dir=codex_skills_dir,
            )
            written = write_output_specs(specs)
            agent_ok = True
            spec_rows: list[dict[str, Any]] = []
            for spec in specs:
                path = Path(spec["path"])
                exists = path.exists()
                matches = exists and path.read_text(encoding="utf-8") == spec["content"]
                if not exists or not matches:
                    agent_ok = False
                    codex_ok = False
                spec_rows.append({
                    "path": str(path),
                    "exists": exists,
                    "matches": matches,
                })
            codex_rows.append({
                "agent_id": agent_id,
                "ok": agent_ok,
                "written": written,
                "specs": spec_rows,
            })
        codex_report = {
            "ok": codex_ok,
            "agents": codex_rows,
        }

    report["hosts"]["codex"] = codex_report
    report["ok"] = (
        report["handoff_validation"]["ok"]
        and all(host_report.get("ok") for host_report in report["hosts"].values())
    )
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Render or write host-specific agent adapters from OPERATING_PLAN frontmatter.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    render_parser = subparsers.add_parser("render", help="Render adapter files without writing them.")
    render_parser.add_argument("--host", required=True, choices=sorted(HOST_IDS))
    render_parser.add_argument("--agent-id", default="")
    render_parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    render_parser.add_argument("--agents-root", default=str(DEFAULT_AGENTS_ROOT))

    write_parser = subparsers.add_parser("write", help="Write adapter files to the target host directories.")
    write_parser.add_argument("--host", required=True, choices=sorted(HOST_IDS))
    write_parser.add_argument("--agent-id", default="")
    write_parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    write_parser.add_argument("--agents-root", default=str(DEFAULT_AGENTS_ROOT))
    write_parser.add_argument("--repo-root", default=str(ROOT_DIR))
    write_parser.add_argument("--codex-skills-dir", default=str(DEFAULT_CODEX_SKILLS_DIR))

    smoke_parser = subparsers.add_parser("smoke-active-set", help="Validate generated adapters for all active top-level agents across Claude/Copilot/Codex.")
    smoke_parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    smoke_parser.add_argument("--agents-root", default=str(DEFAULT_AGENTS_ROOT))
    smoke_parser.add_argument("--repo-root", default=str(ROOT_DIR))
    smoke_parser.add_argument("--codex-skills-dir", default="")

    agents_parser = subparsers.add_parser("list-active-agents", help="Print normalized active agent metadata from OPERATING_PLAN frontmatter.")
    agents_parser.add_argument("--registry", default=str(DEFAULT_REGISTRY_PATH))
    agents_parser.add_argument("--agents-root", default=str(DEFAULT_AGENTS_ROOT))

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    matrix = load_matrix()
    agents = load_agents(
        registry_path=Path(getattr(args, "registry", str(DEFAULT_REGISTRY_PATH))),
        agents_root=Path(getattr(args, "agents_root", str(DEFAULT_AGENTS_ROOT))),
    )
    if args.command == "render":
        specs = build_output_specs(
            host_id=args.host,
            agents=agents,
            matrix=matrix,
            agent_id=safe_str(args.agent_id) or None,
        )
        print(json.dumps(specs, ensure_ascii=False, indent=2))
        return 0
    if args.command == "write":
        specs = build_output_specs(
            host_id=args.host,
            agents=agents,
            matrix=matrix,
            agent_id=safe_str(args.agent_id) or None,
            repo_root=Path(args.repo_root),
            codex_skills_dir=Path(args.codex_skills_dir),
        )
        written = write_output_specs(specs)
        print(json.dumps({"written": written}, ensure_ascii=False, indent=2))
        return 0
    if args.command == "smoke-active-set":
        codex_dir = Path(args.codex_skills_dir) if safe_str(args.codex_skills_dir) else None
        report = smoke_active_set(
            agents=agents,
            matrix=matrix,
            repo_root=Path(args.repo_root),
            codex_skills_dir=codex_dir,
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report.get("ok") else 1
    if args.command == "list-active-agents":
        print(json.dumps({"agents": agents}, ensure_ascii=False, indent=2))
        return 0
    parser.error("Unsupported command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
