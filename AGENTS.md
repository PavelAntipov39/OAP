# Agent Notes

## Source Of Truth (Read First)
- Спецификация проекта находится в `/.specify/specs/001-oap/spec.md` и является **source of truth** по целям, границам, архитектуре, контрактам API/данных, RLS и runbook.
- `AGENTS.md` задает операционные правила работы (как действовать в репо, безопасность, интеграции), но **не заменяет** архитектурную/продуктовую спецификацию.

### Правило: всегда начинать со спеки
Перед любой разработкой/рефакторингом/изменениями схемы/ETL/API:
1. Свериться со спекой: `/.specify/specs/001-oap/spec.md`.
2. Если задача про фронтенд API: свериться с `/.specify/specs/001-oap/contracts/frontend-api.md`.
3. Если задача про датасеты/ETL: свериться с `/.specify/specs/001-oap/contracts/datasets.md`.
4. Если спека не покрывает изменение или есть противоречие: сначала обновить спеку и/или добавить ADR в `/.specify/specs/001-oap/decisions/`, затем менять код.

## Зачем нужны AGENTS.md и .specify (четко)

### AGENTS.md (операционные правила)
Нужен, чтобы:
- зафиксировать “как мы работаем” в этом репо (порядок действий, запреты, практики безопасности);
- уменьшить ошибки с секретами/деплоем/интеграциями;
- дать единые правила для Codex/агентов.

### .specify (спека проекта)
Нужна, чтобы:
- иметь единый “source of truth” по архитектуре, данным, API, RLS, ETL, поиску;
- согласовать работу нескольких веток/команд (backend/frontend/ETL);
- фиксировать решения и их последствия (ADR).

### Приоритет документов
1. `/.specify/specs/001-oap/spec.md`
2. `/.specify/specs/001-oap/contracts/*`
3. `/.specify/specs/001-oap/decisions/*`
4. `docs/*` (должны соответствовать спеке)
5. `AGENTS.md`

## Cross-Tool Assistant Governance (Mandatory)
- Правила принятия решений и стиль коммуникации в этом репозитории tool-agnostic:
  одинаково обязательны для `Codex`, `GitHub Copilot`, `Claude` и любых других assistants.
- Канонический policy-layer:
  1. `/.specify/specs/001-oap/spec.md`
  2. `AGENTS.md`
  3. tool-specific assistant entry files (`.github/copilot-instructions.md`, `CLAUDE.md`, другие assistant entry files).
- Tool-specific assistant entry files не являются самостоятельным source-of-truth:
  они короткие, генерируемые и не могут задавать противоречащие правила.
- Machine-readable contract assistants:
  `/.specify/specs/001-oap/contracts/assistant-governance.json`
  (`canonical_file`, `supported_assistants[]`, `entry_file`, `entry_strategy=generated_pointer`, `template_version`).
- Любое изменение repo-wide правил общения, decision policy или assistant-behavior делается синхронно:
  - в `spec.md`, если меняется каноническое поведение;
  - в `AGENTS.md`, если меняется operating/gateway layer;
  - через регенерацию tool-specific assistant entry files.
- Во всех assistants ответы должны быть:
  - краткими и фактическими;
  - evidence-first;
  - с явным разделением `факт` / `интерпретация`;
  - с явным указанием, какой агент или какие агенты участвуют в ответе/задаче; если профильный агент не привлекается, это тоже нужно написать прямо;
  - без ссылок на UI-секции или workflow, которые не подтверждены текущим runtime/code;
  - с использованием semantic `section_id` как внутреннего якоря и lookup текущего label из `ops-web/src/generated/ui-section-contract.json`.

## Architecture Governance (Mandatory)
- Архитектура фиксируется через C4/LikeC4 с обязательным разделением уровней:
  - C1 (System Context) отдельно,
  - C2 (Container) отдельно,
  - C3 только точечно для сложных контейнеров.
