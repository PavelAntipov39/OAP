import type {
  AgentTaskAbTestPlan,
  AgentTaskBrief as BaseAgentTaskBrief,
  AgentTaskCollaborationPlan,
  AgentTaskDetails as BaseAgentTaskDetails,
  AgentTaskOriginType,
  AgentTaskOperationalMemoryItem,
  AgentTaskPriority,
  AgentTaskReadinessManualState,
  AgentTaskReadinessState,
  AgentTaskOriginContext,
  AgentTaskRow as BaseAgentTaskRow,
  AgentTaskStatus,
  AgentTaskTimelineEvent as BaseAgentTaskTimelineEvent,
} from "./generatedData";

export type { AgentTaskAbTestPlan, AgentTaskCollaborationPlan, AgentTaskOriginType, AgentTaskOperationalMemoryItem, AgentTaskPriority, AgentTaskReadinessManualState, AgentTaskReadinessState, AgentTaskStatus };

export type AgentTaskUiStage = "incoming" | "ready_to_work" | "in_work" | "review" | "closed";
export type AgentTaskServiceMode = "none" | "waiting_human" | "ab_test";
export type AgentTaskCloseResolution = "implemented" | "cancelled" | "ab_rejected" | "duplicate" | "not_actual";
export type AgentTaskHumanDecisionType = "done" | "cancel" | "retry_ai";
export type AgentTaskRunStepKey =
  | "step_0_intake"
  | "step_1_start"
  | "step_2_health_check"
  | "step_3_orchestration"
  | "step_4_evidence_sync"
  | "step_5_candidate_scoring"
  | "step_6_priority_decision"
  | "step_7_apply"
  | "step_7_contract_gate"
  | "step_8_verify"
  | "step_8_error_channel"
  | "step_9_finalize"
  | "step_9_publish_snapshots"
  | "cycle_repair";

export type AgentTaskTimelineEvent = BaseAgentTaskTimelineEvent & {
  step_key: AgentTaskRunStepKey | null;
  step_label: string | null;
  step_raw: string | null;
};

export type AgentTaskHumanGate = {
  instruction: string;
  codex_prompt: string;
  completion_criteria: string;
  comment_required: boolean;
};

export type AgentTaskUiStageMeta = {
  label: string;
  description: string;
  analyst_action: string;
  why_it_exists: string;
  signal_actor_label: string;
  next_actor_label: string;
};

export const TASK_UI_STAGE_ORDER: AgentTaskUiStage[] = [
  "incoming",
  "ready_to_work",
  "in_work",
  "review",
  "closed",
];

export const TASK_UI_STAGE_META: Record<AgentTaskUiStage, AgentTaskUiStageMeta> = {
  incoming: {
    label: "Входящие",
    description: "Задача зафиксирована и ждет формализации.",
    analyst_action: "Фиксирует сигнал после сессии, прикладывает evidence, owner и цель.",
    why_it_exists: "Не потерять сигнал и отделить его от сырой идеи.",
    signal_actor_label: "Агент",
    next_actor_label: "Агент",
  },
  ready_to_work: {
    label: "Готово к работе",
    description: "Задача исполнима, контекст достаточен для старта.",
    analyst_action: "Дозаполняет task_brief, критерии приемки, артефакты и рабочую память.",
    why_it_exists: "Сделать задачу исполнимой без догадок.",
    signal_actor_label: "Агент",
    next_actor_label: "Агент-исполнитель",
  },
  in_work: {
    label: "В работе",
    description: "Идет основное выполнение задачи.",
    analyst_action: "Ведет выполнение, подключает других агентов, запускает A/B при необходимости.",
    why_it_exists: "Сконцентрировать производство результата в одном рабочем этапе.",
    signal_actor_label: "Агент или человек",
    next_actor_label: "Агент",
  },
  review: {
    label: "Проверка результата",
    description: "Результат собран и проходит проверку качества и эффекта.",
    analyst_action: "Проверяет критерии приемки, регрессии и effect-based результат.",
    why_it_exists: "Не закрывать задачу без подтверждения качества.",
    signal_actor_label: "Агент",
    next_actor_label: "Агент",
  },
  closed: {
    label: "Закрыто",
    description: "Задача завершена и получила итоговую резолюцию.",
    analyst_action: "Фиксирует итог и урок: внедрено, отменено, отклонено или неактуально.",
    why_it_exists: "Закрыть цикл прозрачно и без висящих задач.",
    signal_actor_label: "Агент",
    next_actor_label: "Никто",
  },
};

export const TASK_SERVICE_MODE_LABEL: Record<AgentTaskServiceMode, string> = {
  none: "Обычный режим",
  waiting_human: "Требуется решение человека",
  ab_test: "Идет A/B тест",
};

export const TASK_CLOSE_RESOLUTION_LABEL: Record<AgentTaskCloseResolution, string> = {
  implemented: "Внедрено",
  cancelled: "Отменено",
  ab_rejected: "Отклонено по A/B",
  duplicate: "Дубликат",
  not_actual: "Неактуально",
};

export const HUMAN_DECISION_LABEL: Record<AgentTaskHumanDecisionType, string> = {
  done: "Выполнено",
  cancel: "Неактуально, отменить",
  retry_ai: "Ошибка, действия человека не требуется",
};

const TASK_RUN_STEP_LABELS: Record<AgentTaskRunStepKey, string> = {
  step_0_intake: "0) task-intake/sync",
  step_1_start: "1) started",
  step_2_health_check: "2) preflight health-check",
  step_3_orchestration: "3) orchestration (reuse-first)",
  step_4_evidence_sync: "4) evidence retrieval",
  step_5_candidate_scoring: "5) candidate-list + scoring",
  step_6_priority_decision: "6) priority decision",
  step_7_apply: "7) execute",
  step_7_contract_gate: "7.1) contract gate",
  step_8_verify: "8) verify",
  step_8_error_channel: "8.1) error channel",
  step_9_finalize: "9) learn + finalize",
  step_9_publish_snapshots: "9.1) publish snapshots",
  cycle_repair: "cycle_repair",
};

const TASK_RUN_STEP_ALIASES: Record<string, AgentTaskRunStepKey> = {
  step_0_intake: "step_0_intake",
  task_intake: "step_0_intake",
  intake: "step_0_intake",
  sync: "step_0_intake",
  step_1_start: "step_1_start",
  started: "step_1_start",
  start: "step_1_start",
  step_2_health_check: "step_2_health_check",
  health_check: "step_2_health_check",
  healthcheck: "step_2_health_check",
  step_3_orchestration: "step_3_orchestration",
  orchestration: "step_3_orchestration",
  plan: "step_3_orchestration",
  step_4_evidence_sync: "step_4_evidence_sync",
  evidence: "step_4_evidence_sync",
  kb_sync: "step_4_evidence_sync",
  source_monitor: "step_4_evidence_sync",
  step_5_candidate_scoring: "step_5_candidate_scoring",
  candidate_scoring: "step_5_candidate_scoring",
  improvement_planning: "step_5_candidate_scoring",
  step_6_priority_decision: "step_6_priority_decision",
  priority_decision: "step_6_priority_decision",
  step_7_apply: "step_7_apply",
  apply: "step_7_apply",
  execute: "step_7_apply",
  step_7_contract_gate: "step_7_contract_gate",
  contract_gate: "step_7_contract_gate",
  step_8_verify: "step_8_verify",
  verify: "step_8_verify",
  step_8_error_channel: "step_8_error_channel",
  error_channel: "step_8_error_channel",
  step_9_finalize: "step_9_finalize",
  learn: "step_9_finalize",
  finalize: "step_9_finalize",
  step_9_publish_snapshots: "step_9_publish_snapshots",
  publish_snapshots: "step_9_publish_snapshots",
  cycle_repair: "cycle_repair",
};

