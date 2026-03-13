import React from "react";
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Box,
  Chip,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  LinearProgress,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowDownwardRoundedIcon from "@mui/icons-material/ArrowDownwardRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";

import type { AgentSummary } from "../../lib/generatedData";
import { getAnalystCardData, type AnalystErrorEntry, type AnalystSession, type SessionFileOperation } from "../../lib/analystCardData";
import { getAgentTasks, type AgentTaskRow } from "../../lib/tasksApi";
import {
  getBpmnManifest,
  getAgentBenchmarkSummary,
  getAgentImprovementHistoryByAgent,
  getAgentTelemetrySummaryByAgent,
  getOapKbIndex,
  getOapKbRawLogs,
  getDocsIndex,
  type BpmnDiagram,
  type AgentBenchmarkSummary,
  type AgentTelemetrySummaryAgent,
  type AgentImprovementHistoryEvent,
  type OapKbDocument,
  type DocsDocument,
} from "../../lib/generatedData";
import { TextContentModal } from "../TextContentModal";
import { TaskDetailsDrawer } from "../tasks/TaskDetailsDrawer";
import { SectionBlock } from "./SectionBlock";
import { SkillToolMcpTooltip } from "../skill-tooltip/SkillToolMcpTooltip";
import type { AgentTabKey } from "../../lib/agentsRouteState";

import { HeaderSection } from "./sections/HeaderSection";
import { AgentProcessSection } from "./sections/AgentProcessSection";
import { SkillsSection } from "./sections/SkillsSection";
import { MemorySection } from "./sections/MemorySection";
import { RisksSection } from "./sections/RisksSection";
import { SessionDetailsDrawer } from "../sessionDrawer/SessionDetailsDrawer";
import { ImprovementHistoryModal } from "./modals/ImprovementHistoryModal";
import { LessonsDrawer } from "./modals/LessonsDrawer";

type ModalState = {
  open: boolean;
  title: string;
  content: string;
  path: string | null;
  updatedAt: string | null;
};

const EMPTY_MODAL: ModalState = { open: false, title: "", content: "", path: null, updatedAt: null };
const AGENT_LOG_PATH = ".logs/agents/analyst-agent.jsonl";
const DEFAULT_LESSONS_PATH = "docs/subservices/oap/tasks/lessons/analyst-agent.md";
const GLOBAL_LESSONS_PATH = "docs/subservices/oap/tasks/lessons.global.md";
const PRODUCT_DESIGNER_AGENT_ID = "designer-agent";
const ORCHESTRATOR_AGENT_ID = "orchestrator-agent";
const ANALYST_FLOW_HASH = "#/agent-flow";
const DESIGNER_OPERATING_PLAN_PATH = "docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md";
const ORCHESTRATOR_OPERATING_PLAN_PATH = "docs/subservices/oap/agents/orchestrator-agent/OPERATING_PLAN.md";
const DESIGNER_RULES_PATH = "docs/subservices/oap/DESIGN_RULES.md";
const LEGACY_SKILL_TO_TOOL: Record<string, string> = {
  "qmd-memory-retrieval": "QMD retrieval",
};
const HOST_ADAPTER_SYNC_LABELS: Record<string, string> = {
  synced: "синхронизированы",
  partial: "частично синхронизированы",
  missing: "не подключены",
  archived: "архив",
};

type AgentLogEvent = {
  id: string;
  line: number;
  timestamp: string;
  step: string;
  status: string;
  taskId: string;
  runId: string;
  traceId: string;
  recommendationId: string;
  outcome: string;
  process: string;
  mcpTools: string[];
  tools: string[];
  skills: string[];
  artifactsRead: string[];
  artifactsWritten: string[];
  tokensIn: number | null;
  tokensOut: number | null;
  error: string | null;
};

type ParsedAgentLog = {
  events: AgentLogEvent[];
  invalidLines: number;
  totalLines: number;
};

type MemoryLinkEntry = {
  title: string;
  path: string;
  status?: "read" | "write";
  lastReadAt?: string | null;
  lastWriteAt?: string | null;
  lastTouchedAt?: string | null;
  sourceStep?: string;
  sourceKind?: string;
  semanticLayer?: string;
  reason?: string;
  label?: string;
};

type OpenableDoc = {
  title: string;
  path: string;
  content: string;
  updatedAt: string;
};

type MetricDefinition = {
  key: string;
  label: string;
  valueLabel: string;
  description: string;
  formula: string;
  source: string;
  example: string;
  badgeLabel?: string;
  onClick?: () => void;
};

type MetricScope = "common" | "agent";
type MetricZone = "main" | "extra";
type MetricsCatalogFilterScope = "all" | MetricScope;

type MetricCatalogMeta = {
  scope: MetricScope;
  agentIds: string[];
  defaultZone: MetricZone;
  impact: string;
  badgeLabel?: string;
};

type MetricCatalogItem = MetricDefinition & {
  metricId: string;
  scope: MetricScope;
  agentIds: string[];
  defaultZone: MetricZone;
  impact: string;
  hasData: boolean;
};

type AgentMetricPreferences = {
  agentId: string;
  viewerId: string;
  mainMetricIds: string[];
  extraMetricIds: string[];
  updatedAt: string | null;
};

type MetricSelectionDraft = {
  mainMetricIds: string[];
  extraMetricIds: string[];
};

const VIEWER_ID_STORAGE_KEY = "oap_viewer_id";
const METRIC_PREFERENCES_CACHE_PREFIX = "oap_metric_preferences_v1";
const METRIC_CATALOG_MAIN_LIMIT = 6;
const DATA_STATUS_CONNECTED = "есть данные";
const DATA_STATUS_NOT_CONNECTED = "не подключено";
const KEY_METRIC_BADGE_LABEL = "Ключевая";
const ANALYST_DEFAULT_MAIN_METRIC_IDS = [
  "avg_tokens_per_cycle",
  "avg_errors_per_cycle",
  "avg_tasks_created_per_cycle",
  "tasks_from_agent",
  "avg_target_metric_growth_pp",
  "confirmed_effect_share",
] as const;

const METRIC_CATALOG_META: Record<string, MetricCatalogMeta> = {
  avg_tokens_per_cycle: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "main",
    impact: "Показывает среднюю цену одного рабочего цикла аналитика по токенам.",
  },
  avg_errors_per_cycle: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "main",
    impact: "Показывает, сколько сбоев и возвратов в среднем возникает в одном цикле.",
  },
  avg_tasks_created_per_cycle: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "main",
    impact: "Показывает, сколько новых задач аналитик стабильно поставляет за один цикл.",
  },
  tasks_from_agent: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "main",
    impact: "Показывает объем управленческих инициатив, которые аналитик запустил в работу.",
    badgeLabel: KEY_METRIC_BADGE_LABEL,
  },
  avg_target_metric_growth_pp: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "main",
    impact: "Показывает ожидаемый бизнес-сдвиг по целевым метрикам других агентов.",
    badgeLabel: KEY_METRIC_BADGE_LABEL,
  },
  confirmed_effect_share: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "main",
    impact: "Показывает, какая доля внедрений реально дала подтвержденный результат.",
    badgeLabel: KEY_METRIC_BADGE_LABEL,
  },
  documented_relevance_share: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Показывает, насколько рекомендации подтверждены актуальными данными.",
    badgeLabel: KEY_METRIC_BADGE_LABEL,
  },
  verification_pass_rate: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на число повторных проверок и на стабильность закрытия цикла.",
  },
  lesson_capture_rate: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на скорость обучения агента и на снижение повторяемых ошибок.",
  },
  review_error_rate: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на объем доработок после проверки и на стоимость цикла в токенах.",
  },
  recommendation_action_rate: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на практическую полезность рекомендаций и бизнес-результат.",
  },
  recommendation_executability_rate: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на скорость запуска действий без дополнительных уточнений.",
  },
  evidence_link_coverage: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на проверяемость рекомендаций и на доверие к выводам.",
  },
  time_to_action_p50: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на скорость перехода от рекомендации к внедрению.",
  },
  pass_at_5: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Показывает стабильность результата в повторных benchmark-прогонах.",
  },
  fact_coverage_mean: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на полноту ответа и снижение пропущенных фактов в выводах.",
  },
  schema_valid_rate: {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на долю ответов, которые можно использовать без ручной правки структуры.",
  },
  tasks_in_work: {
    scope: "common",
    agentIds: [],
    defaultZone: "extra",
    impact: "Показывает текущую операционную нагрузку агента.",
  },
  tasks_on_control: {
    scope: "common",
    agentIds: [],
    defaultZone: "extra",
    impact: "Показывает объем задач, где нужен контроль и подтверждение результата.",
  },
  tasks_overdue: {
    scope: "common",
    agentIds: [],
    defaultZone: "extra",
    impact: "Показывает риск срыва сроков и накопления долга в работе агента.",
  },
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && typeof (item as { path?: unknown }).path === "string") {
        return String((item as { path?: string }).path || "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

function toArtifactPaths(value: unknown): string[] {
  return toStringArray(value);
}

type ArtifactPathRef = {
  path: string;
  sourceKind?: string;
  semanticLayer?: string;
  reason?: string;
  label?: string;
};

function toArtifactRefs(value: unknown): ArtifactPathRef[] {
  if (!Array.isArray(value)) return [];
  const refs: ArtifactPathRef[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const path = item.trim();
      if (!path) continue;
      refs.push({ path });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const path = asString((item as { path?: unknown }).path);
    if (!path) continue;
    refs.push({
      path,
      sourceKind: asString((item as { source_kind?: unknown }).source_kind) || undefined,
      semanticLayer: asString((item as { semantic_layer?: unknown }).semantic_layer) || undefined,
      reason: asString((item as { reason?: unknown }).reason) || undefined,
      label: asString((item as { label?: unknown }).label) || undefined,
    });
  }
  return refs;
}

function normalizeFileTraceOperation(value: unknown): SessionFileOperation["op"] | null {
  const op = asString(value).toLowerCase();
  if (!op) return null;
  if (op === "read") return "read";
  if (op === "write" || op === "create" || op === "update") return "write";
  if (op === "delete" || op === "remove" || op === "removed" || op === "unlink" || op === "drop" || op === "rm") {
    return "delete";
  }
  return null;
}

function normalizeRawFileTraceOperation(value: unknown): SessionFileOperation["rawOp"] {
  const op = asString(value).toLowerCase();
  if (!op) return null;
  if (op === "read") return "read";
  if (op === "write") return "write";
  if (op === "create") return "create";
  if (op === "update") return "update";
  if (op === "delete" || op === "remove" || op === "removed" || op === "unlink" || op === "drop" || op === "rm") {
    return "delete";
  }
  return null;
}

function normalizeTelemetryTaxonomy(rawTools: unknown, rawSkills: unknown): { tools: string[]; skills: string[] } {
  const toolsSeen = new Set<string>();
  const skillsSeen = new Set<string>();
  const tools: string[] = [];
  const skills: string[] = [];

  for (const raw of toStringArray(rawTools)) {
    const key = raw.toLowerCase();
    if (toolsSeen.has(key)) continue;
    toolsSeen.add(key);
    tools.push(raw);
  }

  for (const raw of toStringArray(rawSkills)) {
    const key = raw.toLowerCase();
    const mappedTool = LEGACY_SKILL_TO_TOOL[key];
    if (mappedTool) {
      const mappedKey = mappedTool.toLowerCase();
      if (!toolsSeen.has(mappedKey)) {
        toolsSeen.add(mappedKey);
        tools.push(mappedTool);
      }
      continue;
    }
    if (skillsSeen.has(key)) continue;
    skillsSeen.add(key);
    skills.push(raw);
  }

  return { tools, skills };
}

function asFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatDateTime(value: string): string {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "—";
  return ts.toLocaleString("ru-RU");
}

function formatDateTimeLong(value: string): string {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "—";
  return ts.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ч ${m}мин`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPercentValue(value: number | null, digits = 1): string {
  if (value == null) return "не зафиксировано";
  return `${value.toFixed(digits)}%`;
}

function formatPpValue(value: number | null, digits = 1): string {
  if (value == null) return "не зафиксировано";
  return `${value.toFixed(digits)} п.п.`;
}

function formatAverageCount(value: number | null, digits = 1): string {
  if (value == null) return "не зафиксировано";
  return value.toFixed(digits);
}

function formatHoursValue(value: number | null, digits = 1): string {
  if (value == null) return "не зафиксировано";
  return `${value.toFixed(digits)} ч`;
}

function formatTelemetryCostValue(value: number | null, unit: string | null | undefined): string {
  if (value == null) return "не зафиксировано";
  if (unit === "usd") return `$${value.toFixed(3)}`;
  if (unit === "token_proxy") return `${value.toFixed(2)} токенов (proxy)`;
  return `${value.toFixed(2)}${unit ? ` ${unit}` : ""}`;
}

function formatHostAdapterSyncValue(value: string | null | undefined): string {
  if (!value) return "не зафиксировано";
  return HOST_ADAPTER_SYNC_LABELS[value] || value;
}

function toDateMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uniqueStringsOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function toStringArrayStrict(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStringsOrdered(
    value
      .map((item) => (typeof item === "string" ? item : ""))
      .filter(Boolean),
  );
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getMetricCatalogMeta(metricId: string): MetricCatalogMeta {
  return METRIC_CATALOG_META[metricId] || {
    scope: "agent",
    agentIds: ["analyst-agent"],
    defaultZone: "extra",
    impact: "Влияет на итоговую эффективность агента по качеству, скорости и стабильности работы.",
    badgeLabel: undefined,
  };
}

function metricHasConnectedData(metric: MetricDefinition): boolean {
  const normalized = metric.valueLabel.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("загружа")) return false;
  if (normalized.includes("не зафиксировано")) return false;
  return true;
}

function buildMetricCatalog(metrics: MetricDefinition[], agentId: string | null): MetricCatalogItem[] {
  const seen = new Set<string>();
  const catalog: MetricCatalogItem[] = [];
  for (const metric of metrics) {
    if (seen.has(metric.key)) continue;
    seen.add(metric.key);
    const meta = getMetricCatalogMeta(metric.key);
    const allowedForAgent =
      meta.agentIds.length === 0 ||
      (agentId ? meta.agentIds.includes(agentId) : false);
    if (!allowedForAgent) continue;
    catalog.push({
      ...metric,
      metricId: metric.key,
      scope: meta.scope,
      agentIds: meta.agentIds,
      defaultZone: meta.defaultZone,
      impact: meta.impact,
      badgeLabel: metric.badgeLabel ?? meta.badgeLabel,
      hasData: metricHasConnectedData(metric),
    });
  }
  return catalog;
}

function resolveMetricZoneIds({
  catalog,
  preferences,
  defaultMainMetricIds,
  defaultExtraMetricIds,
}: {
  catalog: MetricCatalogItem[];
  preferences: AgentMetricPreferences | null;
  defaultMainMetricIds: string[];
  defaultExtraMetricIds: string[];
}): { mainMetricIds: string[]; extraMetricIds: string[] } {
  const knownMetricIds = new Set(catalog.map((item) => item.metricId));
  const sanitize = (ids: string[]) => uniqueStringsOrdered(ids.filter((id) => knownMetricIds.has(id)));

  const fallbackMain = sanitize(defaultMainMetricIds).slice(0, METRIC_CATALOG_MAIN_LIMIT);
  const fallbackExtra = sanitize(defaultExtraMetricIds).filter((id) => !fallbackMain.includes(id));

  if (!preferences) {
    return { mainMetricIds: fallbackMain, extraMetricIds: fallbackExtra };
  }

  const requestedMain = toStringArrayStrict(preferences.mainMetricIds);
  const requestedExtra = toStringArrayStrict(preferences.extraMetricIds);

  const resolvedMainFromPrefs = sanitize(requestedMain).slice(0, METRIC_CATALOG_MAIN_LIMIT);
  const resolvedMain = resolvedMainFromPrefs.length > 0 || requestedMain.length === 0 ? resolvedMainFromPrefs : fallbackMain;

  const resolvedExtraFromPrefs = sanitize(requestedExtra).filter((id) => !resolvedMain.includes(id));
  const resolvedExtra =
    resolvedExtraFromPrefs.length > 0 || requestedExtra.length === 0
      ? resolvedExtraFromPrefs
      : fallbackExtra.filter((id) => !resolvedMain.includes(id));

  return {
    mainMetricIds: resolvedMain,
    extraMetricIds: resolvedExtra,
  };
}

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function generateViewerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `viewer_${crypto.randomUUID()}`;
  }
  const random = Math.random().toString(36).slice(2, 12);
  return `viewer_${Date.now().toString(36)}_${random}`;
}

function getOrCreateViewerId(): string | null {
  const storage = safeLocalStorage();
  if (!storage) return null;

  const existing = storage.getItem(VIEWER_ID_STORAGE_KEY);
  if (existing && existing.trim().length > 0) return existing.trim();

  const viewerId = generateViewerId();
  try {
    storage.setItem(VIEWER_ID_STORAGE_KEY, viewerId);
  } catch {
    return viewerId;
  }
  return viewerId;
}

function metricPreferencesCacheKey(agentId: string, viewerId: string): string {
  return `${METRIC_PREFERENCES_CACHE_PREFIX}:${agentId}:${viewerId}`;
}

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

type RpcErrorPayload = {
  message?: string;
  error?: string;
  hint?: string;
  details?: string;
};

async function metricPreferencesRpcCall<T>(fn: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
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

function normalizeAgentMetricPreferences(
  payload: unknown,
  agentId: string,
  viewerId: string,
): AgentMetricPreferences | null {
  const row = (() => {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        const candidate = toRecord(item);
        if (candidate) return candidate;
      }
      return null;
    }
    return toRecord(payload);
  })();
  if (!row) return null;

  const resolvedAgentId = asString(row.agent_id) || agentId;
  const resolvedViewerId = asString(row.viewer_id) || viewerId;
  return {
    agentId: resolvedAgentId,
    viewerId: resolvedViewerId,
    mainMetricIds: toStringArrayStrict(row.main_metric_ids),
    extraMetricIds: toStringArrayStrict(row.extra_metric_ids),
    updatedAt: asString(row.updated_at) || null,
  };
}

function readCachedMetricPreferences(agentId: string, viewerId: string): AgentMetricPreferences | null {
  const storage = safeLocalStorage();
  if (!storage) return null;
  const raw = storage.getItem(metricPreferencesCacheKey(agentId, viewerId));
  if (!raw) return null;
  try {
    return normalizeAgentMetricPreferences(JSON.parse(raw), agentId, viewerId);
  } catch {
    return null;
  }
}

function writeCachedMetricPreferences(preferences: AgentMetricPreferences): void {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(
      metricPreferencesCacheKey(preferences.agentId, preferences.viewerId),
      JSON.stringify({
        agent_id: preferences.agentId,
        viewer_id: preferences.viewerId,
        main_metric_ids: preferences.mainMetricIds,
        extra_metric_ids: preferences.extraMetricIds,
        updated_at: preferences.updatedAt,
      }),
    );
  } catch {
    // ignore local storage write errors
  }
}

function isActiveSelfImprovementTask(task: AgentTaskRow): boolean {
  const status = (task.status || "").toLowerCase();
  return task.origin_type === "improvement" && status !== "done" && status !== "completed";
}

function uniqueTasksById(tasks: AgentTaskRow[]): AgentTaskRow[] {
  const seen = new Set<string>();
  const ordered: AgentTaskRow[] = [];
  for (const task of tasks) {
    if (!task.id || seen.has(task.id)) continue;
    seen.add(task.id);
    ordered.push(task);
  }
  return ordered;
}

function normalizePath(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

function buildPathLookupKeys(path: string): string[] {
  const raw = String(path || "").trim().replace(/\\/g, "/");
  const keys = new Set<string>();
  const add = (value: string) => {
    const normalized = normalizePath(value);
    if (normalized) keys.add(normalized);
  };

  add(raw);
  const [withoutFragment] = raw.split("#");
  add(withoutFragment);
  const [withoutQuery] = withoutFragment.split("?");
  add(withoutQuery);

  const repoMarker = "/Downloads/VS Code/ОАП/";
  const repoIdx = raw.indexOf(repoMarker);
  if (repoIdx !== -1) {
    const repoRelative = raw.slice(repoIdx + repoMarker.length);
    add(repoRelative);
    const [repoWithoutFragment] = repoRelative.split("#");
    add(repoWithoutFragment);
    const [repoWithoutQuery] = repoWithoutFragment.split("?");
    add(repoWithoutQuery);
  }

  const codexMarker = "/.codex/";
  const codexIdx = raw.indexOf(codexMarker);
  if (codexIdx !== -1) {
    const dotCodex = raw.slice(codexIdx + 1);
    add(dotCodex);
    add(dotCodex.replace(/^\./, ""));
    const [codexWithoutFragment] = dotCodex.split("#");
    add(codexWithoutFragment);
    add(codexWithoutFragment.replace(/^\./, ""));
    const [codexWithoutQuery] = codexWithoutFragment.split("?");
    add(codexWithoutQuery);
    add(codexWithoutQuery.replace(/^\./, ""));
  }

  return Array.from(keys);
}

function pickLatestTimestamp(first?: string | null, second?: string | null): string | null {
  const a = asString(first);
  const b = asString(second);
  if (!a) return b || null;
  if (!b) return a;
  const aTs = Date.parse(a);
  const bTs = Date.parse(b);
  if (!Number.isFinite(aTs)) return b;
  if (!Number.isFinite(bTs)) return a;
  return bTs >= aTs ? b : a;
}

function resolveTouchedAt(entry: MemoryLinkEntry): string | null {
  return (
    pickLatestTimestamp(entry.lastTouchedAt, entry.lastWriteAt) ??
    pickLatestTimestamp(entry.lastTouchedAt, entry.lastReadAt) ??
    entry.lastTouchedAt ??
    entry.lastWriteAt ??
    entry.lastReadAt ??
    null
  );
}

function uniqueMemoryEntries(entries: MemoryLinkEntry[]): MemoryLinkEntry[] {
  const indexByPath = new Map<string, number>();
  const ordered: MemoryLinkEntry[] = [];
  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (!path) continue;
    const existingIndex = indexByPath.get(path);
    if (existingIndex == null) {
      ordered.push({
        ...entry,
        path,
        lastReadAt: entry.lastReadAt ?? null,
        lastWriteAt: entry.lastWriteAt ?? null,
        lastTouchedAt: resolveTouchedAt(entry),
      });
      indexByPath.set(path, ordered.length - 1);
      continue;
    }

    const current = ordered[existingIndex];
    const mergedStatus = current.status === "write" || entry.status === "write" ? "write" : current.status ?? entry.status;
    const mergedLastReadAt = pickLatestTimestamp(current.lastReadAt, entry.lastReadAt);
    const mergedLastWriteAt = pickLatestTimestamp(current.lastWriteAt, entry.lastWriteAt);
    const mergedLastTouchedAt = pickLatestTimestamp(
      resolveTouchedAt({ ...current, lastReadAt: mergedLastReadAt, lastWriteAt: mergedLastWriteAt }),
      resolveTouchedAt(entry),
    );

    ordered[existingIndex] = {
      ...current,
      ...entry,
      path,
      title: entry.title || current.title,
      status: mergedStatus,
      lastReadAt: mergedLastReadAt,
      lastWriteAt: mergedLastWriteAt,
      lastTouchedAt: mergedLastTouchedAt,
      sourceStep: entry.sourceStep || current.sourceStep,
      sourceKind: entry.sourceKind || current.sourceKind,
      semanticLayer: entry.semanticLayer || current.semanticLayer,
      reason: entry.reason || current.reason,
      label: entry.label || current.label,
    };
  }
  return ordered;
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s.,:;!?'"`()[\]{}\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAgentLog(content: string): ParsedAgentLog {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const events: AgentLogEvent[] = [];
  let invalidLines = 0;

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const metrics = parsed.metrics && typeof parsed.metrics === "object" ? (parsed.metrics as Record<string, unknown>) : null;
      const taxonomy = normalizeTelemetryTaxonomy(parsed.tools, parsed.skills);
      events.push({
        id: asString(parsed.event_id) || `${index + 1}`,
        line: index + 1,
        timestamp: asString(parsed.timestamp),
        step: asString(parsed.step),
        status: asString(parsed.status),
        taskId: asString(parsed.task_id),
        runId: asString(parsed.run_id),
        traceId: asString(parsed.trace_id),
        recommendationId: asString(parsed.recommendation_id),
        outcome: asString(parsed.outcome),
        process: asString(parsed.process),
        mcpTools: toStringArray(parsed.mcp_tools),
        tools: taxonomy.tools,
        skills: taxonomy.skills,
        artifactsRead: toStringArray(parsed.artifacts_read),
        artifactsWritten: toStringArray(parsed.artifacts_written),
        tokensIn: asFiniteNumber(metrics?.tokens_in),
        tokensOut: asFiniteNumber(metrics?.tokens_out),
        error: asString(parsed.error) || null,
      });
    } catch {
      invalidLines += 1;
    }
  });

  events.sort((a, b) => {
    const aTs = Date.parse(a.timestamp);
    const bTs = Date.parse(b.timestamp);
    if (Number.isFinite(aTs) && Number.isFinite(bTs)) return bTs - aTs;
    if (Number.isFinite(aTs)) return -1;
    if (Number.isFinite(bTs)) return 1;
    return b.line - a.line;
  });

  return { events, invalidLines, totalLines: lines.length };
}

