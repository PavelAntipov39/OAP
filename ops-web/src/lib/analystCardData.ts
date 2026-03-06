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
  title: string;
  status: "success" | "error" | "running" | "skipped";
  durationMs: number | null;
  input: string;
  output: string;
  timestamp: string;
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
  fileLog: SessionFileLogEntry[];
  searchProcess: SessionSearchProcess;
  actionLog: SessionActionStep[];
  efficiency: {
    contextTokens: number;
    usefulTokens: number;
    cacheHitRate: number | null;
  };
  operativeMemory: Array<{ title: string; path: string }>;
  persistentMemory: Array<{ title: string; path: string }>;
  mcpUsed: Array<{ name: string; status: string }>;
  targetMetrics: Record<string, number | null>;
  controlExcalidrawUrl: string | null;
  controlTaskListUrl: string | null;
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
  status?: string;
  outcome?: string;
  recommendation_id?: string | null;
  artifacts_read?: string[];
  artifacts_written?: string[];
  mcp_tools?: string[];
  metrics?: Record<string, unknown>;
  error?: string | null;
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
    plan: "Планирование",
    health_check: "Health-check",
    knowledge_base_check: "Проверка базы знаний",
    external_monitor: "Внешний мониторинг",
    improvements_list: "Список улучшений",
    execute: "Внедрение",
    verify: "Верификация",
    learn: "Фиксация уроков",
    finalize: "Финализация",
  };
  return map[step] || step.replace(/_/g, " ");
}

function inferActionTool(event: TelemetryEvent): SessionActionStep["tool"] {
  const step = event.step || "";
  const reads = Array.isArray(event.artifacts_read) ? event.artifacts_read.length : 0;
  const writes = Array.isArray(event.artifacts_written) ? event.artifacts_written.length : 0;
  if (step === "external_monitor") return "WebSearch";
  if (step === "verify") return "Bash";
  if (step === "improvements_list") return "Agent";
  if (writes > 0 && reads > 0) return "Edit";
  if (writes > 0) return "Write";
  if (reads > 0) return "Read";
  return "Agent";
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
  if (Array.isArray(event.artifacts_read) && event.artifacts_read.length > 0) {
    lines.push(`read: ${event.artifacts_read.join(", ")}`);
  }
  if (Array.isArray(event.artifacts_written) && event.artifacts_written.length > 0) {
    lines.push(`write: ${event.artifacts_written.join(", ")}`);
  }
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
    files: uniqueStrings([...(event.artifacts_read || []), ...(event.artifacts_written || [])]),
    context: event.outcome || "не зафиксировано",
  }));
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

function buildOperativeMemory(agent: AgentSummary): Array<{ title: string; path: string }> {
  const anchors = agent.memoryContext?.contextAnchors || [];
  const values = anchors.map((anchor) => ({
    title: anchor.title || "Контекстный якорь",
    path: anchor.filePath,
  }));
  return values.length > 0 ? values : [{ title: "Операционный стандарт аналитика", path: "docs/subservices/oap/ANALYST_OPERATING_PLAN.md" }];
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
      artifactsInvolved: uniqueStrings([...(event.artifacts_read || []), ...(event.artifacts_written || [])]),
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

  const operativeMemory = buildOperativeMemory(agent);
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
        fileLog: buildFileLog(sorted),
        searchProcess: buildSearchProcess(sorted, errorsCount),
        actionLog: sorted.map((event, index) => ({
          id: event.event_id || `${taskId}-event-${index + 1}`,
          tool: inferActionTool(event),
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
        },
        operativeMemory,
        persistentMemory,
        mcpUsed,
        targetMetrics: {
          verification_pass_rate: cycle.metrics.verification_pass_rate,
          lesson_capture_rate: cycle.metrics.lesson_capture_rate,
          review_error_rate: cycle.metrics.review_error_rate,
          recommendation_action_rate: cycle.metrics.recommendation_action_rate,
        },
        controlExcalidrawUrl: null,
        controlTaskListUrl: `#/tasks?agent=analyst-agent&query=${encodeURIComponent(taskId)}`,
      };
    })
    .sort((a, b) => toDateMs(b.completedAt) - toDateMs(a.completedAt));

  if (sessions.length > 0) return sessions;

  if (!cycle.latest_cycle) return [];
  const fallbackStartedAt = cycle.latest_cycle.first_event_at || "";
  const fallbackCompletedAt = cycle.latest_cycle.last_event_at || fallbackStartedAt;
  const fallbackDurationMs = Math.max(0, toDateMs(fallbackCompletedAt) - toDateMs(fallbackStartedAt));
  const fallbackTokensIn = cycle.timeline.reduce((sum, _event) => sum, 0);
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
      fileLog: cycle.timeline.map((event) => ({
        time: formatLocalTime(event.timestamp || undefined, false),
        step: humanizeStep(event.step),
        files: uniqueStrings([...(event.artifacts_read || []), ...(event.artifacts_written || [])]),
        context: event.outcome || "не зафиксировано",
      })),
      searchProcess: {
        approach: "Fallback: timeline latest cycle",
        steps: cycle.timeline.map((event) => `${humanizeStep(event.step)}: ${event.outcome}`),
        quality: `${cycle.timeline.length} событий`,
      },
      actionLog: cycle.timeline.map((event, index) => ({
        id: `${cycle.latest_cycle?.task_id}-fallback-${index + 1}`,
        tool: "Agent",
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
      },
      operativeMemory: buildOperativeMemory(agent),
      persistentMemory: buildPersistentMemory(agent),
      mcpUsed: mcpUsedFromAgent,
      targetMetrics: {
        verification_pass_rate: cycle.metrics.verification_pass_rate,
        lesson_capture_rate: cycle.metrics.lesson_capture_rate,
        review_error_rate: cycle.metrics.review_error_rate,
        recommendation_action_rate: cycle.metrics.recommendation_action_rate,
      },
      controlExcalidrawUrl: null,
      controlTaskListUrl: "#/tasks?agent=analyst-agent",
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