- Обязателен отдельный security/access view с явной цепочкой:
  - frontend -> public contract -> RLS gate -> core/search data.
- Перед выдачей архитектурных изменений DSL обязан проходить:
  - `npx -y likec4@latest validate --ignore-layout docs`
- Нельзя выдумывать контейнеры/компоненты вне source-of-truth (`spec/contracts/ADR`).
- Для ссылок и автоматизации использовать стабильные view IDs:
  - `oap_context`, `oap_containers`, `db_rpc_boundary`, `security_access`.
- Любые изменения, влияющие на schema/API/ETL/security, делаются в порядке:
  1. update spec/contracts/ADR,
  2. update architecture diagram (`docs/oap.c4`),
  3. только затем код.

## GSD Workflow (Recommended)
- Canonical reference:
  - `https://github.com/gsd-build/get-shit-done`
- Для сложных задач используем workflow из get-shit-done (GSD) как process standard:
  1. discuss intent,
  2. plan phase,
  3. execute phase,
  4. verify work.
- Проектная конфигурация workflow хранится в:
  - `.planning/config.json` (если включено в репозитории).
- Если GSD не установлен, применяем тот же фазовый процесс вручную в этих же артефактах (`spec/contracts/ADR/tasks`).

## Context7 (Mandatory)
- For any development work that adds/updates/uses libraries (frontend, backend, ETL, SQL tooling, Supabase, etc.), consult Context7 first for up-to-date docs/examples.
- If Context7 doesn't have coverage for a dependency, fall back to official primary docs and note that Context7 was unavailable for that library.

## QMD Retrieval Policy (Mandatory for large text context)
- Use `qmd` as the default retrieval layer when the agent needs to search across many markdown/text documents and return only the most relevant evidence snippets.
- Cases with guaranteed benefit versus manual context selection:
  - cross-file search across specs/contracts/runbooks/notes where exact file is unknown;
  - task startup when context must be assembled from multiple docs quickly;
  - evidence-first answers where each conclusion must be backed by refs/snippets.
- Do not use `qmd` when it does not improve quality:
  - exact known file/line is already identified;
  - code-symbol lookup (use `rg`/language tooling);
  - live runtime/business data from DB/API (query source systems directly).
- Quality-safe retrieval budget:
  - start with top snippets only (`top_k` 5-8 and score threshold);
  - if evidence is weak or contradictory, expand retrieval scope before finalizing the answer;
  - never keep a hard token cap that blocks required evidence for high-risk tasks.

## Frontend
- Prefer Material Design (MUI) components and patterns.
- For web interface design decisions, treat official Material 3 sources as primary references:
  - `https://m3.material.io/get-started`
  - `https://design.google/library/making-more-with-material`
  - `https://github.com/material-components/material-web`
- When proposing or implementing UI changes, align layouts and components with M3 principles: tokens, typography scale, spacing, state layers, and accessibility.

## OAP Design Rule (Mandatory)
- For the internal service **Операционная агентная панель (ОАП)**, enforce component reuse and logic/UI traceability:
  - reuse existing OAP components before creating new ones;
  - every KPI/recommendation in UI must map to explicit source/formula;
  - keep one canonical card structure across agents for comparability.
  - for modern agents (`analyst-agent`, `designer-agent`) use unified drawer/routing contract by default; avoid per-agent routing special-cases.
- OAP subservice documentation is a required context source:
  - `docs/subservices/oap/README.md`
  - `docs/subservices/oap/DESIGN_RULES.md`
- Any OAP card redesign must update these docs in the same task when structure/semantics change.
- OAP agent-card deep-link contract is mandatory:
  - use canonical URL `#/agents?agent=<agent-id>&tab=<tab-key>`;
  - canonical `tab-key` values: `overview`, `mcp`, `skills_rules`, `tasks_quality`, `memory_context`, `improvements`;
  - for legacy agents, `tab=mcp` must canonicalize to `tab=overview`;
  - tab switches must use `replaceState` (avoid history spam).
