# ОАП: правила дизайна и переиспользования

## Назначение
Этот документ фиксирует обязательные правила дизайна внутреннего сервиса ОАП, чтобы:
- поддерживать единый UX;
- переиспользовать компоненты;
- сохранять связь между логикой и UI;
- переносить ОАП в другие сервисы без потери смысла.

## Обязательные правила
1. Reuse-first
- Любой новый UI-блок карточки строится из существующих базовых компонентов ОАП.
- Дублирование компонентов запрещено, если можно расширить существующий компонент пропсами.

2. Logic-to-UI traceability
- Каждый визуальный элемент с цифрой должен иметь явную формулу/источник.
- Для каждой рекомендации обязательно поле `basis` (основание) и ссылка.

3. Evidence-first copy
- Тексты без практической пользы не добавляются.
- Для формулировок "что улучшит" требуется конкретный эффект в цифрах или четкий операционный результат.
- Для неоднозначных терминов и заголовков таблиц использовать единый glossary-source, а не разносить объяснения по React-компонентам.

4. Section consistency
- Порядок разделов карточки фиксированный (смотри `README.md`) и одинаков для всех агентов.
- Изменение порядка допустимо только после обновления этого документа и согласования в PR.
- Канонический порядок top-level карточки:
  1. `Шапка`
  2. `Анализ эффективности агента`
  3. `Как работает ИИ агент`
  4. `Рабочий контур агента`
  5. `Память`
  6. `Риски`
- `analyst-agent` overview является эталонным composer для всех top-level карточек.
- Любое изменение структуры, порядка секций, CTA или modal behavior делается один раз в общем composer и автоматически распространяется на `orchestrator-agent`, `analyst-agent`, `designer-agent`, `reader-agent`.
- `designer-agent` является владельцем UX sign-off для порядка секций, названий блоков, empty-state copy и modal microcopy в карточках top-level агентов.
- Для `designer-agent` в разделе `Навыки и Правила` обязателен отдельный блок
  `UX-гейт качества перед передачей в разработку`.
- Этот UX-гейт для `designer-agent` включает 5 обязательных проверок:
  - приоритет первого экрана;
  - ясность действия (CTA и заголовки);
  - консистентность состояний;
  - пояснения в точках риска (tooltip/inline-help);
  - защита рискованных действий (подтверждения и текст последствий).
- Для каждого пункта UX-гейта в UI обязательно показывать:
  - что проверяем;
  - что предотвращает;
  - на какие метрики эффективности влияет.
- Для `designer-agent` в элементах с путями-гиперссылками обязательно открывать файл по фактическому указанному пути.
  Пример: если в карточке показан путь `.codex/skills/doc/SKILL.md`, по клику должен открыться этот же файл, а не другой источник.
- Для modern-агентов блок `План работы` в карточке показывается в компактном формате:
  - `Миссия`;
  - `Процесс по которому работает ИИ агент`;
  - `Путь` (гиперссылка на `*_OPERATING_PLAN.md`, открывает модалку);
  - `История логов ИИ агента` (гиперссылка на `.logs/agents/<agent-id>.jsonl`, открывает модалку).
- Контракт отображения capabilities в `Плане работы` обязателен:
  - step-level `Навыки/Инструменты/MCP` трактуются как baseline minimum;
  - модалка operating plan должна явно показывать, что runtime-capabilities выбираются динамически;
  - dynamic-capabilities в UI/текстах должны быть трассируемы к `used*`/`available*` в registry и `capability_snapshot`.
- Для dynamic-capability решений в copy и таблицах обязательно сохранять policy-gates:
  - `official-first`,
  - `shadow trial`,
  - `human approve`.
- URL карточки агента является source-of-truth для выбранного агента и вкладки:
  - канонический формат для top-level: `#/agents?agent=<agent-id>&tab=overview`;
  - legacy `tab`-значения `mcp`, `skills_rules`, `tasks_quality`, `memory_context`, `improvements` допускаются только как backward-compatible aliases и всегда канонизируются в `tab=overview`;
  - `overview` является единственным продуктовым экраном карточки; отдельная tab-навигация внутри drawer не используется;
  - канонизация должна использовать `replaceState`, а не `pushState`.