export type AgentTaskBrief = Omit<BaseAgentTaskBrief, "context_package"> & {
  context_package: BaseAgentTaskBrief["context_package"] & {
    human_gate?: AgentTaskHumanGate;
  };
};

type AgentTaskWorkflowFields = {
  current_stage_ui: AgentTaskUiStage;
  stage_label: string;
  stage_description: string;
  stage_why: string;
  analyst_stage_action: string;
  service_mode: AgentTaskServiceMode;
  service_mode_label: string | null;
  close_resolution: AgentTaskCloseResolution | null;
  close_resolution_label: string | null;
  signal_actor_label: string;
  next_actor_label: string;
  next_step_label: string;
  is_analyst_path: boolean;
};

export type AgentTaskRow = Omit<BaseAgentTaskRow, "task_brief"> &
  AgentTaskWorkflowFields & {
    task_brief: AgentTaskBrief;
  };

export type AgentTaskDetails = Omit<BaseAgentTaskDetails, "context_and_evidence" | "timeline"> &
  AgentTaskWorkflowFields & {
    context_and_evidence: Omit<BaseAgentTaskDetails["context_and_evidence"], "context_package" | "related_logs"> & {
      context_package: AgentTaskBrief["context_package"];
      related_logs: AgentTaskTimelineEvent[];
    };
    timeline: AgentTaskTimelineEvent[];
  };

export type AgentTaskStatusCount = {
  status: AgentTaskStatus;
  total: number;
};

export type AgentTasksQuery = {
  status?: AgentTaskStatus | "all" | null;
  sourceAgentId?: string | null;
  executorAgentId?: string | null;
  query?: string | null;
  limit?: number;
  offset?: number;
};

type RpcErrorPayload = {
  message?: string;
  error?: string;
  hint?: string;
  details?: string;
};

type DemoHumanTaskSeed = {
  id: string;
  external_key: string;
  title: string;
  priority: AgentTaskPriority;
  updated_at: string;
  goal: string;
  expected_outcome: string;
  acceptance_criteria: string[];
  execution_summary: string;
  execution_notes: string[];
  instruction: string;
  completion_criteria: string;
  codex_prompt: string;
  evidence_refs: string[];
  target_artifacts: string[];
  rationale: string;
  suggested_agents: string[];
  selected_agents: string[];
  target_metric: string;
  expected_delta_pct: number | null;
  operational_memory_value: string;
};

const VALID_STATUSES = new Set<AgentTaskStatus>(["backlog", "ready", "in_progress", "ab_test", "waiting_human", "in_review", "done", "completed"]);
const VALID_PRIORITIES = new Set<AgentTaskPriority>(["low", "medium", "high"]);
const VALID_ORIGINS = new Set<AgentTaskOriginType>(["improvement", "recommendation", "telemetry"]);
const VALID_READINESS = new Set<AgentTaskReadinessState>(["ready", "needs_clarification"]);
const VALID_MANUAL_READINESS = new Set<AgentTaskReadinessManualState>(["approved", "needs_clarification", "not_set"]);

const DEMO_HUMAN_TASK_SEEDS: DemoHumanTaskSeed[] = [
  {
    id: "demo-human-approve",
    external_key: "DEMO-HUMAN-001",
    title: "[Тест UI] Подтвердить запуск A/B окна для analyst-agent",
    priority: "high",
    updated_at: "2026-03-06T10:12:00+02:00",
    goal: "Получить решение человека по запуску A/B окна на 5 сессий для новой практики analyst-agent.",
    expected_outcome: "Человек подтверждает запуск A/B окна и оставляет ограничения для guardrails.",
    acceptance_criteria: [
      "Есть комментарий человека с условиями запуска.",
      "Агент получает явный сигнал перехода в проверку результата.",
    ],
    execution_summary: "Аналитик нашел improvement-кандидат и подготовил A/B окно, но перед стартом нужен короткий human approval.",
    execution_notes: [
      "Проверить, что окно теста ограничено 5 сессиями.",
      "Если есть ограничения по рискам, явно написать их в комментарии.",
    ],
    instruction: "Подтвердите, что можно запускать A/B окно на 5 сессий, и оставьте комментарий с ограничениями или guardrails.",
    completion_criteria: "Есть комментарий человека со словами: можно запускать / какие guardrails обязательны.",
    codex_prompt: "Проверь задачу DEMO-HUMAN-001, подтверди запуск A/B окна на 5 сессий и перечисли обязательные guardrails в одном комментарии.",
    evidence_refs: [
      "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
      "artifacts/agent_benchmark_summary.json",
    ],
    target_artifacts: [
      "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
      "artifacts/agent_benchmark_summary.json",
    ],
    rationale: "Для analyst-agent правило запуска A/B окна должно быть явно согласовано человеком, иначе эксперимент стартует без явных ограничений.",
    suggested_agents: ["analyst-agent", "ops-agent"],
    selected_agents: ["analyst-agent"],
    target_metric: "pass_at_5",
    expected_delta_pct: 5,
    operational_memory_value: "База: pass_at_5=0.78. Тестируем 5 сессий. Guardrails: без падения trajectory_compliance_rate и judge_disagreement_rate.",
  },
  {
    id: "demo-human-cancel",
    external_key: "DEMO-HUMAN-002",
    title: "[Тест UI] Отменить неактуальную гипотезу analyst-agent",
    priority: "medium",
    updated_at: "2026-03-06T10:05:00+02:00",
    goal: "Получить решение человека, нужно ли отменять гипотезу self-improvement после смены приоритета.",
    expected_outcome: "Человек отменяет задачу и фиксирует короткую причину отмены.",
    acceptance_criteria: [
      "Человек выбрал отмену и оставил комментарий.",
      "Агент может закрыть задачу с резолюцией «Отменено».",
    ],
    execution_summary: "Аналитик подготовил гипотезу про расширение benchmark-набора, но приоритет мог сместиться после новых данных.",
    execution_notes: [
      "Если задача потеряла приоритет, выбрать отмену.",
      "В комментарии указать, почему запуск больше не нужен.",
    ],
    instruction: "Если гипотеза больше не нужна, отмените задачу и коротко напишите причину, чтобы агент закрыл ее без повторного цикла.",
    completion_criteria: "Есть решение на отмену с комментарием, почему задача потеряла актуальность.",
    codex_prompt: "Открой задачу DEMO-HUMAN-002, оцени актуальность гипотезы и, если она больше не нужна, оставь комментарий на отмену в одну-две строки.",
    evidence_refs: [
      "docs/subservices/oap/DESIGN_RULES.md",
      "artifacts/agent_telemetry_summary.json",
    ],
    target_artifacts: [
      "docs/subservices/oap/DESIGN_RULES.md",
      "artifacts/agent_telemetry_summary.json",
    ],
    rationale: "У analyst-agent не должно оставаться висящих гипотез без решения человека, если приоритет уже сместился.",
    suggested_agents: ["analyst-agent"],
    selected_agents: ["analyst-agent"],
    target_metric: "recommendation_action_rate",
    expected_delta_pct: null,
    operational_memory_value: "Гипотеза зависла без человека 2 цикла подряд. Нужен явный cancel или подтверждение продолжения.",
  },
  {
    id: "demo-human-retry",
    external_key: "DEMO-HUMAN-003",
    title: "[Тест UI] Вернуть analyst-agent на перепроверку без действий человека",
    priority: "medium",
    updated_at: "2026-03-06T09:58:00+02:00",
    goal: "Проверить сценарий, когда человек видит ошибочную предпосылку и возвращает агента на самопроверку.",
    expected_outcome: "Человек выбирает retry_ai и оставляет комментарий, какую предпосылку агент должен перепроверить.",
    acceptance_criteria: [
      "Есть комментарий человека о некорректной предпосылке.",
      "Агент понимает, что задача остается в «В работе» и требует перепроверки.",
    ],
    execution_summary: "Аналитик запросил ручной ввод, но человек считает, что агент должен сам перепроверить связь между метрикой и риском.",
    execution_notes: [
      "Если человек не должен ничего делать вручную, выбрать возврат агенту.",
      "В комментарии описать, что именно надо перепроверить.",
    ],
    instruction: "Если проблема в предпосылке агента, а не в данных человека, выберите возврат агенту и напишите, что надо перепроверить.",
    completion_criteria: "Есть комментарий, какая предпосылка ошибочна и почему агент должен сам пересобрать контекст.",
    codex_prompt: "Открой задачу DEMO-HUMAN-003 и, если ручное действие не нужно, верни ее агенту с коротким комментарием о неверной предпосылке.",
    evidence_refs: [
      "docs/tasks/task_rules.md",
      "docs/subservices/oap/AGENT_TELEMETRY.md",
    ],
    target_artifacts: [
      "docs/tasks/task_rules.md",
      "docs/subservices/oap/AGENT_TELEMETRY.md",
    ],
    rationale: "Человек не должен делать лишнюю ручную работу, если аналитик может сам перепроверить предпосылку и продолжить цикл.",
    suggested_agents: ["analyst-agent", "reader-agent"],
    selected_agents: ["analyst-agent"],
    target_metric: "trajectory_compliance_rate",
    expected_delta_pct: null,
    operational_memory_value: "Нужно перепроверить источник telemetry rule и связь между waiting_human и human_decision в lifecycle.",
  },
];

