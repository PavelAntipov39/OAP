import React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";

import {
  getAgentsManifest,
  getAgentBenchmarkSummary,
  getDocsIndex,
  getOapKbIndex,
  getOapKbRawLogs,
  type AgentBenchmarkSummary,
  type AgentMcpServer,
  type AgentMemoryContext,
  type OapKbDocument,
  type AgentSummary,
  type DocsDocument,
} from "../lib/generatedData";
import { getAgentTasks } from "../lib/tasksApi";
import { TextContentModal } from "../components/TextContentModal";
import { MemoryContextPanel } from "../components/agent-memory/MemoryContextPanel";
import { TaskDetailsDrawer } from "../components/tasks/TaskDetailsDrawer";
import { AnalystCardDrawer } from "../components/analyst-card/AnalystCardDrawer";
import {
  LEGACY_TAB_KEYS,
  MODERN_TAB_KEYS,
  buildAgentsHash,
  canonicalizeState,
  parseAgentsHash,
  type AgentTabKey,
} from "../lib/agentsRouteState";

type StatusFilter = "all" | "healthy" | "degraded" | "offline";

type UsedMcpStatus = "active" | "reauth_required" | "degraded" | "offline";

type AgentMeta = AgentSummary & {
  shortDescription?: string | null;
  processLink?: { title?: string; url?: string } | null;
  usedMcp?: Array<{
    name: string;
    status: UsedMcpStatus | string;
    note?: string | null;
    lastUsedAt?: string | null;
    practicalTasks?: string[] | null;
    impactInNumbers?: string | null;
  }>;
  availableMcp?: Array<{
    name: string;
    whyUseful?: string | null;
    description?: string | null;
    whenToUse?: string | null;
    expectedEffect?: string | null;
    basis?: string | null;
    practicalTasks?: string[] | null;
    link?: string | null;
    installComplexity?: string | null;
  }>;
  contextRefs?: Array<{ title: string; filePath: string; pathHint?: string | null; sourceUrl?: string | null }>;
  memoryContext?: AgentMemoryContext | null;
  rulesApplied?: Array<{
    title?: string | null;
    location?: string | null;
    description?: string | null;
    fullText?: string | null;
    sourceUrl?: string | null;
  }>;
  usedSkills?: Array<{
    name: string;
    usage?: string | null;
    fullText?: string | null;
    practicalTasks?: string[] | null;
    lastUsedAt?: string | null;
    skillFilePath?: string | null;
    skillFileText?: string | null;
    skillFileLoaded?: boolean | null;
  }>;
  usedTools?: Array<{
    name: string;
    usage: string;
    fullText: string;
    source: string;
    practicalTasks?: string[] | null;
    lastUsedAt?: string | null;
  }>;
  availableTools?: Array<{
    name: string;
    benefit: string;
    recommendationBasis: string;
    expectedEffect: string;
    fullText: string;
    source: string;
    practicalTasks?: string[] | null;
  }>;
  availableSkills?: Array<{
    name: string;
    benefit?: string | null;
    fullText?: string | null;
    recommendationBasis?: string | null;
    expectedEffect?: string | null;
    practicalTasks?: string[] | null;
    link?: string | null;
  }>;
  taskEvents?: Array<{ id: string; title: string; completedAt: string; reviewErrors: number }>;
  analystRecommendations?: string[];
  improvements?: Array<{
    title: string;
    problem: string;
    solution: string;
    effect: string;
    priority: string;
    createdAt?: string | null;
    section?: string | null;
    ownerSection: string;
    detectionBasis: string;
    promptPath: string;
    promptTitle: string;
    promptMarkdown: string;
    promptSourceUrl: string;
    targetMetric: string;
    baselineWindow: string;
    expectedDelta: string;
    validationDate: string;
    ice: { impact: number; confidence: number; ease: number };
  }>;
  operatingPlan?: {
    mission: string;
    dailyLoop: string[];
    sourcePolicy: {
      mode: string;
      whitelist: string[];
      updateRule: string;
      validationCriteria: string[];
    };
    notificationPolicy: {
      mode: string;
      criticalCases: string[];
      digestFields: string[];
    };
    improvementLifecycle: string[];
    metricsCatalog: {
      agents: string[];
      analyst: string[];
    };
    decisionRules: string[];
  } | null;
  workflowPolicy?: {
    planDefault: boolean;
    replanOnDeviation: boolean;
    verifyBeforeDone: boolean;
    selfImprovementLoop: boolean;
    autonomousBugfix: boolean;
  } | null;
  learningArtifacts?: {
    todoPath: string;
    lessonsPath: string;
    lastLessonAt?: string | null;
  } | null;
  workflowMetricsCatalog?: string[];
  doneGatePolicy?: {
    mode: "soft_warning" | "strict";
    requiredChecks: string[];
    fallbackStatus: string;
  } | null;
};

type TelemetrySummaryAgent = {
  agent_id?: string;
  tasks_total?: number;
  completed_tasks?: number;
  plan_signal_tasks?: number;
  recommendations_suggested?: number;
  recommendations_applied?: number;
  recommendation_action_rate?: number;
  plan_coverage_rate?: number;
  verification_pass_rate?: number;
  lesson_capture_rate?: number;
  replan_rate?: number;
  autonomous_bugfix_rate?: number;
  elegance_gate_rate?: number;
  p95_duration_ms?: number;
  status_counts?: Record<string, number>;
};

type TelemetrySummaryReport = {
  totals?: {
    agents_total?: number;
    recommendations_suggested?: number;
    recommendations_applied?: number;
    recommendation_action_rate?: number;
  };
  agents?: TelemetrySummaryAgent[];
};

type ImprovementViewModel = {
  key: string;
  title: string;
  createdAt: string | null;
  section: string;
  ownerSection: string;
  problem: string;
  solution: string;
  effect: string;
  basis: string;
  targetMetric: string;
  baselineWindow: string;
  expectedDelta: string;
  validationDate: string;
  ice: { impact: number; confidence: number; ease: number; score: number };
  promptTitle: string;
  promptMarkdown: string;
  promptPath: string | null;
  promptSourceUrl: string | null;
};

type MetricDisplayItem = {
  key: string;
  label: string;
  description: string;
  valueLabel: string;
  formula: string;
  source: string;
};

type SectionKey = "mcp" | "skills_rules" | "tasks_quality" | "memory_context" | "improvements";
type TaskLookupSource = "task_event" | "review_error";
type IndexedDocument = DocsDocument | OapKbDocument;
type AgentLogEventRecord = {
  timestamp: string;
  status: string;
  step: string;
  task_id: string;
  run_id: string;
  trace_id: string;
  recommendation_id: string;
  outcome: string;
  mcp_tools: string[];
  line: number;
};
type ParsedAgentLogTimeline = {
  events: AgentLogEventRecord[];
  invalidLines: number;
  totalLines: number;
};
const MODERN_AGENT_IDS = new Set(["analyst-agent", "designer-agent"]);
const OPERATING_PLAN_PATH_FALLBACKS: Record<string, string> = {
  "analyst-agent": "docs/subservices/oap/ANALYST_OPERATING_PLAN.md",
  "designer-agent": "docs/subservices/oap/DESIGNER_OPERATING_PLAN.md",
};

function isModernAgent(agentId: string): boolean {
  return MODERN_AGENT_IDS.has(agentId);
}

const statusMeta: Record<StatusFilter, { label: string; color: "success" | "warning" | "error" | "default" }> = {
  all: { label: "Все статусы", color: "default" },
  healthy: { label: "Стабильно (Healthy)", color: "success" },
  degraded: { label: "Деградация (Degraded)", color: "warning" },
  offline: { label: "Офлайн (Offline)", color: "error" },
};

const mcpStatusMeta: Record<AgentMcpServer["status"], { label: string; color: "success" | "warning" | "error" }> = {
  online: { label: "Активно (Online)", color: "success" },
  degraded: { label: "Ограничено (Degraded)", color: "warning" },
  offline: { label: "Недоступно (Offline)", color: "error" },
};

const usedMcpStatusMeta: Record<UsedMcpStatus, { label: string; color: "success" | "warning" | "error" | "default" }> = {
  active: { label: "Активно (Active)", color: "success" },
  reauth_required: { label: "Требуется повторное подключение (Re-auth required)", color: "warning" },
  degraded: { label: "Ограничено (Degraded)", color: "warning" },
  offline: { label: "Недоступно (Offline)", color: "error" },
};

const statusLegend: Array<{ title: string; description: string }> = [
  {
    title: "Стабильно (Healthy)",
    description: "Агент работает в штатном режиме: критичных ошибок нет, основные сценарии выполняются.",
  },
  {
    title: "Деградация (Degraded)",
    description: "Агент доступен частично: есть сбои или ограничения, требуется повышенный контроль.",
  },
  {
    title: "Офлайн (Offline)",
    description: "Агент недоступен: задачи не обрабатываются до восстановления сервиса.",
  },
  {
    title: "Активно (Online/Active)",
    description: "Интеграция MCP работает корректно и выполняет запросы без ручного вмешательства.",
  },
  {
    title: "Требуется повторное подключение (Re-auth required)",
    description: "Нужно обновить авторизацию/токен MCP, иначе часть функций агента недоступна.",
  },
  {
    title: "На контроле (On control)",
    description: "Задачи ожидают ревью, разблокировки или внешнего ответа.",
  },
  {
    title: "Просрочено (Overdue)",
    description: "Задача вышла за целевой срок и требует приоритетного разбора.",
  },
];

function formatDateTime(value: string): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

function formatDateTimeLong(value: string): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeCompactRu(value: string): string {
  if (!value) return "не зафиксировано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "не зафиксировано";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(",", "");
}

function formatDateInput(value: string): string {
  if (!value) return "не задан";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU");
}

function formatPeriodLabel(periodStart: string, periodEnd: string): string {
  if (periodStart && periodEnd && periodStart === periodEnd) {
    return formatDateInput(periodStart);
  }
  if (periodStart && periodEnd) {
    return `${formatDateInput(periodStart)} -> ${formatDateInput(periodEnd)}`;
  }
  if (periodStart) return `с ${formatDateInput(periodStart)}`;
  if (periodEnd) return `по ${formatDateInput(periodEnd)}`;
  return "не задан";
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUsedMcpStatus(value: string): UsedMcpStatus {
  return value === "active" || value === "reauth_required" || value === "degraded" || value === "offline" ? value : "offline";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function makeSourceUrl(path: string): string | null {
  const base = String(import.meta.env.VITE_REPO_BROWSE_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/${path.replace(/^\/+/, "")}`;
}

function normalizePath(value: string): string {
  return value.trim().replace(/^\.?\//, "").replace(/\\/g, "/").toLowerCase();
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback to textarea copy
  }

  if (typeof document === "undefined") return false;
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(textArea);
  return copied;
}

function normalizeIceValue(value: unknown, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.round(Number(value));
  if (n < 1) return 1;
  if (n > 10) return 10;
  return n;
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s.,:;!?'"`()[\]{}\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeLoose(value: string): string[] {
  return normalizeLoose(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function extractMarkdownFragment(content: string, hint?: string | null): { content: string; matchedHeading: string | null } {
  const markdown = asString(content);
  const normalizedHint = asString(hint);
  if (!markdown || !normalizedHint) {
    return { content: markdown, matchedHeading: null };
  }

  const hintVariants = [normalizedHint, ...normalizedHint.split(/[,;|]/g).map((part) => part.trim())]
    .map((value) => asString(value))
    .filter((value, index, array) => value.length > 1 && array.indexOf(value) === index);
  const hintPatterns = hintVariants
    .map((value) => ({
      normalized: normalizeLoose(value),
      tokens: tokenizeLoose(value),
    }))
    .filter((item) => item.normalized && item.tokens.length > 0);
  if (hintPatterns.length === 0) {
    return { content: markdown, matchedHeading: null };
  }

  const lines = markdown.split(/\r?\n/);
  const headings: Array<{ index: number; level: number; title: string; score: number }> = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i]);
    if (!match) continue;

    const title = asString(match[2]);
    const normalizedTitle = normalizeLoose(title);
    if (!normalizedTitle) continue;

    const titleTokens = new Set(tokenizeLoose(title));
    let score = 0;
    for (const pattern of hintPatterns) {
      if (normalizedTitle === pattern.normalized) {
        score = Math.max(score, 1);
        continue;
      }
      if (normalizedTitle.includes(pattern.normalized) || pattern.normalized.includes(normalizedTitle)) {
        score = Math.max(score, 0.94);
        continue;
      }
      const overlap = pattern.tokens.reduce((acc, token) => acc + (titleTokens.has(token) ? 1 : 0), 0);
      score = Math.max(score, overlap / pattern.tokens.length);
    }

    if (score >= 0.45) {
      headings.push({
        index: i,
        level: match[1].length,
        title,
        score,
      });
    }
  }

  if (headings.length === 0) {
    return { content: markdown, matchedHeading: null };
  }

  headings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });
  const target = headings[0];

  let endIndex = lines.length;
  for (let i = target.index + 1; i < lines.length; i += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[i]);
    if (!match) continue;
    if (match[1].length <= target.level) {
      endIndex = i;
      break;
    }
  }

  const section = lines.slice(target.index, endIndex).join("\n").trim();
  return {
    content: section || markdown,
    matchedHeading: target.title,
  };
}

function inferSkillLastUsedAt(
  skill: { lastUsedAt?: string | null; practicalTasks?: string[] | null },
  taskEvents: Array<{ title: string; completedAt: string }>,
): string | null {
  const direct = asString(skill.lastUsedAt);
  if (direct) return direct;

  const tasks = toStringArray(skill.practicalTasks).map((item) => normalizeLoose(item)).filter(Boolean);
  if (tasks.length === 0) return null;

  let latest = 0;
  for (const event of taskEvents) {
    const eventTitle = normalizeLoose(asString(event.title));
    if (!eventTitle) continue;
    const matched = tasks.some((task) => eventTitle.includes(task) || task.includes(eventTitle));
    if (!matched) continue;
    const ts = new Date(event.completedAt).getTime();
    if (Number.isFinite(ts) && ts > latest) latest = ts;
  }

  return latest > 0 ? new Date(latest).toISOString() : null;
}

function inferMcpLastUsedAt(
  mcp: { lastUsedAt?: string | null; practicalTasks?: string[] | null },
  taskEvents: Array<{ title: string; completedAt: string }>,
): string | null {
  let latest = 0;
  const direct = asString(mcp.lastUsedAt);
  if (direct) {
    const directTs = new Date(direct).getTime();
    if (Number.isFinite(directTs) && directTs > latest) latest = directTs;
  }

  const tasks = toStringArray(mcp.practicalTasks).map((item) => normalizeLoose(item)).filter(Boolean);
  if (tasks.length > 0) {
    for (const event of taskEvents) {
      const eventTitle = normalizeLoose(asString(event.title));
      if (!eventTitle) continue;
      const matched = tasks.some((task) => eventTitle.includes(task) || task.includes(eventTitle));
      if (!matched) continue;
      const ts = new Date(event.completedAt).getTime();
      if (Number.isFinite(ts) && ts > latest) latest = ts;
    }
  }

  return latest > 0 ? new Date(latest).toISOString() : null;
}

function isTextSelectionActive(): boolean {
  const selection = window.getSelection?.();
  if (!selection) return false;
  return !selection.isCollapsed && selection.toString().trim().length > 0;
}

function inferImprovementSection(title: string, problem: string, solution: string, effect: string): string {
  const source = `${title} ${problem} ${solution} ${effect}`.toLowerCase();
  if (/(карточк|schema|контракт|ci|json|обязательн(ых|ые)\s+пол(ей|я))/i.test(source)) {
    return "Логика работы всех карточек (общая рекомендация)";
  }
  if (/(mcp|context7|supabase|netlify|sentry)/i.test(source)) {
    return "MCP и интеграции";
  }
  if (/(skill|навык|skill\.md|правил)/i.test(source)) {
    return "Навыки и правила";
  }
  if (/(review|ошибк|qa|quality|качество|задач)/i.test(source)) {
    return "Задачи и качество";
  }
  if (/(контекст|context|memory|памят)/i.test(source)) {
    return "Память и контекст";
  }
  return "Общая логика работы агента";
}

function priorityToIceSeed(priority: string): number {
  const value = String(priority || "").toLowerCase();
  if (value.includes("выс")) return 8;
  if (value.includes("сред")) return 6;
  return 5;
}

function buildDocsByPath<T extends { path: string }>(docs: T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of docs) {
    result.set(normalizePath(item.path), item);
  }
  return result;
}

function getAgentModalDocs(): IndexedDocument[] {
  return [...getDocsIndex(), ...getOapKbIndex(), ...getOapKbRawLogs()];
}

function parseAgentLogTimeline(content: string): ParsedAgentLogTimeline {
  const lines = String(content || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const events: AgentLogEventRecord[] = [];
  let invalidLines = 0;

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      events.push({
        timestamp: asString(parsed.timestamp),
        status: asString(parsed.status),
        step: asString(parsed.step),
        task_id: asString(parsed.task_id),
        run_id: asString(parsed.run_id),
        trace_id: asString(parsed.trace_id),
        recommendation_id: asString(parsed.recommendation_id),
        outcome: asString(parsed.outcome),
        mcp_tools: toStringArray(parsed.mcp_tools),
        line: index + 1,
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
    return 0;
  });

  return {
    events,
    invalidLines,
    totalLines: lines.length,
  };
}

type TextModalPayload = {
  title: string;
  content: string;
  path?: string | null;
  updatedAt?: string | null;
  sourceUrl?: string | null;
};

function asMeta(agent: AgentSummary): AgentMeta {
  return agent as AgentMeta;
}

function asFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function agentSkillNames(agent: AgentMeta): string[] {
  const names = new Set<string>(agent.skills || []);
  for (const skill of agent.usedSkills || []) {
    if (skill?.name) names.add(skill.name);
  }
  for (const skill of agent.availableSkills || []) {
    if (skill?.name) names.add(skill.name);
  }
  return [...names];
}

function agentMcpNames(agent: AgentMeta): string[] {
  const names = new Set<string>((agent.mcpServers || []).map((item) => item.name));
  for (const item of agent.usedMcp || []) {
    if (item?.name) names.add(item.name);
  }
  for (const item of agent.availableMcp || []) {
    if (item?.name) names.add(item.name);
  }
  return [...names];
}

function matchesAgent(agent: AgentMeta, filters: { query: string; status: StatusFilter; skill: string; mcp: string }) {
  const query = filters.query.trim().toLowerCase();
  if (filters.status !== "all" && agent.status !== filters.status) return false;
  if (filters.skill !== "all" && !agentSkillNames(agent).includes(filters.skill)) return false;
  if (filters.mcp !== "all" && !agentMcpNames(agent).includes(filters.mcp)) return false;
  if (!query) return true;

  const target = [
    agent.name,
    agent.role,
    agent.shortDescription || "",
    ...agentSkillNames(agent),
    ...agentMcpNames(agent),
    ...(agent.contextRefs || []).map((entry) => `${entry.title} ${entry.filePath}`),
  ]
    .join(" ")
    .toLowerCase();

  return target.includes(query);
}

function sumBy(agents: AgentMeta[], selector: (agent: AgentMeta) => number): number {
  return agents.reduce((acc, agent) => acc + selector(agent), 0);
}

function SummaryMetricCard(props: { title: string; value: string | number; note: string; icon: React.ReactNode }) {
  const { title, value, note, icon } = props;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderRadius: 2.5,
        background: "linear-gradient(180deg, #ffffff 0%, #f9fbff 100%)",
      }}
    >
      <Stack spacing={0.8}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1.5,
              bgcolor: "primary.light",
              color: "primary.main",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
        </Stack>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      </Stack>
    </Paper>
  );
}