- Совместное решение продакт-дизайнера и разработчика: каждая пользовательская модалка с содержательным контекстом должна иметь собственный URL-state.
  - канонический формат для модалок в `#/agents`: `modal=<modal-key>` и, при необходимости, `entity=<stable-id>` (допускается доменный ключ, например `capability=<row-key>`);
  - для всех top-level агентов канонические modal keys: `metrics_catalog`, `operative_memory`, `lessons`, `sessions`, `improvement_history`, `capability_comparison`, `capability_journal`;
  - модалка должна открываться напрямую по URL и восстанавливаться после reload;
  - копирование ссылки должно включать активную модалку и её сущность;
  - если modal/entity невалидны, роут канонизируется в ближайшее валидное состояние (родительская страница или родительская модалка).
  - microcopy модалок (`LessonsDrawer`, `SessionsDrawer`) фиксируется без инженерного жаргона: только пользовательские статусы и понятные подписи; возвращать тех-текст в шапку нельзя без отдельного product sign-off.
- Исключения из modal URL-контракта:
  - `toast`/snackbar;
  - короткие confirm/cancel диалоги без аналитического контента;
  - tooltip/popover-инлайн подсказки.
- Для всех агентов используется единый `UnifiedAgentDrawer`.
- Канонический runtime-контракт drawer строится на analyst-card composition с `overview-first` deep-link и fallback-данными для остальных профилей.
- Top-level agent governance обязателен:
  - новая роль не может появиться в active UI только потому, что для нее написали prompt или export adapter;
  - для top-level роли обязательны `distinct mission`, `measurable task class`, `bounded delegation`, telemetry viability KPI и host adapter support;
  - если это не доказано, роль должна жить как `runtime specialist`, а не как новая карточка в active registry;
  - source-of-truth для этого правила: `docs/subservices/oap/MULTI_AGENT_GOVERNANCE.md`.
- Special-case drawer для конкретного агента не является каноническим решением.

5. Status language
- В карточке использовать только однозначные RU-формулировки.
- Справочник статусов хранить в документации, а не в каждой карточке.

6. Progressive disclosure
- Короткая суть показывается сразу.
- Детали (полные тексты навыков/основания/источники) — через раскрытие.
- Системные длинные тексты не дублируются в карточках; показываются через модалки (`Правила работы раздела`, `Открыть все рекомендации`).
- Любой путь к файлу, показанный как ссылка в карточке агента, должен одновременно:
  - оставаться кликабельным (открывать модалку/источник),
  - поддерживать выделение и копирование текста мышью без принудительного открытия.
- Для ссылок с путями действует strict path-resolve:
  - открывается именно файл по указанному пути (после стандартной нормализации `./`/`/`), без подмены на "похожий" документ;
  - если файл по этому пути отсутствует в индексируемых источниках, ссылка не должна вести на другой файл;
  - в модалке должен быть показан фактический файл, соответствующий отображаемому пути в UI.
- Для ссылок на источники с `pathHint` нельзя показывать пользователю сырую пару `Участок + URL`:
  - в карточке источник подписывается понятным названием документа (как в архитектуре/реестре);
  - переход должен открывать модалку внутри сервиса;
  - в модалке показывается релевантный фрагмент по `pathHint` (или ближайшему подходящему заголовку), а не весь документ по умолчанию.
- Для блока `План работы` детальные подпункты (`Политика источников`, `Whitelist`, `Lifecycle`, `Политика уведомлений`, `Критичные случаи`) не дублируются в карточке и читаются в модалке operating plan.

7. Reusable integration model
- Источники данных подключаются через адаптеры (registry, telemetry, task tracker).
- UI не должен зависеть от конкретного поставщика данных напрямую.

8. Memory context contract-first
- Раздел `Память и контекст` обязателен для всех профилей карточки агента.
- Порядок 8 секций фиксированный и не меняется локально под одного агента.
- Traceability обязательна: `anchor -> decision/review -> next action`.
- При отсутствии telemetry UI не падает: показывается fallback и текст `не зафиксировано`.
- Служебный шум (`unknown`, внутренние id без контекста) в пользовательском copy не показывается.
- Для `analyst-agent` в блоке `Оперативная память` обязателен подпункт `Самоулучшение агента (Self-improvement loop)`:
  - строка `Память и правила, полученные из практического опыта агента` с простым tooltip-пояснением;
  - ссылка на `docs/subservices/oap/tasks/lessons/analyst-agent.md`;
  - ссылка `Список актуальных задач...` с числом, открывающая правую боковую модалку со списком `название + статус`;
  - в этом списке для `analyst-agent` допускаются задачи исполнителя `designer-agent` (продакт дизайнер), если источник задачи — `analyst-agent`;
  - каждый пункт списка обязан открывать эталонную модалку задачи (`TaskDetailsDrawer` как на странице `#/tasks`).
