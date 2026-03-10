#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const opsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(opsRoot, "..");
const outDir = path.join(opsRoot, "src", "generated");
const publicDir = path.join(opsRoot, "public");
const specContractsDir = path.join(repoRoot, ".specify", "specs", "001-oap", "contracts");
const assistantGovernanceContractPath = path.join(specContractsDir, "assistant-governance.json");
const requiredC4Views = ["oap_context", "oap_containers", "db_rpc_boundary", "security_access"];
const preferredSpecDir = "001-oap";
const agentStatuses = new Set(["healthy", "degraded", "offline"]);
const mcpStatuses = new Set(["online", "degraded", "offline"]);
const usedMcpStatuses = new Set(["active", "reauth_required", "degraded", "offline"]);
const capabilityReviewStatuses = new Set(["draft", "approved", "stale"]);
const capabilityRecommendations = new Set(["rewrite_current", "trial_alternative", "keep_current", "replace_after_trial"]);
const capabilitySourceTrust = new Set(["official", "curated", "rejected", "discovery_only"]);
const capabilitySourceKinds = new Set(["catalog_index", "official_docs", "official_repo", "curated_repo"]);
const externalTrialStatuses = new Set(["not_started", "scheduled", "running", "passed", "failed"]);
const externalPromotionStatuses = new Set(["human_review_required", "approved", "watchlist", "rejected"]);
const capabilityFreshnessStatuses = new Set(["fresh", "stale", "missing"]);
const MODERN_AGENT_IDS = new Set(["analyst-agent", "designer-agent"]);
const MODERN_AGENT_PLAN_RULES = {
  "analyst-agent": {
    title: "Операционный стандарт analyst-agent",
    path: "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md",
    description: "Канонический ежедневный цикл, policy источников, lifecycle улучшений и метрики аналитика.",
  },
  "designer-agent": {
    title: "Операционный стандарт designer-agent",
    path: "docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md",
    description: "Канонический процесс дизайн-ревью, UI gate, UX-понятность и правила подсказок.",
  },
};
const c4ViewDescriptions = {
  oap_context: "System context (C1): OAP actors, external systems, and platform boundary.",
  oap_containers: "Container view (C2): ops web, task sync, telemetry pipeline, and DB boundary.",
  db_rpc_boundary: "Selective component view (C3): DB public contract, RLS gate, tasks and telemetry zones.",
  security_access: "Security and access paths: frontend/services -> public contract -> RLS -> operational data.",
};
const oapKbCoreSources = [
  {
    relPath: "docs/subservices/oap/README.md",
    title: "ОАП: обзор сервиса",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/CAPABILITY_GLOSSARY.json",
    title: "ОАП: glossary capability comparison",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/DESIGN_RULES.md",
    title: "ОАП: правила дизайна и переиспользования",
    section: "policies",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/AGENT_OPERATIONS_RULES.md",
    title: "ОАП: операционные правила agent-card workflow",
    section: "policies",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/agents/analyst-agent/CARD_DATA_SOURCES_MAP.md",
    title: "ОАП: карта источников данных analyst-card",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/ROUTING_MANUAL_TRIALS.md",
    title: "ОАП: manual trials capability-first routing",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/REQUEST_ROUTING_CONTRACT.yaml",
    title: "ОАП: machine-readable router contract",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md",
    title: "ОАП: операционный стандарт продакт дизайнера",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/AGENT_TELEMETRY.md",
    title: "ОАП: стандарт телеметрии агентов",
    section: "telemetry_reports",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/AGENT_BENCHMARK.md",
    title: "ОАП: runbook benchmark-оценки агентов",
    section: "telemetry_reports",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/agents-card.schema.json",
    title: "ОАП: контракт карточки агента (JSON Schema)",
    section: "registry_contracts",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/tasks/todo.md",
    title: "ОАП: шаблон плана задачи (todo)",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/tasks/lessons.global.md",
    title: "ОАП: глобальный канон уроков (self-improvement)",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/tasks/lessons.md",
    title: "ОАП: журнал уроков (lessons)",
    section: "service",
    required: true,
  },
  {
    relPath: "docs/agents/registry.yaml",
    title: "Реестр агентов (YAML)",
    section: "registry_contracts",
    required: true,
  },
  {
    relPath: "artifacts/agent_telemetry_summary.md",
    title: "Сводка телеметрии агентов (Markdown)",
    section: "telemetry_reports",
    required: false,
  },
  {
    relPath: "artifacts/agent_telemetry_summary.json",
    title: "Сводка телеметрии агентов (JSON)",
    section: "telemetry_reports",
    required: false,
  },
  {
    relPath: "artifacts/agent_cycle_validation_report.json",
    title: "Валидация cycle state-machine (JSON)",
    section: "telemetry_reports",
    required: false,
  },
  {
    relPath: "artifacts/agent_latest_cycle_analyst.json",
    title: "Последний фактический цикл analyst-agent (JSON)",
    section: "telemetry_reports",
    required: false,
  },
  {
    relPath: "artifacts/analyst_benchmark_dataset.json",
    title: "Benchmark dataset: analyst-agent (JSON)",
    section: "telemetry_reports",
    required: false,
  },
  {
    relPath: "artifacts/agent_benchmark_summary.json",
    title: "Benchmark summary: analyst-agent (JSON)",
    section: "telemetry_reports",
    required: false,
  },
  {
    relPath: "artifacts/agent_benchmark_history.jsonl",
    title: "Benchmark history: analyst-agent (JSONL)",
    section: "telemetry_reports",
    required: false,
  },
  {
    relPath: "artifacts/skill_shadow_trial_plan.json",
    title: "Skill shadow-trial plan (JSON)",
    section: "telemetry_reports",
    required: false,
  },
  {
    relPath: "artifacts/skill_shadow_trial_judgement.json",
    title: "Skill shadow-trial judgement (JSON)",
    section: "telemetry_reports",
    required: false,
  },
];
const oapAgentsSectionRules = [
  {
    id: "qmd-retrieval-policy",
    section: "policies",
    title: "AGENTS: QMD Retrieval Policy",
    match: (heading) => /^QMD Retrieval Policy\b/i.test(heading),
  },
  {
    id: "oap-design-rule",
    section: "policies",
    title: "AGENTS: OAP Design Rule",
    match: (heading) => /^OAP Design Rule\b/i.test(heading),
  },
  {
    id: "agent-telemetry-logging",
    section: "telemetry_reports",
    title: "AGENTS: Agent Telemetry Logging",
    match: (heading) => /^Agent Telemetry Logging\b/i.test(heading),
  },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(fileName, value) {
  const target = path.join(outDir, fileName);
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function copyFile(source, target) {
  await ensureDir(path.dirname(target));
  await fs.copyFile(source, target);
}

function fileIdFromPath(filePath) {
  return filePath.replace(/[^\w.-]+/g, "_");
}

async function buildCapabilityGlossary() {
  const sourcePath = path.join(repoRoot, "docs", "subservices", "oap", "CAPABILITY_GLOSSARY.json");
  const raw = await fs.readFile(sourcePath, "utf8");
  return JSON.parse(raw);
}

function slugify(value) {
  return asString(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeWhitespace(value) {
  return value.replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  if (value === undefined) return "null";
  return JSON.stringify(value);
}

function normalizePath(value) {
  return asString(value).replace(/^\.?\//, "").replace(/\\/g, "/").toLowerCase();
}

function asNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function asNullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((item) => asString(item)).filter(Boolean) : [];
}

function buildCapabilitySourceFingerprintPayload(agent) {
  return {
    capabilityOptimization: agent?.capabilityOptimization && typeof agent.capabilityOptimization === "object"
      ? agent.capabilityOptimization
      : {},
    usedSkills: Array.isArray(agent?.usedSkills) ? agent.usedSkills : [],
    availableSkills: Array.isArray(agent?.availableSkills) ? agent.availableSkills : [],
    usedTools: Array.isArray(agent?.usedTools) ? agent.usedTools : [],
    availableTools: Array.isArray(agent?.availableTools) ? agent.availableTools : [],
    usedMcp: Array.isArray(agent?.usedMcp) ? agent.usedMcp : [],
    availableMcp: Array.isArray(agent?.availableMcp) ? agent.availableMcp : [],
    rulesApplied: Array.isArray(agent?.rulesApplied) ? agent.rulesApplied : [],
    skillSourceRegistry: Array.isArray(agent?.skillSourceRegistry) ? agent.skillSourceRegistry : [],
    externalSkillCandidates: Array.isArray(agent?.externalSkillCandidates) ? agent.externalSkillCandidates : [],
  };
}

function computeCapabilitySourceFingerprint(agent) {
  return createHash("sha1")
    .update(stableStringify(buildCapabilitySourceFingerprintPayload(agent)), "utf8")
    .digest("hex");
}

function hasDecisionGuidanceContent(value) {
  if (!value || typeof value !== "object") return false;
  return Boolean(
    asString(value.purpose)
    || asString(value.useWhen)
    || asString(value.avoidWhen)
    || normalizeStringArray(value.requiredContext).length > 0
    || asString(value.expectedOutput)
    || normalizeStringArray(value.failureModes).length > 0
    || normalizeStringArray(value.fallbackTo).length > 0
    || normalizeStringArray(value.examples).length > 0,
  );
}

function normalizeDecisionGuidance(value, fallback = {}) {
  const guidance = {
    purpose: asString(value?.purpose) || asString(fallback?.purpose) || null,
    useWhen: asString(value?.useWhen) || asString(fallback?.useWhen) || null,
    avoidWhen: asString(value?.avoidWhen) || asString(fallback?.avoidWhen) || null,
    requiredContext: normalizeStringArray(value?.requiredContext).length > 0
      ? normalizeStringArray(value?.requiredContext)
      : normalizeStringArray(fallback?.requiredContext),
    expectedOutput: asString(value?.expectedOutput) || asString(fallback?.expectedOutput) || null,
    failureModes: normalizeStringArray(value?.failureModes).length > 0
      ? normalizeStringArray(value?.failureModes)
      : normalizeStringArray(fallback?.failureModes),
    fallbackTo: normalizeStringArray(value?.fallbackTo).length > 0
      ? normalizeStringArray(value?.fallbackTo)
      : normalizeStringArray(fallback?.fallbackTo),
    examples: normalizeStringArray(value?.examples).length > 0
      ? normalizeStringArray(value?.examples)
      : normalizeStringArray(fallback?.examples),
  };

  return hasDecisionGuidanceContent(guidance) ? guidance : null;
}

function computeDescriptionCompletenessScore(guidance) {
  if (!guidance) return 0;
  const total = 8;
  let filled = 0;
  if (asString(guidance.purpose)) filled += 1;
  if (asString(guidance.useWhen)) filled += 1;
  if (asString(guidance.avoidWhen)) filled += 1;
  if (normalizeStringArray(guidance.requiredContext).length > 0) filled += 1;
  if (asString(guidance.expectedOutput)) filled += 1;
  if (normalizeStringArray(guidance.failureModes).length > 0) filled += 1;
  if (normalizeStringArray(guidance.fallbackTo).length > 0) filled += 1;
  if (normalizeStringArray(guidance.examples).length > 0) filled += 1;
  return Math.round((filled / total) * 100);
}

function normalizeCapabilityRecommendation(value, fallback = "keep_current") {
  const normalized = asString(value).toLowerCase();
  if (capabilityRecommendations.has(normalized)) return normalized;
  return fallback;
}

function normalizeCapabilityQualitySignals(value, guidance, fallbackRecommendation = "keep_current") {
  const explicitReviewStatus = asString(value?.reviewStatus).toLowerCase();
  const lastReviewedAt = asString(value?.lastReviewedAt) || null;
  const descriptionCompletenessScore = asNullableNumber(value?.descriptionCompletenessScore);
  const computedScore = descriptionCompletenessScore ?? computeDescriptionCompletenessScore(guidance);
  const reviewStatus = capabilityReviewStatuses.has(explicitReviewStatus)
    ? explicitReviewStatus
    : (computedScore >= 75 ? "approved" : "draft");
  const improvementHint = asString(value?.improvementHint)
    || (computedScore < 75 ? "Уточнить useWhen/avoidWhen/fallback и добавить примеры принятия решения." : null);

  return {
    reviewStatus,
    lastReviewedAt,
    descriptionCompletenessScore: computedScore,
    verifyPassAfterUseRate: asNullableNumber(value?.verifyPassAfterUseRate),
    fallbackAfterUseRate: asNullableNumber(value?.fallbackAfterUseRate),
    improvementHint,
    recommendation: normalizeCapabilityRecommendation(value?.recommendation, fallbackRecommendation),
  };
}

function normalizeSkillSourceRegistry(value) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const id = asString(item?.id) || `source-${index + 1}`;
    const title = asString(item?.title);
    const url = asString(item?.url) || null;
    const trust = capabilitySourceTrust.has(asString(item?.trust).toLowerCase()) ? asString(item?.trust).toLowerCase() : "discovery_only";
    const kind = capabilitySourceKinds.has(asString(item?.kind).toLowerCase()) ? asString(item?.kind).toLowerCase() : "catalog_index";
    const description = asString(item?.description) || "Источник для поиска и оценки skill-candidates.";
    const usagePolicy = asString(item?.usagePolicy) || "Использовать как источник discovery, затем валидировать отдельно.";

    assert(title.length > 0, `invalid_skill_source_title:${index}`);
    return { id, title, url, trust, kind, description, usagePolicy };
  });
}

function normalizeExternalSkillCandidates(value, ctx, skillSourceRegistry) {
  const list = Array.isArray(value) ? value : [];
  const sourceById = new Map(skillSourceRegistry.map((item) => [item.id, item]));
  return list.map((item, index) => {
    const id = asString(item?.id) || `${ctx}-candidate-${index + 1}`;
    const name = asString(item?.name);
    const sourceId = asString(item?.sourceId);
    const source = sourceById.get(sourceId) || null;
    const sourceTitle = asString(item?.sourceTitle) || source?.title || sourceId;
    const sourceUrl = asString(item?.sourceUrl) || source?.url || null;
    const trust = capabilitySourceTrust.has(asString(item?.trust).toLowerCase())
      ? asString(item?.trust).toLowerCase()
      : (source?.trust || "discovery_only");
    const summary = asString(item?.summary) || "Кандидат на shadow-trial для замены или усиления текущего skill.";
    const targetSkills = normalizeStringArray(item?.targetSkills);
    const expectedEffect = asString(item?.expectedEffect) || null;
    const decisionGuidance = normalizeDecisionGuidance(item?.decisionGuidance, {
      purpose: summary,
      useWhen: asString(item?.useWhen),
      avoidWhen: asString(item?.avoidWhen),
      expectedOutput: expectedEffect,
      examples: normalizeStringArray(item?.examples),
    });
    const recommendation = normalizeCapabilityRecommendation(item?.recommendation, "trial_alternative");
    const qualitySignals = normalizeCapabilityQualitySignals(item?.qualitySignals, decisionGuidance, recommendation);
    const trialStatus = externalTrialStatuses.has(asString(item?.trialStatus).toLowerCase()) ? asString(item?.trialStatus).toLowerCase() : "not_started";
    const promotionStatus = externalPromotionStatuses.has(asString(item?.promotionStatus).toLowerCase()) ? asString(item?.promotionStatus).toLowerCase() : "human_review_required";
    const recommendationReason = asString(item?.recommendationReason) || null;
    const rawTrialMetrics = item?.trialMetrics && typeof item.trialMetrics === "object" ? item.trialMetrics : null;
    const trialMetrics = rawTrialMetrics ? {
      taskSuccessRate: asNullableNumber(rawTrialMetrics.taskSuccessRate),
      verificationPassRate: asNullableNumber(rawTrialMetrics.verificationPassRate),
      timeToSolutionDeltaPct: asNullableNumber(rawTrialMetrics.timeToSolutionDeltaPct),
      tokenCostDeltaPct: asNullableNumber(rawTrialMetrics.tokenCostDeltaPct),
      fallbackRate: asNullableNumber(rawTrialMetrics.fallbackRate),
      humanCorrectionRate: asNullableNumber(rawTrialMetrics.humanCorrectionRate),
    } : null;

    assert(name.length > 0, `invalid_external_skill_candidate_name:${ctx}:${index}`);
    assert(sourceId.length > 0, `invalid_external_skill_candidate_source:${ctx}:${index}`);
    assert(sourceTitle.length > 0, `invalid_external_skill_candidate_source_title:${ctx}:${index}`);
    assert(targetSkills.length > 0, `invalid_external_skill_candidate_targets:${ctx}:${index}`);

    return {
      id,
      name,
      sourceId,
      sourceTitle,
      sourceUrl,
      trust,
      summary,
      targetSkills,
      expectedEffect,
      decisionGuidance,
      qualitySignals,
      trialStatus,
      promotionStatus,
      recommendation,
      recommendationReason,
      trialMetrics,
    };
  });
}

function normalizeIceValue(value, fallback = 5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  if (rounded < 1) return 1;
  if (rounded > 10) return 10;
  return rounded;
}

function priorityToIceSeed(priorityValue) {
  const priority = asString(priorityValue).toLowerCase();
  if (/выс|high|critical|p0|p1/.test(priority)) return 8;
  if (/низ|low|p3/.test(priority)) return 5;
  return 7;
}

function inferImprovementSection(title, problem, solution, effect) {
  const text = `${asString(title)} ${asString(problem)} ${asString(solution)} ${asString(effect)}`.toLowerCase();
  if (/(mcp|context7|supabase|netlify|интеграц|сервер)/.test(text)) return "MCP";
  if (/(навык|skill|правил|rule|qmd|agents\.md)/.test(text)) return "Навыки и правила";
  if (/(задач|review|ошиб|quality|tqs|контрол|просроч)/.test(text)) return "Задачи и качество";
  if (/(контекст|памят|anchor|retrieval|token|телеметр|trace|log)/.test(text)) return "Память и контекст";
  return "Улучшения всей карточки";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function withDaysOffset(baseDate, days) {
  const value = baseDate instanceof Date ? new Date(baseDate.getTime()) : new Date(baseDate);
  if (Number.isNaN(value.getTime())) return toDateOnly(new Date());
  value.setUTCDate(value.getUTCDate() + days);
  return toDateOnly(value);
}

function runGit(args) {
  return execFileSync("git", args, { cwd: repoRoot, stdio: "pipe" }).toString("utf8").trim();
}

function resolveRepoBrowseBase() {
  const explicit = String(process.env.OPS_REPO_BROWSE_BASE_URL || "").trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  try {
    const remote = runGit(["config", "--get", "remote.origin.url"]);
    if (!remote) return null;
    const githubSsh = remote.match(/^git@github\.com:(.+)\.git$/i);
    if (githubSsh) return `https://github.com/${githubSsh[1]}`;
    const githubHttps = remote.match(/^https:\/\/github\.com\/(.+?)(?:\.git)?$/i);
    if (githubHttps) return `https://github.com/${githubHttps[1]}`;
    return null;
  } catch {
    return null;
  }
}

function resolveRepoRef() {
  if (process.env.OPS_REPO_REF) return process.env.OPS_REPO_REF.trim();
  try {
    const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (branch && branch !== "HEAD") return branch;
    return runGit(["rev-parse", "HEAD"]);
  } catch {
    return null;
  }
}

function sourceUrlForPath(relPath, repoBrowseBase, repoRef) {
  if (!repoBrowseBase || !repoRef) return null;
  return `${repoBrowseBase}/blob/${repoRef}/${relPath}`;
}

function gitLastUpdatedAt(relPath) {
  try {
    const output = runGit(["log", "-1", "--format=%cI", "--", relPath]);
    return output || null;
  } catch {
    return null;
  }
}

async function walkFiles(rootDir, extension = ".md") {
  const files = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      if (entry.isFile() && absolute.endsWith(extension)) {
        files.push(absolute);
      }
    }
  }
  await walk(rootDir);
  return files;
}