function getSupabaseConfig(): { url: string; apiKey: string } {
  const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey =
    String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim() ||
    String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

  if (!url || !apiKey) {
    throw new Error("Supabase config is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY).");
  }
  return { url, apiKey };
}

async function rpcCall<T>(fn: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const { url, apiKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(params),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    let payload: RpcErrorPayload | null = null;
    try {
      payload = JSON.parse(text) as RpcErrorPayload;
    } catch {
      payload = null;
    }
    const message =
      payload?.message ||
      payload?.error ||
      payload?.hint ||
      payload?.details ||
      text ||
      `Supabase RPC ${fn} failed (${response.status}).`;
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toNullableText(value: unknown): string | null {
  const text = toText(value).trim();
  return text || null;
}

function toNumeric(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function toUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeTaskStepKey(value: unknown): AgentTaskRunStepKey | null {
  const raw = toText(value).trim().toLowerCase();
  if (!raw) return null;
  const normalized = raw
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return null;
  if (normalized in TASK_RUN_STEP_LABELS) {
    return normalized as AgentTaskRunStepKey;
  }
  return TASK_RUN_STEP_ALIASES[normalized] || null;
}

function resolveTaskStepLabel(stepKey: AgentTaskRunStepKey | null, rawFallback: string | null): string | null {
  if (stepKey) return TASK_RUN_STEP_LABELS[stepKey];
  const raw = (rawFallback || "").trim();
  return raw || null;
}

function clampAbSessions(value: unknown): number {
  const numeric = Math.round(toNumeric(value, 3));
  if (numeric < 3) return 3;
  if (numeric > 8) return 8;
  return numeric;
}

function normalizeOperationalMemoryItem(value: unknown): AgentTaskOperationalMemoryItem | null {
  const payload = toRecord(value);
  const key = toText(payload.key).trim();
  const title = toText(payload.title).trim();
  if (!key || !title) return null;
  return {
    key,
    title,
    value: toText(payload.value),
    source_ref: toNullableText(payload.source_ref),
    updated_at: toNullableText(payload.updated_at),
  };
}

function normalizeOperationalMemory(value: unknown): AgentTaskOperationalMemoryItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map(normalizeOperationalMemoryItem)
    .filter((item): item is AgentTaskOperationalMemoryItem => Boolean(item));
}

function normalizeCollaborationReuseCandidate(value: unknown) {
  const payload = toRecord(value);
  const profileId = toText(payload.profile_id).trim();
  const name = toText(payload.name).trim();
  if (!profileId || !name) return null;
  const scoreRaw = Number(payload.score);
  const score = Number.isFinite(scoreRaw) ? scoreRaw : 0;
  return {
    profile_id: profileId,
    name,
    score,
    decision: toText(payload.decision).trim() || "considered",
    rationale: toText(payload.rationale).trim(),
  };
}

function normalizeCollaborationCreatedProfile(value: unknown) {
  const payload = toRecord(value);
  const id = toText(payload.id).trim();
  const name = toText(payload.name).trim();
  if (!id || !name) return null;
  const capabilityContract = payload.capability_contract && typeof payload.capability_contract === "object" && !Array.isArray(payload.capability_contract)
    ? (payload.capability_contract as Record<string, unknown>)
    : null;
  return {
    id,
    name,
    created_by_agent_id: toNullableText(payload.created_by_agent_id),
    parent_template_id: toNullableText(payload.parent_template_id),
    derived_from_agent_id: toNullableText(payload.derived_from_agent_id),
    specialization_scope: toText(payload.specialization_scope).trim() || "general",
    lifecycle: toText(payload.lifecycle).trim() || "active",
    creation_reason: toNullableText(payload.creation_reason),
    capability_contract: capabilityContract,
  };
}

function normalizeCollaborationSpawnedInstance(value: unknown) {
  const payload = toRecord(value);
  const instanceId = toText(payload.instance_id).trim();
  const profileId = toText(payload.profile_id).trim();
  const rootAgentId = toText(payload.root_agent_id).trim();
  const taskId = toText(payload.task_id).trim();
  if (!instanceId || !profileId || !rootAgentId || !taskId) return null;
  const depthRaw = Number(payload.depth);
  const depth = Number.isFinite(depthRaw) ? Math.max(0, Math.round(depthRaw)) : 0;
  return {
    instance_id: instanceId,
    profile_id: profileId,
    parent_instance_id: toNullableText(payload.parent_instance_id),
    root_agent_id: rootAgentId,
    task_id: taskId,
    purpose: toText(payload.purpose).trim() || "Task-local specialist execution",
    depth,
    allowed_skills: toStringArray(payload.allowed_skills),
    allowed_tools: toStringArray(payload.allowed_tools),
    allowed_mcp: toStringArray(payload.allowed_mcp),
    applied_rules: toStringArray(payload.applied_rules),
    input_refs: toStringArray(payload.input_refs),
    output_refs: toStringArray(payload.output_refs),
    status: toText(payload.status).trim() || "planned",
    verify_status: toText(payload.verify_status).trim() || "pending",
  };
}

function normalizeCollaborationBudget(value: unknown) {
  const payload = toRecord(value);
  const maxInstances = Math.max(1, Math.round(toNumeric(payload.max_instances, 7)));
  const maxTokens = Math.max(1, Math.round(toNumeric(payload.max_tokens, 120000)));
  const maxWallClock = Math.max(1, Math.round(toNumeric(payload.max_wall_clock_minutes, 45)));
  const maxNoProgress = Math.max(1, Math.round(toNumeric(payload.max_no_progress_hops, 2)));
  return {
    max_instances: maxInstances,
    max_tokens: maxTokens,
    max_wall_clock_minutes: maxWallClock,
    max_no_progress_hops: maxNoProgress,
  };
}

function normalizeCollaborationPlan(value: unknown): AgentTaskCollaborationPlan | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const payload = toRecord(value);
  const strategyRaw = toText(payload.strategy).trim().toLowerCase();
  const strategy = strategyRaw === "reuse_existing" || strategyRaw === "create_new" || strategyRaw === "mixed"
    ? strategyRaw
    : undefined;
  const reuseCandidates = toUnknownArray(payload.reuse_candidates)
    .map(normalizeCollaborationReuseCandidate)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeCollaborationReuseCandidate>> => Boolean(item));
  const createdProfiles = toUnknownArray(payload.created_profiles)
    .map(normalizeCollaborationCreatedProfile)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeCollaborationCreatedProfile>> => Boolean(item));
  const spawnedInstances = toUnknownArray(payload.spawned_instances)
    .map(normalizeCollaborationSpawnedInstance)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeCollaborationSpawnedInstance>> => Boolean(item));
  const delegationDepthRaw = Number(payload.delegation_depth);
  const delegationDepth = Number.isFinite(delegationDepthRaw) ? Math.max(0, Math.round(delegationDepthRaw)) : undefined;
  return {
    analysis_required: toBoolean(payload.analysis_required, false),
    suggested_agents: toStringArray(payload.suggested_agents),
    selected_agents: toStringArray(payload.selected_agents),
    rationale: toText(payload.rationale),
    reviewed_at: toNullableText(payload.reviewed_at),
    strategy,
    reuse_candidates: reuseCandidates,
    created_profiles: createdProfiles,
    spawned_instances: spawnedInstances,
    orchestration_budget: normalizeCollaborationBudget(payload.orchestration_budget),
    delegation_depth: delegationDepth,
  };
}

