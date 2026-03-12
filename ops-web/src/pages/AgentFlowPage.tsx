import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import InputRoundedIcon from "@mui/icons-material/InputRounded";
import OutputRoundedIcon from "@mui/icons-material/OutputRounded";
import CheckCircleOutlineRoundedIcon from "@mui/icons-material/CheckCircleOutlineRounded";

import {
  getAgentsManifest,
  getAnalystLatestCycle,
  getC4Manifest,
  getDocsIndex,
  type AgentLatestCycleSnapshot,
  type AgentSummary,
} from "../lib/generatedData";
import {
  buildFileTraceMermaid,
  fetchLatestCycleRuntime,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "../lib/agentFlow";
import { buildStepInlineMarkers, type AgentFlowInlineMarker } from "../lib/agentFlowRuntimeContours";
import {
  getRichStepsMeta,
  PHASE_LABELS,
  PHASE_COLORS,
  type RichStepMeta,
} from "../lib/workflowDiagram";

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      render: (id: string, value: string) => Promise<{ svg: string }>;
    };
  }
}

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

/** Read ?agent=<id> from current hash */
function readAgentParam(): string | null {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const qIdx = hash.indexOf("?");
  if (qIdx < 0) return null;
  const params = new URLSearchParams(hash.slice(qIdx));
  return params.get("agent") || null;
}

function buildUnifiedCapabilityLoopMermaid(agent: AgentSummary): string {
  const capabilityEnabled = Boolean(agent.capabilityOptimization?.enabled);
  const modeLabel = capabilityEnabled ? "ON" : "OFF";
  return [
    "flowchart LR",
    '  A["Завершение рабочего цикла"] --> B["Проверка результата"]',
    '  B -->|"Успех"| C["Фиксация урока"]',
    '  B -->|"Нужна доработка"| D["Возврат к задаче"]',
    '  C --> E["Обновление профиля агента"]',
    '  E --> F["Публикация обновленного снимка"]',
    `  F --> G["Готовность к следующему запуску (Capability loop: ${modeLabel})"]`,
  ].join("\n");
}

const ORCHESTRATION_MODES = [
  {
    id: "sequential",
    label: "Sequential",
    when: "Один исполнитель, общий mutable-артефакт, нет выигрыша от параллели.",
  },
  {
    id: "parallel_read_only",
    label: "Parallel read-only",
    when: "Нужны независимые аудиты или проверки по одному snapshot без write/apply.",
  },
  {
    id: "mixed_phased",
    label: "Mixed phased",
    when: "Сначала framing, затем parallel read-only, затем roundtable и single-owner merge.",
  },
] as const;

const ORCHESTRATION_PHASE_GRAPH = [
  '1) "Framing"',
  '2) "Parallel read-only"',
  '3) "Roundtable"',
  '4) "Single-owner merge"',
  '5) "Parallel verify"',
  '6) "Final summary"',
];

/* ------------------------------------------------------------------ */
/*  Step card component                                                */
/* ------------------------------------------------------------------ */

