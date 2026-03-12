import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import {
  type AgentTaskReadinessState,
  type AgentTaskRow,
  type AgentTaskServiceMode,
  type AgentTaskStatus,
  type AgentTaskUiStage,
  TASK_UI_STAGE_META,
  TASK_UI_STAGE_ORDER,
  getDemoHumanTasks,
  getAgentTasks,
} from "../lib/tasksApi";
import { getAgentsManifest, type AgentSummary } from "../lib/generatedData";
import { READINESS_COLOR, READINESS_LABEL } from "../lib/taskReadiness";
import { TaskDetailsDrawer } from "../components/tasks/TaskDetailsDrawer";
import { UnifiedAgentDrawer } from "./AgentsPage";

type StatusFilter = AgentTaskStatus | "all";
type ReadinessFilter = AgentTaskReadinessState | "all";
type StageFilter = AgentTaskUiStage | "all";
type TasksHashFilter = {
  mcpName: string;
  taskKeys: string[];
  sessionId: string;
  taskId: string;
};
const DAY_MS = 24 * 60 * 60 * 1000;
const BACKLOG_STALE_DAYS = 30;
const NEEDS_CLARIFICATION_STALE_DAYS = 14;
const READY_STALE_DAYS = 60;

const STATUS_LABEL: Record<AgentTaskStatus, string> = {
  backlog: "Бэклог",
  ready: "Готово к запуску",
  in_progress: "В работе",
  ab_test: "A/B тест",
  waiting_human: "Ожидает решения человека",
  in_review: "Проверка результата",
  done: "Готово",
  completed: "Завершено",
};

const STATUS_COLOR: Record<AgentTaskStatus, "default" | "info" | "warning" | "success"> = {
  backlog: "default",
  ready: "info",
  in_progress: "warning",
  ab_test: "info",
  waiting_human: "warning",
  in_review: "warning",
  done: "success",
  completed: "success",
};

const PRIORITY_LABEL = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
} as const;

function parseEventTimeMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return time;
}

function formatDateTime(value: string | null): string {
  if (!value) return "не зафиксировано";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "не зафиксировано";
  return ts.toLocaleString();
}

function formatTaskCounter(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} задача`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} задачи`;
  return `${count} задач`;
}

function formatOriginCycleId(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  return normalized || "не зафиксировано";
}

function renderAgentCell(agentId: string | null | undefined, activeAgentIds: Set<string>, onOpenAgent: (agentId: string) => void) {
  const normalized = String(agentId || "").trim();
  if (!normalized) {
    return (
      <Typography variant="body2" color="text.secondary">
        не зафиксировано
      </Typography>
    );
  }
  if (activeAgentIds.has(normalized)) {
    return (
      <Link component="button" type="button" underline="hover" onClick={() => onOpenAgent(normalized)}>
        {normalized}
      </Link>
    );
  }
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
      <Typography variant="body2">{normalized}</Typography>
      <Chip size="small" variant="outlined" label="архив" sx={{ height: 20 }} />
    </Stack>
  );
}

function sortTextValues(values: Set<string>, selected: string): string[] {
  const list = [...values].sort((a, b) => a.localeCompare(b));
  if (selected && !list.includes(selected)) list.unshift(selected);
  return list;
}

function isTaskActual(row: AgentTaskRow, nowMs = Date.now()): boolean {
  if (row.status === "done" || row.status === "completed") return false;

  const eventTimeMs =
    parseEventTimeMs(row.last_event_time) ??
    parseEventTimeMs(row.last_event_at) ??
    parseEventTimeMs(row.updated_at) ??
    parseEventTimeMs(row.created_at);

  if (eventTimeMs === null) return true;
  const ageDays = (nowMs - eventTimeMs) / DAY_MS;

  if (row.status === "backlog") {
    if (row.readiness_final_state === "needs_clarification" && ageDays > NEEDS_CLARIFICATION_STALE_DAYS) return false;
    if (ageDays > BACKLOG_STALE_DAYS) return false;
    return true;
  }

  if (row.status === "ready" && ageDays > READY_STALE_DAYS) return false;
  return true;
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s.,:;!?'"`()[\]{}\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTasksHashFilter(hashValue: string): TasksHashFilter {
  const rawHash = String(hashValue || "");
  const route = rawHash.split("?")[0] || "";
  if (route && route !== "#/tasks") return { mcpName: "", taskKeys: [], sessionId: "", taskId: "" };
  const queryIndex = rawHash.indexOf("?");
  if (queryIndex === -1) return { mcpName: "", taskKeys: [], sessionId: "", taskId: "" };

  const params = new URLSearchParams(rawHash.slice(queryIndex + 1));
  const mcpName = String(params.get("mcp") || "").trim();
  const taskKeysRaw = String(params.get("task_keys") || "").trim();
  const sessionId = String(params.get("session_id") || params.get("sessionId") || "").trim();
  const taskId = String(params.get("task") || "").trim();
  const taskKeys = taskKeysRaw
    ? taskKeysRaw
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  return { mcpName, taskKeys, sessionId, taskId };
}