function normalizeAbTestPlan(value: unknown): AgentTaskAbTestPlan | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const payload = toRecord(value);
  return {
    enabled: toBoolean(payload.enabled, false),
    sessions_required: clampAbSessions(payload.sessions_required),
    pass_rule: toText(payload.pass_rule) || "target_plus_guardrails",
    target_metric: toText(payload.target_metric),
    expected_delta_pct: Number.isFinite(Number(payload.expected_delta_pct)) ? Number(payload.expected_delta_pct) : null,
    guardrails: toStringArray(payload.guardrails),
    rollback_on_fail: toBoolean(payload.rollback_on_fail, true),
  };
}

function normalizeHumanGate(value: unknown): AgentTaskHumanGate | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const payload = toRecord(value);
  const instruction = toText(payload.instruction).trim();
  const codexPrompt = toText(payload.codex_prompt).trim();
  const completionCriteria = toText(payload.completion_criteria).trim();
  const commentRequired = toBoolean(payload.comment_required, true);
  if (!instruction && !codexPrompt && !completionCriteria) return undefined;
  return {
    instruction,
    codex_prompt: codexPrompt,
    completion_criteria: completionCriteria,
    comment_required: commentRequired,
  };
}

function normalizeUsageItem(value: unknown): { name: string; events: number; tasks: number } | null {
  const payload = toRecord(value);
  const name = toText(payload.name).trim();
  if (!name) return null;
  return {
    name,
    events: Math.max(0, toNumeric(payload.events, 0)),
    tasks: Math.max(0, toNumeric(payload.tasks, 0)),
  };
}

function buildDemoTaskBrief(seed: DemoHumanTaskSeed): Record<string, unknown> {
  return {
    goal: seed.goal,
    expected_outcome: seed.expected_outcome,
    acceptance_criteria: seed.acceptance_criteria,
    constraints: ["Решение человека должно сопровождаться комментарием."],
    dependencies: ["Комментарий человека", "Переход фиксирует агент"],
    target_artifacts: seed.target_artifacts,
    priority_reason: "Тестовый human-gate нужен для проверки интерфейса ручного ввода.",
    context_package: {
      relevant_anchors: seed.target_artifacts.map((path) => ({ path })),
      mandatory_rules: [
        { path: "docs/tasks/task_rules.md" },
        { path: "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md" },
      ],
      operational_memory: [
        {
          key: "human-gate-state",
          title: "Что нужно помнить перед решением человека",
          value: seed.operational_memory_value,
          source_ref: seed.evidence_refs[0] || null,
          updated_at: seed.updated_at,
        },
      ],
      collaboration_plan: {
        analysis_required: true,
        suggested_agents: seed.suggested_agents,
        selected_agents: seed.selected_agents,
        rationale: seed.rationale,
        reviewed_at: seed.updated_at,
      },
      ab_test_plan: {
        enabled: true,
        sessions_required: 5,
        pass_rule: "target_plus_guardrails",
        target_metric: seed.target_metric,
        expected_delta_pct: seed.expected_delta_pct,
        guardrails: [
          "Не допускать деградации trajectory_compliance_rate.",
          "Не допускать роста judge_disagreement_rate.",
        ],
        rollback_on_fail: true,
      },
      human_gate: {
        instruction: seed.instruction,
        codex_prompt: seed.codex_prompt,
        completion_criteria: seed.completion_criteria,
        comment_required: true,
      },
    },
    context_to_task: {
      summary: seed.execution_summary,
      why_now: "Нужно протестировать UI задач для ручного решения до следующего цикла analyst-agent.",
      execution_notes: seed.execution_notes,
      source_snapshot: {
        scope: "demo-human-gate",
        created_by: "codex",
      },
    },
    linked_elements: [
      {
        type: "rule",
        id: null,
        title: "Правила задач OAP",
        ref: "docs/tasks/task_rules.md",
        source_agent_id: "analyst-agent",
        source_url: null,
        open_mode: "drawer",
        importance: "high",
      },
    ],
  };
}