function StepCard({
  step,
  index,
  inlineMarkers,
}: {
  step: RichStepMeta;
  index: number;
  inlineMarkers: AgentFlowInlineMarker[];
}) {
  const colors = PHASE_COLORS[step.phase];
  const [detailOpen, setDetailOpen] = React.useState(false);
  const hasDetails = step.reads.length > 0 || step.writes.length > 0 || step.doneGate;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderLeft: `4px solid ${colors.border}`,
        bgcolor: colors.bg,
        p: 0,
        overflow: "hidden",
      }}
    >
      {/* Main content — always visible */}
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Typography
            variant="body1"
            sx={{
              fontWeight: 800,
              color: colors.border,
              minWidth: 28,
              lineHeight: 1.4,
            }}
          >
            {index + 1}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="body1" sx={{ fontWeight: 700, color: colors.text }}>
                {step.label}
              </Typography>
              {step.isRoleWindow ? (
                <Chip label="доменный шаг" size="small" sx={{ bgcolor: colors.border, color: "#fff", fontWeight: 600, fontSize: 11, height: 20 }} />
              ) : null}
              {step.isEntry ? <Chip label="вход" size="small" variant="outlined" sx={{ borderColor: colors.border, color: colors.text, height: 20 }} /> : null}
              {step.isExit ? <Chip label="выход" size="small" variant="outlined" sx={{ borderColor: colors.border, color: colors.text, height: 20 }} /> : null}
              {inlineMarkers.map((marker) => (
                <Tooltip key={marker.id} title={marker.hint} arrow placement="top-start">
                  <Chip
                    label={marker.label}
                    size="small"
                    color={marker.tone === "warning" ? "warning" : "info"}
                    variant="outlined"
                    sx={{ height: 20 }}
                  />
                </Tooltip>
              ))}
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.5, color: "text.secondary", lineHeight: 1.55 }}>
              {step.what || "Описание не зафиксировано."}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Expandable details: reads, writes, done-gate */}
      {hasDetails ? (
        <>
          <Box
            onClick={() => setDetailOpen((p) => !p)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 2,
              py: 0.5,
              cursor: "pointer",
              borderTop: "1px solid",
              borderColor: `${colors.border}33`,
              "&:hover": { bgcolor: `${colors.border}11` },
            }}
          >
            <ExpandMoreIcon
              sx={{
                fontSize: 18,
                color: colors.border,
                transform: detailOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, color: colors.text, opacity: 0.8 }}>
              {detailOpen ? "Скрыть детали" : "Входы · Выходы · Done-gate"}
            </Typography>
          </Box>
          <Collapse in={detailOpen}>
            <Box sx={{ px: 2, pb: 1.5, pt: 0.5 }}>
              <Stack spacing={1}>
                {step.reads.length > 0 ? (
                  <Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.3 }}>
                      <InputRoundedIcon sx={{ fontSize: 15, color: colors.border }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colors.text }}>
                        Читает
                      </Typography>
                    </Stack>
                    <Stack spacing={0.15} sx={{ pl: 2.5 }}>
                      {step.reads.map((r) => (
                        <Typography key={r} variant="caption" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
                          • {r}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
                {step.writes.length > 0 ? (
                  <Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.3 }}>
                      <OutputRoundedIcon sx={{ fontSize: 15, color: colors.border }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colors.text }}>
                        Пишет
                      </Typography>
                    </Stack>
                    <Stack spacing={0.15} sx={{ pl: 2.5 }}>
                      {step.writes.map((w) => (
                        <Typography key={w} variant="caption" sx={{ color: "text.secondary", lineHeight: 1.5 }}>
                          • {w}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
                {step.doneGate ? (
                  <Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.15 }}>
                      <CheckCircleOutlineRoundedIcon sx={{ fontSize: 15, color: colors.border }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, color: colors.text }}>
                        Done-gate
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ pl: 2.5, color: "text.secondary", display: "block" }}>
                      {step.doneGate}
                    </Typography>
                  </Box>
                ) : null}
              </Stack>
            </Box>
          </Collapse>
        </>
      ) : null}
    </Paper>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export function AgentFlowPage() {
  const manifest = React.useMemo(() => getAgentsManifest(), []);
  const agents = manifest.agents;
  const [agentId, setAgentId] = React.useState(() => readAgentParam() || agents[0]?.id || null);

  React.useEffect(() => {
    const onHash = () => {
      const param = readAgentParam();
      if (param) setAgentId(param);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // If no ?agent param in URL → set it from state
  React.useEffect(() => {
    if (agentId && !readAgentParam()) {
      window.history.replaceState(null, "", `#/agent-flow?agent=${encodeURIComponent(agentId)}`);
    }
  }, [agentId]);

  const agent = React.useMemo(
    () => (agentId ? agents.find((a) => a.id === agentId) || null : null),
    [agentId, agents],
  );

  if (!agent) {
    return <Alert severity="info">Агенты не найдены.</Alert>;
  }

  return <AgentFlowDetail agent={agent} agents={agents} />;
}

/* ------------------------------------------------------------------ */
/*  Detail view for a specific agent                                   */
/* ------------------------------------------------------------------ */

function AgentFlowDetail({ agent, agents }: { agent: AgentSummary; agents: AgentSummary[] }) {
  const backbone = agent.workflowBackbone;
  const richSteps = React.useMemo(() => (backbone ? getRichStepsMeta(backbone) : []), [backbone]);

  /* Group steps by phase for visual sections */
  const phaseGroups = React.useMemo(() => {
    const groups: Array<{ phase: RichStepMeta["phase"]; steps: Array<{ step: RichStepMeta; globalIdx: number }> }> = [];
    let currentPhase: RichStepMeta["phase"] | null = null;
    richSteps.forEach((step, idx) => {
      if (step.phase !== currentPhase) {
        currentPhase = step.phase;
        groups.push({ phase: step.phase, steps: [] });
      }
      groups[groups.length - 1].steps.push({ step, globalIdx: idx });
    });
    return groups;
  }, [richSteps]);

  /* C4 (analyst-agent only) */
  const c4 = React.useMemo(() => getC4Manifest(), []);
  const docs = React.useMemo(() => getDocsIndex(), []);
  const isAnalyst = agent.id === "analyst-agent";
  const workspaceId = React.useMemo(
    () => extractWorkspaceId(c4.views[0]?.playgroundUrl || "") || "gyQEJw",
    [c4.views],
  );
  const processViews = React.useMemo(
    () => ["analyst_flow_context", "analyst_flow_steps", "analyst_flow_io", "analyst_flow_notifications"],
    [],
  );
  const analystFlowDoc = React.useMemo(
    () => docs.find((item) => item.path === "docs/subservices/oap/agents/analyst-agent/FLOW.md") || null,
    [docs],
  );

  /* Last cycle (analyst-only) */
  const fallbackSnapshot = React.useMemo(() => (isAnalyst ? getAnalystLatestCycle() : null), [isAnalyst]);
  const [snapshot, setSnapshot] = React.useState<AgentLatestCycleSnapshot | null>(fallbackSnapshot);
  const [refreshing, setRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSnapshot(fallbackSnapshot);
    setRefreshError(null);
  }, [fallbackSnapshot, agent.id]);

  const refreshSnapshot = React.useCallback(async () => {
    if (!isAnalyst) return;
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
  }, [fallbackSnapshot, isAnalyst]);

  React.useEffect(() => {
    if (isAnalyst) void refreshSnapshot();
  }, [refreshSnapshot, isAnalyst]);

  /* Mermaid for file trace only */
  const fileTraceMermaidRef = React.useRef<HTMLDivElement | null>(null);
  const [fileTraceMermaidError, setFileTraceMermaidError] = React.useState<string | null>(null);
  const capabilityLoopMermaidRef = React.useRef<HTMLDivElement | null>(null);
  const [capabilityLoopMermaidError, setCapabilityLoopMermaidError] = React.useState<string | null>(null);
  const capabilityLoopMermaid = React.useMemo(() => buildUnifiedCapabilityLoopMermaid(agent), [agent]);

  const fileTraceMermaid = React.useMemo(
    () => (snapshot ? buildFileTraceMermaid(snapshot) : null),
    [snapshot],
  );

  React.useEffect(() => {
    if (!fileTraceMermaid || !fileTraceMermaidRef.current) return;
    const mermaidSource = fileTraceMermaid;
    let cancelled = false;

    async function render() {
      setFileTraceMermaidError(null);
      try {
        await loadFirstAvailableScript(MERMAID_SCRIPT_CANDIDATES, "mermaid");
        if (cancelled || !fileTraceMermaidRef.current) return;
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
        const rendered = await mermaid.render(renderId, mermaidSource);
        if (!cancelled && fileTraceMermaidRef.current) {
          fileTraceMermaidRef.current.innerHTML = rendered.svg;
        }
      } catch (error) {
        if (!cancelled) {
          setFileTraceMermaidError(String((error as Error)?.message || error || "mermaid_render_error"));
        }
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [fileTraceMermaid]);

  React.useEffect(() => {
    if (!capabilityLoopMermaidRef.current) return;
    const mermaidSource = capabilityLoopMermaid;
    let cancelled = false;

    async function render() {
      setCapabilityLoopMermaidError(null);
      try {
        await loadFirstAvailableScript(MERMAID_SCRIPT_CANDIDATES, "mermaid");
        if (cancelled || !capabilityLoopMermaidRef.current) return;
        const mermaid = window.mermaid;
        if (!mermaid) throw new Error("mermaid_not_available");
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            fontFamily: "Roboto, sans-serif",
            primaryColor: "#ecfdf5",
            primaryBorderColor: "#10b981",
            lineColor: "#0f766e",
          },
        });
        const renderId = `agent-flow-capability-loop-${Date.now()}`;
        const rendered = await mermaid.render(renderId, mermaidSource);
        if (!cancelled && capabilityLoopMermaidRef.current) {
          capabilityLoopMermaidRef.current.innerHTML = rendered.svg;
        }
      } catch (error) {
        if (!cancelled) {
          setCapabilityLoopMermaidError(String((error as Error)?.message || error || "mermaid_render_error"));
        }
      }
    }

    void render();
    return () => { cancelled = true; };
  }, [capabilityLoopMermaid]);

  /* C4 section open state */
  const [c4Open, setC4Open] = React.useState(false);

  /* KPI rows (analyst only) */
  const metricRows = React.useMemo(() => {
    if (!snapshot) return [];
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

  return (
    <Stack spacing={2}>
      {/* ── Hero ── */}
      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <IconButton size="small" href="#/agents" sx={{ alignSelf: "flex-start" }}>
            <ArrowBackRoundedIcon fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                Как работает: {agent.name || agent.id}
              </Typography>
              {agent.role ? <Chip label={agent.role} size="small" /> : null}
              {agent.status ? (
                <Chip
                  label={agent.status}
                  size="small"
                  color={agent.status === "healthy" ? "success" : "default"}
                  variant="outlined"
                />
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {agent.shortDescription || backbone?.roleWindow.purpose || "Описание не задано."}
            </Typography>
            {backbone ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: "block" }}>
                Единый backbone ({backbone.commonCoreSteps.length} шагов) + доменная ветка «{backbone.roleWindow.purpose}» ({backbone.roleWindow.internalSteps.length} шага)
              </Typography>
            ) : null}
          </Box>
        </Stack>

        {/* Agent switcher as chips */}
        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
          {agents.map((a) => (
            <Chip
              key={a.id}
              label={a.name || a.id}
              size="small"
              variant={a.id === agent.id ? "filled" : "outlined"}
              color={a.id === agent.id ? "primary" : "default"}
              onClick={() => {
                window.location.hash = `/agent-flow?agent=${encodeURIComponent(a.id)}`;
              }}
              sx={{ fontWeight: a.id === agent.id ? 700 : 400, cursor: "pointer" }}
            />
          ))}
        </Stack>
      </Paper>

      {/* ── Process steps by phase ── */}
      {backbone && phaseGroups.length > 0 ? (
        phaseGroups.map((group) => {
          const pc = PHASE_COLORS[group.phase];
          return (
            <Box key={group.phase}>
              {/* Phase header */}
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{
                  mb: 1,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: `${pc.border}12`,
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: pc.border, flexShrink: 0 }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: pc.text, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {PHASE_LABELS[group.phase]}
                </Typography>
                <Typography variant="caption" sx={{ color: pc.text, opacity: 0.7 }}>
                  {group.steps.length} {group.steps.length === 1 ? "шаг" : group.steps.length < 5 ? "шага" : "шагов"}
                </Typography>
              </Stack>
              {/* Step cards */}
              <Stack spacing={1}>
                {group.steps.map(({ step, globalIdx }) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={globalIdx}
                    inlineMarkers={buildStepInlineMarkers(step.id, agent)}
                  />
                ))}
              </Stack>
            </Box>
          );
        })
      ) : !backbone ? (
        <Alert severity="info">workflowBackbone не определён для этого агента.</Alert>
      ) : null}

      {agent.id === "orchestrator-agent" ? (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.7 }}>
            Decision node: выбор режима оркестрации
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Один пользовательский запрос остается одним UX-ответом, но внутри оркестратор выбирает режим взаимодействия и phase graph.
          </Typography>
          <Stack spacing={0.8}>
            {ORCHESTRATION_MODES.map((mode) => (
              <Paper key={mode.id} variant="outlined" sx={{ p: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Chip size="small" variant="outlined" label={mode.label} color={mode.id === "mixed_phased" ? "primary" : "default"} />
                  <Typography variant="body2" color="text.secondary">
                    {mode.when}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
          <Divider sx={{ my: 1.2 }} />
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.6 }}>
            Канонический phase graph
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} spacing={0.8} useFlexGap flexWrap="wrap">
            {ORCHESTRATION_PHASE_GRAPH.map((phase, index) => (
              <React.Fragment key={phase}>
                <Chip label={phase} color={index === 3 ? "warning" : index === 5 ? "success" : "default"} variant={index === 3 ? "filled" : "outlined"} />
                {index < ORCHESTRATION_PHASE_GRAPH.length - 1 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                    →
                  </Typography>
                ) : null}
              </React.Fragment>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.8, display: "block" }}>
            В V1 только фазы `Parallel read-only` и `Parallel verify` могут идти параллельно. Любой `write/apply/merge` остается single-owner.
          </Typography>
        </Paper>
      ) : null}
      <Alert severity="info">
        Важные проверки встроены в этапы пайплайна: метка «Проверка результата» показывает момент проверки эффекта,
        метка «Обновление способностей» показывает обновление профиля агента после цикла.
      </Alert>

      {/* ── Unified capability loop (mermaid) ── */}
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.7 }}>
          Mermaid: unified capability optimization loop
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
          Понятный путь цикла: проверка результата, фиксация урока, обновление профиля и готовность к следующему запуску.
        </Typography>
        {capabilityLoopMermaidError ? <Alert severity="error" sx={{ mb: 0.75 }}>{capabilityLoopMermaidError}</Alert> : null}
        <Box
          ref={capabilityLoopMermaidRef}
          sx={{
            minHeight: 220,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 1,
            overflow: "auto",
            bgcolor: "background.paper",
          }}
        />
      </Paper>

      {/* ── Last cycle (analyst-agent only) ── */}
      {isAnalyst && snapshot ? (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Последний цикл (факт)
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => { void refreshSnapshot(); }}
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

          {/* KPI */}
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

          {/* File trace */}
          <Box sx={{ mt: 1.2 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.55 }}>
              Какие данные агент читал и обновлял
            </Typography>
            {snapshot.file_trace?.fallback_used ? (
              <Alert severity="warning" sx={{ mb: 0.75 }}>
                Часть данных восстановлена автоматически, потому что в логе не хватило явных записей чтения/обновления.
              </Alert>
            ) : null}
            {fileTraceMermaidError ? <Alert severity="error" sx={{ mb: 0.75 }}>{fileTraceMermaidError}</Alert> : null}
            <Box
              ref={fileTraceMermaidRef}
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
        </Paper>
      ) : !isAnalyst ? (
        <Alert severity="info" sx={{ mt: 0.5 }}>
          Данные последнего цикла пока доступны только для analyst-agent.
        </Alert>
      ) : null}

      {/* ── C4 architecture (collapsible, analyst only) ── */}
      {isAnalyst ? (
        <Paper variant="outlined" sx={{ p: 1.5 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ cursor: "pointer" }}
            onClick={() => setC4Open((prev) => !prev)}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
              Архитектура (C4 process views)
            </Typography>
            <ExpandMoreIcon
              sx={{
                transform: c4Open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            />
          </Stack>
          <Collapse in={c4Open}>
            <Box sx={{ mt: 1 }}>
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
                  Документ FLOW.md не найден в индексах.
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
            </Box>
          </Collapse>
        </Paper>
      ) : null}
    </Stack>
  );
}