function uniqueOrdered(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const raw of values) {
    const value = asString(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function statusMeta(status: string): { color: "success" | "warning" | "error" | "default"; icon: React.ReactNode } {
  const normalized = asString(status).toLowerCase();
  if (normalized === "completed" || normalized.includes("pass")) {
    return { color: "success", icon: <CheckCircleOutlineIcon sx={{ fontSize: 16 }} /> };
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    return { color: "error", icon: <ErrorOutlineIcon sx={{ fontSize: 16 }} /> };
  }
  if (normalized.includes("start") || normalized.includes("running")) {
    return { color: "warning", icon: <HourglassEmptyIcon sx={{ fontSize: 16 }} /> };
  }
  return { color: "default", icon: <RadioButtonUncheckedIcon sx={{ fontSize: 14 }} /> };
}

function AgentLogSummaryCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.1, minWidth: 150, flex: "1 1 160px" }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {title}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.15 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.15 }}>
        {note}
      </Typography>
    </Paper>
  );
}

function AgentLogMetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.1, minWidth: 150, flex: "1 1 170px" }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {title}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25, lineHeight: 1.45 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function MetricTooltip({ metric }: { metric: MetricDefinition }) {
  return (
    <Tooltip
      arrow
      placement="top"
      title={(
        <Stack spacing={0.4} sx={{ maxWidth: 360 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "common.white" }}>
            Как считается
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "common.white" }}>
            {metric.label}
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.300" }}>
            {metric.description}
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.300" }}>
            Формула: {metric.formula}
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.300" }}>
            Источник: {metric.source}
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.300" }}>
            Пример: {metric.example}
          </Typography>
        </Stack>
      )}
    >
      <IconButton size="small" aria-label={`Как считается метрика ${metric.key}`} sx={{ p: 0.25 }}>
        <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.disabled", cursor: "help" }} />
      </IconButton>
    </Tooltip>
  );
}

function AnalystMetricRow({ metric }: { metric: MetricDefinition }) {
  const valueNode = metric.onClick ? (
    <Link
      component="button"
      type="button"
      underline="always"
      onClick={metric.onClick}
      sx={{ fontWeight: 700, color: "primary.main", textAlign: "right" }}
    >
      {metric.valueLabel}
    </Link>
  ) : (
    <Typography variant="body2" sx={{ fontWeight: 700, textAlign: "right" }}>
      {metric.valueLabel}
    </Typography>
  );

  return (
    <Paper variant="outlined" sx={{ p: 1.2 }}>
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 0.4 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
              {metric.label}
            </Typography>
            {metric.badgeLabel ? (
              <Chip size="small" variant="outlined" color="primary" label={metric.badgeLabel} />
            ) : null}
            <MetricTooltip metric={metric} />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.45 }}>
            {metric.description}
          </Typography>
        </Box>
        <Box sx={{ minWidth: 120 }}>
          {valueNode}
        </Box>
      </Stack>
    </Paper>
  );
}

