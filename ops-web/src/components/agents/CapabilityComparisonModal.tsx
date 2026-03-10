import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoGraphRoundedIcon from "@mui/icons-material/AutoGraphRounded";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInFullRoundedIcon from "@mui/icons-material/OpenInFullRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import ZoomInRoundedIcon from "@mui/icons-material/ZoomInRounded";
import ZoomOutRoundedIcon from "@mui/icons-material/ZoomOutRounded";

import {
  getAnalystLatestCycle,
  type AgentCapabilityDecisionGuidance,
  type AgentCapabilityQualitySignals,
  type AgentCapabilitySnapshot,
  type AgentCapabilitySnapshotRow,
  type AgentExternalSkillCandidate,
  type AgentSkillShadowTrialArtifactJudgement,
  type AgentSkillShadowTrialArtifactTrial,
  type AgentSkillSourceRegistryEntry,
  type AgentSummary,
  type OapKbDocument,
} from "../../lib/generatedData";
import { SkillToolMcpTooltip } from "../skill-tooltip/SkillToolMcpTooltip";
import {
  getCapabilityColumnTooltip,
  getCapabilityTypeTooltipMetadata,
  type CapabilityTypeKey,
} from "../../lib/capabilityGlossary";

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

const LEGACY_SKILL_TO_TOOL: Record<string, string> = {
  "qmd-memory-retrieval": "QMD retrieval",
};

type CapabilityType = "rule" | "tool" | "skill" | "mcp";

type CapabilityTelemetryEvent = {
  eventId: string;
  timestamp: string;
  taskId: string;
  agentId: string;
  step: string;
  stepLabel: string;
  status: string;
  outcome: string;
  process: string;
  artifactsRead: string[];
  artifactsWritten: string[];
  tools: string[];
  skills: string[];
  mcpTools: string[];
  rules: string[];
};

type CapabilityCurrentMeta = {
  sourceLabel: string;
  sourceUrl: string | null;
  trustLabel: string;
  stateLabel: string;
  decisionGuidance: AgentCapabilityDecisionGuidance | null;
  qualitySignals: AgentCapabilityQualitySignals | null;
};

type CapabilityRow = {
  key: string;
  type: CapabilityType;
  name: string;
  taskCount: number | null;
  eventCount: number | null;
  agents: string[];
  journalEvents: CapabilityTelemetryEvent[];
  currentMeta: CapabilityCurrentMeta | null;
  bestCandidate: AgentExternalSkillCandidate | null;
  planTrial: AgentSkillShadowTrialArtifactTrial | null;
  judgement: AgentSkillShadowTrialArtifactJudgement | null;
  decisionStatus: "rewrite_current" | "trial_alternative" | "keep_current" | "replace_after_trial";
  decisionReason: string | null;
  decisionBlockedByStale: boolean;
  decisionBlockReason: string | null;
};

type CapabilityWindow = {
  taskId: string;
  events: CapabilityTelemetryEvent[];
  isFallback: boolean;
  title: string;
};

type JournalState = {
  open: boolean;
  row: CapabilityRow | null;
};

const EMPTY_JOURNAL: JournalState = { open: false, row: null };

function normalizePath(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
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
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
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

function formatDateTime(value: string): string {
  if (!value) return "не зафиксировано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

function formatShortDateTime(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCapabilityType(type: CapabilityType): string {
  if (type === "tool") return "Tool";
  if (type === "skill") return "Skill";
  if (type === "mcp") return "MCP";
  return "Rule";
}

function capabilityTypeColor(type: CapabilityType): "default" | "primary" | "success" | "warning" {
  if (type === "tool") return "warning";
  if (type === "skill") return "success";
  if (type === "mcp") return "primary";
  return "default";
}

function renderHeaderCell(columnId: string, minWidth: number) {
  const headerLabelMap: Record<string, string> = {
    "column.type": "Тип",
    "column.name": "Название",
    "column.source": "Источник",
    "column.trust": "Trust",
    "column.use_when": "Когда использовать",
    "column.avoid_when": "Когда не использовать",
    "column.contract_score": "Contract score",
    "column.verify_after_use": "Verify after use",
    "column.fallback_after_use": "Fallback after use",
    "column.review_status": "Статус review",
    "column.recommendation": "Решение",
    "column.tasks": "Задач",
    "column.events": "Событий",
    "column.best_alternative": "Лучшая внешняя альтернатива",
    "column.alternative_source": "Источник альтернативы",
    "column.shadow_result": "Shadow result",
    "column.promotion_status": "Promotion status",
    "column.journal": "Журнал",
  };
  const label = headerLabelMap[columnId] || columnId;
  const tooltipText = getCapabilityColumnTooltip(columnId);

  if (!tooltipText) {
    return <TableCell sx={{ fontWeight: 700, minWidth }}>{label}</TableCell>;
  }

  return (
    <TableCell sx={{ fontWeight: 700, minWidth }}>
      <Tooltip
        arrow
        enterDelay={120}
        title={tooltipText}
      >
        <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, cursor: "help" }}>
          <Box component="span">{label}</Box>
          <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        </Box>
      </Tooltip>
    </TableCell>
  );
}

function formatTrustLabel(value: string): string {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "official") return "Official";
  if (normalized === "curated") return "Curated";
  if (normalized === "discovery_only") return "Discovery only";
  if (normalized === "internal") return "Internal";
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  return value || "—";
}

function formatReviewStatus(value: string | null | undefined): string {
  if (value === "approved") return "Approved";
  if (value === "stale") return "Stale";
  if (value === "draft") return "Draft";
  return "—";
}

function formatRecommendation(value: string | null | undefined): string {
  if (value === "rewrite_current") return "Переписать текущий contract";
  if (value === "trial_alternative") return "Проверить альтернативу";
  if (value === "replace_after_trial") return "Заменить после trial";
  if (value === "keep_current") return "Оставить текущий";
  return "—";
}

function formatTrialStatus(value: string | null | undefined): string {
  if (value === "scheduled") return "Запланирован";
  if (value === "running") return "Идет";
  if (value === "passed") return "Пройден";
  if (value === "failed") return "Провален";
  if (value === "not_started") return "Не запускался";
  return "—";
}

function formatPromotionStatus(value: string | null | undefined): string {
  if (value === "human_review_required") return "Нужен human approve";
  if (value === "approved") return "Approved";
  if (value === "watchlist") return "Watchlist";
  if (value === "rejected") return "Rejected";
  return "—";
}

function formatFreshnessStatus(value: string | null | undefined): string {
  if (value === "fresh") return "Fresh";
  if (value === "stale") return "Stale";
  if (value === "missing") return "Missing";
  return "—";
}