function buildTasksHash(state: TasksHashFilter): string {
  const params = new URLSearchParams();
  if (state.mcpName) params.set("mcp", state.mcpName);
  if (state.taskKeys.length > 0) params.set("task_keys", state.taskKeys.join("|"));
  if (state.sessionId) params.set("session_id", state.sessionId);
  if (state.taskId) params.set("task", state.taskId);
  const query = params.toString();
  return query ? `#/tasks?${query}` : "#/tasks";
}

function matchesTaskHint(row: AgentTaskRow, hint: string): boolean {
  const normalizedHint = normalizeLoose(hint);
  if (!normalizedHint) return false;
  const externalKey = normalizeLoose(String(row.external_key || ""));
  const title = normalizeLoose(String(row.title || ""));
  return (
    externalKey === normalizedHint ||
    title === normalizedHint ||
    externalKey.includes(normalizedHint) ||
    title.includes(normalizedHint) ||
    normalizedHint.includes(externalKey) ||
    normalizedHint.includes(title)
  );
}

export function TasksPage() {
  const initialHashFilter = React.useMemo(() => parseTasksHashFilter(window.location.hash || ""), []);
  const [query, setQuery] = React.useState(() => initialHashFilter.mcpName);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [mcpScopedFilter, setMcpScopedFilter] = React.useState(initialHashFilter);
  const [stageFilter, setStageFilter] = React.useState<StageFilter>("all");
  const [manualOnly, setManualOnly] = React.useState(false);
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [readiness, setReadiness] = React.useState<ReadinessFilter>("all");
  const [sourceAgentId, setSourceAgentId] = React.useState("");
  const [executorAgentId, setExecutorAgentId] = React.useState("");
  const [rows, setRows] = React.useState<AgentTaskRow[]>([]);
  const [showArchive, setShowArchive] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");
  const [lastSuccessAt, setLastSuccessAt] = React.useState<string | null>(null);
  const [copiedKey, setCopiedKey] = React.useState<string>("");
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(initialHashFilter.taskId || null);
  const [selectedTaskServiceMode, setSelectedTaskServiceMode] = React.useState<AgentTaskServiceMode | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  const requestIdRef = React.useRef(0);
  const taskLookupCacheRef = React.useRef<Map<string, string | null>>(new Map());
  const demoHumanRows = React.useMemo(() => getDemoHumanTasks(), []);

  const agentsManifest = React.useMemo(() => getAgentsManifest(), []);
  const agents = React.useMemo(() => agentsManifest.agents || [], [agentsManifest.agents]);
  const activeAgentIds = React.useMemo(() => new Set(agents.map((item) => item.id)), [agents]);
  const selectedAgent = React.useMemo<AgentSummary | null>(
    () => agents.find((item) => item.id === selectedAgentId) || null,
    [agents, selectedAgentId],
  );

  const applyRouteState = React.useCallback((next: TasksHashFilter) => {
    setMcpScopedFilter(next);
    setQuery(next.mcpName);
    setSelectedTaskId(next.taskId || null);
    setPage(0);

    const nextHash = buildTasksHash(next);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(window.history.state, "", nextHash);
    }
  }, []);

  const openTaskDrawer = React.useCallback((taskId: string | null, serviceMode?: AgentTaskServiceMode) => {
    if (!taskId) return;
    setSelectedTaskServiceMode(serviceMode);
    applyRouteState({
      ...mcpScopedFilter,
      taskId,
    });
  }, [applyRouteState, mcpScopedFilter]);

  const closeTaskDrawer = React.useCallback(() => {
    setSelectedTaskServiceMode(undefined);
    applyRouteState({
      ...mcpScopedFilter,
      taskId: "",
    });
  }, [applyRouteState, mcpScopedFilter]);

  React.useEffect(() => {
    const onHashChange = () => {
      const next = parseTasksHashFilter(window.location.hash || "");
      setSelectedTaskServiceMode(undefined);
      applyRouteState(next);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applyRouteState]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadData = React.useCallback(
    async (reason: "manual" | "auto" = "manual") => {
      const requestId = ++requestIdRef.current;
      const controller = new AbortController();
      try {
        if (reason === "manual") setLoading(true);
        setErrorMessage("");

        const tasks = await getAgentTasks(
          {
            status,
            sourceAgentId: sourceAgentId || null,
            executorAgentId: executorAgentId || null,
            query: debouncedQuery || null,
            limit: 500,
            offset: 0,
          },
          controller.signal,
        );

        if (requestId !== requestIdRef.current) return;
        setRows(tasks);
        setLastSuccessAt(new Date().toISOString());
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        const message = error instanceof Error ? error.message : "Ошибка загрузки задач.";
        setErrorMessage(message);
      } finally {
        if (requestId === requestIdRef.current && reason === "manual") {
          setLoading(false);
        }
      }

      return () => controller.abort();
    },
    [status, sourceAgentId, executorAgentId, debouncedQuery],
  );

  React.useEffect(() => {
    void loadData("manual");
  }, [loadData]);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      void loadData("auto");
    }, 15000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const actualRows = React.useMemo(() => rows.filter((row) => isTaskActual(row)), [rows]);
  const rowsPool = showArchive ? rows : actualRows;
  const stageRowsPool = stageFilter === "closed" ? rows : rowsPool;

  const statusCounts = React.useMemo<Record<AgentTaskStatus, number>>(() => {
    const counts: Record<AgentTaskStatus, number> = {
      backlog: 0,
      ready: 0,
      in_progress: 0,
      ab_test: 0,
      waiting_human: 0,
      in_review: 0,
      done: 0,
      completed: 0,
    };
    for (const row of rowsPool) {
      counts[row.status] += 1;
    }
    return counts;
  }, [rowsPool]);

  const archivedCount = React.useMemo(() => Math.max(0, rows.length - actualRows.length), [rows.length, actualRows.length]);

  const buildClientFilteredRows = React.useCallback((inputRows: AgentTaskRow[]) => {
    let next = readiness === "all" ? inputRows : inputRows.filter((row) => row.readiness_final_state === readiness);
    const scopedHints = mcpScopedFilter.taskKeys
      .map((item) => item.trim())
      .filter(Boolean);

    if (mcpScopedFilter.sessionId) {
      const scopedSessionId = mcpScopedFilter.sessionId.trim();
      next = next.filter((row) =>
        row.id === scopedSessionId ||
        row.external_key === scopedSessionId ||
        row.task_brief?.origin_context?.origin_cycle_id === scopedSessionId,
      );
      return next;
    }

    if (scopedHints.length > 0) {
      next = next.filter((row) => scopedHints.some((hint) => matchesTaskHint(row, hint)));
      return next;
    }

    if (mcpScopedFilter.mcpName) {
      const normalizedMcp = normalizeLoose(mcpScopedFilter.mcpName);
      next = next.filter((row) => {
        const source = normalizeLoose(`${row.title || ""} ${row.external_key || ""}`);
        return source.includes(normalizedMcp);
      });
    }

    return next;
  }, [mcpScopedFilter.mcpName, mcpScopedFilter.sessionId, mcpScopedFilter.taskKeys, readiness]);

  const insightRows = React.useMemo(() => buildClientFilteredRows(rows), [buildClientFilteredRows, rows]);
  const baseFilteredRows = React.useMemo(() => buildClientFilteredRows(stageRowsPool), [buildClientFilteredRows, stageRowsPool]);

  const funnelCounts = React.useMemo<Record<AgentTaskUiStage, number>>(() => {
    return TASK_UI_STAGE_ORDER.reduce<Record<AgentTaskUiStage, number>>((acc, stageKey) => {
      acc[stageKey] = insightRows.filter((row) => row.current_stage_ui === stageKey).length;
      return acc;
    }, {
      incoming: 0,
      ready_to_work: 0,
      in_work: 0,
      review: 0,
      closed: 0,
    });
  }, [insightRows]);

  const serviceModeCounts = React.useMemo(() => {
    return {
      waiting_human: insightRows.filter((row) => row.service_mode === "waiting_human").length,
      ab_test: insightRows.filter((row) => row.service_mode === "ab_test").length,
    };
  }, [insightRows]);

  const manualInputRows = React.useMemo(() => {
    return [...insightRows]
      .filter((row) => row.service_mode === "waiting_human")
      .sort((left, right) => {
        const leftTime = parseEventTimeMs(left.last_event_time || left.last_event_at || left.updated_at) || 0;
        const rightTime = parseEventTimeMs(right.last_event_time || right.last_event_at || right.updated_at) || 0;
        return rightTime - leftTime;
      });
  }, [insightRows]);

  const filteredRows = React.useMemo(() => {
    let next = stageFilter === "all" ? baseFilteredRows : baseFilteredRows.filter((row) => row.current_stage_ui === stageFilter);
    if (manualOnly) {
      next = next.filter((row) => row.service_mode === "waiting_human");
    }
    return next;
  }, [baseFilteredRows, manualOnly, stageFilter]);

  React.useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredRows.length / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [filteredRows.length, page, rowsPerPage]);

  const sourceAgents = React.useMemo(() => {
    const values = new Set(rowsPool.map((row) => row.source_agent_id).filter(Boolean));
    return sortTextValues(values, sourceAgentId);
  }, [rowsPool, sourceAgentId]);

  const executorAgents = React.useMemo(() => {
    const values = new Set(rowsPool.map((row) => row.executor_agent_id).filter(Boolean));
    return sortTextValues(values, executorAgentId);
  }, [rowsPool, executorAgentId]);

  const visibleRows = React.useMemo(() => {
    const start = page * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  const handleShowOnlyManualTasks = React.useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setMcpScopedFilter({ mcpName: "", taskKeys: [], sessionId: "", taskId: "" });
    setStageFilter("all");
    setStatus("all");
    setReadiness("all");
    setSourceAgentId("");
    setExecutorAgentId("");
    setManualOnly(true);
    setPage(0);
  }, []);

  const handleShowAllTasks = React.useCallback(() => {
    setManualOnly(false);
    setPage(0);
  }, []);

  const handleCopyStartCommand = React.useCallback(async (row: AgentTaskRow) => {
    const command = `make agent-log AGENT=${row.executor_agent_id} TASK=${row.external_key} STEP=implement STATUS=started ARTIFACT_OP=read:docs/agents/registry.yaml ARTIFACT_READ=docs/agents/registry.yaml`;
    await navigator.clipboard.writeText(command);
    setCopiedKey(row.id);
    window.setTimeout(() => setCopiedKey((value) => (value === row.id ? "" : value)), 1400);
  }, []);

  const openTaskByKey = React.useCallback(
    async (taskKey: string) => {
      const normalizedKey = taskKey.trim();
      if (!normalizedKey) return;

      const cachedTaskId = taskLookupCacheRef.current.get(normalizedKey);
      if (cachedTaskId !== undefined) {
        if (cachedTaskId) openTaskDrawer(cachedTaskId);
        return;
      }

      try {
        const taskRows = await getAgentTasks({ query: normalizedKey, limit: 50 });
        const exactMatch =
          taskRows.find((row) => row.external_key === normalizedKey) ||
          taskRows.find((row) => row.id === normalizedKey) ||
          null;
        if (exactMatch) {
          taskLookupCacheRef.current.set(normalizedKey, exactMatch.id);
          openTaskDrawer(exactMatch.id);
          return;
        }

        taskLookupCacheRef.current.set(normalizedKey, null);
      } catch {
        taskLookupCacheRef.current.set(normalizedKey, null);
      }
    },
    [openTaskDrawer],
  );

  return (
    <>
      <Paper variant="outlined">
        <Stack spacing={1.5} sx={{ p: 2.25 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Задачи
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Реестр задач AI-агентов для handoff. Здесь видно, кто поставил задачу, кто исполняет и достаточно ли контекста, чтобы брать в работу.
          </Typography>

          <Stack direction={{ xs: "column", lg: "row" }} spacing={1} useFlexGap flexWrap="wrap">
            <TextField
              size="small"
              label="Поиск"
              placeholder="Название задачи или ключ"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              sx={{ minWidth: 260, flex: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel id="tasks-status-filter">Статус</InputLabel>
              <Select
                labelId="tasks-status-filter"
                label="Статус"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as StatusFilter);
                  setPage(0);
                }}
              >
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="backlog">{STATUS_LABEL.backlog}</MenuItem>
                <MenuItem value="ready">{STATUS_LABEL.ready}</MenuItem>
                <MenuItem value="in_progress">{STATUS_LABEL.in_progress}</MenuItem>
                <MenuItem value="ab_test">{STATUS_LABEL.ab_test}</MenuItem>
                <MenuItem value="waiting_human">{STATUS_LABEL.waiting_human}</MenuItem>
                <MenuItem value="in_review">{STATUS_LABEL.in_review}</MenuItem>
                <MenuItem value="done">{STATUS_LABEL.done}</MenuItem>
                <MenuItem value="completed">{STATUS_LABEL.completed}</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="tasks-readiness-filter">Готовность</InputLabel>
              <Select
                labelId="tasks-readiness-filter"
                label="Готовность"
                value={readiness}
                onChange={(event) => {
                  setReadiness(event.target.value as ReadinessFilter);
                  setPage(0);
                }}
              >
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="ready">{READINESS_LABEL.ready}</MenuItem>
                <MenuItem value="needs_clarification">{READINESS_LABEL.needs_clarification}</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="tasks-source-agent-filter">Постановщик</InputLabel>
              <Select
                labelId="tasks-source-agent-filter"
                label="Постановщик"
                value={sourceAgentId}
                onChange={(event) => {
                  setSourceAgentId(String(event.target.value));
                  setPage(0);
                }}
              >
                <MenuItem value="">Все</MenuItem>
                {sourceAgents.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel id="tasks-executor-filter">Исполнитель</InputLabel>
              <Select
                labelId="tasks-executor-filter"
                label="Исполнитель"
                value={executorAgentId}
                onChange={(event) => {
                  setExecutorAgentId(String(event.target.value));
                  setPage(0);
                }}
              >
                <MenuItem value="">Все</MenuItem>
                {executorAgents.map((value) => (
                  <MenuItem key={value} value={value}>
                    {value}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <Button variant="text" size="small" onClick={() => void loadData("manual")} disabled={loading}>
              Retry
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => {
                setShowArchive((value) => !value);
                setPage(0);
              }}
            >
              {showArchive ? "Скрыть архив" : "Показать архив"}
            </Button>
            {loading ? <CircularProgress size={16} /> : null}
            <Typography variant="caption" color="text.secondary">
              Последнее обновление: {formatDateTime(lastSuccessAt)}
            </Typography>
          </Stack>

          {!showArchive && archivedCount > 0 ? (
            <Alert severity="info">
              Скрыто неактуальных задач: {archivedCount}. Показывается рабочий актуальный список.
            </Alert>
          ) : null}

          <Paper
            variant="outlined"
            sx={{
              p: 1.25,
              borderColor: manualOnly ? "warning.main" : "divider",
              bgcolor: manualOnly ? "warning.50" : "background.paper",
            }}
          >
            <Stack spacing={1}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Мои действия
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Здесь собраны задачи, где нужен ваш ручной ввод: комментарий человека и одно из трех решений.
                  </Typography>
                </Box>
                <Chip
                  color={manualInputRows.length > 0 ? "warning" : "default"}
                  label={`${formatTaskCounter(manualInputRows.length)} требует вашего решения`}
                />
              </Stack>

              <Typography variant="body2">
                <strong>Как пользоваться:</strong> откройте задачу, прочитайте инструкцию в human-gate, оставьте комментарий и выберите одно из решений человека.
              </Typography>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Button variant={manualOnly ? "contained" : "outlined"} color="warning" onClick={handleShowOnlyManualTasks}>
                  {manualOnly ? "Показаны только мои задачи" : "Показать только мои задачи"}
                </Button>
                {manualOnly ? (
                  <Button variant="text" onClick={handleShowAllTasks}>
                    Показать все задачи
                  </Button>
                ) : null}
                <Button variant="text" onClick={() => openTaskDrawer(demoHumanRows[0]?.id || null)} disabled={demoHumanRows.length === 0}>
                  Открыть первую демо-задачу
                </Button>
              </Stack>

              {manualInputRows.length === 0 ? (
                <Alert severity="info">
                  Сейчас живых задач с ручным вводом не зафиксировано. Для проверки интерфейса ниже есть демо-задачи.
                </Alert>
              ) : (
                <Stack spacing={0.75}>
                  {manualInputRows.slice(0, 3).map((row) => (
                    <Paper key={row.id} variant="outlined" sx={{ p: 0.9 }}>
                      <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                        <Box>
                          <Link component="button" type="button" underline="hover" sx={{ fontWeight: 600 }} onClick={() => openTaskDrawer(row.id, row.service_mode)}>
                            {row.title}
                          </Link>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {row.external_key} • постановщик: {row.source_agent_id} • исполнитель: {row.executor_agent_id}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Что дальше: {row.next_step_label}
                          </Typography>
                        </Box>
                        <Button size="small" variant="outlined" color="warning" onClick={() => openTaskDrawer(row.id, row.service_mode)}>
                          Открыть для решения
                        </Button>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Stack spacing={1}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Демо-задачи для проверки UI человека
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Это локальные тестовые задачи. Они нужны, чтобы проверить карточку human-gate и не пишут решение в БД.
                  </Typography>
                </Box>
                <Chip size="small" variant="outlined" label={`${formatTaskCounter(demoHumanRows.length)} демо`} />
              </Stack>
              <Stack spacing={0.75}>
                {demoHumanRows.map((row) => (
                  <Paper key={row.id} variant="outlined" sx={{ p: 0.9 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {row.external_key} • сценарий human-gate • {formatDateTime(row.updated_at)}
                        </Typography>
                      </Box>
                      <Button size="small" variant="outlined" onClick={() => openTaskDrawer(row.id, row.service_mode)}>
                        Открыть демо
                      </Button>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Воронка задач
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Основные стадии показывают путь задачи. Режимы `Требуется решение человека` и `Идет A/B тест` живут внутри стадии `В работе`.
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                {TASK_UI_STAGE_ORDER.map((stageKey) => {
                  const meta = TASK_UI_STAGE_META[stageKey];
                  const active = stageFilter === stageKey;
                  return (
                    <Paper
                      key={stageKey}
                      variant="outlined"
                      onClick={() => {
                        setStageFilter((current) => (current === stageKey ? "all" : stageKey));
                        setPage(0);
                      }}
                      sx={{
                        p: 1,
                        minWidth: { xs: "100%", md: 190 },
                        flex: 1,
                        cursor: "pointer",
                        borderColor: active ? "primary.main" : "divider",
                        bgcolor: active ? "action.selected" : "background.paper",
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Кто двигает дальше: {meta.next_actor_label}
                      </Typography>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.3 }}>
                        {meta.label}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.3 }}>
                        {funnelCounts[stageKey]}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
                        {meta.why_it_exists}
                      </Typography>
                    </Paper>
                  );
                })}
              </Stack>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Требуется решение человека: ${serviceModeCounts.waiting_human}`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`A/B тест: ${serviceModeCounts.ab_test}`}
                />
              </Stack>
            </Stack>
          </Paper>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {(Object.keys(STATUS_LABEL) as AgentTaskStatus[]).map((key) => (
              <Chip
                key={key}
                size="small"
                color={STATUS_COLOR[key]}
                label={`${STATUS_LABEL[key]} (${statusCounts[key] ?? 0})`}
                variant={key === status ? "filled" : "outlined"}
              />
            ))}
          </Stack>

          {errorMessage ? (
            <Alert severity={rows.length > 0 ? "warning" : "error"}>
              {errorMessage}
              {rows.length > 0 ? " Показаны последние успешно загруженные данные." : ""}
            </Alert>
          ) : null}

          {mcpScopedFilter.mcpName || mcpScopedFilter.taskKeys.length > 0 || mcpScopedFilter.sessionId ? (
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setMcpScopedFilter({ mcpName: "", taskKeys: [], sessionId: "", taskId: "" });
                    setQuery("");
                    setPage(0);
                  }}
                >
                  Сбросить
                </Button>
              }
            >
              {mcpScopedFilter.sessionId
                ? `Применен фильтр по ID сессии: ${mcpScopedFilter.sessionId}. Показывается связанная задача.`
                : `Применен фильтр MCP: ${mcpScopedFilter.mcpName || "unknown"}. ${
                    mcpScopedFilter.taskKeys.length > 0
                      ? `Показываются задачи из переданного списка (${mcpScopedFilter.taskKeys.length}).`
                      : "Показываются задачи по текстовому совпадению."
                  }`}
            </Alert>
          ) : null}

          <TableContainer sx={{ maxHeight: 620 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Задача</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      <Box component="span">Цикл</Box>
                      <Tooltip title="Цикл, в котором задача была обнаружена или создана. Это не A/B сессия.">
                        <Box
                          component="span"
                          aria-label="Пояснение для столбца Цикл"
                          sx={{ display: "inline-flex", alignItems: "center", color: "text.secondary", cursor: "help" }}
                        >
                          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                        </Box>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>Постановщик</TableCell>
                  <TableCell>Исполнитель</TableCell>
                  <TableCell>Стадия</TableCell>
                  <TableCell>Готовность</TableCell>
                  <TableCell>Приоритет</TableCell>
                  <TableCell>Обновлено</TableCell>
                  <TableCell>Последнее событие</TableCell>
                  <TableCell align="right">Действие</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <Alert severity="info">По текущим фильтрам задач не найдено.</Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Link
                          component="button"
                          type="button"
                          underline="hover"
                          sx={{ fontWeight: 600 }}
                          onClick={() => openTaskDrawer(row.id, row.service_mode)}
                        >
                          {row.title}
                        </Link>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {row.external_key}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            wordBreak: "break-word",
                          }}
                        >
                          {formatOriginCycleId(row.task_brief.origin_context?.origin_cycle_id)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {renderAgentCell(row.source_agent_id, activeAgentIds, setSelectedAgentId)}
                      </TableCell>
                      <TableCell>
                        {renderAgentCell(row.executor_agent_id, activeAgentIds, setSelectedAgentId)}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={row.current_stage_ui === "closed" ? "success" : row.current_stage_ui === "review" ? "info" : row.current_stage_ui === "in_work" ? "warning" : "default"} label={row.stage_label} />
                        {row.service_mode_label ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Режим: {row.service_mode_label}
                          </Typography>
                        ) : null}
                        {row.service_mode === "waiting_human" ? (
                          <Typography variant="caption" color="warning.main" display="block">
                            Нужен ваш ручной ввод
                          </Typography>
                        ) : null}
                        {row.close_resolution_label ? (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Резолюция: {row.close_resolution_label}
                          </Typography>
                        ) : null}
                        <Typography variant="caption" color="text.secondary" display="block">
                          Сист. статус: {STATUS_LABEL[row.status]}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={READINESS_COLOR[row.readiness_final_state]}
                          label={READINESS_LABEL[row.readiness_final_state]}
                        />
                        <Typography variant="caption" color="text.secondary" display="block">
                          {row.readiness_auto_score}/5
                        </Typography>
                      </TableCell>
                      <TableCell>{PRIORITY_LABEL[row.priority]}</TableCell>
                      <TableCell>{formatDateTime(row.updated_at)}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{row.last_event_type || "не зафиксировано"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.last_event_actor || "не зафиксировано"} - {formatDateTime(row.last_event_time || row.last_event_at)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Дальше: {row.next_actor_label} - {row.next_step_label}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {row.service_mode === "waiting_human" ? (
                          <Button size="small" variant="contained" color="warning" onClick={() => openTaskDrawer(row.id, row.service_mode)}>
                            Открыть для решения
                          </Button>
                        ) : (
                          <Button size="small" variant="outlined" onClick={() => void handleCopyStartCommand(row)}>
                            {copiedKey === row.id ? "Скопировано" : "Скопировать команду \"В работу\""}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <TablePagination
              component="div"
              count={filteredRows.length}
              page={page}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                const value = Number(event.target.value);
                setRowsPerPage(Number.isFinite(value) && value > 0 ? value : 25);
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </Box>
        </Stack>
      </Paper>

      <TaskDetailsDrawer
        open={Boolean(selectedTaskId)}
        taskId={selectedTaskId}
        onClose={closeTaskDrawer}
        onOpenAgent={(agentId) => setSelectedAgentId(agentId)}
        serviceMode={selectedTaskServiceMode}
      />

      <UnifiedAgentDrawer
        open={Boolean(selectedAgent)}
        agent={selectedAgent}
        onClose={() => setSelectedAgentId(null)}
        onOpenTask={openTaskByKey}
      />
    </>
  );
}
