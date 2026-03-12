import type { AgentWorkflowBackbone } from "./generatedData";

/* ------------------------------------------------------------------ */
/*  Rich step metadata for process visualisation                       */
/* ------------------------------------------------------------------ */

export type RichStepMeta = {
  id: string;
  /** Human-readable step name */
  label: string;
  /** 1–3 sentence explanation of what happens here */
  what: string;
  /** Key inputs (files / data) — shown as bullet list */
  reads: string[];
  /** Key outputs (files / data) — shown as bullet list */
  writes: string[];
  /** When is this step done? */
  doneGate: string;
  /** Visual grouping */
  phase: "prepare" | "role" | "deliver" | "learn";
  /** Is this a domain-specific (roleWindow) step? */
  isRoleWindow: boolean;
  /** Is this the entry / exit boundary? */
  isEntry: boolean;
  isExit: boolean;
};

/* ── Phase labels ── */
export const PHASE_LABELS: Record<RichStepMeta["phase"], string> = {
  prepare: "Подготовка",
  role: "Доменная работа",
  deliver: "Доставка результата",
  learn: "Обучение и публикация",
};

export const PHASE_COLORS: Record<RichStepMeta["phase"], { bg: string; border: string; text: string }> = {
  prepare: { bg: "#eff6ff", border: "#3b82f6", text: "#1e3a5f" },
  role:    { bg: "#faf5ff", border: "#8b5cf6", text: "#4c1d95" },
  deliver: { bg: "#ecfdf5", border: "#10b981", text: "#064e3b" },
  learn:   { bg: "#fefce8", border: "#eab308", text: "#713f12" },
};

/* ── Backbone step metadata (shared across all agents) ── */

type BackboneStepRow = {
  label: string;
  what: string;
  reads: string[];
  writes: string[];
  doneGate: string;
  phase: RichStepMeta["phase"];
};