function buildDemoTaskRowRaw(seed: DemoHumanTaskSeed): Record<string, unknown> {
  return {
    id: seed.id,
    external_key: seed.external_key,
    title: seed.title,
    source_agent_id: "analyst-agent",
    executor_agent_id: "analyst-agent",
    status: "waiting_human",
    priority: seed.priority,
    origin_type: "recommendation",
    origin_type_label_ru: "Рекомендация",
    origin_ref: "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
    evidence_refs: seed.evidence_refs,
    task_brief: buildDemoTaskBrief(seed),
    readiness_auto_score: 4,
    readiness_auto_state: "ready",
    readiness_manual_state: "approved",
    readiness_final_state: "ready",
    created_at: "2026-03-06T09:30:00+02:00",
    updated_at: seed.updated_at,
    last_event_at: seed.updated_at,
    last_event_type: "waiting_human",
    last_event_actor: "analyst-agent",
    last_event_time: seed.updated_at,
  };
}

function buildDemoTaskDetailsRaw(seed: DemoHumanTaskSeed): Record<string, unknown> {
  const taskBrief = buildDemoTaskBrief(seed);
  return {
    task: {
      id: seed.id,
      external_key: seed.external_key,
      title: seed.title,
      status: "waiting_human",
      priority: seed.priority,
      source_agent_id: "analyst-agent",
      executor_agent_id: "analyst-agent",
      created_at: "2026-03-06T09:30:00+02:00",
      updated_at: seed.updated_at,
      last_event_at: seed.updated_at,
    },
    what_to_do: {
      goal: seed.goal,
      expected_outcome: seed.expected_outcome,
      acceptance_criteria: seed.acceptance_criteria,
      constraints: ["Комментарий человека обязателен."],
      dependencies: ["human_decision", "agent follow-up"],
      target_artifacts: seed.target_artifacts,
      priority_reason: "Тестовая задача нужна для проверки UX ручного взаимодействия на странице задач.",
      context_to_task: {
        summary: seed.execution_summary,
        why_now: "Нужно проверить, что человек сразу видит свои задачи и может протестировать сценарий выбора решения.",
        execution_notes: seed.execution_notes,
        source_snapshot: {
          mode: "demo",
        },
      },
    },
    origin: {
      origin_type: "recommendation",
      origin_type_label_ru: "Рекомендация",
      origin_ref: "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
      source_agent_id: "analyst-agent",
      linked_improvement: null,
    },
    context_and_evidence: {
      evidence_refs: seed.evidence_refs,
      context_package: (taskBrief as Record<string, unknown>).context_package,
      linked_elements: (taskBrief as Record<string, unknown>).linked_elements,
      related_logs: [
        {
          id: `${seed.id}-log-1`,
          actor_agent_id: "analyst-agent",
          event_time: "2026-03-06T09:31:00+02:00",
          event_type: "started",
          status_from: "ready",
          status_to: "in_progress",
          payload: {
            reason: "analyst cycle started",
          },
        },
      ],
    },
    implementation_usage: {
      source: "demo",
      mcp_in_task: [
        { name: "qmd", events: 1, tasks: 1 },
      ],
      skills_in_task: [
        { name: "playwright", events: 1, tasks: 1 },
      ],
      mcp_frequency_across_tasks: [
        { name: "qmd", events: 6, tasks: 4 },
      ],
      skills_frequency_across_tasks: [
        { name: "playwright", events: 3, tasks: 2 },
      ],
    },
    readiness: {
      readiness_auto_score: 4,
      readiness_auto_state: "ready",
      readiness_manual_state: "approved",
      readiness_final_state: "ready",
      checks: {
        goal_present: true,
        outcome_present: true,
        acceptance_present: true,
        evidence_present: true,
      },
      manual_actor: "analyst-agent",
      manual_event_time: seed.updated_at,
    },
    timeline: [
      {
        id: `${seed.id}-timeline-1`,
        actor_agent_id: "analyst-agent",
        event_time: "2026-03-06T09:30:00+02:00",
        event_type: "candidate_assessed",
        status_from: "backlog",
        status_to: "ready",
        payload: {
          reason: "candidate converted into task",
        },
      },
      {
        id: `${seed.id}-timeline-2`,
        actor_agent_id: "analyst-agent",
        event_time: "2026-03-06T09:45:00+02:00",
        event_type: "started",
        status_from: "ready",
        status_to: "in_progress",
        payload: {
          reason: "agent started execution",
        },
      },
      {
        id: `${seed.id}-timeline-3`,
        actor_agent_id: "analyst-agent",
        event_time: seed.updated_at,
        event_type: "waiting_human",
        status_from: "in_progress",
        status_to: "waiting_human",
        payload: {
          reason: "manual decision required",
          comment: seed.instruction,
        },
      },
    ],
  };
}

const DEMO_HUMAN_TASK_ROWS: AgentTaskRow[] = DEMO_HUMAN_TASK_SEEDS.map((seed) => normalizeTaskRow(buildDemoTaskRowRaw(seed)))
  .filter((row): row is AgentTaskRow => Boolean(row));

const DEMO_HUMAN_TASK_DETAILS = new Map<string, AgentTaskDetails>(
  DEMO_HUMAN_TASK_SEEDS.map((seed) => {
    const details = normalizeTaskDetails(buildDemoTaskDetailsRaw(seed));
    return [seed.id, details];
  }).filter((entry): entry is [string, AgentTaskDetails] => Boolean(entry[1])),
);

function normalizeTaskContextToTask(value: unknown) {
  const payload = toRecord(value);
  return {
    summary: toText(payload.summary),
    why_now: toNullableText(payload.why_now),
    execution_notes: toStringArray(payload.execution_notes),
    source_snapshot:
      payload.source_snapshot && typeof payload.source_snapshot === "object" && !Array.isArray(payload.source_snapshot)
        ? (payload.source_snapshot as Record<string, unknown>)
        : null,
  };
}

function normalizeOriginContext(value: unknown): AgentTaskOriginContext | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const payload = toRecord(value);
  const normalized = { ...payload } as AgentTaskOriginContext;
  normalized.source = toNullableText(payload.source);
  normalized.recommendation_id = toNullableText(payload.recommendation_id);
  normalized.recommendation_text = toNullableText(payload.recommendation_text);
  normalized.link_mode = toNullableText(payload.link_mode);
  normalized.linked_improvement_id = toNullableText(payload.linked_improvement_id);
  normalized.similarity_score = Number.isFinite(Number(payload.similarity_score)) ? Number(payload.similarity_score) : null;
  normalized.origin_cycle_id = toNullableText(payload.origin_cycle_id);
  normalized.linked_improvement_snapshot =
    payload.linked_improvement_snapshot && typeof payload.linked_improvement_snapshot === "object" && !Array.isArray(payload.linked_improvement_snapshot)
      ? (payload.linked_improvement_snapshot as Record<string, unknown>)
      : null;
  return normalized;
}

function normalizeLinkedElement(value: unknown) {
  const payload = toRecord(value);
  const title = toText(payload.title).trim();
  if (!title) return null;
  return {
    type: toText(payload.type) || "other",
    id: toNullableText(payload.id),
    title,
    ref: toNullableText(payload.ref),
    source_agent_id: toNullableText(payload.source_agent_id),
    source_url: toNullableText(payload.source_url),
    open_mode: toNullableText(payload.open_mode),
    importance: toNullableText(payload.importance),
  };
}

