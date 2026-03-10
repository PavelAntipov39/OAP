import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

import {
  getAnalystLatestCycle,
  getBpmnManifest,
  getC4Manifest,
  getDocsIndex,
  type AgentLatestCycleSnapshot,
} from "../lib/generatedData";
import {
  buildFileTraceMermaid,
  fetchLatestCycleRuntime,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "../lib/agentFlow";

declare global {
  interface Window {
    bpmnvisu?: {
      BpmnVisualization?: new (opts: { container: HTMLElement | string }) => {
        load: (xml: string) => void;
      };
    };
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      render: (id: string, value: string) => Promise<{ svg: string }>;
    };
  }
}

const BPMN_SCRIPT_CANDIDATES = [
  "https://cdn.jsdelivr.net/npm/bpmn-visualization@0.47.0/dist/bpmn-visualization.min.js",
  "https://unpkg.com/bpmn-visualization@0.47.0/dist/bpmn-visualization.min.js",
];

const MERMAID_SCRIPT_CANDIDATES = [
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
  "https://unpkg.com/mermaid@11/dist/mermaid.min.js",
];

function extractWorkspaceId(playgroundUrl: string): string | null {
  const match = playgroundUrl.match(/\/w\/([^/]+)\//);
  return match?.[1] || null;
}

function loadScript(src: string, marker: string): Promise<void> {
  const existing = document.querySelector(`script[data-ops-script="${marker}:${src}"]`) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`script_load_failed:${marker}`)), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.opsScript = `${marker}:${src}`;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error(`script_load_failed:${marker}`)), { once: true });
    document.head.appendChild(script);
  });
}

async function loadFirstAvailableScript(candidates: string[], marker: string): Promise<void> {
  let lastError: unknown = null;
  for (const src of candidates) {
    try {
      await loadScript(src, marker);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`script_load_failed:${marker}`);
}

async function loadBpmnXml(filePath: string): Promise<string> {
  const response = await fetch(filePath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`bpmn_xml_load_failed:${response.status}`);
  }
  return response.text();
}