function findShadowTrialArtifact(
  candidate: AgentExternalSkillCandidate | null,
  agent: AgentSummary | null,
): AgentSkillShadowTrialArtifactTrial | null {
  if (!candidate || !agent?.skillShadowTrial?.trials?.length) return null;
  return agent.skillShadowTrial.trials.find((trial) => {
    if (trial.candidateId && candidate.id && trial.candidateId === candidate.id) return true;
    return matchName(trial.candidateName, candidate.name);
  }) || null;
}

function findShadowTrialJudgement(
  candidate: AgentExternalSkillCandidate | null,
  trial: AgentSkillShadowTrialArtifactTrial | null,
  agent: AgentSummary | null,
): AgentSkillShadowTrialArtifactJudgement | null {
  if (!candidate || !agent?.skillShadowTrial?.judgements?.length) return null;
  return agent.skillShadowTrial.judgements.find((judgement) => {
    if (trial?.trialId && judgement.trialId && judgement.trialId === trial.trialId) return true;
    if (candidate.id && judgement.candidateId && judgement.candidateId === candidate.id) return true;
    return false;
  }) || null;
}

function renderShadowResult(
  candidate: AgentExternalSkillCandidate | null,
  trial: AgentSkillShadowTrialArtifactTrial | null,
  judgement: AgentSkillShadowTrialArtifactJudgement | null,
  decisionBlockedByStale = false,
  decisionBlockReason: string | null = null,
) {
  if (!candidate) return "—";
  if (decisionBlockedByStale) {
    return (
      <Stack spacing={0.5}>
        <Chip size="small" color="warning" variant="outlined" label="Blocked by stale" />
        <Typography variant="caption" color="text.secondary">
          {decisionBlockReason || "Нужен новый run агента"}
        </Typography>
      </Stack>
    );
  }
  if (judgement?.recommendation) {
    return (
      <Stack spacing={0.5}>
        <Chip size="small" color="primary" variant="outlined" label={formatRecommendation(judgement.recommendation)} />
        <Typography variant="caption" color="text.secondary">
          Judge artifact
        </Typography>
      </Stack>
    );
  }
  if (trial && !trial.eligible) {
    return (
      <Stack spacing={0.5}>
        <Chip size="small" color="warning" variant="outlined" label="Blocked" />
        <Typography variant="caption" color="text.secondary">
          {trial.blockReasons[0] || "trial не допускается policy"}
        </Typography>
      </Stack>
    );
  }
  return formatTrialStatus(candidate.trialStatus);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "не зафиксировано";
  return `${Number(value).toFixed(0)}%`;
}

function truncateText(value: string | null | undefined): string {
  if (!value) return "—";
  return value;
}

function normalizeToolsAndSkills(rawTools: unknown, rawSkills: unknown): { tools: string[]; skills: string[] } {
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

function parseTelemetryEvent(line: string): CapabilityTelemetryEvent | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const taxonomy = normalizeToolsAndSkills(parsed.tools, parsed.skills);
    return {
      eventId: String(parsed.event_id || ""),
      timestamp: String(parsed.timestamp || ""),
      taskId: String(parsed.task_id || ""),
      agentId: String(parsed.agent_id || ""),
      step: String(parsed.step_raw || parsed.step || ""),
      stepLabel: String(parsed.step_label || parsed.step || ""),
      status: String(parsed.status || ""),
      outcome: String(parsed.outcome || ""),
      process: String(parsed.process || ""),
      artifactsRead: toStringArray(parsed.artifacts_read),
      artifactsWritten: toStringArray(parsed.artifacts_written),
      tools: taxonomy.tools,
      skills: taxonomy.skills,
      mcpTools: toStringArray(parsed.mcp_tools),
      rules: toStringArray(parsed.rules),
    };
  } catch {
    return null;
  }
}

function extractTelemetryEvents(rawLogs: OapKbDocument[]): CapabilityTelemetryEvent[] {
  const target = rawLogs.find((doc) => normalizePath(doc.path) === ".logs/agents/analyst-agent.jsonl")
    || rawLogs.find((doc) => normalizePath(doc.path).endsWith(".logs/agents/analyst-agent.jsonl"));
  if (!target?.content) return [];
  return String(target.content)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseTelemetryEvent)
    .filter((item): item is CapabilityTelemetryEvent => Boolean(item))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

function eventCapabilityCount(event: CapabilityTelemetryEvent): number {
  return event.tools.length + event.skills.length + event.mcpTools.length + event.rules.length;
}

function selectCapabilityWindow(events: CapabilityTelemetryEvent[], latestTaskId: string | null): CapabilityWindow | null {
  const byTask = new Map<string, CapabilityTelemetryEvent[]>();
  for (const event of events) {
    if (!event.taskId) continue;
    const bucket = byTask.get(event.taskId) || [];
    bucket.push(event);
    byTask.set(event.taskId, bucket);
  }

  const latestEvents = latestTaskId ? (byTask.get(latestTaskId) || []) : [];
  if (latestTaskId && latestEvents.some((event) => eventCapabilityCount(event) > 0)) {
    return {
      taskId: latestTaskId,
      events: latestEvents.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
      isFallback: false,
      title: "Последний доступный цикл analyst-agent",
    };
  }

  const candidates = Array.from(byTask.entries())
    .map(([taskId, taskEvents]) => ({
      taskId,
      taskEvents,
      timestamp: Math.max(...taskEvents.map((event) => Date.parse(event.timestamp) || 0)),
      capabilityEvents: taskEvents.filter((event) => eventCapabilityCount(event) > 0).length,
    }))
    .filter((item) => item.capabilityEvents > 0)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (candidates.length === 0) return null;
  const selected = candidates[0];
  return {
    taskId: selected.taskId,
    events: [...selected.taskEvents].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
    isFallback: true,
    title: "Ближайший доступный run с explicit capability telemetry",
  };
}

function buildMermaidDiagram(): string {
  return [
    "flowchart LR",
    '  A["Current capability telemetry"] --> C["Capability quality analysis"]',
    '  B["External skill catalog"] --> D["Verified skill candidates"]',
    '  C --> E["Comparison table"]',
    '  D --> E["Comparison table"]',
    '  E --> F["Decision path"]',
    '  F --> G["Rewrite current contract"]',
    '  F --> H["Shadow trial of external skill"]',
    '  F --> I["Keep current"]',
    '  F --> J["Reject candidate"]',
    '  H --> K["Eval and grading"]',
    '  K --> L["Human approval"]',
    '  L --> M["Promote new skill"]',
    '  L --> N["Return to watchlist"]',
    '  G --> O["Registry + UI + telemetry update"]',
    '  M --> O',
    '  I --> O',
    '  J --> O',
  ].join("\n");
}

