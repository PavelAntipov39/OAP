#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const opsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(opsRoot, "..");
const outDir = path.join(opsRoot, "src", "generated");
const publicDir = path.join(opsRoot, "public");
const requiredC4Views = ["oap_context", "oap_containers", "db_rpc_boundary", "security_access"];
const preferredSpecDir = "001-oap";
const agentStatuses = new Set(["healthy", "degraded", "offline"]);
const mcpStatuses = new Set(["online", "degraded", "offline"]);
const usedMcpStatuses = new Set(["active", "reauth_required", "degraded", "offline"]);
const MODERN_AGENT_IDS = new Set(["analyst-agent", "designer-agent"]);
const MODERN_AGENT_PLAN_RULES = {
  "analyst-agent": {
    title: "Операционный стандарт analyst-agent",
    path: "docs/subservices/oap/ANALYST_OPERATING_PLAN.md",
    description: "Канонический ежедневный цикл, policy источников, lifecycle улучшений и метрики аналитика.",
  },
  "designer-agent": {
    title: "Операционный стандарт designer-agent",
    path: "docs/subservices/oap/DESIGNER_OPERATING_PLAN.md",
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
    relPath: "docs/subservices/oap/DESIGN_RULES.md",
    title: "ОАП: правила дизайна и переиспользования",
    section: "policies",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/AGENT_WORKFLOW_PROMPT.md",
    title: "ОАП: промт внедрения workflow-практик",
    section: "policies",
    required: true,
  },
  {
    relPath: "docs/subservices/oap/DESIGNER_OPERATING_PLAN.md",
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
    assert(name.length > 0, `invalid_used_mcp_name:${ctx}:${index}`);
    return { name, status, note, impactInNumbers, practicalTasks, lastUsedAt };
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
    return { name, usage, fullText, practicalTasks, lastUsedAt, skillFilePath, skillFileText, skillFileLoaded };
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
    assert(name.length > 0, `invalid_available_skill_name:${ctx}:${index}`);
    return { name, benefit, recommendationBasis, expectedEffect, fullText, practicalTasks, link };
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
    assert(name.length > 0, `invalid_used_tool_name:${ctx}:${index}`);
    assert(Boolean(usage), `invalid_used_tool_usage:${ctx}:${index}`);
    assert(Boolean(fullText), `invalid_used_tool_full_text:${ctx}:${index}`);
    assert(Boolean(source), `invalid_used_tool_source:${ctx}:${index}`);
    return { name, usage, fullText, source, practicalTasks, lastUsedAt };
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
    assert(name.length > 0, `invalid_available_tool_name:${ctx}:${index}`);
    assert(Boolean(benefit), `invalid_available_tool_benefit:${ctx}:${index}`);
    assert(Boolean(recommendationBasis), `invalid_available_tool_recommendation_basis:${ctx}:${index}`);
    assert(Boolean(expectedEffect), `invalid_available_tool_expected_effect:${ctx}:${index}`);
    assert(Boolean(fullText), `invalid_available_tool_full_text:${ctx}:${index}`);
    assert(Boolean(source), `invalid_available_tool_source:${ctx}:${index}`);
    return { name, benefit, recommendationBasis, expectedEffect, fullText, source, practicalTasks };
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
    return { title, location, description, fullText, sourceUrl };
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
    };
  });

  fallback.push({
    title: "Глобальные правила платформы",
    location: "Codex runtime system/developer instructions",
    description: "Системные инструкции среды выполнения (вне репозитория).",
    fullText: "Глобальные правила применяются на уровне платформы во время выполнения задач.",
    sourceUrl: null,
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

async function buildAgentsManifest(docs) {
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

    return {
      id,
      name,
      role,
      shortDescription,
      status,
      skills,
      usedSkills,
      availableSkills,
      usedTools,
      availableTools,
      repositories,
      mcpServers,
      usedMcp,
      availableMcp,
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

async function main() {
  await ensureDir(outDir);
  await ensureDir(publicDir);

  const c4Manifest = await buildC4Manifest();
  const bpmnDiagrams = await buildBpmnManifest();
  const docs = await buildDocsIndex();
  const agentsManifest = await buildAgentsManifest(docs);
  const searchIndex = buildSearchIndex(docs);
  const oapKbDocs = await buildOapKbIndex();
  const oapKbSearchIndex = buildOapKbSearchIndex(oapKbDocs);
  const oapKbRawLogs = await buildOapRawLogsIndex();
  const analystLatestCycle = await buildAnalystLatestCycleSnapshot();
  const agentBenchmarkSummary = await buildAgentBenchmarkSummarySnapshot();

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

  process.stdout.write(
    `[ops-web] generated indexes: docs=${docs.length}, oap_kb=${oapKbDocs.length}, oap_raw_logs=${oapKbRawLogs.length}, bpmn=${bpmnDiagrams.length}, c4_views=${c4Manifest.views.length}, agents=${agentsManifest.agents.length}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`[ops-web] content index generation failed: ${String(error)}\n`);
  process.exit(1);
});