- Блок `Память` должен обновляться на каждом завершенном цикле сессии:
  - источник оперативной части — фактические `artifacts_read[]` последнего цикла;
  - статический fallback разрешен только если телеметрии цикла нет.
- В блоке `Память` запрещены моковые значения и фиктивные ссылки:
  - показываются только пути, которые реально присутствуют в индексируемых документах ОАП;
  - каждая показанная гиперссылка обязана открывать реальный файл/лог в модалке.

9. Modern operating standards contract-first
- Операционные стандарты modern-агентов обязательны:
  - `docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md`
  - `docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md`
- Разделы стандарта в UI показываются в структурированном формате, без свободной интерпретации.
- Для ссылки `История логов ИИ агента` используется гибридная модалка:
  - верх: релевантный фрагмент operating plan;
  - низ: полная лента событий из `.logs/agents/<agent-id>.jsonl` (tolerant parsing, сортировка по `timestamp`).
- Для viewer-а `Журнал действий агента` внутри карточки:
  - в основной строке события показываются только `время`, `step`, `status`, `outcome`, `run_id`;
  - метаданные ниже идут последовательными блоками: `цикл`, `токены`, `артефакты`, `MCP`, `навыки`;
  - технические поля (`trace_id`, `recommendation_id`, `process`, `строка лога`) переносятся в вторичный блок `Тех. детали`;
  - default-процесс `vibe_coding` не показывается пользователю как отдельное поле.
- Для канонической top-level карточки, построенной на `analyst-agent` overview, обязателен единый блок `Анализ эффективности агента`:
  - на карточке показывается не более 6 метрик;
  - блок объединяет операционные метрики цикла и ключевые метрики бизнес-результата;
  - в дефолтный набор входят: `ср. расход токенов за цикл`, `ср. кол-во ошибок за цикл`, `ср. кол-во задач создано за цикл`, `кол-во задач от агента`, `средний прирост целевой метрики`, `доля рекомендаций с подтвержденным эффектом`;
  - строка `ср. кол-во ошибок за цикл` открывает модалку с журналом ошибок;
  - ссылка `Открыть остальные метрики` открывает модалку с дополнительными workflow/benchmark-показателями эффективности.
- Для экрана `#/agents` в блоке `Целевые метрики` у modern-агентов обязателен отдельный подпункт `Жизнеспособность роли`:
  - цель подпункта: показать, нужен ли агент как отдельная активная роль, а не только его качество выполнения;
  - в базовый набор входят: `invocation_count`, `completed_task_count`, `handoff_use_rate`, `overlap_with_analyst_rate`, `verification_pass_rate`, `orchestration_cost_per_completed_task`, `host_adapter_sync_status`;
  - каждая строка обязана иметь tooltip `Как считается` с формулой и источником telemetry;
  - `host_adapter_sync_status` показывается человеко-понятным статусом (`синхронизированы`, `частично синхронизированы`, `не подключены`, `архив`), а не raw enum.
- Метрики, которые исторически относятся к блоку `Ключевые метрики агента`, должны быть явно отмечены в UI бейджем `Ключевая`:
  - `кол-во задач от агента`;
  - `средний прирост целевой метрики` (по документированному `expectedDelta`, в п.п.);
  - `доля рекомендаций с подтвержденным эффектом`;
  - `доля рекомендаций с документально подтвержденной актуальностью`.
- Для всех метрик в блоке `Анализ эффективности агента` и в модалке остальных метрик tooltip `Как считается` обязателен и содержит:
  - краткое объяснение;
  - формулу;
  - источник данных;
  - короткий пример интерпретации.
- Если данных для раздела нет, используется явный fallback `не зафиксировано`.

10. Workflow policy and section-rule sync
- Для modern-агентов workflow фиксируется как контракт: `Plan -> Execute -> Verify -> Learn`.
- Для нетривиальных задач обязательны `plan` и `verify` шаги до финального статуса `done`.
- Любая пользовательская коррекция должна фиксироваться в OAP lessons-loop (self-improvement).
- Self-improvement learning core обязателен для всех агентов (не только modern):
  - `planned|started -> verify_started -> verify_passed|verify_failed -> lesson_captured|lesson_not_applicable -> completed|failed|review_passed`.