function renderCapabilityLabel(type: CapabilityType, name: string) {
  if (type === "rule") {
    return <Chip size="small" variant="outlined" label={name} />;
  }
  return <SkillToolMcpTooltip name={name} size="small" variant="outlined" />;
}

function uniqueArtifacts(events: CapabilityTelemetryEvent[]): string[] {
  return Array.from(
    new Set(
      events.flatMap((event) => [...event.artifactsRead, ...event.artifactsWritten]).filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ru"));
}

function findAnchorAgent(agents: AgentSummary[]): AgentSummary | null {
  return agents.find((agent) => agent.id === "analyst-agent") || agents[0] || null;
}

function matchName(name: string, candidate: string | null | undefined): boolean {
  return String(name || "").trim().toLowerCase() === String(candidate || "").trim().toLowerCase();
}

function buildCurrentMeta(type: CapabilityType, name: string, agent: AgentSummary | null): CapabilityCurrentMeta | null {
  if (!agent) return null;

  if (type === "skill") {
    const used = (agent.usedSkills || []).find((item) => matchName(name, item.name));
    if (used) {
      return {
        sourceLabel: used.skillFilePath || "SKILL.md",
        sourceUrl: null,
        trustLabel: "approved",
        stateLabel: "used",
        decisionGuidance: used.decisionGuidance || null,
        qualitySignals: used.qualitySignals || null,
      };
    }
    const available = (agent.availableSkills || []).find((item) => matchName(name, item.name));
    if (available) {
      return {
        sourceLabel: available.link || "docs/agents/registry.yaml#availableSkills",
        sourceUrl: available.link || null,
        trustLabel: "approved",
        stateLabel: "available",
        decisionGuidance: available.decisionGuidance || null,
        qualitySignals: available.qualitySignals || null,
      };
    }
  }

  if (type === "tool") {
    const used = (agent.usedTools || []).find((item) => matchName(name, item.name));
    if (used) {
      return {
        sourceLabel: used.source || "docs/agents/registry.yaml#usedTools",
        sourceUrl: /^https?:\/\//i.test(used.source || "") ? used.source : null,
        trustLabel: "approved",
        stateLabel: "used",
        decisionGuidance: used.decisionGuidance || null,
        qualitySignals: used.qualitySignals || null,
      };
    }
    const available = (agent.availableTools || []).find((item) => matchName(name, item.name));
    if (available) {
      return {
        sourceLabel: available.source || "docs/agents/registry.yaml#availableTools",
        sourceUrl: /^https?:\/\//i.test(available.source || "") ? available.source : null,
        trustLabel: "approved",
        stateLabel: "available",
        decisionGuidance: available.decisionGuidance || null,
        qualitySignals: available.qualitySignals || null,
      };
    }
  }

  if (type === "mcp") {
    const used = (agent.usedMcp || []).find((item) => matchName(name, item.name));
    if (used) {
      return {
        sourceLabel: "docs/agents/registry.yaml#usedMcp",
        sourceUrl: null,
        trustLabel: "approved",
        stateLabel: "used",
        decisionGuidance: used.decisionGuidance || null,
        qualitySignals: used.qualitySignals || null,
      };
    }
    const available = (agent.availableMcp || []).find((item) => matchName(name, item.name));
    if (available) {
      return {
        sourceLabel: available.link || "docs/agents/registry.yaml#availableMcp",
        sourceUrl: available.link || null,
        trustLabel: "approved",
        stateLabel: "available",
        decisionGuidance: available.decisionGuidance || null,
        qualitySignals: available.qualitySignals || null,
      };
    }
  }

  const rule = (agent.rulesApplied || []).find((item) => matchName(name, item.title));
  if (type === "rule" && rule) {
    return {
      sourceLabel: rule.location || rule.sourceUrl || "docs/agents/registry.yaml#rulesApplied",
      sourceUrl: rule.sourceUrl || null,
      trustLabel: "approved",
      stateLabel: "applied",
      decisionGuidance: rule.decisionGuidance || null,
      qualitySignals: rule.qualitySignals || null,
    };
  }

  return null;
}

function selectBestExternalCandidate(skillName: string, agent: AgentSummary | null): AgentExternalSkillCandidate | null {
  if (!agent?.externalSkillCandidates?.length) return null;
  const trustRank: Record<string, number> = {
    official: 0,
    curated: 1,
    discovery_only: 2,
    rejected: 3,
  };
  const recommendationRank: Record<string, number> = {
    replace_after_trial: 0,
    trial_alternative: 1,
    keep_current: 2,
    rewrite_current: 3,
  };
  const trialRank: Record<string, number> = {
    passed: 0,
    running: 1,
    scheduled: 2,
    not_started: 3,
    failed: 4,
  };

  return [...agent.externalSkillCandidates]
    .filter((candidate) => (candidate.targetSkills || []).some((item) => matchName(skillName, item)))
    .sort((a, b) => {
      const trustDelta = (trustRank[a.trust] ?? 99) - (trustRank[b.trust] ?? 99);
      if (trustDelta !== 0) return trustDelta;
      const recommendationDelta = (recommendationRank[a.recommendation] ?? 99) - (recommendationRank[b.recommendation] ?? 99);
      if (recommendationDelta !== 0) return recommendationDelta;
      return (trialRank[a.trialStatus] ?? 99) - (trialRank[b.trialStatus] ?? 99);
    })[0] || null;
}

function buildCapabilityRowsFromSnapshot(snapshot: AgentCapabilitySnapshot | null, agent: AgentSummary | null): CapabilityRow[] {
  if (!snapshot?.tableRows?.length) return [];
  return snapshot.tableRows.map((row: AgentCapabilitySnapshotRow) => ({
    key: row.key,
    type: row.type as CapabilityType,
    name: row.name,
    taskCount: null,
    eventCount: null,
    agents: agent?.id ? [agent.id] : [],
    journalEvents: [],
    currentMeta: {
      sourceLabel: row.sourceLabel,
      sourceUrl: row.sourceUrl,
      trustLabel: row.trustLabel,
      stateLabel: row.stateLabel,
      decisionGuidance: row.decisionGuidance || null,
      qualitySignals: row.qualitySignals || null,
    },
    bestCandidate: row.bestCandidate || null,
    planTrial: row.planTrial || null,
    judgement: row.judgement || null,
    decisionStatus: row.decisionStatus,
    decisionReason: row.decisionReason || null,
    decisionBlockedByStale: Boolean(row.decisionBlockedByStale),
    decisionBlockReason: row.decisionBlockReason || null,
  }));
}

function buildCapabilityRows(events: CapabilityTelemetryEvent[], agents: AgentSummary[]): CapabilityRow[] {
  const rows = new Map<string, CapabilityRow>();
  const anchorAgent = findAnchorAgent(agents);

  const ensureRow = (type: CapabilityType, name: string): CapabilityRow => {
    const normalizedName = String(name || "").trim();
    const key = `${type}:${normalizedName.toLowerCase()}`;
    const existing = rows.get(key);
    if (existing) return existing;

    const row: CapabilityRow = {
      key,
      type,
      name: normalizedName,
      taskCount: 0,
      eventCount: 0,
      agents: [],
      journalEvents: [],
      currentMeta: buildCurrentMeta(type, normalizedName, anchorAgent),
      bestCandidate: type === "skill" ? selectBestExternalCandidate(normalizedName, anchorAgent) : null,
      planTrial: null,
      judgement: null,
      decisionStatus: "keep_current",
      decisionReason: null,
      decisionBlockedByStale: false,
      decisionBlockReason: null,
    };
    rows.set(key, row);
    return row;
  };

  for (const event of events) {
    for (const name of event.tools) {
      const row = ensureRow("tool", name);
      row.eventCount = (row.eventCount ?? 0) + 1;
      if (event.agentId && !row.agents.includes(event.agentId)) row.agents.push(event.agentId);
      if (!row.journalEvents.some((item) => item.eventId === event.eventId)) row.journalEvents.push(event);
    }
    for (const name of event.skills) {
      const row = ensureRow("skill", name);
      row.eventCount = (row.eventCount ?? 0) + 1;
      if (event.agentId && !row.agents.includes(event.agentId)) row.agents.push(event.agentId);
      if (!row.journalEvents.some((item) => item.eventId === event.eventId)) row.journalEvents.push(event);
    }
    for (const name of event.mcpTools) {
      const row = ensureRow("mcp", name);
      row.eventCount = (row.eventCount ?? 0) + 1;
      if (event.agentId && !row.agents.includes(event.agentId)) row.agents.push(event.agentId);
      if (!row.journalEvents.some((item) => item.eventId === event.eventId)) row.journalEvents.push(event);
    }
    for (const name of event.rules) {
      const row = ensureRow("rule", name);
      row.eventCount = (row.eventCount ?? 0) + 1;
      if (event.agentId && !row.agents.includes(event.agentId)) row.agents.push(event.agentId);
      if (!row.journalEvents.some((item) => item.eventId === event.eventId)) row.journalEvents.push(event);
    }
  }

  if (anchorAgent) {
    for (const item of anchorAgent.usedSkills || []) ensureRow("skill", item.name);
    for (const item of anchorAgent.availableSkills || []) ensureRow("skill", item.name);
    for (const item of anchorAgent.usedTools || []) ensureRow("tool", item.name);
    for (const item of anchorAgent.usedMcp || []) ensureRow("mcp", item.name);
    for (const item of anchorAgent.availableMcp || []) ensureRow("mcp", item.name);
    for (const item of anchorAgent.rulesApplied || []) ensureRow("rule", item.title);
  }

  for (const row of rows.values()) {
    row.journalEvents.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    row.taskCount = new Set(row.journalEvents.map((event) => event.taskId).filter(Boolean)).size;
    row.agents.sort((a, b) => a.localeCompare(b, "ru"));
  }

  return [...rows.values()].sort((a, b) => {
    const typeOrder = { skill: 0, tool: 1, mcp: 2, rule: 3 } satisfies Record<CapabilityType, number>;
    return typeOrder[a.type] - typeOrder[b.type]
      || (b.eventCount ?? 0) - (a.eventCount ?? 0)
      || a.name.localeCompare(b.name, "ru");
  });
}

function renderTextBlock(value: string | null | undefined) {
  return (
    <Typography
      variant="body2"
      color={value ? "text.primary" : "text.secondary"}
      sx={{
        display: "-webkit-box",
        WebkitLineClamp: 3,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {value || "—"}
    </Typography>
  );
}

function renderList(values: string[] | null | undefined) {
  if (!values || values.length === 0) {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }
  return (
    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
      {values.map((item) => (
        <Chip key={item} size="small" variant="outlined" label={item} />
      ))}
    </Stack>
  );
}

function renderGuidanceSummary(guidance: AgentCapabilityDecisionGuidance | null | undefined) {
  return (
    <Stack spacing={1}>
      <Box>
        <Typography variant="caption" color="text.secondary">Purpose</Typography>
        {renderTextBlock(guidance?.purpose)}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Когда использовать</Typography>
        {renderTextBlock(guidance?.useWhen)}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Когда не использовать</Typography>
        {renderTextBlock(guidance?.avoidWhen)}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Required context</Typography>
        {renderList(guidance?.requiredContext)}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Expected output</Typography>
        {renderTextBlock(guidance?.expectedOutput)}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Failure modes</Typography>
        {renderList(guidance?.failureModes)}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Fallback</Typography>
        {renderList(guidance?.fallbackTo)}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary">Examples</Typography>
        {renderList(guidance?.examples)}
      </Box>
    </Stack>
  );
}

function renderQualitySignals(signals: AgentCapabilityQualitySignals | null | undefined) {
  return (
    <Stack spacing={0.7}>
      <Typography variant="body2"><strong>Contract score:</strong> {signals?.descriptionCompletenessScore ?? "не зафиксировано"}</Typography>
      <Typography variant="body2"><strong>Verify after use:</strong> {formatPercent(signals?.verifyPassAfterUseRate)}</Typography>
      <Typography variant="body2"><strong>Fallback after use:</strong> {formatPercent(signals?.fallbackAfterUseRate)}</Typography>
      <Typography variant="body2"><strong>Статус review:</strong> {formatReviewStatus(signals?.reviewStatus)}</Typography>
      <Typography variant="body2"><strong>Последний review:</strong> {formatDateTime(signals?.lastReviewedAt || "")}</Typography>
      <Typography variant="body2"><strong>Решение:</strong> {formatRecommendation(signals?.recommendation)}</Typography>
      <Typography variant="body2"><strong>Подсказка:</strong> {signals?.improvementHint || "—"}</Typography>
    </Stack>
  );
}

function renderSourceRegistry(sources: AgentSkillSourceRegistryEntry[]) {
  if (sources.length === 0) {
    return (
      <Alert severity="info" variant="outlined">
        Источники для discovery и trust-tier еще не зафиксированы.
      </Alert>
    );
  }

  return (
    <Stack spacing={1.2}>
      {sources.map((source) => (
        <Paper key={source.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
          <Stack spacing={0.7}>
            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{source.title}</Typography>
              <Chip size="small" variant="outlined" label={formatTrustLabel(source.trust)} />
              <Chip size="small" variant="outlined" label={source.kind} />
            </Stack>
            <Typography variant="body2" color="text.secondary">{source.description}</Typography>
            <Typography variant="body2"><strong>Как используем:</strong> {source.usagePolicy}</Typography>
            <Typography variant="body2"><strong>URL:</strong> {source.url || "не зафиксировано"}</Typography>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export function CapabilityComparisonModal({
  open,
  onClose,
  agents,
  journalRowKey,
  onJournalRowKeyChange,
}: {
  open: boolean;
  onClose: () => void;
  agents: AgentSummary[];
  journalRowKey?: string | null;
  onJournalRowKeyChange?: (rowKey: string | null) => void;
}) {
  const latestCycle = React.useMemo(() => getAnalystLatestCycle(), []);
  const anchorAgent = React.useMemo(() => findAnchorAgent(agents), [agents]);
  const capabilitySnapshot = anchorAgent?.capabilitySnapshot || null;
  const sourceRegistry = anchorAgent?.skillSourceRegistry || [];
  const rows = React.useMemo(
    () => buildCapabilityRowsFromSnapshot(capabilitySnapshot, anchorAgent),
    [anchorAgent, capabilitySnapshot],
  );
  const [journalState, setJournalState] = React.useState<JournalState>(EMPTY_JOURNAL);
  const mermaidDiagramSource = React.useMemo(() => buildMermaidDiagram(), []);
  const [mermaidSvg, setMermaidSvg] = React.useState<string>("");
  const [mermaidError, setMermaidError] = React.useState<string | null>(null);
  const [mermaidZoom, setMermaidZoom] = React.useState<number>(100);
  const [mermaidPreviewOpen, setMermaidPreviewOpen] = React.useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied" | "failed">("idle");

  const handleMermaidZoomIn = React.useCallback(() => {
    setMermaidZoom((prev) => Math.min(prev + 20, 300));
  }, []);

  const handleMermaidZoomOut = React.useCallback(() => {
    setMermaidZoom((prev) => Math.max(prev - 20, 60));
  }, []);

  const handleMermaidZoomReset = React.useCallback(() => {
    setMermaidZoom(100);
  }, []);

  const handleCopyMermaidSource = React.useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(mermaidDiagramSource);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = mermaidDiagramSource;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("failed");
    }
    window.setTimeout(() => setCopyFeedback("idle"), 1800);
  }, [mermaidDiagramSource]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const renderMermaid = async () => {
      try {
        setMermaidError(null);
        await loadFirstAvailableScript(MERMAID_SCRIPT_CANDIDATES, "capability-comparison-mermaid");
        if (!window.mermaid || cancelled) return;
        window.mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            fontFamily: "system-ui, sans-serif",
            primaryColor: "#e7eef7",
            primaryTextColor: "#17324d",
            lineColor: "#416182",
          },
        });
        const rendered = await window.mermaid.render(`capability-comparison-${Date.now()}`, mermaidDiagramSource);
        if (!cancelled) {
          setMermaidSvg(rendered.svg);
        }
      } catch {
        if (!cancelled) {
          setMermaidError("Не удалось загрузить Mermaid. Показан текстовый fallback.");
          setMermaidSvg("");
        }
      }
    };
    void renderMermaid();
    return () => {
      cancelled = true;
    };
  }, [mermaidDiagramSource, open]);

  React.useEffect(() => {
    if (!open) {
      setJournalState(EMPTY_JOURNAL);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const normalizedKey = String(journalRowKey || "").trim();
    if (!normalizedKey) {
      setJournalState((prev) => (prev.open ? EMPTY_JOURNAL : prev));
      return;
    }
    const matchedRow = rows.find((row) => row.key === normalizedKey) || null;
    if (!matchedRow) {
      onJournalRowKeyChange?.(null);
      return;
    }
    setJournalState((prev) => {
      if (prev.open && prev.row?.key === matchedRow.key) return prev;
      return { open: true, row: matchedRow };
    });
  }, [journalRowKey, onJournalRowKeyChange, open, rows]);

  const openJournal = React.useCallback((row: CapabilityRow) => {
    setJournalState({ open: true, row });
    onJournalRowKeyChange?.(row.key);
  }, [onJournalRowKeyChange]);

  const closeJournal = React.useCallback(() => {
    setJournalState(EMPTY_JOURNAL);
    onJournalRowKeyChange?.(null);
  }, [onJournalRowKeyChange]);

  const journalRow = journalState.row;
  const journalArtifacts = React.useMemo(
    () => [
      capabilitySnapshot?.snapshotArtifactPath,
      capabilitySnapshot?.planArtifactPath,
      capabilitySnapshot?.judgementArtifactPath,
      journalRow?.currentMeta?.sourceLabel,
    ].filter((item): item is string => Boolean(item)),
    [capabilitySnapshot, journalRow?.currentMeta?.sourceLabel],
  );
  const journalCandidate = journalRow?.bestCandidate || null;
  const journalTrialArtifact = React.useMemo(
    () => journalRow?.planTrial || findShadowTrialArtifact(journalCandidate, anchorAgent),
    [anchorAgent, journalCandidate, journalRow?.planTrial],
  );
  const journalJudgementArtifact = React.useMemo(
    () => journalRow?.judgement || findShadowTrialJudgement(journalCandidate, journalTrialArtifact, anchorAgent),
    [anchorAgent, journalCandidate, journalRow?.judgement, journalTrialArtifact],
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: { xs: "calc(100vw - 16px)", md: "min(1520px, calc(100vw - 48px))" },
            height: { xs: "92vh", md: "90vh" },
            borderRadius: 2.5,
          },
        }}
      >
        <DialogTitle sx={{ pr: 6, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack spacing={0.7}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Сравнительная таблица Rules, Tools, Skills, MCP
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Единый cockpit для current capability contract, external skill candidates и shadow-trial decision loop.
            </Typography>
          </Stack>
          <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, overflow: "auto" }}>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap>
                <Stack spacing={0.4} sx={{ flex: 1 }}>
                  <Typography variant="body2"><strong>Anchor agent:</strong> {anchorAgent?.id || "не зафиксировано"}</Typography>
                  <Typography variant="body2"><strong>Последний цикл snapshot:</strong> {latestCycle.latest_cycle?.task_id || "не зафиксировано"}</Typography>
                  <Typography variant="body2"><strong>Capability refresh:</strong> {formatDateTime(capabilitySnapshot?.lastRefreshedAt || "")}</Typography>
                  <Typography variant="body2"><strong>Run ID:</strong> {capabilitySnapshot?.lastRunId || "не зафиксировано"}</Typography>
                </Stack>
                <Stack spacing={0.4} sx={{ flex: 1 }}>
                  <Typography variant="body2"><strong>Строк в таблице:</strong> {rows.length}</Typography>
                  <Typography variant="body2"><strong>Freshness:</strong> {formatFreshnessStatus(capabilitySnapshot?.freshnessStatus)}</Typography>
                  <Typography variant="body2"><strong>Updated:</strong> {formatDateTime(latestCycle.generated_at)}</Typography>
                  <Typography variant="body2"><strong>Snapshot path:</strong> {capabilitySnapshot?.snapshotArtifactPath || "не зафиксировано"}</Typography>
                  <Typography variant="body2"><strong>Trial plan:</strong> {capabilitySnapshot?.planArtifactPath || anchorAgent?.skillShadowTrial?.planPath || "не зафиксировано"}</Typography>
                  <Typography variant="body2"><strong>Trial judgement:</strong> {capabilitySnapshot?.judgementArtifactPath || anchorAgent?.skillShadowTrial?.judgementPath || "не зафиксировано"}</Typography>
                </Stack>
              </Stack>
            </Paper>

            <Alert severity="info" variant="outlined">
              `Rules / Tools / MCP` участвуют только в quality refinement. Внешние marketplace-style альтернативы в v1 ищутся только для `Skills` и проходят только через `shadow mode` + `human approve`.
            </Alert>

            {capabilitySnapshot?.freshnessStatus === "stale" ? (
              <Alert severity="warning" variant="outlined">
                Snapshot устарел: {capabilitySnapshot.staleReason || "нужен новый run агента для актуализации decision и promotion-state."}
              </Alert>
            ) : null}

            {!capabilitySnapshot ? (
              <Alert severity="warning" variant="outlined">
                Capability snapshot еще не зафиксирован. Таблица станет каноничной после первого capability-refresh на run агента.
              </Alert>
            ) : null}

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <InfoOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Какие источники анализируются</Typography>
              </Stack>
              {renderSourceRegistry(sourceRegistry)}
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }} sx={{ mb: 1 }}>
                <AutoGraphRoundedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle2">Mermaid: unified capability optimization loop</Typography>
                <Stack direction="row" spacing={0.5} sx={{ ml: { md: "auto" } }}>
                  <Tooltip title="Открыть схему в увеличенном просмотре">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInFullRoundedIcon fontSize="small" />}
                      onClick={() => setMermaidPreviewOpen(true)}
                    >
                      Открыть
                    </Button>
                  </Tooltip>
                  <Tooltip title="Скопировать Mermaid-разметку для mermaid.live">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                      onClick={handleCopyMermaidSource}
                    >
                      Копировать Mermaid
                    </Button>
                  </Tooltip>
                </Stack>
              </Stack>
              {mermaidError ? <Alert severity="info">{mermaidError}</Alert> : null}
              {copyFeedback === "copied" ? (
                <Alert severity="success" sx={{ mb: 1 }}>Mermaid-разметка скопирована в буфер обмена.</Alert>
              ) : null}
              {copyFeedback === "failed" ? (
                <Alert severity="warning" sx={{ mb: 1 }}>Не удалось скопировать автоматически. Используйте текстовый fallback ниже.</Alert>
              ) : null}
              {mermaidSvg ? (
                <Box
                  sx={{
                    minHeight: 120,
                    overflowX: "auto",
                    "& svg": { width: "100%", height: "auto", minWidth: 960 },
                  }}
                  dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                />
              ) : (
                <Box sx={{ minHeight: 120 }} />
              )}
              {mermaidError ? (
                <Box component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: "0.82rem", m: 0 }}>
                  {mermaidDiagramSource}
                </Box>
              ) : null}
            </Paper>

            {rows.length === 0 ? (
              <Alert severity="warning" variant="outlined">
                В capability snapshot пока нет строк. После следующего capability-refresh таблица заполнится текущим рабочим контуром агента.
              </Alert>
            ) : (
              <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
                <Box sx={{ maxHeight: 560, overflow: "auto" }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        {renderHeaderCell("column.type", 90)}
                        {renderHeaderCell("column.name", 220)}
                        {renderHeaderCell("column.source", 220)}
                        {renderHeaderCell("column.trust", 120)}
                        {renderHeaderCell("column.use_when", 260)}
                        {renderHeaderCell("column.avoid_when", 260)}
                        {renderHeaderCell("column.contract_score", 110)}
                        {renderHeaderCell("column.verify_after_use", 120)}
                        {renderHeaderCell("column.fallback_after_use", 120)}
                        {renderHeaderCell("column.review_status", 130)}
                        {renderHeaderCell("column.recommendation", 220)}
                        {renderHeaderCell("column.tasks", 80)}
                        {renderHeaderCell("column.events", 80)}
                        {renderHeaderCell("column.best_alternative", 220)}
                        {renderHeaderCell("column.alternative_source", 180)}
                        {renderHeaderCell("column.shadow_result", 130)}
                        {renderHeaderCell("column.promotion_status", 150)}
                        {renderHeaderCell("column.journal", 120)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => {
                        const guidance = row.currentMeta?.decisionGuidance || null;
                        const signals = row.currentMeta?.qualitySignals || null;
                        const candidate = row.bestCandidate;
                        const trialArtifact = row.planTrial || findShadowTrialArtifact(candidate, anchorAgent);
                        const judgementArtifact = row.judgement || findShadowTrialJudgement(candidate, trialArtifact, anchorAgent);
                        return (
                          <TableRow key={row.key} hover>
                            <TableCell>
                              <SkillToolMcpTooltip
                                name={formatCapabilityType(row.type)}
                                label={formatCapabilityType(row.type)}
                                size="small"
                                variant="outlined"
                                metadataOverride={getCapabilityTypeTooltipMetadata(row.type as CapabilityTypeKey)}
                                chipColorOverride={capabilityTypeColor(row.type)}
                              />
                            </TableCell>
                            <TableCell>{renderCapabilityLabel(row.type, row.name)}</TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Typography variant="body2">{row.currentMeta?.sourceLabel || "не зафиксировано"}</Typography>
                                {row.currentMeta?.stateLabel ? (
                                  <Chip size="small" variant="outlined" label={row.currentMeta.stateLabel} sx={{ width: "fit-content" }} />
                                ) : null}
                              </Stack>
                            </TableCell>
                            <TableCell>{formatTrustLabel(row.currentMeta?.trustLabel || "internal")}</TableCell>
                            <TableCell>{renderTextBlock(guidance?.useWhen)}</TableCell>
                            <TableCell>{renderTextBlock(guidance?.avoidWhen)}</TableCell>
                            <TableCell>{signals?.descriptionCompletenessScore ?? "—"}</TableCell>
                            <TableCell>{formatPercent(signals?.verifyPassAfterUseRate)}</TableCell>
                            <TableCell>{formatPercent(signals?.fallbackAfterUseRate)}</TableCell>
                            <TableCell>{formatReviewStatus(signals?.reviewStatus)}</TableCell>
                            <TableCell>{formatRecommendation(row.decisionStatus)}</TableCell>
                            <TableCell>{row.taskCount ?? "—"}</TableCell>
                            <TableCell>{row.eventCount ?? "—"}</TableCell>
                            <TableCell>{candidate ? <Chip size="small" variant="outlined" label={candidate.name} /> : "—"}</TableCell>
                            <TableCell>{candidate ? `${candidate.sourceTitle} / ${formatTrustLabel(candidate.trust)}` : "—"}</TableCell>
                            <TableCell>{renderShadowResult(candidate, trialArtifact, judgementArtifact, row.decisionBlockedByStale, row.decisionBlockReason)}</TableCell>
                            <TableCell>
                              {candidate ? (
                                <Stack spacing={0.5}>
                                  <Typography variant="body2">{formatPromotionStatus(candidate.promotionStatus)}</Typography>
                                  {row.decisionBlockedByStale ? (
                                    <Typography variant="caption" color="warning.main">
                                      blocked by stale snapshot
                                    </Typography>
                                  ) : null}
                                  {judgementArtifact?.humanApprovalRequired ? (
                                    <Typography variant="caption" color="text.secondary">
                                      confirmed by judge artifact
                                    </Typography>
                                  ) : null}
                                </Stack>
                              ) : "—"}
                            </TableCell>
                            <TableCell>
                              <Button size="small" variant="text" onClick={() => openJournal(row)}>
                                Сводка
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>
              </Paper>
            )}
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mermaidPreviewOpen}
        onClose={() => setMermaidPreviewOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: { xs: "calc(100vw - 16px)", md: "min(1600px, calc(100vw - 48px))" },
            height: { xs: "92vh", md: "92vh" },
            borderRadius: 2.5,
          },
        }}
      >
        <DialogTitle sx={{ pr: 6, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <AutoGraphRoundedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Mermaid: unified capability optimization loop
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ ml: { md: "auto" } }}>
              <Tooltip title="Уменьшить">
                <span>
                  <IconButton size="small" onClick={handleMermaidZoomOut} disabled={mermaidZoom <= 60}>
                    <ZoomOutRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Button size="small" variant="outlined" onClick={handleMermaidZoomReset} startIcon={<RestartAltRoundedIcon fontSize="small" />}>
                {mermaidZoom}%
              </Button>
              <Tooltip title="Увеличить">
                <span>
                  <IconButton size="small" onClick={handleMermaidZoomIn} disabled={mermaidZoom >= 300}>
                    <ZoomInRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Скопировать Mermaid-разметку для mermaid.live">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyRoundedIcon fontSize="small" />}
                  onClick={handleCopyMermaidSource}
                >
                  Копировать Mermaid
                </Button>
              </Tooltip>
            </Stack>
          </Stack>
          <IconButton onClick={() => setMermaidPreviewOpen(false)} sx={{ position: "absolute", right: 8, top: 8 }} aria-label="Закрыть просмотр схемы">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, overflow: "hidden" }}>
          {copyFeedback === "copied" ? (
            <Alert severity="success" sx={{ mb: 1 }}>Mermaid-разметка скопирована в буфер обмена.</Alert>
          ) : null}
          {copyFeedback === "failed" ? (
            <Alert severity="warning" sx={{ mb: 1 }}>Не удалось скопировать автоматически. Ниже доступен текст разметки.</Alert>
          ) : null}
          {mermaidError ? <Alert severity="info" sx={{ mb: 1 }}>{mermaidError}</Alert> : null}
          <Box
            sx={{
              height: "100%",
              overflow: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              p: 1.5,
              backgroundColor: "background.paper",
            }}
          >
            {mermaidSvg ? (
              <Box
                sx={{
                  transform: `scale(${mermaidZoom / 100})`,
                  transformOrigin: "top left",
                  width: "max-content",
                  "& svg": { width: "100%", height: "auto", minWidth: 1120 },
                }}
                dangerouslySetInnerHTML={{ __html: mermaidSvg }}
              />
            ) : (
              <Box component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: "0.82rem", m: 0 }}>
                {mermaidDiagramSource}
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      <Dialog
        open={journalState.open}
        onClose={closeJournal}
        maxWidth={false}
        PaperProps={{
          sx: {
            width: { xs: "calc(100vw - 16px)", md: "min(1260px, calc(100vw - 64px))" },
            height: { xs: "88vh", md: "84vh" },
            borderRadius: 2.5,
          },
        }}
      >
        <DialogTitle sx={{ pr: 6, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Журнал и сравнение capability
            </Typography>
            {journalRow ? (
              <Tooltip title="Сводка по telemetry-событиям, current contract и external skill candidate для этого capability.">
                <InfoOutlinedIcon fontSize="small" color="action" />
              </Tooltip>
            ) : null}
          </Stack>
          <IconButton onClick={closeJournal} sx={{ position: "absolute", right: 8, top: 8 }} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2, overflow: "auto" }}>
          {!journalRow ? null : (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Stack spacing={0.6}>
                  <Typography variant="body2"><strong>Capability:</strong> {journalRow.name}</Typography>
                  <Typography variant="body2"><strong>Тип:</strong> {formatCapabilityType(journalRow.type)}</Typography>
                  <Typography variant="body2"><strong>Snapshot freshness:</strong> {formatFreshnessStatus(capabilitySnapshot?.freshnessStatus)}</Typography>
                  <Typography variant="body2"><strong>Источник:</strong> {journalRow.currentMeta?.sourceLabel || "не зафиксировано"}</Typography>
                  <Typography variant="body2"><strong>Trust:</strong> {formatTrustLabel(journalRow.currentMeta?.trustLabel || "internal")}</Typography>
                  <Typography variant="body2"><strong>Задач:</strong> {journalRow.taskCount ?? "не зафиксировано"}</Typography>
                  <Typography variant="body2"><strong>Событий:</strong> {journalRow.eventCount ?? "не зафиксировано"}</Typography>
                  {journalRow.decisionBlockedByStale ? (
                    <Typography variant="body2" color="warning.main">
                      <strong>Decision blocked:</strong> {journalRow.decisionBlockReason || "нужен новый run агента"}
                    </Typography>
                  ) : null}
                </Stack>
              </Paper>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Current contract</Typography>
                  {renderGuidanceSummary(journalRow.currentMeta?.decisionGuidance || null)}
                </Paper>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Quality signals</Typography>
                  {renderQualitySignals(journalRow.currentMeta?.qualitySignals || null)}
                </Paper>
              </Stack>

              {journalRow.bestCandidate ? (
                <>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Candidate contract</Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>{journalRow.bestCandidate.name}</strong> from {journalRow.bestCandidate.sourceTitle}
                      </Typography>
                      {renderGuidanceSummary(journalRow.bestCandidate.decisionGuidance)}
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Shadow-trial status</Typography>
                      <Stack spacing={0.7}>
                        <Typography variant="body2"><strong>Trial:</strong> {formatTrialStatus(journalRow.bestCandidate.trialStatus)}</Typography>
                        <Typography variant="body2"><strong>Promotion:</strong> {formatPromotionStatus(journalRow.bestCandidate.promotionStatus)}</Typography>
                        <Typography variant="body2"><strong>Recommendation:</strong> {formatRecommendation(journalRow.bestCandidate.recommendation)}</Typography>
                        <Typography variant="body2"><strong>Причина:</strong> {journalRow.bestCandidate.recommendationReason || "—"}</Typography>
                        <Typography variant="body2"><strong>Expected effect:</strong> {journalRow.bestCandidate.expectedEffect || "—"}</Typography>
                        <Typography variant="body2"><strong>Task success rate:</strong> {formatPercent(journalRow.bestCandidate.trialMetrics?.taskSuccessRate)}</Typography>
                        <Typography variant="body2"><strong>Verification pass rate:</strong> {formatPercent(journalRow.bestCandidate.trialMetrics?.verificationPassRate)}</Typography>
                        <Typography variant="body2"><strong>Time to solution delta:</strong> {journalRow.bestCandidate.trialMetrics?.timeToSolutionDeltaPct ?? "не зафиксировано"}</Typography>
                        <Typography variant="body2"><strong>Token/cost delta:</strong> {journalRow.bestCandidate.trialMetrics?.tokenCostDeltaPct ?? "не зафиксировано"}</Typography>
                        <Typography variant="body2"><strong>Fallback rate:</strong> {formatPercent(journalRow.bestCandidate.trialMetrics?.fallbackRate)}</Typography>
                        <Typography variant="body2"><strong>Human correction rate:</strong> {formatPercent(journalRow.bestCandidate.trialMetrics?.humanCorrectionRate)}</Typography>
                      </Stack>
                    </Paper>
                  </Stack>

                  <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Фактические trial-артефакты</Typography>
                    <Stack spacing={0.8}>
                      <Typography variant="body2"><strong>Snapshot path:</strong> {capabilitySnapshot?.snapshotArtifactPath || "не зафиксировано"}</Typography>
                      <Typography variant="body2"><strong>Plan path:</strong> {capabilitySnapshot?.planArtifactPath || anchorAgent?.skillShadowTrial?.planPath || "не зафиксировано"}</Typography>
                      <Typography variant="body2"><strong>Judgement path:</strong> {capabilitySnapshot?.judgementArtifactPath || anchorAgent?.skillShadowTrial?.judgementPath || "не зафиксировано"}</Typography>
                      <Typography variant="body2"><strong>Snapshot updated:</strong> {formatDateTime(capabilitySnapshot?.lastRefreshedAt || "")}</Typography>
                      <Typography variant="body2"><strong>Stale reason:</strong> {capabilitySnapshot?.staleReason || "нет"}</Typography>
                      <Typography variant="body2"><strong>Eligibility:</strong> {journalTrialArtifact ? (journalTrialArtifact.eligible ? "допущен" : "blocked") : "не зафиксировано"}</Typography>
                      <Typography variant="body2"><strong>Representative tasks:</strong></Typography>
                      {renderList(journalTrialArtifact?.representativeTasks)}
                      <Typography variant="body2"><strong>Block reasons:</strong></Typography>
                      {renderList(journalTrialArtifact?.blockReasons)}
                      <Typography variant="body2"><strong>Judge recommendation:</strong> {formatRecommendation(journalJudgementArtifact?.recommendation)}</Typography>
                      <Typography variant="body2"><strong>Judge blockers:</strong></Typography>
                      {renderList(journalJudgementArtifact?.blockers)}
                    </Stack>
                  </Paper>

                  {journalJudgementArtifact?.comparisons?.length ? (
                    <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
                      <Box sx={{ maxHeight: 260, overflow: "auto" }}>
                        <Table stickyHeader size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>Метрика</TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Статус</TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Baseline</TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Shadow</TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Delta pp</TableCell>
                              <TableCell sx={{ fontWeight: 700, minWidth: 120 }}>Delta %</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {journalJudgementArtifact.comparisons.map((comparison) => (
                              <TableRow key={`${journalRow.key}-${comparison.metric}`} hover>
                                <TableCell>{comparison.metric || "не зафиксировано"}</TableCell>
                                <TableCell>{comparison.status || "не зафиксировано"}</TableCell>
                                <TableCell>{comparison.baseline ?? "—"}</TableCell>
                                <TableCell>{comparison.shadow ?? "—"}</TableCell>
                                <TableCell>{comparison.deltaPp ?? "—"}</TableCell>
                                <TableCell>{comparison.deltaPct ?? "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Box>
                    </Paper>
                  ) : null}
                </>
              ) : null}

              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Связанные артефакты</Typography>
                {journalArtifacts.length > 0 ? (
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    {journalArtifacts.map((path) => (
                      <Chip key={`${journalRow.key}-${path}`} size="small" variant="outlined" label={path} />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">Артефакты не зафиксированы.</Typography>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
                <Box sx={{ maxHeight: 420, overflow: "auto" }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, minWidth: 130 }}>Время</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 240 }}>Task ID</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Шаг</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 130 }}>Статус</TableCell>
                        <TableCell sx={{ fontWeight: 700, minWidth: 280 }}>Outcome</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {journalRow.journalEvents.map((event) => (
                        <TableRow key={`${journalRow.key}-${event.eventId}`} hover>
                          <TableCell>{formatShortDateTime(event.timestamp)}</TableCell>
                          <TableCell>{event.taskId || "не зафиксировано"}</TableCell>
                          <TableCell>{event.stepLabel || event.step || "не зафиксировано"}</TableCell>
                          <TableCell>{event.status || "не зафиксировано"}</TableCell>
                          <TableCell>{event.outcome || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Paper>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