function normalizeLinkedImprovement(value: unknown) {
  const payload = toRecord(value);
  const id = toText(payload.id).trim();
  const title = toText(payload.title).trim();
  if (!id || !title) return null;
  const icePayload = toRecord(payload.ice);
  return {
    id,
    source_agent_id: toNullableText(payload.source_agent_id),
    title,
    problem: toText(payload.problem),
    solution: toText(payload.solution),
    effect: toText(payload.effect),
    ownerSection: toNullableText(payload.ownerSection),
    targetMetric: toNullableText(payload.targetMetric),
    baselineWindow: toNullableText(payload.baselineWindow),
    expectedDelta: toNullableText(payload.expectedDelta),
    validationDate: toNullableText(payload.validationDate),
    detectionBasis: toNullableText(payload.detectionBasis),
    promptPath: toNullableText(payload.promptPath),
    promptTitle: toNullableText(payload.promptTitle),
    promptMarkdown: toNullableText(payload.promptMarkdown),
    promptSourceUrl: toNullableText(payload.promptSourceUrl),
    link_mode: toNullableText(payload.link_mode),
    similarity_score: Number.isFinite(Number(payload.similarity_score)) ? Number(payload.similarity_score) : null,
    ice: {
      impact: Number.isFinite(Number(icePayload.impact)) ? Number(icePayload.impact) : null,
      confidence: Number.isFinite(Number(icePayload.confidence)) ? Number(icePayload.confidence) : null,
      ease: Number.isFinite(Number(icePayload.ease)) ? Number(icePayload.ease) : null,
      score: Number.isFinite(Number(icePayload.score ?? payload.iceScore)) ? Number(icePayload.score ?? payload.iceScore) : null,
    },
  };
}

function normalizeTaskBrief(value: unknown): AgentTaskBrief {
  const payload = toRecord(value);
  const contextPackage = toRecord(payload.context_package);
  const operationalMemory = normalizeOperationalMemory(contextPackage.operational_memory);
  const collaborationPlan = normalizeCollaborationPlan(contextPackage.collaboration_plan);
  const abTestPlan = normalizeAbTestPlan(contextPackage.ab_test_plan);
  const humanGate = normalizeHumanGate(contextPackage.human_gate);
  const linkedElements = toUnknownArray(payload.linked_elements)
    .map(normalizeLinkedElement)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeLinkedElement>> => Boolean(item));
  const normalizedContextPackage: AgentTaskBrief["context_package"] = {
    relevant_anchors: toUnknownArray(contextPackage.relevant_anchors),
    mandatory_rules: toUnknownArray(contextPackage.mandatory_rules),
  };
  if (operationalMemory) {
    normalizedContextPackage.operational_memory = operationalMemory;
  }
  if (collaborationPlan) {
    normalizedContextPackage.collaboration_plan = collaborationPlan;
  }
  if (abTestPlan) {
    normalizedContextPackage.ab_test_plan = abTestPlan;
  }
  if (humanGate) {
    normalizedContextPackage.human_gate = humanGate;
  }
  const originContext = normalizeOriginContext(payload.origin_context);
  return {
    goal: toText(payload.goal),
    expected_outcome: toText(payload.expected_outcome),
    acceptance_criteria: toStringArray(payload.acceptance_criteria),
    constraints: toStringArray(payload.constraints),
    dependencies: toStringArray(payload.dependencies),
    target_artifacts: toStringArray(payload.target_artifacts),
    priority_reason: toText(payload.priority_reason),
    context_package: normalizedContextPackage,
    context_to_task: normalizeTaskContextToTask(payload.context_to_task),
    linked_elements: linkedElements,
    origin_context: originContext,
  };
}

function taskEventBlob(event: AgentTaskTimelineEvent): string {
  const payload = toRecord(event.payload);
  return [
    event.event_type,
    event.step_key,
    event.step_raw,
    event.step_label,
    event.status_from,
    event.status_to,
    toText(payload.outcome),
    toText(payload.decision_type),
    toText(payload.reason),
    toText(payload.comment),
  ]
    .join(" ")
    .toLowerCase();
}

function getLastMatchingEvent(events: AgentTaskTimelineEvent[], predicate: (event: AgentTaskTimelineEvent) => boolean): AgentTaskTimelineEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (predicate(events[index])) return events[index];
  }
  return null;
}

function normalizeUiStage(status: AgentTaskStatus): AgentTaskUiStage {
  if (status === "backlog") return "incoming";
  if (status === "ready") return "ready_to_work";
  if (status === "in_progress" || status === "waiting_human" || status === "ab_test") return "in_work";
  if (status === "in_review") return "review";
  return "closed";
}

function normalizeServiceMode(status: AgentTaskStatus): AgentTaskServiceMode {
  if (status === "waiting_human") return "waiting_human";
  if (status === "ab_test") return "ab_test";
  return "none";
}

function inferCloseResolution(status: AgentTaskStatus, timeline: AgentTaskTimelineEvent[]): AgentTaskCloseResolution | null {
  if (status !== "done" && status !== "completed") return null;

  const cancelled = getLastMatchingEvent(timeline, (event) => {
    const blob = taskEventBlob(event);
    return blob.includes("human_decision") && blob.includes("cancel")
      || blob.includes("cancelled_by_human")
      || blob.includes("cancel")
      || blob.includes("отмен");
  });
  if (cancelled) return "cancelled";

  const duplicate = getLastMatchingEvent(timeline, (event) => {
    const blob = taskEventBlob(event);
    return blob.includes("duplicate") || blob.includes("дублик");
  });
  if (duplicate) return "duplicate";

  const stale = getLastMatchingEvent(timeline, (event) => {
    const blob = taskEventBlob(event);
    return blob.includes("not_actual")
      || blob.includes("no_longer_relevant")
      || blob.includes("stale")
      || blob.includes("неакту");
  });
  if (stale) return "not_actual";

  const abRejected = getLastMatchingEvent(timeline, (event) => {
    const blob = taskEventBlob(event);
    return blob.includes("ab_test_failed") || blob.includes("rollback_applied");
  });
  if (abRejected) return "ab_rejected";

  return "implemented";
}