function MetricsDialog({
  open,
  title,
  subtitle,
  metrics,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  metrics: MetricDefinition[];
  actions?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle sx={{ pb: 1.2 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {subtitle}
            </Typography>
            {actions ? (
              <Box sx={{ mt: 1 }}>
                {actions}
              </Box>
            ) : null}
          </Box>
          <IconButton onClick={onClose} aria-label={`Закрыть: ${title}`}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 2 }}>
        <Stack spacing={1}>
          {metrics.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Дополнительные метрики пока не зафиксированы.
              </Typography>
            </Paper>
          ) : metrics.map((metric) => (
            <AnalystMetricRow key={metric.key} metric={metric} />
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function MetricsCatalogDialog({
  open,
  catalog,
  draft,
  onChangeDraft,
  onResetDefaults,
  onSave,
  onClose,
  isLoading,
  isSaving,
  notice,
  agentName,
  isCustomizable,
}: {
  open: boolean;
  catalog: MetricCatalogItem[];
  draft: MetricSelectionDraft;
  onChangeDraft: (nextDraft: MetricSelectionDraft) => void;
  onResetDefaults: () => void;
  onSave: () => void;
  onClose: () => void;
  isLoading: boolean;
  isSaving: boolean;
  notice: string | null;
  agentName: string;
  isCustomizable: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [scopeFilter, setScopeFilter] = React.useState<MetricsCatalogFilterScope>("all");
  const [limitWarning, setLimitWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setScopeFilter("all");
      setLimitWarning(null);
    }
  }, [open]);

  const catalogMap = React.useMemo(() => {
    const map = new Map<string, MetricCatalogItem>();
    for (const item of catalog) map.set(item.metricId, item);
    return map;
  }, [catalog]);

  const selectionStateByMetricId = React.useMemo(() => {
    const map = new Map<string, MetricZone | "none">();
    for (const metricId of draft.mainMetricIds) map.set(metricId, "main");
    for (const metricId of draft.extraMetricIds) {
      if (!map.has(metricId)) map.set(metricId, "extra");
    }
    return map;
  }, [draft.extraMetricIds, draft.mainMetricIds]);

  const filteredCatalog = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return catalog.filter((item) => {
      if (scopeFilter !== "all" && item.scope !== scopeFilter) return false;
      if (!normalizedQuery) return true;
      const haystack = `${item.label} ${item.description} ${item.impact}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [catalog, query, scopeFilter]);

  const removeMetric = React.useCallback((metricId: string) => {
    onChangeDraft({
      mainMetricIds: draft.mainMetricIds.filter((id) => id !== metricId),
      extraMetricIds: draft.extraMetricIds.filter((id) => id !== metricId),
    });
  }, [draft.extraMetricIds, draft.mainMetricIds, onChangeDraft]);

  const addToMain = React.useCallback((metricId: string) => {
    const alreadyInMain = draft.mainMetricIds.includes(metricId);
    if (alreadyInMain) return;
    if (draft.mainMetricIds.length >= METRIC_CATALOG_MAIN_LIMIT) {
      setLimitWarning(`В блоке «Анализ эффективности агента» можно держать максимум ${METRIC_CATALOG_MAIN_LIMIT} метрик.`);
      return;
    }
    setLimitWarning(null);
    onChangeDraft({
      mainMetricIds: [...draft.mainMetricIds, metricId],
      extraMetricIds: draft.extraMetricIds.filter((id) => id !== metricId),
    });
  }, [draft.extraMetricIds, draft.mainMetricIds, onChangeDraft]);

  const addToExtra = React.useCallback((metricId: string) => {
    if (draft.extraMetricIds.includes(metricId)) return;
    setLimitWarning(null);
    onChangeDraft({
      mainMetricIds: draft.mainMetricIds.filter((id) => id !== metricId),
      extraMetricIds: [...draft.extraMetricIds, metricId],
    });
  }, [draft.extraMetricIds, draft.mainMetricIds, onChangeDraft]);

  const moveInZone = React.useCallback((zone: MetricZone, metricId: string, direction: "up" | "down") => {
    const source = zone === "main" ? draft.mainMetricIds : draft.extraMetricIds;
    const index = source.indexOf(metricId);
    if (index < 0) return;
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= source.length) return;
    const reordered = [...source];
    const [current] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, current);
    onChangeDraft(
      zone === "main"
        ? { mainMetricIds: reordered, extraMetricIds: draft.extraMetricIds }
        : { mainMetricIds: draft.mainMetricIds, extraMetricIds: reordered },
    );
  }, [draft.extraMetricIds, draft.mainMetricIds, onChangeDraft]);

  const renderZoneItem = (
    metricId: string,
    zone: MetricZone,
    index: number,
    total: number,
    targetZoneLabel: string,
  ) => {
    const metric = catalogMap.get(metricId);
    if (!metric) return null;
    return (
      <Paper
        key={`${zone}-${metricId}`}
        variant="outlined"
        sx={{
          p: 1,
          borderRadius: 2,
          bgcolor: zone === "main" ? "rgba(25, 118, 210, 0.04)" : "rgba(15, 23, 42, 0.02)",
          borderColor: zone === "main" ? "rgba(25, 118, 210, 0.22)" : "divider",
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{metric.label}</Typography>
              {metric.badgeLabel ? (
                <Chip size="small" variant="outlined" color="primary" label={metric.badgeLabel} />
              ) : null}
              <MetricTooltip metric={metric} />
            </Stack>
            <Typography variant="caption" color="text.secondary">{metric.impact}</Typography>
          </Box>
          <Stack direction="row" spacing={0.25}>
            <IconButton
              size="small"
              onClick={() => moveInZone(zone, metricId, "up")}
              disabled={index === 0}
              aria-label={`Поднять метрику ${metric.label}`}
            >
              <ArrowUpwardRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => moveInZone(zone, metricId, "down")}
              disabled={index >= total - 1}
              aria-label={`Опустить метрику ${metric.label}`}
            >
              <ArrowDownwardRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => (zone === "main" ? addToExtra(metricId) : addToMain(metricId))}
              disabled={zone === "extra" && draft.mainMetricIds.length >= METRIC_CATALOG_MAIN_LIMIT}
              aria-label={`Переместить метрику ${metric.label}`}
            >
              <SwapHorizRoundedIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => removeMetric(metricId)}
              aria-label={`Убрать метрику ${metric.label}`}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
          Переместить в: {targetZoneLabel}
        </Typography>
      </Paper>
    );
  };

  const mainCount = draft.mainMetricIds.length;
  const extraCount = draft.extraMetricIds.length;
  const summaryLabel = `На карточке: ${mainCount}/${METRIC_CATALOG_MAIN_LIMIT} · Остальные: ${extraCount}`;
  const isEmptyCatalog = catalog.length === 0;
  const effectiveNotice = notice || (!isCustomizable
    ? "Для этого агента персональная настройка каталога метрик пока не подключена. URL и структура модалки уже унифицированы, фактическая настройка появится после подключения отдельного каталога."
    : null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{ sx: { borderRadius: 2, minHeight: { md: "82vh" } } }}
    >
      <DialogTitle sx={{ pb: 1.1 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Каталог метрик агента
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {isCustomizable
                ? `Настройте, какие метрики показываются у агента «${agentName}» в блоке «Анализ эффективности агента» и в расширенном списке.`
                : `Для агента «${agentName}» здесь показывается статус каталога метрик и готовность к персональной настройке.`}
            </Typography>
            <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap" sx={{ mt: 0.85 }}>
              <Chip size="small" color="primary" variant="outlined" label={`На карточке ${mainCount}/${METRIC_CATALOG_MAIN_LIMIT}`} />
              <Chip size="small" color="info" variant="outlined" label={`Остальные ${extraCount}`} />
              <Chip size="small" variant="outlined" label={`В каталоге ${catalog.length}`} />
            </Stack>
          </Box>
          <IconButton onClick={onClose} aria-label="Закрыть настройку метрик">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {isLoading ? <LinearProgress /> : null}
        <Stack spacing={1.25} sx={{ p: 1.5 }}>
          {effectiveNotice ? (
            <Alert severity={isCustomizable ? "warning" : "info"} variant="outlined">{effectiveNotice}</Alert>
          ) : null}
          {limitWarning ? (
            <Alert severity="error" variant="outlined">{limitWarning}</Alert>
          ) : null}

          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center">
            <TextField
              size="small"
              fullWidth
              label="Поиск по метрикам"
              placeholder="Название или влияние на эффективность"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <TextField
              size="small"
              select
              sx={{ minWidth: { xs: "100%", md: 220 } }}
              label="Фильтр каталога"
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as MetricsCatalogFilterScope)}
              disabled={!isCustomizable}
            >
              <MenuItem value="all">Все метрики</MenuItem>
              <MenuItem value="common">Общие</MenuItem>
              <MenuItem value="agent">Метрики аналитика</MenuItem>
            </TextField>
            <Button
              size="small"
              variant="outlined"
              onClick={onResetDefaults}
              disabled={isLoading || isSaving || !isCustomizable}
              sx={{ minWidth: { xs: "100%", md: 180 } }}
            >
              Сбросить по умолчанию
            </Button>
          </Stack>

          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} sx={{ minHeight: { lg: 520 } }}>
            <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, flex: { lg: "1 1 58%" }, minHeight: { lg: 500 }, display: "flex", flexDirection: "column" }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                  Каталог метрик
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {filteredCatalog.length} найдено
                </Typography>
              </Stack>
              <Divider sx={{ mt: 1, mb: 1 }} />
              <Box sx={{ overflowY: "auto", pr: 0.4 }}>
                <Stack spacing={0.7}>
                  {filteredCatalog.length === 0 ? (
                    <Paper variant="outlined" sx={{ p: 1.2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {isEmptyCatalog
                          ? "Каталог метрик для этого агента пока не зафиксирован."
                          : "По фильтру метрики не найдены."}
                      </Typography>
                    </Paper>
                  ) : filteredCatalog.map((metric) => {
                    const state = selectionStateByMetricId.get(metric.metricId) || "none";
                    const canMoveToMain = state !== "main";
                    const canMoveToExtra = state !== "extra";
                    return (
                      <Paper key={metric.metricId} variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                        <Stack spacing={0.6}>
                          <Stack direction="row" spacing={1} alignItems="flex-start">
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{metric.label}</Typography>
                                {metric.badgeLabel ? (
                                  <Chip size="small" variant="outlined" color="primary" label={metric.badgeLabel} />
                                ) : null}
                                <MetricTooltip metric={metric} />
                              </Stack>
                              <Typography variant="caption" color="text.secondary">{metric.impact}</Typography>
                            </Box>
                            <Stack direction="row" spacing={0.5}>
                              <Chip size="small" variant="outlined" label={metric.scope === "common" ? "Общая" : "Метрика аналитика"} />
                              <Chip
                                size="small"
                                variant={metric.hasData ? "filled" : "outlined"}
                                color={metric.hasData ? "success" : "default"}
                                label={metric.hasData ? DATA_STATUS_CONNECTED : DATA_STATUS_NOT_CONNECTED}
                              />
                            </Stack>
                          </Stack>
                          <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap">
                            <Button
                              size="small"
                              variant={state === "main" ? "contained" : "outlined"}
                              onClick={() => addToMain(metric.metricId)}
                              disabled={!isCustomizable || !canMoveToMain || draft.mainMetricIds.length >= METRIC_CATALOG_MAIN_LIMIT}
                            >
                              На карточку
                            </Button>
                            <Button
                              size="small"
                              variant={state === "extra" ? "contained" : "outlined"}
                              onClick={() => addToExtra(metric.metricId)}
                              disabled={!isCustomizable || !canMoveToExtra}
                            >
                              В остальные
                            </Button>
                            {state !== "none" ? (
                              <Button size="small" color="inherit" variant="text" disabled={!isCustomizable} onClick={() => removeMetric(metric.metricId)}>
                                Убрать
                              </Button>
                            ) : null}
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            </Paper>

            <Stack spacing={1.25} sx={{ flex: { lg: "1 1 42%" }, minHeight: { lg: 500 } }}>
              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, flex: 1, display: "flex", flexDirection: "column" }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                    На карточке: Анализ эффективности агента
                  </Typography>
                  <Chip size="small" color="primary" variant="outlined" label={`${mainCount}/${METRIC_CATALOG_MAIN_LIMIT}`} />
                </Stack>
                <Divider sx={{ mt: 1, mb: 1 }} />
                <Box sx={{ overflowY: "auto", pr: 0.2 }}>
                  <Stack spacing={0.7}>
                    {draft.mainMetricIds.length === 0 ? (
                      <Paper variant="outlined" sx={{ p: 1.2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Добавьте хотя бы одну метрику в основной блок карточки агента.
                        </Typography>
                      </Paper>
                    ) : draft.mainMetricIds.map((metricId, index) => renderZoneItem(metricId, "main", index, draft.mainMetricIds.length, "Остальные метрики"))}
                  </Stack>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, flex: 1, display: "flex", flexDirection: "column" }}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
                    Остальные метрики
                  </Typography>
                  <Chip size="small" color="info" variant="outlined" label={String(extraCount)} />
                </Stack>
                <Divider sx={{ mt: 1, mb: 1 }} />
                <Box sx={{ overflowY: "auto", pr: 0.2 }}>
                  <Stack spacing={0.7}>
                    {draft.extraMetricIds.length === 0 ? (
                      <Paper variant="outlined" sx={{ p: 1.2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Здесь будут метрики из расширенного списка.
                        </Typography>
                      </Paper>
                    ) : draft.extraMetricIds.map((metricId, index) => renderZoneItem(metricId, "extra", index, draft.extraMetricIds.length, "На карточку"))}
                  </Stack>
                </Box>
              </Paper>
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          px: 2,
          py: 1.25,
          borderTop: 1,
          borderColor: "divider",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {summaryLabel}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Button variant="text" color="inherit" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="contained" onClick={onSave} disabled={isLoading || isSaving || mainCount === 0 || !isCustomizable}>
            {isSaving ? "Сохраняю..." : isCustomizable ? "Сохранить набор" : "Недоступно"}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

function ErrorEntryCard({
  entry,
  onOpenFile,
  canOpenPath,
}: {
  entry: AnalystErrorEntry;
  onOpenFile: (path: string) => void;
  canOpenPath: (path: string) => boolean;
}) {
  const severity = asString(entry.severity).toUpperCase();
  const chipColor = severity === "ERROR" ? "error" : severity === "WARNING" ? "warning" : "default";

  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Stack spacing={0.9}>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Chip size="small" color={chipColor} variant="outlined" label={severity || "UNKNOWN"} />
          <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 220 }}>
            {entry.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {entry.timestamp ? formatDateTimeLong(entry.timestamp) : "—"}
          </Typography>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap" }}>
          {entry.description}
        </Typography>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">
            Цикл: <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{entry.cycleId || "не зафиксировано"}</Box>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Шаг: <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{entry.step || "не зафиксировано"}</Box>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Статус решения: {entry.resolutionStatus || "не зафиксировано"}
          </Typography>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Действие по решению: {entry.resolutionAction || "не зафиксировано"}
        </Typography>

        {entry.artifactsInvolved.length > 0 ? (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.35 }}>
              Артефакты
            </Typography>
            <Stack spacing={0.35}>
              {entry.artifactsInvolved.map((item) => (
                <Typography
                  key={`${entry.id}-${item}`}
                  variant="caption"
                  sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", lineBreak: "anywhere" }}
                >
                  {item}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : null}

        {entry.lessonRef && canOpenPath(entry.lessonRef) ? (
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => onOpenFile(entry.lessonRef)}
            sx={{ alignSelf: "flex-start" }}
          >
            Открыть связанный урок: {entry.lessonRef}
          </Link>
        ) : entry.lessonRef ? (
          <Typography variant="caption" color="text.secondary">
            Связанный урок не найден по пути: {entry.lessonRef}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}

function isDefaultAgentProcess(process: string): boolean {
  const normalized = asString(process).toLowerCase();
  return !normalized || normalized === "vibe_coding";
}

function formatArtifactSummary(event: AgentLogEvent): string {
  const readCount = event.artifactsRead.length;
  const writeCount = event.artifactsWritten.length;
  if (readCount === 0 && writeCount === 0) return "не зафиксировано";
  if (readCount > 0 && writeCount > 0) return `прочитано ${readCount} / записано ${writeCount}`;
  if (readCount > 0) return `прочитано ${readCount}`;
  return `записано ${writeCount}`;
}

function AgentLogEventRow({ event, onOpenFile }: { event: AgentLogEvent; onOpenFile: (path: string) => void }) {
  const meta = statusMeta(event.status);
  const hasArtifacts = event.artifactsRead.length > 0 || event.artifactsWritten.length > 0;
  const showProcessInTechDetails = !isDefaultAgentProcess(event.process);
  const hasTechDetails = Boolean(event.traceId || event.recommendationId || showProcessInTechDetails || event.line);

  return (
    <Accordion disableGutters elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "8px", "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ width: "100%", pr: 1 }}>
          <Typography variant="caption" sx={{ minWidth: 82, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "text.secondary" }}>
            {event.timestamp ? formatDateTimeLong(event.timestamp).split(", ")[1] || formatDateTimeLong(event.timestamp) : "—"}
          </Typography>
          <Chip
            size="small"
            label={event.step || "step"}
            variant="outlined"
            sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
          <Chip
            size="small"
            color={meta.color}
            variant="outlined"
            icon={meta.icon as React.ReactElement}
            label={event.status || "не зафиксировано"}
            sx={{ "& .MuiChip-icon": { ml: 0.5 } }}
          />
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
              }}
            >
              {event.outcome || "Исход события не зафиксирован"}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", flexShrink: 0 }}>
            {event.runId || "run: —"}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
            <AgentLogMetricCard title="Время" value={formatDateTimeLong(event.timestamp)} />
            <AgentLogMetricCard title="Цикл" value={event.taskId || "не зафиксировано"} />
            <AgentLogMetricCard title="Токены" value={`in ${formatTokens(event.tokensIn || 0)} / out ${formatTokens(event.tokensOut || 0)}`} />
            <AgentLogMetricCard title="Артефакты" value={formatArtifactSummary(event)} />
          </Stack>

          {hasArtifacts ? (
            <Paper variant="outlined" sx={{ p: 1.1 }}>
              <Typography variant="caption" color="text.secondary" component="div">
                Артефакты
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap sx={{ mt: 0.7 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Прочитано
                  </Typography>
                  {event.artifactsRead.length > 0 ? event.artifactsRead.map((item) => (
                    <Typography key={`${event.id}-read-${item}`} variant="body2" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.78rem", lineBreak: "anywhere" }}>
                      {item}
                    </Typography>
                  )) : <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Записано
                  </Typography>
                  {event.artifactsWritten.length > 0 ? event.artifactsWritten.map((item) => (
                    <Typography key={`${event.id}-write-${item}`} variant="body2" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.78rem", lineBreak: "anywhere" }}>
                      {item}
                    </Typography>
                  )) : <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>}
                </Box>
              </Stack>
            </Paper>
          ) : null}

          {(event.mcpTools.length > 0 || event.tools.length > 0 || event.skills.length > 0) ? (
            <Paper variant="outlined" sx={{ p: 1.1 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap>
                {event.mcpTools.length > 0 ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">MCP</Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.4 }}>
                      {event.mcpTools.map((item) => (
                        <SkillToolMcpTooltip key={`${event.id}-mcp-${item}`} name={item} size="small" variant="outlined" onOpenFile={onOpenFile} />
                      ))}
                    </Stack>
                  </Box>
                ) : null}
                {event.tools.length > 0 ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">Инструменты</Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.4 }}>
                      {event.tools.map((item) => (
                        <SkillToolMcpTooltip key={`${event.id}-tool-${item}`} name={item} size="small" variant="outlined" onOpenFile={onOpenFile} />
                      ))}
                    </Stack>
                  </Box>
                ) : null}
                {event.skills.length > 0 ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">Навыки</Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.4 }}>
                      {event.skills.map((item) => (
                        <SkillToolMcpTooltip key={`${event.id}-skill-${item}`} name={item} size="small" variant="outlined" onOpenFile={onOpenFile} />
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </Stack>
            </Paper>
          ) : null}

          {hasTechDetails ? (
            <Paper variant="outlined" sx={{ p: 1.1, bgcolor: "rgba(15, 23, 42, 0.02)" }}>
              <Typography variant="caption" color="text.secondary" component="div">
                Тех. детали
              </Typography>
              <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" component="div">
                  trace_id: <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{event.traceId || "не зафиксировано"}</Box>
                </Typography>
                {event.recommendationId ? (
                  <Typography variant="caption" color="text.secondary" component="div">
                    recommendation_id: <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{event.recommendationId}</Box>
                  </Typography>
                ) : null}
                {showProcessInTechDetails ? (
                  <Typography variant="caption" color="text.secondary" component="div">
                    process: <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{event.process}</Box>
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary" component="div">
                  Строка в логе: {event.line}
                </Typography>
              </Stack>
            </Paper>
          ) : null}

          {event.error ? (
            <Paper variant="outlined" sx={{ p: 1, bgcolor: "rgba(220, 38, 38, 0.05)", borderColor: "rgba(220, 38, 38, 0.2)" }}>
              <Typography variant="caption" sx={{ color: "error.main", fontWeight: 700 }}>Ошибка</Typography>
              <Typography variant="body2" sx={{ mt: 0.3, whiteSpace: "pre-wrap" }}>{event.error}</Typography>
            </Paper>
          ) : null}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}

// Эталонная карточка analyst-agent. Меняется только по явному запросу пользователя.
export function AnalystCardDrawer({
  open,
  agent,
  onClose,
  tabKey,
  onTabChange,
  metricsCatalogOpen,
  onOpenMetricsCatalog,
  onCloseMetricsCatalog,
  improvementHistoryOpen,
  onOpenImprovementHistory,
  onCloseImprovementHistory,
  lessonsModalOpen,
  lessonsModalEntityKey,
  onOpenLessonsModal,
  onCloseLessonsModal,
  onLessonsModalEntityChange,
  sessionsModalOpen,
  sessionsModalEntityKey,
  onOpenSessionsModal,
  onCloseSessionsModal,
  operativeMemoryModalOpen,
  operativeMemoryModalEntityKey,
  onOpenOperativeMemoryModal,
  onCloseOperativeMemoryModal,
}: {
  open: boolean;
  agent: AgentSummary | null;
  onClose: () => void;
  tabKey?: AgentTabKey;
  onTabChange?: (tabKey: AgentTabKey) => void;
  onCopyLink?: () => Promise<boolean>;
  metricsCatalogOpen?: boolean;
  onOpenMetricsCatalog?: () => void;
  onCloseMetricsCatalog?: () => void;
  improvementHistoryOpen?: boolean;
  onOpenImprovementHistory?: () => void;
  onCloseImprovementHistory?: () => void;
  lessonsModalOpen?: boolean;
  lessonsModalEntityKey?: string | null;
  onOpenLessonsModal?: (entity: "agent" | "global") => void;
  onCloseLessonsModal?: () => void;
  onLessonsModalEntityChange?: (entity: "agent" | "global") => void;
  sessionsModalOpen?: boolean;
  sessionsModalEntityKey?: string | null;
  onOpenSessionsModal?: (sessionId: string | null) => void;
  onCloseSessionsModal?: () => void;
  operativeMemoryModalOpen?: boolean;
  operativeMemoryModalEntityKey?: string | null;
  onOpenOperativeMemoryModal?: (sessionId: string | null) => void;
  onCloseOperativeMemoryModal?: () => void;
}) {
  void tabKey;
  void onTabChange;
  const [modal, setModal] = React.useState<ModalState>(EMPTY_MODAL);
  const [agentLogOpen, setAgentLogOpen] = React.useState(false);
  const [agentLogSearch, setAgentLogSearch] = React.useState("");
  const [sessionsListOpen, setSessionsListOpen] = React.useState(false);
  const [localSessionsModalEntityKey, setLocalSessionsModalEntityKey] = React.useState<string | null>(null);
  const [lessonsDrawerOpen, setLessonsDrawerOpen] = React.useState(false);
  const [localLessonsModalEntityKey, setLocalLessonsModalEntityKey] = React.useState<"agent" | "global">("agent");
  const [sessionsSearch, setSessionsSearch] = React.useState("");
  const [agentErrorsOpen, setAgentErrorsOpen] = React.useState(false);
  const [additionalMetricsOpen, setAdditionalMetricsOpen] = React.useState(false);
  const [localMetricsCatalogOpen, setLocalMetricsCatalogOpen] = React.useState(false);
  const [localImprovementHistoryOpen, setLocalImprovementHistoryOpen] = React.useState(false);
  const [localOperativeMemoryModalOpen, setLocalOperativeMemoryModalOpen] = React.useState(false);
  const [localOperativeMemoryModalEntityKey, setLocalOperativeMemoryModalEntityKey] = React.useState<string | null>(null);
  const [metricsCatalogDraft, setMetricsCatalogDraft] = React.useState<MetricSelectionDraft | null>(null);
  const [metricPreferences, setMetricPreferences] = React.useState<AgentMetricPreferences | null>(null);
  const [metricPreferencesLoading, setMetricPreferencesLoading] = React.useState(false);
  const [metricPreferencesSaving, setMetricPreferencesSaving] = React.useState(false);
  const [metricPreferencesNotice, setMetricPreferencesNotice] = React.useState<string | null>(null);
  const [selfImprovementTasksOpen, setSelfImprovementTasksOpen] = React.useState(false);
  const [selfImprovementTasksLoading, setSelfImprovementTasksLoading] = React.useState(false);
  const [selfImprovementTasksError, setSelfImprovementTasksError] = React.useState<string | null>(null);
  const [selfImprovementTasks, setSelfImprovementTasks] = React.useState<AgentTaskRow[]>([]);
  const [selectedSelfImprovementTaskId, setSelectedSelfImprovementTaskId] = React.useState<string | null>(null);
  const [createdTasksCount, setCreatedTasksCount] = React.useState<number | null>(null);
  const [createdTasksLoading, setCreatedTasksLoading] = React.useState(false);
  const [cycleTasksMap, setCycleTasksMap] = React.useState<Map<string, number>>(new Map());
  const [selectedSession, setSelectedSession] = React.useState<AnalystSession | null>(null);

  React.useEffect(() => {
    if (open) return;
    setSessionsListOpen(false);
    setLocalSessionsModalEntityKey("latest");
    setLessonsDrawerOpen(false);
    setLocalLessonsModalEntityKey("agent");
    setLocalMetricsCatalogOpen(false);
    setLocalImprovementHistoryOpen(false);
    setLocalOperativeMemoryModalOpen(false);
    setLocalOperativeMemoryModalEntityKey(null);
    setMetricsCatalogDraft(null);
  }, [open]);

  const requestedAgentId = agent?.id ?? null;
  const data = React.useMemo(
    () => (requestedAgentId === "analyst-agent" ? getAnalystCardData() : null),
    [requestedAgentId],
  );
  const benchmarkSummary = React.useMemo<AgentBenchmarkSummary>(() => getAgentBenchmarkSummary(), []);
  const bpmnDocs = React.useMemo<BpmnDiagram[]>(() => getBpmnManifest(), []);
  const kbDocs = React.useMemo(() => getOapKbIndex(), []);
  const rawLogs = React.useMemo(() => getOapKbRawLogs(), []);
  const docsDocs = React.useMemo(() => getDocsIndex(), []);
  const indexedDocs = React.useMemo<OpenableDoc[]>(
    () => [
      ...kbDocs.map((d: OapKbDocument) => ({ title: d.title, path: d.path, content: d.content, updatedAt: d.updatedAt })),
      ...rawLogs.map((d: OapKbDocument) => ({ title: d.title, path: d.path, content: d.content, updatedAt: d.updatedAt })),
      ...docsDocs.map((d: DocsDocument) => ({ title: d.title, path: d.path, content: d.content, updatedAt: d.updatedAt })),
    ],
    [kbDocs, rawLogs, docsDocs],
  );

  const effectiveAgent = data?.agent ?? agent;
  const effectiveAgentId = effectiveAgent?.id ?? null;
  const isAnalystAgent = effectiveAgentId === "analyst-agent";
  const isAnalystStyleAgent = isAnalystAgent || effectiveAgentId === PRODUCT_DESIGNER_AGENT_ID;
  const telemetryAgentSummary = React.useMemo<AgentTelemetrySummaryAgent | null>(
    () => (effectiveAgentId ? getAgentTelemetrySummaryByAgent(effectiveAgentId) : null),
    [effectiveAgentId],
  );
  const viewerId = React.useMemo(() => getOrCreateViewerId(), []);
  const isMetricsCatalogDialogOpen = metricsCatalogOpen ?? localMetricsCatalogOpen;
  const isImprovementHistoryDialogOpen = improvementHistoryOpen ?? localImprovementHistoryOpen;
  const isSessionsModalOpen = sessionsModalOpen ?? sessionsListOpen;
  const sessionsRouteEntity = (sessionsModalEntityKey ?? localSessionsModalEntityKey) || "latest";
  const isLessonsModalOpen = lessonsModalOpen ?? lessonsDrawerOpen;
  const lessonsRouteEntity = (() => {
    const raw = lessonsModalEntityKey || localLessonsModalEntityKey;
    return raw === "global" ? "global" : "agent";
  })();
  const isOperativeMemoryModalOpen = operativeMemoryModalOpen ?? localOperativeMemoryModalOpen;
  const operativeMemoryRouteEntity = operativeMemoryModalEntityKey ?? localOperativeMemoryModalEntityKey;
  const improvementHistoryEvents = React.useMemo<AgentImprovementHistoryEvent[]>(
    () => (effectiveAgentId ? getAgentImprovementHistoryByAgent(effectiveAgentId) : []),
    [effectiveAgentId],
  );
  const cycle = data?.cycle ?? null;
  const sessions = isAnalystAgent ? data?.sessions ?? [] : [];
  const latestSession = React.useMemo<AnalystSession | null>(
    () => sessions[0] ?? null,
    [sessions],
  );
  const sessionsDataFreshnessWarning = React.useMemo<{
    generatedAt: string;
    newestTelemetryAt: string;
  } | null>(() => {
    const generatedAt = asString(cycle?.generated_at);
    if (!generatedAt) return null;
    const generatedAtMs = toDateMs(generatedAt);
    if (!generatedAtMs) return null;
    const newestSession = sessions.reduce<AnalystSession | null>((acc, session) => {
      if (!acc) return session;
      return toDateMs(session.completedAt) > toDateMs(acc.completedAt) ? session : acc;
    }, null);
    if (!newestSession?.completedAt) return null;
    if (toDateMs(newestSession.completedAt) <= generatedAtMs) return null;
    return {
      generatedAt,
      newestTelemetryAt: newestSession.completedAt,
    };
  }, [cycle?.generated_at, sessions]);
  const efficiency = isAnalystAgent ? data?.efficiency ?? null : null;
  const keyMetrics = isAnalystAgent ? data?.keyMetrics ?? null : null;
  const lessonsPath = effectiveAgent?.learningArtifacts?.lessonsPath || DEFAULT_LESSONS_PATH;
  const openMetricsCatalogDialog = React.useCallback(() => {
    if (onOpenMetricsCatalog) {
      onOpenMetricsCatalog();
      return;
    }
    setLocalMetricsCatalogOpen(true);
  }, [onOpenMetricsCatalog]);
  const closeMetricsCatalogDialog = React.useCallback(() => {
    if (onCloseMetricsCatalog) {
      onCloseMetricsCatalog();
      return;
    }
    setLocalMetricsCatalogOpen(false);
  }, [onCloseMetricsCatalog]);
  const openImprovementHistoryDialog = React.useCallback(() => {
    if (onOpenImprovementHistory) {
      onOpenImprovementHistory();
      return;
    }
    setLocalImprovementHistoryOpen(true);
  }, [onOpenImprovementHistory]);
  const closeImprovementHistoryDialog = React.useCallback(() => {
    if (onCloseImprovementHistory) {
      onCloseImprovementHistory();
      return;
    }
    setLocalImprovementHistoryOpen(false);
  }, [onCloseImprovementHistory]);
  const openLessonsModal = React.useCallback((entity: "agent" | "global" = "agent") => {
    if (onOpenLessonsModal) {
      onOpenLessonsModal(entity);
      return;
    }
    setLocalLessonsModalEntityKey(entity);
    setLessonsDrawerOpen(true);
  }, [onOpenLessonsModal]);
  const closeLessonsModal = React.useCallback(() => {
    if (onCloseLessonsModal) {
      onCloseLessonsModal();
      return;
    }
    setLessonsDrawerOpen(false);
    setLocalLessonsModalEntityKey("agent");
  }, [onCloseLessonsModal]);
  const handleLessonsEntityChange = React.useCallback((entity: "agent" | "global") => {
    if (onLessonsModalEntityChange) {
      onLessonsModalEntityChange(entity);
      return;
    }
    setLocalLessonsModalEntityKey(entity);
  }, [onLessonsModalEntityChange]);
  const openSessionsModal = React.useCallback((sessionId: string | null = null) => {
    if (onOpenSessionsModal) {
      onOpenSessionsModal(sessionId);
      return;
    }
    setLocalSessionsModalEntityKey(sessionId || "latest");
    setSessionsListOpen(true);
  }, [onOpenSessionsModal]);
  const closeSessionsModal = React.useCallback(() => {
    if (onCloseSessionsModal) {
      onCloseSessionsModal();
      return;
    }
    setSessionsListOpen(false);
    setLocalSessionsModalEntityKey("latest");
  }, [onCloseSessionsModal]);
  const openOperativeMemoryModal = React.useCallback((sessionId: string | null) => {
    if (onOpenOperativeMemoryModal) {
      onOpenOperativeMemoryModal(sessionId);
      return;
    }
    setLocalOperativeMemoryModalEntityKey(sessionId || "latest");
    setLocalOperativeMemoryModalOpen(true);
  }, [onOpenOperativeMemoryModal]);
  const closeOperativeMemoryModal = React.useCallback(() => {
    if (onCloseOperativeMemoryModal) {
      onCloseOperativeMemoryModal();
      return;
    }
    setLocalOperativeMemoryModalOpen(false);
    setLocalOperativeMemoryModalEntityKey(null);
  }, [onCloseOperativeMemoryModal]);
  const renderNonAnalystImprovements = React.useCallback(() => {
    if (!effectiveAgent) return null;

    return (
      <Stack spacing={1.25}>
        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="body2" color="text.secondary">
            Здесь собраны улучшения роли, которые помогают точнее выбирать маршрут задачи и уменьшать лишнюю оркестрацию.
          </Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} useFlexGap flexWrap="wrap">
            <Button variant="outlined" size="small" onClick={openImprovementHistoryDialog}>
              История улучшений агента
            </Button>
            <Button variant="text" size="small" onClick={() => openLessonsModal("agent")}>
              Открыть lessons
            </Button>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
            Рекомендации по развитию роли
          </Typography>
          {effectiveAgent.improvements && effectiveAgent.improvements.length > 0 ? (
            <Stack spacing={1}>
              {effectiveAgent.improvements.map((item) => (
                <Box key={`${effectiveAgent.id}-improvement-${item.title}`}>
                  <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                    <Chip size="small" variant="outlined" label={`Приоритет: ${item.priority}`} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.35 }}>
                    Проблема: {item.problem}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Решение: {item.solution}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Ожидаемый эффект: {item.effect}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Отдельные улучшения по этой роли пока не зафиксированы.
            </Typography>
          )}
        </Paper>
      </Stack>
    );
  }, [effectiveAgent, openImprovementHistoryDialog, openLessonsModal]);
  const showOverviewSection = true;
  const showSkillsSection = true;
  const showTasksSection = true;
  const showMemorySection = true;
  const showImprovementsSection = false;
  const inlineAgentDocs = React.useMemo<OpenableDoc[]>(() => {
    if (!effectiveAgent) return [];
    const docs: OpenableDoc[] = [];
    const updatedAt = effectiveAgent.updatedAt || new Date().toISOString();

    for (const skill of effectiveAgent.usedSkills || []) {
      const path = asString(skill.skillFilePath);
      const content = asString(skill.skillFileText || skill.fullText);
      if (!path || !content) continue;
      docs.push({
        title: `Навык ${asString(skill.name) || "SKILL"} (из карточки агента)`,
        path,
        content,
        updatedAt,
      });
    }

    for (const rule of effectiveAgent.rulesApplied || []) {
      const path = asString(rule.location);
      const content = asString(rule.fullText || rule.description);
      if (!path || !content) continue;
      docs.push({
        title: asString(rule.title) || "Правило (из карточки агента)",
        path,
        content,
        updatedAt,
      });
    }

    return docs;
  }, [effectiveAgent]);
  const allOpenableDocs = React.useMemo<OpenableDoc[]>(
    () => {
      const ordered: OpenableDoc[] = [];
      const seen = new Set<string>();
      for (const doc of [...indexedDocs, ...inlineAgentDocs]) {
        const key = normalizePath(doc.path);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        ordered.push(doc);
      }
      return ordered;
    },
    [indexedDocs, inlineAgentDocs],
  );
  const docsByLookupKey = React.useMemo(() => {
    const map = new Map<string, OpenableDoc>();
    for (const doc of allOpenableDocs) {
      const keys = buildPathLookupKeys(doc.path);
      for (const key of keys) {
        if (!map.has(key)) map.set(key, doc);
      }
    }
    return map;
  }, [allOpenableDocs]);
  const resolveDocByPath = React.useCallback(
    (path: string): OpenableDoc | null => {
      const keys = buildPathLookupKeys(path);
      for (const key of keys) {
        const doc = docsByLookupKey.get(key);
        if (doc) return doc;
      }
      return null;
    },
    [docsByLookupKey],
  );
  const bpmnByLookupKey = React.useMemo(() => {
    const map = new Map<string, BpmnDiagram>();
    for (const diagram of bpmnDocs) {
      for (const key of [...buildPathLookupKeys(diagram.sourcePath), ...buildPathLookupKeys(diagram.filePath)]) {
        if (!map.has(key)) {
          map.set(key, diagram);
        }
      }
    }
    return map;
  }, [bpmnDocs]);
  const isOpenablePath = React.useCallback(
    (path: string) => {
      if (resolveDocByPath(path)) return true;
      return buildPathLookupKeys(path).some((key) => bpmnByLookupKey.has(key));
    },
    [bpmnByLookupKey, resolveDocByPath],
  );
  const activeMemorySession = React.useMemo<AnalystSession | null>(() => {
    const latestCycleTaskId = asString(cycle?.latest_cycle?.task_id);
    if (latestCycleTaskId) {
      const exact = sessions.find((session) => session.id === latestCycleTaskId);
      if (exact) return exact;
      const byTaskId = sessions.find((session) => session.taskId === latestCycleTaskId);
      if (byTaskId) return byTaskId;
    }
    return latestSession;
  }, [cycle?.latest_cycle?.task_id, latestSession, sessions]);

  const operativeMemoryEntries = React.useMemo<MemoryLinkEntry[]>(() => {

    const fromSession = uniqueMemoryEntries(
      (activeMemorySession?.operativeMemory ?? []).map((entry) => ({
        title: entry.title || "Контекст сессии",
        path: entry.path,
        status: entry.status,
        lastReadAt: entry.lastReadAt,
        lastWriteAt: entry.lastWriteAt,
        lastTouchedAt: entry.lastTouchedAt,
      })),
    ).filter((entry) => isOpenablePath(entry.path));

    if (fromSession.length > 0) return fromSession;

    const fromCycle: MemoryLinkEntry[] = uniqueMemoryEntries(
      (cycle?.timeline ?? []).flatMap((event) => {
        const timestamp = asString(event.timestamp) || null;
        const step = asString(event.step);
        const reads = toArtifactRefs(event.artifacts_read).map((ref) => ({
          title: ref.label || "Контекст последнего цикла (read)",
          path: ref.path,
          status: "read" as const,
          lastReadAt: timestamp,
          lastTouchedAt: timestamp,
          sourceStep: step || undefined,
          sourceKind: ref.sourceKind,
          semanticLayer: ref.semanticLayer,
          reason: ref.reason,
          label: ref.label,
        }));
        const writes = toArtifactRefs(event.artifacts_written).map((ref) => ({
          title: ref.label || "Контекст последнего цикла (write)",
          path: ref.path,
          status: "write" as const,
          lastWriteAt: timestamp,
          lastTouchedAt: timestamp,
          sourceStep: step || undefined,
          sourceKind: ref.sourceKind,
          semanticLayer: ref.semanticLayer,
          reason: ref.reason,
          label: ref.label,
        }));
        return [...reads, ...writes];
      }),
    ).filter((entry) => isOpenablePath(entry.path));

    if (fromCycle.length > 0) return fromCycle;

    const fromAnchors = uniqueMemoryEntries(
      (effectiveAgent?.memoryContext?.contextAnchors ?? []).map((anchor) => ({
        title: anchor.title || "Контекстный документ",
        path: anchor.filePath,
      })),
    ).filter((entry) => isOpenablePath(entry.path));

    return fromAnchors;
  }, [activeMemorySession?.operativeMemory, cycle?.timeline, effectiveAgent?.memoryContext?.contextAnchors, isOpenablePath]);

  const operativeMemoryTrace = React.useMemo<SessionFileOperation[]>(() => {
    const fromSession = (activeMemorySession?.fileTrace ?? []).filter((operation) => asString(operation.path).length > 0);
    if (fromSession.length > 0) return fromSession;

    const fromCycle = (cycle?.timeline ?? []).flatMap((event) => {
      const timestamp = asString(event.timestamp);
      const step = asString(event.step_raw || event.step);
      const taskId = asString(cycle?.latest_cycle?.task_id);
      const runId = "";
      const explicit = Array.isArray(event.artifact_operations)
        ? event.artifact_operations.flatMap((item): SessionFileOperation[] => {
          if (!item || typeof item !== "object") return [];
          const raw = item as Record<string, unknown>;
          const path = asString(raw.path);
          const op = normalizeFileTraceOperation(raw.op);
          if (!path || !op) return [];
          return [{
            path,
            op,
            rawOp: normalizeRawFileTraceOperation(raw.op) || op,
            timestamp: asString(raw.timestamp) || timestamp,
            step: asString(raw.step) || step,
            taskId: asString(raw.task_id) || taskId,
            runId: asString(raw.run_id) || runId,
            source: "artifact_operations",
            sourceKind: asString(raw.source_kind) || "unknown",
            semanticLayer: asString(raw.semantic_layer) || "unknown",
            reason: asString(raw.reason) || "unknown",
            label: asString(raw.label) || path,
          }];
        })
        : [];
      if (explicit.length > 0) return explicit;

      const readOperations = toArtifactRefs(event.artifacts_read).map((ref): SessionFileOperation => ({
        path: ref.path,
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
        label: ref.label || ref.path,
      }));
      const writeOperations = toArtifactRefs(event.artifacts_written).map((ref): SessionFileOperation => ({
        path: ref.path,
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
        label: ref.label || ref.path,
      }));
      return [...readOperations, ...writeOperations];
    });
    return fromCycle;
  }, [activeMemorySession?.fileTrace, cycle?.latest_cycle?.task_id, cycle?.timeline]);
  const operativeMemoryModalSession = React.useMemo<AnalystSession | null>(() => {
    const requested = asString(operativeMemoryRouteEntity);
    if (!requested || requested === "latest") return activeMemorySession;
    return sessions.find((session) => session.id === requested) ?? activeMemorySession;
  }, [activeMemorySession, operativeMemoryRouteEntity, sessions]);
  const operativeMemoryModalTrace = React.useMemo<SessionFileOperation[]>(() => {
    const fromSession = (operativeMemoryModalSession?.fileTrace ?? []).filter((operation) => asString(operation.path).length > 0);
    if (fromSession.length > 0) return fromSession;
    return operativeMemoryTrace;
  }, [operativeMemoryModalSession?.fileTrace, operativeMemoryTrace]);
  const resolveFilePreview = React.useCallback(
    (path: string): { path: string; content: string; updatedAt: string | null } | null => {
      const doc = resolveDocByPath(path);
      if (!doc) return null;
      return {
        path: doc.path,
        content: doc.content,
        updatedAt: asString(doc.updatedAt) || null,
      };
    },
    [resolveDocByPath],
  );
  React.useEffect(() => {
    if (!isOperativeMemoryModalOpen) return;
    const resolvedId = asString(operativeMemoryModalSession?.id);
    if (!resolvedId) return;
    if (asString(operativeMemoryRouteEntity) === resolvedId) return;
    openOperativeMemoryModal(resolvedId);
  }, [
    isOperativeMemoryModalOpen,
    openOperativeMemoryModal,
    operativeMemoryModalSession?.id,
    operativeMemoryRouteEntity,
  ]);
  const persistentMemoryEntries = React.useMemo<MemoryLinkEntry[]>(
    () =>
      uniqueMemoryEntries(
        [
          {
            title: "Уроки агента",
            path: lessonsPath,
          },
          {
            title: "Глобальные уроки",
            path: GLOBAL_LESSONS_PATH,
          },
        ],
      ).filter((entry) => isOpenablePath(entry.path)),
    [isOpenablePath, lessonsPath],
  );

  React.useEffect(() => {
    if (!effectiveAgentId) {
      setSelfImprovementTasks([]);
      setSelfImprovementTasksError(null);
      setSelfImprovementTasksLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadSelfImprovementTasks() {
      setSelfImprovementTasksLoading(true);
      setCreatedTasksLoading(true);
      setSelfImprovementTasksError(null);
      try {
        const sourceAgentId = effectiveAgentId === "analyst-agent" ? "analyst-agent" : effectiveAgentId;
        const executorAgentIds =
          effectiveAgentId === "analyst-agent"
            ? [effectiveAgentId, PRODUCT_DESIGNER_AGENT_ID]
            : [effectiveAgentId];
        const [taskBatches, createdTasks] = await Promise.all([
          Promise.all(
            executorAgentIds.map((executorAgentId) =>
              getAgentTasks(
                {
                  status: "all",
                  sourceAgentId,
                  executorAgentId,
                  limit: 500,
                },
                controller.signal,
              ),
            ),
          ),
          getAgentTasks(
            {
              status: "all",
              sourceAgentId: effectiveAgentId,
              limit: 500,
            },
            controller.signal,
          ),
        ]);

        if (!active) return;
        const tasks = uniqueTasksById(taskBatches.flat());
        const filtered = tasks
          .filter((task) => isActiveSelfImprovementTask(task))
          .sort((a, b) => toDateMs(b.updated_at) - toDateMs(a.updated_at));
        setSelfImprovementTasks(filtered);
        setCreatedTasksCount(createdTasks.length);

        const ctMap = new Map<string, number>();
        for (const task of createdTasks) {
          const cycleId = task.task_brief?.origin_context?.origin_cycle_id;
          if (cycleId) {
            ctMap.set(cycleId, (ctMap.get(cycleId) ?? 0) + 1);
          }
        }
        setCycleTasksMap(ctMap);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Не удалось загрузить задачи самоулучшения.";
        setSelfImprovementTasksError(message);
        setSelfImprovementTasks([]);
        setCreatedTasksCount(null);
        setCycleTasksMap(new Map());
      } finally {
        if (active) {
          setSelfImprovementTasksLoading(false);
          setCreatedTasksLoading(false);
        }
      }
    }

    void loadSelfImprovementTasks();
    return () => {
      active = false;
      controller.abort();
    };
  }, [effectiveAgentId]);

  const lastRunAt =
    cycle?.latest_cycle?.last_event_at ??
    cycle?.latest_cycle?.first_event_at ??
    sessions[0]?.completedAt ??
    null;

  const filteredSessions = React.useMemo<AnalystSession[]>(() => {
    const q = sessionsSearch.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((session) => {
      const completed = formatDateTime(session.completedAt).toLowerCase();
      const started = formatDateTime(session.startedAt).toLowerCase();
      const dateKey = session.completedAt.slice(0, 10).toLowerCase();
      const timeKey = new Date(session.completedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }).toLowerCase();
      return [
        completed,
        started,
        dateKey,
        timeKey,
        session.id.toLowerCase(),
        session.taskId.toLowerCase(),
        session.runId.toLowerCase(),
        session.participationMode.toLowerCase(),
        session.sourceAgentId.toLowerCase(),
        asString(session.rootAgentId).toLowerCase(),
      ].some((value) => value.includes(q));
    });
  }, [sessions, sessionsSearch]);

  const sessionsModalWasOpenRef = React.useRef(false);
  React.useEffect(() => {
    const wasOpen = sessionsModalWasOpenRef.current;
    if (isSessionsModalOpen && !wasOpen) {
      if (sessionsRouteEntity && sessionsRouteEntity !== "latest") {
        const matchedSession = sessions.find(
          (session) => session.id === sessionsRouteEntity || session.taskId === sessionsRouteEntity,
        ) ?? null;
        if (matchedSession) {
          setSessionsSearch(sessionsRouteEntity);
          setSelectedSession(matchedSession);
        } else {
          setSessionsSearch("");
        }
      } else {
        setSessionsSearch("");
      }
    }
    sessionsModalWasOpenRef.current = isSessionsModalOpen;
  }, [isSessionsModalOpen, sessions, sessionsRouteEntity]);

  const averageCreatedTasksPerCycle = React.useMemo(() => {
    if (createdTasksCount == null || !efficiency?.cyclesTotal) return null;
    return createdTasksCount / efficiency.cyclesTotal;
  }, [createdTasksCount, efficiency?.cyclesTotal]);

  const efficiencyMetrics = React.useMemo<MetricDefinition[]>(() => [
    {
      key: "avg_tokens_per_cycle",
      label: "Ср. расход токенов за 1 цикл сессии",
      valueLabel: efficiency?.averageTokensPerCycle != null ? formatTokens(efficiency.averageTokensPerCycle) : "не зафиксировано",
      description: "Средний суммарный расход входных и выходных токенов на один цикл аналитика.",
      formula: "avg(sum(tokens_in + tokens_out) по событиям каждого цикла)",
      source: ".logs/agents/analyst-agent.jsonl -> events[].metrics.tokens_in/tokens_out",
      example: "Если в двух циклах было 42K и 50K токенов, метрика покажет 46K.",
    },
    {
      key: "avg_errors_per_cycle",
      label: "Ср. кол-во ошибок за 1 цикл сессии",
      valueLabel: formatAverageCount(efficiency?.averageErrorsPerCycle ?? null),
      description: "Среднее число зафиксированных ошибок на один цикл. Клик открывает подробный журнал ошибок.",
      formula: "avg(errors_count_per_cycle)",
      source: ".logs/agents/analyst-agent-errors.jsonl + telemetry event.error",
      example: "Если в первом цикле 0 ошибок, а во втором 2, среднее будет 1.0.",
      onClick: () => setAgentErrorsOpen(true),
    },
    {
      key: "avg_tasks_created_per_cycle",
      label: "Ср. кол-во задач создано за 1 цикл сессии",
      valueLabel: createdTasksLoading ? "загружаю..." : formatAverageCount(averageCreatedTasksPerCycle, 1),
      description: "Сколько задач аналитик в среднем создает за один завершенный цикл.",
      formula: "tasks_created_by_agent / completed_cycles",
      source: "getAgentTasks(sourceAgentId=analyst-agent) + telemetry cycles",
      example: "Если агент создал 6 задач за 3 цикла, метрика покажет 2.0.",
    },
  ], [averageCreatedTasksPerCycle, createdTasksLoading, efficiency?.averageErrorsPerCycle, efficiency?.averageTokensPerCycle]);

  const primaryKeyMetrics = React.useMemo<MetricDefinition[]>(() => [
    {
      key: "tasks_from_agent",
      label: "Кол-во задач от агента",
      valueLabel: createdTasksLoading ? "загружаю..." : createdTasksCount == null ? "не зафиксировано" : String(createdTasksCount),
      description: "Сколько задач создано аналитиком как источником задачи.",
      formula: "count(tasks where source_agent_id = analyst-agent)",
      source: "Task API (`getAgentTasks` с `sourceAgentId=analyst-agent`)",
      example: "Если аналитик создал 14 задач в трекере, метрика покажет 14.",
    },
    {
      key: "avg_target_metric_growth_pp",
      label: "Средний прирост целевой метрики агентов",
      valueLabel: formatPpValue(keyMetrics?.averageTargetMetricGrowthPp ?? null),
      description: "Средний документированный сдвиг целевой метрики по рекомендациям аналитика в процентных пунктах.",
      formula: "avg(parse(expectedDelta))",
      source: "docs/agents/registry.yaml -> analyst-agent.improvements[].expectedDelta",
      example: "Если ожидаемые сдвиги 15% и 20%, карточка покажет 17.5 п.п.",
    },
    {
      key: "confirmed_effect_share",
      label: "Доля рекомендаций с подтвержденным эффектом",
      valueLabel: formatPercentValue(keyMetrics?.confirmedEffectSharePct ?? null),
      description: "Какая часть внедренных рекомендаций дала измеримый эффект, а не только факт внедрения.",
      formula: "recommendations_with_validated_impact / recommendations_applied * 100",
      source: "artifacts/agent_benchmark_summary.json -> impact_metrics.validated_impact_rate",
      example: "Если из 10 внедренных рекомендаций эффект подтвержден у 4, метрика покажет 40%.",
    },
    {
      key: "documented_relevance_share",
      label: "Доля рекомендаций с документально подтверждённой актуальностью",
      valueLabel: formatPercentValue(keyMetrics?.documentedRelevanceSharePct ?? null),
      description: "Какая доля рекомендаций имеет актуальную validationDate и не просрочена на текущую дату.",
      formula: "recommendations_with_validationDate >= today / total_recommendations * 100",
      source: "docs/agents/registry.yaml -> analyst-agent.improvements[].validationDate",
      example: "Если у 8 из 10 рекомендаций validationDate еще не истекла, метрика покажет 80%.",
    },
  ], [
    createdTasksCount,
    createdTasksLoading,
    keyMetrics?.averageTargetMetricGrowthPp,
    keyMetrics?.confirmedEffectSharePct,
    keyMetrics?.documentedRelevanceSharePct,
  ]);

  const additionalEfficiencyMetrics = React.useMemo<MetricDefinition[]>(() => [
    {
      key: "verification_pass_rate",
      label: "Успех верификации",
      valueLabel: formatPercentValue(cycle?.metrics.verification_pass_rate ?? null),
      description: "Доля verify-запусков, которые завершились успешно.",
      formula: "unique task_id с verify_started и verify_passed / unique task_id с verify_started * 100",
      source: "artifacts/agent_latest_cycle_analyst.json -> metrics.verification_pass_rate",
      example: "Если verify запускали 5 раз и 4 прошли успешно, метрика покажет 80%.",
    },
    {
      key: "lesson_capture_rate",
      label: "Фиксация уроков",
      valueLabel: formatPercentValue(cycle?.metrics.lesson_capture_rate ?? null),
      description: "Насколько стабильно после verify фиксируются уроки self-improvement.",
      formula: "unique task_id с lesson_captured / (unique task_id с verify_passed + unique task_id с verify_failed) * 100",
      source: "artifacts/agent_latest_cycle_analyst.json -> metrics.lesson_capture_rate",
      example: "Если после 4 verify урок зафиксирован 3 раза, метрика покажет 75%.",
    },
    {
      key: "review_error_rate",
      label: "Доля review-ошибок",
      valueLabel: cycle?.metrics.review_error_rate == null ? "не зафиксировано" : cycle.metrics.review_error_rate.toFixed(2),
      description: "Сколько review-ошибок приходится на одну завершенную задачу.",
      formula: "review_errors_total / completed_tasks",
      source: "artifacts/agent_latest_cycle_analyst.json -> metrics.review_error_rate",
      example: "Если на 10 завершенных задач зафиксировано 2 review-ошибки, метрика покажет 0.20.",
    },
    {
      key: "recommendation_action_rate",
      label: "Реализация рекомендаций",
      valueLabel: formatPercentValue(cycle?.metrics.recommendation_action_rate ?? null),
      description: "Какой процент рекомендаций дошел до применения в рабочем цикле.",
      formula: "recommendations_applied / recommendations_suggested * 100",
      source: "artifacts/agent_latest_cycle_analyst.json -> metrics.recommendation_action_rate",
      example: "Если применены 3 рекомендации из 6 предложенных, метрика покажет 50%.",
    },
    {
      key: "recommendation_executability_rate",
      label: "Исполнимость рекомендаций",
      valueLabel: formatPercentValue((benchmarkSummary.impact_metrics.recommendation_executability_rate ?? null) != null
        ? (benchmarkSummary.impact_metrics.recommendation_executability_rate as number) * 100
        : null),
      description: "Доля рекомендаций, которые можно сразу перевести в конкретное действие.",
      formula: "executable_recommendations / total_recommendations * 100",
      source: "artifacts/agent_benchmark_summary.json -> impact_metrics.recommendation_executability_rate",
      example: "Если 7 из 10 рекомендаций можно запускать без доработки, метрика покажет 70%.",
    },
    {
      key: "evidence_link_coverage",
      label: "Покрытие evidence-ссылками",
      valueLabel: formatPercentValue((benchmarkSummary.impact_metrics.evidence_link_coverage ?? null) != null
        ? (benchmarkSummary.impact_metrics.evidence_link_coverage as number) * 100
        : null),
      description: "Какая доля рекомендаций подкреплена ссылками на артефакты и источники.",
      formula: "recommendations_with_evidence_links / total_recommendations * 100",
      source: "artifacts/agent_benchmark_summary.json -> impact_metrics.evidence_link_coverage",
      example: "Если evidence есть у 9 из 10 рекомендаций, метрика покажет 90%.",
    },
    {
      key: "time_to_action_p50",
      label: "Время до действия p50",
      valueLabel: formatHoursValue(benchmarkSummary.impact_metrics.time_to_action_p50 ?? null),
      description: "Медианное время от фиксации рекомендации до старта внедрения.",
      formula: "median(time_to_action_hours)",
      source: "artifacts/agent_benchmark_summary.json -> impact_metrics.time_to_action_p50",
      example: "Если медианное время старта внедрения равно 8 часам, карточка покажет 8.0 ч.",
    },
    {
      key: "pass_at_5",
      label: "Benchmark pass@5",
      valueLabel: formatPercentValue((benchmarkSummary.metrics.pass_at_5 ?? null) != null ? (benchmarkSummary.metrics.pass_at_5 as number) * 100 : null),
      description: "Доля benchmark-кейсов, где хотя бы один из пяти повторов завершился успешно.",
      formula: "successful_cases / total_cases * 100",
      source: "artifacts/agent_benchmark_summary.json -> metrics.pass_at_5",
      example: "Если успешно проходит 24 кейса из 30, метрика покажет 80%.",
    },
    {
      key: "fact_coverage_mean",
      label: "Покрытие фактов",
      valueLabel: formatPercentValue((benchmarkSummary.metrics.fact_coverage_mean ?? null) != null ? (benchmarkSummary.metrics.fact_coverage_mean as number) * 100 : null),
      description: "Средняя доля ожидаемых фактов, которые аналитик реально отражает в ответе.",
      formula: "avg(facts_covered / expected_facts) * 100",
      source: "artifacts/agent_benchmark_summary.json -> metrics.fact_coverage_mean",
      example: "Если в среднем закрывается 86% ожидаемых фактов, карточка покажет 86.0%.",
    },
    {
      key: "schema_valid_rate",
      label: "Валидность схемы",
      valueLabel: formatPercentValue((benchmarkSummary.metrics.schema_valid_rate ?? null) != null ? (benchmarkSummary.metrics.schema_valid_rate as number) * 100 : null),
      description: "Доля benchmark-ответов, которые прошли структурную валидацию без ошибок.",
      formula: "valid_schema_attempts / attempts_total * 100",
      source: "artifacts/agent_benchmark_summary.json -> metrics.schema_valid_rate",
      example: "Если 97 из 100 ответов валидны по схеме, метрика покажет 97.0%.",
    },
  ], [benchmarkSummary, cycle?.metrics.lesson_capture_rate, cycle?.metrics.recommendation_action_rate, cycle?.metrics.review_error_rate, cycle?.metrics.verification_pass_rate]);

  const genericTaskQualityMetrics = React.useMemo<MetricDefinition[]>(() => {
    if (!effectiveAgent) return [];
    return [
      {
        key: "tasks_in_work",
        label: "Задач в работе",
        valueLabel: String(effectiveAgent.tasks.in_work),
        description: "Текущий объём задач, над которыми агент или связанный контур сейчас работает.",
        formula: "tasks.in_work",
        source: "docs/agents/registry.yaml -> agents[].tasks.in_work",
        example: "Если в очереди активного исполнения 4 задачи, метрика покажет 4.",
      },
      {
        key: "tasks_on_control",
        label: "Задач на контроле",
        valueLabel: String(effectiveAgent.tasks.on_control),
        description: "Сколько задач ждут подтверждения, review или внешнего ответа.",
        formula: "tasks.on_control",
        source: "docs/agents/registry.yaml -> agents[].tasks.on_control",
        example: "Если 2 задачи ждут согласования, метрика покажет 2.",
      },
      {
        key: "tasks_overdue",
        label: "Просроченные задачи",
        valueLabel: String(effectiveAgent.tasks.overdue),
        description: "Количество задач, вышедших за целевой срок исполнения.",
        formula: "tasks.overdue",
        source: "docs/agents/registry.yaml -> agents[].tasks.overdue",
        example: "Если одна задача просрочена, метрика покажет 1.",
      },
    ];
  }, [effectiveAgent]);

  const operatingPlanPath = React.useMemo(() => {
    if (effectiveAgentId === PRODUCT_DESIGNER_AGENT_ID) return "docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md";
    if (effectiveAgentId === ORCHESTRATOR_AGENT_ID) return ORCHESTRATOR_OPERATING_PLAN_PATH;
    if (isAnalystAgent) return "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md";
    return asString(effectiveAgent?.runbook) || "docs/subservices/oap/README.md";
  }, [effectiveAgent?.runbook, effectiveAgentId, isAnalystAgent]);
  const flowLinkHash = effectiveAgentId ? `${ANALYST_FLOW_HASH}?agent=${effectiveAgentId}` : null;
  const agentLogPath = effectiveAgentId ? `.logs/agents/${effectiveAgentId}.jsonl` : AGENT_LOG_PATH;
  const errorLogPath = effectiveAgentId ? `.logs/agents/${effectiveAgentId}-errors.jsonl` : ".logs/agents/analyst-agent-errors.jsonl";

  const agentLogDoc = React.useMemo(
    () =>
      rawLogs.find((doc) => {
        const docPath = normalizePath(doc.path);
        return docPath === agentLogPath || docPath.endsWith(agentLogPath);
      }) ?? null,
    [agentLogPath, rawLogs],
  );

  const parsedAgentLog = React.useMemo(
    () => parseAgentLog(agentLogDoc?.content || ""),
    [agentLogDoc],
  );
  const latestSessionSkillNames = React.useMemo(() => {
    const events = parsedAgentLog.events;
    if (events.length === 0) return [];

    const latestSessionId = sessions[0]?.id || "";
    if (latestSessionId) {
      const byTask = uniqueOrdered(
        events
          .filter((event) => event.taskId === latestSessionId)
          .flatMap((event) => event.skills),
      );
      if (byTask.length > 0) return byTask;
    }

    const latestTaskId = events.find((event) => event.taskId)?.taskId || "";
    if (latestTaskId) {
      const byTask = uniqueOrdered(
        events
          .filter((event) => event.taskId === latestTaskId)
          .flatMap((event) => event.skills),
      );
      if (byTask.length > 0) return byTask;
    }

    const latestRunId = events[0]?.runId || "";
    if (latestRunId) {
      const byRun = uniqueOrdered(
        events
          .filter((event) => event.runId === latestRunId)
          .flatMap((event) => event.skills),
      );
      if (byRun.length > 0) return byRun;
    }

    return uniqueOrdered(events.flatMap((event) => event.skills));
  }, [parsedAgentLog.events, sessions]);

  const agentLogSummary = React.useMemo(() => {
    const events = parsedAgentLog.events;
    const cycleIds = new Set(events.map((event) => event.taskId).filter(Boolean));
    const runIds = new Set(events.map((event) => event.runId).filter(Boolean));
    const errorCount = events.filter((event) => {
      const status = event.status.toLowerCase();
      return Boolean(event.error) || status.includes("fail") || status.includes("error");
    }).length;
    const tokensIn = events.reduce((sum, event) => sum + (event.tokensIn || 0), 0);
    const tokensOut = events.reduce((sum, event) => sum + (event.tokensOut || 0), 0);
    return {
      cycles: cycleIds.size,
      runs: runIds.size,
      errorCount,
      tokensIn,
      tokensOut,
      lastEventAt: events[0]?.timestamp || null,
    };
  }, [parsedAgentLog]);

  const designerUxGateSignals = React.useMemo(() => {
    if (!effectiveAgent || effectiveAgentId !== PRODUCT_DESIGNER_AGENT_ID) return null;

    const overdue = effectiveAgent.tasks.overdue;
    const onControl = effectiveAgent.tasks.on_control;
    const eventsTotal = parsedAgentLog.events.length;
    const errorRate = eventsTotal > 0 ? agentLogSummary.errorCount / eventsTotal : null;
    const hasDesignerRules = isOpenablePath(DESIGNER_RULES_PATH);
    const hasDesignerOperatingPlan = isOpenablePath(DESIGNER_OPERATING_PLAN_PATH);
    const hasLessonsFile = isOpenablePath(lessonsPath);

    const checks = [
      {
        key: "priority_first_screen",
        title: "Приоритет первого экрана",
        score: overdue === 0 ? 1 : overdue === 1 ? 0.5 : 0,
        note: overdue === 0
          ? "Просроченных задач нет."
          : `Просроченных задач: ${overdue}.`,
        impact: "Скорость выполнения задачи и доля задач без возврата на доуточнение.",
      },
      {
        key: "action_clarity",
        title: "Ясность действия",
        score: onControl <= 1 ? 1 : onControl <= 2 ? 0.5 : 0,
        note: onControl <= 1
          ? "На контроле не более одной задачи."
          : `На контроле: ${onControl}.`,
        impact: "Качество выполнения задач и длительность цикла.",
      },
      {
        key: "state_typography_consistency",
        title: "Консистентность состояний и типографики",
        score: errorRate == null ? 0.5 : errorRate <= 0.03 ? 1 : errorRate <= 0.1 ? 0.5 : 0,
        note: errorRate == null
          ? "Сигналы ошибок по журналу не зафиксированы. Типографическая консистентность проверяется по UX-гейту."
          : `Доля fail/error событий: ${(errorRate * 100).toFixed(1)}%.`,
        impact: "Количество ошибок проверки, стабильность процесса и единый ритм чтения карточки.",
      },
      {
        key: "help_in_risky_points",
        title: "Пояснения в точке риска",
        score: hasDesignerRules && hasDesignerOperatingPlan ? 1 : hasDesignerRules || hasDesignerOperatingPlan ? 0.5 : 0,
        note: hasDesignerRules && hasDesignerOperatingPlan
          ? "Файлы правил и operating plan доступны в карточке."
          : "Один или оба обязательных источника недоступны в индексируемых документах.",
        impact: "Скорость старта задачи и снижение числа ручных уточнений.",
      },
      {
        key: "safe_actions_guardrails",
        title: "Защита рискованных действий",
        score: selfImprovementTasksLoading
          ? 0.5
          : selfImprovementTasksError
            ? 0
            : selfImprovementTasks.length === 0
              ? 1
              : selfImprovementTasks.length <= 2
                ? 0.5
                : 0,
        note: selfImprovementTasksLoading
          ? "Список задач самоулучшения загружается."
          : selfImprovementTasksError
            ? `Список задач самоулучшения недоступен: ${selfImprovementTasksError}.`
            : selfImprovementTasks.length === 0
              ? "Активных задач самоулучшения нет."
              : `Активных задач самоулучшения: ${selfImprovementTasks.length}.`,
        impact: "Риск регрессий, время исправлений и скорость доставки изменений.",
      },
    ] as Array<{ key: string; title: string; score: number; note: string; impact: string }>;

    const totalScore = Math.round((checks.reduce((sum, item) => sum + item.score, 0) / checks.length) * 100);
    const atRiskCount = checks.filter((item) => item.score < 1).length;
    const errorRatePct = errorRate == null ? null : Number((errorRate * 100).toFixed(1));
    const passedChecks = checks.filter((item) => item.score >= 1).length;

    return {
      checks,
      totalScore,
      atRiskCount,
      errorRatePct,
      eventsTotal,
      passedChecks,
      hasLessonsFile,
    };
  }, [
    agentLogSummary.errorCount,
    effectiveAgent,
    effectiveAgentId,
    isOpenablePath,
    lessonsPath,
    parsedAgentLog.events.length,
    selfImprovementTasks,
    selfImprovementTasksError,
    selfImprovementTasksLoading,
  ]);

  const openDesignerUxGateDetails = React.useCallback(() => {
    if (!designerUxGateSignals) return;
    const checkRows = designerUxGateSignals.checks.map((check, index) => {
      const status = check.score >= 1 ? "пройдено" : check.score >= 0.5 ? "частично" : "требует исправления";
      return [
        `${index + 1}. ${check.title}`,
        `- Статус: ${status}`,
        `- Балл проверки: ${(check.score * 100).toFixed(0)}%`,
        `- Текущий сигнал: ${check.note}`,
        `- Влияние: ${check.impact}`,
      ].join("\n");
    });

    setModal({
      open: true,
      title: "UX-гейт качества designer-agent",
      path: DESIGNER_RULES_PATH,
      updatedAt: null,
      content: [
        "# UX-гейт качества перед передачей в разработку",
        "",
        `- Итоговый балл: ${designerUxGateSignals.totalScore}%`,
        `- Пройдено проверок: ${designerUxGateSignals.passedChecks} из ${designerUxGateSignals.checks.length}`,
        `- Проверок с риском: ${designerUxGateSignals.atRiskCount}`,
        `- Доля fail/error в журнале: ${designerUxGateSignals.errorRatePct == null ? "не зафиксировано" : `${designerUxGateSignals.errorRatePct.toFixed(1)}%`}`,
        `- Lessons-файл доступен: ${designerUxGateSignals.hasLessonsFile ? "да" : "нет"}`,
        "",
        "## Формула",
        "- `ux_gate_score = avg(5 проверок) * 100`",
        "- Каждая проверка оценивается в шкале `0 / 0.5 / 1`.",
        "",
        "## Проверки",
        ...checkRows,
      ].join("\n\n"),
    });
  }, [designerUxGateSignals]);

  const nonAnalystPrimaryMetrics = React.useMemo<MetricDefinition[]>(() => {
    if (effectiveAgentId !== PRODUCT_DESIGNER_AGENT_ID || !designerUxGateSignals) {
      return genericTaskQualityMetrics;
    }

    return [
      {
        key: "designer_ux_gate_score",
        label: "UX-гейт: индекс готовности карточки",
        valueLabel: `${designerUxGateSignals.totalScore}%`,
        description: "Насколько карточка продакт-дизайнера готова к передаче в разработку без возвратов и правок.",
        formula: "ux_gate_score = avg(5 проверок) * 100, где каждая проверка в шкале 0 / 0.5 / 1",
        source: "tasks.overdue/on_control + .logs/agents/designer-agent.jsonl + docs/subservices/oap/*.md + getAgentTasks(origin_type=improvement)",
        example: "Если 4 проверки пройдены и 1 частично, итоговый индекс = 90%.",
        onClick: openDesignerUxGateDetails,
      },
      {
        key: "designer_ux_gate_risk_checks",
        label: "UX-гейт: проверки с риском",
        valueLabel: String(designerUxGateSignals.atRiskCount),
        description: "Сколько пунктов UX-гейта сейчас требуют внимания перед передачей решения в разработку.",
        formula: "count(check where check_score < 1)",
        source: "Расчет по 5 проверкам UX-гейта на данных текущей карточки.",
        example: "Если полностью пройдены 3 из 5 проверок, метрика покажет 2.",
        onClick: openDesignerUxGateDetails,
      },
      {
        key: "designer_ux_gate_log_error_rate",
        label: "UX-гейт: доля fail/error по журналу",
        valueLabel: designerUxGateSignals.errorRatePct == null ? "не зафиксировано" : `${designerUxGateSignals.errorRatePct.toFixed(1)}%`,
        description: "Операционный сигнал стабильности: какая доля событий в журнале завершилась fail/error.",
        formula: "fail_error_events / all_logged_events * 100",
        source: ".logs/agents/designer-agent.jsonl (поля status/error).",
        example: "Если fail/error было 2 из 50 событий, метрика покажет 4.0%.",
      },
      ...genericTaskQualityMetrics,
    ];
  }, [designerUxGateSignals, effectiveAgentId, genericTaskQualityMetrics, openDesignerUxGateDetails]);

  const roleViabilityMetrics = React.useMemo<MetricDefinition[]>(() => {
    if (!effectiveAgentId || isAnalystStyleAgent) return [];
    const telemetry = telemetryAgentSummary;
    return [
      {
        key: "invocation_count",
        label: "Запусков",
        valueLabel: telemetry?.invocation_count != null
          ? String(telemetry.invocation_count)
          : telemetry?.tasks_total != null
            ? String(telemetry.tasks_total)
            : "не зафиксировано",
        description: "Сколько отдельных запусков агента было за выбранный период.",
        formula: "count(distinct run_id), если run_id отсутствует — fallback на tasks_total",
        source: "artifacts/agent_telemetry_summary.json -> agents[].invocation_count",
        example: "Если агент запускался в 7 независимых run, метрика покажет 7.",
      },
      {
        key: "completed_task_count",
        label: "Завершено задач",
        valueLabel: telemetry?.completed_task_count != null
          ? String(telemetry.completed_task_count)
          : telemetry?.completed_tasks != null
            ? String(telemetry.completed_tasks)
            : "не зафиксировано",
        description: "Сколько задач агент довел до terminal success.",
        formula: "completed_tasks",
        source: "artifacts/agent_telemetry_summary.json -> agents[].completed_task_count",
        example: "Если агент успешно завершил 5 задач, метрика покажет 5.",
      },
      {
        key: "handoff_use_rate",
        label: "Использование делегирования",
        valueLabel: formatPercentValue(telemetry?.handoff_use_rate ?? null),
        description: "Как часто агент реально создавал child-run и передавал часть задачи другому агенту.",
        formula: "tasks_with_agent_instance_spawned / tasks_total * 100",
        source: "artifacts/agent_telemetry_summary.json -> agents[].handoff_use_rate",
        example: "Если в 2 из 10 задач агент делегировал часть работы, метрика покажет 20%.",
      },
      {
        key: "overlap_with_analyst_rate",
        label: "Пересечение с analyst-agent",
        valueLabel: formatPercentValue(telemetry?.overlap_with_analyst_rate ?? null),
        description: "Как часто агент участвовал в тех же задачах, что и analyst-agent.",
        formula: "shared_task_id_with_analyst / tasks_total * 100",
        source: "artifacts/agent_telemetry_summary.json -> agents[].overlap_with_analyst_rate",
        example: "Если 1 из 7 задач велась совместно с analyst-agent, метрика покажет 14.3%.",
      },
      {
        key: "verification_pass_rate",
        label: "Verify pass rate",
        valueLabel: formatPercentValue(telemetry?.verification_pass_rate ?? null),
        description: "Какая доля verify-запусков агента завершилась успешно.",
        formula: "unique task_id с verify_started и verify_passed / unique task_id с verify_started * 100",
        source: "artifacts/agent_telemetry_summary.json -> agents[].verification_pass_rate",
        example: "Если verify был начат по 4 задачам и 3 из них прошли, метрика покажет 75%.",
      },
      {
        key: "orchestration_cost_per_completed_task",
        label: "Стоимость на завершенную задачу",
        valueLabel: formatTelemetryCostValue(
          telemetry?.orchestration_cost_per_completed_task ?? null,
          telemetry?.orchestration_cost_unit,
        ),
        description: "Средняя стоимость одного завершенного цикла агента по фактическим telemetry-данным.",
        formula: "cost_total / completed_tasks, либо token_proxy / completed_tasks",
        source: "artifacts/agent_telemetry_summary.json -> agents[].orchestration_cost_per_completed_task",
        example: "Если суммарный token proxy = 5178 и закрыто 5 задач, метрика покажет 1035.60 токенов (proxy).",
      },
      {
        key: "host_adapter_sync_status",
        label: "Синхронизация host adapters",
        valueLabel: formatHostAdapterSyncValue(telemetry?.host_adapter_sync_status),
        description: "Актуален ли repo-owned агентный контракт на уровне Claude/Copilot/Codex adapters.",
        formula: "derived status по fingerprint и наличию generated host adapters",
        source: "artifacts/agent_telemetry_summary.json -> agents[].host_adapter_sync_status",
        example: "Если контракт и generated adapters пересобраны без расхождений, статус будет «синхронизированы».",
      },
    ];
  }, [effectiveAgentId, isAnalystStyleAgent, telemetryAgentSummary]);

  const analystMetricCatalog = React.useMemo<MetricCatalogItem[]>(
    () => {
      if (!isAnalystStyleAgent) return [];
      const sourceMetrics = isAnalystAgent
        ? [...efficiencyMetrics, ...primaryKeyMetrics, ...additionalEfficiencyMetrics, ...genericTaskQualityMetrics]
        : [...nonAnalystPrimaryMetrics, ...additionalEfficiencyMetrics];
      return buildMetricCatalog(sourceMetrics, effectiveAgentId);
    },
    [
      additionalEfficiencyMetrics,
      efficiencyMetrics,
      effectiveAgentId,
      genericTaskQualityMetrics,
      isAnalystAgent,
      isAnalystStyleAgent,
      nonAnalystPrimaryMetrics,
      primaryKeyMetrics,
    ],
  );

  const defaultMainMetricIds = React.useMemo<string[]>(
    () => {
      if (!isAnalystStyleAgent) return [];
      if (isAnalystAgent) {
        return ANALYST_DEFAULT_MAIN_METRIC_IDS
          .filter((metricId) => analystMetricCatalog.some((metric) => metric.metricId === metricId))
          .slice(0, METRIC_CATALOG_MAIN_LIMIT);
      }
      return analystMetricCatalog.slice(0, METRIC_CATALOG_MAIN_LIMIT).map((metric) => metric.metricId);
    },
    [analystMetricCatalog, isAnalystAgent, isAnalystStyleAgent],
  );
  const defaultExtraMetricIds = React.useMemo<string[]>(
    () => analystMetricCatalog
      .map((metric) => metric.metricId)
      .filter((metricId) => !defaultMainMetricIds.includes(metricId)),
    [analystMetricCatalog, defaultMainMetricIds],
  );

  const resolvedMetricZones = React.useMemo(
    () =>
      resolveMetricZoneIds({
        catalog: analystMetricCatalog,
        preferences: metricPreferences,
        defaultMainMetricIds,
        defaultExtraMetricIds,
      }),
    [analystMetricCatalog, defaultExtraMetricIds, defaultMainMetricIds, metricPreferences],
  );

  const effectiveMainMetricIds = resolvedMetricZones.mainMetricIds;
  const effectiveExtraMetricIds = resolvedMetricZones.extraMetricIds;

  const analystMetricCatalogById = React.useMemo(() => {
    const map = new Map<string, MetricCatalogItem>();
    for (const metric of analystMetricCatalog) {
      map.set(metric.metricId, metric);
    }
    return map;
  }, [analystMetricCatalog]);

  const configuredMainMetrics = React.useMemo<MetricDefinition[]>(
    () => effectiveMainMetricIds
      .map((metricId) => analystMetricCatalogById.get(metricId))
      .filter((metric): metric is MetricCatalogItem => Boolean(metric)),
    [analystMetricCatalogById, effectiveMainMetricIds],
  );

  const configuredExtraMetrics = React.useMemo<MetricDefinition[]>(
    () => effectiveExtraMetricIds
      .map((metricId) => analystMetricCatalogById.get(metricId))
      .filter((metric): metric is MetricCatalogItem => Boolean(metric)),
    [analystMetricCatalogById, effectiveExtraMetricIds],
  );

  React.useEffect(() => {
    if (!isAnalystStyleAgent || !effectiveAgentId) {
      setMetricPreferences(null);
      setMetricPreferencesLoading(false);
      setMetricPreferencesNotice(null);
      return;
    }

    if (!viewerId) {
      setMetricPreferences(null);
      setMetricPreferencesLoading(false);
      setMetricPreferencesNotice("Профиль настроек недоступен: браузер не выдал идентификатор пользователя. Применяются метрики по умолчанию.");
      return;
    }

    const controller = new AbortController();
    let active = true;
    setMetricPreferencesLoading(true);
    setMetricPreferencesNotice(null);

    void metricPreferencesRpcCall<unknown>(
      "get_agent_metric_preferences",
      {
        p_agent_id: effectiveAgentId,
        p_viewer_id: viewerId,
      },
      controller.signal,
    )
      .then((payload) => {
        if (!active) return;
        const normalized = normalizeAgentMetricPreferences(payload, effectiveAgentId, viewerId);
        setMetricPreferences(normalized);
        if (normalized) {
          writeCachedMetricPreferences(normalized);
        }
      })
      .catch(() => {
        if (!active || controller.signal.aborted) return;
        const cached = readCachedMetricPreferences(effectiveAgentId, viewerId);
        if (cached) {
          setMetricPreferences(cached);
          setMetricPreferencesNotice("Сервис профилей временно недоступен. Используется локальный кэш настроек метрик.");
          return;
        }
        setMetricPreferences(null);
        setMetricPreferencesNotice("Сервис профилей временно недоступен. Показан стандартный набор метрик.");
      })
      .finally(() => {
        if (active) setMetricPreferencesLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [effectiveAgentId, isAnalystStyleAgent, viewerId]);

  const setMetricCatalogDraftNormalized = React.useCallback((nextDraft: MetricSelectionDraft) => {
    const allowedMetricIds = new Set(analystMetricCatalog.map((metric) => metric.metricId));
    const mainMetricIds = uniqueStringsOrdered(nextDraft.mainMetricIds.filter((id) => allowedMetricIds.has(id)))
      .slice(0, METRIC_CATALOG_MAIN_LIMIT);
    const extraMetricIds = uniqueStringsOrdered(nextDraft.extraMetricIds.filter((id) => allowedMetricIds.has(id) && !mainMetricIds.includes(id)));
    setMetricsCatalogDraft({ mainMetricIds, extraMetricIds });
  }, [analystMetricCatalog]);

  React.useEffect(() => {
    if (!isMetricsCatalogDialogOpen) return;
    if (metricsCatalogDraft) return;
    setMetricCatalogDraftNormalized({
      mainMetricIds: effectiveMainMetricIds,
      extraMetricIds: effectiveExtraMetricIds,
    });
  }, [
    effectiveExtraMetricIds,
    effectiveMainMetricIds,
    isMetricsCatalogDialogOpen,
    metricsCatalogDraft,
    setMetricCatalogDraftNormalized,
  ]);

  const resetMetricCatalogDraftToDefaults = React.useCallback(() => {
    const nextMain = uniqueStringsOrdered(defaultMainMetricIds).slice(0, METRIC_CATALOG_MAIN_LIMIT);
    const nextExtra = uniqueStringsOrdered(defaultExtraMetricIds).filter((id) => !nextMain.includes(id));
    setMetricsCatalogDraft({
      mainMetricIds: nextMain,
      extraMetricIds: nextExtra,
    });
  }, [defaultExtraMetricIds, defaultMainMetricIds]);

  const closeMetricsCatalogWithCleanup = React.useCallback(() => {
    setMetricsCatalogDraft(null);
    closeMetricsCatalogDialog();
  }, [closeMetricsCatalogDialog]);

  const saveMetricCatalog = React.useCallback(async () => {
    if (!effectiveAgentId || !metricsCatalogDraft) {
      closeMetricsCatalogWithCleanup();
      return;
    }

    if (!isAnalystStyleAgent) {
      closeMetricsCatalogWithCleanup();
      return;
    }

    const normalizedMain = uniqueStringsOrdered(metricsCatalogDraft.mainMetricIds).slice(0, METRIC_CATALOG_MAIN_LIMIT);
    const normalizedExtra = uniqueStringsOrdered(metricsCatalogDraft.extraMetricIds).filter((id) => !normalizedMain.includes(id));

    if (!viewerId) {
      const localPrefs: AgentMetricPreferences = {
        agentId: effectiveAgentId,
        viewerId: "local-only",
        mainMetricIds: normalizedMain,
        extraMetricIds: normalizedExtra,
        updatedAt: new Date().toISOString(),
      };
      setMetricPreferences(localPrefs);
      setMetricPreferencesNotice("Изменения применены локально в сессии браузера. Идентификатор пользователя не доступен.");
      setAdditionalMetricsOpen(false);
      closeMetricsCatalogWithCleanup();
      return;
    }

    setMetricPreferencesSaving(true);
    try {
      const payload = await metricPreferencesRpcCall<unknown>("upsert_agent_metric_preferences", {
        p_agent_id: effectiveAgentId,
        p_viewer_id: viewerId,
        p_main_metric_ids: normalizedMain,
        p_extra_metric_ids: normalizedExtra,
      });
      const normalizedPayload = normalizeAgentMetricPreferences(payload, effectiveAgentId, viewerId);
      const payloadRow = Array.isArray(payload) ? toRecord(payload[0]) : toRecord(payload);
      const updatedAt = normalizedPayload?.updatedAt || asString(payloadRow?.updated_at) || new Date().toISOString();
      const nextPreferences: AgentMetricPreferences = {
        agentId: effectiveAgentId,
        viewerId,
        mainMetricIds: normalizedMain,
        extraMetricIds: normalizedExtra,
        updatedAt,
      };
      setMetricPreferences(nextPreferences);
      writeCachedMetricPreferences(nextPreferences);
      setMetricPreferencesNotice(null);
    } catch (error) {
      const nextPreferences: AgentMetricPreferences = {
        agentId: effectiveAgentId,
        viewerId,
        mainMetricIds: normalizedMain,
        extraMetricIds: normalizedExtra,
        updatedAt: new Date().toISOString(),
      };
      setMetricPreferences(nextPreferences);
      writeCachedMetricPreferences(nextPreferences);
      const message = error instanceof Error ? error.message : "неизвестная ошибка";
      setMetricPreferencesNotice(`Сервис профилей временно недоступен. Изменения сохранены локально (${message}).`);
    } finally {
      setMetricPreferencesSaving(false);
      setAdditionalMetricsOpen(false);
      closeMetricsCatalogWithCleanup();
    }
  }, [
    closeMetricsCatalogWithCleanup,
    effectiveAgentId,
    isAnalystStyleAgent,
    metricsCatalogDraft,
    viewerId,
  ]);

  const filteredAgentLogEvents = React.useMemo(() => {
    const q = normalizeLoose(agentLogSearch);
    if (!q) return parsedAgentLog.events;
    return parsedAgentLog.events.filter((event) => {
      const haystack = normalizeLoose([
        event.timestamp ? formatDateTimeLong(event.timestamp) : "",
        event.step,
        event.status,
        event.taskId,
        event.runId,
        event.traceId,
        event.recommendationId,
        event.outcome,
        event.process,
        event.error || "",
        ...event.mcpTools,
        ...event.tools,
        ...event.skills,
        ...event.artifactsRead,
        ...event.artifactsWritten,
      ].join(" "));
      return haystack.includes(q);
    });
  }, [agentLogSearch, parsedAgentLog]);

  const handleOpenContent = React.useCallback(
    (title: string, content: string) => {
      setModal({ open: true, title, content, path: null, updatedAt: null });
    },
    [],
  );

  const handleOpenFile = React.useCallback(
    (path: string) => {
      const doc = resolveDocByPath(path);

      if (doc) {
        setModal({ open: true, title: doc.title, content: doc.content, path: doc.path, updatedAt: doc.updatedAt });
        return;
      }

      const bpmnDiagram = buildPathLookupKeys(path)
        .map((key) => bpmnByLookupKey.get(key) ?? null)
        .find(Boolean);
      if (bpmnDiagram) {
        setModal({
          open: true,
          title: `BPMN: ${path.split("/").pop()?.replace(/\.bpmn$/i, "") || bpmnDiagram.id}`,
          content: "Загрузка BPMN...",
          path: bpmnDiagram.sourcePath,
          updatedAt: bpmnDiagram.updatedAt,
        });

        void fetch(bpmnDiagram.filePath, { cache: "no-store" })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            const content = await response.text();
            setModal({
              open: true,
              title: `BPMN: ${path.split("/").pop()?.replace(/\.bpmn$/i, "") || bpmnDiagram.id}`,
              content,
              path: bpmnDiagram.sourcePath,
              updatedAt: bpmnDiagram.updatedAt,
            });
          })
          .catch(() => {
            setModal({
              open: true,
              title: `BPMN: ${path.split("/").pop()?.replace(/\.bpmn$/i, "") || bpmnDiagram.id}`,
              content: `Не удалось загрузить BPMN по пути \`${bpmnDiagram.filePath}\`.`,
              path: bpmnDiagram.sourcePath,
              updatedAt: bpmnDiagram.updatedAt,
            });
          });
        return;
      }

      setModal({
        open: true,
        title: path.split("/").pop() ?? path,
        content: `Содержимое файла \`${path}\` не найдено в индексе документов.`,
        path,
        updatedAt: null,
      });
    },
    [bpmnByLookupKey, resolveDocByPath],
  );

  const handleCloseAgentLog = React.useCallback(() => {
    setAgentLogOpen(false);
    setAgentLogSearch("");
  }, []);

  const handleOpenAgentFromTaskDetails = React.useCallback((agentId: string) => {
    const normalized = asString(agentId);
    if (!normalized) return;
    const hash = `#/agents?agent=${encodeURIComponent(normalized)}&tab=overview`;
    if (window.location.hash !== hash) {
      window.history.replaceState({}, "", hash);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
    setSelectedSelfImprovementTaskId(null);
    setSelfImprovementTasksOpen(false);
  }, []);

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: { xs: "100vw", md: 900 },
            maxWidth: "100vw",
            bgcolor: "background.default",
          },
        }}
      >
        {/* Sticky header */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            bgcolor: "background.paper",
            borderBottom: 1,
            borderColor: "divider",
            px: 2.5,
            py: 1.5,
          }}
        >
          <Stack direction="row" alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              {effectiveAgent?.name ?? "Агент"}
            </Typography>
            <IconButton onClick={onClose} aria-label="Закрыть">
              <CloseIcon />
            </IconButton>
          </Stack>
        </Box>

        {/* Scrollable content */}
        <Box sx={{ overflowY: "auto", flex: 1 }}>
          {!effectiveAgent ? (
            <Box sx={{ p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Данные агента не найдены.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={2} sx={{ p: 2.5 }}>
              {showOverviewSection ? <HeaderSection agent={effectiveAgent} lastRunAt={lastRunAt ?? effectiveAgent.updatedAt} /> : null}
              {showTasksSection ? <SectionBlock
                title="Анализ эффективности агента"
                tooltip="Единый блок эффективности агента: ключевые фактические метрики цикла, нагрузки и результата в одном формате."
              >
                {isAnalystStyleAgent && metricPreferencesNotice ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      bgcolor: "rgba(245, 158, 11, 0.08)",
                      borderColor: "rgba(245, 158, 11, 0.35)",
                    }}
                  >
                    <Typography variant="caption" sx={{ color: "warning.dark" }}>
                      {metricPreferencesNotice}
                    </Typography>
                  </Paper>
                ) : null}
                {isAnalystStyleAgent ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Бейдж «Ключевая» отмечает метрики бизнес-результата агента. На карточке показывается не более {METRIC_CATALOG_MAIN_LIMIT} метрик.
                  </Typography>
                ) : null}
                <Stack spacing={1}>
                  {(isAnalystStyleAgent ? configuredMainMetrics : nonAnalystPrimaryMetrics).length === 0 ? (
                    <Paper variant="outlined" sx={{ p: 1.2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Метрики не выбраны. Откройте «Настроить метрики», чтобы собрать свой набор.
                      </Typography>
                    </Paper>
                  ) : (isAnalystStyleAgent ? configuredMainMetrics : nonAnalystPrimaryMetrics).map((metric) => (
                    <AnalystMetricRow key={metric.key} metric={metric} />
                  ))}
                </Stack>
                {!isAnalystStyleAgent && roleViabilityMetrics.length > 0 ? (
                  <Stack spacing={1} sx={{ pt: 0.5 }}>
                    <Typography variant="subtitle2">Жизнеспособность роли</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Показывает, нужен ли агент как отдельная активная роль: фактические запуски, завершенные задачи,
                      делегирование, verify и синхронизацию host adapters.
                    </Typography>
                    <Stack spacing={1}>
                      {roleViabilityMetrics.map((metric) => (
                        <AnalystMetricRow key={`viability-${metric.key}`} metric={metric} />
                      ))}
                    </Stack>
                  </Stack>
                ) : null}
                {isAnalystStyleAgent ? (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.25 }}>
                    <Link
                      component="button"
                      type="button"
                      underline="always"
                      onClick={() => setAdditionalMetricsOpen(true)}
                      sx={{ fontWeight: 600, textAlign: "left" }}
                    >
                      Открыть остальные метрики
                    </Link>
                    <Button size="small" variant="outlined" onClick={openMetricsCatalogDialog}>Настроить метрики</Button>
                    {metricPreferencesLoading ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.35 }}>
                        Загружаю профиль метрик...
                      </Typography>
                    ) : null}
                  </Stack>
                ) : (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap" sx={{ pt: 0.25 }}>
                    <Link
                      component="button"
                      type="button"
                      underline="always"
                      onClick={() => setAdditionalMetricsOpen(true)}
                      sx={{ fontWeight: 600, textAlign: "left" }}
                    >
                      Открыть остальные метрики
                    </Link>
                    <Button size="small" variant="outlined" onClick={openMetricsCatalogDialog}>
                      Каталог метрик
                    </Button>
                  </Stack>
                )}
              </SectionBlock> : null}
              {showOverviewSection ? <AgentProcessSection
                operatingPlan={effectiveAgent.operatingPlan}
                doneGatePolicy={effectiveAgent.doneGatePolicy}
                shortDescription={effectiveAgent.shortDescription}
                memoryContext={effectiveAgent.memoryContext}
                operatingPlanPath={operatingPlanPath}
                flowLinkHash={flowLinkHash}
                hasSessions={true}
                lessonsPath={lessonsPath}
                onOpenFile={handleOpenFile}
                onOpenLessonsModal={() => openLessonsModal("agent")}
                onOpenSessionsList={() => openSessionsModal("latest")}
                onOpenImprovementHistory={openImprovementHistoryDialog}
              /> : null}
              {showSkillsSection ? <SkillsSection
                agent={effectiveAgent}
                latestSessionSkillNames={latestSessionSkillNames}
                onOpenFile={handleOpenFile}
              /> : null}
              {showMemorySection ? <MemorySection
                memoryContext={effectiveAgent.memoryContext}
                onOpenFile={handleOpenFile}
                operativeMemoryEntries={operativeMemoryEntries}
                operativeMemoryTrace={operativeMemoryModalTrace}
                operativeMemorySessionId={operativeMemoryModalSession?.id ?? null}
                operativeMemoryDefaultSessionId={activeMemorySession?.id ?? null}
                operativeMemoryModalOpen={isOperativeMemoryModalOpen}
                onOpenOperativeMemoryModal={openOperativeMemoryModal}
                onCloseOperativeMemoryModal={closeOperativeMemoryModal}
                resolveFilePreview={resolveFilePreview}
                persistentMemoryEntries={persistentMemoryEntries}
                isPathOpenable={isOpenablePath}
                selfImprovementLessonsPath={lessonsPath}
                selfImprovementTasksCount={selfImprovementTasks.length}
                selfImprovementTasksLoading={selfImprovementTasksLoading}
                onOpenSelfImprovementTasks={() => setSelfImprovementTasksOpen(true)}
              /> : null}
              {showTasksSection ? <RisksSection memoryContext={effectiveAgent.memoryContext} /> : null}
              {showImprovementsSection && !isAnalystAgent ? renderNonAnalystImprovements() : null}
            </Stack>
          )}
        </Box>
      </Drawer>

      <Dialog
        open={agentLogOpen}
        onClose={handleCloseAgentLog}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            borderRadius: 2,
            minHeight: { md: "78vh" },
          },
        }}
      >
        <DialogTitle sx={{ pb: 1.25 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Журнал действий агента
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                Лента телеметрии из <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{agentLogDoc?.path || agentLogPath}</Box>.
                Здесь видно шаги цикла, токены, задействованные MCP/навыки, артефакты и ошибки.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.6 }}>
                Последнее событие: {agentLogSummary.lastEventAt ? formatDateTimeLong(agentLogSummary.lastEventAt) : "не найдено"}
              </Typography>
            </Box>
            <IconButton onClick={handleCloseAgentLog} aria-label="Закрыть журнал действий агента">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
              <AgentLogSummaryCard
                title="События"
                value={String(parsedAgentLog.events.length)}
                note={parsedAgentLog.invalidLines > 0 ? `Неразобранных строк: ${parsedAgentLog.invalidLines}` : "Все строки разобраны"}
              />
              <AgentLogSummaryCard
                title="Циклы"
                value={String(agentLogSummary.cycles)}
                note={`Запусков: ${agentLogSummary.runs}`}
              />
              <AgentLogSummaryCard
                title="Ошибки"
                value={String(agentLogSummary.errorCount)}
                note="event.error + fail/error статусы"
              />
              <AgentLogSummaryCard
                title="Токены"
                value={formatTokens(agentLogSummary.tokensIn + agentLogSummary.tokensOut)}
                note={`in ${formatTokens(agentLogSummary.tokensIn)} / out ${formatTokens(agentLogSummary.tokensOut)}`}
              />
            </Stack>

            <Paper variant="outlined" sx={{ p: 1.25, bgcolor: "background.paper" }}>
              <TextField
                size="small"
                fullWidth
                label="Поиск по дате, времени, шагу, статусу, trace, outcome"
                placeholder="Например: 03.03.2026, 10:01, verify, context7, recommendation"
                value={agentLogSearch}
                onChange={(event) => setAgentLogSearch(event.target.value)}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                Найдено событий: {filteredAgentLogEvents.length} из {parsedAgentLog.events.length}
              </Typography>
            </Paper>

            {parsedAgentLog.events.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Лог не найден или пока не содержит событий.
                </Typography>
              </Paper>
            ) : filteredAgentLogEvents.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  По текущему запросу совпадений нет. Проверь дату, время, `trace_id`, шаг или статус.
                </Typography>
              </Paper>
            ) : (
              <Stack spacing={1}>
                {filteredAgentLogEvents.map((event) => (
                  <AgentLogEventRow key={`${event.id}-${event.line}`} event={event} onOpenFile={handleOpenFile} />
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={agentErrorsOpen}
        onClose={() => setAgentErrorsOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ pb: 1.2 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Ошибки по циклам агента
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                Список ошибок и предупреждений по циклам агента. Источник: <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{errorLogPath}</Box> и telemetry event.error.
              </Typography>
            </Box>
            <IconButton onClick={() => setAgentErrorsOpen(false)} aria-label="Закрыть модалку ошибок агента">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Paper variant="outlined" sx={{ p: 1.1 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                <Typography variant="body2">
                  Всего записей: <strong>{efficiency?.errorEntries.length ?? 0}</strong>
                </Typography>
                <Typography variant="body2">
                  Среднее на цикл: <strong>{formatAverageCount(efficiency?.averageErrorsPerCycle ?? null)}</strong>
                </Typography>
                <Typography variant="body2">
                  Циклов в расчете: <strong>{efficiency?.cyclesTotal ?? 0}</strong>
                </Typography>
              </Stack>
            </Paper>

            {efficiency?.errorEntries.length ? (
              efficiency.errorEntries.map((entry) => (
                <ErrorEntryCard key={entry.id} entry={entry} onOpenFile={handleOpenFile} canOpenPath={isOpenablePath} />
              ))
            ) : (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Ошибки по циклам пока не зафиксированы.
                </Typography>
              </Paper>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <MetricsDialog
        open={additionalMetricsOpen}
        onClose={() => setAdditionalMetricsOpen(false)}
        title="Остальные метрики эффективности"
        subtitle={isAnalystStyleAgent
          ? "Дополнительные workflow и benchmark-показатели агента. Каждая метрика раскрывается через tooltip с формулой, источником и примером."
          : "Дополнительные показатели агента в том же формате: значение, объяснение, формула и источник данных."}
        metrics={isAnalystStyleAgent ? configuredExtraMetrics : additionalEfficiencyMetrics}
        actions={(
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setAdditionalMetricsOpen(false);
              openMetricsCatalogDialog();
            }}
          >
            {isAnalystStyleAgent ? "Изменить набор метрик" : "Открыть каталог метрик"}
          </Button>
        )}
      />

      <MetricsCatalogDialog
        open={Boolean(isMetricsCatalogDialogOpen && metricsCatalogDraft)}
        onClose={closeMetricsCatalogWithCleanup}
        catalog={analystMetricCatalog}
        draft={metricsCatalogDraft ?? { mainMetricIds: effectiveMainMetricIds, extraMetricIds: effectiveExtraMetricIds }}
        onChangeDraft={setMetricCatalogDraftNormalized}
        onResetDefaults={resetMetricCatalogDraftToDefaults}
        onSave={saveMetricCatalog}
        isLoading={metricPreferencesLoading}
        isSaving={metricPreferencesSaving}
        notice={metricPreferencesNotice}
        agentName={effectiveAgent?.name || effectiveAgentId || "Агент"}
        isCustomizable={isAnalystStyleAgent}
      />

      <Drawer
        anchor="right"
        open={isSessionsModalOpen}
        onClose={closeSessionsModal}
        PaperProps={{ sx: { width: { xs: "100vw", md: 760 }, maxWidth: "100vw", bgcolor: "background.default" } }}
      >
        <Box sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", px: 2.5, py: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              Список сессий цикла агента
            </Typography>
            <IconButton onClick={closeSessionsModal} aria-label="Закрыть список сессий">
              <CloseIcon />
            </IconButton>
          </Stack>
          <TextField
            size="small"
            fullWidth
            label="Поиск по дате и времени"
            placeholder="Например: 27.02, 14:32, 2026-02-27"
            value={sessionsSearch}
            onChange={(event) => setSessionsSearch(event.target.value)}
            sx={{ mt: 1.25 }}
          />
        </Box>

        <Box sx={{ p: 2.5, overflowY: "auto" }}>
          {sessionsDataFreshnessWarning ? (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Generated-данные устарели: последний `generated_at` {formatDateTime(sessionsDataFreshnessWarning.generatedAt)},
              но в telemetry есть более новое событие от {formatDateTime(sessionsDataFreshnessWarning.newestTelemetryAt)}.
              Обновите данные: `make agent-telemetry-report` и `npm --prefix ops-web run prepare-content`.
            </Alert>
          ) : null}
          {filteredSessions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {sessions.length === 0 ? "Сессии цикла пока не зафиксированы." : "Сессии по заданному поиску не найдены."}
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {filteredSessions.map((session, index) => (
                <Accordion
                  key={session.id}
                  disableGutters
                  elevation={0}
                  sx={{ border: 1, borderColor: "divider", borderRadius: "8px", "&:before": { display: "none" } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ width: "100%" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        №{filteredSessions.length - index}
                      </Typography>
                      <Typography variant="body2">{formatDateTime(session.completedAt)}</Typography>
                      <Chip size="small" variant="outlined" label={`${cycleTasksMap.get(session.taskId) ?? 0} задач`} />
                      <Chip
                        size="small"
                        variant="outlined"
                        color={session.participationMode === "delegated" ? "info" : "default"}
                        label={session.participationMode}
                      />
                      {session.errorsCount > 0 ? <Chip size="small" color="error" variant="outlined" label={`${session.errorsCount} ошибок`} /> : null}
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        <strong>Начало:</strong> {formatDateTime(session.startedAt)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Завершение:</strong> {formatDateTime(session.completedAt)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Длительность:</strong> {formatDuration(session.durationMs)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Участие:</strong> {session.participationMode}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Источник:</strong> {session.sourceAgentId}
                      </Typography>
                      {session.rootAgentId ? (
                        <Typography variant="body2">
                          <strong>Root Agent:</strong> {session.rootAgentId}
                        </Typography>
                      ) : null}
                      {session.runId ? (
                        <Typography variant="body2">
                          <strong>Run ID:</strong> {session.runId}
                        </Typography>
                      ) : null}
                      <Typography variant="body2">
                        <strong>Токены:</strong> {formatTokens(session.tokensUsed)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Риски:</strong> {session.risksCount}
                      </Typography>
                      <Link
                        component="button"
                        type="button"
                        underline="hover"
                        variant="body2"
                        sx={{ fontWeight: 600, alignSelf: "flex-start" }}
                        onClick={() => setSelectedSession(session)}
                      >
                        Открыть детали сессии
                      </Link>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          )}
        </Box>
      </Drawer>

      <LessonsDrawer
        open={isLessonsModalOpen}
        onClose={closeLessonsModal}
        lessonsPath={lessonsPath}
        onOpenFile={handleOpenFile}
        agentId={effectiveAgentId}
        activeEntity={lessonsRouteEntity}
        onEntityChange={handleLessonsEntityChange}
      />

      <Drawer
        anchor="right"
        open={selfImprovementTasksOpen}
        onClose={() => {
          setSelfImprovementTasksOpen(false);
          setSelectedSelfImprovementTaskId(null);
        }}
        PaperProps={{ sx: { width: { xs: "100vw", md: 620 }, maxWidth: "100vw", bgcolor: "background.default" } }}
      >
        <Box sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", px: 2.5, py: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              Актуальные задачи самоулучшения агента
            </Typography>
            <IconButton
              onClick={() => {
                setSelfImprovementTasksOpen(false);
                setSelectedSelfImprovementTaskId(null);
              }}
              aria-label="Закрыть список задач самоулучшения"
            >
              <CloseIcon />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
            Память и правила: {lessonsPath}
          </Typography>
        </Box>

        <Box sx={{ p: 2.5, overflowY: "auto" }}>
          {selfImprovementTasksLoading ? (
            <Typography variant="body2" color="text.secondary">
              Загружаю список задач...
            </Typography>
          ) : selfImprovementTasksError ? (
            <Typography variant="body2" color="error.main">
              Не удалось загрузить задачи: {selfImprovementTasksError}
            </Typography>
          ) : selfImprovementTasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Сейчас нет актуальных задач для самоулучшения.
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {selfImprovementTasks.map((task) => (
                <Paper
                  key={task.id}
                  variant="outlined"
                  sx={{
                    p: 1.1,
                    cursor: "pointer",
                    "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
                  }}
                  onClick={() => setSelectedSelfImprovementTaskId(task.id)}
                >
                  <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                    <Link
                      component="button"
                      type="button"
                      underline="hover"
                      variant="body2"
                      sx={{ fontWeight: 600, flex: 1, minWidth: 240, textAlign: "left", color: "text.primary" }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedSelfImprovementTaskId(task.id);
                      }}
                    >
                      {task.title}
                    </Link>
                    <Chip size="small" variant="outlined" label={task.stage_label || task.status} />
                    {task.executor_agent_id === PRODUCT_DESIGNER_AGENT_ID ? (
                      <Chip size="small" color="info" variant="outlined" label="Продакт дизайнер" />
                    ) : null}
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Drawer>

      <TaskDetailsDrawer
        open={Boolean(selectedSelfImprovementTaskId)}
        taskId={selectedSelfImprovementTaskId}
        onClose={() => setSelectedSelfImprovementTaskId(null)}
        onOpenAgent={handleOpenAgentFromTaskDetails}
        serviceMode={selfImprovementTasks.find((t) => t.id === selectedSelfImprovementTaskId)?.service_mode}
      />

      <SessionDetailsDrawer
        open={!!selectedSession}
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        onResolveFile={resolveDocByPath}
        cycleTaskCount={selectedSession ? (cycleTasksMap.get(selectedSession.taskId) ?? 0) : null}
      />

      <ImprovementHistoryModal
        open={isImprovementHistoryDialogOpen}
        onClose={closeImprovementHistoryDialog}
        agentName={effectiveAgent?.name || effectiveAgentId || "Агент"}
        events={improvementHistoryEvents}
        onOpenFile={handleOpenFile}
      />

      <TextContentModal
        open={modal.open}
        title={modal.title}
        content={modal.content}
        path={modal.path}
        updatedAt={modal.updatedAt}
        onClose={() => setModal(EMPTY_MODAL)}
      />
    </>
  );
}
