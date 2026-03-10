# OAP Routing Manual Trials

Этот документ фиксирует manual stabilization phase для capability-first routing.

## Цель
- проверить, что routing работает не только на happy path;
- убедиться, что `domain` можно менять или не задавать вообще;
- зафиксировать edge cases перед переходом к automation.

## Happy-path trials
| Trial ID | Request shape | Expected route | Acceptance |
| --- | --- | --- | --- |
| `trial_ui_card_content` | пользователь просит поменять текст/порядок секции карточки | `ui_card_content` | contracts не читаются по умолчанию |
| `trial_ui_drawer_contract` | пользователь меняет drawer + payload shape | `ui_drawer_contract` | frontend contract читается первым |
| `trial_memory_labels` | пользователь меняет названия memory blocks | `memory_section_ui` | state и long-term memory не смешиваются |
| `trial_mcp_section` | пользователь меняет MCP block | `mcp_block_update` | registry остается первичным источником |
| `trial_telemetry_metric` | меняется формула метрики | `telemetry_metric_change` | formula/source/verification явно указаны |
| `trial_bpmn_update` | меняется шаг approval в BPMN | `approval_gate_change` | BPMN и operating plan читаются раньше UI |
| `trial_orchestration_logic` | меняется reuse-first/delegation policy | `orchestration_logic_change` | ADR и profile templates подключены |
| `trial_dataset_update` | меняется candidate dataset/ETL | `candidate_dataset_update` | datasets contract читается первым |

## Edge cases
| Edge Case | Input | Expected behavior | Pass condition |
| --- | --- | --- | --- |
| `unknown_domain` | домен не указан | route идет по `origin -> capabilities -> trust` | задача не блокируется |
| `multi_capability` | UI + contract + telemetry | route читает capability-first stack без лишних docs | прочитаны только triggered docs |
| `agent_generated_contract_change` | агент создал задачу, которая меняет contract | route стартует от registry/agent identity, затем эскалирует в contract docs | identity идет раньше domain |
| `state_without_memory` | запрос только про текущий task brief | long-term memory не читается по умолчанию | lessons docs не загружены без триггера |
| `memory_without_state` | запрос только про lessons governance | route идет в lessons docs без task-session docs | task brief не обязателен |
| `risky_tool_flow` | запрос влечет approval/risky action | route эскалирует в `human_approval` | approval docs читаются раньше UI |
| `architecture_plus_ui` | C4 + UI wording в одном запросе | route делит authority и capability, не начинает с UI | spec/ADR/C4 идут первыми |
| `search_index_only` | запрос только про docs/search index | route не читает BPMN/contracts без триггера | verification через prepare-content |

## Manual trial checklist
- [ ] unknown domain does not block startup
- [ ] every request is classifiable by `origin` and `capabilities`
- [ ] `session_state` and `long_term_memory` stay separated in default routes
- [ ] deterministic orchestration and LLM delegation use different entry docs
- [ ] pure UI/content task skips contracts by default
- [ ] agent-generated task starts from agent identity/profile
- [ ] global/external files remain non-authoritative
- [ ] route has explicit verification step

## Exit criteria for automation
Automation можно включать только если:
1. не осталось edge cases, где route собирается только вручную;
2. canonical docs names уже стабильны;
3. decision table и router contract описывают один и тот же набор route IDs;
4. verification path у каждого route воспроизводим командой или тестом.