- Modal deep-link contract is mandatory for OAP:
  - each user-facing modal/drawer with meaningful business context (docs, logs, metrics, comparison, task details) must have its own canonical URL state;
  - modal state must be shareable and restorable from URL;
  - opening/closing modal updates URL via `replaceState`, without history spam;
  - transient UI (`toast`, simple confirm/cancel, tooltip/popover helper text) may stay without dedicated URL.
- Capability optimization is mandatory for every OAP agent profile and runner:
  - each agent profile must define `capabilityOptimization` with `enabled`, `refreshMode=on_run`, `sourcePolicy=official_first`, `trialMode=shadow`, `promotionMode=human_approve`, `minShadowSampleSize`, `staleAfterHours`;
  - each production-like agent run must refresh the per-agent capability snapshot in `artifacts/capability_trials/<agent-id>/capability_snapshot.json`;
  - UI comparison tables must read the per-agent capability snapshot as canonical source, not raw telemetry logs;
  - if the snapshot is stale or fingerprint-drifted, promotion/replace decisions must stay blocked until the next agent run refreshes it.
- Capability selection contract is mandatory for every OAP operating plan and runtime:
  - step-level `Skills/Tools/MCP` listed in `OPERATING_PLAN.md` are baseline minima, not exhaustive runtime capability set;
  - runtime capability set is selected dynamically via capability-first routing and orchestration from:
    `workflowBackbone`, `collaboration_plan.spawned_instances.allowed_skills/allowed_tools/allowed_mcp`,
    `docs/agents/registry.yaml` (`used*`/`available*`), and
    `artifacts/capability_trials/<agent-id>/capability_snapshot.json`;
  - dynamic selection must remain constrained by explicit gates:
    `official-first` source policy, `shadow trial` before promotion, `human approve` for promotion;
  - when dynamic capabilities are unavailable or degraded, fallback policy must be explicit and logged (soft-warning or strict gate by contract).
- Universal workflow backbone is mandatory for every OAP agent profile and spawned specialist instance:
  - each profile must define `workflowBackbone` with `version=universal_backbone_v1`, `commonCoreSteps[]`, `roleWindow`, `stepExecutionPolicy`, `supportsDynamicInstances`;
  - all agent-specific logic must live inside one bounded `roleWindow`; do not spread domain-specific steps across the shared backbone;
  - if a backbone step is not used by a given agent or instance, mark it as `skipped` instead of removing it from the canonical cycle;
  - `analyst-agent` remains the reference implementation for `common backbone + role window`, but its internal branch steps are not universalized for other agents.

## BPMN Process Map (Pilot)
- For tasks that change business logic, read the BPMN view in `web` route `#/bpmn` before proposing or implementing changes.
- Keep BPMN aligned with real behavior: when business flow changes, update the BPMN diagram in code/docs in the same task.
- Treat BPMN as process-level context (sequence, decisions, handoffs), while C4/LikeC4 remains architecture-level context.

## C4 Flow Rule (Mandatory for agent process diagrams)
- Для процессных схем ИИ-агентов в LikeC4 использовать BPMN-логику внутри C4:
  - явная последовательность шагов с нумерацией (`1) started -> 2) health-check -> ...`);
  - отдельные связи `read` и `write` к файлам/артефактам;
  - отдельный контур `notifications/security` (env secrets -> notifier -> external channel);
  - в связях указывать конкретные пути/скрипты (`docs/agents/registry.yaml`, `ops-web/scripts/build_content_index.mjs`, `scripts/agent_telemetry.py`).
- Для всех process-views использовать стабильные id и префикс `analyst_flow_*`:
  - `analyst_flow_context`
  - `analyst_flow_steps`
  - `analyst_flow_io`
  - `analyst_flow_notifications`