const BACKBONE: Record<string, BackboneStepRow> = {
  step_0_intake: {
    label: "Приём задачи",
    what: "Агент получает задачу, фиксирует scope и подготавливает task-run: owner, цель, контекстный пакет.",
    reads: ["registry.yaml (профиль агента)", "логи предыдущих циклов", "profile_templates.yaml"],
    writes: ["task_brief.context_package", "operational_memory", ".logs/agents/<agent>.jsonl (started)"],
    doneGate: "task/run подготовлены, есть owner и цель",
    phase: "prepare",
  },
  step_1_start: {
    label: "Запуск цикла",
    what: "Создаётся run_id и trace_id. Фиксируется событие started в telemetry — это точка отсчёта для всех метрик цикла.",
    reads: ["OPERATING_PLAN.md", "AGENTS.md"],
    writes: [".logs/agents/<agent>.jsonl (status=started)"],
    doneGate: "run_id / task_id / trace_id зафиксированы",
    phase: "prepare",
  },
  step_2_preflight: {
    label: "Проверка готовности",
    what: "Агент проверяет: нет ли блокеров (MCP недоступен, критические ошибки), хватает ли контекста для работы. Если есть блокер — цикл не начинается.",
    reads: ["registry.yaml", "agent_telemetry_summary.json", "MCP endpoints"],
    writes: [".logs/agents/<agent>.jsonl (health-check)"],
    doneGate: "нет блокеров critical без owner",
    phase: "prepare",
  },
  step_3_orchestration: {
    label: "Стратегия и оркестрация",
    what: "Определяется reuse-first стратегия: можно ли переиспользовать готовые компоненты, кого из агентов-специалистов подключить, какой бюджет на шаги.",
    reads: ["registry.yaml", "profile_templates.yaml"],
    writes: ["collaboration_plan", ".logs/agents/<agent>.jsonl"],
    doneGate: "у каждой instance есть purpose / scope / allowlist / budget",
    phase: "prepare",
  },
  step_4_context_sync: {
    label: "Сбор evidence и контекста",
    what: "Агент загружает все необходимые документы: спецификацию, контракты, дизайн-правила, память прошлых циклов. Это evidence-база для принятия решений.",
    reads: ["spec.md", "contracts/*", "DESIGN_RULES.md", "lessons/*.md", "telemetry"],
    writes: [".logs/agents/<agent>.jsonl (evidence)"],
    doneGate: "evidence coverage достаточен, противоречия отмечены",
    phase: "prepare",
  },
  step_5_role_window: {
    label: "Вход в доменную ветку",
    what: "Агент переходит к своим уникальным доменным шагам. Здесь начинается основная специализированная работа.",
    reads: [],
    writes: [],
    doneGate: "control передан в roleWindow",
    phase: "role",
  },
  step_6_role_exit_decision: {
    label: "Выход из доменной ветки",
    what: "Агент формирует нормализованный result-package и возвращает управление в общий backbone. Результат готов к применению.",
    reads: ["результат доменных шагов"],
    writes: ["result_package", ".logs/agents/<agent>.jsonl"],
    doneGate: "result-package сформирован, приоритеты определены",
    phase: "role",
  },
  step_7_apply_or_publish: {
    label: "Применение результата",
    what: "Агент вносит изменения: обновляет файлы, документацию, конфиги, пересобирает контент-индекс. Это шаг реального action.",
    reads: ["целевые файлы", "contracts"],
    writes: ["изменённые файлы", "generated/*.json", ".logs (recommendation_applied)"],
    doneGate: "prepare-content + check-agents проходят",
    phase: "deliver",
  },
  step_7_contract_gate: {
    label: "Контрактная проверка",
    what: "Проверяется, что результат соответствует schema и output contract. Если нарушен контракт — изменение откатывается.",
    reads: ["agents-manifest.json", "agents-card.schema.json"],
    writes: [".logs/agents/<agent>.jsonl (contract_gate)"],
    doneGate: "контракт валиден, fallback-нарушений нет",
    phase: "deliver",
  },
  step_8_verify: {
    label: "Верификация эффекта",
    what: "Агент проверяет: дало ли изменение ожидаемый эффект? Нет ли регрессий? Если verify_failed — запускается rollback или next-action.",
    reads: [".logs/agents/*.jsonl", "telemetry_summary", "тесты (если UI)"],
    writes: [".logs (verify_passed / verify_failed)", "cycle_validation_report.json"],
    doneGate: "verify_passed либо rollback/next-action",
    phase: "deliver",
  },
  step_8_error_channel: {
    label: "Обработка ошибок",
    what: "Все ошибки верификации классифицируются по severity. Для каждой назначается owner и next action. Критичные — эскалируются немедленно.",
    reads: ["ошибки verify-шага", "логи"],
    writes: [".logs (review_error)", "уведомления (при critical)"],
    doneGate: "каждая ошибка имеет severity / owner / next action",
    phase: "deliver",
  },
  step_9_finalize: {
    label: "Фиксация урока",
    what: "Агент анализирует цикл: что пошло хорошо, что нет. Фиксирует урок в lessons.md с root cause и preventive rule. Обновляет telemetry-сводку.",
    reads: ["результаты verify", "lessons.global.md", "lessons/<agent>.md"],
    writes: ["lessons/<agent>.md", "telemetry_summary.json", ".logs (lesson_captured, completed)"],
    doneGate: "цикл закрыт без нарушения state-machine",
    phase: "learn",
  },
  step_9_publish_snapshots: {
    label: "Публикация снимков",
    what: "Пересобирается manifest для UI, обновляются capability snapshots. После этого шага интерфейс отражает результаты цикла.",
    reads: ["telemetry_summary", "benchmark_summary", "latest_cycle"],
    writes: ["generated/*.json", "public/generated/*", "capability_snapshot.json"],
    doneGate: "UI получает консистентный snapshot",
    phase: "learn",
  },
};

/* ── Per-agent role step overrides ── */

type RoleStepRow = {
  label: string;
  what: string;
  reads: string[];
  writes: string[];
  doneGate: string;
};

