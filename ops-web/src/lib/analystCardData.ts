import {
  getAgentsManifest,
  getAgentBenchmarkSummary,
  getAnalystLatestCycle,
  getOapKbIndex,
  getOapKbRawLogs,
  type AgentSummary,
  type AgentLatestCycleSnapshot,
  type OapKbDocument,
} from "./generatedData";

export type SessionFileLogEntry = {
  time: string;
  step: string;
  files: string[];
  context: string;
};

export type SessionSearchProcess = {
  approach: string;
  steps: string[];
  quality: string;
};

export type SessionActionStep = {
  id: string;
  tool: string;
  crudAction: "" | "read" | "write" | "delete";
  title: string;
  status: "success" | "error" | "running" | "skipped";
  durationMs: number | null;
  input: string;
  output: string;
  timestamp: string;
};

export type SessionFlowTableRow = {
  stageKey: string;
  stageLabel: string;
  stageStartedAt: string;
  stageStartedAtIso: string | null;
  stageTokens: number | null;
  crudAction: "" | "read" | "write" | "delete";
  sourceKind: string;
  sourceLabel: string;
  semanticLayer: string;
  semanticLabel: string;
  fileType: string; // legacy alias; UI must use sourceLabel + semanticLabel
  filePath: string;
  sourceStep: string;
  isCanonical: boolean;
  isExecuted: boolean;
};

export type SessionFileOperation = {
  path: string;
  op: "read" | "write" | "delete";
  rawOp?: "read" | "write" | "create" | "update" | "delete" | null;
  timestamp: string;
  step: string;
  taskId: string;
  runId: string;
  source: "artifact_operations" | "fallback";
  sourceKind: string;
  semanticLayer: string;
  reason: string;
  label: string;
};

export type SessionFlowBackboneStep = {
  key: string;
  label: string;
};

export type SessionFlowBackboneInfo = {
  version: string;
  commonCoreSteps: SessionFlowBackboneStep[];
  roleWindow: {
    entryStep: string;
    entryLabel: string;
    exitStep: string;
    exitLabel: string;
    purpose: string;
    internalSteps: SessionFlowBackboneStep[];
    observedSteps: string[];
  };
  stepExecutionPolicy: {
    skippedStepsAllowed: boolean;
    skippedStepStatus: string;
  };
  supportsDynamicInstances: boolean;
  executedSteps: string[];
  skippedSteps: string[];
};

export type SessionFlowSchema = {
  sessionId: string;
  sessionStartedAt: string;
  sessionStartedAtLabel: string;
  sourceFiles: string[];
  workflowBackbone: SessionFlowBackboneInfo;
  canonicalRows: SessionFlowTableRow[];
  outOfCanonRows: SessionFlowTableRow[];
};

export type AnalystSession = {
  id: string;
  source: "mock" | "telemetry";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  tokensUsed: number;
  tasksTotal: number;
  errorsCount: number;
  risksCount: number;
  fileTrace: SessionFileOperation[];
  fileLog: SessionFileLogEntry[];
  searchProcess: SessionSearchProcess;
  actionLog: SessionActionStep[];
  efficiency: {
    contextTokens: number;
    usefulTokens: number;
    cacheHitRate: number | null;
    traceQuality: {
      operationsTotal: number;
      deleteOperations: number;
      explicitEvents: number;
      fallbackEvents: number;
      eventsWithOperations: number;
      eventsTotal: number;
      coveragePct: number | null;
      explicitCoveragePct: number | null;
      fallbackSharePct: number | null;
    };
  };
  operativeMemory: Array<{
    title: string;
    path: string;
    status: "read" | "write";
    lastReadAt: string | null;
    lastWriteAt: string | null;
    lastTouchedAt: string | null;
    isActive: boolean;
  }>;
  persistentMemory: Array<{ title: string; path: string }>;
  mcpUsed: Array<{ name: string; status: string }>;
  toolsUsed: string[];
  targetMetrics: Record<string, number | null>;
  controlExcalidrawUrl: string | null;
  controlTaskListUrl: string | null;
  flowSchema: SessionFlowSchema;
};

export type AnalystErrorEntry = {
  id: string;
  timestamp: string;
  cycleId: string;
  runId: string;
  step: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  artifactsInvolved: string[];
  resolutionStatus: string;
  resolutionAction: string;
  lessonRef: string;
  source: "error_log" | "telemetry";
};

export type AnalystEfficiencySnapshot = {
  cyclesTotal: number;
  averageTokensPerCycle: number | null;
  averageErrorsPerCycle: number | null;
  averageTasksPerCycle: number | null;
  errorEntries: AnalystErrorEntry[];
};

export type AnalystKeyMetricsSnapshot = {
  recommendationsTotal: number;
  averageTargetMetricGrowthPp: number | null;
  confirmedEffectSharePct: number | null;
  documentedRelevanceSharePct: number | null;
};

type TelemetryEvent = {
  event_id?: string;
  timestamp?: string;
  agent_id?: string;
  task_id?: string;
  run_id?: string;
  step?: string;
  step_raw?: string;
  status?: string;
  outcome?: string;
  recommendation_id?: string | null;
  artifacts_read?: Array<string | { path?: string; source_kind?: string; semantic_layer?: string; reason?: string; label?: string }>;
  artifacts_written?: Array<string | { path?: string; source_kind?: string; semantic_layer?: string; reason?: string; label?: string }>;
  artifact_operations?: Array<{
    path?: string;
    op?: string;
    timestamp?: string;
    step?: string;
    task_id?: string;
    run_id?: string;
    source_kind?: string;
    semantic_layer?: string;
    reason?: string;
    label?: string;
  }>;
  artifact_contract_version?: string;
  artifact_ops_origin?: string;
  mcp_tools?: string[];
  tools?: string[];
  skills?: string[];
  rules?: string[];
  metrics?: Record<string, unknown>;
  error?: string | null;
};

type NormalizedArtifactRef = {
  path: string;
  sourceKind: string;
  semanticLayer: string;
  reason: string;
  label: string;
};

type ErrorLogEvent = {
  entry_id?: string;
  timestamp?: string;
  agent_id?: string;
  cycle_id?: string;
  run_id?: string;
  step?: string;
  category?: string;
  title?: string;
  description?: string;
  severity?: string;
  artifacts_involved?: string[];
  resolution_status?: string;
  resolution_action?: string;
  lesson_ref?: string;
  error?: string | null;
};