- Перед отправкой ссылки на Playground обязательно проверить:
  1. открывается workspace root (`/w/<id>/`),
  2. каждый view-id открывается без `View is not found`,
  3. в диаграмме видны шаги, источники данных и точки записи.
- Если ссылка невалидна, сначала отправлять DSL (источник истины), затем уже новый проверенный share-link.

## Correction Log Rules
- Consistency sync rule (mandatory): если один и тот же operational fact повторяется в нескольких артефактах (spec, runbook, CI, manual table, machine-readable contract, README, generated index), все связанные источники должны обновляться в рамках одной задачи.
- Для дублируемой истины действует правило: один canonical source + обязательная синхронизация dependent-артефактов.
- Если human-readable и machine-readable версии одного контракта существуют одновременно, для них должен быть parity-check в локальном pipeline или CI; без этого дублирование считается временным и рискованным.
- Универсальную семантическую консистентность для всех файлов автоматически не обещать; автоматизировать только проверяемые инварианты с низким уровнем ложных срабатываний.
- Патчи файлов в Codex выполнять только через инструмент `apply_patch`; не запускать `apply_patch` через `exec_command`.
- Internal engineering tools (like BPMN viewers, debug panels, migration dashboards) must not be visible in end-user navigation by default; expose them only via dev/admin-only entry points.
- Для задач AI-агентов обязательно фиксировать telemetry-события по шагам задачи (`agent-log`) и собирать агрегированный отчет (`agent-telemetry-report`) перед итоговой сдачей.
- В ОАП для блока `Использованные файлы` источник истины: session file trace (`read/write/delete`, dedupe по path); `Оперативная память` пересчитывается по trace на конец сессии, где `read` не понижает `write`, а `delete` удаляет путь из активного набора.
- В ОАП блок `Целевые метрики` для `analyst-agent` размещать в разделе `Задачи и качество`; в разделе `Навыки и правила` этот блок не показывать.
- Метрики в ОАП показывать фактическими значениями (процент/число/время), а не тегами (`Chip`).
- Для каждой метрики обязателен tooltip `Как считается`: формула + источник данных + человеко-понятное описание.
- В ОАП термины для раздела `Память и контекст` должны быть понятны не-ИТ пользователю: использовать названия `Оперативная память` и `Долговременная память` и добавлять tooltip с простым объяснением логики.
- В блоке `Память` карточки агента не заменять пользовательский подзаголовок `Оперативная память` на общее `Память` без явного запроса; tooltips для `Оперативная память`, `Долговременная память` и `Самоулучшение агента (Self-improvement loop)` должны оставаться отдельными и человеко-понятными.
- Если пользователь просит улучшить workflow/логику агентной карточки, scope по умолчанию ограничивается подпроектом ОАП (docs/subservices/oap, ops-web, scripts для OAP) и не расширяется на внешние доменные проекты без явного запроса.
- Если пользователь просит убрать UI-блок только из интерфейса, не расширять задачу на рефакторинг, удаление мертвого кода или синхронное обновление документации без отдельного подтверждения.
- Если пользователь просит удалить конкретный UI-блок, запрещено удалять или скрывать соседние пункты/метрики/ссылки, которые явно не запрашивались к изменению.
- При изменении контента вкладок карточки агента общий блок `Описание раздела` сохраняется по умолчанию; удалять его только при явном запросе пользователя.
- Если путь к файлу в карточке агента отображается как гиперссылка, он должен оставаться кликабельным и одновременно поддерживать выделение/копирование текста мышью.
- В документации/контрактах/скриптах ОАП не использовать legacy-нейминг `bible-kb` или `Bible KB`; canonical naming для текущего проекта: `OAP` и spec-root `/.specify/specs/001-oap/*`.
- Для candidate-flow явно разделять intake и decision: если решение принимает n8n Code-узел, нельзя утверждать, что анализ выполнен моделью Codex/GPT; model-driven режим допускается только когда решения формируются в цикле агента.
- Для новой сущности входящих практик использовать канонический термин `candidate`; не смешивать в одном контексте `candidat` и `hypothesis`.
- Если пользователь явно указывает целевого агента для изменения карточки, запрещено менять карточки других агентов в этой задаче.
- Если пользователь просит изменения по дизайну/UI/UX, вызов соответствующих профильных агентов обязателен:
  - `designer-agent` для визуала/компоновки/UX;
  - `analyst-agent` для валидации KPI/impact и трассировки формул;
  - выполнять задачу без такого вызова запрещено.
