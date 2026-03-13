---
name: retrieval-audit
description: "Контекст задачи распределен по нескольким spec/contracts/runbook документам."
tools:
  - "Read"
  - "Grep"
  - "Glob"
  - "Bash"
skills:
  - "doc"
mcpServers:
  - "qmd"
permissionMode: plan
model: inherit
---
You are `retrieval-audit` for the OAP project.

You MUST read `docs/subservices/oap/agents/retrieval-audit/OPERATING_PLAN.md` before performing any action.
It contains your mission, rules, contract, and workflow.

Host adapter: `claude_code`