function parseMarkdownInfo(source) {
  const lines = source.split(/\n/);
  const headings = [];
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)\s*$/);
    if (match) {
      headings.push(match[2].trim());
    }
  }
  const title = headings[0] || source.split(/\n/)[0]?.trim() || "Untitled";
  return { title, headings };
}

function parseTextInfo(source) {
  const firstLine = source.split(/\n/).find((line) => line.trim().length > 0);
  return {
    title: firstLine?.trim() || "Untitled",
    headings: [],
  };
}

function parseDocumentInfo(relPath, content) {
  if (relPath.toLowerCase().endsWith(".md")) {
    return parseMarkdownInfo(content);
  }
  return parseTextInfo(content);
}

function renderAssistantEntryPointer({
  assistantId,
  displayName,
  canonicalFile,
  templateVersion,
}) {
  const specPath = "/.specify/specs/001-oap/spec.md";
  const uiSectionsPath = "ops-web/src/generated/ui-section-contract.json";
  return [
    `# ${displayName} Entry Point`,
    "",
    "<!-- generated: assistant-governance-v2 -->",
    "<!-- do-not-edit: use `npm --prefix ops-web run prepare-content` -->",
    "",
    `Этот файл является короткой точкой входа для \`${assistantId}\` и генерируется автоматически.`,
    "",
    "## Канон правил",
    `- Канонический файл правил: \`${canonicalFile}\`.`,
    "- Локальные правила в этом файле не задаются.",
    "",
    "## Порядок чтения",
    `1. \`${specPath}\``,
    `2. \`${canonicalFile}\``,
    "3. Этот entry-файл",
    "",
    "## Политика UI-ссылок",
    `- Использовать semantic ids из \`${uiSectionsPath}\`.`,
    "- Текущий display label брать из section-contract, а не из памяти.",
    "- При отсутствии section-contract сверяться с актуальным runtime/code.",
    "",
    `Template version: \`${templateVersion}\`.`,
    "",
  ].join("\n");
}

async function buildAssistantGovernanceArtifacts() {
  const raw = await fs.readFile(assistantGovernanceContractPath, "utf8");
  const parsed = JSON.parse(raw);
  const canonicalFile = asString(parsed?.canonical_file);
  const entryStrategy = asString(parsed?.entry_strategy);
  const templateVersion = asString(parsed?.template_version) || "v2";
  const assistants = Array.isArray(parsed?.supported_assistants) ? parsed.supported_assistants : [];

  assert(canonicalFile === "AGENTS.md", "assistant_governance_canonical_file_invalid");
  assert(entryStrategy === "generated_pointer", "assistant_governance_entry_strategy_invalid");
  assert(assistants.length > 0, "assistant_governance_supported_assistants_empty");

  const generatedEntries = [];
  for (const item of assistants) {
    if (item?.enabled === false) continue;
    const assistantId = asString(item?.assistant_id);
    const displayName = asString(item?.display_name) || assistantId;
    const entryFile = asString(item?.entry_file);

    assert(assistantId.length > 0, "assistant_governance_assistant_id_missing");
    assert(entryFile.length > 0, `assistant_governance_entry_file_missing:${assistantId}`);

    const absoluteEntryFile = path.join(repoRoot, entryFile);
    const content = renderAssistantEntryPointer({
      assistantId,
      displayName,
      canonicalFile,
      templateVersion,
    });
    await ensureDir(path.dirname(absoluteEntryFile));
    await fs.writeFile(absoluteEntryFile, content, "utf8");
    generatedEntries.push({
      assistant_id: assistantId,
      display_name: displayName,
      entry_file: entryFile,
      template_version: templateVersion,
    });
  }

  return {
    version: asString(parsed?.version) || "assistant_governance_v2",
    canonical_file: canonicalFile,
    entry_strategy: entryStrategy,
    template_version: templateVersion,
    supported_assistants: assistants,
    generated_at: new Date().toISOString(),
    generated_entries: generatedEntries,
  };
}

function parseTabLabels(agentsPageSource) {
  return Array.from(agentsPageSource.matchAll(/<Tab label="([^"]+)"\s*\/>/g))
    .map((match) => asString(match[1]))
    .filter(Boolean);
}

function parseSectionBlockTitle(fileSource, contextKey) {
  const match = fileSource.match(/<SectionBlock\s+title="([^"]+)"/);
  assert(match && asString(match[1]).length > 0, `ui_section_contract_section_title_missing:${contextKey}`);
  return asString(match[1]);
}

async function buildUiSectionContract() {
  const modernTabKeys = ["overview", "mcp", "skills_rules", "tasks_quality", "memory_context", "improvements"];
  const legacyTabKeys = ["overview", "skills_rules", "tasks_quality", "memory_context", "improvements"];
  const agentsPageRelPath = "ops-web/src/pages/AgentsPage.tsx";
  const agentsPageSource = await fs.readFile(path.join(repoRoot, agentsPageRelPath), "utf8");
  const labels = parseTabLabels(agentsPageSource);

  assert(
    labels.length >= modernTabKeys.length + legacyTabKeys.length,
    "ui_section_contract_tabs_missing",
  );

  const sections = [];
  const modernLabels = labels.slice(0, modernTabKeys.length);
  const legacyLabels = labels.slice(modernTabKeys.length, modernTabKeys.length + legacyTabKeys.length);

  modernTabKeys.forEach((tabKey, index) => {
    sections.push({
      section_id: `agents.modern.tab.${tabKey}`,
      current_label: modernLabels[index],
      container_type: "tab",
      card_type: "modern_agent_drawer",
      visibility: "default",
      source_file: agentsPageRelPath,
    });
  });

  legacyTabKeys.forEach((tabKey, index) => {
    sections.push({
      section_id: `agents.legacy.tab.${tabKey}`,
      current_label: legacyLabels[index],
      container_type: "tab",
      card_type: "legacy_agent_drawer",
      visibility: "default",
      source_file: agentsPageRelPath,
    });
  });

  const legacySectionFiles = [
    {
      section_id: "agents.legacy.analyst.drawer.how_it_works",
      file_path: "ops-web/src/components/analyst-card/sections/AgentProcessSection.tsx",
    },
    {
      section_id: "agents.legacy.analyst.drawer.work_contour",
      file_path: "ops-web/src/components/analyst-card/sections/SkillsSection.tsx",
    },
    {
      section_id: "agents.legacy.analyst.drawer.memory",
      file_path: "ops-web/src/components/analyst-card/sections/MemorySection.tsx",
    },
    {
      section_id: "agents.legacy.analyst.drawer.risks",
      file_path: "ops-web/src/components/analyst-card/sections/RisksSection.tsx",
    },
    {
      section_id: "agents.legacy.analyst.drawer.sessions",
      file_path: "ops-web/src/components/analyst-card/sections/SessionsSection.tsx",
    },
    {
      section_id: "agents.legacy.analyst.drawer.self_improvement",
      file_path: "ops-web/src/components/analyst-card/sections/SelfImprovementSection.tsx",
    },
  ];

  for (const section of legacySectionFiles) {
    const fileSource = await fs.readFile(path.join(repoRoot, section.file_path), "utf8");
    sections.push({
      section_id: section.section_id,
      current_label: parseSectionBlockTitle(fileSource, section.section_id),
      container_type: "drawer_block",
      card_type: "legacy_analyst_drawer",
      visibility: "default",
      source_file: section.file_path,
    });
  }

  const seen = new Set();
  for (const section of sections) {
    assert(asString(section.section_id).length > 0, "ui_section_contract_section_id_missing");
    assert(asString(section.current_label).length > 0, `ui_section_contract_label_missing:${section.section_id}`);
    assert(!seen.has(section.section_id), `ui_section_contract_duplicate_section_id:${section.section_id}`);
    seen.add(section.section_id);
  }

  return {
    version: "ui_section_contract_v1",
    generated_at: new Date().toISOString(),
    sections,
  };
}

function splitLevelTwoSections(source) {
  const lines = source.replace(/\r/g, "").split("\n");
  const sections = [];
  let currentTitle = null;
  let startLine = -1;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const heading = lines[idx].match(/^##\s+(.+?)\s*$/);
    if (!heading) continue;

    if (currentTitle !== null && startLine >= 0) {
      sections.push({
        title: currentTitle,
        content: lines.slice(startLine, idx).join("\n").trim(),
      });
    }

    currentTitle = heading[1].trim();
    startLine = idx;
  }

  if (currentTitle !== null && startLine >= 0) {
    sections.push({
      title: currentTitle,
      content: lines.slice(startLine).join("\n").trim(),
    });
  }

  return sections;
}

async function buildOapKbIndex() {
  const repoBrowseBase = resolveRepoBrowseBase();
  const repoRef = resolveRepoRef();
  const documents = [];

  for (const source of oapKbCoreSources) {
    const absolutePath = path.join(repoRoot, source.relPath);
    let content = "";
    let stat = null;

    try {
      content = await fs.readFile(absolutePath, "utf8");
      stat = await fs.stat(absolutePath);
    } catch (error) {
      if (!source.required) continue;
      throw new Error(`oap_kb_source_missing:${source.relPath}:${String(error)}`);
    }

    const parsed = parseDocumentInfo(source.relPath, content);
    const updatedAt = gitLastUpdatedAt(source.relPath) || stat?.mtime.toISOString() || new Date().toISOString();
    documents.push({
      id: fileIdFromPath(`oap_kb:${source.relPath}`),
      title: source.title || parsed.title,
      path: source.relPath,
      sourceUrl: sourceUrlForPath(source.relPath, repoBrowseBase, repoRef),
      section: source.section,
      headings: parsed.headings,
      updatedAt,
      content,
    });
  }

  const lessonsDir = path.join(repoRoot, "docs", "subservices", "oap", "tasks", "lessons");
  try {
    const lessonFiles = await walkFiles(lessonsDir, ".md");
    for (const absolutePath of lessonFiles.sort()) {
      const relPath = path.relative(repoRoot, absolutePath).replace(/\\/g, "/");
      const content = await fs.readFile(absolutePath, "utf8");
      const stat = await fs.stat(absolutePath);
      const parsed = parseDocumentInfo(relPath, content);
      const fileName = path.basename(relPath, ".md");
      const updatedAt = gitLastUpdatedAt(relPath) || stat.mtime.toISOString();
      const title = fileName === "_TEMPLATE"
        ? "ОАП: шаблон уроков агента"
        : `ОАП: уроки агента (${fileName})`;
      documents.push({
        id: fileIdFromPath(`oap_kb:${relPath}`),
        title,
        path: relPath,
        sourceUrl: sourceUrlForPath(relPath, repoBrowseBase, repoRef),
        section: "service",
        headings: parsed.headings,
        updatedAt,
        content,
      });
    }
  } catch {
    // Agent-specific lessons files are optional during migration.
  }

  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const agentsContent = await fs.readFile(agentsPath, "utf8");
  const agentsSections = splitLevelTwoSections(agentsContent);
  const agentsUpdatedAt = gitLastUpdatedAt("AGENTS.md") || (await fs.stat(agentsPath)).mtime.toISOString();
  const agentsSourceUrl = sourceUrlForPath("AGENTS.md", repoBrowseBase, repoRef);

  for (const rule of oapAgentsSectionRules) {
    const found = agentsSections.find((section) => rule.match(section.title));
    if (!found) {
      throw new Error(`oap_kb_agents_section_missing:${rule.id}`);
    }

    const anchor = slugify(found.title);
    documents.push({
      id: fileIdFromPath(`oap_kb:AGENTS.md:${rule.id}`),
      title: rule.title,
      path: `AGENTS.md#${anchor}`,
      sourceUrl: agentsSourceUrl ? `${agentsSourceUrl}#${anchor}` : null,
      section: rule.section,
      headings: [found.title],
      updatedAt: agentsUpdatedAt,
      content: found.content,
    });
  }

  documents.sort((a, b) => a.path.localeCompare(b.path));
  return documents;
}

