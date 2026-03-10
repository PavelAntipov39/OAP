# OAP Documentation Map

## Назначение
Этот документ задает каноническую карту маршрутизации контекста для задач ОАП.

Цель:
- отделить source of truth от operational navigation;
- запускать работу по capability-first модели, а не по жесткому списку доменов;
- уменьшить ошибки старта, когда агент или человек читают нерелевантные документы;
- дать основу для будущей автоматизации маршрутизации без привязки к стабильной domain taxonomy.

## Почему выбрана capability-first модель
Эта модель принята как целевая по трем причинам:
- она соответствует repo reality: в ОАП уже есть самостоятельные сущности `rules`, `skills`, `mcp`, `memory`, `contracts`, `operating plans`;
- она соответствует практикам Anthropic/OpenAI: сначала authority и policy, потом selective context loading;
- она соответствует практикам Google ADK: orchestration, session state, long-term memory и confirmation рассматриваются как разные системные примитивы.

## Три независимых слоя
### 1. Authority hierarchy
Определяет, чему доверять в первую очередь.

Порядок:
1. `/.specify/specs/001-oap/spec.md`
2. `/.specify/specs/001-oap/contracts/*`
3. `/.specify/specs/001-oap/decisions/*`
4. `docs/*`
5. `AGENTS.md`
6. code/runtime artifacts
7. tool outputs
8. external docs
9. external/global files outside workspace

### 2. Startup routing
Определяет, с каких документов начинать задачу.

Минимальная классификация запроса:
- `origin`: `user_chat`, `agent_generated`, `automation`
- `domain`: soft-label, допускает `unknown` или `provisional`
- `capabilities`: один или несколько тегов из канонического capability набора

### 3. Capability routing
Определяет, какие слои системы реально затронуты задачей.

Канонический набор:
- `rules`
- `tools`
- `skills`
- `mcp`
- `session_state`
- `long_term_memory`
- `contracts`
- `orchestration`
- `human_approval`

Правило устойчивости:
- capability impact имеет более высокий приоритет, чем domain label;
- если домен неясен или новый, задача не блокируется и идет по capability-first fallback route.

## Canonical entry points по capability
| Capability | Читать сначала | Читать по триггеру | Не читать по умолчанию |
| --- | --- | --- | --- |
| `rules` | `AGENTS.md`, `docs/subservices/oap/README.md`, `docs/subservices/oap/DESIGN_RULES.md` | operating plan конкретного агента | contracts, если нет contract impact |
| `tools` | operating plan агента, `docs/subservices/oap/AGENT_TELEMETRY.md` | registry/profile templates | frontend/datasets contracts |
| `skills` | `docs/agents/registry.yaml`, operating plan агента | `docs/agents/profile_templates.yaml` | BPMN, если нет orchestration impact |
| `mcp` | `docs/agents/registry.yaml`, operating plan агента | schema, telemetry docs | UI docs, если нет UI impact |
| `session_state` | operating plan агента, task docs, task brief contract in spec | registry, schema | long-term memory docs |
| `long_term_memory` | operating plan агента, lessons docs, schema | telemetry summary, persistent rules | session-only task docs, если нет retrieval need |
| `contracts` | relevant file in `/.specify/specs/001-oap/contracts/` | spec, schema, generated artifacts | OAP UI rules, если нет UI impact |
| `orchestration` | operating plan, relevant ADR, BPMN | registry/profile templates | UI/content docs |
| `human_approval` | operating plan, BPMN, ADR | telemetry docs, task board docs | UI/content docs |

## Отдельные маршруты
### User-chat route
Базовый порядок:
1. authority check
2. capability classification
3. optional domain narrowing
4. selective reads
5. execution and verification

### Agent-generated route
Базовый порядок:
1. authority check
2. agent identity lookup in `docs/agents/registry.yaml`
3. profile/orchestration lookup in `docs/agents/profile_templates.yaml` при необходимости
4. operating plan текущего агента
5. capability-based selective reads
6. optional domain narrowing

### Fallback route
Используется, если:
- домен неизвестен;
- домены конфликтуют;
- запрос одновременно затрагивает несколько слоев.

Fallback sequence:
1. authority check
2. capabilities first
3. trust policy check
4. escalation to ADR/BPMN/contracts only when triggered

## Memory routing
`session_state` и `long_term_memory` запрещено смешивать в одном default route.

### `session_state`
Использовать для:
- текущего цикла;
- межшагового обмена;
- task brief и operational memory.

Читать в первую очередь:
- `docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md`
- `docs/subservices/oap/README.md`
- task/context contracts in spec

### `long_term_memory`
Использовать только если нужен retrieval across runs.

Читать в первую очередь:
- `docs/subservices/oap/tasks/lessons.global.md`
- `docs/subservices/oap/tasks/lessons.md`
- `docs/subservices/oap/tasks/lessons/<agent-id>.md`

## Orchestration routing
Если задача меняет:
- sequence;
- delegation;
- loop;
- review/generator-critic flow;
- specialist spawning;
- BPMN flow;
- approval gate;

стартовать нужно не от UI-доков, а от:
1. operating plan
2. ADR
3. BPMN
4. registry/profile templates

## Trust policy
Внешние документы Google, Anthropic и OpenAI допустимы как reference layer для design decisions, но не могут переопределять repo source of truth.

Файлы вне workspace, включая глобальные пользовательские конфиги, non-authoritative по умолчанию.

## Артефакты этого контура
- `docs/subservices/oap/DOCUMENTATION_MAP.md` — этот документ, каноническая карта слоев и маршрутов.
- `docs/subservices/oap/ROUTING_MANUAL_TRIALS.md` — manual stabilization и edge-case trials.
- `docs/subservices/oap/REQUEST_ROUTING_CONTRACT.yaml` — канонический routing contract: маршруты, домены, fallback-политика и validation rules.
- `docs/subservices/oap/AGENT_OPERATIONS_RULES.md` — канонический operating rules entry point для agent-card workflows.
- `docs/subservices/oap/agents/analyst-agent/CARD_DATA_SOURCES_MAP.md` — канонический analyst-card data-source map.

## Rollout order
1. documentation map
2. routing contract
3. manual trial on real tasks
4. semantic cleanup имен документов
5. automation over stable contract