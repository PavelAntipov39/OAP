#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

async function loadJson(relPath, fallback) {
  const target = path.join(repoRoot, relPath);
  try {
    const raw = await fs.readFile(target, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function sendTelegram(message, token, chatId) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`telegram_send_failed:${response.status}:${body.slice(0, 240)}`);
  }
}

function buildDigestMessage(summary, analystAgent) {
  const generatedAt = asString(summary?.generated_at || summary?.generatedAt || new Date().toISOString());
  const analystSummary = (Array.isArray(summary?.agents) ? summary.agents : [])
    .find((item) => asString(item?.agent_id) === "analyst-agent");

  const eventsTotal = toNumber(analystSummary?.events_total || analystSummary?.eventsTotal);
  const completedTasks = toNumber(analystSummary?.tasks_completed || analystSummary?.completed_tasks || analystSummary?.completedTasks);
  const recRate = toNumber(analystSummary?.recommendation_action_rate || analystSummary?.recommendationActionRate);
  const reviewErrors = toNumber(analystSummary?.review_errors_total || analystSummary?.reviewErrorsTotal);

  const improvements = Array.isArray(analystAgent?.improvements) ? analystAgent.improvements : [];
  const topImprovements = improvements.slice(0, 3).map((item, index) => {
    const title = asString(item?.title) || `Improvement ${index + 1}`;
    const metric = asString(item?.targetMetric) || "unknown";
    const delta = asString(item?.expectedDelta) || "not set";
    return `- ${title} | metric: ${metric} | delta: ${delta}`;
  });

  return [
    "*Аналитик - Daily Digest*",
    `Дата: ${generatedAt}`,
    "",
    `- Events: ${eventsTotal}`,
    `- Completed tasks: ${completedTasks}`,
    `- Review errors: ${reviewErrors}`,
    `- Recommendation action rate: ${recRate}%`,
    "",
    "*Top improvements in focus:*",
    ...(topImprovements.length > 0 ? topImprovements : ["- No improvements registered"]),
  ].join("\n");
}

function buildCriticalMessage(summary, explicitMessage) {
  if (asString(explicitMessage)) {
    return [
      "*Аналитик - Critical Alert*",
      asString(explicitMessage),
    ].join("\n");
  }

  const analystSummary = (Array.isArray(summary?.agents) ? summary.agents : [])
    .find((item) => asString(item?.agent_id) === "analyst-agent");
  const reviewErrors = toNumber(analystSummary?.review_errors_total || analystSummary?.reviewErrorsTotal);
  const failed = toNumber(analystSummary?.tasks_failed || analystSummary?.failed_tasks || analystSummary?.failedTasks);

  return [
    "*Аналитик - Critical Alert*",
    "Обнаружен риск деградации по операционным метрикам.",
    `- Failed tasks: ${failed}`,
    `- Review errors: ${reviewErrors}`,
    "Требуется приоритетный разбор.",
  ].join("\n");
}

async function main() {
  const mode = asString(argValue("--mode") || "digest").toLowerCase();
  const criticalMessage = argValue("--message");

  const token = asString(process.env.ANALYST_TELEGRAM_BOT_TOKEN);
  const chatId = asString(process.env.ANALYST_TELEGRAM_CHAT_ID);

  const telemetrySummary = await loadJson("artifacts/agent_telemetry_summary.json", {});
  const registry = await loadJson("docs/agents/registry.yaml", { agents: [] });
  const analystAgent = (Array.isArray(registry?.agents) ? registry.agents : [])
    .find((agent) => asString(agent?.id) === "analyst-agent");

  const message = mode === "critical"
    ? buildCriticalMessage(telemetrySummary, criticalMessage)
    : buildDigestMessage(telemetrySummary, analystAgent);

  if (!token || !chatId) {
    process.stdout.write("[notify-analyst] ANALYST_TELEGRAM_BOT_TOKEN/ANALYST_TELEGRAM_CHAT_ID are not set. Dry-run mode.\n");
    process.stdout.write(`${message}\n`);
    return;
  }

  await sendTelegram(message, token, chatId);
  process.stdout.write(`[notify-analyst] sent ${mode} notification.\n`);
}

main().catch((error) => {
  process.stderr.write(`[notify-analyst] failed: ${String(error)}\n`);
  process.exit(1);
});