async function buildOapRawLogsIndex() {
  const logDir = path.join(repoRoot, ".logs", "agents");
  const repoBrowseBase = resolveRepoBrowseBase();
  const repoRef = resolveRepoRef();
  const documents = [];

  let entries = [];
  try {
    entries = await fs.readdir(logDir, { withFileTypes: true });
  } catch {
    return documents;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const absolutePath = path.join(logDir, entry.name);
    const relPath = path.relative(repoRoot, absolutePath).replace(/\\/g, "/");
    const content = await fs.readFile(absolutePath, "utf8");
    const stat = await fs.stat(absolutePath);
    const updatedAt = gitLastUpdatedAt(relPath) || stat.mtime.toISOString();
    documents.push({
      id: fileIdFromPath(`oap_kb_raw:${relPath}`),
      title: `Сырой лог агента: ${entry.name.replace(/\.jsonl$/i, "")}`,
      path: relPath,
      sourceUrl: sourceUrlForPath(relPath, repoBrowseBase, repoRef),
      section: "raw_logs",
      headings: [],
      updatedAt,
      content,
    });
  }

  documents.sort((a, b) => a.path.localeCompare(b.path));
  return documents;
}

async function buildSkillCatalogFromAgentsFile() {
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const source = await fs.readFile(agentsPath, "utf8");
  const lines = source.replace(/\r/g, "").split("\n");
  const catalog = new Map();
  const skillPattern = /^\-\s+([a-zA-Z0-9._-]+):.*\(file:\s*([^)]+)\)\s*$/;
  const rememberSkill = async (name, rawPath) => {
    const key = name.toLowerCase();
    if (!key || catalog.has(key)) return;
    const absolutePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(repoRoot, rawPath);
    let text = null;
    let loaded = false;
    try {
      text = await fs.readFile(absolutePath, "utf8");
      loaded = true;
    } catch {
      text = null;
      loaded = false;
    }
    catalog.set(key, {
      name,
      path: rawPath,
      text,
      loaded,
    });
  };

  for (const line of lines) {
    const match = line.match(skillPattern);
    if (!match) continue;

    const name = asString(match[1]);
    const rawPath = asString(match[2]);
    if (!name || !rawPath) continue;
    await rememberSkill(name, rawPath);
  }

  const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex");
  const localSkillsRoot = path.join(codexHome, "skills");
  try {
    const skillFiles = (await walkFiles(localSkillsRoot)).filter((file) => path.basename(file) === "SKILL.md");
    for (const file of skillFiles) {
      const text = await fs.readFile(file, "utf8");
      const frontmatterName = asString(text.match(/^\s*name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]);
      const dirName = path.basename(path.dirname(file));
      const candidateNames = [frontmatterName, dirName].filter(Boolean);
      for (const candidate of candidateNames) {
        const key = candidate.toLowerCase();
        if (catalog.has(key)) continue;
        catalog.set(key, {
          name: candidate,
          path: file,
          text,
          loaded: true,
        });
      }
    }
  } catch {
    // Local skills folder may be unavailable in CI; keep catalog from AGENTS only.
  }

  return catalog;
}

function c4ViewTitleMap(c4Dsl) {
  const lines = c4Dsl.replace(/\r/g, "").split("\n");
  const titles = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    const viewMatch = lines[i].match(/^\s*view\s+([a-zA-Z0-9_]+)\b/);
    if (!viewMatch) continue;
    const viewId = viewMatch[1];
    let title = viewId;
    for (let j = i + 1; j < Math.min(lines.length, i + 20); j += 1) {
      const titleMatch = lines[j].match(/^\s*title\s+"([^"]+)"/);
      if (titleMatch) {
        title = titleMatch[1].trim();
        break;
      }
      if (/^\s*view\s+[a-zA-Z0-9_]+\b/.test(lines[j])) break;
    }
    titles.set(viewId, title);
  }
  return titles;
}

async function buildDocsIndex() {
  const docsRoot = path.join(repoRoot, "docs");
  const specRoot = path.join(repoRoot, ".specify", "specs", preferredSpecDir);
  try {
    const stat = await fs.stat(specRoot);
    if (!stat.isDirectory()) throw new Error("not_a_directory");
  } catch {
    throw new Error(`missing_spec_root:.specify/specs/${preferredSpecDir}`);
  }
  const agentsFile = path.join(repoRoot, "AGENTS.md");

  const docsFiles = (await walkFiles(docsRoot)).map((f) => ({ file: f, section: "docs" }));
  const specFiles = (await walkFiles(specRoot)).map((f) => ({ file: f, section: "specify" }));
  const allFiles = [...docsFiles, ...specFiles, { file: agentsFile, section: "agents" }];
  const repoBrowseBase = resolveRepoBrowseBase();
  const repoRef = resolveRepoRef();

  const documents = [];
  for (const entry of allFiles) {
    const content = await fs.readFile(entry.file, "utf8");
    const relPath = path.relative(repoRoot, entry.file).replace(/\\/g, "/");
    const parsed = parseMarkdownInfo(content);
    const fallbackUpdatedAt = (await fs.stat(entry.file)).mtime.toISOString();
    const updatedAt = gitLastUpdatedAt(relPath) || fallbackUpdatedAt;
    documents.push({
      id: fileIdFromPath(relPath),
      title: parsed.title,
      path: relPath,
      sourceUrl: sourceUrlForPath(relPath, repoBrowseBase, repoRef),
      section: entry.section,
      headings: parsed.headings,
      updatedAt,
      content,
    });
  }

  documents.sort((a, b) => a.path.localeCompare(b.path));
  return documents;
}

async function buildBpmnManifest() {
  const sourceDir = path.join(repoRoot, "docs", "bpmn");
  const publicBpmnDir = path.join(publicDir, "bpmn");
  await ensureDir(publicBpmnDir);

  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const diagrams = [];
  const repoBrowseBase = resolveRepoBrowseBase();
  const repoRef = resolveRepoRef();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".bpmn")) continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const content = await fs.readFile(sourcePath, "utf8");
    const processMatch = content.match(/<bpmn:process[^>]*\sname="([^"]+)"/i);
    const processIdMatch = content.match(/<bpmn:process[^>]*\sid="([^"]+)"/i);
    const relSourcePath = `docs/bpmn/${entry.name}`;
    const stat = await fs.stat(sourcePath);
    const updatedAt = gitLastUpdatedAt(relSourcePath) || stat.mtime.toISOString();
    await copyFile(sourcePath, path.join(publicBpmnDir, entry.name));

    const fileStem = entry.name.replace(/\.bpmn$/i, "");
    diagrams.push({
      id: fileStem,
      title: processMatch?.[1] || fileStem,
      processName: processMatch?.[1] || null,
      processId: processIdMatch?.[1] || null,
      filePath: `/bpmn/${entry.name}`,
      sourcePath: relSourcePath,
      sourceUrl: sourceUrlForPath(relSourcePath, repoBrowseBase, repoRef),
      updatedAt,
    });
  }

  diagrams.sort((a, b) => a.id.localeCompare(b.id));
  return diagrams;
}

async function buildC4Manifest() {
  const c4Path = path.join(repoRoot, "docs", "oap.c4");
  const c4PublicDir = path.join(publicDir, "c4");
  const c4StatusPath = path.join(outDir, "c4-export-status.json");
  const c4Dsl = await fs.readFile(c4Path, "utf8");
  const titles = c4ViewTitleMap(c4Dsl);
  const availableViews = new Set(titles.keys());

  for (const viewId of requiredC4Views) {
    if (!availableViews.has(viewId)) {
      throw new Error(`required_c4_view_missing:${viewId}`);
    }
  }

  const workspaceId = process.env.OPS_LIKEC4_WORKSPACE_ID || "gyQEJw";
  let status = { validatedAt: null, exportedAt: null, exportError: null };
  try {
    status = JSON.parse(await fs.readFile(c4StatusPath, "utf8"));
  } catch {
    // Keep defaults for first run or when export step is skipped.
  }

  const views = [];
  for (const viewId of requiredC4Views) {
    const workspaceLink = `https://playground.likec4.dev/w/${workspaceId}/${viewId}/`;
    const pngPath = path.join(c4PublicDir, `${viewId}.png`);
    let pngAvailable = false;
    try {
      pngAvailable = Boolean((await fs.stat(pngPath)).isFile());
    } catch {
      pngAvailable = false;
    }
    views.push({
      id: viewId,
      title: titles.get(viewId) || viewId,
      description: c4ViewDescriptions[viewId] || "",
      pngPath: `/c4/${viewId}.png`,
      pngAvailable,
      playgroundUrl: workspaceLink,
    });
  }

  return {
    dslSourcePath: "docs/oap.c4",
    dsl: c4Dsl,
    validatedAt: status.validatedAt,
    exportedAt: status.exportedAt,
    exportError: status.exportError,
    views,
  };
}

function buildSearchIndex(documents) {
  return {
    updatedAt: new Date().toISOString(),
    documents: documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      path: doc.path,
      section: doc.section,
      headings: doc.headings,
      searchText: normalizeWhitespace(`${doc.title}\n${doc.headings.join("\n")}\n${doc.content}`.toLowerCase()),
    })),
  };
}

function buildOapKbSearchIndex(documents) {
  return buildSearchIndex(documents);
}

function normalizeTasks(value, ctx) {
  const source = value && typeof value === "object" ? value : {};
  const tasks = {
    queued: asNumber(source.queued),
    running: asNumber(source.running),
    retrying: asNumber(source.retrying),
    waiting_review: asNumber(source.waiting_review),
    blocked: asNumber(source.blocked),
    waiting_external: asNumber(source.waiting_external),
    overdue: asNumber(source.overdue),
  };

  const inWork = tasks.queued + tasks.running + tasks.retrying;
  const onControl = tasks.waiting_review + tasks.blocked + tasks.waiting_external;
  if (Number.isNaN(inWork) || Number.isNaN(onControl)) {
    throw new Error(`invalid_tasks_metrics:${ctx}`);
  }

  return { ...tasks, in_work: inWork, on_control: onControl };
}

function normalizeRepositories(value, ctx) {
  const repositories = Array.isArray(value) ? value : [];
  return repositories.map((repo, index) => {
    const name = asString(repo?.name);
    const url = asString(repo?.url);
    const branch = asString(repo?.branch);

    assert(name.length > 0, `invalid_repository_name:${ctx}:${index}`);
    assert(url.length > 0, `invalid_repository_url:${ctx}:${index}`);
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      throw new Error(`invalid_repository_url_format:${ctx}:${index}`);
    }

    return { name, url, branch: branch || null };
  });
}

function normalizeMcpServers(value, ctx) {
  const servers = Array.isArray(value) ? value : [];
  return servers.map((server, index) => {
    const name = asString(server?.name);
    const rawStatus = asString(server?.status).toLowerCase();
    const status = mcpStatuses.has(rawStatus) ? rawStatus : "offline";

    assert(name.length > 0, `invalid_mcp_name:${ctx}:${index}`);
    return { name, status };
  });
}

function normalizeUsedMcp(value, ctx) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const name = asString(item?.name);
    const rawStatus = asString(item?.status).toLowerCase();
    const status = usedMcpStatuses.has(rawStatus) ? rawStatus : "offline";
    const note = asString(item?.note) || null;
    const impactInNumbers = asString(item?.impactInNumbers) || null;
    const lastUsedAt = asString(item?.lastUsedAt) || null;
    const practicalTasks = Array.isArray(item?.practicalTasks)
      ? item.practicalTasks.map((task) => asString(task)).filter(Boolean)
      : [];
    const decisionGuidance = normalizeDecisionGuidance(item?.decisionGuidance, {
      purpose: note,
      useWhen: practicalTasks[0] || null,
      expectedOutput: impactInNumbers,
      examples: practicalTasks,
    });
    const qualitySignals = normalizeCapabilityQualitySignals(item?.qualitySignals, decisionGuidance, "keep_current");
    assert(name.length > 0, `invalid_used_mcp_name:${ctx}:${index}`);
    return { name, status, note, impactInNumbers, practicalTasks, lastUsedAt, decisionGuidance, qualitySignals };
  });
}

function normalizeAvailableMcp(value, ctx) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const name = asString(item?.name);
    const whyUseful = asString(item?.whyUseful) || null;
    const description = asString(item?.description) || null;
    const whenToUse = asString(item?.whenToUse) || null;
    const expectedEffect = asString(item?.expectedEffect) || null;
    const basis = asString(item?.basis) || null;
    const practicalTasks = Array.isArray(item?.practicalTasks)
      ? item.practicalTasks.map((task) => asString(task)).filter(Boolean)
      : [];
    const link = asString(item?.link) || null;
    const installComplexity = asString(item?.installComplexity) || null;
    const decisionGuidance = normalizeDecisionGuidance(item?.decisionGuidance, {
      purpose: description,
      useWhen: whenToUse,
      expectedOutput: expectedEffect,
      examples: practicalTasks,
    });
    const qualitySignals = normalizeCapabilityQualitySignals(item?.qualitySignals, decisionGuidance, "keep_current");
    assert(name.length > 0, `invalid_available_mcp_name:${ctx}:${index}`);
    return {
      name,
      whyUseful,
      description,
      whenToUse,
      expectedEffect,
      basis,
      practicalTasks,
      link,
      installComplexity,
      decisionGuidance,
      qualitySignals,
    };
  });
}

function normalizeContextRefs(value, ctx, repoBrowseBase, repoRef) {
  const refs = Array.isArray(value) ? value : [];
  return refs.map((entry, index) => {
    const title = asString(entry?.title);
    const filePath = asString(entry?.filePath);
    const pathHint = asString(entry?.pathHint) || null;
    const explicitSourceUrl = asString(entry?.sourceUrl) || null;

    assert(title.length > 0, `invalid_context_ref_title:${ctx}:${index}`);
    assert(filePath.length > 0, `invalid_context_ref_file_path:${ctx}:${index}`);

    let sourceUrl = explicitSourceUrl;
    if (sourceUrl) {
      try {
        // eslint-disable-next-line no-new
        new URL(sourceUrl);
      } catch {
        throw new Error(`invalid_context_ref_source_url:${ctx}:${index}`);
      }
    } else {
      sourceUrl = sourceUrlForPath(filePath, repoBrowseBase, repoRef);
    }

    return { title, filePath, pathHint, sourceUrl: sourceUrl || null };
  });
}