- При каждом пользовательском запросе в ответе обязательно явно указывать, какие агенты были фактически задействованы для этой задачи в текущем ходе работы; если использован только базовый исполнитель без delegation, это тоже нужно написать прямо.
- Для `analyst-agent` тип карточки (legacy `AnalystCardDrawer` vs unified drawer) меняется только по явному запросу пользователя; при запросе на возврат предыдущего UI обязателен rollback роутинга.
- В legacy-карточке `analyst-agent` ссылки на BPMN-файлы не открывать через текстовую модалку; путь `docs/bpmn/*.bpmn` должен вести в валидный BPMN/agent-flow viewer, а не в пустой fallback.
- В `#/agent-flow` пользовательские формулировки приоритетнее внутренних технических идентификаторов: запрещено выносить ключевую логику в отдельный блок вне основного пайплайна, если это ухудшает понятность; step-id/status-id (`step_*`, `verify_*`, `capability_*`) не показывать как основной текст для не-IT пользователя.
- В карточке `analyst-agent` секция `Используемые навыки` обязана содержать: пункт `Навыки` (теги навыков, задействованных за последний цикл сессии) и подпункт `Путь к файлу Skills`.
- Карточка `analyst-agent` считается эталонной: без явного запроса пользователя запрещено менять её роутинг, тип drawer, базовую структуру секций и переносить её на другой UI-контракт.
- В governance-документах и assistant entry-files запрещено фиксировать display-label UI-секции как канон; использовать только semantic `section_id` и брать label из актуального section-contract/runtime.
- Если в проекте используется assistant-specific instruction file (`.github/copilot-instructions.md`, `CLAUDE.md` и т.п.), он должен быть автогенерируемой короткой точкой входа на `AGENTS.md`; ручное локальное расширение правил запрещено.
- Для file-trace чипов (`source_kind`, `semantic_layer`) канонические label/tooltip берутся только из `docs/subservices/oap/CAPABILITY_GLOSSARY.json`; локальные hardcoded маппинги в UI запрещены.
- Внутри label чипов запрещено дублировать префиксы типа `Контур:`/`Источник:`; показывать только canonical имя термина, а raw-значение выводить в tooltip.

## Agent Telemetry Logging (Mandatory)
- Логирование ведется в формате OTel-first: у события должны быть `agent_id`, `task_id`, `step`, `status`, `run_id`, `trace_id`.
- Минимальные статусы для каждой задачи: `started` -> `completed` или `failed`; для review добавлять `review_passed`/`review_failed`.
- Для рекомендаций обязательно указывать `recommendation_id` и статусы `recommendation_suggested`/`recommendation_applied`, чтобы считать `recommendation_action_rate`.
- Стратегия хранения логов: `local-first` (`.logs/agents/*.jsonl`) как write-ahead журнал, затем синхронизация в БД/warehouse для аналитики и дашбордов.
- Запрещено писать секреты в telemetry-логи (`token`, `password`, `apikey`, `dsn` и т.п.).
- После серии задач обязательно обновлять отчет:
  - `make agent-telemetry-report`
- Источники просмотра:
  - сырые логи: `.logs/agents/*.jsonl`
- агрегированный JSON: `artifacts/agent_telemetry_summary.json`
- агрегированный Markdown: `artifacts/agent_telemetry_summary.md`