function buildTaskWorkflowFields(
  status: AgentTaskStatus,
  timeline: AgentTaskTimelineEvent[],
  sourceAgentId: string,
  executorAgentId: string,
): AgentTaskWorkflowFields {
  const currentStage = normalizeUiStage(status);
  const serviceMode = normalizeServiceMode(status);
  const closeResolution = inferCloseResolution(status, timeline);
  const stageMeta = TASK_UI_STAGE_META[currentStage];
  const isAnalystPath = sourceAgentId === "analyst-agent" || executorAgentId === "analyst-agent";

  let signalActorLabel = stageMeta.signal_actor_label;
  let nextActorLabel = stageMeta.next_actor_label;
  let nextStepLabel = "";

  if (currentStage === "incoming") {
    nextStepLabel = "Собрать контекст и перевести задачу в «Готово к работе».";
  } else if (currentStage === "ready_to_work") {
    nextStepLabel = "Взять задачу в работу и зафиксировать старт telemetry-событием.";
  } else if (currentStage === "in_work" && serviceMode === "waiting_human") {
    signalActorLabel = "Человек";
    nextActorLabel = "Агент";
    nextStepLabel = "Получить решение человека с комментарием, затем агент фиксирует следующий переход.";
  } else if (currentStage === "in_work" && serviceMode === "ab_test") {
    nextStepLabel = "Довести A/B до решения pass/fail и перевести задачу на проверку или в закрытие.";
  } else if (currentStage === "in_work") {
    nextStepLabel = "Продолжить выполнение и собрать результат для проверки.";
  } else if (currentStage === "review") {
    nextStepLabel = "Проверить критерии приемки и закрыть задачу либо вернуть на доработку.";
  } else {
    nextActorLabel = "Никто";
    nextStepLabel = closeResolution === "implemented"
      ? "Задача закрыта как внедренная."
      : closeResolution === "cancelled"
        ? "Задача закрыта по решению человека."
        : closeResolution === "ab_rejected"
          ? "Гипотеза отклонена, для новой попытки нужна отдельная задача."
          : closeResolution === "duplicate"
            ? "Задача закрыта как дубликат."
            : closeResolution === "not_actual"
              ? "Задача потеряла актуальность и закрыта."
              : "Задача завершена.";
  }

  return {
    current_stage_ui: currentStage,
    stage_label: stageMeta.label,
    stage_description: stageMeta.description,
    stage_why: stageMeta.why_it_exists,
    analyst_stage_action: stageMeta.analyst_action,
    service_mode: serviceMode,
    service_mode_label: serviceMode === "none" ? null : TASK_SERVICE_MODE_LABEL[serviceMode],
    close_resolution: closeResolution,
    close_resolution_label: closeResolution ? TASK_CLOSE_RESOLUTION_LABEL[closeResolution] : null,
    signal_actor_label: signalActorLabel,
    next_actor_label: nextActorLabel,
    next_step_label: nextStepLabel,
    is_analyst_path: isAnalystPath,
  };
}

function normalizeTaskTimelineEvent(value: unknown): AgentTaskTimelineEvent | null {
  const root = toRecord(value);
  const id = toText(root.id);
  if (!id) return null;
  const payload = toRecord(root.payload);
  const stepRawCandidate =
    toText(payload.step_raw).trim()
    || toText(payload.step).trim()
    || toText(root.event_type).trim();
  const stepKey = normalizeTaskStepKey(stepRawCandidate);
  const stepLabel = resolveTaskStepLabel(stepKey, stepRawCandidate || null);
  const normalizedPayload: Record<string, unknown> = { ...payload };
  if (stepRawCandidate) normalizedPayload.step_raw = stepRawCandidate;
  if (stepKey) normalizedPayload.step = stepKey;
  if (stepLabel) normalizedPayload.step_label = stepLabel;
  return {
    id,
    actor_agent_id: toText(root.actor_agent_id),
    event_time: toNullableText(root.event_time),
    event_type: toText(root.event_type) || stepLabel || "не зафиксировано",
    status_from: toNullableText(root.status_from),
    status_to: toNullableText(root.status_to),
    payload: normalizedPayload,
    step_key: stepKey,
    step_label: stepLabel,
    step_raw: stepRawCandidate || null,
  };
}

function normalizeTaskRow(row: unknown): AgentTaskRow | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const statusValue = toText(value.status).toLowerCase() as AgentTaskStatus;
  const priorityValue = toText(value.priority).toLowerCase() as AgentTaskPriority;
  const originValue = toText(value.origin_type).toLowerCase() as AgentTaskOriginType;
  const readinessAutoState = toText(value.readiness_auto_state).toLowerCase() as AgentTaskReadinessState;
  const readinessManualState = toText(value.readiness_manual_state).toLowerCase() as AgentTaskReadinessManualState;
  const readinessFinalState = toText(value.readiness_final_state).toLowerCase() as AgentTaskReadinessState;

  if (!VALID_STATUSES.has(statusValue)) return null;
  if (!VALID_PRIORITIES.has(priorityValue)) return null;
  if (!VALID_ORIGINS.has(originValue)) return null;

  const workflow = buildTaskWorkflowFields(statusValue, [], toText(value.source_agent_id), toText(value.executor_agent_id));
  return {
    id: toText(value.id),
    external_key: toText(value.external_key),
    title: toText(value.title),
    source_agent_id: toText(value.source_agent_id),
    executor_agent_id: toText(value.executor_agent_id),
    status: statusValue,
    priority: priorityValue,
    origin_type: originValue,
    origin_type_label_ru: toText(value.origin_type_label_ru) || "",
    origin_ref: toNullableText(value.origin_ref),
    evidence_refs: toUnknownArray(value.evidence_refs),
    task_brief: normalizeTaskBrief(value.task_brief),
    readiness_auto_score: Math.max(0, toNumeric(value.readiness_auto_score, 0)),
    readiness_auto_state: VALID_READINESS.has(readinessAutoState) ? readinessAutoState : "needs_clarification",
    readiness_manual_state: VALID_MANUAL_READINESS.has(readinessManualState) ? readinessManualState : "not_set",
    readiness_final_state: VALID_READINESS.has(readinessFinalState) ? readinessFinalState : "needs_clarification",
    created_at: toText(value.created_at),
    updated_at: toText(value.updated_at),
    last_event_at: toNullableText(value.last_event_at),
    last_event_type: toNullableText(value.last_event_type),
    last_event_actor: toNullableText(value.last_event_actor),
    last_event_time: toNullableText(value.last_event_time),
    ...workflow,
  };
}

function normalizeStatusCount(row: unknown): AgentTaskStatusCount | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Record<string, unknown>;
  const status = toText(value.status).toLowerCase() as AgentTaskStatus;
  if (!VALID_STATUSES.has(status)) return null;
  const numeric = Number(value.total);
  return {
    status,
    total: Number.isFinite(numeric) && numeric >= 0 ? numeric : 0,
  };
}