function normalizeUsedSkills(value, ctx, skillCatalog) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const name = asString(item?.name);
    const usage = asString(item?.usage) || null;
    const practicalTasks = Array.isArray(item?.practicalTasks)
      ? item.practicalTasks.map((task) => asString(task)).filter(Boolean)
      : [];
    const lastUsedAt = asString(item?.lastUsedAt) || null;
    assert(name.length > 0, `invalid_used_skill_name:${ctx}:${index}`);
    const catalog = skillCatalog.get(name.toLowerCase()) || null;
    const skillFilePath = catalog?.path || null;
    const skillFileText = catalog?.text || null;
    const skillFileLoaded = catalog?.loaded === true;
    assert(skillFilePath && /(^|[/\\])SKILL\.md$/i.test(skillFilePath), `used_skill_missing_skill_md:${ctx}:${name}`);
    assert(skillFileLoaded && asString(skillFileText).length > 0, `used_skill_unresolved_text:${ctx}:${name}`);
    const fullText = skillFileText;
    const decisionGuidance = normalizeDecisionGuidance(item?.decisionGuidance, {
      purpose: usage,
      useWhen: practicalTasks[0] || null,
      expectedOutput: fullText,
      examples: practicalTasks,
    });
    const qualitySignals = normalizeCapabilityQualitySignals(item?.qualitySignals, decisionGuidance, "keep_current");
    return {
      name,
      usage,
      fullText,
      practicalTasks,
      lastUsedAt,
      skillFilePath,
      skillFileText,
      skillFileLoaded,
      decisionGuidance,
      qualitySignals,
    };
  });
}

function normalizeAvailableSkills(value, ctx) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const name = asString(item?.name);
    const benefit = asString(item?.benefit) || null;
    const recommendationBasis = asString(item?.recommendationBasis) || null;
    const expectedEffect = asString(item?.expectedEffect) || null;
    const fullText = asString(item?.fullText) || null;
    const practicalTasks = Array.isArray(item?.practicalTasks)
      ? item.practicalTasks.map((task) => asString(task)).filter(Boolean)
      : [];
    const link = asString(item?.link) || null;
    const decisionGuidance = normalizeDecisionGuidance(item?.decisionGuidance, {
      purpose: benefit,
      useWhen: recommendationBasis,
      expectedOutput: expectedEffect,
      examples: practicalTasks,
    });
    const qualitySignals = normalizeCapabilityQualitySignals(item?.qualitySignals, decisionGuidance, "trial_alternative");
    assert(name.length > 0, `invalid_available_skill_name:${ctx}:${index}`);
    return { name, benefit, recommendationBasis, expectedEffect, fullText, practicalTasks, link, decisionGuidance, qualitySignals };
  });
}

function normalizeUsedTools(value, ctx) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const name = asString(item?.name);
    const usage = asString(item?.usage) || null;
    const fullText = asString(item?.fullText) || null;
    const source = asString(item?.source) || null;
    const practicalTasks = Array.isArray(item?.practicalTasks)
      ? item.practicalTasks.map((task) => asString(task)).filter(Boolean)
      : [];
    const lastUsedAt = asString(item?.lastUsedAt) || null;
    const decisionGuidance = normalizeDecisionGuidance(item?.decisionGuidance, {
      purpose: usage,
      useWhen: practicalTasks[0] || null,
      expectedOutput: fullText,
      examples: practicalTasks,
    });
    const qualitySignals = normalizeCapabilityQualitySignals(item?.qualitySignals, decisionGuidance, "keep_current");
    assert(name.length > 0, `invalid_used_tool_name:${ctx}:${index}`);
    assert(Boolean(usage), `invalid_used_tool_usage:${ctx}:${index}`);
    assert(Boolean(fullText), `invalid_used_tool_full_text:${ctx}:${index}`);
    assert(Boolean(source), `invalid_used_tool_source:${ctx}:${index}`);
    return { name, usage, fullText, source, practicalTasks, lastUsedAt, decisionGuidance, qualitySignals };
  });
}

function normalizeAvailableTools(value, ctx) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const name = asString(item?.name);
    const benefit = asString(item?.benefit) || null;
    const recommendationBasis = asString(item?.recommendationBasis) || null;
    const expectedEffect = asString(item?.expectedEffect) || null;
    const fullText = asString(item?.fullText) || null;
    const source = asString(item?.source) || null;
    const practicalTasks = Array.isArray(item?.practicalTasks)
      ? item.practicalTasks.map((task) => asString(task)).filter(Boolean)
      : [];
    const decisionGuidance = normalizeDecisionGuidance(item?.decisionGuidance, {
      purpose: benefit,
      useWhen: recommendationBasis,
      expectedOutput: expectedEffect,
      examples: practicalTasks,
    });
    const qualitySignals = normalizeCapabilityQualitySignals(item?.qualitySignals, decisionGuidance, "trial_alternative");
    assert(name.length > 0, `invalid_available_tool_name:${ctx}:${index}`);
    assert(Boolean(benefit), `invalid_available_tool_benefit:${ctx}:${index}`);
    assert(Boolean(recommendationBasis), `invalid_available_tool_recommendation_basis:${ctx}:${index}`);
    assert(Boolean(expectedEffect), `invalid_available_tool_expected_effect:${ctx}:${index}`);
    assert(Boolean(fullText), `invalid_available_tool_full_text:${ctx}:${index}`);
    assert(Boolean(source), `invalid_available_tool_source:${ctx}:${index}`);
    return { name, benefit, recommendationBasis, expectedEffect, fullText, source, practicalTasks, decisionGuidance, qualitySignals };
  });
}

function normalizeTaskEvents(value, ctx) {
  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const id = asString(item?.id) || `${ctx}-task-${index + 1}`;
    const title = asString(item?.title) || `Task ${index + 1}`;
    const completedAt = asString(item?.completedAt);
    const reviewErrors = asNumber(item?.reviewErrors);
    assert(completedAt.length > 0, `invalid_task_event_completed_at:${ctx}:${index}`);
    return { id, title, completedAt, reviewErrors };
  });
}