- Режим enforce вводится поэтапно:
  - сначала `soft_warning`,
  - затем `strict` после стабилизации метрик.
- Модель уроков должна быть гибридной:
  - общий канон: `docs/subservices/oap/tasks/lessons.global.md`,
  - агентные уроки: `docs/subservices/oap/tasks/lessons/<agent-id>.md`,
  - `docs/subservices/oap/tasks/lessons.md` поддерживается как fallback/индекс.
- Если меняется логика секции карточки, обязательно обновляются одновременно:
  - UI-логика секции;
  - data-contract/schema/types;
  - OAP-документация;
  - модалка `Правила работы раздела` этой секции.
- Benchmark контур (local-first) обязателен для quality-оценки modern-агентов:
  - датасет кейсов: `artifacts/analyst_benchmark_dataset.json`;
  - агрегат запуска: `artifacts/agent_benchmark_summary.json`;
  - история тренда: `artifacts/agent_benchmark_history.jsonl`;
  - в UI раздела `Задачи и качество` показывать отдельный блок `Benchmark стабильность`.
- CI политика benchmark-гейта: `soft_warning` по умолчанию (фиксируем деградации без блокировки merge до стабилизации).

## Минимальный набор переиспользуемых компонентов ОАП
- `AgentHeaderCard`
- `AgentHeartbeatCard`
- `EvidenceSourcesCard`
- `UsedMcpCard`
- `RecommendedMcpCard`
- `UsedSkillCard`
- `RecommendedSkillCard`
- `TaskSummaryCard`
- `ImprovementCard`

## Контракт данных (минимум для карточки)
- `agent.id`, `agent.name`, `agent.role`, `agent.status`, `agent.updatedAt`, `agent.source`
- `tasks`: `in_work`, `on_control`, `overdue`
- `taskBoard` (optional): `source`, `statusFlow`, `fields`, `filters`
- `task_brief.context_package.operational_memory[]`: `{ key, title, value, source_ref?, updated_at? }`
- `task_brief.context_package.collaboration_plan`:
  `{ analysis_required, suggested_agents[], selected_agents[], rationale, reviewed_at?, primary_coordinator_agent_id?, merge_owner_agent_id?, interaction_mode?, interaction_phases[]?, roundtable_policy?, discussion_rounds[]?, spawned_instances[]? }`
- `task_brief.context_package.ab_test_plan`:
  `{ enabled, sessions_required, pass_rule, target_metric, expected_delta_pct, guardrails[], rollback_on_fail }`
- `usedMcp[]`: `name`, `status`, `note`, `impactInNumbers`, `practicalTasks[]`
- `availableMcp[]`: `name`, `description`, `whenToUse`, `expectedEffect`, `basis`, `practicalTasks[]`, `link`, `installComplexity`
- `usedSkills[]`: `name`, `usage`, `fullText`, `practicalTasks[]`
- `usedSkills[]` (modern agents): дополнительно `lastUsedAt`, `skillFilePath`, `skillFileText`, `skillFileLoaded`
- `availableSkills[]`: `name`, `benefit`, `recommendationBasis`, `expectedEffect`, `fullText`, `practicalTasks[]`, `link`
- `contextRefs[]`: `title`, `filePath`, `pathHint`, `sourceUrl`
- `rulesApplied[]`: `title`, `location`, `description`, `fullText`, `sourceUrl`
- `workflowPolicy`: `planDefault`, `replanOnDeviation`, `verifyBeforeDone`, `selfImprovementLoop`, `autonomousBugfix`
- `learningArtifacts`: `todoPath`, `lessonsPath` (рекомендуемо `docs/subservices/oap/tasks/lessons/<agent-id>.md`), `lastLessonAt`
- `workflowMetricsCatalog[]`: `plan_coverage_rate`, `verification_pass_rate`, `lesson_capture_rate`, `replan_rate`, `autonomous_bugfix_rate`, `elegance_gate_rate`
- `benchmarkMetrics` (runtime artifact): `pass_at_5`, `fact_coverage_mean`, `schema_valid_rate`, `trajectory_compliance_rate`, `judge_disagreement_rate`, `cost_per_success`
- `benchmarkImpactMetrics` (runtime artifact): `recommendation_executability_rate`, `evidence_link_coverage`, `time_to_action_p50`, `validated_impact_rate`
- `doneGatePolicy`: `mode`, `requiredChecks[]`, `fallbackStatus`
- `analystRecommendations[]`
- `improvements[]`: `title`, `problem`, `solution`, `effect`, `priority`, `detectionBasis`, `promptTitle`, `promptMarkdown`, `promptPath`, `promptSourceUrl`, `ice`, `ownerSection`, `targetMetric`, `baselineWindow`, `expectedDelta`, `validationDate`