export const METRIC_META: Record<string, { label: string; description: string; formula: string }> = {
  verification_pass_rate: {
    label: "Верификация",
    description: "Процент задач, прошедших верификацию с первого раза",
    formula: "verify_passed / (verify_passed + verify_failed) * 100",
  },
  lesson_capture_rate: {
    label: "Захват уроков",
    description: "Процент завершенных задач с зафиксированным уроком",
    formula: "lesson_captured / completed_tasks * 100",
  },
  review_error_rate: {
    label: "Ошибки ревью",
    description: "Процент задач с ошибками на ревью",
    formula: "review_errors / completed_tasks * 100",
  },
  recommendation_action_rate: {
    label: "Внедрение рекомендаций",
    description: "Процент рекомендаций, дошедших до применения",
    formula: "recommendations_applied / recommendations_suggested * 100",
  },
};

export type AnalystCardData = {
  agent: AgentSummary;
  cycle: AgentLatestCycleSnapshot;
  sessions: AnalystSession[];
  efficiency: AnalystEfficiencySnapshot;
  keyMetrics: AnalystKeyMetricsSnapshot;
  kbDocs: OapKbDocument[];
};

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateMs(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundTo(values.reduce((sum, value) => sum + value, 0) / values.length, 1);
}

function formatLocalTime(value: string | undefined, withSeconds = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: withSeconds ? "2-digit" : undefined,
  });
}

function formatLocalDateTimeHuman(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const months = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()] || "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${hours}:${minutes}`;
}

const CANONICAL_STAGE_ORDER: string[] = [
  "step_0_intake",
  "step_1_start",
  "step_2_preflight",
  "step_3_orchestration",
  "step_4_context_sync",
  "step_5_role_window",
  "step_6_role_exit_decision",
  "step_7_apply_or_publish",
  "step_7_contract_gate",
  "step_8_verify",
  "step_8_error_channel",
  "step_9_finalize",
  "step_9_publish_snapshots",
];

const CANONICAL_STAGE_LABELS_RU: Record<string, string> = {
  step_0_intake: "0) Прием задачи и синхронизация",
  step_1_start: "1) Старт цикла",
  step_2_preflight: "2) Предпроверка состояния",
  step_3_orchestration: "3) Оркестрация (reuse-first)",
  step_4_context_sync: "4) Синхронизация контекста и evidence",
  step_5_role_window: "5) Уникальная ветка агента (role window)",
  step_6_role_exit_decision: "6) Выход из уникальной ветки агента",
  step_7_apply_or_publish: "7) Применение или публикация результата",
  step_7_contract_gate: "7.1) Проверка контракта",
  step_8_verify: "8) Верификация",
  step_8_error_channel: "8.1) Канал ошибок",
  step_9_finalize: "9) Финализация и learning core",
  step_9_publish_snapshots: "9.1) Публикация snapshot",
};

const TELEMETRY_STEP_ALIASES: Record<string, string> = {
  task_intake: "step_0_intake",
  intake: "step_0_intake",
  sync: "step_0_intake",
  started: "step_1_start",
  start: "step_1_start",
  health_check: "step_2_preflight",
  healthcheck: "step_2_preflight",
  preflight: "step_2_preflight",
  step_2_health_check: "step_2_preflight",
  orchestration: "step_3_orchestration",
  plan: "step_3_orchestration",
  context_sync: "step_4_context_sync",
  evidence: "step_4_context_sync",
  kb_sync: "step_4_context_sync",
  source_monitor: "step_4_context_sync",
  step_4_evidence_sync: "step_4_context_sync",
  candidate_scoring: "step_5_role_window",
  improvement_planning: "step_5_role_window",
  role_window: "step_5_role_window",
  step_5_candidate_scoring: "step_5_role_window",
  priority_decision: "step_6_role_exit_decision",
  role_exit_decision: "step_6_role_exit_decision",
  step_6_priority_decision: "step_6_role_exit_decision",
  apply: "step_7_apply_or_publish",
  apply_fix: "step_7_apply_or_publish",
  implement: "step_7_apply_or_publish",
  execute: "step_7_apply_or_publish",
  publish: "step_7_apply_or_publish",
  step_7_apply: "step_7_apply_or_publish",
  contract_gate: "step_7_contract_gate",
  verify: "step_8_verify",
  error_channel: "step_8_error_channel",
  learn: "step_9_finalize",
  finalize: "step_9_finalize",
  publish_snapshots: "step_9_publish_snapshots",
  knowledge_base_check: "step_4_context_sync",
  external_monitor: "step_4_context_sync",
  improvements_list: "step_5_role_window",
  implementation_started: "step_1_start",
  batch1_schema_registry_validation: "step_7_contract_gate",
  batch2_ui_work_contour: "step_7_apply_or_publish",
  batch3_telemetry_semantics_and_docs: "step_9_finalize",
  batch4_legacy_telemetry_compat_ui: "step_7_apply_or_publish",
  finalize_work_contour_migration: "step_9_finalize",
};

function normalizeStepForFlow(step: string | undefined): string {
  const raw = String(step || "").trim().toLowerCase();
  if (!raw) return "";
  const normalized = raw.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!normalized) return "";
  if (CANONICAL_STAGE_LABELS_RU[normalized]) return normalized;
  return TELEMETRY_STEP_ALIASES[normalized] || normalized;
}

function labelForFlowStep(step: string): string {
  return CANONICAL_STAGE_LABELS_RU[step] || step.replace(/_/g, " ");
}

function inferArtifactSourceKind(path: string): string {
  const value = String(path || "").trim().toLowerCase();
  if (!value) return "";
  if (value.startsWith("agent_tasks.")) return "generated_artifact";
  if (value === "docs/agents/registry.yaml") return "registry";
  if (value === "docs/agents/profile_templates.yaml") return "template_catalog";
  if (value.includes("operating_plan")) return "operating_plan";
  if (value === "docs/subservices/oap/agents-card.schema.json" || value.includes("/contracts/")) return "contract";
  if (value.startsWith(".specify/specs/001-oap/")) return "spec";
  if (value.startsWith(".logs/agents/")) return "telemetry_log";
  if (value.startsWith("artifacts/capability_trials/")) return "capability_snapshot";
  if (value.startsWith("artifacts/") || value.startsWith("ops-web/src/generated/") || value.startsWith("ops-web/public/generated/")) {
    return "generated_artifact";
  }
  return "unknown";
}

