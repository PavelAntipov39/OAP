import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import type { AgentSummary } from "../../lib/generatedData";
import { getAnalystCardData, type AnalystErrorEntry, type AnalystSession } from "../../lib/analystCardData";
import { getAgentTasks, type AgentTaskRow } from "../../lib/tasksApi";
import {
  getAgentBenchmarkSummary,
  getOapKbIndex,
  getOapKbRawLogs,
  getDocsIndex,
  type AgentBenchmarkSummary,
  type OapKbDocument,
  type DocsDocument,
} from "../../lib/generatedData";
import { TextContentModal } from "../TextContentModal";
import { TaskDetailsDrawer } from "../tasks/TaskDetailsDrawer";
import { SectionBlock } from "./SectionBlock";

import { HeaderSection } from "./sections/HeaderSection";
import { AgentProcessSection } from "./sections/AgentProcessSection";
import { SkillsSection } from "./sections/SkillsSection";
import { McpSection } from "./sections/McpSection";
import { MemorySection } from "./sections/MemorySection";
import { RisksSection } from "./sections/RisksSection";
import { SessionsSection } from "./sections/SessionsSection";

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
const PRODUCT_DESIGNER_AGENT_ID = "designer-agent";

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
};

type MetricDefinition = {
  key: string;
  label: string;
  valueLabel: string;
  description: string;
  formula: string;
  source: string;
  example: string;
  onClick?: () => void;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
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

function toDateMs(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
  return value.trim().replace(/^\/+/, "");
}

function uniqueMemoryEntries(entries: MemoryLinkEntry[]): MemoryLinkEntry[] {
  const seen = new Set<string>();
  const ordered: MemoryLinkEntry[] = [];
  for (const entry of entries) {
    const path = normalizePath(entry.path);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    ordered.push({ title: entry.title, path: entry.path });
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
        skills: toStringArray(parsed.skills),
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
      <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.disabled", cursor: "help" }} />
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
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.4 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4 }}>
              {metric.label}
            </Typography>
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
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  metrics: MetricDefinition[];
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

function ErrorEntryCard({
  entry,
  onOpenFile,
}: {
  entry: AnalystErrorEntry;
  onOpenFile: (path: string) => void;
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

        {entry.lessonRef ? (
          <Link
            component="button"
            type="button"
            underline="hover"
            onClick={() => onOpenFile(entry.lessonRef)}
            sx={{ alignSelf: "flex-start" }}
          >
            Открыть связанный урок: {entry.lessonRef}
          </Link>
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

function AgentLogEventRow({ event }: { event: AgentLogEvent }) {
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

          {(event.mcpTools.length > 0 || event.skills.length > 0) ? (
            <Paper variant="outlined" sx={{ p: 1.1 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap>
                {event.mcpTools.length > 0 ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">MCP</Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.4 }}>
                      {event.mcpTools.map((item) => <Chip key={`${event.id}-mcp-${item}`} size="small" variant="outlined" label={item} />)}
                    </Stack>
                  </Box>
                ) : null}
                {event.skills.length > 0 ? (
                  <Box>
                    <Typography variant="caption" color="text.secondary" component="div">Навыки</Typography>
                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.4 }}>
                      {event.skills.map((item) => <Chip key={`${event.id}-skill-${item}`} size="small" variant="outlined" label={item} />)}
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
}: {
  open: boolean;
  agent: AgentSummary | null;
  onClose: () => void;
}) {
  const [modal, setModal] = React.useState<ModalState>(EMPTY_MODAL);
  const [agentLogOpen, setAgentLogOpen] = React.useState(false);
  const [agentLogSearch, setAgentLogSearch] = React.useState("");
  const [sessionsListOpen, setSessionsListOpen] = React.useState(false);
  const [sessionsSearch, setSessionsSearch] = React.useState("");
  const [agentErrorsOpen, setAgentErrorsOpen] = React.useState(false);
  const [additionalMetricsOpen, setAdditionalMetricsOpen] = React.useState(false);
  const [selfImprovementTasksOpen, setSelfImprovementTasksOpen] = React.useState(false);
  const [selfImprovementTasksLoading, setSelfImprovementTasksLoading] = React.useState(false);
  const [selfImprovementTasksError, setSelfImprovementTasksError] = React.useState<string | null>(null);
  const [selfImprovementTasks, setSelfImprovementTasks] = React.useState<AgentTaskRow[]>([]);
  const [selectedSelfImprovementTaskId, setSelectedSelfImprovementTaskId] = React.useState<string | null>(null);
  const [createdTasksCount, setCreatedTasksCount] = React.useState<number | null>(null);
  const [createdTasksLoading, setCreatedTasksLoading] = React.useState(false);

  const data = React.useMemo(() => getAnalystCardData(), []);
  const benchmarkSummary = React.useMemo<AgentBenchmarkSummary>(() => getAgentBenchmarkSummary(), []);
  const kbDocs = React.useMemo(() => getOapKbIndex(), []);
  const rawLogs = React.useMemo(() => getOapKbRawLogs(), []);
  const docsDocs = React.useMemo(() => getDocsIndex(), []);
  const allIndexedDocs = React.useMemo(
    () => [
      ...kbDocs.map((d: OapKbDocument) => ({ title: d.title, path: d.path, content: d.content, updatedAt: d.updatedAt })),
      ...rawLogs.map((d: OapKbDocument) => ({ title: d.title, path: d.path, content: d.content, updatedAt: d.updatedAt })),
      ...docsDocs.map((d: DocsDocument) => ({ title: d.title, path: d.path, content: d.content, updatedAt: d.updatedAt })),
    ],
    [kbDocs, rawLogs, docsDocs],
  );
  const indexedPaths = React.useMemo(() => new Set(allIndexedDocs.map((doc) => normalizePath(doc.path))), [allIndexedDocs]);

  const effectiveAgent = data?.agent ?? agent;
  const effectiveAgentId = effectiveAgent?.id ?? null;
  const cycle = data?.cycle ?? null;
  const sessions = data?.sessions ?? [];
  const efficiency = data?.efficiency ?? null;
  const keyMetrics = data?.keyMetrics ?? null;
  const lessonsPath = effectiveAgent?.learningArtifacts?.lessonsPath || DEFAULT_LESSONS_PATH;
  const isOpenablePath = React.useCallback(
    (path: string) => {
      const normalized = normalizePath(path);
      if (!normalized) return false;
      if (indexedPaths.has(normalized)) return true;
      for (const knownPath of indexedPaths) {
        if (knownPath.endsWith(normalized) || normalized.endsWith(knownPath)) return true;
      }
      return false;
    },
    [indexedPaths],
  );
  const operativeMemoryEntries = React.useMemo<MemoryLinkEntry[]>(() => {
    const fromCycle: MemoryLinkEntry[] = uniqueMemoryEntries(
      uniqueOrdered((cycle?.timeline ?? []).flatMap((event) => event.artifacts_read || [])).map((path) => ({
        title: "Контекст последнего цикла",
        path,
      })),
    ).filter((entry) => isOpenablePath(entry.path));

    if (fromCycle.length > 0) return fromCycle;

    const fromAnchors = uniqueMemoryEntries(
      (effectiveAgent?.memoryContext?.contextAnchors ?? []).map((anchor) => ({
        title: anchor.title || "Контекстный документ",
        path: anchor.filePath,
      })),
    ).filter((entry) => isOpenablePath(entry.path));

    return fromAnchors;
  }, [cycle?.timeline, effectiveAgent?.memoryContext?.contextAnchors, isOpenablePath]);
  const persistentMemoryEntries = React.useMemo<MemoryLinkEntry[]>(
    () =>
      uniqueMemoryEntries(
        (effectiveAgent?.memoryContext?.persistentRules ?? []).map((rule) => ({
          title: rule.title || "Правило",
          path: rule.location,
        })),
      ).filter((entry) => isOpenablePath(entry.path)),
    [effectiveAgent?.memoryContext?.persistentRules, isOpenablePath],
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
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Не удалось загрузить задачи самоулучшения.";
        setSelfImprovementTasksError(message);
        setSelfImprovementTasks([]);
        setCreatedTasksCount(null);
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
      return [completed, started, dateKey, timeKey, session.id.toLowerCase()].some((value) => value.includes(q));
    });
  }, [sessions, sessionsSearch]);

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
      formula: "verify_passed / verify_started * 100",
      source: "artifacts/agent_latest_cycle_analyst.json -> metrics.verification_pass_rate",
      example: "Если verify запускали 5 раз и 4 прошли успешно, метрика покажет 80%.",
    },
    {
      key: "lesson_capture_rate",
      label: "Фиксация уроков",
      valueLabel: formatPercentValue(cycle?.metrics.lesson_capture_rate ?? null),
      description: "Насколько стабильно после verify фиксируются уроки self-improvement.",
      formula: "lesson_captured / (verify_passed + verify_failed) * 100",
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

  const agentLogDoc = React.useMemo(
    () =>
      rawLogs.find((doc) => {
        const docPath = normalizePath(doc.path);
        return docPath === AGENT_LOG_PATH || docPath.endsWith(AGENT_LOG_PATH);
      }) ?? null,
    [rawLogs],
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
      const normalizedPath = path.replace(/^\/+/, "");
      const doc = allIndexedDocs.find((d) => {
        const dp = d.path.replace(/^\/+/, "");
        return dp === normalizedPath || dp.endsWith(normalizedPath) || normalizedPath.endsWith(dp);
      });

      if (doc) {
        setModal({ open: true, title: doc.title, content: doc.content, path: doc.path, updatedAt: doc.updatedAt });
      } else {
        setModal({
          open: true,
          title: path.split("/").pop() ?? path,
          content: `Содержимое файла \`${path}\` не найдено в индексе документов.`,
          path,
          updatedAt: null,
        });
      }
    },
    [allIndexedDocs],
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
              <HeaderSection agent={effectiveAgent} lastRunAt={lastRunAt} />
              <SectionBlock
                title="Эффективность агента"
                tooltip="Операционные показатели по циклам: средний расход токенов, ошибки и сколько задач аналитик создает за цикл."
              >
                <Stack spacing={1}>
                  {efficiencyMetrics.map((metric) => (
                    <AnalystMetricRow key={metric.key} metric={metric} />
                  ))}
                </Stack>
                <Box>
                  <Link
                    component="button"
                    type="button"
                    underline="always"
                    onClick={() => setAdditionalMetricsOpen(true)}
                    sx={{ fontWeight: 600 }}
                  >
                    Посмотреть остальные метрики
                  </Link>
                </Box>
              </SectionBlock>
              <SectionBlock
                title="Ключевые метрики агента"
                tooltip="Основные KPI аналитика: объем созданных задач, ожидаемый прирост целевых метрик и качество рекомендаций."
              >
                <Stack spacing={1}>
                  {primaryKeyMetrics.map((metric) => (
                    <AnalystMetricRow key={metric.key} metric={metric} />
                  ))}
                </Stack>
              </SectionBlock>
              <AgentProcessSection
                operatingPlan={effectiveAgent.operatingPlan}
                doneGatePolicy={effectiveAgent.doneGatePolicy}
                shortDescription={effectiveAgent.shortDescription}
                learningArtifacts={effectiveAgent.learningArtifacts}
                memoryContext={effectiveAgent.memoryContext}
                onOpenFile={handleOpenFile}
                onOpenModal={handleOpenContent}
                onOpenAgentLog={() => setAgentLogOpen(true)}
                onOpenSessionsList={() => setSessionsListOpen(true)}
              />
              <SkillsSection
                agent={effectiveAgent}
                latestSessionSkillNames={latestSessionSkillNames}
                onOpenFile={handleOpenFile}
              />
              <McpSection agent={effectiveAgent} onOpenFile={handleOpenFile} />
              <MemorySection
                memoryContext={effectiveAgent.memoryContext}
                onOpenFile={handleOpenFile}
                operativeMemoryEntries={operativeMemoryEntries}
                persistentMemoryEntries={persistentMemoryEntries}
                isPathOpenable={isOpenablePath}
                selfImprovementLessonsPath={lessonsPath}
                selfImprovementTasksCount={selfImprovementTasks.length}
                selfImprovementTasksLoading={selfImprovementTasksLoading}
                onOpenSelfImprovementTasks={() => setSelfImprovementTasksOpen(true)}
              />
              <RisksSection memoryContext={effectiveAgent.memoryContext} />
              <SessionsSection sessions={sessions} onOpenFile={handleOpenFile} />
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
                Лента телеметрии из <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{agentLogDoc?.path || AGENT_LOG_PATH}</Box>.
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
                  <AgentLogEventRow key={`${event.id}-${event.line}`} event={event} />
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
                Список ошибок и предупреждений по циклам аналитика. Источник: <Box component="span" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>.logs/agents/analyst-agent-errors.jsonl</Box> и telemetry event.error.
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
                <ErrorEntryCard key={entry.id} entry={entry} onOpenFile={handleOpenFile} />
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
        subtitle="Дополнительные workflow и benchmark-показатели аналитика. Каждая метрика раскрывается через tooltip с формулой, источником и примером."
        metrics={additionalEfficiencyMetrics}
      />

      <Drawer
        anchor="right"
        open={sessionsListOpen}
        onClose={() => setSessionsListOpen(false)}
        PaperProps={{ sx: { width: { xs: "100vw", md: 760 }, maxWidth: "100vw", bgcolor: "background.default" } }}
      >
        <Box sx={{ position: "sticky", top: 0, zIndex: 10, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", px: 2.5, py: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
              Список сессий цикла агента
            </Typography>
            <IconButton onClick={() => setSessionsListOpen(false)} aria-label="Закрыть список сессий">
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
          {filteredSessions.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Сессии по заданному поиску не найдены.
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
                      <Chip size="small" variant="outlined" label={`${session.tasksTotal} задач`} />
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
                        <strong>Токены:</strong> {formatTokens(session.tokensUsed)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Риски:</strong> {session.risksCount}
                      </Typography>
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>
          )}
        </Box>
      </Drawer>

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