function normalizeAnalystRecommendations(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function normalizeRulesApplied(value, ctx, contextRefs, docsByPath) {
  const list = Array.isArray(value) ? value : [];
  const normalized = list.map((item, index) => {
    const title = asString(item?.title) || `Правило ${index + 1}`;
    const location = asString(item?.location) || null;
    const description = asString(item?.description) || null;
    const doc = location ? docsByPath.get(normalizePath(location)) : null;
    const fullText = asString(item?.fullText) || doc?.content || null;
    const sourceUrl = asString(item?.sourceUrl) || doc?.sourceUrl || null;
    const decisionGuidance = normalizeDecisionGuidance(item?.decisionGuidance, {
      purpose: description,
      useWhen: description,
      expectedOutput: fullText,
      examples: location ? [location] : [],
    });
    const qualitySignals = normalizeCapabilityQualitySignals(item?.qualitySignals, decisionGuidance, "keep_current");
    return { title, location, description, fullText, sourceUrl, decisionGuidance, qualitySignals };
  }).filter((item) => item.location || item.description || item.fullText);

  const modernPlanRule = MODERN_AGENT_PLAN_RULES[ctx];
  if (modernPlanRule) {
    const hasOperatingPlanRule = normalized.some((item) => normalizePath(item.location || "") === normalizePath(modernPlanRule.path));
    if (!hasOperatingPlanRule) {
      const doc = docsByPath.get(normalizePath(modernPlanRule.path));
      normalized.push({
        title: modernPlanRule.title,
        location: modernPlanRule.path,
        description: modernPlanRule.description,
        fullText: doc?.content || null,
        sourceUrl: doc?.sourceUrl || null,
        decisionGuidance: normalizeDecisionGuidance(null, {
          purpose: modernPlanRule.description,
          useWhen: "Использовать как основной operating plan для текущего агента.",
          expectedOutput: doc?.content || null,
          examples: [modernPlanRule.path],
        }),
        qualitySignals: normalizeCapabilityQualitySignals(null, normalizeDecisionGuidance(null, {
          purpose: modernPlanRule.description,
          useWhen: "Использовать как основной operating plan для текущего агента.",
          expectedOutput: doc?.content || null,
          examples: [modernPlanRule.path],
        }), "keep_current"),
      });
    }
  }

  if (normalized.length > 0) {
    return normalized;
  }

  const fallback = contextRefs.map((entry, index) => {
    const location = asString(entry?.filePath) || null;
    const doc = location ? docsByPath.get(normalizePath(location)) : null;
    return {
      title: asString(entry?.title) || `Правило ${index + 1}`,
      location,
      description: asString(entry?.pathHint) || `Источник: ${asString(entry?.title) || "contextRef"}`,
      fullText: doc?.content || null,
      sourceUrl: asString(entry?.sourceUrl) || doc?.sourceUrl || null,
      decisionGuidance: normalizeDecisionGuidance(null, {
        purpose: asString(entry?.pathHint) || asString(entry?.title),
        useWhen: asString(entry?.pathHint) || null,
        expectedOutput: doc?.content || null,
        examples: location ? [location] : [],
      }),
      qualitySignals: normalizeCapabilityQualitySignals(null, normalizeDecisionGuidance(null, {
        purpose: asString(entry?.pathHint) || asString(entry?.title),
        useWhen: asString(entry?.pathHint) || null,
        expectedOutput: doc?.content || null,
        examples: location ? [location] : [],
      }), "keep_current"),
    };
  });

  fallback.push({
    title: "Глобальные правила платформы",
    location: "Codex runtime system/developer instructions",
    description: "Системные инструкции среды выполнения (вне репозитория).",
    fullText: "Глобальные правила применяются на уровне платформы во время выполнения задач.",
    sourceUrl: null,
    decisionGuidance: normalizeDecisionGuidance(null, {
      purpose: "Платформенные ограничения и базовые инструкции runtime.",
      useWhen: "Применяется ко всем задачам как внешний governance-layer.",
      expectedOutput: "Безопасное и корректное поведение агента в пределах runtime.",
      examples: ["Codex runtime system/developer instructions"],
    }),
    qualitySignals: normalizeCapabilityQualitySignals(null, normalizeDecisionGuidance(null, {
      purpose: "Платформенные ограничения и базовые инструкции runtime.",
      useWhen: "Применяется ко всем задачам как внешний governance-layer.",
      expectedOutput: "Безопасное и корректное поведение агента в пределах runtime.",
      examples: ["Codex runtime system/developer instructions"],
    }), "keep_current"),
  });

  return fallback;
}

function normalizeImprovements(value, ctx, repoBrowseBase, repoRef) {
  const now = new Date();

  function inferTargetMetric(sectionValue) {
    const section = asString(sectionValue).toLowerCase();
    if (/mcp|интеграц/.test(section)) return "mcp_online_ratio";
    if (/навык|правил/.test(section)) return "recommendation_action_rate";
    if (/задач|качеств|review/.test(section)) return "review_error_rate";
    if (/памят|контекст/.test(section)) return "p95_time_to_context";
    return "recommendation_action_rate";
  }

  const list = Array.isArray(value) ? value : [];
  return list.map((item, index) => {
    const title = asString(item?.title);
    const problem = asString(item?.problem);
    const solution = asString(item?.solution);
    const effect = asString(item?.effect);
    const priority = asString(item?.priority) || "Средний";
    const section = asString(item?.section) || inferImprovementSection(title, problem, solution, effect);
    const ownerSection = asString(item?.ownerSection) || section;
    const detectionBasis = asString(item?.detectionBasis) || "Выявлено по задачам, review-ошибкам и telemetry за период.";
    const promptPath = asString(item?.promptPath) || "docs/subservices/oap/README.md";
    const promptTitle = asString(item?.promptTitle) || `Промт для внедрения: ${title}`;
    const promptMarkdown = asString(item?.promptMarkdown)
      || [
        `# ${promptTitle}`,
        "",
        "Цель:",
        `- ${effect || "Повысить эффективность работы агента."}`,
        "",
        "Контекст:",
        `- Точка роста: ${problem || "не зафиксировано"}`,
        `- Основание: ${detectionBasis}`,
        "",
        "Решение:",
        `- ${solution || "Сформируйте исполнимый план и внедрите по шагам."}`,
      ].join("\n");
    const explicitPromptSourceUrl = asString(item?.promptSourceUrl) || null;
    const promptSourceUrl = explicitPromptSourceUrl
      || (promptPath ? sourceUrlForPath(promptPath, repoBrowseBase, repoRef) : "unknown");
    const targetMetric = asString(item?.targetMetric) || inferTargetMetric(ownerSection);
    const baselineWindow = asString(item?.baselineWindow) || "last_14_days";
    const expectedDelta = asString(item?.expectedDelta) || ">= 10% improvement vs baseline.";
    const validationDate = asString(item?.validationDate) || withDaysOffset(now, 14);
    const rawIce = item?.ice && typeof item.ice === "object" ? item.ice : null;
    const fallbackIceSeed = priorityToIceSeed(priority);
    const ice = {
      impact: normalizeIceValue(rawIce?.impact, fallbackIceSeed),
      confidence: normalizeIceValue(rawIce?.confidence, fallbackIceSeed),
      ease: normalizeIceValue(rawIce?.ease, fallbackIceSeed - 1),
    };
    assert(title.length > 0, `invalid_improvement_title:${ctx}:${index}`);
    assert(problem.length > 0, `invalid_improvement_problem:${ctx}:${index}`);
    assert(solution.length > 0, `invalid_improvement_solution:${ctx}:${index}`);
    assert(effect.length > 0, `invalid_improvement_effect:${ctx}:${index}`);
    return {
      title,
      problem,
      solution,
      effect,
      priority,
      section,
      ownerSection,
      detectionBasis,
      promptPath,
      promptTitle,
      promptMarkdown,
      promptSourceUrl,
      targetMetric,
      baselineWindow,
      expectedDelta,
      validationDate,
      ice,
    };
  });
}

function normalizeOperatingPlan(value, ctx) {
  if (!MODERN_AGENT_IDS.has(ctx)) return null;

  const isDesigner = ctx === "designer-agent";

  const source = value && typeof value === "object" ? value : {};
  const sourcePolicy = source?.sourcePolicy && typeof source.sourcePolicy === "object" ? source.sourcePolicy : {};
  const notificationPolicy = source?.notificationPolicy && typeof source.notificationPolicy === "object" ? source.notificationPolicy : {};
  const metricsCatalog = source?.metricsCatalog && typeof source.metricsCatalog === "object" ? source.metricsCatalog : {};

  const mission = asString(source?.mission)
    || (isDesigner
      ? "Обеспечивать понятный, единообразный и проверяемый UX во всех UI-изменениях ОАП."
      : "Повышать эффективность всей агентной системы через проверяемые evidence-based улучшения.");
  const dailyLoop = Array.isArray(source?.dailyLoop) && source.dailyLoop.length > 0
    ? source.dailyLoop.map((item) => asString(item)).filter(Boolean)
    : (isDesigner ? [
        "started: запуск дизайн-цикла с telemetry run",
        "Проверка входящих UI-изменений на соответствие UI kit",
        "Проверка информационной иерархии: важное видно сразу, детали через progressive disclosure",
        "Проверка понятности терминов и действий для пользователя",
        "Добавление tooltip/inline-help в неоднозначных местах",
        "Проверка консистентности состояний и интеракций компонентов",
        "Формирование обязательных UX-рекомендаций",
        "Проверка эффекта по UX-метрикам и review feedback",
        "completed: закрытие цикла с фиксацией результатов",
      ] : [
        "started: запуск ежедневного цикла с telemetry run",
        "Health-check каждого агента: статус, задачи, review-ошибки, MCP-деградации",
        "Проверка актуальности базы знаний ОАП (spec/contracts/rules/runbook)",
        "Мониторинг внешних источников из whitelist",
        "Сверка новых практик с текущей базой знаний",
        "Формирование списка улучшений по каждому агенту",
        "Приоритизация и выбор top-priority для внедрения",
        "Внедрение выбранных улучшений",
        "Проверка эффекта и регрессий",
        "Обновление раздела Задачи и качество + telemetry",
        "Уведомления: критичные сразу, остальное в daily digest",
      ]);

  const sourcePolicyWhitelist = Array.isArray(sourcePolicy?.whitelist) && sourcePolicy.whitelist.length > 0
    ? sourcePolicy.whitelist.map((item) => asString(item)).filter(Boolean)
    : (isDesigner ? [
        "Material 3 official sources",
        "Официальные docs MUI",
        "Внутренние правила ОАП (README + DESIGN_RULES + operating plans)",
      ] : [
        "Официальные источники вендоров (OpenAI, Anthropic, официальные docs/changelog)",
        "Проверенные крупные open-source практики (включая OpenClaw-подобные)",
      ]);

  const sourcePolicyValidationCriteria = Array.isArray(sourcePolicy?.validationCriteria) && sourcePolicy.validationCriteria.length > 0
    ? sourcePolicy.validationCriteria.map((item) => asString(item)).filter(Boolean)
    : (isDesigner
      ? ["соответствие UI kit", "понятность интерфейса", "измеримый UX-эффект"]
      : ["качество сигнала", "воспроизводимость", "подтвержденный практический эффект"]);

  const improvementLifecycle = Array.isArray(source?.improvementLifecycle) && source.improvementLifecycle.length > 0
    ? source.improvementLifecycle.map((item) => asString(item)).filter(Boolean)
    : ["suggested", "validated", "scheduled", "applied", "verified", "deferred", "rejected", "archived"];

  const decisionRules = Array.isArray(source?.decisionRules) && source.decisionRules.length > 0
    ? source.decisionRules.map((item) => asString(item)).filter(Boolean)
    : (isDesigner ? [
        "UI-изменение без проверки на UI kit не переводится в done.",
        "Если термин/метрика может трактоваться неоднозначно, нужен tooltip или inline-help.",
        "На первый экран карточки выносится только приоритетная и понятная информация.",
        "Решения принимаются только при наличии проверяемого UX-эффекта.",
      ] : [
        "Улучшение без evidence и target metric не переводится в applied.",
        "Сначала формируется полный список улучшений, затем внедряется top-priority.",
        "Остальные улучшения остаются в backlog с датой пересмотра.",
        "Приоритет определяется PriorityScore = ICE + evidence_strength + section_risk.",
      ]);

  return {
    mission,
    dailyLoop,
    sourcePolicy: {
      mode: asString(sourcePolicy?.mode) || "whitelist + verification",
      whitelist: sourcePolicyWhitelist,
      updateRule: asString(sourcePolicy?.updateRule) || (isDesigner
        ? "Новые UX-паттерны принимаются только после проверки совместимости с UI kit и usability."
        : "Новые источники добавляются только после проверки качества, воспроизводимости и эффекта."),
      validationCriteria: sourcePolicyValidationCriteria,
    },
    notificationPolicy: {
      mode: asString(notificationPolicy?.mode) || "critical + daily_digest",
      criticalCases: Array.isArray(notificationPolicy?.criticalCases) && notificationPolicy.criticalCases.length > 0
        ? notificationPolicy.criticalCases.map((item) => asString(item)).filter(Boolean)
        : (isDesigner
          ? ["UI-изменение нарушает UI kit", "Ключевой сценарий пользователя стал менее понятным", "Отсутствуют обязательные подсказки в неоднозначных местах"]
          : ["P0/P1 инциденты", "блокеры внедрения", "риски деградации production-процессов"]),
      digestFields: Array.isArray(notificationPolicy?.digestFields) && notificationPolicy.digestFields.length > 0
        ? notificationPolicy.digestFields.map((item) => asString(item)).filter(Boolean)
        : (isDesigner
          ? ["что проверено", "что исправлено", "что отложено", "где требуются продуктовые решения"]
          : ["что проверено", "что внедрено", "что отложено", "что требует решения владельца"]),
    },
    improvementLifecycle,
    metricsCatalog: {
      agents: Array.isArray(metricsCatalog?.agents) && metricsCatalog.agents.length > 0
        ? metricsCatalog.agents.map((item) => asString(item)).filter(Boolean)
        : (isDesigner
          ? ["review_error_rate", "tasks_in_work", "tasks_on_control", "overdue", "recommendation_action_rate", "regression_rate"]
          : ["review_error_rate", "TQS_avg", "tasks_in_work", "tasks_on_control", "overdue", "recommendation_action_rate", "regression_rate", "p95_time_to_context"]),
      analyst: Array.isArray(metricsCatalog?.analyst) && metricsCatalog.analyst.length > 0
        ? metricsCatalog.analyst.map((item) => asString(item)).filter(Boolean)
        : (isDesigner
          ? ["ui_kit_compliance_rate", "ux_clarity_score", "tooltip_coverage_rate", "interaction_consistency_rate", "design_review_reopen_rate"]
          : ["agents_reviewed_daily", "recommendation_precision", "recommendation_action_rate", "validated_impact_rate", "stale_recommendations"]),
    },
    decisionRules,
  };
}

function normalizeWorkflowPolicy(value, ctx) {
  const source = value && typeof value === "object" ? value : {};
  return {
    planDefault: typeof source?.planDefault === "boolean" ? source.planDefault : true,
    replanOnDeviation: typeof source?.replanOnDeviation === "boolean" ? source.replanOnDeviation : true,
    verifyBeforeDone: typeof source?.verifyBeforeDone === "boolean" ? source.verifyBeforeDone : true,
    selfImprovementLoop: typeof source?.selfImprovementLoop === "boolean" ? source.selfImprovementLoop : true,
    autonomousBugfix: typeof source?.autonomousBugfix === "boolean" ? source.autonomousBugfix : true,
  };
}

function normalizeWorkflowBackbone(value, ctx) {
  const source = value && typeof value === "object" ? value : {};
  const defaultCoreSteps = [
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
  const defaultRoleStepsByAgent = {
    "analyst-agent": [
      "role_collect_quality_signals",
      "role_score_candidates",
      "role_select_priority",
    ],
    "designer-agent": [
      "role_review_ui_kit",
      "role_review_clarity",
      "role_prepare_design_actions",
    ],
    "reader-agent": [
      "role_collect_sources",
      "role_synthesize_answer",
      "role_check_coverage",
    ],
    "data-agent": [
      "role_check_dataset_quality",
      "role_analyze_drift",
      "role_prepare_data_action",
    ],
    "ops-agent": [
      "role_triage_operation",
      "role_select_runbook_action",
      "role_prepare_ops_resolution",
    ],
  };
  const defaultPurposeByAgent = {
    "analyst-agent": "Выполнить evidence-based анализ кандидатов и вернуть decision package по улучшениям.",
    "designer-agent": "Выполнить UX/UI-проверку и вернуть пакет дизайн-действий и verify-требований.",
    "reader-agent": "Собрать, синтезировать и упаковать ответ по релевантному контексту.",
    "data-agent": "Проверить качество данных и вернуть пакет действий по ETL или quality-control.",
    "ops-agent": "Разобрать операционный инцидент или change-request и вернуть runbook-based action package.",
  };
  const version = asString(source?.version) || "universal_backbone_v1";
  const commonCoreSteps = normalizeStringArray(source?.commonCoreSteps);
  const roleWindowSource = source?.roleWindow && typeof source.roleWindow === "object" ? source.roleWindow : {};
  const stepExecutionPolicySource = source?.stepExecutionPolicy && typeof source.stepExecutionPolicy === "object"
    ? source.stepExecutionPolicy
    : {};
  const roleWindow = {
    entryStep: asString(roleWindowSource?.entryStep) || "step_5_role_window",
    exitStep: asString(roleWindowSource?.exitStep) || "step_6_role_exit_decision",
    purpose: asString(roleWindowSource?.purpose) || defaultPurposeByAgent[ctx]
      || "Выполнить доменную логику агента в bounded role window и вернуть нормализованный result package.",
    internalSteps: normalizeStringArray(roleWindowSource?.internalSteps).length > 0
      ? normalizeStringArray(roleWindowSource?.internalSteps)
      : (defaultRoleStepsByAgent[ctx] || [
          "role_analyze_domain_task",
          "role_execute_domain_logic",
          "role_prepare_result_package",
        ]),
  };
  const stepExecutionPolicy = {
    skippedStepsAllowed: typeof stepExecutionPolicySource?.skippedStepsAllowed === "boolean"
      ? stepExecutionPolicySource.skippedStepsAllowed
      : true,
    skippedStepStatus: asString(stepExecutionPolicySource?.skippedStepStatus) || "skipped",
  };

  assert(version === "universal_backbone_v1", `invalid_workflow_backbone_version:${ctx}`);
  assert(roleWindow.entryStep.length > 0, `invalid_workflow_backbone_role_entry:${ctx}`);
  assert(roleWindow.exitStep.length > 0, `invalid_workflow_backbone_role_exit:${ctx}`);
  assert(stepExecutionPolicy.skippedStepStatus === "skipped", `invalid_workflow_backbone_skip_status:${ctx}`);

  return {
    version,
    commonCoreSteps: commonCoreSteps.length > 0 ? commonCoreSteps : defaultCoreSteps,
    roleWindow,
    stepExecutionPolicy,
    supportsDynamicInstances: typeof source?.supportsDynamicInstances === "boolean" ? source.supportsDynamicInstances : true,
  };
}

function normalizeCapabilityOptimization(value, ctx) {
  const source = value && typeof value === "object" ? value : {};
  const refreshMode = asString(source?.refreshMode) || "on_run";
  const sourcePolicy = asString(source?.sourcePolicy) || "official_first";
  const trialMode = asString(source?.trialMode) || "shadow";
  const promotionMode = asString(source?.promotionMode) || "human_approve";
  const minShadowSampleSize = Math.max(1, asNumber(source?.minShadowSampleSize) || 3);
  const staleAfterHours = Math.max(1, asNumber(source?.staleAfterHours) || 168);

  assert(refreshMode === "on_run", `invalid_capability_refresh_mode:${ctx}`);
  assert(sourcePolicy === "official_first", `invalid_capability_source_policy:${ctx}`);
  assert(trialMode === "shadow", `invalid_capability_trial_mode:${ctx}`);
  assert(promotionMode === "human_approve", `invalid_capability_promotion_mode:${ctx}`);

  return {
    enabled: typeof source?.enabled === "boolean" ? source.enabled : true,
    refreshMode,
    sourcePolicy,
    trialMode,
    promotionMode,
    minShadowSampleSize,
    staleAfterHours,
  };
}

function normalizeSnapshotCandidate(value, ctx, skillSourceRegistry) {
  if (!value || typeof value !== "object") return null;
  const [candidate] = normalizeExternalSkillCandidates([value], ctx, skillSourceRegistry);
  return candidate || null;
}

function normalizeSnapshotTrial(value) {
  if (!value || typeof value !== "object") return null;
  return {
    trialId: asString(value?.trial_id || value?.trialId),
    candidateId: asString(value?.candidate_id || value?.candidateId),
    candidateName: asString(value?.candidate_name || value?.candidateName),
    sourceTitle: asString(value?.source?.title || value?.sourceTitle),
    sourceUrl: asString(value?.source?.url || value?.sourceUrl) || null,
    sourceTrust: asString(value?.source?.trust || value?.sourceTrust) || "unknown",
    baselineSkillName: asString(value?.baseline_skill?.name || value?.baselineSkillName) || null,
    baselineSkillState: asString(value?.baseline_skill?.state || value?.baselineSkillState) || null,
    baselineContractScore: asNullableNumber(value?.baseline_skill?.contract_score ?? value?.baselineContractScore),
    baselineReviewStatus: asString(value?.baseline_skill?.review_status || value?.baselineReviewStatus) || null,
    candidateRecommendation: asString(value?.candidate?.recommendation || value?.candidateRecommendation) || null,
    candidatePromotionStatus: asString(value?.candidate?.promotion_status || value?.candidatePromotionStatus) || null,
    candidateTrialStatus: asString(value?.candidate?.trial_status || value?.candidateTrialStatus) || null,
    representativeTasks: normalizeStringArray(value?.representative_tasks || value?.representativeTasks),
    eligible: Boolean(value?.eligible),
    blockReasons: normalizeStringArray(value?.block_reasons || value?.blockReasons),
  };
}

function normalizeSnapshotJudgement(value) {
  if (!value || typeof value !== "object") return null;
  return {
    trialId: asString(value?.trial_id || value?.trialId),
    candidateId: asString(value?.candidate_id || value?.candidateId),
    recommendation: normalizeCapabilityRecommendation(value?.recommendation, "keep_current"),
    humanApprovalRequired: typeof value?.human_approval_required === "boolean"
      ? value.human_approval_required
      : Boolean(value?.humanApprovalRequired),
    blockers: normalizeStringArray(value?.blockers),
    comparisons: (Array.isArray(value?.comparisons) ? value.comparisons : []).map((comparison) => ({
      metric: asString(comparison?.metric),
      status: asString(comparison?.status),
      baseline: asNullableNumber(comparison?.baseline),
      shadow: asNullableNumber(comparison?.shadow),
      deltaPp: asNullableNumber(comparison?.delta_pp ?? comparison?.deltaPp),
      deltaPct: asNullableNumber(comparison?.delta_pct ?? comparison?.deltaPct),
    })),
  };
}

function computeCapabilityFreshness(rawSnapshot, currentFingerprint, staleAfterHours) {
  if (!rawSnapshot || typeof rawSnapshot !== "object") {
    return { freshnessStatus: "missing", staleReason: "snapshot_missing" };
  }
  const lastRefreshedAt = asString(rawSnapshot?.lastRefreshedAt || rawSnapshot?.generated_at);
  if (!lastRefreshedAt) {
    return { freshnessStatus: "stale", staleReason: "missing_last_refreshed_at" };
  }
  const snapshotFingerprint = asString(rawSnapshot?.sourceFingerprint);
  if (snapshotFingerprint && snapshotFingerprint !== currentFingerprint) {
    return { freshnessStatus: "stale", staleReason: "source_fingerprint_changed" };
  }
  const refreshedAtMs = Date.parse(lastRefreshedAt);
  if (!Number.isFinite(refreshedAtMs)) {
    return { freshnessStatus: "stale", staleReason: "invalid_last_refreshed_at" };
  }
  const ageHours = (Date.now() - refreshedAtMs) / 36e5;
  if (ageHours > staleAfterHours) {
    return {
      freshnessStatus: "stale",
      staleReason: `stale_after_hours:${Math.round(ageHours * 10) / 10}>${staleAfterHours}`,
    };
  }
  return { freshnessStatus: "fresh", staleReason: null };
}

function normalizeCapabilitySnapshot(rawSnapshot, rawAgent, capabilityOptimization, skillSourceRegistry, legacyArtifacts, agentId) {
  const currentFingerprint = computeCapabilitySourceFingerprint(rawAgent);
  const freshness = computeCapabilityFreshness(rawSnapshot, currentFingerprint, capabilityOptimization.staleAfterHours);
  const summary = rawSnapshot?.summary && typeof rawSnapshot.summary === "object" ? rawSnapshot.summary : {};
  const rows = Array.isArray(rawSnapshot?.tableRows) ? rawSnapshot.tableRows : [];

  return {
    version: asString(rawSnapshot?.version) || "agent_capability_snapshot.v1",
    agentId,
    lastRefreshedAt: asString(rawSnapshot?.lastRefreshedAt || rawSnapshot?.generated_at) || null,
    lastRunId: asString(rawSnapshot?.lastRunId) || null,
    refreshMode: asString(rawSnapshot?.refreshMode) || capabilityOptimization.refreshMode,
    freshnessStatus: capabilityFreshnessStatuses.has(freshness.freshnessStatus) ? freshness.freshnessStatus : "missing",
    staleReason: freshness.staleReason,
    staleAfterHours: capabilityOptimization.staleAfterHours,
    sourceFingerprint: asString(rawSnapshot?.sourceFingerprint) || currentFingerprint,
    planArtifactPath: asString(rawSnapshot?.planArtifactPath) || legacyArtifacts?.planPath || null,
    judgementArtifactPath: asString(rawSnapshot?.judgementArtifactPath) || legacyArtifacts?.judgementPath || null,
    snapshotArtifactPath: asString(rawSnapshot?.snapshotArtifactPath) || legacyArtifacts?.snapshotPath || null,
    tableRows: rows.map((row, index) => {
      const decisionGuidance = normalizeDecisionGuidance(row?.decisionGuidance, {});
      const qualitySignals = normalizeCapabilityQualitySignals(row?.qualitySignals, decisionGuidance, row?.decisionStatus);
      const bestCandidate = normalizeSnapshotCandidate(
        row?.bestCandidate,
        `${agentId}:snapshot-candidate:${index}`,
        skillSourceRegistry,
      );
      const planTrial = normalizeSnapshotTrial(row?.planTrial);
      const judgement = normalizeSnapshotJudgement(row?.judgement);
      const decisionStatus = normalizeCapabilityRecommendation(
        row?.decisionStatus || judgement?.recommendation || bestCandidate?.recommendation || qualitySignals?.recommendation,
        "keep_current",
      );
      const decisionBlockedByStale = freshness.freshnessStatus === "stale" && (
        decisionStatus === "replace_after_trial"
        || ["approved", "human_review_required"].includes(asString(bestCandidate?.promotionStatus))
      );

      return {
        key: asString(row?.key) || `${agentId}:${index}`,
        type: ["rule", "tool", "skill", "mcp"].includes(asString(row?.type)) ? asString(row?.type) : "skill",
        name: asString(row?.name),
        stateLabel: asString(row?.stateLabel) || "used",
        sourceLabel: asString(row?.sourceLabel) || "docs/agents/registry.yaml",
        sourceUrl: asString(row?.sourceUrl) || null,
        trustLabel: asString(row?.trustLabel) || "approved",
        decisionGuidance,
        qualitySignals,
        bestCandidate,
        planTrial,
        judgement,
        decisionStatus,
        decisionReason: asString(row?.decisionReason) || null,
        decisionBlockedByStale,
        decisionBlockReason: decisionBlockedByStale ? freshness.staleReason : null,
      };
    }),
    summary: {
      rowsTotal: asNumber(summary?.rowsTotal),
      externalCandidatesTotal: asNumber(summary?.externalCandidatesTotal),
      judgedTotal: asNumber(summary?.judgedTotal),
      blockedByPolicyTotal: asNumber(summary?.blockedByPolicyTotal),
      eligibleTrialsTotal: asNumber(summary?.eligibleTrialsTotal),
    },
    staleBeforeRefresh: typeof rawSnapshot?.staleBeforeRefresh === "boolean" ? rawSnapshot.staleBeforeRefresh : null,
    staleBeforeRefreshReason: asString(rawSnapshot?.staleBeforeRefreshReason) || null,
  };
}

function normalizeLearningArtifacts(value, ctx) {
  const source = value && typeof value === "object" ? value : {};
  const defaultLessonsPath = ctx ? `docs/subservices/oap/tasks/lessons/${ctx}.md` : "docs/subservices/oap/tasks/lessons.md";
  return {
    todoPath: asString(source?.todoPath) || "docs/subservices/oap/tasks/todo.md",
    lessonsPath: asString(source?.lessonsPath) || defaultLessonsPath,
    lastLessonAt: asString(source?.lastLessonAt) || null,
  };
}

function normalizeWorkflowMetricsCatalog(value, ctx) {
  const source = Array.isArray(value) ? value : [];
  const fallback = [
    "plan_coverage_rate",
    "verification_pass_rate",
    "lesson_capture_rate",
    "replan_rate",
    "autonomous_bugfix_rate",
    "elegance_gate_rate",
  ];
  const normalized = source.map((item) => asString(item)).filter(Boolean);
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeDoneGatePolicy(value, ctx) {
  const source = value && typeof value === "object" ? value : {};
  const mode = asString(source?.mode).toLowerCase();
  const fallbackStatus = asString(source?.fallbackStatus).toLowerCase();
  return {
    mode: mode === "strict" ? "strict" : "soft_warning",
    requiredChecks: Array.isArray(source?.requiredChecks)
      ? source.requiredChecks.map((item) => asString(item)).filter(Boolean)
      : ["plan", "verify", "lesson"],
    fallbackStatus: ["backlog", "ready", "in_progress", "ab_test", "in_review", "done"].includes(fallbackStatus)
      ? fallbackStatus
      : "in_review",
  };
}

function normalizeAgentClass(value, agentId) {
  const normalized = asString(value).toLowerCase();
  if (normalized === "core" || normalized === "specialist") return normalized;
  return MODERN_AGENT_IDS.has(agentId) ? "core" : "specialist";
}

function normalizeAgentOrigin(value) {
  const normalized = asString(value).toLowerCase();
  if (normalized === "manual" || normalized === "dynamic") return normalized;
  return "manual";
}

function normalizeAgentLifecycle(value) {
  const normalized = asString(value).toLowerCase();
  if (normalized === "active" || normalized === "retire_candidate" || normalized === "retired") return normalized;
  return "active";
}

function normalizeAuditDisposition(value) {
  const normalized = asString(value).toLowerCase();
  if (normalized === "keep" || normalized === "merge" || normalized === "retire_candidate") return normalized;
  return "keep";
}

function normalizeCapabilityContract(value, { id, role }) {
  const source = value && typeof value === "object" ? value : {};
  const mission = asString(source?.mission) || `Deliver scoped outcomes for ${id}.`;
  const entryCriteria = Array.isArray(source?.entryCriteria)
    ? source.entryCriteria.map((item) => asString(item)).filter(Boolean)
    : [];
  const doneCondition = asString(source?.doneCondition) || "Task output is verified against acceptance criteria.";
  const outputSchema = asString(source?.outputSchema) || `${slugify(id || role || "agent")}_output.v1`;
  return {
    mission,
    entryCriteria,
    doneCondition,
    outputSchema,
  };
}

async function loadTelemetrySummaryByAgent() {
  const telemetryPath = path.join(repoRoot, "artifacts", "agent_telemetry_summary.json");
  const map = new Map();
  try {
    const raw = await fs.readFile(telemetryPath, "utf8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.agents) ? parsed.agents : [];
    for (const entry of list) {
      const id = asString(entry?.agent_id);
      if (!id) continue;
      map.set(id, entry);
    }
  } catch {
    // Telemetry overlay is optional.
  }
  return map;
}

function inferTaskType(title) {
  const value = asString(title).toLowerCase();
  if (!value) return "general";
  if (/(ui|frontend|reader|drawer|page|верстк|интерфейс|react|vite|mui)/i.test(value)) return "ui";
  if (/(etl|dataset|migration|sql|db|supabase|data|rpc)/i.test(value)) return "etl";
  if (/(infra|deploy|ops|netlify|sentry|mcp|ci|pipeline)/i.test(value)) return "infra";
  if (/(review|quality|qa|тест)/i.test(value)) return "review";
  return "general";
}

function inferAnchorCategory(filePath) {
  const pathValue = normalizePath(filePath);
  if (pathValue.includes("/contracts/")) return "contract";
  if (pathValue.includes("/specs/")) return "spec";
  if (pathValue.endsWith("agents.md")) return "governance";
  if (pathValue.includes("runbook")) return "runbook";
  return "runbook";
}

function inferAnchorFreshness(filePath, docsByPath, nowTs) {
  const doc = docsByPath.get(normalizePath(filePath));
  if (!doc?.updatedAt) return "unknown";
  const updatedTs = new Date(doc.updatedAt).getTime();
  if (!Number.isFinite(updatedTs)) return "unknown";
  const ageDays = (nowTs - updatedTs) / (24 * 60 * 60 * 1000);
  return ageDays > 30 ? "stale" : "fresh";
}

function inferMandatoryRule(location) {
  const value = normalizePath(location || "");
  if (!value) return false;
  return value.includes("spec") || value.includes("contracts") || value.endsWith("agents.md") || value.includes("runbook");
}

function normalizeMemoryContext(input, ctx, options) {
  const {
    contextRefs,
    rulesApplied,
    taskEvents,
    improvements,
    docsByPath,
    usedMcp,
    telemetry,
  } = options;
  const now = new Date();
  const nowTs = now.getTime();
  const source = input && typeof input === "object" ? input : {};

  const latestTask = [...taskEvents]
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0] || null;

  const fallbackCurrentTask = {
    task_id: latestTask?.id || `${ctx}-task-current`,
    goal: latestTask?.title || "не зафиксировано",
    task_type: inferTaskType(latestTask?.title || ""),
    context_sla_seconds: 120,
  };

  const inputCurrentTask = source?.currentTask && typeof source.currentTask === "object" ? source.currentTask : {};
  const currentTask = {
    task_id: asString(inputCurrentTask?.task_id) || fallbackCurrentTask.task_id,
    goal: asString(inputCurrentTask?.goal) || fallbackCurrentTask.goal,
    task_type: asString(inputCurrentTask?.task_type) || fallbackCurrentTask.task_type,
    context_sla_seconds: asNumber(inputCurrentTask?.context_sla_seconds) || fallbackCurrentTask.context_sla_seconds,
  };

  const fallbackAnchors = contextRefs.map((entry, index) => {
    const filePath = asString(entry.filePath);
    const normalized = normalizePath(filePath).replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "");
    const anchorId = `anchor-${index + 1}-${normalized || "context"}`;
    return {
      anchor_id: anchorId,
      category: inferAnchorCategory(filePath),
      title: asString(entry.title) || `Источник ${index + 1}`,
      filePath,
      pathHint: asString(entry.pathHint) || null,
      whySelected: asString(entry.pathHint) || "Источник для решения текущей задачи",
      tokens_est: 280,
      sourceUrl: asString(entry.sourceUrl) || docsByPath.get(normalizePath(filePath))?.sourceUrl || null,
      freshness: inferAnchorFreshness(filePath, docsByPath, nowTs),
    };
  });

  const inputAnchors = Array.isArray(source?.contextAnchors) ? source.contextAnchors : [];
  const contextAnchors = (inputAnchors.length > 0 ? inputAnchors : fallbackAnchors).map((entry, index) => {
    const fallback = fallbackAnchors[index] || fallbackAnchors[0] || {
      anchor_id: `anchor-${index + 1}`,
      category: "unknown",
      title: `Источник ${index + 1}`,
      filePath: "unknown",
      pathHint: null,
      whySelected: "Источник для решения текущей задачи",
      tokens_est: 280,
      sourceUrl: null,
      freshness: "unknown",
    };
    const filePath = asString(entry?.filePath) || fallback.filePath;
    const category = asString(entry?.category);
    const freshness = asString(entry?.freshness);
    return {
      anchor_id: asString(entry?.anchor_id) || fallback.anchor_id,
      category: ["spec", "contract", "governance", "runbook", "unknown"].includes(category)
        ? category
        : inferAnchorCategory(filePath),
      title: asString(entry?.title) || fallback.title,
      filePath,
      pathHint: asString(entry?.pathHint) || fallback.pathHint,
      whySelected: asString(entry?.whySelected) || fallback.whySelected,
      tokens_est: asNumber(entry?.tokens_est) || fallback.tokens_est,
      sourceUrl: asString(entry?.sourceUrl) || fallback.sourceUrl || null,
      freshness: ["fresh", "stale", "unknown"].includes(freshness)
        ? freshness
        : inferAnchorFreshness(filePath, docsByPath, nowTs),
    };
  });

  const fallbackPersistentRules = rulesApplied.map((rule, index) => {
    const location = asString(rule.location) || `contextRef:${index + 1}`;
    return {
      mandatory: inferMandatoryRule(location),
      title: asString(rule.title) || `Правило ${index + 1}`,
      location,
      description: asString(rule.description) || `Источник: ${asString(rule.title) || location}`,
      sourceUrl: asString(rule.sourceUrl) || null,
    };
  });
  const inputPersistentRules = Array.isArray(source?.persistentRules) ? source.persistentRules : [];
  const persistentRules = (inputPersistentRules.length > 0 ? inputPersistentRules : fallbackPersistentRules).map((rule, index) => {
    const fallback = fallbackPersistentRules[index] || fallbackPersistentRules[0] || {
      mandatory: false,
      title: `Правило ${index + 1}`,
      location: "unknown",
      description: "не зафиксировано",
      sourceUrl: null,
    };
    const location = asString(rule?.location) || fallback.location;
    return {
      mandatory: typeof rule?.mandatory === "boolean" ? rule.mandatory : inferMandatoryRule(location),
      title: asString(rule?.title) || fallback.title,
      location,
      description: asString(rule?.description) || fallback.description,
      sourceUrl: asString(rule?.sourceUrl) || fallback.sourceUrl || null,
    };
  });

  const reviewErrorIds = taskEvents
    .filter((event) => asNumber(event.reviewErrors) > 0)
    .map((event) => event.id);
  const improvementPaths = improvements
    .map((item) => normalizePath(item?.promptPath || ""))
    .filter(Boolean);
  const topImprovementIds = improvements.slice(0, 3).map((item) => asString(item.title)).filter(Boolean);
  const taskEventIds = taskEvents.slice(0, 3).map((event) => event.id);

  const fallbackDecisionLinks = contextAnchors.map((anchor, index) => {
    const anchorPath = normalizePath(anchor.filePath);
    const matchedByPrompt = anchorPath ? improvementPaths.some((entry) => entry === anchorPath) : false;
    const usedInDecision = matchedByPrompt || index < 3;
    return {
      anchor_id: anchor.anchor_id,
      usedInDecision,
      taskEventIds: usedInDecision ? taskEventIds : [],
      reviewErrorIds: usedInDecision ? reviewErrorIds : [],
      improvementIds: usedInDecision ? topImprovementIds : [],
    };
  });

  const inputDecisionLinks = Array.isArray(source?.decisionUsage?.decisionLinks)
    ? source.decisionUsage.decisionLinks
    : [];
  const decisionLinks = (inputDecisionLinks.length > 0 ? inputDecisionLinks : fallbackDecisionLinks).map((link, index) => {
    const fallback = fallbackDecisionLinks[index] || fallbackDecisionLinks[0] || {
      anchor_id: contextAnchors[index]?.anchor_id || `anchor-${index + 1}`,
      usedInDecision: false,
      taskEventIds: [],
      reviewErrorIds: [],
      improvementIds: [],
    };
    return {
      anchor_id: asString(link?.anchor_id) || fallback.anchor_id,
      usedInDecision: typeof link?.usedInDecision === "boolean" ? link.usedInDecision : fallback.usedInDecision,
      taskEventIds: Array.isArray(link?.taskEventIds) ? link.taskEventIds.map((item) => asString(item)).filter(Boolean) : fallback.taskEventIds,
      reviewErrorIds: Array.isArray(link?.reviewErrorIds) ? link.reviewErrorIds.map((item) => asString(item)).filter(Boolean) : fallback.reviewErrorIds,
      improvementIds: Array.isArray(link?.improvementIds) ? link.improvementIds.map((item) => asString(item)).filter(Boolean) : fallback.improvementIds,
    };
  });

  const usedAnchorIds = new Set(decisionLinks.filter((item) => item.usedInDecision).map((item) => item.anchor_id));
  const totalContextTokens = contextAnchors.reduce((sum, item) => sum + asNumber(item.tokens_est), 0);
  const usefulContextTokens = contextAnchors.reduce(
    (sum, item) => sum + (usedAnchorIds.has(item.anchor_id) ? asNumber(item.tokens_est) : 0),
    0,
  );
  const fallbackContextEfficiency = totalContextTokens > 0 ? Number((usefulContextTokens / totalContextTokens).toFixed(4)) : null;
  const telemetryTokensIn = asNullableNumber(telemetry?.tokens_in_total);
  const telemetryTasksCompleted = asNumber(telemetry?.completed_tasks || 0);
  const fallbackTokensPerTask = telemetryTokensIn !== null && telemetryTasksCompleted > 0
    ? Number((telemetryTokensIn / telemetryTasksCompleted).toFixed(2))
    : (taskEvents.length > 0 ? Number((totalContextTokens / taskEvents.length).toFixed(2)) : null);
  const fallbackCachedTokens = asNullableNumber(telemetry?.cached_tokens);
  const fallbackCacheHitRate = asNullableNumber(telemetry?.cache_hit_rate);

  const inputEconomics = source?.economics && typeof source.economics === "object" ? source.economics : {};
  const economics = {
    total_context_tokens: asNumber(inputEconomics?.total_context_tokens) || totalContextTokens,
    useful_context_tokens: asNumber(inputEconomics?.useful_context_tokens) || usefulContextTokens,
    context_efficiency: asNullableNumber(inputEconomics?.context_efficiency) ?? fallbackContextEfficiency,
    tokens_per_task: asNullableNumber(inputEconomics?.tokens_per_task) ?? fallbackTokensPerTask,
    cached_tokens: asNullableNumber(inputEconomics?.cached_tokens) ?? fallbackCachedTokens,
    cache_hit_rate: asNullableNumber(inputEconomics?.cache_hit_rate) ?? fallbackCacheHitRate,
  };

  const fallbackCoverage = contextAnchors.length > 0
    ? Number((contextAnchors.filter((item) => item.pathHint && item.pathHint.trim().length > 0).length / contextAnchors.length).toFixed(2))
    : 0;
  const fallbackQualitySignals = [
    {
      score: fallbackCoverage,
      line_refs: contextAnchors
        .filter((item) => Boolean(item.pathHint))
        .slice(0, 5)
        .map((item) => `${item.filePath}${item.pathHint ? ` :: ${item.pathHint}` : ""}`),
      coverage: fallbackCoverage,
    },
  ];
  const inputRetrieval = source?.retrieval && typeof source.retrieval === "object" ? source.retrieval : {};
  const inputSignals = Array.isArray(inputRetrieval?.qualitySignals) ? inputRetrieval.qualitySignals : [];
  const qualitySignals = (inputSignals.length > 0 ? inputSignals : fallbackQualitySignals).map((signal) => ({
    score: asNullableNumber(signal?.score),
    line_refs: Array.isArray(signal?.line_refs) ? signal.line_refs.map((item) => asString(item)).filter(Boolean) : [],
    coverage: asNullableNumber(signal?.coverage),
  }));
  const retrieval = {
    mode: asString(inputRetrieval?.mode) || "hybrid",
    tool: asString(inputRetrieval?.tool) || "qmd",
    top_k: asNumber(inputRetrieval?.top_k) || 8,
    latency_ms: asNullableNumber(inputRetrieval?.latency_ms) ?? asNullableNumber(telemetry?.p95_duration_ms),
    qualitySignals,
  };

  const hasUsedEvidence = decisionLinks.some((item) => item.usedInDecision);
  const hasStaleAnchor = contextAnchors.some((item) => item.freshness === "stale");
  const hasGovernanceRule = persistentRules.some((item) => item.mandatory && inferAnchorCategory(item.location) === "governance");
  const hasPotentialToolOverreach = (usedMcp || []).some((item) => asString(item?.status) === "active" && /(netlify|supabase)/i.test(asString(item?.name)))
    && !hasGovernanceRule;

  const fallbackRiskFlags = [];
  if (!hasUsedEvidence) fallbackRiskFlags.push("missing_evidence");
  if (hasStaleAnchor) fallbackRiskFlags.push("stale_anchor");
  if (!hasGovernanceRule) fallbackRiskFlags.push("injection_risk");
  if (hasPotentialToolOverreach) fallbackRiskFlags.push("tool_overreach");

  const inputRiskControl = source?.riskControl && typeof source.riskControl === "object" ? source.riskControl : {};
  const inputRiskFlags = Array.isArray(inputRiskControl?.riskFlags) ? inputRiskControl.riskFlags : [];
  const riskFlags = (inputRiskFlags.length > 0 ? inputRiskFlags : fallbackRiskFlags)
    .map((item) => asString(item))
    .filter((item) => ["injection_risk", "missing_evidence", "stale_anchor", "tool_overreach"].includes(item));
  const inputToolPolicy = inputRiskControl?.toolPolicy && typeof inputRiskControl.toolPolicy === "object"
    ? inputRiskControl.toolPolicy
    : {};
  const riskControl = {
    riskFlags,
    toolPolicy: {
      profile: asString(inputToolPolicy?.profile) || "balanced",
      allow: Array.isArray(inputToolPolicy?.allow)
        ? inputToolPolicy.allow.map((item) => asString(item)).filter(Boolean)
        : ["read", "search"],
      deny: Array.isArray(inputToolPolicy?.deny)
        ? inputToolPolicy.deny.map((item) => asString(item)).filter(Boolean)
        : ["destructive ops"],
      approval_mode: asString(inputToolPolicy?.approval_mode) || "required_for_risky",
    },
  };

  const scoredImprovements = improvements.map((item) => {
    const impact = asNumber(item?.ice?.impact || 0);
    const confidence = asNumber(item?.ice?.confidence || 0);
    const ease = asNumber(item?.ice?.ease || 0);
    const score = impact + confidence + ease + (asString(item?.priority).toLowerCase().includes("выс") ? 2 : 0);
    return { item, score };
  }).sort((a, b) => b.score - a.score);
  const fallbackNextActions = scoredImprovements.slice(0, 3).map(({ item }) => ({
    title: asString(item?.title) || "Обновить контекст-пакет",
    owner: ctx,
    due_date: withDaysOffset(now, 7),
    expected_effect: asString(item?.effect) || "Рост качества решений за счет более точного контекста.",
  }));
  if (fallbackNextActions.length === 0) {
    fallbackNextActions.push({
      title: "Обновить контекст-пакет",
      owner: ctx,
      due_date: withDaysOffset(now, 7),
      expected_effect: "Повысить доказательность решений и сократить шум в контексте.",
    });
  }

  const inputNextActions = Array.isArray(source?.nextActions) ? source.nextActions : [];
  const nextActions = (inputNextActions.length > 0 ? inputNextActions : fallbackNextActions).slice(0, 3).map((action, index) => {
    const fallback = fallbackNextActions[index] || fallbackNextActions[0];
    return {
      title: asString(action?.title) || fallback.title,
      owner: asString(action?.owner) || fallback.owner,
      due_date: asString(action?.due_date) || fallback.due_date,
      expected_effect: asString(action?.expected_effect) || fallback.expected_effect,
    };
  });

  return {
    currentTask,
    contextAnchors,
    persistentRules,
    retrieval,
    decisionUsage: { decisionLinks },
    economics,
    riskControl,
    nextActions,
  };
}

async function buildAgentsManifest(docs, skillShadowTrialArtifactsByAgent = new Map()) {
  const registryPath = path.join(repoRoot, "docs", "agents", "registry.yaml");
  const registryRaw = await fs.readFile(registryPath, "utf8");
  const repoBrowseBase = resolveRepoBrowseBase();
  const repoRef = resolveRepoRef();
  const docsByPath = new Map((Array.isArray(docs) ? docs : []).map((doc) => [normalizePath(doc.path), doc]));

  let parsed = null;
  try {
    // YAML is a superset of JSON. Keeping JSON-compatible YAML avoids extra dependencies.
    parsed = JSON.parse(registryRaw);
  } catch (error) {
    throw new Error(`agents_registry_parse_error:${String(error)}`);
  }

  const updatedAt = asString(parsed?.updatedAt) || new Date().toISOString();
  const source = asString(parsed?.source) || "registry-manual";
  const sourceVersion = asString(parsed?.sourceVersion) || "v1";
  const agentsInput = Array.isArray(parsed?.agents) ? parsed.agents : [];
  const skillCatalog = await buildSkillCatalogFromAgentsFile();
  const telemetryByAgent = await loadTelemetrySummaryByAgent();

  const agents = agentsInput.map((agent, index) => {
    const id = asString(agent?.id);
    const name = asString(agent?.name);
    const role = asString(agent?.role);
    const rawStatus = asString(agent?.status).toLowerCase();
    const status = agentStatuses.has(rawStatus) ? rawStatus : "degraded";
    const skills = Array.isArray(agent?.skills)
      ? agent.skills.map((skill) => asString(skill)).filter(Boolean)
      : [];
    const updatedAtAgent = asString(agent?.updatedAt) || updatedAt;
    const sourceAgent = asString(agent?.source) || source;
    const trackerUrl = asString(agent?.trackerUrl) || null;
    const runbook = asString(agent?.runbook) || null;
    const notes = asString(agent?.notes) || null;
    const shortDescription = asString(agent?.shortDescription) || null;
    const processLinkTitle = asString(agent?.processLink?.title) || null;
    const processLinkUrl = asString(agent?.processLink?.url) || null;
    const agentClass = normalizeAgentClass(agent?.agentClass, id);
    const origin = normalizeAgentOrigin(agent?.origin);
    const createdByAgentId = asString(agent?.createdByAgentId) || null;
    const parentTemplateId = asString(agent?.parentTemplateId) || null;
    const derivedFromAgentId = asString(agent?.derivedFromAgentId) || null;
    const specializationScope = asString(agent?.specializationScope) || role || "general";
    const lifecycle = normalizeAgentLifecycle(agent?.lifecycle);
    const creationReason = asString(agent?.creationReason) || null;
    const capabilityContract = normalizeCapabilityContract(agent?.capabilityContract, { id, role });
    const auditDisposition = normalizeAuditDisposition(agent?.auditDisposition);
    const auditNote = asString(agent?.auditNote) || null;

    assert(id.length > 0, `invalid_agent_id:${index}`);
    assert(name.length > 0, `invalid_agent_name:${index}`);
    assert(role.length > 0, `invalid_agent_role:${id}`);

    if (trackerUrl) {
      try {
        // eslint-disable-next-line no-new
        new URL(trackerUrl);
      } catch {
        throw new Error(`invalid_agent_tracker_url:${id}`);
      }
    }

    if (processLinkUrl && /^https?:\/\//i.test(processLinkUrl)) {
      try {
        // eslint-disable-next-line no-new
        new URL(processLinkUrl);
      } catch {
        throw new Error(`invalid_agent_process_link_url:${id}`);
      }
    }

    const contextRefs = normalizeContextRefs(agent?.contextRefs, id, repoBrowseBase, repoRef);

    const repositories = normalizeRepositories(agent?.repositories, id);
    const mcpServers = normalizeMcpServers(agent?.mcpServers, id);
    const usedMcp = normalizeUsedMcp(agent?.usedMcp, id);
    const availableMcp = normalizeAvailableMcp(agent?.availableMcp, id);
    const skillSourceRegistry = normalizeSkillSourceRegistry(agent?.skillSourceRegistry);
    const externalSkillCandidates = normalizeExternalSkillCandidates(agent?.externalSkillCandidates, id, skillSourceRegistry);
    const usedSkills = normalizeUsedSkills(agent?.usedSkills, id, skillCatalog);
    const availableSkills = normalizeAvailableSkills(agent?.availableSkills, id);
    const usedTools = normalizeUsedTools(agent?.usedTools, id);
    const availableTools = normalizeAvailableTools(agent?.availableTools, id);
    const rulesApplied = normalizeRulesApplied(agent?.rulesApplied, id, contextRefs, docsByPath);
    const tasks = normalizeTasks(agent?.tasks, id);
    const taskEvents = normalizeTaskEvents(agent?.taskEvents, id);
    const improvements = normalizeImprovements(agent?.improvements, id, repoBrowseBase, repoRef);
    const operatingPlan = normalizeOperatingPlan(agent?.operatingPlan, id);
    const workflowPolicy = normalizeWorkflowPolicy(agent?.workflowPolicy, id);
    const workflowBackbone = normalizeWorkflowBackbone(agent?.workflowBackbone, id);
    const capabilityOptimization = normalizeCapabilityOptimization(agent?.capabilityOptimization, id);
    const learningArtifacts = normalizeLearningArtifacts(agent?.learningArtifacts, id);
    const workflowMetricsCatalog = normalizeWorkflowMetricsCatalog(agent?.workflowMetricsCatalog, id);
    const doneGatePolicy = normalizeDoneGatePolicy(agent?.doneGatePolicy, id);
    const telemetry = telemetryByAgent.get(id) || null;
    const memoryContext = normalizeMemoryContext(agent?.memoryContext, id, {
      contextRefs,
      rulesApplied,
      taskEvents,
      improvements,
      docsByPath,
      usedMcp,
      telemetry,
    });
    const capabilityArtifacts = skillShadowTrialArtifactsByAgent.get(id) || null;
    const skillShadowTrial = capabilityArtifacts ? {
      planPath: capabilityArtifacts.planPath || null,
      judgementPath: capabilityArtifacts.judgementPath || null,
      planGeneratedAt: capabilityArtifacts.planGeneratedAt || null,
      judgementGeneratedAt: capabilityArtifacts.judgementGeneratedAt || null,
      trials: Array.isArray(capabilityArtifacts.trials) ? capabilityArtifacts.trials : [],
      judgements: Array.isArray(capabilityArtifacts.judgements) ? capabilityArtifacts.judgements : [],
    } : null;
    const capabilitySnapshot = normalizeCapabilitySnapshot(
      capabilityArtifacts?.snapshotRaw || null,
      agent,
      capabilityOptimization,
      skillSourceRegistry,
      capabilityArtifacts,
      id,
    );

    return {
      id,
      name,
      role,
      shortDescription,
      status,
      agentClass,
      origin,
      createdByAgentId,
      parentTemplateId,
      derivedFromAgentId,
      specializationScope,
      lifecycle,
      creationReason,
      capabilityContract,
      auditDisposition,
      auditNote,
      skills,
      usedSkills,
      availableSkills,
      usedTools,
      availableTools,
      repositories,
      mcpServers,
      usedMcp,
      availableMcp,
      capabilityOptimization,
      skillSourceRegistry,
      externalSkillCandidates,
      skillShadowTrial,
      capabilitySnapshot,
      contextRefs,
      memoryContext,
      rulesApplied,
      processLink: processLinkUrl ? { title: processLinkTitle || "Схема процесса", url: processLinkUrl } : null,
      tasks,
      taskEvents,
      analystRecommendations: normalizeAnalystRecommendations(agent?.analystRecommendations),
      improvements,
      operatingPlan,
      workflowPolicy,
      workflowBackbone,
      learningArtifacts,
      workflowMetricsCatalog,
      doneGatePolicy,
      updatedAt: updatedAtAgent,
      source: sourceAgent,
      trackerUrl,
      runbook,
      notes,
    };
  });

  return {
    updatedAt,
    source,
    sourceVersion,
    agents,
  };
}

async function buildAnalystLatestCycleSnapshot() {
  const sourcePath = path.join(repoRoot, "artifacts", "agent_latest_cycle_analyst.json");
  const fallback = {
    generated_at: new Date().toISOString(),
    version: "agent_latest_cycle_analyst.v1",
    agent_id: "analyst-agent",
    available: false,
    source: {
      summary_path: "artifacts/agent_telemetry_summary.json",
      cycle_report_path: "artifacts/agent_cycle_validation_report.json",
      log_dir: ".logs/agents",
    },
    metrics: {
      verification_pass_rate: null,
      lesson_capture_rate: null,
      review_error_rate: null,
      recommendation_action_rate: null,
    },
    metric_meta: {},
    latest_cycle: null,
    timeline: [],
    file_trace: { edges: [], fallback_used: false },
  };

  try {
    const raw = await fs.readFile(sourcePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

async function buildAgentBenchmarkSummarySnapshot() {
  const sourcePath = path.join(repoRoot, "artifacts", "agent_benchmark_summary.json");
  const fallback = {
    generated_at: new Date().toISOString(),
    version: "agent_benchmark_summary.v1",
    mode: "soft_warning",
    source: {
      dataset_path: "artifacts/analyst_benchmark_dataset.json",
      run_path: "artifacts/agent_benchmark_run_results.json",
      telemetry_summary_path: "artifacts/agent_telemetry_summary.json",
    },
    dataset: {
      agent_id: "analyst-agent",
      cases_total: 0,
      valid_cases: 0,
      invalid_cases: 0,
      invalid_reasons: [],
      judge_rubric_version: null,
    },
    run: {
      run_id: null,
      agent_id: "analyst-agent",
      target_k: 5,
      judge_model: null,
      judge_rubric_version: null,
      started_at: null,
      finished_at: null,
    },
    thresholds: {
      pass_at_5: 0.8,
      fact_coverage_mean: 0.85,
      schema_valid_rate: 0.98,
      trajectory_compliance_rate: 0.9,
      judge_disagreement_rate: 0.15,
      recommendation_action_rate: 0.3,
    },
    metrics: {
      pass_at_5: null,
      fact_coverage_mean: null,
      schema_valid_rate: null,
      trajectory_compliance_rate: null,
      judge_disagreement_rate: null,
      cost_per_success: null,
      attempts_total: 0,
      cases_total: 0,
      cases_with_results: 0,
      successful_cases: 0,
      cost_total: 0,
      latency_p95_ms: null,
      pass_rate_variance: null,
    },
    impact_metrics: {
      recommendation_executability_rate: null,
      evidence_link_coverage: null,
      time_to_action_p50: null,
      validated_impact_rate: null,
    },
    telemetry_metrics: {
      recommendation_action_rate: null,
    },
    gate: {
      status: "warning",
      failed_metrics: [],
      missing_metrics: [],
      results: [],
    },
    agents: [],
  };

  try {
    const raw = await fs.readFile(sourcePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

async function loadSkillShadowTrialArtifactsByAgent() {
  const legacyPlanRelPath = "artifacts/skill_shadow_trial_plan.json";
  const legacyJudgementRelPath = "artifacts/skill_shadow_trial_judgement.json";
  const trialsRoot = path.join(repoRoot, "artifacts", "capability_trials");
  const byAgent = new Map();

  const ensureAgent = (agentId) => {
    const key = asString(agentId);
    if (!key) return null;
    if (!byAgent.has(key)) {
      byAgent.set(key, {
        planPath: null,
        judgementPath: null,
        planGeneratedAt: null,
        judgementGeneratedAt: null,
        trials: [],
        judgements: [],
        snapshotPath: null,
        snapshotGeneratedAt: null,
        snapshotRaw: null,
      });
    }
    return byAgent.get(key);
  };

  try {
    const entries = await fs.readdir(trialsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agentId = entry.name;
      const agentBucket = ensureAgent(agentId);
      if (!agentBucket) continue;
      const agentDir = path.join(trialsRoot, agentId);
      const planRelPath = path.join("artifacts", "capability_trials", agentId, "shadow_trial_plan.json").replace(/\\/g, "/");
      const judgementRelPath = path.join("artifacts", "capability_trials", agentId, "shadow_trial_judgement.json").replace(/\\/g, "/");
      const snapshotRelPath = path.join("artifacts", "capability_trials", agentId, "capability_snapshot.json").replace(/\\/g, "/");

      try {
        const raw = await fs.readFile(path.join(agentDir, "shadow_trial_plan.json"), "utf8");
        const parsed = JSON.parse(raw);
        agentBucket.planPath = planRelPath;
        agentBucket.planGeneratedAt = asString(parsed?.generated_at) || null;
        const trials = Array.isArray(parsed?.trials) ? parsed.trials : [];
        agentBucket.trials = trials.map((trial) => ({
          trialId: asString(trial?.trial_id),
          candidateId: asString(trial?.candidate_id),
          candidateName: asString(trial?.candidate_name),
          sourceTitle: asString(trial?.source?.title),
          sourceUrl: asString(trial?.source?.url) || null,
          sourceTrust: asString(trial?.source?.trust) || "unknown",
          baselineSkillName: asString(trial?.baseline_skill?.name) || null,
          baselineSkillState: asString(trial?.baseline_skill?.state) || null,
          baselineContractScore: asNullableNumber(trial?.baseline_skill?.contract_score),
          baselineReviewStatus: asString(trial?.baseline_skill?.review_status) || null,
          candidateRecommendation: asString(trial?.candidate?.recommendation) || null,
          candidatePromotionStatus: asString(trial?.candidate?.promotion_status) || null,
          candidateTrialStatus: asString(trial?.candidate?.trial_status) || null,
          representativeTasks: normalizeStringArray(trial?.representative_tasks),
          eligible: Boolean(trial?.eligible),
          blockReasons: normalizeStringArray(trial?.block_reasons),
        }));
      } catch {
        // Optional artifact.
      }

      try {
        const raw = await fs.readFile(path.join(agentDir, "shadow_trial_judgement.json"), "utf8");
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : [parsed];
        agentBucket.judgementPath = judgementRelPath;
        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          agentBucket.judgementGeneratedAt = asString(item?.generated_at) || agentBucket.judgementGeneratedAt || null;
          agentBucket.judgements.push({
            trialId: asString(item?.trial_id),
            candidateId: asString(item?.candidate_id),
            recommendation: asString(item?.recommendation) || null,
            humanApprovalRequired: Boolean(item?.human_approval_required),
            blockers: normalizeStringArray(item?.blockers),
            comparisons: (Array.isArray(item?.comparisons) ? item.comparisons : []).map((comparison) => ({
              metric: asString(comparison?.metric),
              status: asString(comparison?.status),
              baseline: asNullableNumber(comparison?.baseline),
              shadow: asNullableNumber(comparison?.shadow),
              deltaPp: asNullableNumber(comparison?.delta_pp),
              deltaPct: asNullableNumber(comparison?.delta_pct),
            })),
          });
        }
      } catch {
        // Optional artifact.
      }

      try {
        const raw = await fs.readFile(path.join(agentDir, "capability_snapshot.json"), "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          agentBucket.snapshotPath = snapshotRelPath;
          agentBucket.snapshotGeneratedAt = asString(parsed?.lastRefreshedAt || parsed?.generated_at) || null;
          agentBucket.snapshotRaw = parsed;
        }
      } catch {
        // Optional artifact.
      }
    }
  } catch {
    // Optional artifacts root.
  }

  try {
    const raw = await fs.readFile(path.join(repoRoot, legacyPlanRelPath), "utf8");
    const parsed = JSON.parse(raw);
    const agentBucket = ensureAgent(parsed?.agent_id);
    if (agentBucket && !agentBucket.planPath) {
      agentBucket.planPath = legacyPlanRelPath;
      agentBucket.planGeneratedAt = asString(parsed?.generated_at) || null;
      const trials = Array.isArray(parsed?.trials) ? parsed.trials : [];
      agentBucket.trials = trials.map((trial) => ({
        trialId: asString(trial?.trial_id),
        candidateId: asString(trial?.candidate_id),
        candidateName: asString(trial?.candidate_name),
        sourceTitle: asString(trial?.source?.title),
        sourceUrl: asString(trial?.source?.url) || null,
        sourceTrust: asString(trial?.source?.trust) || "unknown",
        baselineSkillName: asString(trial?.baseline_skill?.name) || null,
        baselineSkillState: asString(trial?.baseline_skill?.state) || null,
        baselineContractScore: asNullableNumber(trial?.baseline_skill?.contract_score),
        baselineReviewStatus: asString(trial?.baseline_skill?.review_status) || null,
        candidateRecommendation: asString(trial?.candidate?.recommendation) || null,
        candidatePromotionStatus: asString(trial?.candidate?.promotion_status) || null,
        candidateTrialStatus: asString(trial?.candidate?.trial_status) || null,
        representativeTasks: normalizeStringArray(trial?.representative_tasks),
        eligible: Boolean(trial?.eligible),
        blockReasons: normalizeStringArray(trial?.block_reasons),
      }));
    }
  } catch {
    // Optional artifact. UI falls back to registry-only state.
  }

  try {
    const raw = await fs.readFile(path.join(repoRoot, legacyJudgementRelPath), "utf8");
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const agentBucket = ensureAgent(item?.agent_id);
      if (!agentBucket) continue;
      if (!agentBucket.judgementPath) {
        agentBucket.judgementPath = legacyJudgementRelPath;
      }
      agentBucket.judgementGeneratedAt = asString(item?.generated_at) || agentBucket.judgementGeneratedAt || null;
      agentBucket.judgements.push({
        trialId: asString(item?.trial_id),
        candidateId: asString(item?.candidate_id),
        recommendation: asString(item?.recommendation) || null,
        humanApprovalRequired: Boolean(item?.human_approval_required),
        blockers: normalizeStringArray(item?.blockers),
        comparisons: (Array.isArray(item?.comparisons) ? item.comparisons : []).map((comparison) => ({
          metric: asString(comparison?.metric),
          status: asString(comparison?.status),
          baseline: asNullableNumber(comparison?.baseline),
          shadow: asNullableNumber(comparison?.shadow),
          deltaPp: asNullableNumber(comparison?.delta_pp),
          deltaPct: asNullableNumber(comparison?.delta_pct),
        })),
      });
    }
  } catch {
    // Optional artifact. UI falls back to plan-only or registry-only state.
  }

  return byAgent;
}

async function main() {
  await ensureDir(outDir);
  await ensureDir(publicDir);

  const assistantGovernance = await buildAssistantGovernanceArtifacts();
  const uiSectionContract = await buildUiSectionContract();
  const c4Manifest = await buildC4Manifest();
  const bpmnDiagrams = await buildBpmnManifest();
  const docs = await buildDocsIndex();
  const skillShadowTrialArtifactsByAgent = await loadSkillShadowTrialArtifactsByAgent();
  const agentsManifest = await buildAgentsManifest(docs, skillShadowTrialArtifactsByAgent);
  const searchIndex = buildSearchIndex(docs);
  const oapKbDocs = await buildOapKbIndex();
  const oapKbSearchIndex = buildOapKbSearchIndex(oapKbDocs);
  const oapKbRawLogs = await buildOapRawLogsIndex();
  const analystLatestCycle = await buildAnalystLatestCycleSnapshot();
  const agentBenchmarkSummary = await buildAgentBenchmarkSummarySnapshot();
  const capabilityGlossary = await buildCapabilityGlossary();

  await writeJson("c4-manifest.json", c4Manifest);
  await writeJson("bpmn-manifest.json", { diagrams: bpmnDiagrams });
  await writeJson("docs-index.json", { documents: docs });
  await writeJson("agents-manifest.json", agentsManifest);
  await writeJson("search-index.json", searchIndex);
  await writeJson("oap-kb-index.json", { documents: oapKbDocs });
  await writeJson("oap-kb-search-index.json", oapKbSearchIndex);
  await writeJson("oap-kb-raw-logs.json", { documents: oapKbRawLogs });
  await writeJson("agent-latest-cycle-analyst.json", analystLatestCycle);
  await writeJson("agent-benchmark-summary.json", agentBenchmarkSummary);
  await writeJson("capability-glossary.json", capabilityGlossary);
  await writeJson("assistant-governance.json", assistantGovernance);
  await writeJson("ui-section-contract.json", uiSectionContract);
  await ensureDir(path.join(publicDir, "generated"));
  await fs.writeFile(
    path.join(publicDir, "generated", "agent-latest-cycle-analyst.json"),
    `${JSON.stringify(analystLatestCycle, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(publicDir, "generated", "agent-benchmark-summary.json"),
    `${JSON.stringify(agentBenchmarkSummary, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(publicDir, "generated", "ui-section-contract.json"),
    `${JSON.stringify(uiSectionContract, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(
    `[ops-web] generated indexes: docs=${docs.length}, oap_kb=${oapKbDocs.length}, oap_raw_logs=${oapKbRawLogs.length}, bpmn=${bpmnDiagrams.length}, c4_views=${c4Manifest.views.length}, agents=${agentsManifest.agents.length}, ui_sections=${uiSectionContract.sections.length}, assistant_entries=${assistantGovernance.generated_entries.length}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`[ops-web] content index generation failed: ${String(error)}\n`);
  process.exit(1);
});