function normalizeTaskDetails(payload: unknown): AgentTaskDetails | null {
  const root = toRecord(payload);
  if (toText(root.error) === "task_not_found") return null;

  const task = toRecord(root.task);
  const whatToDo = toRecord(root.what_to_do);
  const origin = toRecord(root.origin);
  const context = toRecord(root.context_and_evidence);
  const implementationUsage = toRecord(root.implementation_usage);
  const readiness = toRecord(root.readiness);
  const contextPackage = toRecord(context.context_package);
  const operationalMemory = normalizeOperationalMemory(contextPackage.operational_memory);
  const collaborationPlan = normalizeCollaborationPlan(contextPackage.collaboration_plan);
  const abTestPlan = normalizeAbTestPlan(contextPackage.ab_test_plan);
  const humanGate = normalizeHumanGate(contextPackage.human_gate);
  const linkedImprovement = normalizeLinkedImprovement(origin.linked_improvement);
  const linkedElements = toUnknownArray(context.linked_elements)
    .map(normalizeLinkedElement)
    .filter((item): item is NonNullable<ReturnType<typeof normalizeLinkedElement>> => Boolean(item));

  const status = toText(task.status).toLowerCase() as AgentTaskStatus;
  const priority = toText(task.priority).toLowerCase() as AgentTaskPriority;
  const originType = toText(origin.origin_type).toLowerCase() as AgentTaskOriginType;
  const readinessAutoState = toText(readiness.readiness_auto_state).toLowerCase() as AgentTaskReadinessState;
  const readinessManualState = toText(readiness.readiness_manual_state).toLowerCase() as AgentTaskReadinessManualState;
  const readinessFinalState = toText(readiness.readiness_final_state).toLowerCase() as AgentTaskReadinessState;

  if (!VALID_STATUSES.has(status) || !VALID_PRIORITIES.has(priority) || !VALID_ORIGINS.has(originType)) return null;

  const timeline = toUnknownArray(root.timeline)
    .map(normalizeTaskTimelineEvent)
    .filter((item): item is AgentTaskTimelineEvent => Boolean(item));

  const relatedLogs = toUnknownArray(context.related_logs)
    .map(normalizeTaskTimelineEvent)
    .filter((item): item is AgentTaskTimelineEvent => Boolean(item));

  const checksRecord = toRecord(readiness.checks);
  const checks = Object.entries(checksRecord).reduce<Record<string, boolean>>((acc, [key, value]) => {
    acc[key] = Boolean(value);
    return acc;
  }, {});

  const mcpInTask = toUnknownArray(implementationUsage.mcp_in_task)
    .map(normalizeUsageItem)
    .filter((item): item is { name: string; events: number; tasks: number } => Boolean(item));

  const skillsInTask = toUnknownArray(implementationUsage.skills_in_task)
    .map(normalizeUsageItem)
    .filter((item): item is { name: string; events: number; tasks: number } => Boolean(item));

  const mcpFrequency = toUnknownArray(implementationUsage.mcp_frequency_across_tasks)
    .map(normalizeUsageItem)
    .filter((item): item is { name: string; events: number; tasks: number } => Boolean(item));

  const skillsFrequency = toUnknownArray(implementationUsage.skills_frequency_across_tasks)
    .map(normalizeUsageItem)
    .filter((item): item is { name: string; events: number; tasks: number } => Boolean(item));

  const normalizedContextPackage: AgentTaskBrief["context_package"] = {
    relevant_anchors: toUnknownArray(contextPackage.relevant_anchors),
    mandatory_rules: toUnknownArray(contextPackage.mandatory_rules),
  };
  if (operationalMemory) {
    normalizedContextPackage.operational_memory = operationalMemory;
  }
  if (collaborationPlan) {
    normalizedContextPackage.collaboration_plan = collaborationPlan;
  }
  if (abTestPlan) {
    normalizedContextPackage.ab_test_plan = abTestPlan;
  }
  if (humanGate) {
    normalizedContextPackage.human_gate = humanGate;
  }

  const workflow = buildTaskWorkflowFields(status, timeline, toText(origin.source_agent_id), toText(task.executor_agent_id));

  return {
    task: {
      id: toText(task.id),
      external_key: toText(task.external_key),
      title: toText(task.title),
      status,
      priority,
      source_agent_id: toText(task.source_agent_id),
      executor_agent_id: toText(task.executor_agent_id),
      created_at: toText(task.created_at),
      updated_at: toText(task.updated_at),
      last_event_at: toNullableText(task.last_event_at),
    },
    what_to_do: {
      goal: toText(whatToDo.goal),
      expected_outcome: toText(whatToDo.expected_outcome),
      acceptance_criteria: toStringArray(whatToDo.acceptance_criteria),
      constraints: toStringArray(whatToDo.constraints),
      dependencies: toStringArray(whatToDo.dependencies),
      target_artifacts: toStringArray(whatToDo.target_artifacts),
      priority_reason: toText(whatToDo.priority_reason),
      context_to_task: normalizeTaskContextToTask(whatToDo.context_to_task),
    },
    origin: {
      origin_type: originType,
      origin_type_label_ru: toText(origin.origin_type_label_ru),
      origin_ref: toNullableText(origin.origin_ref),
      source_agent_id: toText(origin.source_agent_id),
      linked_improvement: linkedImprovement,
    },
    context_and_evidence: {
      evidence_refs: toStringArray(context.evidence_refs),
      context_package: normalizedContextPackage,
      linked_elements: linkedElements,
      related_logs: relatedLogs,
    },
    implementation_usage: {
      source: toText(implementationUsage.source) || "not_set",
      mcp_in_task: mcpInTask,
      skills_in_task: skillsInTask,
      mcp_frequency_across_tasks: mcpFrequency,
      skills_frequency_across_tasks: skillsFrequency,
    },
    readiness: {
      readiness_auto_score: Math.max(0, toNumeric(readiness.readiness_auto_score, 0)),
      readiness_auto_state: VALID_READINESS.has(readinessAutoState) ? readinessAutoState : "needs_clarification",
      readiness_manual_state: VALID_MANUAL_READINESS.has(readinessManualState) ? readinessManualState : "not_set",
      readiness_final_state: VALID_READINESS.has(readinessFinalState) ? readinessFinalState : "needs_clarification",
      checks,
      manual_actor: toNullableText(readiness.manual_actor),
      manual_event_time: toNullableText(readiness.manual_event_time),
    },
    timeline,
    ...workflow,
  };
}

export async function getAgentTasks(query: AgentTasksQuery, signal?: AbortSignal): Promise<AgentTaskRow[]> {
  const rows = await rpcCall<unknown[]>(
    "get_agent_tasks",
    {
      p_status: query.status && query.status !== "all" ? query.status : null,
      p_source_agent_id: query.sourceAgentId || null,
      p_executor_agent_id: query.executorAgentId || null,
      p_query: query.query || null,
      p_limit: query.limit ?? 500,
      p_offset: query.offset ?? 0,
    },
    signal,
  );
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeTaskRow).filter((row): row is AgentTaskRow => Boolean(row));
}

export function getDemoHumanTasks(): AgentTaskRow[] {
  return DEMO_HUMAN_TASK_ROWS;
}

export async function getAgentTaskDetails(taskId: string, signal?: AbortSignal): Promise<AgentTaskDetails | null> {
  const demoTask = DEMO_HUMAN_TASK_DETAILS.get(taskId);
  if (demoTask) return demoTask;
  const payload = await rpcCall<unknown>(
    "get_agent_task_details",
    {
      p_task_id: taskId,
    },
    signal,
  );
  return normalizeTaskDetails(payload);
}

export async function getAgentTaskStatusCounts(
  sourceAgentId?: string | null,
  executorAgentId?: string | null,
  signal?: AbortSignal,
): Promise<AgentTaskStatusCount[]> {
  const rows = await rpcCall<unknown[]>(
    "get_agent_task_status_counts",
    {
      p_source_agent_id: sourceAgentId || null,
      p_executor_agent_id: executorAgentId || null,
    },
    signal,
  );
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeStatusCount).filter((row): row is AgentTaskStatusCount => Boolean(row));
}