function inferArtifactSemanticLayer(path: string, step = ""): string {
  const value = String(path || "").trim().toLowerCase();
  const stepKey = normalizeStepForFlow(step);
  if (!value) return "";
  if (value === "docs/agents/registry.yaml" || value === "docs/agents/profile_templates.yaml") {
    if (stepKey === "step_0_intake" || stepKey === "step_3_orchestration") return "tools";
    if (stepKey === "step_1_start" || stepKey === "step_6_role_exit_decision" || stepKey === "step_7_apply_or_publish") return "rules";
  }
  if (value === "agent_tasks.task_brief.context_package" || value.startsWith("agent_tasks.")) return "tasks";
  if (value.startsWith("docs/tasks/") || (value.endsWith("/todo.md") && value.includes("/tasks/"))) return "tasks";
  if (value.includes("/skills/") || value.endsWith("/skill.md") || value.endsWith("skill.md")) return "skills";
  if (value === ".mcp.json" || value.includes("/mcp/") || value.includes("context7") || value.includes("supabase")) return "mcp";
  if (value === "agents.md" || value.includes("operating_plan") || value.includes("design_rules") || value.includes("/decisions/")) return "rules";
  if (value.startsWith(".specify/specs/001-oap/")) return "schema";
  if (value === "docs/subservices/oap/agents-card.schema.json" || value.includes("/contracts/")) return "schema";
  if (value.startsWith(".logs/agents/") || value.startsWith("artifacts/agent_") || value.startsWith("artifacts/capability_trials/")) return "telemetry";
  if (value.includes("lessons.global.md") || value.includes("/tasks/lessons/")) return "memory";
  return "unknown";
}

function inferArtifactLabel(path: string): string {
  const value = String(path || "").trim();
  const lowered = value.toLowerCase();
  if (!value) return "";
  if (lowered === "docs/agents/registry.yaml") return "Реестр агентов";
  if (lowered === "docs/agents/profile_templates.yaml") return "Template catalog";
  if (lowered.includes("operating_plan")) return "Operating plan";
  if (lowered === "docs/subservices/oap/agents-card.schema.json") return "Contract";
  if (lowered.startsWith(".specify/specs/001-oap/")) return "Spec";
  if (lowered.startsWith(".logs/agents/")) return "Telemetry log";
  if (lowered.startsWith("artifacts/capability_trials/")) return "Capability snapshot";
  if (lowered.startsWith("artifacts/") || lowered.startsWith("ops-web/src/generated/") || lowered.startsWith("ops-web/public/generated/")) {
    return "Generated artifact";
  }
  return "";
}