export function AgentFlowPage() {
  const c4 = React.useMemo(() => getC4Manifest(), []);
  const docs = React.useMemo(() => getDocsIndex(), []);
  const bpmn = React.useMemo(() => getBpmnManifest(), []);
  const fallbackSnapshot = React.useMemo(() => getAnalystLatestCycle(), []);
  const [snapshot, setSnapshot] = React.useState<AgentLatestCycleSnapshot>(fallbackSnapshot);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);
  const [bpmnError, setBpmnError] = React.useState<string | null>(null);
  const [bpmnLoading, setBpmnLoading] = React.useState(false);
  const [mermaidError, setMermaidError] = React.useState<string | null>(null);
  const bpmnRef = React.useRef<HTMLDivElement | null>(null);
  const mermaidRef = React.useRef<HTMLDivElement | null>(null);

  const workspaceId = React.useMemo(
    () => extractWorkspaceId(c4.views[0]?.playgroundUrl || "") || "gyQEJw",
    [c4.views],
  );
  const processViews = React.useMemo(
    () => ([
      "analyst_flow_context",
      "analyst_flow_steps",
      "analyst_flow_io",
      "analyst_flow_notifications",
    ]),
    [],
  );
  const analystFlowDoc = React.useMemo(
    () => docs.find((item) => item.path === "docs/subservices/oap/agents/analyst-agent/FLOW.md") || null,
    [docs],
  );
  const analystBpmn = React.useMemo(
    () => bpmn.find((item) => item.id === "analyst-agent-flow") || null,
    [bpmn],
  );

  const metricRows = React.useMemo(() => {
    const keys: Array<keyof AgentLatestCycleSnapshot["metrics"]> = [
      "verification_pass_rate",
      "lesson_capture_rate",
      "review_error_rate",
      "recommendation_action_rate",
    ];
    return keys.map((key) => {
      const meta = snapshot.metric_meta?.[key];
      const value = snapshot.metrics?.[key] ?? null;
      const isPercent = key !== "review_error_rate";
      return {
        key,
        label: meta?.label || key,
        description: meta?.description || "Описание не зафиксировано.",
        formula: meta?.formula || "не зафиксировано",
        source: meta?.source || "не зафиксировано",
        valueLabel: isPercent ? formatPercent(value) : formatNumber(value),
      };
    });
  }, [snapshot]);

  const fileTraceMermaid = React.useMemo(() => buildFileTraceMermaid(snapshot), [snapshot]);

  const refreshSnapshot = React.useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const runtimeSnapshot = await fetchLatestCycleRuntime();
      if (runtimeSnapshot) {
        setSnapshot(runtimeSnapshot);
      } else {
        setSnapshot(fallbackSnapshot);
        setRefreshError("Runtime snapshot недоступен, показан generated fallback.");
      }
    } catch (error) {
      setRefreshError(String((error as Error)?.message || error || "refresh_failed"));
      setSnapshot(fallbackSnapshot);
    } finally {
      setRefreshing(false);
    }
  }, [fallbackSnapshot]);

  React.useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  React.useEffect(() => {
    if (!analystBpmn || !bpmnRef.current) return;
    const selectedDiagram = analystBpmn;
    let cancelled = false;

    async function renderBpmn() {
      setBpmnLoading(true);
      setBpmnError(null);
      try {
        const xml = await loadBpmnXml(selectedDiagram.filePath);
        await loadFirstAvailableScript(BPMN_SCRIPT_CANDIDATES, "bpmn");
        if (cancelled || !bpmnRef.current) return;
        const BpmnVisualization = window.bpmnvisu?.BpmnVisualization;
        if (!BpmnVisualization) throw new Error("bpmn_visualization_not_available");
        const viz = new BpmnVisualization({ container: bpmnRef.current });
        viz.load(xml);
      } catch (error) {
        if (!cancelled) {
          setBpmnError(String((error as Error)?.message || error || "bpmn_render_error"));
        }
      } finally {
        if (!cancelled) setBpmnLoading(false);
      }
    }

    void renderBpmn();
    return () => {
      cancelled = true;
    };
  }, [analystBpmn]);

  React.useEffect(() => {
    if (!mermaidRef.current) return;
    let cancelled = false;

    async function renderMermaid() {
      setMermaidError(null);
      try {
        await loadFirstAvailableScript(MERMAID_SCRIPT_CANDIDATES, "mermaid");
        if (cancelled || !mermaidRef.current) return;
        const mermaid = window.mermaid;
        if (!mermaid) throw new Error("mermaid_not_available");
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            fontFamily: "Roboto, sans-serif",
            primaryColor: "#dbeafe",
            primaryBorderColor: "#93c5fd",
            lineColor: "#0ea5e9",
          },
        });
        const renderId = `agent-flow-file-trace-${Date.now()}`;
        const rendered = await mermaid.render(renderId, fileTraceMermaid);
        if (!cancelled && mermaidRef.current) {
          mermaidRef.current.innerHTML = rendered.svg;
        }
      } catch (error) {
        if (!cancelled) {
          setMermaidError(String((error as Error)?.message || error || "mermaid_render_error"));
        }
      }
    }

    void renderMermaid();
    return () => {
      cancelled = true;
    };
  }, [fileTraceMermaid]);

  return (
    <Paper variant="outlined">
      <Stack spacing={1.25} sx={{ p: 2.25 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Agent Flow: analyst-agent
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Архитектура + BPMN + фактический последний цикл по telemetry.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshRoundedIcon />}
            onClick={() => {
              void refreshSnapshot();
            }}
            disabled={refreshing}
          >
            Обновить
          </Button>
        </Stack>
        {refreshing ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="caption" color="text.secondary">
              Обновление snapshot...
            </Typography>
          </Box>
        ) : null}
        {refreshError ? <Alert severity="warning">{refreshError}</Alert> : null}

        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.7 }}>
            Как устроен агент (C4 process views)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Источник: <Link href="#/docs">docs/subservices/oap/agents/analyst-agent/FLOW.md</Link>
          </Typography>
          {analystFlowDoc ? (
            <Box
              component="pre"
              sx={{
                mt: 0.8,
                p: 1,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                maxHeight: 180,
                overflow: "auto",
                bgcolor: "#f9fafc",
                fontSize: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {analystFlowDoc.content.slice(0, 900)}
            </Box>
          ) : (
            <Alert severity="info" sx={{ mt: 0.8 }}>
              Документ docs/subservices/oap/agents/analyst-agent/FLOW.md не найден в индексах.
            </Alert>
          )}
          <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            {processViews.map((viewId) => (
              <Button
                key={viewId}
                size="small"
                variant="outlined"
                component={Link}
                href={`https://playground.likec4.dev/w/${workspaceId}/${viewId}/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {viewId}
              </Button>
            ))}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.7 }}>
            Как должен работать (BPMN)
          </Typography>
          {analystBpmn ? (
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.8 }}>
              Файл: {analystBpmn.sourcePath} | Обновлено: {formatDateTime(analystBpmn.updatedAt)}
            </Typography>
          ) : (
            <Alert severity="warning" sx={{ mb: 0.8 }}>
              BPMN `docs/bpmn/analyst-agent-flow.bpmn` не найден в манифесте.
            </Alert>
          )}
          {bpmnLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Загрузка BPMN...
              </Typography>
            </Box>
          ) : null}
          {bpmnError ? <Alert severity="error">{bpmnError}</Alert> : null}
          <Box
            ref={bpmnRef}
            sx={{
              minHeight: 420,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              overflow: "auto",
              bgcolor: "background.paper",
            }}
          />
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.25 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.6 }}>
            Как сработал последний цикл (факт)
          </Typography>
          {snapshot.available && snapshot.latest_cycle ? (
            <Stack spacing={0.35}>
              <Typography variant="body2">
                task_id: <b>{snapshot.latest_cycle.task_id}</b>
              </Typography>
              <Typography variant="body2">
                Период: {formatDateTime(snapshot.latest_cycle.first_event_at)} → {formatDateTime(snapshot.latest_cycle.last_event_at)}
              </Typography>
              <Typography variant="body2">
                Финальный статус: {snapshot.latest_cycle.latest_final_status || "не зафиксировано"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Snapshot: {formatDateTime(snapshot.generated_at)}
              </Typography>
            </Stack>
          ) : (
            <Alert severity="info">Последний завершенный цикл analyst-agent пока не найден.</Alert>
          )}

          <Box sx={{ mt: 1.1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
              KPI цикла
            </Typography>
            <Stack spacing={0.7}>
              {metricRows.map((item, index) => (
                <Box key={item.key} sx={{ borderTop: index === 0 ? "none" : "1px solid", borderColor: "divider", pt: index === 0 ? 0 : 0.7 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} alignItems={{ sm: "center" }}>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={0.3} alignItems="center" useFlexGap flexWrap="wrap">
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
                      <Typography variant="caption" color="text.secondary">
                        {item.description}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, minWidth: { sm: 130 }, textAlign: { sm: "right" } }}>
                      {item.valueLabel}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>

          <Box sx={{ mt: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
              File trace (read/write)
            </Typography>
            {snapshot.file_trace?.fallback_used ? (
              <Alert severity="warning" sx={{ mb: 0.75 }}>
                Часть file-trace построена fallback-логикой шага, так как `artifacts_read/write` не были записаны в telemetry.
              </Alert>
            ) : null}
            {mermaidError ? <Alert severity="error" sx={{ mb: 0.75 }}>{mermaidError}</Alert> : null}
            <Box
              ref={mermaidRef}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1,
                overflow: "auto",
                minHeight: 180,
                bgcolor: "background.paper",
              }}
            />
          </Box>

          <Box sx={{ mt: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
              Таймлайн шагов
            </Typography>
            {snapshot.timeline.length > 0 ? (
              <Stack spacing={0.7}>
                {snapshot.timeline.map((event, index) => (
                  <Paper key={`${event.timestamp || index}-${event.step}-${index}`} variant="outlined" sx={{ p: 0.9 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {index + 1}. {event.step} {"->"} {event.status}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
                      Время: {formatDateTime(event.timestamp)} | run_id: {event.run_id || "не зафиксировано"} | trace_id: {event.trace_id || "не зафиксировано"}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                По последнему циклу не зафиксированы события.
              </Typography>
            )}
          </Box>
        </Paper>
      </Stack>
    </Paper>
  );
}