## Правила метрик и оценки
- ICE оставлять обязательно, но использовать как `ex-ante` приоритизацию candidate-инициатив (до внедрения).
- Для эффекта внедрения использовать `ex-post` слой с метриками: `kpi_delta`, `time_to_value`, `regression_rate`.
- На каждую рекомендацию фиксировать: `ownerSection`, `targetMetric`, `baselineWindow`, `expectedDelta`, `validationDate`.
- На weekly-review пересчитывать `confidence` по факту внедрения и результата.
- Для задач использовать `Task Quality Score (TQS)` или `severity/impact`; ICE на task-level не применять.
- В агрегаторе `Улучшения` ранжировать карточки по гибридному приоритизационному score: `ICE + evidence_strength + section_risk`.
- В UI метрики отображаются строками `название + понятное описание + фактическое значение`, а не `Chip`-тегами.
- Для каждой метрики обязателен tooltip `Как считается` с формулой и источником данных.
- Процентные метрики всегда показываются как `%` со значением, счетчики — числом, время — в `мс/с`; при отсутствии данных использовать `не зафиксировано`.
- Для workflow-метрик (plan/verify/lessons/replan/autonomous/elegance) также обязателен tooltip `Как считается`.
- Для benchmark-метрик также обязателен tooltip `Как считается` с формулой и источником (`artifacts/agent_benchmark_summary.json`).
- Для экрана `#/agent-flow` обязательно показывать фактический `file trace` (read/write) на основе telemetry-полей `artifacts_read[]` и `artifacts_written[]`; если данных нет, показывать явный fallback-warning.
- Для канонических шагов в `#/agent-flow` обязательны inline-маркеры с пользовательскими формулировками:
  - `step_8_verify` -> `Проверка результата`,
  - `step_9_publish_snapshots` -> `Обновление способностей` (если `capabilityOptimization.enabled=true` и `refreshMode=on_run`).
- В `agent-flow` не использовать отдельный блок `runtime-контуры`; критичные развилки показывать прямо внутри основного пайплайна.
- В карточке задачи orchestration показывать отдельным блоком `Схема работы агентов`, а не прятать внутри `Контекст и доказательства`.
- Блок `Схема работы агентов` обязан показывать:
  - координатора,
  - режим взаимодействия,
  - фазы с участниками и merge point,
  - host backend по умолчанию,
  - instance graph,
  - если включен roundtable: policy и summary-only историю раундов.
- В истории задачи phase-aware события группировать по `phase_id`; для событий orchestration показывать `execution_mode`, `read_only`, `round_index` при наличии.
- Для `agent-flow` вместо BPMN-виджета использовать Mermaid-схему `unified capability optimization loop`.
- В `agent-flow` не показывать отдельный блок `Таймлайн шагов`; основной фокус экрана: пайплайн, loop-схема и факт последнего цикла.
- Для onboarding новичков в `agent-flow` обязателен короткий путь чтения:
  - `пайплайн -> Mermaid loop -> последний цикл -> file-trace`.
- Runtime-факт последнего цикла допускается analyst-first; для остальных агентов показывать тот же UX-путь без детализации runtime-таймлайна.
- Для `file trace` запрещено определять тип файла только по пути:
  - UI обязан разделять `source_kind` (что это за источник) и `semantic_layer` (какой capability-слой читался/писался);
  - `source_kind` используется как основной label в UI и в агрегируемых session/file-метриках;
  - `semantic_layer` показывается вторичным label или tooltip и не подменяет тип источника;
  - `docs/agents/registry.yaml` должен отображаться как `Registry`, а не как `Tools`;
  - `docs/agents/profile_templates.yaml` должен отображаться как `Template catalog`, а не как `Tools`.
- Structured artifact trace обязателен как целевая модель для всех OAP viewer-ов:
  - поддерживаемые поля: `path`, `source_kind`, `semantic_layer`, `reason`, `label`;
  - legacy string-path telemetry допускается только как backward-compatible fallback;
  - при legacy fallback UI может восстановить `source_kind`, но не должен утверждать `semantic_layer`, если он не подтвержден данными.

