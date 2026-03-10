# TODO: routing-rollout-20260308 - OAP capability-first routing rollout

## Context
- Agent: analyst-agent
- Section: skills_rules
- Basis: rollout of OAP routing model from documentation-map to executable artifacts and canonical navigation
- Target metric: startup_route_accuracy
- Expected delta: reduce ambiguous startup routing and remove legacy naming ambiguity from OAP docs/UI entry points
- Context to task:
  - summary: capability-first routing already has a base map, but the repo still lacks full route coverage, edge-case trials, canonical machine-readable contract, and clean doc naming.
  - why_now: current rollout is stuck between concept and execution; team and agents need one stable navigation contract before further automation.
  - execution_notes:
    - preserve backward compatibility for legacy doc paths
    - avoid mixing unrelated unstaged changes into this rollout
- Linked elements:
  - doc :: OAP Documentation Map :: docs/subservices/oap/DOCUMENTATION_MAP.md
  - doc :: OAP Request Routing Contract :: docs/subservices/oap/REQUEST_ROUTING_CONTRACT.yaml
  - doc :: OAP Workflow Prompt legacy name :: docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md
  - doc :: Analyst card full flow legacy name :: docs/subservices/oap/agents/analyst-agent/CARD_FULL_FLOW.md

## Plan Checklist
- [x] Plan: scope, assumptions, contracts
- [x] Execute: routing docs, trials, router contract, canonical aliases
- [x] Docs: OAP docs synchronized
- [x] Section rules: modal "Правила работы раздела" updated
- [x] Verify: tests/logs/behavior proof
- [x] Telemetry: started/completed (+verify/review when relevant)
- [x] Review: risks and follow-ups documented

## Implementation Notes
- Changed files:
  - .github/workflows/ci.yml
  - README.md
  - AGENTS.md
  - docs/subservices/oap/DOCUMENTATION_MAP.md
  - docs/subservices/oap/REQUEST_ROUTING_CONTRACT.yaml
  - .specify/specs/001-oap/spec.md
  - docs/subservices/oap/README.md
  - docs/subservices/oap/AGENT_OPERATIONS_RULES.md
  - docs/subservices/oap/agents/analyst-agent/CARD_DATA_SOURCES_MAP.md
  - docs/subservices/oap/ROUTING_MANUAL_TRIALS.md
  - docs/subservices/oap/REQUEST_ROUTING_CONTRACT.yaml
  - scripts/validate_request_router.py
  - scripts/validate_verification_contract.py
  - scripts/tests/test_validate_request_router.py
  - scripts/tests/test_validate_verification_contract.py
  - ops-web/package.json
  - ops-web/scripts/build_content_index.mjs
  - ops-web/src/pages/AgentsPage.tsx
  - ops-web/tests/agents-deeplink-smoke.spec.ts

## Verification
- Commands:
  - `npm --prefix ops-web run check`
  - `npm --prefix ops-web run test:e2e:smoke`
  - `python3 -m unittest discover -s scripts/tests -p 'test_*.py'`
  - `python3 -m py_compile scripts/agent_telemetry.py scripts/sync_agent_tasks.py scripts/agent_orchestration.py scripts/validate_request_router.py scripts/validate_agent_operating_plans.py scripts/validate_verification_contract.py`
  - `python3 scripts/validate_verification_contract.py`
  - `python3 scripts/validate_request_router.py`
  - `cd ops-web && npm exec playwright test tests/agents-capability-comparison.spec.ts`
  - `cd ops-web && npm exec playwright test tests/agents-deeplink-smoke.spec.ts`
  - `/Users/pavelantipov/Downloads/VSCode/ОАП/.venv/bin/python scripts/agent_telemetry.py report`
- Result:
  - passed: root quick start and ops-web check pipeline now include canonical routing contract validation and verification-contract parity; PR CI workflow added with the same check pipeline plus targeted Playwright smoke for capability-routing and deeplink canonicalization, Python `unittest`, and compile checks; generated indexes rebuilt, routing validator passed, verification-contract validator passed, agents manifest check passed, frontend build passed, Python unit tests passed via `unittest`, focused Playwright tests passed, telemetry summary and latest cycle artifacts refreshed

## Risks
- generated docs indexes will still contain legacy names until prepare-content is rerun
- legacy links must remain compatible while canonical names change
- future route additions must update the single routing contract and rerun validator/build

## Review
- Status: done
- Done:
  - base routing docs created
  - rollout task recorded in todo
  - decision table removed from the active routing model
  - canonical doc names introduced with compatibility aliases
  - manual trials and canonical routing contract kept as the active routing layer
  - validator switched to a single routing contract
  - routing contract now owns all route IDs, domains and fallback policy
  - UI/index builder switched to canonical operations rules path
  - build, targeted UI test and telemetry report passed
- Remaining:
  - keep future route additions synchronized in the canonical routing contract; shared ops-web check and PR CI now fail fast if the contract is broken
  - keep spec, CI, README and smoke-route verification synchronized when the verification contract changes; verification validator now enforces this contract automatically

---

# TODO: task-card-waiting-human-rollout-20260310 - Роутинг карточки задачи по service_mode

## Context
- Agent: analyst-agent
- Section: task-card
- Basis: расширение canary роутинга TaskDetailsDrawer: задачи с `service_mode === "waiting_human"` теперь открываются в экспериментальной карточке без необходимости попасть в allowlist по ID
- Target metric: task_card_experimental_coverage
- Expected delta: все live-задачи с `waiting_human` статусом автоматически получают новую карточку с human-gate UI

## Plan Checklist
- [x] Plan: scope, assumptions, contracts
- [x] Execute: TaskDetailsDrawer, TasksPage, AgentsPage, AnalystCardDrawer обновлены
- [x] Tests: новый тест `waiting_human service_mode opens experimental task card via row click` добавлен
- [x] Lessons: урок зафиксирован в lessons/analyst-agent.md и lessons.global.md
- [x] Verify: TypeScript errors = 0
- [x] Telemetry: задача зафиксирована

## Implementation Notes
- Changed files:
  - ops-web/src/components/tasks/TaskDetailsDrawer.tsx — добавлен `serviceMode?` prop, расширен `shouldUseExperimentalTaskCard`
  - ops-web/src/pages/TasksPage.tsx — `selectedTaskServiceMode` state, передача `row.service_mode` в openTaskDrawer
  - ops-web/src/pages/AgentsPage.tsx — `selectedTaskServiceMode` state + `taskServiceModeCacheRef`, передача в TaskDetailsDrawer
  - ops-web/src/components/analyst-card/AnalystCardDrawer.tsx — передача `serviceMode` из `selfImprovementTasks`
  - ops-web/tests/task-card-canary.spec.ts — добавлена задача `task-waiting-human-001` и новый тест

## Verification
- Result: TypeScript noEmit = 0 errors; тест добавлен

## Review
- Status: done