const ROLE_STEPS: Record<string, RoleStepRow> = {
  /* analyst */
  role_collect_quality_signals: {
    label: "Сбор сигналов качества",
    what: "Агент собирает quality signals: review-ошибки, деградации метрик, изменения в MCP-покрытии, новые candidate-практики из whitelist-источников.",
    reads: ["telemetry_summary.json", "whitelist-источники (docs/changelog)", "стандарты ОАП"],
    writes: ["рабочий candidate-list", ".logs (candidate_received / candidate_assessed)"],
    doneGate: "у каждого candidate есть source и quality score",
  },
  role_score_candidates: {
    label: "Оценка кандидатов",
    what: "Каждый candidate оценивается: impact × confidence × ease (ICE). Определяется target metric, baseline, expected delta. Кандидаты без evidence отсеиваются.",
    reads: ["candidate-list", "registry.yaml", "текущие метрики"],
    writes: ["scored candidate-list с owner/metric/delta", ".logs"],
    doneGate: "каждый candidate имеет owner, metric, baseline, expected delta",
  },
  role_select_priority: {
    label: "Выбор приоритета",
    what: "Из scored-списка выбираются top-priority для внедрения. Остальные уходят в backlog. Подходящие запускаются через A/B (3–8 сессий).",
    reads: ["scored candidate-list", "telemetry-сигналы"],
    writes: ["registry.yaml (lifecycle/priority)", "ab_test_plan", ".logs"],
    doneGate: "selected ≤ budget, остальные в backlog",
  },
  /* designer */
  role_review_ui_kit: {
    label: "Проверка UI kit",
    what: "Агент сверяет изменения с дизайн-системой: Material 3 токены, типографика, spacing. Находит расхождения с UI kit.",
    reads: ["текущие компоненты", "DESIGN_RULES.md", "M3 guidelines"],
    writes: ["список отклонений от kit", ".logs"],
    doneGate: "все отклонения зафиксированы с severity",
  },
  role_review_clarity: {
    label: "Проверка ясности UX",
    what: "Проверяется понятность интерфейса: информационная иерархия, progressive disclosure, доступность. Выявляются проблемы восприятия.",
    reads: ["экраны и компоненты", "DESIGN_RULES.md", "accessibility стандарты"],
    writes: ["UX-замечания", ".logs"],
    doneGate: "каждое замечание имеет impact и fix",
  },
  role_prepare_design_actions: {
    label: "Пакет дизайн-действий",
    what: "Формируется финальный пакет: что исправить, какой ожидаемый эффект на UX, verify-требования для проверки.",
    reads: ["отклонения от kit", "UX-замечания"],
    writes: ["design action package", "verify-требования", ".logs"],
    doneGate: "каждое действие имеет owner, expected effect, verify criteria",
  },
  /* reader */
  role_collect_sources: {
    label: "Сбор источников",
    what: "Агент находит релевантные документы, код, контракты по запросу. Используется QMD retrieval и Context7 для актуальных docs.",
    reads: ["spec.md", "contracts/*", "docs/**", "код проекта"],
    writes: ["source list с relevance score", ".logs"],
    doneGate: "найдены все ключевые источники по запросу",
  },
  role_synthesize_answer: {
    label: "Синтез ответа",
    what: "Из собранных источников формируется ответ: структурированный, с цитатами и ссылками на origin. Разделяется факт и интерпретация.",
    reads: ["source list", "spec.md"],
    writes: ["draft ответа со ссылками", ".logs"],
    doneGate: "ответ содержит evidence для каждого утверждения",
  },
  role_check_coverage: {
    label: "Проверка покрытия",
    what: "Проверяется: все ли аспекты запроса покрыты? Нет ли пропущенных источников? Нет ли противоречий между sources?",
    reads: ["draft ответа", "source list"],
    writes: ["coverage report", ".logs"],
    doneGate: "все аспекты покрыты, противоречия отмечены",
  },
  /* data */
  role_check_dataset_quality: {
    label: "Проверка качества датасета",
    what: "Агент проверяет ETL-пайплайн: полнота данных, типы, null-rate, дубликаты, freshness derived-таблиц.",
    reads: ["Supabase таблицы", "ETL конфиги", "quality rules"],
    writes: ["quality report", ".logs"],
    doneGate: "все quality checks пройдены или зафиксированы violations",
  },
  role_analyze_drift: {
    label: "Анализ drift",
    what: "Сравниваются текущие распределения данных с baseline. Выявляются аномальные сдвиги: schema drift, value drift, volume drift.",
    reads: ["baseline snapshots", "текущие данные", "telemetry"],
    writes: ["drift report (что и насколько сместилось)", ".logs"],
    doneGate: "каждый drift имеет severity и cause hypothesis",
  },
  role_prepare_data_action: {
    label: "Пакет data-действий",
    what: "Формируется action package: какие таблицы починить, какой ETL перезапустить, какие guardrails добавить.",
    reads: ["quality report", "drift report"],
    writes: ["data action package", ".logs"],
    doneGate: "каждое действие имеет expected effect и rollback plan",
  },
  /* ops */
  role_triage_operation: {
    label: "Разбор инцидента",
    what: "Агент классифицирует операционную проблему: severity, affected services, blast radius. Определяет первопричину.",
    reads: ["логи сервисов", "мониторинг", "Supabase health"],
    writes: ["triage report (severity, root cause)", ".logs"],
    doneGate: "severity определён, root cause зафиксирован",
  },
  role_select_runbook_action: {
    label: "Выбор runbook-действия",
    what: "Из runbook выбирается подходящая процедура устранения. Если runbook не покрывает кейс — эскалация.",
    reads: ["runbooks", "triage report", "CI/CD конфиги"],
    writes: ["selected action plan", ".logs"],
    doneGate: "action plan готов или escalation отправлен",
  },
  role_prepare_ops_resolution: {
    label: "Формирование решения",
    what: "Агент собирает пакет решения: шаги исполнения, verify-критерии, rollback plan. Включает уведомления для stakeholders.",
    reads: ["action plan", "runbook steps"],
    writes: ["ops resolution package", "notifications", ".logs"],
    doneGate: "resolution готов к исполнению с rollback plan",
  },
};