## Формулы раздела «Задачи и качество»
- `review_error_rate = review_errors / completed_tasks * 100`.
- `TQS = clamp(100 - 35*review_errors - 20*overdue_flag - 15*blocked_flag - 10*retry_count, 0, 100)`.
- Если task-level поля `overdue_flag|blocked_flag|retry_count|duration` недоступны, допускается partial-расчет по доступной части и явная пометка `N/A` для отсутствующих компонент.
- `pass_at_5 = successful_cases / total_cases`.
- `fact_coverage_mean = avg(fact_coverage)`.
- `schema_valid_rate = valid_schema_attempts / attempts_total`.
- `trajectory_compliance_rate = trajectory_ok_attempts / attempts_total`.
- `judge_disagreement_rate = judge_disagreed / human_checked` (меньше — лучше, целевой верхний порог).
- `cost_per_success = total_cost_usd / successful_cases`.
- `verification_pass_rate = unique task_id с verify_started и verify_passed / unique task_id с verify_started`.
- `lesson_capture_rate = unique task_id с lesson_captured / (unique task_id с verify_passed + unique task_id с verify_failed)`.

## Правила для раздела `Задачи` (task board)
- Статусы фиксированные: `backlog`, `ready`, `in_progress`, `ab_test`, `in_review`, `done`.
- UI-формулировки RU-first:
  - `Backlog`
  - `Можно брать`
  - `В работе`
  - `A/B тест`
  - `На ревью`
  - `Готово`
- Переходы строятся по telemetry-событиям (не через прямой write из UI):
  - `candidate_received -> backlog`
  - `candidate_assessed -> ready`
  - `candidate_rejected -> backlog`
  - `recommendation_suggested -> ready`
  - `started -> in_progress`
  - `ab_test_started -> ab_test`
  - `ab_test_checkpoint -> ab_test`
  - `ab_test_passed -> in_review`
  - `ab_test_failed -> backlog`
  - `rollback_applied -> backlog`
  - `completed -> in_review`
  - `review_passed -> done`
  - `verify_passed -> done`
  - `verify_failed -> backlog`
  - `recommendation_applied + outcome=success -> done`
  - `failed/review_failed/step_error -> backlog`
- Правило A/B pass/fail:
  - `target_plus_guardrails`;
  - pass: `median(target_delta_pct) >= expected_delta_pct` и `guardrail_breached_count = 0`;
  - fail: `ab_test_failed` + `rollback_applied`.
- Для запуска задачи UI показывает копируемую команду `make agent-log ... STATUS=started`.

## ICE vs TQS vs IES
- ICE: до выполнения; отвечает на вопрос «что делать сначала?»; уровень — рекомендация/инициатива.
- TQS: после выполнения задачи (или по мере завершения); отвечает на вопрос «насколько хорошо сделали задачу?»; уровень — task-level.
- IES (outcome score): после внедрения улучшения; отвечает на вопрос «какой фактический эффект получен?».

## Правила ссылок

### Внешние ссылки (открываются в новой вкладке)
- Обязательно помечаются иконкой `OpenInNew` (14px, color text.secondary) **перед** текстом ссылки.
- Оформляются через компонент `ExternalLink` (`ops-web/src/components/analyst-card/ExternalLink.tsx`).
- Используют `<a>` тег с `target="_blank" rel="noopener noreferrer"` — **не button**.

### Все ссылки в карточках агентов
- Текст ссылки должен поддерживать выделение и копирование мышью: `userSelect: "text"`.
- Применяется к `FilePathLink` и `ExternalLink`.

### Формат даты (стандарт ОАП)
- Шаблон: `26 июля 2026, 23:00`
- Реализация: `new Date(value).toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })`
- Если значение `null` или невалидное — показывать `"—"`.

## Do / Don't
Do:
- показывать причинно-следственную связь: проблема -> действие -> эффект;
- использовать единый визуальный паттерн для MCP и Skills;
- хранить формулы KPI рядом с данными (в коде/доках).
- при изменении секции карточки синхронно обновлять текст модалки `Правила работы раздела`.

Don't:
- не добавлять "общие" рекомендации без основания;
- не использовать разные названия для одинаковых сущностей;
- не смешивать бизнес-логику и оформление в одном компоненте.
- не показывать секреты/токены в карточке, логах и модалках.