function AgentDetailsModern({
  agent,
  docsByPath,
  onOpenTask,
  tabKey,
  onTabChange,
}: {
  agent: AgentMeta;
  docsByPath: Map<string, IndexedDocument>;
  onOpenTask?: (taskKey: string, source: TaskLookupSource) => void;
  tabKey: AgentTabKey;
  onTabChange: (tabKey: AgentTabKey) => void;
}) {
  const tabIndex = React.useMemo(() => {
    const index = MODERN_TAB_KEYS.indexOf(tabKey);
    return index >= 0 ? index : 0;
  }, [tabKey]);
  const handleTabChange = React.useCallback(
    (_: React.SyntheticEvent, value: number) => {
      onTabChange(MODERN_TAB_KEYS[value] || "overview");
    },
    [onTabChange],
  );
  const defaultPeriod = React.useMemo(() => {
    const latestEventTs = (agent.taskEvents || [])
      .map((event) => new Date(event.completedAt).getTime())
      .filter((ts) => Number.isFinite(ts))
      .sort((a, b) => b - a)[0];
    if (Number.isFinite(latestEventTs)) {
      return toDateInputValue(new Date(latestEventTs));
    }
    return toDateInputValue(new Date());
  }, [agent.taskEvents]);
  const [periodStart, setPeriodStart] = React.useState(defaultPeriod);
  const [periodEnd, setPeriodEnd] = React.useState(defaultPeriod);
  const [textModal, setTextModal] = React.useState<TextModalPayload | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [agentTaskRows, setAgentTaskRows] = React.useState<Array<{ title: string; created_at: string }>>([]);
  const telemetryReport = React.useMemo<TelemetrySummaryReport | null>(() => {
    const reportDoc = getOapKbIndex().find((item) => normalizePath(item.path) === "artifacts/agent_telemetry_summary.json");
    if (!reportDoc?.content) return null;
    try {
      return JSON.parse(reportDoc.content) as TelemetrySummaryReport;
    } catch {
      return null;
    }
  }, []);
  const benchmarkSummary = React.useMemo<AgentBenchmarkSummary>(() => getAgentBenchmarkSummary(), []);

  React.useEffect(() => {
    setPeriodStart(defaultPeriod);
    setPeriodEnd(defaultPeriod);
  }, [agent.id, defaultPeriod]);

  React.useEffect(() => {
    let active = true;

    const loadTaskRows = async () => {
      try {
        const rows = await getAgentTasks({ sourceAgentId: agent.id, limit: 200 });
        if (!active) return;
        setAgentTaskRows(rows.map((row) => ({ title: row.title, created_at: row.created_at })));
      } catch {
        if (active) setAgentTaskRows([]);
      }
    };

    void loadTaskRows();
    return () => {
      active = false;
    };
  }, [agent.id]);

  const status = statusMeta[agent.status];
  const operatingPlan = agent.operatingPlan || null;
  const workflowPolicy = agent.workflowPolicy || null;
  const learningArtifacts = agent.learningArtifacts || null;
  const doneGatePolicy = agent.doneGatePolicy || null;
  const workflowMetricsCatalog = Array.isArray(agent.workflowMetricsCatalog) ? agent.workflowMetricsCatalog : [];
  const usedMcp = agent.usedMcp || [];
  const contextRefs = agent.contextRefs || [];
  const usedSkills = agent.usedSkills || [];
  const availableSkills = agent.availableSkills || [];
  const usedTools = agent.usedTools || [];
  const availableTools = agent.availableTools || [];
  const rulesApplied = React.useMemo(() => {
    const normalized = (agent.rulesApplied || [])
      .map((item, index) => ({
        title: asString(item?.title) || `Правило ${index + 1}`,
        location: asString(item?.location),
        description: asString(item?.description),
        fullText: asString(item?.fullText),
        sourceUrl: asString(item?.sourceUrl) || null,
      }))
      .filter((item) => item.location || item.description || item.fullText);
    if (normalized.length > 0) return normalized;

    const fallback = contextRefs.map((entry, index) => ({
      title: entry.title || `Правило ${index + 1}`,
      location: entry.filePath,
      description: entry.pathHint || `Источник: ${entry.title}`,
      fullText: "",
      sourceUrl: entry.sourceUrl || makeSourceUrl(entry.filePath),
    }));

    fallback.push({
      title: "Глобальные правила платформы",
      location: "Codex runtime system/developer instructions",
      description: "Системные инструкции среды выполнения (не хранятся в репозитории).",
      fullText: "Глобальные правила применяются на уровне платформы Codex во время выполнения задач.",
      sourceUrl: null,
    });

    return fallback;
  }, [agent.rulesApplied, contextRefs]);
  const operatingPlanSource = React.useMemo(() => {
    const ruleCandidate = rulesApplied.find((rule) => /OPERATING_PLAN\.md$/i.test(asString(rule.location)));
    const contextCandidate = contextRefs.find((entry) => /OPERATING_PLAN\.md$/i.test(asString(entry.filePath)));
    const fallbackPath = OPERATING_PLAN_PATH_FALLBACKS[agent.id] || "docs/subservices/oap/ANALYST_OPERATING_PLAN.md";
    const path = asString(ruleCandidate?.location) || asString(contextCandidate?.filePath) || fallbackPath;
    const title = asString(contextCandidate?.title) || asString(ruleCandidate?.title) || "Операционный стандарт агента";
    const pathHint = asString(contextCandidate?.pathHint) || asString(ruleCandidate?.description)
      || "Процесс по которому работает ИИ агент, Политика источников, Whitelist, Lifecycle улучшений, Политика уведомлений, Критичные случаи";
    return {
      path,
      title,
      pathHint,
      sourceUrl: asString(contextCandidate?.sourceUrl) || asString(ruleCandidate?.sourceUrl) || makeSourceUrl(path),
    };
  }, [agent.id, contextRefs, rulesApplied]);
  const agentLogPath = React.useMemo(() => `.logs/agents/${agent.id}.jsonl`, [agent.id]);

  const taskEvents = React.useMemo(() => {
    const values = [...(agent.taskEvents || [])];
    values.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return values;
  }, [agent.taskEvents]);

  const filteredTaskEvents = React.useMemo(() => {
    const start = periodStart ? new Date(`${periodStart}T00:00:00`).getTime() : null;
    const end = periodEnd ? new Date(`${periodEnd}T23:59:59`).getTime() : null;
    return taskEvents.filter((item) => {
      const ts = new Date(item.completedAt).getTime();
      if (Number.isNaN(ts)) return false;
      if (start !== null && ts < start) return false;
      if (end !== null && ts > end) return false;
      return true;
    });
  }, [taskEvents, periodStart, periodEnd]);

  const completedTasks = filteredTaskEvents.length;
  const reviewErrors = filteredTaskEvents.reduce((acc, item) => acc + (Number.isFinite(item.reviewErrors) ? item.reviewErrors : 0), 0);
  const lastTask = filteredTaskEvents[0] || null;
  const reviewErrorRate = completedTasks > 0 ? roundTo((reviewErrors / completedTasks) * 100, 1) : 0;
  const averageTaskDurationLabel = React.useMemo(() => {
    const durations = filteredTaskEvents
      .map((event) => {
        const raw = (event as { durationMs?: unknown }).durationMs;
        const value = Number(raw);
        return Number.isFinite(value) && value > 0 ? value : null;
      })
      .filter((value): value is number => value !== null);

    if (durations.length === 0) return "N/A";
    const avgMinutes = Math.round(durations.reduce((acc, value) => acc + value, 0) / durations.length / 60000);
    return `${avgMinutes} мин`;
  }, [filteredTaskEvents]);
  const reviewIssueEvents = React.useMemo(
    () => filteredTaskEvents.filter((event) => Number(event.reviewErrors) > 0),
    [filteredTaskEvents],
  );
  const calculateTaskQualityScore = React.useCallback((event: { reviewErrors: number }) => {
    const reviewErrorsCount = Number.isFinite(event.reviewErrors) ? event.reviewErrors : 0;
    const score = 100 - 35 * reviewErrorsCount;
    return Math.max(0, Math.min(100, score));
  }, []);
  const toolLogContextRefs = React.useMemo(() => {
    const logPattern = /(log|logs|heartbeat|monitor|trace|debug|review)/i;
    const matched = contextRefs.filter((entry) =>
      logPattern.test(`${entry.title || ""} ${entry.filePath || ""} ${entry.pathHint || ""}`),
    );
    if (matched.length > 0) return matched;
    return contextRefs[0] ? [contextRefs[0]] : [];
  }, [contextRefs]);

  const hasOfflineMcp = agent.mcpServers.some((item) => item.status === "offline");
  const hasDegradedMcp = agent.mcpServers.some((item) => item.status === "degraded");
  const highRisk = agent.status === "offline" || agent.tasks.overdue > 0 || hasOfflineMcp;
  const mediumRisk = !highRisk && (agent.status === "degraded" || agent.tasks.on_control > 0 || hasDegradedMcp);
  const riskMeta = highRisk
    ? { label: "Критичность: высокая", color: "error" as const }
    : mediumRisk
      ? { label: "Критичность: средняя", color: "warning" as const }
      : { label: "Критичность: низкая", color: "success" as const };

  const statusReason = highRisk
    ? "Есть блокирующие факторы: просроченные задачи или недоступные MCP-интеграции."
    : mediumRisk
      ? "Нагрузка управляемая, но есть задачи на контроле или ограниченные интеграции."
      : "Работа в штатном режиме: критичных блокеров и просроченных задач нет.";

  const nextAction = highRisk
    ? "Приоритизировать устранение блокеров: восстановить MCP и закрыть просроченные задачи."
    : mediumRisk
      ? "Сократить задачи на контроле и убрать деградацию MCP в текущем спринте."
      : "Поддерживать стабильный режим и проверять рекомендации по улучшению раз в день.";

  const mcpUtilizationRate = agent.mcpServers.length > 0 ? Math.round((usedMcp.length / agent.mcpServers.length) * 100) : 0;
  const skillBaseCount = [...new Set([...(agent.skills || []), ...availableSkills.map((item) => item.name), ...usedSkills.map((item) => item.name)])].length;
  const skillUtilizationRate = skillBaseCount > 0 ? Math.round((usedSkills.length / skillBaseCount) * 100) : 0;

  const keyAction =
    (agent.analystRecommendations || [])[0] ||
    "Сформировать следующую задачу по улучшению качества и зафиксировать ожидаемый эффект.";

  const improvements = React.useMemo<ImprovementViewModel[]>(() => {
    return (agent.improvements || []).map((item, index) => {
      const isActionRateCard = /рейтинг эффекта рекомендаций/i.test(item.title);
      const fallbackSeed = priorityToIceSeed(item.priority);
      const defaultImpact = isActionRateCard ? 9 : fallbackSeed;
      const defaultConfidence = isActionRateCard ? 8 : Math.max(1, fallbackSeed - 1);
      const defaultEase = isActionRateCard ? 7 : Math.max(1, fallbackSeed - 2);

      const impact = normalizeIceValue(item.ice?.impact, defaultImpact);
      const confidence = normalizeIceValue(item.ice?.confidence, defaultConfidence);
      const ease = normalizeIceValue(item.ice?.ease, defaultEase);
      const score = impact + confidence + ease;

      const defaultBasis = completedTasks > 0
        ? `На основании логов задач (${completedTasks}), ошибок review (${reviewIssueEvents.length}) и данных инструмента отслеживания логов (${toolLogContextRefs.length}) за выбранный период.`
        : "На основании логов задач, ошибок review и данных инструмента отслеживания логов.";

      const problem = isActionRateCard
        ? "Сложно понять, какие рекомендации реально дают результат."
        : item.problem;
      const solution = isActionRateCard
        ? "Связать рекомендации с task outcomes и считать recommendation_action_rate."
        : item.solution;
      const effect = isActionRateCard
        ? "Фокус на улучшениях с максимальной практической отдачей."
        : item.effect;
      const section = asString(item.section) || inferImprovementSection(item.title, problem, solution, effect);
      const ownerSection = asString(item.ownerSection) || section;
      const promptPath = asString(item.promptPath) || null;
      const promptTitle = asString(item.promptTitle) || `Промт для внедрения: ${item.title}`;
      const promptMarkdown = asString(item.promptMarkdown) || "";
      const targetMetric = asString(item.targetMetric) || "recommendation_action_rate";
      const baselineWindow = asString(item.baselineWindow) || "last_14_days";
      const expectedDelta = asString(item.expectedDelta) || ">= 10% improvement vs baseline.";
      const validationDate = asString(item.validationDate) || "не зафиксировано";
      const normalizedTitle = normalizeLoose(item.title);
      const matchedTask = agentTaskRows.find((task) => normalizeLoose(task.title) === normalizedTitle)
        || agentTaskRows.find((task) => {
          const taskTitle = normalizeLoose(task.title);
          return taskTitle.length > 0 && (taskTitle.includes(normalizedTitle) || normalizedTitle.includes(taskTitle));
        })
        || null;
      const createdAt =
        asString((item as { createdAt?: unknown }).createdAt)
        || asString(matchedTask?.created_at)
        || null;

      return {
        key: `${agent.id}-improvement-${index}-${item.title}`,
        title: item.title,
        createdAt,
        section,
        ownerSection,
        problem,
        solution,
        effect,
        basis: item.detectionBasis || defaultBasis,
        targetMetric,
        baselineWindow,
        expectedDelta,
        validationDate,
        ice: { impact, confidence, ease, score },
        promptTitle,
        promptMarkdown,
        promptPath,
        promptSourceUrl: item.promptSourceUrl || (promptPath ? makeSourceUrl(promptPath) : null),
      };
    });
  }, [agent.id, agent.improvements, agentTaskRows, completedTasks, reviewIssueEvents.length, toolLogContextRefs.length]);

  const telemetryAgent = React.useMemo<TelemetrySummaryAgent | null>(() => {
    const list = telemetryReport?.agents;
    if (!Array.isArray(list)) return null;
    return list.find((item) => asString(item?.agent_id) === agent.id) || null;
  }, [agent.id, telemetryReport]);
  const benchmarkAgentSnapshot = React.useMemo<Record<string, unknown> | null>(() => {
    const list = benchmarkSummary.agents;
    if (Array.isArray(list)) {
      const match = list.find((item) => asString((item as { agent_id?: unknown })?.agent_id) === agent.id);
      if (match && typeof match === "object") {
        return match as Record<string, unknown>;
      }
    }
    if (asString(benchmarkSummary.run?.agent_id) === agent.id) {
      return {
        agent_id: agent.id,
        ...benchmarkSummary.metrics,
        ...benchmarkSummary.impact_metrics,
        ...benchmarkSummary.telemetry_metrics,
      };
    }
    return null;
  }, [agent.id, benchmarkSummary]);
  const benchmarkScopedToAgent = React.useMemo(() => {
    if (!benchmarkAgentSnapshot) return false;
    const snapshotAgent = asString(benchmarkAgentSnapshot.agent_id);
    return snapshotAgent === agent.id;
  }, [agent.id, benchmarkAgentSnapshot]);
  const benchmarkDatasetCases = asFiniteNumber(benchmarkSummary.dataset?.cases_total);
  const benchmarkAttemptsTotal = asFiniteNumber(benchmarkSummary.metrics?.attempts_total);
  const benchmarkRunId = asString(benchmarkSummary.run?.run_id);
  const benchmarkGateStatus = benchmarkScopedToAgent ? benchmarkSummary.gate?.status : null;
  const benchmarkGateFailedMetrics = benchmarkScopedToAgent && Array.isArray(benchmarkSummary.gate?.failed_metrics)
    ? benchmarkSummary.gate.failed_metrics
    : [];
  const benchmarkGateMissingMetrics = benchmarkScopedToAgent && Array.isArray(benchmarkSummary.gate?.missing_metrics)
    ? benchmarkSummary.gate.missing_metrics
    : [];

  const periodDays = React.useMemo(() => {
    if (!periodStart || !periodEnd) return null;
    const start = new Date(`${periodStart}T00:00:00`).getTime();
    const end = new Date(`${periodEnd}T23:59:59`).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return Math.floor((end - start) / 86400000) + 1;
  }, [periodEnd, periodStart]);

  const tqsAverage = React.useMemo(() => {
    if (filteredTaskEvents.length === 0) return null;
    const total = filteredTaskEvents.reduce((acc, event) => acc + calculateTaskQualityScore(event), 0);
    return roundTo(total / filteredTaskEvents.length, 1);
  }, [calculateTaskQualityScore, filteredTaskEvents]);

  const telemetrySuggested = asFiniteNumber(telemetryAgent?.recommendations_suggested)
    ?? asFiniteNumber(telemetryReport?.totals?.recommendations_suggested);
  const telemetryApplied = asFiniteNumber(telemetryAgent?.recommendations_applied)
    ?? asFiniteNumber(telemetryReport?.totals?.recommendations_applied);
  const recommendationActionRate = asFiniteNumber(telemetryAgent?.recommendation_action_rate)
    ?? asFiniteNumber(telemetryReport?.totals?.recommendation_action_rate)
    ?? (telemetrySuggested && telemetrySuggested > 0 && telemetryApplied !== null
      ? roundTo((telemetryApplied / telemetrySuggested) * 100, 1)
      : null);

  const telemetryCompletedTasks = asFiniteNumber(telemetryAgent?.completed_tasks);
  const telemetryTasksTotal = asFiniteNumber(telemetryAgent?.tasks_total);
  const planSignalTasksCount = asFiniteNumber(telemetryAgent?.plan_signal_tasks);
  const telemetryStatusCounts = telemetryAgent?.status_counts || {};
  const plannedStatusCount = asFiniteNumber(telemetryStatusCounts.planned) || 0;
  const replannedStatusCount = asFiniteNumber(telemetryStatusCounts.replanned) || 0;
  const verifyStartedStatusCount = asFiniteNumber(telemetryStatusCounts.verify_started) || 0;
  const verifyPassedStatusCount = asFiniteNumber(telemetryStatusCounts.verify_passed) || 0;
  const verifyFailedStatusCount = asFiniteNumber(telemetryStatusCounts.verify_failed) || 0;
  const lessonCapturedStatusCount = asFiniteNumber(telemetryStatusCounts.lesson_captured) || 0;
  const lessonNotApplicableStatusCount = asFiniteNumber(telemetryStatusCounts.lesson_not_applicable) || 0;
  const autonomousBugfixStatusCount = asFiniteNumber(telemetryStatusCounts.bugfix_autonomous) || 0;
  const eleganceCheckedStatusCount = asFiniteNumber(telemetryStatusCounts.elegance_checked) || 0;

  const planCoverageRate = asFiniteNumber(telemetryAgent?.plan_coverage_rate)
    ?? (planSignalTasksCount !== null && telemetryTasksTotal && telemetryTasksTotal > 0
      ? roundTo((planSignalTasksCount / telemetryTasksTotal) * 100, 1)
      : null)
    ?? (telemetryTasksTotal && telemetryTasksTotal > 0
      ? roundTo((plannedStatusCount / telemetryTasksTotal) * 100, 1)
      : null);
  const verificationPassRate = asFiniteNumber(telemetryAgent?.verification_pass_rate)
    ?? (verifyStartedStatusCount > 0
      ? roundTo((verifyPassedStatusCount / verifyStartedStatusCount) * 100, 1)
      : null);
  const lessonCaptureRate = asFiniteNumber(telemetryAgent?.lesson_capture_rate)
    ?? (verifyPassedStatusCount + verifyFailedStatusCount > 0
      ? roundTo((lessonCapturedStatusCount / (verifyPassedStatusCount + verifyFailedStatusCount)) * 100, 1)
      : null);
  const replanRate = asFiniteNumber(telemetryAgent?.replan_rate)
    ?? (plannedStatusCount > 0
      ? roundTo((replannedStatusCount / plannedStatusCount) * 100, 1)
      : null);
  const autonomousBugfixRate = asFiniteNumber(telemetryAgent?.autonomous_bugfix_rate)
    ?? (telemetryTasksTotal && telemetryTasksTotal > 0
      ? roundTo((autonomousBugfixStatusCount / telemetryTasksTotal) * 100, 1)
      : null);
  const eleganceGateRate = asFiniteNumber(telemetryAgent?.elegance_gate_rate)
    ?? (plannedStatusCount > 0
      ? roundTo((eleganceCheckedStatusCount / plannedStatusCount) * 100, 1)
      : null);

  const regressionEvents = React.useMemo(() => {
    const failed = asFiniteNumber(telemetryStatusCounts.failed) || 0;
    const reviewFailed = asFiniteNumber(telemetryStatusCounts.review_failed) || 0;
    const stepError = asFiniteNumber(telemetryStatusCounts.step_error) || 0;
    return failed + reviewFailed + stepError;
  }, [telemetryStatusCounts.failed, telemetryStatusCounts.review_failed, telemetryStatusCounts.step_error]);
  const regressionRate = telemetryCompletedTasks && telemetryCompletedTasks > 0
    ? roundTo((regressionEvents / telemetryCompletedTasks) * 100, 1)
    : null;

  const p95TimeToContextMs = asFiniteNumber(telemetryAgent?.p95_duration_ms)
    ?? asFiniteNumber(agent.memoryContext?.retrieval?.latency_ms);

  const telemetryAgentsTotal = asFiniteNumber(telemetryReport?.totals?.agents_total);
  const agentsReviewedDaily = telemetryAgentsTotal !== null
    ? (periodDays && periodDays > 0 ? roundTo(telemetryAgentsTotal / periodDays, 2) : telemetryAgentsTotal)
    : null;

  const recommendationsTotal = improvements.length;
  const recommendationsWithStructuredEvidence = improvements.filter((item) => item.basis && item.targetMetric && item.expectedDelta).length;
  const recommendationPrecision = recommendationsTotal > 0
    ? roundTo((recommendationsWithStructuredEvidence / recommendationsTotal) * 100, 1)
    : null;

  const validatedImpactRate = recommendationsTotal > 0 && telemetryApplied !== null
    ? roundTo((telemetryApplied / recommendationsTotal) * 100, 1)
    : null;

  const staleRecommendations = React.useMemo(() => {
    if (improvements.length === 0) return 0;
    const now = Date.now();
    return improvements.reduce((acc, item) => {
      const ts = Date.parse(item.validationDate);
      if (!Number.isFinite(ts)) return acc;
      return ts < now ? acc + 1 : acc;
    }, 0);
  }, [improvements]);

  const doneGateChecks = React.useMemo(() => {
    const required = doneGatePolicy?.requiredChecks || ["plan", "verify", "lesson"];
    const lessonEvidence = lessonCapturedStatusCount + lessonNotApplicableStatusCount;
    return required.map((check) => {
      const key = check.toLowerCase();
      if (key === "plan") {
        const planEvidence = planSignalTasksCount ?? plannedStatusCount;
        return {
          key,
          label: "Plan",
          ok: planEvidence > 0,
          note: planEvidence > 0
            ? `plan_signal_tasks=${Math.round(planEvidence)}`
            : "не зафиксировано",
        };
      }
      if (key === "verify") {
        return {
          key,
          label: "Verify",
          ok: verifyPassedStatusCount > 0,
          note: verifyPassedStatusCount > 0
            ? `verify_passed=${verifyPassedStatusCount}`
            : `verify_started=${verifyStartedStatusCount}, verify_failed=${verifyFailedStatusCount}`,
        };
      }
      if (key === "lesson") {
        return { key, label: "Lesson", ok: lessonEvidence > 0, note: lessonEvidence > 0 ? `${lessonEvidence} events` : "не зафиксировано" };
      }
      return { key, label: check, ok: false, note: "не зафиксировано" };
    });
  }, [
    doneGatePolicy?.requiredChecks,
    lessonCapturedStatusCount,
    lessonNotApplicableStatusCount,
    planSignalTasksCount,
    plannedStatusCount,
    verifyFailedStatusCount,
    verifyPassedStatusCount,
    verifyStartedStatusCount,
  ]);
  const doneGateFailedCount = doneGateChecks.filter((item) => !item.ok).length;

  const formatPercentMetric = React.useCallback((value: number | null) => {
    if (value === null) return "не зафиксировано";
    return `${roundTo(value, 1).toFixed(1)}%`;
  }, []);

  const formatCountMetric = React.useCallback((value: number | null) => {
    if (value === null) return "не зафиксировано";
    return `${Math.round(value)}`;
  }, []);

  const formatDurationMetric = React.useCallback((value: number | null) => {
    if (value === null) return "не зафиксировано";
    if (value < 1000) return `${Math.round(value)} мс`;
    return `${roundTo(value / 1000, 2).toFixed(2)} с`;
  }, []);

  const formatUnitPercentMetric = React.useCallback((value: number | null) => {
    if (value === null) return "не зафиксировано";
    const normalized = value <= 1 ? value * 100 : value;
    return `${roundTo(normalized, 1).toFixed(1)}%`;
  }, []);

  const formatUsdMetric = React.useCallback((value: number | null) => {
    if (value === null) return "не зафиксировано";
    return `$${roundTo(value, 3).toFixed(3)}`;
  }, []);

  const formatHoursMetric = React.useCallback((value: number | null) => {
    if (value === null) return "не зафиксировано";
    return `${roundTo(value, 1).toFixed(1)} ч`;
  }, []);

  const benchmarkPassAt5 = asFiniteNumber(benchmarkAgentSnapshot?.pass_at_5);
  const benchmarkFactCoverageMean = asFiniteNumber(benchmarkAgentSnapshot?.fact_coverage_mean);
  const benchmarkSchemaValidRate = asFiniteNumber(benchmarkAgentSnapshot?.schema_valid_rate);
  const benchmarkTrajectoryComplianceRate = asFiniteNumber(benchmarkAgentSnapshot?.trajectory_compliance_rate);
  const benchmarkJudgeDisagreementRate = asFiniteNumber(benchmarkAgentSnapshot?.judge_disagreement_rate);
  const benchmarkCostPerSuccess = asFiniteNumber(benchmarkAgentSnapshot?.cost_per_success);
  const benchmarkPassRateVariance = asFiniteNumber(benchmarkAgentSnapshot?.pass_rate_variance);
  const benchmarkLatencyP95Ms = asFiniteNumber(benchmarkAgentSnapshot?.latency_p95_ms);
  const benchmarkRecommendationExecutabilityRate = asFiniteNumber(benchmarkAgentSnapshot?.recommendation_executability_rate);
  const benchmarkEvidenceLinkCoverage = asFiniteNumber(benchmarkAgentSnapshot?.evidence_link_coverage);
  const benchmarkTimeToActionP50 = asFiniteNumber(benchmarkAgentSnapshot?.time_to_action_p50);
  const benchmarkValidatedImpactRate = asFiniteNumber(benchmarkAgentSnapshot?.validated_impact_rate);

  const metricsByKey = React.useMemo<Record<string, Omit<MetricDisplayItem, "key">>>(() => ({
    review_error_rate: {
      label: "Доля review-ошибок (`review_error_rate`)",
      description: "Какой процент завершенных задач вернулся с замечаниями после ревью.",
      valueLabel: formatPercentMetric(reviewErrorRate),
      formula: "review_errors / completed_tasks * 100",
      source: "События задач (`taskEvents`) за выбранный период.",
    },
    TQS_avg: {
      label: "Средний TQS (`TQS_avg`)",
      description: "Средний балл качества выполнения задач: 100 - лучшее качество, 0 - критично.",
      valueLabel: tqsAverage === null ? "не зафиксировано" : `${tqsAverage.toFixed(1)}`,
      formula: "avg(clamp(100 - 35*review_errors - 20*overdue_flag - 15*blocked_flag - 10*retry_count, 0, 100)); в текущем UI: avg(clamp(100 - 35*review_errors, 0, 100)).",
      source: "События задач (`taskEvents`) за выбранный период.",
    },
    tasks_in_work: {
      label: "Задач в работе (`tasks_in_work`)",
      description: "Сколько задач сейчас в активной работе у агента.",
      valueLabel: formatCountMetric(agent.tasks.in_work),
      formula: "queued + running + retrying",
      source: "Сводные счетчики задач из профиля агента.",
    },
    tasks_on_control: {
      label: "Задач на контроле (`tasks_on_control`)",
      description: "Сколько задач требуют контроля: ревью, разблокировки или внешнего ответа.",
      valueLabel: formatCountMetric(agent.tasks.on_control),
      formula: "waiting_review + blocked + waiting_external",
      source: "Сводные счетчики задач из профиля агента.",
    },
    overdue: {
      label: "Просроченные задачи (`overdue`)",
      description: "Сколько задач вышли за целевой срок.",
      valueLabel: formatCountMetric(agent.tasks.overdue),
      formula: "count(tasks where due_date < now and status != done)",
      source: "Сводные счетчики задач из профиля агента.",
    },
    recommendation_action_rate: {
      label: "Реализация рекомендаций (`recommendation_action_rate`)",
      description: "Какой процент рекомендаций реально довели до применения.",
      valueLabel: formatPercentMetric(recommendationActionRate),
      formula: "recommendations_applied / recommendations_suggested * 100",
      source: "Telemetry summary (`artifacts/agent_telemetry_summary.json`).",
    },
    regression_rate: {
      label: "Доля регрессий (`regression_rate`)",
      description: "Какой процент выполненных задач привел к регрессии или падению качества.",
      valueLabel: formatPercentMetric(regressionRate),
      formula: "(failed + review_failed + step_error) / completed_tasks * 100",
      source: "Telemetry summary (`status_counts`, `completed_tasks`).",
    },
    p95_time_to_context: {
      label: "p95 входа в контекст (`p95_time_to_context`)",
      description: "Время, за которое в 95% случаев агент входит в рабочий контекст.",
      valueLabel: formatDurationMetric(p95TimeToContextMs),
      formula: "95-й перцентиль latency_ms по retrieval/context events",
      source: "Telemetry summary (`p95_duration_ms`) или `memoryContext.retrieval.latency_ms`.",
    },
    agents_reviewed_daily: {
      label: "Проверено агентов в день (`agents_reviewed_daily`)",
      description: "Среднее число агентов, которых охватывают проверкой за день.",
      valueLabel: agentsReviewedDaily === null ? "не зафиксировано" : `${agentsReviewedDaily.toFixed(2)}`,
      formula: "agents_total / days_in_period",
      source: "Telemetry summary (`totals.agents_total`) и фильтр периода.",
    },
    recommendation_precision: {
      label: "Точность рекомендаций (`recommendation_precision`)",
      description: "Доля рекомендаций, где есть четкое основание и измеримый KPI-результат.",
      valueLabel: formatPercentMetric(recommendationPrecision),
      formula: "recommendations_with_basis_and_metric / recommendations_total * 100",
      source: "Карточки улучшений агента (`improvements`).",
    },
    validated_impact_rate: {
      label: "Подтвержденный эффект (`validated_impact_rate`)",
      description: "Доля рекомендаций, которые дошли до применения и могут быть валидированы по эффекту.",
      valueLabel: formatPercentMetric(validatedImpactRate),
      formula: "recommendations_applied / recommendations_total * 100 (proxy до появления отдельного статуса verified_impact)",
      source: "Telemetry summary + карточки улучшений.",
    },
    plan_coverage_rate: {
      label: "Покрытие планированием (`plan_coverage_rate`)",
      description: "Какая доля задач была проведена через шаг plan перед исполнением.",
      valueLabel: formatPercentMetric(planCoverageRate),
      formula: "plan_signal_tasks / tasks_total * 100, где plan_signal_tasks = tasks со статусом planned/replanned или step=plan* при status=started",
      source: "Telemetry summary (`plan_signal_tasks`, `status_counts`, `tasks_total`).",
    },
    verification_pass_rate: {
      label: "Успех верификации (`verification_pass_rate`)",
      description: "Какая доля verify-запусков завершилась успешно.",
      valueLabel: formatPercentMetric(verificationPassRate),
      formula: "verify_passed / verify_started * 100",
      source: "Telemetry summary (`status_counts.verify_started`, `status_counts.verify_passed`).",
    },
    lesson_capture_rate: {
      label: "Фиксация уроков (`lesson_capture_rate`)",
      description: "Насколько стабильно после verify фиксируются уроки self-improvement.",
      valueLabel: formatPercentMetric(lessonCaptureRate),
      formula: "lesson_captured / (verify_passed + verify_failed) * 100",
      source: "Telemetry summary (`status_counts.lesson_captured`, verify statuses).",
    },
    replan_rate: {
      label: "Частота re-plan (`replan_rate`)",
      description: "Как часто агент пересобирает план при отклонениях от исходной траектории.",
      valueLabel: formatPercentMetric(replanRate),
      formula: "replanned / planned * 100",
      source: "Telemetry summary (`status_counts.planned`, `status_counts.replanned`).",
    },
    autonomous_bugfix_rate: {
      label: "Автономный bugfix (`autonomous_bugfix_rate`)",
      description: "Какая доля задач закрывается с флагом автономного исправления без ручного hand-holding.",
      valueLabel: formatPercentMetric(autonomousBugfixRate),
      formula: "bugfix_autonomous / tasks_total * 100",
      source: "Telemetry summary (`status_counts.bugfix_autonomous`, `tasks_total`).",
    },
    elegance_gate_rate: {
      label: "Elegance-gate (`elegance_gate_rate`)",
      description: "Как часто агент проходит дополнительную проверку элегантности для нетривиальных изменений.",
      valueLabel: formatPercentMetric(eleganceGateRate),
      formula: "elegance_checked / planned * 100",
      source: "Telemetry summary (`status_counts.elegance_checked`, `status_counts.planned`).",
    },
    pass_at_5: {
      label: "Стабильность pass@5 (`pass_at_5`)",
      description: "Доля benchmark-кейсов, где минимум один из 5 повторов завершился успешно.",
      valueLabel: formatUnitPercentMetric(benchmarkPassAt5),
      formula: "successful_cases / cases_total * 100, где successful_case = any(attempt_i.pass=true), i=1..5",
      source: "Benchmark summary (`artifacts/agent_benchmark_summary.json`).",
    },
    fact_coverage_mean: {
      label: "Покрытие фактов (`fact_coverage_mean`)",
      description: "Средняя доля ожидаемых фактов, которые агент действительно отразил в ответе.",
      valueLabel: formatUnitPercentMetric(benchmarkFactCoverageMean),
      formula: "avg(facts_covered / expected_facts)",
      source: "Benchmark summary (`artifacts/agent_benchmark_summary.json`).",
    },
    schema_valid_rate: {
      label: "Валидность схемы (`schema_valid_rate`)",
      description: "Доля benchmark-ответов, которые прошли структурную валидацию без ошибок.",
      valueLabel: formatUnitPercentMetric(benchmarkSchemaValidRate),
      formula: "valid_schema_attempts / attempts_total * 100",
      source: "Benchmark summary (`artifacts/agent_benchmark_summary.json`).",
    },
    trajectory_compliance_rate: {
      label: "Соблюдение траектории (`trajectory_compliance_rate`)",
      description: "Доля запусков, где агент соблюдает lifecycle шагов без нарушений.",
      valueLabel: formatUnitPercentMetric(benchmarkTrajectoryComplianceRate),
      formula: "trajectory_ok_attempts / attempts_total * 100",
      source: "Benchmark summary (`artifacts/agent_benchmark_summary.json`).",
    },
    judge_disagreement_rate: {
      label: "Несогласие judge/human (`judge_disagreement_rate`)",
      description: "Доля кейсов, где автоматический судья расходится с human-калибровкой.",
      valueLabel: formatUnitPercentMetric(benchmarkJudgeDisagreementRate),
      formula: "judge_human_disagreements / human_calibrated_cases * 100",
      source: "Benchmark summary (`artifacts/agent_benchmark_summary.json`).",
    },
    cost_per_success: {
      label: "Стоимость успеха (`cost_per_success`)",
      description: "Средняя стоимость одного успешного benchmark-кейса.",
      valueLabel: formatUsdMetric(benchmarkCostPerSuccess),
      formula: "cost_total_usd / successful_cases",
      source: "Benchmark summary (`artifacts/agent_benchmark_summary.json`).",
    },
    pass_rate_variance: {
      label: "Дисперсия pass-rate (`pass_rate_variance`)",
      description: "Разброс успеха по кейсам: чем ниже, тем стабильнее поведение агента.",
      valueLabel: benchmarkPassRateVariance === null ? "не зафиксировано" : roundTo(benchmarkPassRateVariance, 4).toFixed(4),
      formula: "var(case_pass_rate)",
      source: "Benchmark summary (`artifacts/agent_benchmark_summary.json`).",
    },
    benchmark_latency_p95_ms: {
      label: "Latency p95 (`latency_p95_ms`)",
      description: "95-й перцентиль времени ответа в benchmark-прогонах.",
      valueLabel: formatDurationMetric(benchmarkLatencyP95Ms),
      formula: "p95(latency_ms) по attempts benchmark-run",
      source: "Benchmark summary (`artifacts/agent_benchmark_summary.json`).",
    },
    recommendation_executability_rate: {
      label: "Исполнимость рекомендаций (`recommendation_executability_rate`)",
      description: "Доля рекомендаций, которые можно сразу перевести в конкретное действие.",
      valueLabel: formatUnitPercentMetric(benchmarkRecommendationExecutabilityRate),
      formula: "executable_recommendations / total_recommendations * 100",
      source: "Benchmark summary (`impact_metrics`).",
    },
    evidence_link_coverage: {
      label: "Покрытие evidence-ссылками (`evidence_link_coverage`)",
      description: "Насколько рекомендации подкреплены ссылками на источники и артефакты.",
      valueLabel: formatUnitPercentMetric(benchmarkEvidenceLinkCoverage),
      formula: "recommendations_with_evidence_links / total_recommendations * 100",
      source: "Benchmark summary (`impact_metrics`).",
    },
    time_to_action_p50: {
      label: "Время до действия p50 (`time_to_action_p50`)",
      description: "Медианное время от фиксации рекомендации до старта внедрения.",
      valueLabel: formatHoursMetric(benchmarkTimeToActionP50),
      formula: "median(time_to_action_hours)",
      source: "Benchmark summary (`impact_metrics`).",
    },
    benchmark_validated_impact_rate: {
      label: "Подтвержденный impact (`validated_impact_rate`)",
      description: "Доля рекомендаций с подтвержденным эффектом после внедрения.",
      valueLabel: formatUnitPercentMetric(benchmarkValidatedImpactRate),
      formula: "recommendations_with_validated_impact / recommendations_applied * 100",
      source: "Benchmark summary (`impact_metrics`).",
    },
    stale_recommendations: {
      label: "Устаревшие рекомендации (`stale_recommendations`)",
      description: "Сколько рекомендаций прошли дату валидации и требуют пересмотра.",
      valueLabel: formatCountMetric(staleRecommendations),
      formula: "count(recommendations where validation_date < now)",
      source: "Карточки улучшений (`validationDate`).",
    },
  }), [
    agent.tasks.in_work,
    agent.tasks.on_control,
    agent.tasks.overdue,
    agentsReviewedDaily,
    formatCountMetric,
    formatDurationMetric,
    formatPercentMetric,
    formatHoursMetric,
    formatUnitPercentMetric,
    formatUsdMetric,
    planCoverageRate,
    p95TimeToContextMs,
    replanRate,
    recommendationActionRate,
    recommendationPrecision,
    regressionRate,
    reviewErrorRate,
    lessonCaptureRate,
    verificationPassRate,
    autonomousBugfixRate,
    eleganceGateRate,
    benchmarkPassAt5,
    benchmarkFactCoverageMean,
    benchmarkSchemaValidRate,
    benchmarkTrajectoryComplianceRate,
    benchmarkJudgeDisagreementRate,
    benchmarkCostPerSuccess,
    benchmarkPassRateVariance,
    benchmarkLatencyP95Ms,
    benchmarkRecommendationExecutabilityRate,
    benchmarkEvidenceLinkCoverage,
    benchmarkTimeToActionP50,
    benchmarkValidatedImpactRate,
    staleRecommendations,
    tqsAverage,
    validatedImpactRate,
  ]);

  const buildMetricRows = React.useCallback((keys: string[]): MetricDisplayItem[] => {
    return keys.map((metricKey) => {
      const meta = metricsByKey[metricKey];
      if (meta) {
        return { key: metricKey, ...meta };
      }
      return {
        key: metricKey,
        label: metricKey,
        description: "Метрика есть в каталоге, но ее описание и расчет пока не зафиксированы.",
        valueLabel: "не зафиксировано",
        formula: "не зафиксировано",
        source: "не зафиксировано",
      };
    });
  }, [metricsByKey]);

  const targetAgentMetrics = React.useMemo(
    () => buildMetricRows(operatingPlan?.metricsCatalog.agents || []),
    [buildMetricRows, operatingPlan],
  );
  const targetRoleMetrics = React.useMemo(
    () => buildMetricRows(operatingPlan?.metricsCatalog.analyst || []),
    [buildMetricRows, operatingPlan],
  );
  const workflowMetricRows = React.useMemo(
    () => buildMetricRows(workflowMetricsCatalog),
    [buildMetricRows, workflowMetricsCatalog],
  );
  const benchmarkStabilityMetricRows = React.useMemo(
    () => buildMetricRows([
      "pass_at_5",
      "fact_coverage_mean",
      "schema_valid_rate",
      "trajectory_compliance_rate",
      "judge_disagreement_rate",
      "cost_per_success",
      "pass_rate_variance",
      "benchmark_latency_p95_ms",
    ]),
    [buildMetricRows],
  );
  const benchmarkImpactMetricRows = React.useMemo(
    () => buildMetricRows([
      "recommendation_executability_rate",
      "evidence_link_coverage",
      "time_to_action_p50",
      "benchmark_validated_impact_rate",
    ]),
    [buildMetricRows],
  );
  const benchmarkGateMeta = React.useMemo(() => {
    if (!benchmarkGateStatus) return null;
    if (benchmarkGateStatus === "passed") {
      return { label: "Benchmark gate: passed", color: "success" as const, severity: "success" as const };
    }
    if (benchmarkGateStatus === "failed") {
      return { label: "Benchmark gate: failed", color: "error" as const, severity: "error" as const };
    }
    return { label: "Benchmark gate: warning", color: "warning" as const, severity: "warning" as const };
  }, [benchmarkGateStatus]);

  const sectionMeta: Record<SectionKey, { title: string; description: string; logic: string[] }> = React.useMemo(() => ({
    mcp: {
      title: "MCP",
      description:
        "Раздел фиксирует только фактическое использование MCP-инструментов: какие MCP реально применяются агентом, какой эффект они дают и в каких задачах используются.",
      logic: [
        "Показываются только MCP из usedMcp - это фактически использованные интеграции.",
        "Для каждого MCP отображаются: статус, последнее использование, практическая польза и результат в цифрах.",
        "Основание открывается в текстовой модалке с расчетной логикой и списком применений.",
      ],
    },
    skills_rules: {
      title: "Рабочий контур агента",
      description:
        "Раздел показывает 4 рабочих слоя агента: Навыки (SKILL.md), Инструменты (capabilities), MCP/Интеграции и Правила (operating policies).",
      logic: [
        "Используемые навыки берутся только из usedSkills и должны иметь путь к SKILL.md.",
        "Инструменты отображаются отдельно через usedTools/availableTools, не смешиваются с навыками.",
        "MCP/Интеграции показываются из mcpServers/usedMcp как отдельный integration-layer.",
        "Правила берутся из rulesApplied/contextRefs и открываются как исходный policy-контекст.",
      ],
    },
    tasks_quality: {
      title: "Задачи и качество",
      description:
        "Раздел рассчитывает фактические метрики качества и workflow-дисциплины по выбранному периоду: задачи, verify, self-improvement, review_error_rate и Task Quality Score.",
      logic: [
        "Период задается фильтром дат; метрики считаются только по событиям внутри периода.",
        "Доля ошибок review считается как review_errors / completed_tasks.",
        "Task Quality Score считается по задаче после выполнения и показывает итог качества выполнения task-level.",
        "Workflow KPI (plan/verify/lesson/replan/autonomous/elegance) строятся по telemetry status_counts.",
        "Benchmark стабильность и impact-метрики берутся из local-first артефакта `artifacts/agent_benchmark_summary.json`.",
        "Done Gate использует policy агента и показывает обязательные проверки перед финальным done.",
      ],
    },
    memory_context: {
      title: "Память и контекст",
      description:
        "Раздел отражает evidence-first контекст агента: опорные источники, участки файлов, а также оценку token budget и эффективности использования контекста.",
      logic: [
        "Контекстные якоря берутся из contextRefs и должны быть открываемыми в модалке текста.",
        "Логи инструмента подбираются по ключам log/heartbeat/monitor/trace/debug/review, при отсутствии — fallback на первый источник.",
        "Метрики токенов показывают оценку нагрузки и полезной доли контекста.",
      ],
    },
    improvements: {
      title: "Улучшения",
      description:
        "Раздел фиксирует предложения по улучшению эффективности работы данного ИИ-агента в его задачах на основании логов задач, ошибок review и данных инструмента отслеживания логов.",
      logic: [
        "Карточка улучшения содержит раздел, ICE, точку роста, решение, ожидаемый эффект и источники.",
        "Раздел улучшения определяется по явному полю section или автоматически по смыслу.",
        "Основания всегда доступны через ссылки на логи задач, review и логи инструмента.",
      ],
    },
  }), []);

  const filterImprovementsBySection = React.useCallback((section: SectionKey) => {
    return improvements.filter((item) => {
      if (section === "improvements") return true;
      const sectionValue = asString(item.section).toLowerCase();
      const isGlobal = sectionValue.includes("логика работы всех карточек")
        || sectionValue.includes("общая рекомендация")
        || sectionValue.includes("общая логика");
      if (isGlobal) return true;
      if (section === "mcp") return sectionValue.includes("mcp") || sectionValue.includes("интеграц");
      if (section === "skills_rules") return sectionValue.includes("навык") || sectionValue.includes("правил");
      if (section === "tasks_quality") return sectionValue.includes("задач") || sectionValue.includes("качеств") || sectionValue.includes("review");
      if (section === "memory_context") return sectionValue.includes("памят") || sectionValue.includes("контекст");
      return false;
    });
  }, [improvements]);

  const todayAction = () => {
    const today = toDateInputValue(new Date());
    setPeriodStart(today);
    setPeriodEnd(today);
  };

  const openTextModal = React.useCallback((payload: TextModalPayload) => {
    setTextModal(payload);
  }, []);

  const openContextText = React.useCallback((entry: { title: string; filePath: string; pathHint?: string | null; sourceUrl?: string | null }) => {
    const doc = docsByPath.get(normalizePath(entry.filePath));
    const fragment = extractMarkdownFragment(doc?.content || "", entry.pathHint || null);
    const sourceUrl = entry.sourceUrl || doc?.sourceUrl || makeSourceUrl(entry.filePath);
    const fallback = [
      `Источник: ${entry.title}`,
      `Файл: ${entry.filePath}`,
      entry.pathHint ? `Фокус: ${entry.pathHint}` : "",
      "",
      "Текст этого файла пока не загружен в индекс документации. Добавьте файл в generated docs-index.",
    ]
      .filter(Boolean)
      .join("\n");

    openTextModal({
      title: entry.title,
      path: entry.filePath,
      sourceUrl,
      updatedAt: doc?.updatedAt || null,
      content: doc?.content
        ? [
            `# ${entry.title}`,
            "",
            `- Файл: \`${entry.filePath}\``,
            entry.pathHint ? `- Фокус: ${entry.pathHint}` : "",
            fragment.matchedHeading ? `- Раздел в документе: ${fragment.matchedHeading}` : "",
            "",
            "## Релевантный фрагмент",
            fragment.content || doc.content,
          ]
            .filter(Boolean)
            .join("\n")
        : fallback,
    });
  }, [docsByPath, openTextModal]);

  const openSkillText = React.useCallback((name: string, content: string, sourceUrl?: string | null) => {
    openTextModal({
      title: `Навык: ${name}`,
      path: null,
      sourceUrl: sourceUrl || null,
      updatedAt: null,
      content,
    });
  }, [openTextModal]);

  const openArtifactText = React.useCallback((artifactPath: string, title: string) => {
    const pathValue = asString(artifactPath);
    if (!pathValue) return;
    const doc = docsByPath.get(normalizePath(pathValue));
    openTextModal({
      title,
      path: pathValue,
      sourceUrl: doc?.sourceUrl || makeSourceUrl(pathValue),
      updatedAt: doc?.updatedAt || null,
      content: doc?.content || `Источник не найден в docs-index: ${pathValue}`,
    });
  }, [docsByPath, openTextModal]);
  const openOperatingPlanSource = React.useCallback(() => {
    const planPath = asString(operatingPlanSource.path);
    if (!planPath) return;
    const planDoc = docsByPath.get(normalizePath(planPath));
    const fragment = extractMarkdownFragment(planDoc?.content || "", operatingPlanSource.pathHint || null);
    const sourceUrl = asString(operatingPlanSource.sourceUrl) || planDoc?.sourceUrl || makeSourceUrl(planPath);
    const fallback = [
      `Источник: ${operatingPlanSource.title}`,
      `Файл: ${planPath}`,
      operatingPlanSource.pathHint ? `Фокус: ${operatingPlanSource.pathHint}` : "",
      "",
      "Текст операционного стандарта не найден в индексах документации.",
    ]
      .filter(Boolean)
      .join("\n");

    openTextModal({
      title: operatingPlanSource.title,
      path: planPath,
      sourceUrl: sourceUrl || null,
      updatedAt: planDoc?.updatedAt || null,
      content: planDoc?.content
        ? [
            `# ${operatingPlanSource.title}`,
            "",
            `- Файл: \`${planPath}\``,
            operatingPlanSource.pathHint ? `- Фокус: ${operatingPlanSource.pathHint}` : "",
            fragment.matchedHeading ? `- Раздел: ${fragment.matchedHeading}` : "",
            "",
            "## Релевантный фрагмент",
            fragment.content || planDoc.content,
          ]
            .filter(Boolean)
            .join("\n")
        : fallback,
    });
  }, [docsByPath, openTextModal, operatingPlanSource]);

  const openAgentLogHistory = React.useCallback(() => {
    const planPath = asString(operatingPlanSource.path);
    const planDoc = planPath ? docsByPath.get(normalizePath(planPath)) : null;
    const planFragment = extractMarkdownFragment(planDoc?.content || "", operatingPlanSource.pathHint || null);

    const logDoc = docsByPath.get(normalizePath(agentLogPath));
    const parsedLogs = parseAgentLogTimeline(logDoc?.content || "");

    const timelineSection = parsedLogs.events.length > 0
      ? parsedLogs.events.map((event, index) => [
          `### ${index + 1}. ${event.timestamp ? formatDateTimeLong(event.timestamp) : "не зафиксировано"}`,
          `- status: ${event.status || "не зафиксировано"}`,
          `- step: ${event.step || "не зафиксировано"}`,
          `- task_id: ${event.task_id || "не зафиксировано"}`,
          `- run_id: ${event.run_id || "не зафиксировано"}`,
          `- trace_id: ${event.trace_id || "не зафиксировано"}`,
          `- recommendation_id: ${event.recommendation_id || "не зафиксировано"}`,
          `- mcp_tools: ${event.mcp_tools.length > 0 ? event.mcp_tools.join(", ") : "не зафиксировано"}`,
          `- outcome: ${event.outcome || "не зафиксировано"}`,
          `- line: ${event.line}`,
          "",
        ].join("\n"))
      : [
          "Логи не найдены в директории или файл еще не загружен в индекс.",
          `Ожидаемый путь: \`${agentLogPath}\``,
          "",
        ];

    openTextModal({
      title: `История логов ИИ агента: ${agent.name}`,
      path: logDoc ? agentLogPath : (planPath || null),
      updatedAt: logDoc?.updatedAt || planDoc?.updatedAt || null,
      sourceUrl: logDoc?.sourceUrl || makeSourceUrl(agentLogPath) || operatingPlanSource.sourceUrl || planDoc?.sourceUrl || null,
      content: [
        `# История логов ИИ агента: ${agent.name}`,
        "",
        "## Правило работы (релевантный фрагмент)",
        planPath ? `- Путь: \`${planPath}\`` : "- Путь: не зафиксирован",
        operatingPlanSource.pathHint ? `- Фокус: ${operatingPlanSource.pathHint}` : "",
        planFragment.matchedHeading ? `- Раздел: ${planFragment.matchedHeading}` : "",
        "",
        planFragment.content || "Фрагмент операционного стандарта не найден.",
        "",
        "## История запусков и действий",
        `- Путь к логам: \`${agentLogPath}\``,
        `- Всего строк в файле: ${parsedLogs.totalLines}`,
        `- Успешно разобрано: ${parsedLogs.events.length}`,
        `- Невалидных строк: ${parsedLogs.invalidLines}`,
        "",
        ...timelineSection,
      ].join("\n"),
    });
  }, [agent.id, agent.name, agentLogPath, docsByPath, openTextModal, operatingPlanSource]);

  const buildTaskEventsMarkdown = React.useCallback((title: string, events: Array<{ title: string; completedAt: string; reviewErrors: number }>) => {
    const rows = events.length > 0
      ? events.map((event, index) => [
          `## ${index + 1}. ${event.title}`,
          `- Завершено: ${formatDateTimeLong(event.completedAt)}`,
          `- Ошибок review: ${event.reviewErrors}`,
          `- Task Quality Score: ${calculateTaskQualityScore(event)}`,
          "",
        ].join("\n"))
      : ["Данные за выбранный период отсутствуют."];

    return [
      `# ${title}`,
      "",
      `- Период: ${formatPeriodLabel(periodStart, periodEnd)}`,
      `- Количество событий: ${events.length}`,
      `- Доля review-ошибок: ${reviewErrorRate}%`,
      `- Среднее время задачи: ${averageTaskDurationLabel}`,
      "",
      ...rows,
    ].join("\n");
  }, [averageTaskDurationLabel, calculateTaskQualityScore, periodEnd, periodStart, reviewErrorRate]);

  const openTaskLogs = React.useCallback(() => {
    openTextModal({
      title: `Логи задач (${filteredTaskEvents.length})`,
      content: buildTaskEventsMarkdown("Логи задач", filteredTaskEvents),
      path: null,
      updatedAt: null,
      sourceUrl: null,
    });
  }, [buildTaskEventsMarkdown, filteredTaskEvents, openTextModal]);

  const openReviewErrors = React.useCallback(() => {
    openTextModal({
      title: `Ошибки review (${reviewIssueEvents.length})`,
      content: buildTaskEventsMarkdown("Ошибки review", reviewIssueEvents),
      path: null,
      updatedAt: null,
      sourceUrl: null,
    });
  }, [buildTaskEventsMarkdown, openTextModal, reviewIssueEvents]);

  const openTaskEventReport = React.useCallback((event: { title: string; completedAt: string; reviewErrors: number }) => {
    const score = calculateTaskQualityScore(event);
    const issueDescription = event.reviewErrors > 0
      ? "Зафиксированы проблемы в review. Требуется разбор причин и anti-regression действие."
      : "Проблем в review не зафиксировано. Качество выполнения в рамках ожиданий.";

    const relatedImprovements = filterImprovementsBySection("tasks_quality");
    const relatedLines = relatedImprovements.length > 0
      ? relatedImprovements.map((item, index) => `- ${index + 1}. ${item.title} (ICE ${item.ice.score})`)
      : ["- Для раздела пока не зафиксированы отдельные улучшения."];

    openTextModal({
      title: `Отчет по задаче: ${event.title}`,
      content: [
        `# ${event.title}`,
        "",
        `- Завершено: ${formatDateTimeLong(event.completedAt)}`,
        `- Проблемы (review): ${event.reviewErrors}`,
        `- Task Quality Score: ${score}`,
        "",
        "## Формула TQS",
        "- `TQS = clamp(100 - 35*review_errors - 20*overdue_flag - 15*blocked_flag - 10*retry_count, 0, 100)`",
        "- В текущем контуре для карточки задачи используется доступная часть формулы: `100 - 35*review_errors`.",
        "",
        "## Диагностика",
        issueDescription,
        "",
        "## Релевантные улучшения раздела",
        ...relatedLines,
      ].join("\n"),
      path: null,
      updatedAt: null,
      sourceUrl: null,
    });
  }, [calculateTaskQualityScore, filterImprovementsBySection, openTextModal]);

  const openTaskEventContext = React.useCallback((event: { title: string; completedAt: string; reviewErrors: number }) => {
    const contextLines = contextRefs.length > 0
      ? contextRefs.map((entry, index) => {
          const doc = docsByPath.get(normalizePath(entry.filePath));
          const fragment = extractMarkdownFragment(doc?.content || "", entry.pathHint || null);
          return [
            `## Источник ${index + 1}: ${entry.title}`,
            `- Документ: \`${entry.filePath}\``,
            entry.pathHint ? `- Фокус: ${entry.pathHint}` : "",
            fragment.matchedHeading ? `- Раздел: ${fragment.matchedHeading}` : "",
            "",
            fragment.content || "Текст источника не загружен в индекс документации.",
            "",
          ]
            .filter(Boolean)
            .join("\n");
        })
      : ["Контекстные якоря не зафиксированы."];

    openTextModal({
      title: `Полный контекст задачи: ${event.title}`,
      content: [
        `# Полный контекст задачи`,
        "",
        `- Задача: ${event.title}`,
        `- Завершено: ${formatDateTimeLong(event.completedAt)}`,
        `- Проблемы (review): ${event.reviewErrors}`,
        "",
        "## Контекстные якоря (evidence-first)",
        ...contextLines,
      ].join("\n"),
      path: null,
      updatedAt: null,
      sourceUrl: null,
    });
  }, [contextRefs, docsByPath, openTextModal]);

  const openToolLogs = React.useCallback(() => {
    if (toolLogContextRefs.length === 0) {
      openTextModal({
        title: "Логи инструмента (0)",
        content: "Нет доступных источников логов инструмента в contextRefs.",
        path: null,
        updatedAt: null,
        sourceUrl: null,
      });
      return;
    }

    const sections = toolLogContextRefs.map((entry, index) => {
      const doc = docsByPath.get(normalizePath(entry.filePath));
      const fragment = extractMarkdownFragment(doc?.content || "", entry.pathHint || null);
      return [
        `## ${index + 1}. ${entry.title}`,
        `- Документ: \`${entry.filePath}\``,
        entry.pathHint ? `- Фокус: ${entry.pathHint}` : "",
        fragment.matchedHeading ? `- Раздел: ${fragment.matchedHeading}` : "",
        "",
        fragment.content || "Текст источника пока не загружен в docs-index.",
        "",
      ]
        .filter(Boolean)
        .join("\n");
    });

    const first = toolLogContextRefs[0];
    const firstDoc = docsByPath.get(normalizePath(first.filePath));

    openTextModal({
      title: `Логи инструмента (${toolLogContextRefs.length})`,
      content: [
        "# Данные инструмента отслеживания логов",
        "",
        "Источники, которые использовались ИИ-агентом:",
        ...sections,
      ].join("\n"),
      path: first.filePath,
      updatedAt: firstDoc?.updatedAt || null,
      sourceUrl: first.sourceUrl || firstDoc?.sourceUrl || makeSourceUrl(first.filePath),
    });
  }, [docsByPath, openTextModal, toolLogContextRefs]);

  const openSectionRules = React.useCallback((section: SectionKey) => {
    const meta = sectionMeta[section];
    const sectionImprovements = filterImprovementsBySection(section);
    const ruleSections = rulesApplied.map((rule, index) => {
      const location = asString(rule.location);
      const doc = location ? docsByPath.get(normalizePath(location)) : null;
      const fullText = asString(rule.fullText) || doc?.content || "Полный текст правила недоступен.";
      const linkedContext = location
        ? contextRefs.find((entry) => normalizePath(entry.filePath) === normalizePath(location))
        : null;
      const focusHint = linkedContext?.pathHint || rule.description || null;
      const fragment = extractMarkdownFragment(fullText, focusHint);
      return [
        `## Правило ${index + 1}: ${rule.title}`,
        `- Документ: ${linkedContext?.title || location || "unknown"}`,
        location ? `- Файл: \`${location}\`` : "",
        focusHint ? `- Фокус: ${focusHint}` : "",
        fragment.matchedHeading ? `- Раздел: ${fragment.matchedHeading}` : "",
        `- Описание: ${rule.description || "Описание отсутствует."}`,
        "",
        fragment.content || fullText,
        "",
      ].join("\n");
    });

    const rulesMarkdown = [
      `# Правила работы раздела «${meta.title}»`,
      "",
      meta.description,
      "",
      "## Фактическая логика раздела",
      ...meta.logic.map((line) => `- ${line}`),
      "",
      "## Системная структура карточки рекомендации",
      "- Раздел: к какому разделу относится улучшение.",
      "- Оценка эффекта ICE: Score | Impact | Confidence | Ease.",
      "- Точка роста: описание, что нужно улучшить.",
      "- Решение: однозначное действие, которое можно внедрить без интерпретаций.",
      "- Кнопка: «Скопировать промт для внедрения».",
      "",
      "## Логика поля «Раздел»",
      "- Если рекомендация про общую логику карточек (контракт, JSON Schema, CI, единые обязательные поля) — «Логика работы всех карточек (общая рекомендация)».",
      "- Если рекомендация про подключения и внешние инструменты — «MCP и интеграции».",
      "- Если рекомендация про навыки и правила — «Навыки и правила».",
      "- Если рекомендация про review/ошибки/качество задач — «Задачи и качество».",
      "- Если рекомендация про контекст/memory — «Память и контекст».",
      "- Если не удалось однозначно определить — «Общая логика работы агента».",
      "",
      "## Обязательная синхронизация изменений (contract-first)",
      "- При изменении логики раздела одновременно обновляются: UI, data-contract/schema, OAP docs, модалка `Правила работы раздела`.",
      "- Эталон внедрения workflow хранится в `docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md` и используется как базовый промт для analyst/designer карточек.",
      "- Нетривиальные изменения выполняются по циклу: Plan -> Execute -> Verify -> Learn.",
      "- Любая пользовательская correction фиксируется в lessons-loop как preventive rule.",
      "",
      "## Источники данных",
      `- Логи задач: ${filteredTaskEvents.length} событий за выбранный период.`,
      `- Ошибки review: ${reviewIssueEvents.length} событий с ошибками.`,
      `- Данные инструмента отслеживания логов: ${toolLogContextRefs.length} источников.`,
      `- Релевантные улучшения по разделу: ${sectionImprovements.length}.`,
      "",
      "## Логика ICE",
      "- Impact, Confidence, Ease нормализуются в диапазон 1..10.",
      "- Score считается как сумма: Impact + Confidence + Ease.",
      "- Максимальный Score: 30.",
      "",
      ...(section === "tasks_quality"
        ? [
            "## Логика метрик раздела «Задачи и качество»",
            "- `review_error_rate = review_errors / completed_tasks * 100`.",
            "- `TQS = clamp(100 - 35*review_errors - 20*overdue_flag - 15*blocked_flag - 10*retry_count, 0, 100)`.",
            "- В текущем источнике task-level доступны только `review_errors`, поэтому в UI используется доступная часть формулы: `TQS = clamp(100 - 35*review_errors, 0, 100)`.",
            "- Среднее время задачи считается только при наличии task-level duration; если данных нет, показывается `N/A`.",
            "- `plan_coverage_rate = plan_signal_tasks / tasks_total * 100`, где `plan_signal_tasks` включает `planned|replanned` и `step=plan*` при `status=started`.",
            "- `verification_pass_rate = verify_passed / verify_started * 100`.",
            "- `lesson_capture_rate = lesson_captured / (verify_passed + verify_failed) * 100`.",
            "- `replan_rate = replanned / planned * 100`.",
            "- `autonomous_bugfix_rate = bugfix_autonomous / tasks_total * 100`.",
            "- `elegance_gate_rate = elegance_checked / planned * 100`.",
            "- `pass_at_5 = successful_cases / total_cases`.",
            "- `fact_coverage_mean = avg(facts_covered / expected_facts)`.",
            "- `schema_valid_rate = valid_schema_attempts / attempts_total`.",
            "- `trajectory_compliance_rate = trajectory_ok_attempts / attempts_total`.",
            "- `judge_disagreement_rate = judge_human_disagreements / human_calibrated_cases`.",
            "- `cost_per_success = cost_total_usd / successful_cases`.",
            "- Impact-метрики benchmark: `recommendation_executability_rate`, `evidence_link_coverage`, `time_to_action_p50`, `validated_impact_rate`.",
            "- Done Gate проверяет обязательные checks policy (`plan`, `verify`, `lesson`) перед финальным done.",
            "",
            "## ICE vs TQS vs IES",
            "- ICE: до выполнения; зачем — выбрать, что внедрять в первую очередь; уровень — рекомендация/инициатива.",
            "- TQS: после выполнения задачи; зачем — оценить качество выполнения конкретной задачи; уровень — task-level.",
            "- IES (outcome): метрика эффекта улучшений после внедрения (например `kpi_delta`, `time_to_value`, `regression_rate`).",
            "",
            "Итого:",
            "- ICE отвечает на вопрос: «что делать сначала?»",
            "- TQS отвечает на вопрос: «насколько хорошо сделали задачу?»",
            "- Для итогового эффекта улучшения нужен отдельный outcome-score (IES).",
          ]
        : []),
      "",
      "## Полные тексты правил",
      ruleSections.length > 0 ? ruleSections.join("\n") : "Правила пока не зафиксированы.",
      "",
      "## Fallback-правила",
      "- Если нет источников логов инструмента по ключам, берется первый contextRef.",
      "- Если событий задач нет, карточка использует нейтральную формулировку основания.",
      "- Если для навыка не найден файл SKILL.md, показывается явное уведомление о missing source.",
    ].join("\n");

    openTextModal({
      title: "Правила работы раздела",
      content: rulesMarkdown,
      path: null,
      updatedAt: null,
      sourceUrl: null,
    });
  }, [
    docsByPath,
    filterImprovementsBySection,
    filteredTaskEvents.length,
    openTextModal,
    reviewIssueEvents.length,
    rulesApplied,
    sectionMeta,
    toolLogContextRefs.length,
    contextRefs,
  ]);

  const openSectionRecommendations = React.useCallback((section: SectionKey) => {
    const meta = sectionMeta[section];
    const sectionImprovements = filterImprovementsBySection(section);
    const lines: string[] = [
      `# Рекомендации по разделу: ${meta.title}`,
      "",
      meta.description,
      "",
      "Контекст периода:",
      `- Период анализа: ${periodStart || "не задан"} -> ${periodEnd || "не задан"}`,
      `- Логи задач: ${filteredTaskEvents.length}`,
      `- Ошибки review: ${reviewIssueEvents.length}`,
      `- Логи инструмента: ${toolLogContextRefs.length}`,
      "",
    ];

    if (sectionImprovements.length === 0) {
      lines.push("Для этого раздела пока нет отдельных улучшений. Проверьте общий раздел «Улучшения».");
    } else {
      sectionImprovements.forEach((item, index) => {
        lines.push(
          `## Рекомендация ${index + 1}`,
          `- Раздел: ${item.section}`,
          `- Оценка эффекта ICE: Score: ${item.ice.score} | Impact: ${item.ice.impact} | Confidence: ${item.ice.confidence} | Ease: ${item.ice.ease}`,
          `- Точка роста: ${item.problem}`,
          `- Решение: ${item.solution}`,
          `- Ожидаемый эффект: ${item.effect}`,
          `- Основание (источники): Логи задач (${filteredTaskEvents.length}) | Ошибки review (${reviewIssueEvents.length}) | Логи инструмента (${toolLogContextRefs.length})`,
          "",
        );
      });
    }

    if ((agent.analystRecommendations || []).length > 0) {
      lines.push("## Дополнительно: общий список рекомендаций");
      (agent.analystRecommendations || []).forEach((item, index) => {
        lines.push(`${index + 1}. ${item}`);
      });
    }

    openTextModal({
      title: `Рекомендации по разделу - ${meta.title}`,
      content: lines.join("\n"),
      path: null,
      updatedAt: null,
      sourceUrl: null,
    });
  }, [
    agent.analystRecommendations,
    filterImprovementsBySection,
    filteredTaskEvents.length,
    openTextModal,
    periodEnd,
    periodStart,
    reviewIssueEvents.length,
    sectionMeta,
    toolLogContextRefs.length,
  ]);

  const renderSectionHeader = React.useCallback((section: SectionKey) => {
    const meta = sectionMeta[section];
    return (
      <Paper variant="outlined" sx={{ p: 1.25 }}>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Описание раздела
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {meta.description}
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
          <Button size="small" variant="outlined" onClick={() => openSectionRules(section)}>
            Правила работы раздела
          </Button>
          <Button size="small" variant="outlined" onClick={() => openSectionRecommendations(section)}>
            Рекомендации по разделу
          </Button>
        </Stack>
      </Paper>
    );
  }, [openSectionRecommendations, openSectionRules, sectionMeta]);

  const markCopied = React.useCallback((key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? null : current));
    }, 1500);
  }, []);

  const buildImprovementImplementationPrompt = React.useCallback((item: ImprovementViewModel, index: number) => {
    return [
      `# Внедрение улучшения ${index + 1} для агента «${agent.name}»`,
      "",
      "Контекст:",
      `- Статус агента: ${status.label}`,
      `- Период анализа: ${periodStart || "не задан"} -> ${periodEnd || "не задан"}`,
      `- Логи задач: ${filteredTaskEvents.length}`,
      `- Ошибки review: ${reviewIssueEvents.length}`,
      `- Логи инструмента: ${toolLogContextRefs.length}`,
      "",
      "Карточка улучшения:",
      `- Раздел: ${item.section}`,
      `- Оценка эффекта ICE: Score: ${item.ice.score} | Impact: ${item.ice.impact} | Confidence: ${item.ice.confidence} | Ease: ${item.ice.ease}`,
      `- Точка роста: ${item.problem}`,
      `- Решение: ${item.solution}`,
      `- Ожидаемый эффект: ${item.effect}`,
      `- Основание: ${item.basis}`,
      "",
      "Задача для Codex:",
      "1. Реализуй решение в кодовой базе с минимально достаточными изменениями.",
      "2. Не меняй публичные API/контракты без необходимости.",
      "3. Добавь проверку, что улучшение действительно внедрено.",
      "4. В отчете укажи: что изменено, риски, как проверено.",
    ].join("\n");
  }, [agent.name, filteredTaskEvents.length, periodEnd, periodStart, reviewIssueEvents.length, status.label, toolLogContextRefs.length]);

  const allImprovementsMarkdown = React.useMemo(() => {
    const lines: string[] = [
      `# Список всех улучшений агента «${agent.name}»`,
      "",
      "Сводный контекст:",
      `- Статус агента: ${status.label}`,
      `- Период анализа: ${periodStart || "не задан"} -> ${periodEnd || "не задан"}`,
      `- Логи задач: ${filteredTaskEvents.length}`,
      `- Ошибки review: ${reviewIssueEvents.length}`,
      `- Логи инструмента: ${toolLogContextRefs.length}`,
      "",
    ];

    if (improvements.length === 0) {
      lines.push("Улучшения за выбранный период отсутствуют.");
      return lines.join("\n");
    }

    improvements.forEach((item, index) => {
      lines.push(
        `## Улучшение ${index + 1}`,
        `- Раздел: ${item.section}`,
        `- Оценка эффекта ICE: Score: ${item.ice.score} | Impact: ${item.ice.impact} | Confidence: ${item.ice.confidence} | Ease: ${item.ice.ease}`,
        `- Точка роста: ${item.problem}`,
        `- Решение: ${item.solution}`,
        `- Ожидаемый эффект: ${item.effect}`,
        `- Основание: ${item.basis}`,
        `- Источники: Логи задач (${filteredTaskEvents.length}) | Ошибки review (${reviewIssueEvents.length}) | Логи инструмента (${toolLogContextRefs.length})`,
        "",
      );
    });

    lines.push(
      "Итоговая задача для внедрения:",
      "1. Пройди по каждому улучшению сверху вниз.",
      "2. Для каждого улучшения внеси изменение, затем проверь результат.",
      "3. Зафиксируй эффект и риски по завершении.",
    );
    return lines.join("\n");
  }, [agent.name, filteredTaskEvents.length, improvements, periodEnd, periodStart, reviewIssueEvents.length, status.label, toolLogContextRefs.length]);

  const openAllImprovementsModal = React.useCallback(() => {
    openTextModal({
      title: `Список всех улучшений (${improvements.length})`,
      content: allImprovementsMarkdown,
      path: null,
      updatedAt: null,
      sourceUrl: null,
    });
  }, [allImprovementsMarkdown, improvements.length, openTextModal]);

  const copyAllImprovements = React.useCallback(async () => {
    const copied = await copyTextToClipboard(allImprovementsMarkdown);
    if (copied) {
      markCopied("all-improvements");
      return;
    }
    openAllImprovementsModal();
  }, [allImprovementsMarkdown, markCopied, openAllImprovementsModal]);

  const copyImprovementPrompt = React.useCallback(async (item: ImprovementViewModel, index: number) => {
    const prompt = item.promptMarkdown || buildImprovementImplementationPrompt(item, index);
    const copied = await copyTextToClipboard(prompt);
    if (copied) {
      markCopied(`improvement-${item.key}`);
      return;
    }
    openTextModal({
      title: `Промт для внедрения: улучшение ${index + 1}`,
      content: prompt,
      path: null,
      updatedAt: null,
      sourceUrl: null,
    });
  }, [buildImprovementImplementationPrompt, markCopied, openTextModal]);

  const renderMetricRows = React.useCallback((rows: MetricDisplayItem[]) => {
    if (rows.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          Метрики для этого блока пока не зафиксированы.
        </Typography>
      );
    }

    return (
      <Stack spacing={0.85}>
        {rows.map((item, index) => (
          <Box
            key={item.key}
            sx={{
              pt: index === 0 ? 0 : 0.85,
              borderTop: index === 0 ? "none" : "1px solid",
              borderColor: "divider",
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} alignItems={{ sm: "center" }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={0.25} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {item.label}
                  </Typography>
                  <Tooltip
                    arrow
                    placement="top-start"
                    title={
                      <Box sx={{ maxWidth: 420 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                          Как считается
                        </Typography>
                        <Typography variant="caption" sx={{ display: "block" }}>
                          {item.formula}
                        </Typography>
                        <Typography variant="caption" sx={{ mt: 0.45, display: "block", opacity: 0.95 }}>
                          Источник: {item.source}
                        </Typography>
                      </Box>
                    }
                  >
                    <IconButton size="small" aria-label={`Как считается метрика ${item.key}`} sx={{ p: 0.4 }}>
                      <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div">
                  {item.description}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700, minWidth: { sm: 140 }, textAlign: { sm: "right" } }}>
                {item.valueLabel}
              </Typography>
            </Stack>
          </Box>
        ))}
      </Stack>
    );
  }, []);

  return (
    <Stack spacing={2} sx={{ px: 2.25, pb: 2.25 }}>
      <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" aria-label="Вкладки профиля агента">
        <Tab label="Обзор" />
        <Tab label="MCP" />
        <Tab label="Навыки и Правила" />
        <Tab label="Задачи и качество" />
        <Tab label="Память и контекст" />
        <Tab label="Улучшения" />
      </Tabs>

      {tabKey === "overview" ? (
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Chip size="small" label={status.label} color={status.color} />
            <Chip size="small" label={riskMeta.label} color={riskMeta.color} variant="outlined" />
            <Typography variant="body2" color="text.secondary">
              Обновлено: {formatDateTime(agent.updatedAt)}
            </Typography>
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Паспорт агента
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {agent.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {agent.shortDescription || agent.role}
            </Typography>
            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.8 }}>
              <Typography variant="caption" color="text.secondary">
                Источник: {agent.source}
              </Typography>
              {agent.trackerUrl ? (
                <Typography variant="caption">
                  <Link href={agent.trackerUrl} target="_blank" rel="noopener noreferrer">
                    Трекер задач
                  </Link>
                </Typography>
              ) : null}
              {agent.processLink?.url ? (
                <Typography variant="caption">
                  <Link href={agent.processLink.url} target="_blank" rel="noopener noreferrer">
                    {agent.processLink.title || "Схема бизнес-процесса"}
                  </Link>
                </Typography>
              ) : null}
            </Stack>
          </Paper>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
              gap: 1,
            }}
          >
            <SummaryMetricCard
              title="Задач в работе"
              value={agent.tasks.in_work}
              note="queued + running + retrying"
              icon={<PendingActionsOutlinedIcon fontSize="small" />}
            />
            <SummaryMetricCard
              title="На контроле"
              value={agent.tasks.on_control}
              note="waiting_review + blocked + waiting_external"
              icon={<ScheduleOutlinedIcon fontSize="small" />}
            />
            <SummaryMetricCard
              title="MCP coverage"
              value={`${mcpUtilizationRate}%`}
              note={`${usedMcp.length} из ${agent.mcpServers.length} используются`}
              icon={<TuneRoundedIcon fontSize="small" />}
            />
            <SummaryMetricCard
              title="Skill coverage"
              value={`${skillUtilizationRate}%`}
              note={`${usedSkills.length} из ${skillBaseCount || 0} используются`}
              icon={<SmartToyOutlinedIcon fontSize="small" />}
            />
          </Box>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Состояние и логика оценки
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Почему текущий статус: {statusReason}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.45 }}>
              Следующее действие: {nextAction}
            </Typography>
            {agent.runbook ? (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.55 }}>
                Runbook: {agent.runbook}
              </Typography>
            ) : null}
            <Alert severity={highRisk ? "error" : mediumRisk ? "warning" : "success"} sx={{ mt: 1 }}>
              Фокус на ближайший цикл: {keyAction}
            </Alert>
          </Paper>
        </Stack>
      ) : null}

      {tabKey === "mcp" ? (
        <Stack spacing={1.25}>
          {renderSectionHeader("mcp")}

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              MCP которые использует ИИ агент
            </Typography>
            {usedMcp.length > 0 ? (
              <Stack spacing={1}>
                {usedMcp.map((item) => {
                  const normalized = normalizeUsedMcpStatus(item.status || "offline");
                  const meta = usedMcpStatusMeta[normalized];
                  const practicalTasks = toStringArray(item.practicalTasks);
                  const statusLabel =
                    normalized === "active"
                      ? "Активен"
                      : normalized === "degraded"
                        ? "Ограничено"
                        : normalized === "reauth_required"
                          ? "Требуется переподключение"
                          : "Недоступен";
                  const updatedAt = inferMcpLastUsedAt(item, taskEvents);
                  const relatedImprovement =
                    improvements.find((entry) => {
                      const source = normalizeLoose(
                        `${entry.title} ${entry.problem} ${entry.solution} ${entry.section} ${entry.ownerSection}`,
                      );
                      return source.includes(normalizeLoose(item.name)) || source.includes("mcp");
                    }) || null;
                  const basisText =
                    relatedImprovement?.basis ||
                    "Основание рассчитано по telemetry: фактическое использование MCP в задачах, статус подключения и зафиксированный результат.";
                  const impactText = asString(item.impactInNumbers) || "нет данных";
                  const tasksUrl = `#/tasks?mcp=${encodeURIComponent(item.name)}${
                    practicalTasks.length > 0 ? `&task_keys=${encodeURIComponent(practicalTasks.join("|"))}` : ""
                  }`;
                  return (
                    <Paper key={`${agent.id}-used-mcp-${item.name}`} variant="outlined" sx={{ p: 1.1 }}>
                      <Stack spacing={0.75}>
                        <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>
                            MCP {item.name}
                          </Typography>
                          <Chip size="small" label={statusLabel} color={meta.color} />
                          <Typography variant="body2" color="text.secondary">
                            Обновлено {updatedAt ? formatDateTimeLong(updatedAt) : "не зафиксировано"}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
                            Что дает ИИ агенту:
                          </Box>{" "}
                          {item.note || "Помогает уменьшать ручные операции и ускорять выполнение задач."}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>
                            Результат в цифрах:
                          </Box>{" "}
                          {impactText}.{" "}
                          <Link
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              openTextModal({
                                title: `Основание результата - MCP ${item.name}`,
                                content: [
                                  `# Основание результата: MCP ${item.name}`,
                                  "",
                                  `- Статус: ${statusLabel}`,
                                  `- Обновлено: ${updatedAt ? formatDateTimeLong(updatedAt) : "не зафиксировано"}`,
                                  `- Что дает ИИ агенту: ${item.note || "не зафиксировано"}`,
                                  `- Результат в цифрах: ${impactText}`,
                                  "",
                                  "## Как считалось",
                                  "- Поле «Результат в цифрах» берется из карточки MCP: `usedMcp[].impactInNumbers`.",
                                  basisText,
                                  "",
                                  "## Задачи, где применялся MCP",
                                  practicalTasks.length > 0 ? practicalTasks.map((task, index) => `${index + 1}. ${task}`).join("\n") : "нет данных",
                                ].join("\n"),
                                path: null,
                                updatedAt: asString(agent.updatedAt) || null,
                                sourceUrl: null,
                              });
                            }}
                          >
                            Основание
                          </Link>
                          .
                        </Typography>
                        <Typography variant="body2" color="text.secondary" component="div">
                          <Link href={tasksUrl} target="_blank" rel="noopener noreferrer">
                            Открыть список задач, в которых был применен этот MCP
                          </Link>
                        </Typography>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Alert severity="info">Пока нет зафиксированных использований MCP.</Alert>
            )}
          </Paper>
        </Stack>
      ) : null}

      {tabKey === "skills_rules" ? (
        <Stack spacing={1.25}>
          {renderSectionHeader("skills_rules")}

          {isModernAgent(agent.id) ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                План работы
              </Typography>
              {operatingPlan ? (
                <Stack spacing={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Миссия
                    </Typography>
                    <Typography variant="body2">{operatingPlan.mission}</Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.4 }}>
                      Процесс по которому работает ИИ агент
                    </Typography>
                    <Stack spacing={0.35}>
                      {operatingPlan.dailyLoop.map((step, index) => (
                        <Typography key={`op-loop-${index}`} variant="body2">{`${index + 1}. ${step}`}</Typography>
                      ))}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Путь
                    </Typography>
                    <Typography variant="body2">
                      {operatingPlanSource.path ? (
                        <Link
                          component="a"
                          href="#"
                          underline="hover"
                          sx={{
                            fontSize: "inherit",
                            verticalAlign: "baseline",
                            userSelect: "text",
                            WebkitUserSelect: "text",
                            MozUserSelect: "text",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            lineBreak: "anywhere",
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            if (isTextSelectionActive()) return;
                            openOperatingPlanSource();
                          }}
                        >
                          {operatingPlanSource.path}
                        </Link>
                      ) : "не зафиксирован"}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">
                      История логов ИИ агента
                    </Typography>
                    <Typography variant="body2">
                      <Link
                        component="a"
                        href="#"
                        underline="hover"
                        sx={{
                          fontSize: "inherit",
                          verticalAlign: "baseline",
                          userSelect: "text",
                          WebkitUserSelect: "text",
                          MozUserSelect: "text",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          lineBreak: "anywhere",
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          if (isTextSelectionActive()) return;
                          openAgentLogHistory();
                        }}
                      >
                        {agentLogPath}
                      </Link>
                    </Typography>
                  </Box>
                </Stack>
              ) : (
                <Alert severity="info">План работы пока не зафиксирован в данных агента.</Alert>
              )}
            </Paper>
          ) : null}

          {isModernAgent(agent.id) ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
                Self-improvement loop
              </Typography>
              <Stack spacing={0.55}>
                <Typography variant="body2">
                  Plan default: {workflowPolicy?.planDefault ? "включено" : "не зафиксировано"}
                </Typography>
                <Typography variant="body2">
                  Re-plan on deviation: {workflowPolicy?.replanOnDeviation ? "включено" : "не зафиксировано"}
                </Typography>
                <Typography variant="body2">
                  Verify before done: {workflowPolicy?.verifyBeforeDone ? "включено" : "не зафиксировано"}
                </Typography>
                <Typography variant="body2">
                  Lessons loop: {workflowPolicy?.selfImprovementLoop ? "включено" : "не зафиксировано"}
                </Typography>
                <Typography variant="body2">
                  Autonomous bugfix: {workflowPolicy?.autonomousBugfix ? "включено" : "не зафиксировано"}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.2 }}>
                  Последний урок: {learningArtifacts?.lastLessonAt ? formatDateTime(learningArtifacts.lastLessonAt) : "не зафиксировано"}
                </Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.4 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => openArtifactText(learningArtifacts?.todoPath || "docs/subservices/oap/tasks/todo.md", "OAP Workflow TODO")}
                  >
                    Открыть todo
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => openArtifactText(learningArtifacts?.lessonsPath || "docs/subservices/oap/tasks/lessons.md", "OAP Lessons Log")}
                  >
                    Открыть lessons
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => openArtifactText("docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md", "OAP Workflow Prompt")}
                  >
                    Открыть workflow prompt
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ) : null}

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Рабочий контур агента
            </Typography>
            <Stack spacing={1.1} divider={<Divider flexItem />}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Навыки
                </Typography>
                {usedSkills.length > 0 ? (
                  <Stack spacing={1}>
                    {usedSkills.map((skill) => {
                      const lastUsedAt = inferSkillLastUsedAt(skill, taskEvents);
                      const skillFilePath = asString(skill.skillFilePath);
                      const skillFileText = asString(skill.skillFileText);
                      const skillDoc = skillFilePath ? docsByPath.get(normalizePath(skillFilePath)) : null;
                      const skillTextForModal = skillFileText || skillDoc?.content || asString(skill.fullText) || "Текст навыка не найден.";
                      const skillSourceUrl = skillDoc?.sourceUrl || (skillFilePath ? makeSourceUrl(skillFilePath) : null);
                      const skillModalContent = [
                        `# Навык: ${skill.name}`,
                        "",
                        skillFilePath ? `- Файл: \`${skillFilePath}\`` : "",
                        "",
                        "## Текст навыка",
                        skillTextForModal,
                      ]
                        .filter(Boolean)
                        .join("\n");
                      return (
                        <Paper key={`${agent.id}-used-skill-${skill.name}`} variant="outlined" sx={{ p: 1.1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {skill.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.35 }}>
                            Время последнего использования: {lastUsedAt ? formatDateTime(lastUsedAt) : "нет данных"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="div">
                            Путь к SKILL.md: {skillFilePath || "не зафиксирован"}
                          </Typography>
                          <Box
                            sx={{
                              mt: 0.45,
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1.5,
                              p: 0.9,
                              bgcolor: "grey.50",
                              maxHeight: 160,
                              overflow: "auto",
                              whiteSpace: "pre-wrap",
                              fontSize: 12,
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}
                          >
                            {skillTextForModal}
                          </Box>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                            <Button
                              size="small"
                              onClick={() =>
                                openTextModal({
                                  title: `Навык: ${skill.name}`,
                                  content: skillModalContent,
                                  path: skillFilePath || null,
                                  updatedAt: skillDoc?.updatedAt || null,
                                  sourceUrl: skillSourceUrl || null,
                                })
                              }
                            >
                              Открыть текст
                            </Button>
                            {skillSourceUrl ? (
                              <Button size="small" component={Link} href={skillSourceUrl} target="_blank" rel="noopener noreferrer">
                                Открыть source-файл
                              </Button>
                            ) : null}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : (
                  <Alert severity="info">Используемые навыки пока не зафиксированы.</Alert>
                )}
              </Box>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Инструменты
                </Typography>
                {usedTools.length > 0 ? (
                  <Stack spacing={0.9}>
                    {usedTools.map((tool) => (
                      <Paper key={`${agent.id}-used-tool-${tool.name}`} variant="outlined" sx={{ p: 1.05 }}>
                        <Stack spacing={0.35}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {tool.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {tool.usage}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Источник: {tool.source}
                          </Typography>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            <Button
                              size="small"
                              onClick={() =>
                                openTextModal({
                                  title: `Инструмент: ${tool.name}`,
                                  content: [tool.usage, "", tool.fullText].filter(Boolean).join("\n\n"),
                                  path: null,
                                  sourceUrl: null,
                                  updatedAt: null,
                                })
                              }
                            >
                              Открыть описание
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                    {availableTools.length > 0 ? (
                      <Typography variant="caption" color="text.secondary">
                        Рекомендованные инструменты: {availableTools.map((tool) => tool.name).join(", ")}
                      </Typography>
                    ) : null}
                  </Stack>
                ) : (
                  <Alert severity="info">Инструменты пока не зафиксированы.</Alert>
                )}
              </Box>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  MCP / Интеграции
                </Typography>
                {usedMcp.length > 0 ? (
                  <Stack spacing={0.75} divider={<Divider flexItem />}>
                    {usedMcp.map((item) => {
                      const normalized = normalizeUsedMcpStatus(item.status || "offline");
                      const meta = usedMcpStatusMeta[normalized];
                      return (
                        <Box key={`${agent.id}-work-contour-mcp-${item.name}`}>
                          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {item.name}
                            </Typography>
                            <Chip size="small" label={meta.label} color={meta.color} />
                          </Stack>
                          {item.note ? (
                            <Typography variant="caption" color="text.secondary" component="div">
                              {item.note}
                            </Typography>
                          ) : null}
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Alert severity="info">MCP / интеграции пока не зафиксированы.</Alert>
                )}
              </Box>

              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Правила
                </Typography>
                {rulesApplied.length > 0 ? (
                  <Stack spacing={1}>
                    {rulesApplied.map((rule, index) => {
                      const rulePath = asString(rule.location);
                      const doc = rulePath ? docsByPath.get(normalizePath(rulePath)) : null;
                      const ruleFullText = asString(rule.fullText) || doc?.content || "Файл правила не найден по зарегистрированному пути.";
                      const linkedContext = rulePath
                        ? contextRefs.find((entry) => normalizePath(entry.filePath) === normalizePath(rulePath))
                        : null;
                      const focusHint = linkedContext?.pathHint || rule.description || null;
                      const fragment = extractMarkdownFragment(ruleFullText, focusHint);
                      const ruleSourceUrl = rule.sourceUrl || doc?.sourceUrl || (rulePath ? makeSourceUrl(rulePath) : null);
                      const modalTitle = linkedContext?.title || rule.title || `Правило ${index + 1}`;
                      const modalContent = [
                        `# ${modalTitle}`,
                        "",
                        rulePath ? `- Файл: \`${rulePath}\`` : "",
                        focusHint ? `- Фокус: ${focusHint}` : "",
                        fragment.matchedHeading ? `- Раздел: ${fragment.matchedHeading}` : "",
                        "",
                        "## Релевантный фрагмент",
                        fragment.content || ruleFullText,
                      ]
                        .filter(Boolean)
                        .join("\n");

                      return (
                        <Paper key={`${agent.id}-rule-${index}`} variant="outlined" sx={{ p: 1.1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Источник: {modalTitle}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="div">
                            Файл: {rulePath || "не зафиксирован"}
                          </Typography>
                          {focusHint ? (
                            <Typography variant="caption" color="text.secondary" component="div">
                              Фокус: {focusHint}
                            </Typography>
                          ) : null}
                          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.45 }}>
                            Релевантный фрагмент:
                          </Typography>
                          <Box
                            sx={{
                              mt: 0.4,
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 1.5,
                              p: 0.9,
                              bgcolor: "grey.50",
                              maxHeight: 180,
                              overflow: "auto",
                              whiteSpace: "pre-wrap",
                              fontSize: 12,
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}
                          >
                            {fragment.content || ruleFullText}
                          </Box>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                            <Button
                              size="small"
                              onClick={() =>
                                openTextModal({
                                  title: modalTitle,
                                  content: modalContent,
                                  path: rulePath || null,
                                  updatedAt: doc?.updatedAt || null,
                                  sourceUrl: ruleSourceUrl || null,
                                })
                              }
                            >
                              Открыть фрагмент в модалке
                            </Button>
                            {ruleSourceUrl ? (
                              <Button size="small" component={Link} href={ruleSourceUrl} target="_blank" rel="noopener noreferrer">
                                Открыть source-файл
                              </Button>
                            ) : null}
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : (
                  <Alert severity="info">Правила пока не зафиксированы.</Alert>
                )}
              </Box>
            </Stack>
          </Paper>
        </Stack>
      ) : null}

      {tabKey === "tasks_quality" ? (
        <Stack spacing={1.25}>
          {renderSectionHeader("tasks_quality")}

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <TextField
                size="small"
                label="С"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                label="По"
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Button variant="outlined" onClick={todayAction}>
                Сегодня
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
              Фильтр Период: {formatPeriodLabel(periodStart, periodEnd)}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap" alignItems={{ md: "center" }}>
              <Typography variant="body2">
                Всего задач: {completedTasks} | Ошибок: {reviewErrors}
              </Typography>
              <Button size="small" variant="outlined" onClick={openTaskLogs}>
                Показать список
              </Button>
              <Typography variant="body2">
                review_error_rate: {reviewErrorRate}% | Ср время: {averageTaskDurationLabel}
              </Typography>
              {lastTask ? (
                <Typography variant="caption" color="text.secondary">
                  Последняя задача: {lastTask.title}
                </Typography>
              ) : null}
            </Stack>
          </Paper>

          {isModernAgent(agent.id) && operatingPlan ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2">Целевые метрики (факт за выбранный период)</Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.4 }}>
                Метрики показываются как фактические значения, а не как теги. Нажмите на иконку рядом с метрикой, чтобы увидеть формулу и источник.
              </Typography>

              <Box sx={{ mt: 1.1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
                  Агенты (исполнительный контур)
                </Typography>
                {renderMetricRows(targetAgentMetrics)}
              </Box>

              <Box sx={{ mt: 1.2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
                  {agent.name} (контур качества)
                </Typography>
                {renderMetricRows(targetRoleMetrics)}
              </Box>

              <Box sx={{ mt: 1.2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
                  {agent.name} (workflow-дисциплина)
                </Typography>
                {renderMetricRows(workflowMetricRows)}
              </Box>
            </Paper>
          ) : null}

          {isModernAgent(agent.id) && agent.id === "analyst-agent" ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2">Benchmark стабильность</Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.4 }}>
                Local-first benchmark-контур: `artifacts/agent_benchmark_summary.json`. Все метрики ниже имеют tooltip с формулой и источником.
              </Typography>
              {benchmarkScopedToAgent ? (
                <>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mt: 0.85 }}>
                    <Typography variant="body2">
                      run_id: {benchmarkRunId || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2">
                      кейсы: {benchmarkDatasetCases === null ? "не зафиксировано" : Math.round(benchmarkDatasetCases)}
                    </Typography>
                    <Typography variant="body2">
                      attempts: {benchmarkAttemptsTotal === null ? "не зафиксировано" : Math.round(benchmarkAttemptsTotal)}
                    </Typography>
                    {benchmarkGateMeta ? (
                      <Chip
                        size="small"
                        color={benchmarkGateMeta.color}
                        variant={benchmarkGateMeta.color === "warning" ? "outlined" : "filled"}
                        label={benchmarkGateMeta.label}
                      />
                    ) : null}
                  </Stack>

                  <Box sx={{ mt: 1.1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
                      Стабильность и качество ответа
                    </Typography>
                    {renderMetricRows(benchmarkStabilityMetricRows)}
                  </Box>

                  <Box sx={{ mt: 1.15 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
                      Impact рекомендаций
                    </Typography>
                    {renderMetricRows(benchmarkImpactMetricRows)}
                  </Box>

                  {benchmarkGateMeta ? (
                    <Alert severity={benchmarkGateMeta.severity} sx={{ mt: 0.95 }}>
                      {benchmarkGateStatus === "passed"
                        ? "Benchmark gate пройден: метрики на порогах пилота."
                        : `Benchmark gate ${benchmarkGateStatus}: провалены [${benchmarkGateFailedMetrics.join(", ") || "нет"}], missing [${benchmarkGateMissingMetrics.join(", ") || "нет"}].`}
                    </Alert>
                  ) : null}
                </>
              ) : (
                <Alert severity="info" sx={{ mt: 0.9 }}>
                  Для этого агента benchmark-данные не зафиксированы. Статус: не зафиксировано.
                </Alert>
              )}
            </Paper>
          ) : null}

          {isModernAgent(agent.id) ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.6 }}>
                Done Gate
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                Режим: {doneGatePolicy?.mode === "strict" ? "strict" : "soft_warning"} | fallback status: {doneGatePolicy?.fallbackStatus || "in_review"}
              </Typography>
              <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap" sx={{ mt: 0.7 }}>
                {doneGateChecks.map((check) => (
                  <Chip
                    key={`done-gate-${check.key}`}
                    size="small"
                    color={check.ok ? "success" : "warning"}
                    variant={check.ok ? "filled" : "outlined"}
                    label={`${check.label}: ${check.ok ? "ok" : "missing"}`}
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.55 }}>
                Детали: {doneGateChecks.map((check) => `${check.label} (${check.note})`).join(" | ")}
              </Typography>
              {doneGateFailedCount > 0 ? (
                <Alert severity={doneGatePolicy?.mode === "strict" ? "error" : "warning"} sx={{ mt: 0.85 }}>
                  {doneGatePolicy?.mode === "strict"
                    ? "Done gate не пройден: при строгом режиме задача должна оставаться в fallback статусе до закрытия missing checks."
                    : "Done gate не пройден полностью: в soft режиме это предупреждение для контроля качества цикла."}
                </Alert>
              ) : (
                <Alert severity="success" sx={{ mt: 0.85 }}>
                  Done gate пройден: обязательные проверки plan/verify/lesson зафиксированы.
                </Alert>
              )}
            </Paper>
          ) : null}

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Список задач
            </Typography>
            {filteredTaskEvents.length > 0 ? (
              <Stack spacing={1}>
                {filteredTaskEvents.map((event) => {
                  const taskQualityScore = calculateTaskQualityScore(event);
                  return (
                    <Paper key={`${agent.id}-event-${event.id}`} variant="outlined" sx={{ p: 1.1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {event.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.35 }}>
                        Task Quality Score: {taskQualityScore}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.2 }}>
                        Завершено: {formatDateTimeLong(event.completedAt)} | Проблемы: {event.reviewErrors}
                      </Typography>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                        <Button size="small" variant="outlined" onClick={() => openTaskEventReport(event)}>
                          Показать отчет
                        </Button>
                        <Button size="small" onClick={() => openTaskEventContext(event)}>
                          Показать полный контекст задачи
                        </Button>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                За выбранный период нет событий задач.
              </Typography>
            )}
          </Paper>
        </Stack>
      ) : null}

      {tabKey === "memory_context" ? (
        <Stack spacing={1.25}>
          {renderSectionHeader("memory_context")}
          <MemoryContextPanel
            agentId={agent.id}
            memoryContext={agent.memoryContext}
            docsByPath={docsByPath}
            onOpenText={openTextModal}
            onOpenTask={onOpenTask}
          />
        </Stack>
      ) : null}

      {tabKey === "improvements" ? (
        <Stack spacing={1.25}>
          {renderSectionHeader("improvements")}

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button size="small" variant="outlined" onClick={openAllImprovementsModal}>
              Посмотреть список всех улучшений
            </Button>
            <Button size="small" variant="contained" onClick={copyAllImprovements}>
              {copiedKey === "all-improvements" ? "Скопировано" : "Скопировать"}
            </Button>
          </Stack>

          {improvements.length > 0 ? (
            <Stack spacing={1}>
              {improvements.map((item, index) => {
                const ownerSectionLabel = item.ownerSection || item.section;
                const sectionNormalized = asString(ownerSectionLabel).toLowerCase();
                const taskLabel = sectionNormalized.includes("логика работы всех карточек")
                  ? "Логика работы всех карточек"
                  : item.title;
                const taskStatusLabel = "Можно брать";

                return (
                  <Paper key={item.key} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack spacing={0.75}>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Раздел: {ownerSectionLabel}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Дата создания: {formatDateTimeCompactRu(item.createdAt || "")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Оценка эффекта ICE: Score: {item.ice.score} | Impact: {item.ice.impact} | Confidence: {item.ice.confidence} | Ease: {item.ice.ease}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Точка роста: {item.problem}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Решение: {item.solution}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Ожидаемый эффект: {item.effect}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Целевая метрика: {item.targetMetric} | База: {item.baselineWindow} | Ожидаемый сдвиг: {item.expectedDelta}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Основание (источники):{" "}
                        <Link href="#" onClick={(event) => { event.preventDefault(); openTaskLogs(); }}>
                          Логи задач ({filteredTaskEvents.length})
                        </Link>{" "}
                        |{" "}
                        <Link href="#" onClick={(event) => { event.preventDefault(); openReviewErrors(); }}>
                          Ошибки review ({reviewIssueEvents.length})
                        </Link>{" "}
                        |{" "}
                        <Link href="#" onClick={(event) => { event.preventDefault(); openToolLogs(); }}>
                          Логи инструмента ({toolLogContextRefs.length})
                        </Link>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Задача:{" "}
                        <Link
                          href="#"
                          sx={{ fontWeight: 700 }}
                          onClick={(event) => {
                            event.preventDefault();
                            if (onOpenTask) {
                              onOpenTask(item.title, "task_event");
                              return;
                            }
                            openTaskLogs();
                          }}
                        >
                          {taskLabel}
                        </Link>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="div">
                        Статус задачи: {taskStatusLabel}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          void copyImprovementPrompt(item, index);
                        }}
                        sx={{ width: "fit-content" }}
                      >
                        {copiedKey === `improvement-${item.key}` ? "Скопировано" : "Скопировать промт для внедрения"}
                      </Button>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <Alert severity="info">Предложения по улучшениям пока не добавлены.</Alert>
          )}
        </Stack>
      ) : null}

      <TextContentModal
        open={Boolean(textModal)}
        onClose={() => setTextModal(null)}
        title={textModal?.title || "Текст"}
        content={textModal?.content || ""}
        path={textModal?.path || null}
        updatedAt={textModal?.updatedAt || null}
        sourceUrl={textModal?.sourceUrl || null}
        initialMode="markdown"
      />
    </Stack>
  );
}

function AgentDetailsLegacy({
  agent,
  docsByPath,
  onOpenTask,
  tabKey,
  onTabChange,
}: {
  agent: AgentMeta;
  docsByPath: Map<string, IndexedDocument>;
  onOpenTask?: (taskKey: string, source: TaskLookupSource) => void;
  tabKey: AgentTabKey;
  onTabChange: (tabKey: AgentTabKey) => void;
}) {
  const tabIndex = React.useMemo(() => {
    const index = LEGACY_TAB_KEYS.indexOf(tabKey);
    return index >= 0 ? index : 0;
  }, [tabKey]);
  const handleTabChange = React.useCallback(
    (_: React.SyntheticEvent, value: number) => {
      onTabChange(LEGACY_TAB_KEYS[value] || "overview");
    },
    [onTabChange],
  );
  const [periodStart, setPeriodStart] = React.useState("");
  const [periodEnd, setPeriodEnd] = React.useState("");
  const [textModal, setTextModal] = React.useState<TextModalPayload | null>(null);

  const status = statusMeta[agent.status];

  const taskEvents = React.useMemo(() => {
    const values = [...(agent.taskEvents || [])];
    values.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    return values;
  }, [agent.taskEvents]);

  const filteredTaskEvents = React.useMemo(() => {
    const start = periodStart ? new Date(`${periodStart}T00:00:00`).getTime() : null;
    const end = periodEnd ? new Date(`${periodEnd}T23:59:59`).getTime() : null;

    return taskEvents.filter((item) => {
      const ts = new Date(item.completedAt).getTime();
      if (Number.isNaN(ts)) return false;
      if (start !== null && ts < start) return false;
      if (end !== null && ts > end) return false;
      return true;
    });
  }, [taskEvents, periodStart, periodEnd]);

  const completedTasks = filteredTaskEvents.length;
  const reviewErrors = filteredTaskEvents.reduce((acc, item) => acc + (Number.isFinite(item.reviewErrors) ? item.reviewErrors : 0), 0);
  const lastTask = filteredTaskEvents[0] || null;

  const usedSkills = agent.usedSkills || [];

  const todayAction = () => {
    const today = toDateInputValue(new Date());
    setPeriodStart(today);
    setPeriodEnd(today);
  };

  const openTextModal = React.useCallback((payload: TextModalPayload) => {
    setTextModal(payload);
  }, []);

  const openContextText = React.useCallback((entry: { title: string; filePath: string; pathHint?: string | null; sourceUrl?: string | null }) => {
    const doc = docsByPath.get(normalizePath(entry.filePath));
    const fallback = [
      `Источник: ${entry.title}`,
      `Путь: ${entry.filePath}`,
      entry.pathHint ? `Фрагмент: ${entry.pathHint}` : "",
      "",
      "Текст этого файла пока не загружен в индекс документации. Добавьте файл в generated docs-index.",
    ]
      .filter(Boolean)
      .join("\n");

    openTextModal({
      title: entry.title,
      path: entry.filePath,
      sourceUrl: entry.sourceUrl || doc?.sourceUrl || makeSourceUrl(entry.filePath),
      updatedAt: doc?.updatedAt || null,
      content: doc?.content || fallback,
    });
  }, [docsByPath, openTextModal]);

  const openSkillText = React.useCallback((name: string, content: string, sourceUrl?: string | null) => {
    openTextModal({
      title: `Навык: ${name}`,
      path: null,
      sourceUrl: sourceUrl || null,
      updatedAt: null,
      content,
    });
  }, [openTextModal]);

  return (
    <Stack spacing={2} sx={{ px: 2.25, pb: 2.25 }}>
      <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
        <Tab label="Обзор" />
        <Tab label="Навыки / Skills" />
        <Tab label="Задачи" />
        <Tab label="Память и контекст" />
        <Tab label="Улучшения" />
      </Tabs>

      {tabKey === "overview" ? (
        <Stack spacing={1.25}>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Chip size="small" label={status.label} color={status.color} />
            <Typography variant="body2" color="text.secondary">
              Обновлено: {formatDateTime(agent.updatedAt)}
            </Typography>
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Название ИИ агента
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {agent.name}
            </Typography>
            <Typography variant="subtitle2" sx={{ mt: 1.25, mb: 0.5 }}>
              Краткое описание
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {agent.shortDescription || agent.role}
            </Typography>
            {agent.processLink?.url ? (
              <Typography variant="body2" sx={{ mt: 1.25 }}>
                <Link href={agent.processLink.url} target="_blank" rel="noopener noreferrer">
                  {agent.processLink.title || "Схема бизнес-процесса"}
                </Link>
              </Typography>
            ) : null}
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Легенда статусов
            </Typography>
            <Stack spacing={1} divider={<Divider flexItem />}>
              {statusLegend.map((item) => (
                <Box key={item.title}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Раздел: MCP
            </Typography>

            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              MCP которые использует ИИ агент
            </Typography>
            {(agent.usedMcp || []).length > 0 ? (
              <Stack spacing={0.75} divider={<Divider flexItem />}>
                {(agent.usedMcp || []).map((item) => {
                  const normalized = normalizeUsedMcpStatus(item.status || "offline");
                  const meta = usedMcpStatusMeta[normalized];
                  return (
                    <Box key={`${agent.id}-used-mcp-${item.name}`}>
                      <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          MCP {item.name}
                        </Typography>
                        <Chip size="small" label={meta.label} color={meta.color} />
                      </Stack>
                      {item.note ? (
                        <Typography variant="caption" color="text.secondary">
                          {item.note}
                        </Typography>
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Alert severity="info">Пока нет зафиксированных использований MCP.</Alert>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              К какому контексту обращается ИИ агент
            </Typography>
            {(agent.contextRefs || []).length > 0 ? (
              <Stack spacing={0.75} divider={<Divider flexItem />}>
                {(agent.contextRefs || []).map((entry) => (
                  <Box key={`${agent.id}-context-${entry.title}-${entry.filePath}`}>
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {entry.title}
                      </Typography>
                      <Button size="small" onClick={() => openContextText(entry)}>
                        Открыть текст
                      </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Путь: <Box component="span" sx={{ fontFamily: "monospace" }}>{entry.filePath}</Box>
                    </Typography>
                    {entry.pathHint ? (
                      <Typography variant="caption" color="text.secondary" component="div">
                        Фрагмент: {entry.pathHint}
                      </Typography>
                    ) : null}
                    {entry.sourceUrl ? (
                      <Typography variant="caption" component="div" sx={{ mt: 0.25 }}>
                        <Link href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Открыть фрагмент
                        </Link>
                      </Typography>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Alert severity="info">История обращений к контексту пока не зафиксирована.</Alert>
            )}
          </Paper>
        </Stack>
      ) : null}

      {tabKey === "skills_rules" ? (
        <Stack spacing={1.25}>
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="body2" color="text.secondary">
              Отображаются навыки, которые использует этот ИИ агент, и инструменты, полезные для роста эффективности.
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Что уже использовал при работе над задачами
            </Typography>
            <Stack spacing={0.75} divider={<Divider flexItem />}>
              {usedSkills.map((skill) => (
                <Box key={`${agent.id}-used-skill-${skill.name}`}>
                  <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                    <Chip size="small" variant="outlined" label={skill.name} />
                  </Stack>
                  {skill.usage ? (
                    <Typography variant="caption" color="text.secondary">
                      {skill.usage}
                    </Typography>
                  ) : null}
                  {(skill.fullText || skill.usage) ? (
                    <Button
                      size="small"
                      sx={{ mt: 0.4 }}
                      onClick={() => openSkillText(skill.name, skill.fullText || skill.usage || "Описание навыка пока не добавлено.")}
                    >
                      Открыть текст
                    </Button>
                  ) : null}
                </Box>
              ))}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Подходящие и полезные навыки, но еще не использованные
            </Typography>
            {(agent.availableSkills || []).length > 0 ? (
              <Stack spacing={0.75} divider={<Divider flexItem />}>
                {(agent.availableSkills || []).map((skill) => (
                  <Box key={`${agent.id}-available-skill-${skill.name}`}>
                    <Chip size="small" variant="outlined" label={skill.name} />
                    {skill.benefit ? (
                      <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
                        {skill.benefit}
                      </Typography>
                    ) : null}
                    {(skill.fullText || skill.benefit || skill.recommendationBasis) ? (
                      <Button
                        size="small"
                        sx={{ mt: 0.35 }}
                        onClick={() =>
                          openSkillText(
                            skill.name,
                            [skill.fullText, skill.benefit, skill.recommendationBasis].filter(Boolean).join("\n\n"),
                            skill.link,
                          )
                        }
                      >
                        Открыть текст
                      </Button>
                    ) : null}
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Нет дополнительных навыков для рекомендации.
              </Typography>
            )}
          </Paper>
        </Stack>
      ) : null}

      {tabKey === "tasks_quality" ? (
        <Stack spacing={1.25}>
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
              <TextField
                size="small"
                label="С"
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                size="small"
                label="По"
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <Button variant="outlined" onClick={todayAction}>
                Сегодня
              </Button>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              Выполнено задач: {completedTasks}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Последняя задача: {lastTask ? `${lastTask.title} (${formatDateTime(lastTask.completedAt)})` : "нет данных"}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, mt: 1 }}>
              Выявлено ошибок при проверке (Review): {reviewErrors}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Список рекомендаций
            </Typography>
            {(agent.analystRecommendations || []).length > 0 ? (
              <Stack spacing={0.75} divider={<Divider flexItem />}>
                {(agent.analystRecommendations || []).map((item, index) => (
                  <Typography key={`${agent.id}-recommendation-${index}`} variant="body2" color="text.secondary">
                    {index + 1}. {item}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Рекомендации пока не сформированы.
              </Typography>
            )}
          </Paper>
        </Stack>
      ) : null}

      {tabKey === "memory_context" ? (
        <Stack spacing={1.25}>
          <MemoryContextPanel
            agentId={agent.id}
            memoryContext={agent.memoryContext}
            docsByPath={docsByPath}
            onOpenText={openTextModal}
            onOpenTask={onOpenTask}
          />
        </Stack>
      ) : null}

      {tabKey === "improvements" ? (
        <Stack spacing={1.25}>
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Typography variant="body2" color="text.secondary">
              В этом разделе собраны улучшения, которые могут повысить эффективность работы агента.
            </Typography>
          </Paper>

          {(agent.improvements || []).length > 0 ? (
            <Stack spacing={1}>
              {(agent.improvements || []).map((item) => (
                <Paper key={`${agent.id}-improvement-${item.title}`} variant="outlined" sx={{ p: 1.25 }}>
                  <Stack spacing={0.5}>
                    <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {item.title}
                      </Typography>
                      <Chip size="small" label={`Приоритет: ${item.priority}`} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Проблема: {item.problem}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Решение: {item.solution}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Ожидаемый эффект: {item.effect}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : (
            <Alert severity="info">Предложения по улучшениям пока не добавлены.</Alert>
          )}
        </Stack>
      ) : null}

      <TextContentModal
        open={Boolean(textModal)}
        onClose={() => setTextModal(null)}
        title={textModal?.title || "Текст"}
        content={textModal?.content || ""}
        path={textModal?.path || null}
        updatedAt={textModal?.updatedAt || null}
        sourceUrl={textModal?.sourceUrl || null}
        initialMode="markdown"
      />
    </Stack>
  );
}

export function UnifiedAgentDrawer({
  open,
  agent,
  onClose,
  onOpenTask,
  docsByPath,
  tabKey,
  onTabChange,
  onCopyLink,
}: {
  open: boolean;
  agent: AgentSummary | AgentMeta | null;
  onClose: () => void;
  onOpenTask?: (taskKey: string, source: TaskLookupSource) => void;
  docsByPath?: Map<string, IndexedDocument>;
  tabKey?: AgentTabKey;
  onTabChange?: (tabKey: AgentTabKey) => void;
  onCopyLink?: () => Promise<boolean>;
}) {
  const fallbackDocsByPath = React.useMemo(() => buildDocsByPath(getAgentModalDocs()), []);
  const resolvedDocsByPath = docsByPath || fallbackDocsByPath;
  const selectedAgent = React.useMemo<AgentMeta | null>(() => {
    if (!agent) return null;
    return asMeta(agent as AgentSummary);
  }, [agent]);
  const selectedStatus = selectedAgent ? statusMeta[selectedAgent.status] : null;
  const handleOpenTask = React.useCallback(
    (taskKey: string, source: TaskLookupSource) => {
      if (!onOpenTask) return;
      onOpenTask(taskKey, source);
    },
    [onOpenTask],
  );
  const [copiedLink, setCopiedLink] = React.useState(false);
  const copyTimeoutRef = React.useRef<number | null>(null);
  const handleCopyLink = React.useCallback(async () => {
    if (!onCopyLink) return;
    const copied = await onCopyLink();
    setCopiedLink(copied);
    if (copyTimeoutRef.current !== null) {
      window.clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = window.setTimeout(() => {
      setCopiedLink(false);
      copyTimeoutRef.current = null;
    }, 1500);
  }, [onCopyLink]);

  React.useEffect(() => {
    setCopiedLink(false);
  }, [selectedAgent?.id, tabKey]);

  const resolvedTabKey = tabKey || "overview";
  const resolvedOnTabChange = onTabChange || (() => {});

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100vw", sm: 660 }, maxWidth: "100vw", bgcolor: "background.default" } }}
    >
      <Box sx={{ pt: 1.5 }}>
        {selectedAgent ? (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2.25, pb: 1.2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {selectedAgent.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedAgent.role}
                </Typography>
                {selectedStatus ? <Chip size="small" label={selectedStatus.label} color={selectedStatus.color} sx={{ mt: 0.75 }} /> : null}
              </Box>
              <Button size="small" variant="outlined" onClick={() => { void handleCopyLink(); }}>
                {copiedLink ? "Ссылка скопирована" : "Скопировать ссылку"}
              </Button>
              <IconButton onClick={onClose} aria-label="Закрыть">
                <CloseIcon />
              </IconButton>
            </Stack>
            <Divider />
            {isModernAgent(selectedAgent.id) ? (
              <AgentDetailsModern
                agent={selectedAgent}
                docsByPath={resolvedDocsByPath}
                onOpenTask={handleOpenTask}
                tabKey={resolvedTabKey}
                onTabChange={resolvedOnTabChange}
              />
            ) : (
              <AgentDetailsLegacy
                agent={selectedAgent}
                docsByPath={resolvedDocsByPath}
                onOpenTask={handleOpenTask}
                tabKey={resolvedTabKey}
                onTabChange={resolvedOnTabChange}
              />
            )}
          </>
        ) : null}
      </Box>
    </Drawer>
  );
}

export function AgentsPage() {
  const manifest = React.useMemo(() => getAgentsManifest(), []);
  const docsByPath = React.useMemo(() => buildDocsByPath(getAgentModalDocs()), []);

  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [skill, setSkill] = React.useState("all");
  const [mcp, setMcp] = React.useState("all");
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const [selectedTabKey, setSelectedTabKey] = React.useState<AgentTabKey>("overview");
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
  const [taskLookupModal, setTaskLookupModal] = React.useState<TextModalPayload | null>(null);
  const taskLookupCacheRef = React.useRef<Map<string, string | null>>(new Map());

  const agents = React.useMemo(() => manifest.agents.map(asMeta), [manifest.agents]);
  const knownAgentIds = React.useMemo(() => new Set(agents.map((agent) => agent.id)), [agents]);
  const resolveAgentKind = React.useCallback((agentId: string) => {
    const found = agents.find((agent) => agent.id === agentId);
    return found ? isModernAgent(found.id) : null;
  }, [agents]);
  const applyRouteState = React.useCallback((state: { agentId: string | null; tabKey: string | null | undefined }) => {
    const canonical = canonicalizeState(state, knownAgentIds, resolveAgentKind);
    setSelectedAgentId(canonical.agentId);
    setSelectedTabKey(canonical.tabKey);
    const nextHash = buildAgentsHash(canonical);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(window.history.state, "", nextHash);
    }
    return canonical;
  }, [knownAgentIds, resolveAgentKind]);
  const openAgentByRoute = React.useCallback((agentId: string, tabKey: AgentTabKey = "overview") => {
    applyRouteState({ agentId, tabKey });
  }, [applyRouteState]);
  const closeAgentDrawer = React.useCallback(() => {
    applyRouteState({ agentId: null, tabKey: "overview" });
  }, [applyRouteState]);
  const handleTabChange = React.useCallback((tabKey: AgentTabKey) => {
    if (!selectedAgentId) return;
    applyRouteState({ agentId: selectedAgentId, tabKey });
  }, [applyRouteState, selectedAgentId]);
  const handleCopyLink = React.useCallback(async () => {
    if (!selectedAgentId) return false;
    const canonical = canonicalizeState(
      { agentId: selectedAgentId, tabKey: selectedTabKey },
      knownAgentIds,
      resolveAgentKind,
    );
    const hash = buildAgentsHash(canonical);
    const deepLink = `${window.location.origin}${window.location.pathname}${hash}`;
    return copyTextToClipboard(deepLink);
  }, [knownAgentIds, resolveAgentKind, selectedAgentId, selectedTabKey]);

  React.useEffect(() => {
    applyRouteState(parseAgentsHash(window.location.hash, resolveAgentKind));
  }, [applyRouteState, resolveAgentKind]);

  React.useEffect(() => {
    const onHashChange = () => {
      applyRouteState(parseAgentsHash(window.location.hash, resolveAgentKind));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applyRouteState, resolveAgentKind]);

  const skills = React.useMemo(() => {
    const set = new Set<string>();
    for (const agent of agents) {
      for (const item of agentSkillNames(agent)) set.add(item);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const mcpServers = React.useMemo(() => {
    const set = new Set<string>();
    for (const agent of agents) {
      for (const item of agentMcpNames(agent)) set.add(item);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [agents]);

  const filteredAgents = React.useMemo(
    () => agents.filter((agent) => matchesAgent(agent, { query, status, skill, mcp })),
    [agents, query, status, skill, mcp],
  );

  const selectedAgent = React.useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) || null,
    [agents, selectedAgentId],
  );

  const inWork = sumBy(filteredAgents, (agent) => agent.tasks.in_work);
  const onControl = sumBy(filteredAgents, (agent) => agent.tasks.on_control);
  const problematic = filteredAgents.filter((agent) => agent.status !== "healthy").length;
  const overdue = sumBy(filteredAgents, (agent) => agent.tasks.overdue);
  const resetFilters = React.useCallback(() => {
    setQuery("");
    setStatus("all");
    setSkill("all");
    setMcp("all");
  }, []);

  const openTaskLookupFallback = React.useCallback(
    (taskKey: string, source: TaskLookupSource, errorMessage?: string) => {
      const sourceLabel = source === "review_error" ? "Ошибки проверки" : "События задач";
      const localEvent = (selectedAgent?.taskEvents || []).find((event) => event.id === taskKey) || null;
      const localEventBlock = localEvent
        ? [
            `- Название: ${localEvent.title}`,
            `- Завершено: ${formatDateTime(localEvent.completedAt)}`,
            `- Ошибки проверки: ${localEvent.reviewErrors}`,
          ].join("\n")
        : "Локальные данные по этому ключу в карточке агента не зафиксированы.";

      setTaskLookupModal({
        title: `Задача ${taskKey} не найдена в БД`,
        content: [
          `# Задача ${taskKey} не найдена в БД`,
          "",
          `- Источник клика: ${sourceLabel}`,
          `- Агент: ${selectedAgent?.name || "не зафиксировано"}`,
          errorMessage ? `- Причина: ${errorMessage}` : "",
          "",
          "## Локальные данные карточки",
          localEventBlock,
          "",
          "## Что проверить",
          "- Проверьте синхронизацию task board: `make agent-tasks-sync DB=\"$SUPABASE_DB_URL\"`",
          "- После синхронизации повторите открытие задачи.",
        ]
          .filter(Boolean)
          .join("\n"),
        path: null,
        updatedAt: null,
        sourceUrl: null,
      });
    },
    [selectedAgent],
  );

  const openTaskByKey = React.useCallback(
    async (taskKey: string, source: TaskLookupSource) => {
      const normalizedKey = taskKey.trim();
      if (!normalizedKey) return;

      const cachedTaskId = taskLookupCacheRef.current.get(normalizedKey);
      if (cachedTaskId !== undefined) {
        if (cachedTaskId) {
          setSelectedTaskId(cachedTaskId);
          return;
        }
        openTaskLookupFallback(normalizedKey, source);
        return;
      }

      try {
        const rows = await getAgentTasks({ query: normalizedKey, limit: 50 });
        const normalizedLookup = normalizeLoose(normalizedKey);
        const exactMatch =
          rows.find((row) => row.external_key === normalizedKey) ||
          rows.find((row) => row.id === normalizedKey) ||
          rows.find((row) => normalizeLoose(row.title || "") === normalizedLookup) ||
          rows.find((row) => {
            const normalizedTitle = normalizeLoose(row.title || "");
            return normalizedTitle.length > 0 && (
              normalizedTitle.includes(normalizedLookup) ||
              normalizedLookup.includes(normalizedTitle)
            );
          }) ||
          null;

        if (exactMatch) {
          taskLookupCacheRef.current.set(normalizedKey, exactMatch.id);
          setSelectedTaskId(exactMatch.id);
          return;
        }

        taskLookupCacheRef.current.set(normalizedKey, null);
        openTaskLookupFallback(normalizedKey, source);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Ошибка поиска задачи.";
        openTaskLookupFallback(normalizedKey, source, message);
      }
    },
    [openTaskLookupFallback],
  );

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 3,
        overflow: "hidden",
        background:
          "radial-gradient(1200px 360px at 0% -10%, rgba(27,95,168,0.1), transparent 60%), radial-gradient(1200px 360px at 100% -10%, rgba(95,99,132,0.08), transparent 58%), #fff",
      }}
    >
      <Stack spacing={2} sx={{ p: { xs: 1.5, sm: 2.25 } }}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Реестр ИИ-агентов</Typography>
          <Typography variant="body2" color="text.secondary">
            Мониторинг нагрузки, статусов и инструментов агентов по единому реестру.
          </Typography>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
            gap: 1.25,
          }}
        >
          <SummaryMetricCard
            title="Агентов в выборке"
            value={`${filteredAgents.length} / ${agents.length}`}
            note="После применения текущих фильтров"
            icon={<SmartToyOutlinedIcon fontSize="small" />}
          />
          <SummaryMetricCard
            title="Задач в работе"
            value={inWork}
            note="queued + running + retrying"
            icon={<PendingActionsOutlinedIcon fontSize="small" />}
          />
          <SummaryMetricCard
            title="На контроле"
            value={onControl}
            note="waiting_review + blocked + waiting_external"
            icon={<ScheduleOutlinedIcon fontSize="small" />}
          />
          <SummaryMetricCard
            title="Проблемные агенты"
            value={problematic}
            note={`Просрочено задач: ${overdue}`}
            icon={<WarningAmberOutlinedIcon fontSize="small" />}
          />
        </Box>

        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <TuneRoundedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle2">Фильтры</Typography>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
            <TextField
              size="small"
              label="Поиск"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя, роль, навык, MCP"
              sx={{ minWidth: 260, flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="agents-status-label">Статус</InputLabel>
              <Select
                labelId="agents-status-label"
                label="Статус"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
              >
                {Object.entries(statusMeta).map(([value, item]) => (
                  <MenuItem key={value} value={value}>
                    {item.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="agents-skill-label">Навык</InputLabel>
              <Select labelId="agents-skill-label" label="Навык" value={skill} onChange={(event) => setSkill(event.target.value)}>
                <MenuItem value="all">Все навыки</MenuItem>
                {skills.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="agents-mcp-label">MCP сервер</InputLabel>
              <Select labelId="agents-mcp-label" label="MCP сервер" value={mcp} onChange={(event) => setMcp(event.target.value)}>
                <MenuItem value="all">Все MCP</MenuItem>
                {mcpServers.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<RestartAltRoundedIcon />}
              onClick={resetFilters}
              sx={{ alignSelf: { xs: "stretch", md: "center" } }}
            >
              Сбросить
            </Button>
          </Stack>
        </Paper>

        <Divider />

        {filteredAgents.length === 0 ? (
          <Alert severity="info" variant="outlined">
            Нет данных для текущего фильтра. Последняя синхронизация: {formatDateTime(manifest.updatedAt)}.
          </Alert>
        ) : (
          <Stack spacing={1}>
            {filteredAgents.map((agent) => {
              const previewSkills = agentSkillNames(agent);
              const previewRepos = agent.repositories.slice(0, 3);
              const extraRepos = Math.max(0, agent.repositories.length - previewRepos.length);

              return (
                <Card
                  key={agent.id}
                  variant="outlined"
                  sx={{
                    borderRadius: 2.5,
                    transition: "box-shadow 160ms ease, border-color 160ms ease, transform 160ms ease",
                    "&:hover": {
                      boxShadow: 3,
                      borderColor: "primary.main",
                      transform: "translateY(-1px)",
                    },
                  }}
                >
                  <CardActionArea onClick={() => openAgentByRoute(agent.id)} sx={{ borderRadius: 2.5 }}>
                    <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Stack spacing={1}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} alignItems={{ sm: "center" }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {agent.name}
                          </Typography>
                          <Chip size="small" label={statusMeta[agent.status].label} color={statusMeta[agent.status].color} />
                          <Chip size="small" variant="outlined" label={`MCP: ${agent.mcpServers.length}`} />
                        </Stack>

                        <Typography variant="body2" color="text.secondary">
                          {agent.role}
                        </Typography>

                        {agent.shortDescription ? (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {agent.shortDescription}
                          </Typography>
                        ) : null}

                        {agent.processLink?.url ? (
                          <Typography variant="caption" component="div">
                            <Link
                              href={agent.processLink.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {agent.processLink.title || "Схема бизнес-процесса"}
                            </Link>
                          </Typography>
                        ) : null}

                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                          {previewSkills.slice(0, 5).map((item) => (
                            <Chip key={`${agent.id}-skill-${item}`} size="small" variant="outlined" label={item} />
                          ))}
                          {previewSkills.length > 5 ? (
                            <Chip size="small" variant="outlined" label={`+${previewSkills.length - 5} навыков`} />
                          ) : null}
                        </Stack>

                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                          {previewRepos.map((repo) => (
                            <Link
                              key={`${agent.id}-repo-${repo.name}`}
                              href={repo.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {repo.name}
                              {repo.branch ? ` (${repo.branch})` : ""}
                            </Link>
                          ))}
                          {extraRepos > 0 ? (
                            <Typography variant="caption" color="text.secondary">
                              +{extraRepos} репозиториев
                            </Typography>
                          ) : null}
                        </Stack>

                        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                          {agent.mcpServers.map((server) => (
                            <Chip
                              key={`${agent.id}-mcp-${server.name}`}
                              size="small"
                              color={mcpStatusMeta[server.status].color}
                              label={`${server.name}: ${mcpStatusMeta[server.status].label}`}
                            />
                          ))}
                        </Stack>

                        <Typography variant="body2">
                          Задачи - в работе: {agent.tasks.in_work}, на контроле: {agent.tasks.on_control}, просрочено: {agent.tasks.overdue}
                        </Typography>

                        <Typography variant="caption" color="text.secondary">
                          Обновлено: {formatDateTime(agent.updatedAt)} | источник: {agent.source}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>
        )}
      </Stack>

      {selectedAgentId === "analyst-agent" ? (
        <AnalystCardDrawer
          open={Boolean(selectedAgent)}
          agent={selectedAgent}
          onClose={closeAgentDrawer}
        />
      ) : (
        <UnifiedAgentDrawer
          open={Boolean(selectedAgent)}
          agent={selectedAgent}
          onClose={closeAgentDrawer}
          onOpenTask={openTaskByKey}
          docsByPath={docsByPath}
          tabKey={selectedTabKey}
          onTabChange={handleTabChange}
          onCopyLink={handleCopyLink}
        />
      )}

      <TaskDetailsDrawer
        open={Boolean(selectedTaskId)}
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onOpenAgent={(agentId) => openAgentByRoute(agentId)}
      />

      <TextContentModal
        open={Boolean(taskLookupModal)}
        onClose={() => setTaskLookupModal(null)}
        title={taskLookupModal?.title || "Задача"}
        content={taskLookupModal?.content || ""}
        path={taskLookupModal?.path || null}
        updatedAt={taskLookupModal?.updatedAt || null}
        sourceUrl={taskLookupModal?.sourceUrl || null}
        initialMode="markdown"
      />
    </Paper>
  );
}