/* ── Public API ── */

function labelFor(step: string): string {
  return BACKBONE[step]?.label || ROLE_STEPS[step]?.label || step.replace(/^(step_\d+_|role_)/, "").replace(/_/g, " ");
}

function phaseFor(step: string): RichStepMeta["phase"] {
  return BACKBONE[step]?.phase || "role";
}

export function getRichStepsMeta(backbone: AgentWorkflowBackbone): RichStepMeta[] {
  const result: RichStepMeta[] = [];

  for (const step of backbone.commonCoreSteps) {
    const isEntry = step === backbone.roleWindow.entryStep;
    const isExit = step === backbone.roleWindow.exitStep;
    const row = BACKBONE[step];

    result.push({
      id: step,
      label: row?.label || labelFor(step),
      what: row?.what || "",
      reads: row?.reads || [],
      writes: row?.writes || [],
      doneGate: row?.doneGate || "",
      phase: row?.phase || "prepare",
      isRoleWindow: false,
      isEntry,
      isExit,
    });

    // After entry, insert internal role steps
    if (isEntry) {
      for (const rs of backbone.roleWindow.internalSteps) {
        const roleRow = ROLE_STEPS[rs];
        result.push({
          id: rs,
          label: roleRow?.label || labelFor(rs),
          what: roleRow?.what || backbone.roleWindow.purpose,
          reads: roleRow?.reads || [],
          writes: roleRow?.writes || [],
          doneGate: roleRow?.doneGate || "",
          phase: "role",
          isRoleWindow: true,
          isEntry: false,
          isExit: false,
        });
      }
    }
  }

  return result;
}

export { labelFor, phaseFor };
