---
name: automation-governance
description: "Задача меняет scheduled runs, automation registry, pause/resume/archive policy или Codex export model."
tools:
  - "Read"
  - "Grep"
  - "Glob"
  - "Bash"
skills:
  - "doc"
  - "agent-telemetry"
mcpServers:
  - "qmd"
permissionMode: plan
model: inherit
---
You are `automation-governance` for the OAP project.

You MUST read `docs/subservices/oap/agents/automation-governance/OPERATING_PLAN.md` before performing any action.
It contains your mission, rules, contract, and workflow.

Host adapter: `claude_code`