function normalizeArtifactRefs(
  value: TelemetryEvent["artifacts_read"] | TelemetryEvent["artifacts_written"] | unknown,
  step = "",
): NormalizedArtifactRef[] {
  if (!Array.isArray(value)) return [];
  const refs: NormalizedArtifactRef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const path = typeof item === "string"
      ? item.trim()
      : typeof item === "object" && item !== null && typeof (item as { path?: unknown }).path === "string"
        ? String((item as { path?: string }).path || "").trim()
        : "";
    if (!path) continue;
    const sourceKind = typeof item === "object" && item !== null && typeof (item as { source_kind?: unknown }).source_kind === "string"
      ? String((item as { source_kind?: string }).source_kind || "").trim() || inferArtifactSourceKind(path)
      : inferArtifactSourceKind(path);
    const semanticLayer = typeof item === "object" && item !== null && typeof (item as { semantic_layer?: unknown }).semantic_layer === "string"
      ? String((item as { semantic_layer?: string }).semantic_layer || "").trim() || inferArtifactSemanticLayer(path, step)
      : inferArtifactSemanticLayer(path, step);
    const reason = typeof item === "object" && item !== null && typeof (item as { reason?: unknown }).reason === "string"
      ? String((item as { reason?: string }).reason || "").trim() || "unknown"
      : "unknown";
    const label = typeof item === "object" && item !== null && typeof (item as { label?: unknown }).label === "string"
      ? String((item as { label?: string }).label || "").trim() || inferArtifactLabel(path)
      : inferArtifactLabel(path);
    const dedupeKey = `${path}::${sourceKind}::${semanticLayer}::${reason}::${label}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    refs.push({
      path,
      sourceKind: sourceKind || "unknown",
      semanticLayer: semanticLayer || "unknown",
      reason: reason || "unknown",
      label: label || path,
    });
  }
  return refs;
}

function sourceKindLabel(ref: NormalizedArtifactRef): string {
  const sourceKind = String(ref.sourceKind || "").trim().toLowerCase();
  if (sourceKind === "registry") return "Registry";
  if (sourceKind === "template_catalog") return "Template catalog";
  if (sourceKind === "operating_plan") return "Operating plan";
  if (sourceKind === "contract") return "Contract";
  if (sourceKind === "spec") return "Spec";
  if (sourceKind === "telemetry_log") return "Telemetry";
  if (sourceKind === "generated_artifact") return "Generated artifact";
  if (sourceKind === "capability_snapshot") return "Capability snapshot";
  return "Unknown";
}

function semanticLayerLabel(ref: NormalizedArtifactRef): string {
  const layer = String(ref.semanticLayer || "").trim().toLowerCase();
  if (layer === "skills") return "Skills";
  if (layer === "tools") return "Tools";
  if (layer === "mcp") return "MCP / Integrations";
  if (layer === "rules") return "Rules";
  if (layer === "tasks") return "Tasks";
  if (layer === "schema") return "Schema";
  if (layer === "memory") return "Долговременная память";
  if (layer === "telemetry") return "Telemetry";
  return "Unknown";
}

function buildSessionFlowSchema(
  events: TelemetryEvent[],
  sessionId: string,
  sessionStartedAt: string,
  agent: AgentSummary,
): SessionFlowSchema {
  const workflowBackbone = agent.workflowBackbone || {
    version: "universal_backbone_v1",
    commonCoreSteps: CANONICAL_STAGE_ORDER,
    roleWindow: {
      entryStep: "step_5_role_window",
      exitStep: "step_6_role_exit_decision",
      purpose: "Выполнить доменную логику аналитика и вернуть decision package в общий backbone.",
      internalSteps: [
        "role_collect_quality_signals",
        "role_score_candidates",
        "role_select_priority",
      ],
    },
    stepExecutionPolicy: {
      skippedStepsAllowed: true,
      skippedStepStatus: "skipped",
    },
    supportsDynamicInstances: true,
  };
  const canonicalStageOrder = Array.isArray(workflowBackbone.commonCoreSteps) && workflowBackbone.commonCoreSteps.length > 0
    ? workflowBackbone.commonCoreSteps
    : CANONICAL_STAGE_ORDER;
  const canonicalBuckets = new Map<string, TelemetryEvent[]>();
  for (const stepKey of canonicalStageOrder) {
    canonicalBuckets.set(stepKey, []);
  }
  const outOfCanon: Array<{ normalizedStep: string; event: TelemetryEvent }> = [];

  for (const event of events) {
    const rawStep = String(event.step_raw || event.step || "").trim();
    const normalizedStep = normalizeStepForFlow(rawStep);
    if (CANONICAL_STAGE_LABELS_RU[normalizedStep]) {
      const bucket = canonicalBuckets.get(normalizedStep) || [];
      bucket.push(event);
      canonicalBuckets.set(normalizedStep, bucket);
      continue;
    }
    if (rawStep) {
      outOfCanon.push({ normalizedStep, event });
    }
  }

  const buildRowsForEvents = (
    stageKey: string,
    stageLabel: string,
    stageEvents: TelemetryEvent[],
    isCanonical: boolean,
    sourceStepFallback = "",
  ): SessionFlowTableRow[] => {
    if (stageEvents.length === 0) {
      return [
        {
          stageKey,
          stageLabel,
          stageStartedAt: "",
          stageStartedAtIso: null,
          stageTokens: null,
          crudAction: "",
          sourceKind: "",
          sourceLabel: "",
          semanticLayer: "",
          semanticLabel: "",
          fileType: "",
          filePath: "",
          sourceStep: sourceStepFallback,
          isCanonical,
          isExecuted: false,
        },
      ];
    }

    const sorted = [...stageEvents].sort((a, b) => toDateMs(a.timestamp) - toDateMs(b.timestamp));
    const startedAtIso = sorted[0]?.timestamp || null;
    const startedAtLabel = formatLocalDateTimeHuman(startedAtIso || undefined);
    const stageTokens = sorted.reduce(
      (sum, event) => sum + toNumber(event.metrics?.tokens_in) + toNumber(event.metrics?.tokens_out),
      0,
    );
    const rows: SessionFlowTableRow[] = [];

    for (const event of sorted) {
      const sourceStep = String(event.step_raw || event.step || sourceStepFallback || "").trim();
      const operations = getEventFileOperations(event);
      for (const operation of operations) {
        if (operation.op !== "read" && operation.op !== "write" && operation.op !== "delete") continue;
        const filePath = operation.path;
        const artifactRef = normalizeArtifactRefs([{
          path: filePath,
          source_kind: operation.sourceKind,
          semantic_layer: operation.semanticLayer,
          reason: operation.reason,
          label: operation.label,
        }], sourceStep)[0] || {
          path: filePath,
          sourceKind: inferArtifactSourceKind(filePath),
          semanticLayer: inferArtifactSemanticLayer(filePath, sourceStep),
          reason: "unknown",
          label: inferArtifactLabel(filePath) || filePath,
        };
        const sourceLabel = sourceKindLabel(artifactRef);
        const semanticLabel = semanticLayerLabel(artifactRef);
        rows.push({
          stageKey,
          stageLabel,
          stageStartedAt: startedAtLabel,
          stageStartedAtIso: startedAtIso,
          stageTokens,
          crudAction: operation.op,
          sourceKind: artifactRef.sourceKind || "unknown",
          sourceLabel,
          semanticLayer: artifactRef.semanticLayer || "unknown",
          semanticLabel,
          fileType: sourceLabel,
          filePath,
          sourceStep,
          isCanonical,
          isExecuted: true,
        });
      }
    }

    if (rows.length === 0) {
      rows.push({
        stageKey,
        stageLabel,
        stageStartedAt: startedAtLabel,
        stageStartedAtIso: startedAtIso,
        stageTokens,
        crudAction: "",
        sourceKind: "",
        sourceLabel: "",
        semanticLayer: "",
        semanticLabel: "",
        fileType: "",
        filePath: "",
        sourceStep: sourceStepFallback,
        isCanonical,
        isExecuted: true,
      });
    }

    return rows;
  };

  const canonicalRows = canonicalStageOrder.flatMap((stageKey) =>
    buildRowsForEvents(
      stageKey,
      labelForFlowStep(stageKey),
      canonicalBuckets.get(stageKey) || [],
      true,
      stageKey,
    ),
  );

  const outOfCanonRows = outOfCanon.flatMap(({ normalizedStep, event }) =>
    buildRowsForEvents(
      normalizedStep || String(event.step || event.step_raw || "non_canonical").trim() || "non_canonical",
      `Вне канона: ${String(event.step_raw || event.step || "не указано")}`,
      [event],
      false,
      String(event.step_raw || event.step || "").trim(),
    ),
  );

  const executedSteps = canonicalStageOrder.filter((stageKey) => (canonicalBuckets.get(stageKey) || []).length > 0);
  const skippedSteps = canonicalStageOrder.filter((stageKey) => (canonicalBuckets.get(stageKey) || []).length === 0);
  const roleWindowObservedSteps = uniqueStrings(
    [
      ...(canonicalBuckets.get(workflowBackbone.roleWindow.entryStep) || []),
      ...(canonicalBuckets.get(workflowBackbone.roleWindow.exitStep) || []),
    ]
      .map((event) => String(event.step_raw || event.step || "").trim())
      .filter(Boolean),
  );

  return {
    sessionId,
    sessionStartedAt,
    sessionStartedAtLabel: formatLocalDateTimeHuman(sessionStartedAt),
    sourceFiles: [
      ".logs/agents/analyst-agent.jsonl",
      "artifacts/agent_cycle_validation_report.json",
      "artifacts/agent_latest_cycle_analyst.json",
      "ops-web/public/generated/agent-latest-cycle-analyst.json",
      "docs/agents/registry.yaml",
      "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
    ],
    workflowBackbone: {
      version: workflowBackbone.version,
      commonCoreSteps: canonicalStageOrder.map((step) => ({
        key: step,
        label: labelForFlowStep(step),
      })),
      roleWindow: {
        entryStep: workflowBackbone.roleWindow.entryStep,
        entryLabel: labelForFlowStep(workflowBackbone.roleWindow.entryStep),
        exitStep: workflowBackbone.roleWindow.exitStep,
        exitLabel: labelForFlowStep(workflowBackbone.roleWindow.exitStep),
        purpose: workflowBackbone.roleWindow.purpose,
        internalSteps: workflowBackbone.roleWindow.internalSteps.map((step) => ({
          key: step,
          label: labelForFlowStep(step),
        })),
        observedSteps: roleWindowObservedSteps,
      },
      stepExecutionPolicy: {
        skippedStepsAllowed: workflowBackbone.stepExecutionPolicy.skippedStepsAllowed,
        skippedStepStatus: workflowBackbone.stepExecutionPolicy.skippedStepStatus,
      },
      supportsDynamicInstances: workflowBackbone.supportsDynamicInstances,
      executedSteps,
      skippedSteps,
    },
    canonicalRows,
    outOfCanonRows,
  };
}

function splitJsonLines(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseJsonLines<T>(content: string): T[] {
  const rows = splitJsonLines(content);
  const parsed: T[] = [];
  for (const row of rows) {
    try {
      parsed.push(JSON.parse(row) as T);
    } catch {
      // Ignore broken rows and keep the card resilient.
    }
  }
  return parsed;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseExpectedDeltaPct(value: string | null | undefined): number | null {
  const source = String(value || "").trim();
  if (!source) return null;
  const matched = source.match(/-?\d+(?:[.,]\d+)?/);
  if (!matched) return null;
  const numeric = Number(matched[0].replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
}

function toPercentValue(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 0 && value <= 1) return roundTo(value * 100, 1);
  return roundTo(value, 1);
}

function isValidationDateActual(value: string | null | undefined): boolean {
  const source = String(value || "").trim();
  if (!source) return false;
  const timestamp = Date.parse(source);
  if (!Number.isFinite(timestamp)) return false;
  return timestamp >= Date.now();
}

function normalizeToolStatus(status: string): string {
  const value = status.trim().toLowerCase();
  if (value === "active" || value === "online") return "успешно";
  if (value === "degraded") return "degraded";
  if (value === "offline") return "offline";
  if (value === "reauth_required") return "требует reauth";
  return status || "не зафиксировано";
}

function humanizeStep(step: string): string {
  const map: Record<string, string> = {
    step_0_intake: "0) Прием задачи и синхронизация",
    step_1_start: "1) Старт цикла",
    step_2_preflight: "2) Предпроверка состояния",
    step_3_orchestration: "3) Оркестрация (reuse-first)",
    step_4_context_sync: "4) Синхронизация контекста и evidence",
    step_5_role_window: "5) Уникальная ветка агента (role window)",
    step_6_role_exit_decision: "6) Выход из уникальной ветки агента",
    step_7_apply_or_publish: "7) Применение или публикация результата",
    step_7_contract_gate: "7.1) Проверка контракта",
    step_8_verify: "8) Верификация",
    step_8_error_channel: "8.1) Канал ошибок",
    step_9_finalize: "9) Финализация и learning core",
    step_9_publish_snapshots: "9.1) Публикация snapshot",
    plan: "Планирование",
    health_check: "Предпроверка состояния",
    knowledge_base_check: "Проверка базы знаний",
    external_monitor: "Внешний мониторинг",
    improvements_list: "Список улучшений",
    execute: "Применение результата",
    verify: "Верификация",
    learn: "Фиксация уроков",
    finalize: "Финализация",
  };
  return map[step] || step.replace(/_/g, " ");
}

function inferActionTool(event: TelemetryEvent): SessionActionStep["tool"] {
  const tools = event.tools || [];
  if (tools.length > 0) return tools[0];
  return "Agent";
}

function inferActionCrudAction(event: TelemetryEvent): SessionActionStep["crudAction"] {
  const ops = getEventFileOperations(event);
  if (ops.some((o) => o.op === "write")) return "write";
  if (ops.some((o) => o.op === "delete")) return "delete";
  if (ops.some((o) => o.op === "read")) return "read";
  return "";
}

function buildToolsUsed(events: TelemetryEvent[]): string[] {
  return Array.from(new Set(events.flatMap((e) => e.tools || []).filter(Boolean)));
}

function inferActionStatus(event: TelemetryEvent): SessionActionStep["status"] {
  const status = (event.status || "").toLowerCase();
  if (event.error || status.includes("failed")) return "error";
  if (status.includes("skip")) return "skipped";
  return "success";
}

function buildActionInput(event: TelemetryEvent): string {
  const lines: string[] = [];
  if (event.step) lines.push(`step: ${event.step}`);
  if (event.status) lines.push(`status: ${event.status}`);
  if (event.recommendation_id) lines.push(`recommendation_id: ${event.recommendation_id}`);
  const operations = getEventFileOperations(event);
  const readPaths = operations.filter((operation) => operation.op === "read").map((operation) => operation.path);
  const writePaths = operations.filter((operation) => operation.op === "write").map((operation) => operation.path);
  const deletePaths = operations.filter((operation) => operation.op === "delete").map((operation) => operation.path);
  if (readPaths.length > 0) lines.push(`read: ${readPaths.join(", ")}`);
  if (writePaths.length > 0) lines.push(`write: ${writePaths.join(", ")}`);
  if (deletePaths.length > 0) lines.push(`delete: ${deletePaths.join(", ")}`);
  return lines.join("\n");
}

function buildActionOutput(event: TelemetryEvent): string {
  if (event.error) return String(event.error);
  return event.outcome || "не зафиксировано";
}

function buildSearchProcess(events: TelemetryEvent[], errorsCount: number): SessionSearchProcess {
  const steps = events.map((event) => {
    const label = humanizeStep(event.step || "step");
    const outcome = event.outcome ? `: ${event.outcome}` : "";
    return `${label}${outcome}`;
  });
  return {
    approach: "OTel-first telemetry trace + проверка артефактов цикла",
    steps: steps.length > 0 ? steps : ["не зафиксировано"],
    quality: `${events.length} событий, ошибок: ${errorsCount}`,
  };
}

function buildFileLog(events: TelemetryEvent[]): SessionFileLogEntry[] {
  return events.map((event) => ({
    time: formatLocalTime(event.timestamp, false),
    step: humanizeStep(event.step || "step"),
    files: uniqueStrings(getEventFileOperations(event).map((operation) => operation.path)),
    context: event.outcome || "не зафиксировано",
  }));
}

function buildSessionFileTrace(events: TelemetryEvent[]): SessionFileOperation[] {
  const sorted = [...events].sort((a, b) => toDateMs(a.timestamp) - toDateMs(b.timestamp));
  return sorted.flatMap((event) => getEventFileOperations(event));
}

function buildTraceQuality(
  events: TelemetryEvent[],
  fileTrace: SessionFileOperation[],
): {
  operationsTotal: number;
  deleteOperations: number;
  explicitEvents: number;
  fallbackEvents: number;
  eventsWithOperations: number;
  eventsTotal: number;
  coveragePct: number | null;
  explicitCoveragePct: number | null;
  fallbackSharePct: number | null;
} {
  const eventsTotal = events.length;
  let eventsWithOperations = 0;
  let explicitEvents = 0;
  let fallbackEvents = 0;
  for (const event of events) {
    const operations = getEventFileOperations(event);
    if (operations.length === 0) continue;
    eventsWithOperations += 1;
    if (operations.some((operation) => operation.source === "artifact_operations")) {
      explicitEvents += 1;
    } else {
      fallbackEvents += 1;
    }
  }
  const deleteOperations = fileTrace.filter((operation) => operation.op === "delete").length;
  return {
    operationsTotal: fileTrace.length,
    deleteOperations,
    explicitEvents,
    fallbackEvents,
    eventsWithOperations,
    eventsTotal,
    coveragePct: eventsTotal > 0 ? roundTo((eventsWithOperations / eventsTotal) * 100, 1) : null,
    explicitCoveragePct: eventsWithOperations > 0 ? roundTo((explicitEvents / eventsWithOperations) * 100, 1) : null,
    fallbackSharePct: eventsWithOperations > 0 ? roundTo((fallbackEvents / eventsWithOperations) * 100, 1) : null,
  };
}

function buildPersistentMemory(agent: AgentSummary): Array<{ title: string; path: string }> {
  const values: Array<{ title: string; path: string }> = [];
  const lessonsPath = agent.learningArtifacts?.lessonsPath;
  if (lessonsPath) {
    values.push({ title: "Уроки агента-аналитика", path: lessonsPath });
  }
  values.push({ title: "Глобальные уроки", path: "docs/subservices/oap/tasks/lessons.global.md" });
  return values;
}

function buildOperativeMemoryFallback(agent: AgentSummary): AnalystSession["operativeMemory"] {
  const anchors = agent.memoryContext?.contextAnchors || [];
  const values = anchors.map((anchor) => ({
    title: anchor.title || "Контекстный якорь (read)",
    path: anchor.filePath,
    status: "read" as const,
    lastReadAt: null,
    lastWriteAt: null,
    lastTouchedAt: null,
    isActive: true,
  }));
  return values.length > 0
    ? values
    : [{
      title: "Операционный стандарт аналитика (read)",
      path: "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
      status: "read",
      lastReadAt: null,
      lastWriteAt: null,
      lastTouchedAt: null,
      isActive: true,
    }];
}

function normalizeFileOperation(value: string | undefined): SessionFileOperation["op"] | null {
  const op = String(value || "").trim().toLowerCase();
  if (!op) return null;
  if (op === "read") return "read";
  if (op === "write" || op === "create" || op === "update") return "write";
  if (op === "delete" || op === "remove" || op === "removed" || op === "unlink" || op === "drop" || op === "rm") {
    return "delete";
  }
  return null;
}

function normalizeRawFileOperation(value: string | undefined): SessionFileOperation["rawOp"] {
  const op = String(value || "").trim().toLowerCase();
  if (!op) return null;
  if (op === "read" || op === "write" || op === "create" || op === "update" || op === "delete") return op;
  if (op === "remove" || op === "removed" || op === "unlink" || op === "drop" || op === "rm") return "delete";
  return null;
}

function getEventFileOperations(event: TelemetryEvent): SessionFileOperation[] {
  const timestamp = String(event.timestamp || "");
  const step = String(event.step_raw || event.step || "").trim();
  const normalizedStep = normalizeStepForFlow(step);
  const taskId = String(event.task_id || "");
  const runId = String(event.run_id || "");

  const explicitOperations = Array.isArray(event.artifact_operations)
    ? event.artifact_operations.flatMap((item): SessionFileOperation[] => {
      const path = String(item?.path || "").trim();
      const op = normalizeFileOperation(item?.op);
      if (!path || !op) return [];
      const sourceKind = String(item?.source_kind || "").trim() || inferArtifactSourceKind(path);
      const semanticLayer = String(item?.semantic_layer || "").trim() || inferArtifactSemanticLayer(path, normalizedStep);
      const reason = String(item?.reason || "").trim() || "unknown";
      const label = String(item?.label || "").trim() || inferArtifactLabel(path) || path;
      return [{
        path,
        op,
        rawOp: normalizeRawFileOperation(item?.op) || op,
        timestamp: String(item?.timestamp || timestamp),
        step: String(item?.step || step).trim(),
        taskId: String(item?.task_id || taskId),
        runId: String(item?.run_id || runId),
        source: "artifact_operations" as const,
        sourceKind: sourceKind || "unknown",
        semanticLayer: semanticLayer || "unknown",
        reason: reason || "unknown",
        label: label || path,
      }];
    })
    : [];

  if (explicitOperations.length > 0) {
    return explicitOperations;
  }

  const fallbackOperations: SessionFileOperation[] = [];
  const readRefs = normalizeArtifactRefs(event.artifacts_read, normalizedStep);
  const writeRefs = normalizeArtifactRefs(event.artifacts_written, normalizedStep);
  for (const ref of readRefs) {
    const path = ref.path;
    fallbackOperations.push({
      path,
      op: "read",
      rawOp: "read",
      timestamp,
      step,
      taskId,
      runId,
      source: "fallback",
      sourceKind: ref.sourceKind || "unknown",
      semanticLayer: ref.semanticLayer || "unknown",
      reason: ref.reason || "unknown",
      label: ref.label || path,
    });
  }
  for (const ref of writeRefs) {
    const path = ref.path;
    fallbackOperations.push({
      path,
      op: "write",
      rawOp: "write",
      timestamp,
      step,
      taskId,
      runId,
      source: "fallback",
      sourceKind: ref.sourceKind || "unknown",
      semanticLayer: ref.semanticLayer || "unknown",
      reason: ref.reason || "unknown",
      label: ref.label || path,
    });
  }
  return fallbackOperations;
}

function buildSessionOperativeMemory(
  fileTrace: SessionFileOperation[],
  agent: AgentSummary,
): AnalystSession["operativeMemory"] {
  const memory = new Map<string, {
    path: string;
    status: "read" | "write";
    lastReadAt: string | null;
    lastWriteAt: string | null;
    lastTouchedAt: string | null;
    isActive: boolean;
    touchedOrder: number;
  }>();
  let touchedOrder = 0;

  for (const operation of fileTrace) {
    const path = String(operation.path || "").trim();
    if (!path) continue;
    if (operation.op === "delete") {
      memory.delete(path);
      continue;
    }
    const timestamp = operation.timestamp || null;
    const existing = memory.get(path);
    touchedOrder += 1;
    if (!existing) {
      memory.set(path, {
        path,
        status: operation.op === "write" ? "write" : "read",
        lastReadAt: operation.op === "read" ? timestamp : null,
        lastWriteAt: operation.op === "write" ? timestamp : null,
        lastTouchedAt: timestamp,
        isActive: true,
        touchedOrder,
      });
      continue;
    }
    if (operation.op === "write") {
      existing.status = "write";
      existing.lastWriteAt = timestamp || existing.lastWriteAt;
    } else {
      existing.lastReadAt = timestamp || existing.lastReadAt;
    }
    existing.lastTouchedAt = timestamp || existing.lastTouchedAt;
    existing.isActive = true;
    existing.touchedOrder = touchedOrder;
    memory.set(path, existing);
  }

  if (memory.size === 0) {
    return buildOperativeMemoryFallback(agent);
  }

  return Array.from(memory.values())
    .sort((a, b) => {
      const byTime = toDateMs(b.lastTouchedAt || undefined) - toDateMs(a.lastTouchedAt || undefined);
      if (byTime !== 0) return byTime;
      return b.touchedOrder - a.touchedOrder;
    })
    .map((entry) => ({
      title: entry.status === "write" ? "Контекст сессии (write)" : "Контекст сессии (read)",
      path: entry.path,
      status: entry.status,
      lastReadAt: entry.lastReadAt,
      lastWriteAt: entry.lastWriteAt,
      lastTouchedAt: entry.lastTouchedAt,
      isActive: entry.isActive,
    }));
}

function buildErrorEntries(errorEvents: ErrorLogEvent[], telemetryEvents: TelemetryEvent[]): AnalystErrorEntry[] {
  const fromErrorLog = errorEvents
    .filter((item) => !item.agent_id || item.agent_id === "analyst-agent")
    .map((item, index) => ({
      id: item.entry_id || `error-log-${index + 1}`,
      timestamp: item.timestamp || "",
      cycleId: item.cycle_id || "",
      runId: item.run_id || "",
      step: item.step || "",
      severity: item.severity || "WARNING",
      category: item.category || "not_classified",
      title: item.title || "Ошибка цикла",
      description: item.description || item.error || "Описание ошибки не зафиксировано.",
      artifactsInvolved: Array.isArray(item.artifacts_involved) ? item.artifacts_involved.filter(Boolean) : [],
      resolutionStatus: item.resolution_status || "не зафиксировано",
      resolutionAction: item.resolution_action || "не зафиксировано",
      lessonRef: item.lesson_ref || "",
      source: "error_log" as const,
    }));

  const fromTelemetry = telemetryEvents
    .filter((event) => (!event.agent_id || event.agent_id === "analyst-agent") && event.error)
    .map((event, index) => ({
      id: event.event_id || `telemetry-error-${index + 1}`,
      timestamp: event.timestamp || "",
      cycleId: event.task_id || "",
      runId: event.run_id || "",
      step: event.step || "",
      severity: "ERROR",
      category: "telemetry_error",
      title: event.outcome || "Ошибка telemetry-события",
      description: String(event.error || "Описание ошибки не зафиксировано."),
      artifactsInvolved: uniqueStrings(getEventFileOperations(event).map((operation) => operation.path)),
      resolutionStatus: "не зафиксировано",
      resolutionAction: "не зафиксировано",
      lessonRef: "",
      source: "telemetry" as const,
    }));

  return [...fromErrorLog, ...fromTelemetry].sort((a, b) => toDateMs(b.timestamp) - toDateMs(a.timestamp));
}

function buildEfficiencySnapshot(sessions: AnalystSession[], errorEntries: AnalystErrorEntry[]): AnalystEfficiencySnapshot {
  return {
    cyclesTotal: sessions.length,
    averageTokensPerCycle: average(sessions.map((session) => session.tokensUsed)),
    averageErrorsPerCycle: average(sessions.map((session) => session.errorsCount)),
    averageTasksPerCycle: average(sessions.map((session) => session.tasksTotal)),
    errorEntries,
  };
}

function buildKeyMetricsSnapshot(agent: AgentSummary): AnalystKeyMetricsSnapshot {
  const benchmarkSummary = getAgentBenchmarkSummary();
  const growthDeltas = (agent.improvements || [])
    .map((item) => parseExpectedDeltaPct(item.expectedDelta))
    .filter((value): value is number => value !== null);
  const recommendationsTotal = agent.improvements?.length || 0;
  const documentedRelevantRecommendations = (agent.improvements || []).filter((item) => isValidationDateActual(item.validationDate)).length;

  return {
    recommendationsTotal,
    averageTargetMetricGrowthPp: average(growthDeltas),
    confirmedEffectSharePct: toPercentValue(benchmarkSummary.impact_metrics?.validated_impact_rate),
    documentedRelevanceSharePct: recommendationsTotal > 0
      ? roundTo((documentedRelevantRecommendations / recommendationsTotal) * 100, 1)
      : null,
  };
}

function buildSessions(agent: AgentSummary, cycle: AgentLatestCycleSnapshot): AnalystSession[] {
  const rawLogs = getOapKbRawLogs();
  const telemetryDoc = rawLogs.find((doc) => doc.path === ".logs/agents/analyst-agent.jsonl");
  const errorDoc = rawLogs.find((doc) => doc.path === ".logs/agents/analyst-agent-errors.jsonl");

  const telemetryEvents = telemetryDoc ? parseJsonLines<TelemetryEvent>(telemetryDoc.content) : [];
  const grouped = new Map<string, TelemetryEvent[]>();
  for (const event of telemetryEvents) {
    if (!event.task_id) continue;
    if (event.agent_id && event.agent_id !== "analyst-agent") continue;
    if (!grouped.has(event.task_id)) grouped.set(event.task_id, []);
    grouped.get(event.task_id)?.push(event);
  }

  const errorEvents = errorDoc ? parseJsonLines<ErrorLogEvent>(errorDoc.content) : [];
  const errorsByCycle = new Map<string, ErrorLogEvent[]>();
  for (const item of errorEvents) {
    const cycleId = item.cycle_id || "";
    if (!cycleId) continue;
    if (!errorsByCycle.has(cycleId)) errorsByCycle.set(cycleId, []);
    errorsByCycle.get(cycleId)?.push(item);
  }

  const persistentMemory = buildPersistentMemory(agent);
  const mcpUsedFromAgent = (agent.usedMcp || []).map((item) => ({
    name: item.name,
    status: normalizeToolStatus(item.status),
  }));

  const sessions = Array.from(grouped.entries())
    .map(([taskId, events]) => {
      const sorted = [...events].sort((a, b) => toDateMs(a.timestamp) - toDateMs(b.timestamp));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const startedAt = first?.timestamp || "";
      const completedAt = last?.timestamp || startedAt;
      const durationMs = Math.max(0, toDateMs(completedAt) - toDateMs(startedAt));
      const contextTokens = sorted.reduce((sum, event) => sum + toNumber(event.metrics?.tokens_in), 0);
      const usefulTokens = sorted.reduce((sum, event) => sum + toNumber(event.metrics?.tokens_out), 0);
      const tokensUsed = contextTokens + usefulTokens;
      const cycleErrors = errorsByCycle.get(taskId) || [];
      const errorsCount = cycleErrors.length + sorted.filter((event) => Boolean(event.error)).length;
      const risksCount = cycleErrors.length;
      const mcpUsedFromEvents = uniqueStrings(sorted.flatMap((event) => event.mcp_tools || [])).map((name) => ({
        name,
        status: "успешно",
      }));
      const mcpUsed = mcpUsedFromEvents.length > 0 ? mcpUsedFromEvents : mcpUsedFromAgent;
      const fileTrace = buildSessionFileTrace(sorted);
      const operativeMemory = buildSessionOperativeMemory(fileTrace, agent);
      const traceQuality = buildTraceQuality(sorted, fileTrace);
      const startedSteps = new Set(sorted.filter((event) => (event.status || "").toLowerCase() === "started").map((event) => event.step || "step"));
      const tasksTotal = Math.max(1, startedSteps.size);

      return {
        id: taskId,
        source: "telemetry" as const,
        startedAt,
        completedAt,
        durationMs,
        tokensUsed,
        tasksTotal,
        errorsCount,
        risksCount,
        fileTrace,
        fileLog: buildFileLog(sorted),
        searchProcess: buildSearchProcess(sorted, errorsCount),
        actionLog: sorted.map((event, index) => ({
          id: event.event_id || `${taskId}-event-${index + 1}`,
          tool: inferActionTool(event),
          crudAction: inferActionCrudAction(event),
          title: `${humanizeStep(event.step || "step")} (${event.status || "unknown"})`,
          status: inferActionStatus(event),
          durationMs: null,
          input: buildActionInput(event),
          output: buildActionOutput(event),
          timestamp: formatLocalTime(event.timestamp, true),
        })),
        efficiency: {
          contextTokens,
          usefulTokens,
          cacheHitRate: agent.memoryContext?.economics?.cache_hit_rate ?? null,
          traceQuality,
        },
        operativeMemory,
        persistentMemory,
        mcpUsed,
        toolsUsed: buildToolsUsed(sorted),
        targetMetrics: {
          verification_pass_rate: cycle.metrics.verification_pass_rate,
          lesson_capture_rate: cycle.metrics.lesson_capture_rate,
          review_error_rate: cycle.metrics.review_error_rate,
          recommendation_action_rate: cycle.metrics.recommendation_action_rate,
        },
        controlExcalidrawUrl: null,
        controlTaskListUrl: `#/tasks?session_id=${encodeURIComponent(taskId)}`,
        flowSchema: buildSessionFlowSchema(sorted, taskId, startedAt, agent),
      };
    })
    .sort((a, b) => toDateMs(b.completedAt) - toDateMs(a.completedAt));

  if (sessions.length > 0) return sessions;

  if (!cycle.latest_cycle) return [];
  const fallbackStartedAt = cycle.latest_cycle.first_event_at || "";
  const fallbackCompletedAt = cycle.latest_cycle.last_event_at || fallbackStartedAt;
  const fallbackDurationMs = Math.max(0, toDateMs(fallbackCompletedAt) - toDateMs(fallbackStartedAt));
  const fallbackTokensIn = cycle.timeline.reduce(
    (sum, event) => sum + toNumber(event.tokens_in) + toNumber(event.tokens_out),
    0,
  );
  const fallbackFlowEvents: TelemetryEvent[] = cycle.timeline.map((event) => ({
    timestamp: event.timestamp || undefined,
    step: event.step,
    step_raw: event.step_raw || event.step,
    status: event.status,
    outcome: event.outcome,
    artifacts_read: event.artifacts_read,
    artifacts_written: event.artifacts_written,
    artifact_operations: event.artifact_operations,
    artifact_contract_version: event.artifact_contract_version || undefined,
    artifact_ops_origin: event.artifact_ops_origin || undefined,
    metrics: {
      tokens_in: toNumber(event.tokens_in),
      tokens_out: toNumber(event.tokens_out),
    },
  }));
  const fallbackFileTrace = buildSessionFileTrace(fallbackFlowEvents);
  const fallbackTraceQuality = buildTraceQuality(fallbackFlowEvents, fallbackFileTrace);
  return [
    {
      id: cycle.latest_cycle.task_id,
      source: "telemetry",
      startedAt: fallbackStartedAt,
      completedAt: fallbackCompletedAt,
      durationMs: fallbackDurationMs,
      tokensUsed: fallbackTokensIn,
      tasksTotal: 1,
      errorsCount: 0,
      risksCount: 0,
      fileTrace: fallbackFileTrace,
      fileLog: buildFileLog(fallbackFlowEvents),
      searchProcess: {
        approach: "Fallback: timeline latest cycle",
        steps: cycle.timeline.map((event) => `${humanizeStep(event.step)}: ${event.outcome}`),
        quality: `${cycle.timeline.length} событий`,
      },
      actionLog: cycle.timeline.map((event, index) => ({
        id: `${cycle.latest_cycle?.task_id}-fallback-${index + 1}`,
        tool: "Agent",
        crudAction: "" as const,
        title: `${humanizeStep(event.step)} (${event.status})`,
        status: event.status.includes("failed") ? "error" : "success",
        durationMs: null,
        input: `step: ${event.step}\nstatus: ${event.status}`,
        output: event.outcome || "не зафиксировано",
        timestamp: formatLocalTime(event.timestamp || undefined, true),
      })),
      efficiency: {
        contextTokens: 0,
        usefulTokens: 0,
        cacheHitRate: agent.memoryContext?.economics?.cache_hit_rate ?? null,
        traceQuality: fallbackTraceQuality,
      },
      operativeMemory: buildSessionOperativeMemory(fallbackFileTrace, agent),
      persistentMemory: buildPersistentMemory(agent),
      mcpUsed: mcpUsedFromAgent,
      toolsUsed: [],
      targetMetrics: {
        verification_pass_rate: cycle.metrics.verification_pass_rate,
        lesson_capture_rate: cycle.metrics.lesson_capture_rate,
        review_error_rate: cycle.metrics.review_error_rate,
        recommendation_action_rate: cycle.metrics.recommendation_action_rate,
      },
      controlExcalidrawUrl: null,
      controlTaskListUrl: `#/tasks?session_id=${encodeURIComponent(cycle.latest_cycle.task_id)}`,
      flowSchema: buildSessionFlowSchema(
        fallbackFlowEvents,
        cycle.latest_cycle.task_id,
        fallbackStartedAt,
        agent,
      ),
    },
  ];
}

export function getAnalystCardData(): AnalystCardData | null {
  const manifest = getAgentsManifest();
  const agent = manifest.agents.find((candidate) => candidate.id === "analyst-agent") ?? null;
  if (!agent) return null;

  const cycle = getAnalystLatestCycle();
  const rawLogs = getOapKbRawLogs();
  const telemetryDoc = rawLogs.find((doc) => doc.path === ".logs/agents/analyst-agent.jsonl");
  const errorDoc = rawLogs.find((doc) => doc.path === ".logs/agents/analyst-agent-errors.jsonl");
  const telemetryEvents = telemetryDoc ? parseJsonLines<TelemetryEvent>(telemetryDoc.content) : [];
  const errorEvents = errorDoc ? parseJsonLines<ErrorLogEvent>(errorDoc.content) : [];
  const sessions = buildSessions(agent, cycle);
  const errorEntries = buildErrorEntries(errorEvents, telemetryEvents);

  return {
    agent,
    cycle,
    sessions,
    efficiency: buildEfficiencySnapshot(sessions, errorEntries),
    keyMetrics: buildKeyMetricsSnapshot(agent),
    kbDocs: getOapKbIndex(),
  };
}