## Universal Self-Improvement Loop (Mandatory)
- Контур обязателен для **всех** агентов: `analyst`, `designer`, `reader`, `data`, `ops` и любых новых профилей.
- Разделяем:
  - `Role process profile` (доменные шаги и инструменты конкретного агента),
  - `Learning core profile` (единый state-machine обучения, одинаковый для всех).
- Обязательная последовательность статусов цикла (learning core):
  1. `planned` или `started`
  2. `verify_started`
  3. `verify_passed` или `verify_failed`
  4. `lesson_captured` или `lesson_not_applicable`
  5. только после этого: `completed` или `failed` или `review_passed`
- Любая пользовательская коррекция должна порождать урок с:
  - `root cause`
  - `preventive rule`
- Rollout done-gate:
  - миграционная фаза: `soft_warning` (фиксируем нарушения без блокировки завершения),
  - целевая фаза: `strict` (нарушение state-machine блокирует закрытие цикла).
- Модель знаний self-improvement (гибрид):
  - общий канон: `docs/subservices/oap/tasks/lessons.global.md`
  - уроки по агентам: `docs/subservices/oap/tasks/lessons/<agent-id>.md`
  - совместимый fallback/индекс: `docs/subservices/oap/tasks/lessons.md`
- На старте релевантного цикла retrieval обязан включать:
  - общий канон,
  - файл текущего агента,
  - последние релевантные уроки по тегам/контексту задачи.

## Secrets
- Do not commit secrets.
- Local Supabase keys live in `web/.env.local` (gitignored).
- Ключи и токены для этого репозитория смотреть и хранить только в:
  1. `.env.local` в корне проекта (runtime: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `CANDIDATE_REPLY_WEBHOOK_URL`, `SUPABASE_DB_URL`).
  2. `ops-web/.env.local` (frontend: `VITE_SUPABASE_*`, `VITE_SENTRY_*`).
  3. `~/.codex/config.toml` (только MCP-конфиг и ссылки на env-переменные; без hardcoded секретов в документации).
- Запрещено хранить реальные ключи в Markdown/документации (`docs/*`, `ai/mcp/*`, `README.md`); использовать placeholders.

## Vendoring External Repos (Best Practice)
- If we need to bring information/files from another repository and keep it close to upstream (periodic updates, clear provenance), prefer **vendoring via git submodule or git subtree** rather than copy/paste.
- `git submodule`:
  - Pros: clean history, easy to pin/update by commit.
  - Cons: requires submodule workflow discipline; can complicate CI/CD if not handled.
- `git subtree`:
  - Pros: lives like a normal folder in the repo; no submodule workflow for contributors.
  - Cons: less standard than submodules, but pragmatic.
- For “toolkit”-style repos like `spec-kit`, submodule/subtree is appropriate if we want to keep syncing upstream. If we only need conventions/templates, it is also acceptable to copy the minimal set into the project and treat it as project-owned going forward.

## Code Review Standard (Mandatory)
- Use the `code-review-expert` standard from [sanyuan0704/code-review-expert](https://github.com/sanyuan0704/code-review-expert) for any explicit review task and before major merges.
- Review workflow is required:
  1. Scope with `git diff`.
  2. SOLID and architecture checks.
  3. Dead/unused code and safe removal plan.
  4. Security scan (XSS, injection, SSRF, auth gaps, race conditions, secrets).
  5. Code quality scan (error handling, performance, boundaries, null/empty/off-by-one).
  6. Output findings by severity (P0-P3).
  7. Confirm with user before implementing broad refactors/fixes.
- Severity policy:
  - `P0` critical: blocks merge.
  - `P1` high: fix before merge.
  - `P2` medium: fix now or create follow-up.
  - `P3` low: optional improvement.
- Review output must include:
  - file path and line reference,
  - concrete risk description,
  - recommended fix.
