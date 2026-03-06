import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Link,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { type AgentMemoryContext, type DocsDocument } from "../../lib/generatedData";

type TextModalPayload = {
  title: string;
  content: string;
  path?: string | null;
  updatedAt?: string | null;
  sourceUrl?: string | null;
};

type MemoryContextPanelProps = {
  agentId: string;
  memoryContext?: AgentMemoryContext | null;
  docsByPath: Map<string, DocsDocument>;
  onOpenText: (payload: TextModalPayload) => void;
  onOpenTask?: (taskKey: string, source: "task_event" | "review_error") => void;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePath(value: string): string {
  return value.trim().replace(/^\.?\//, "").replace(/\\/g, "/").toLowerCase();
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

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "не зафиксировано";
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "не зафиксировано";
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function toDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "не зафиксировано";
  return date.toLocaleDateString("ru-RU");
}

function toAnchorCategoryLabel(value: string): string {
  const category = asString(value).toLowerCase();
  if (category === "spec") return "Спецификация";
  if (category === "contract") return "Контракт";
  if (category === "governance") return "Правила и политики";
  if (category === "runbook") return "Операционный сценарий";
  return "Тип не указан";
}

function toRiskFlagMeta(flag: string): { label: string; description: string } {
  const value = asString(flag).toLowerCase();
  if (value === "injection_risk") {
    return {
      label: "Подмена контекста",
      description: "В контекст могли попасть чужие или нерелевантные инструкции. Код: injection_risk.",
    };
  }
  if (value === "tool_overreach") {
    return {
      label: "Выход инструмента за рамки задачи",
      description: "Инструмент может выполнить действие шире текущей задачи. Код: tool_overreach.",
    };
  }
  if (value === "missing_evidence") {
    return {
      label: "Недостаточно подтверждений",
      description: "Часть выводов не опирается на явные источники. Код: missing_evidence.",
    };
  }
  if (value === "stale_anchor") {
    return {
      label: "Устаревшие источники",
      description: "В контексте есть документы, которые давно не обновлялись. Код: stale_anchor.",
    };
  }
  return {
    label: "Неизвестный риск",
    description: `Код риска: ${asString(flag) || "не указан"}.`,
  };
}

function toToolPolicyProfileLabel(profile: string): string {
  const value = asString(profile).toLowerCase();
  if (value === "balanced") return "Сбалансированный";
  if (value === "strict") return "Строгий";
  if (value === "permissive") return "Расширенный";
  return asString(profile) || "не зафиксировано";
}

function toApprovalModeLabel(mode: string): string {
  const value = asString(mode).toLowerCase();
  if (value === "required_for_risky") return "Подтверждение требуется только для рискованных действий";
  if (value === "always_required") return "Подтверждение требуется для каждого действия";
  if (value === "not_required") return "Подтверждение не требуется";
  return asString(mode) || "не зафиксировано";
}

function toToolActionLabel(action: string): string {
  const value = asString(action).toLowerCase();
  if (value === "read") return "чтение данных";
  if (value === "search") return "поиск по данным";
  if (value === "write") return "изменение данных";
  if (value === "destructive ops" || value === "destructive_ops") return "разрушающие действия";
  return asString(action) || "не зафиксировано";
}

function SectionHeader({ title, purpose, tooltip }: { title: string; purpose: string; tooltip?: string }) {
  return (
    <Stack spacing={0.2} sx={{ mb: 0.6 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Typography variant="subtitle2">{title}</Typography>
        {tooltip ? (
          <Tooltip title={tooltip}>
            <IconButton size="small" aria-label={`Пояснение к блоку: ${title}`} sx={{ p: 0.25 }}>
              <InfoOutlinedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        ) : null}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Цель блока: {purpose}
      </Typography>
    </Stack>
  );
}

export function MemoryContextPanel(props: MemoryContextPanelProps) {
  const { agentId, memoryContext, docsByPath, onOpenText, onOpenTask } = props;

  const currentTask = memoryContext?.currentTask || {
    task_id: "не зафиксировано",
    goal: "не зафиксировано",
    task_type: "general",
    context_sla_seconds: 120,
  };
  const contextAnchors = memoryContext?.contextAnchors || [];
  const persistentRules = memoryContext?.persistentRules || [];
  const retrieval = memoryContext?.retrieval || {
    mode: "hybrid",
    tool: "qmd",
    top_k: 8,
    latency_ms: null,
    qualitySignals: [],
  };
  const decisionLinks = memoryContext?.decisionUsage?.decisionLinks || [];
  const economics = memoryContext?.economics || {
    total_context_tokens: 0,
    useful_context_tokens: 0,
    context_efficiency: null,
    tokens_per_task: null,
    cached_tokens: null,
    cache_hit_rate: null,
  };
  const riskControl = memoryContext?.riskControl || {
    riskFlags: [],
    toolPolicy: {
      profile: "balanced",
      allow: ["read", "search"],
      deny: ["destructive ops"],
      approval_mode: "required_for_risky",
    },
  };
  const nextActions = (memoryContext?.nextActions || []).slice(0, 3);
  const anchorTitleById = new Map(contextAnchors.map((anchor) => [anchor.anchor_id, anchor.title]));

  const openAnchorText = React.useCallback((anchor: { title: string; filePath: string; pathHint: string | null; sourceUrl: string | null }) => {
    const doc = docsByPath.get(normalizePath(anchor.filePath));
    const fragment = extractMarkdownFragment(doc?.content || "", anchor.pathHint || null);
    const fallbackContent = [
      `Источник: ${anchor.title}`,
      `Файл: ${anchor.filePath}`,
      anchor.pathHint ? `Фокус: ${anchor.pathHint}` : "",
      "",
      "Текст не зафиксирован в индексах документации.",
    ].filter(Boolean).join("\n");

    onOpenText({
      title: anchor.title || "Контекст",
      content: doc?.content
        ? [
            `# ${anchor.title || "Контекст"}`,
            "",
            `- Файл: \`${anchor.filePath}\``,
            anchor.pathHint ? `- Фокус: ${anchor.pathHint}` : "",
            fragment.matchedHeading ? `- Раздел: ${fragment.matchedHeading}` : "",
            "",
            "## Релевантный фрагмент",
            fragment.content || doc.content,
          ]
            .filter(Boolean)
            .join("\n")
        : fallbackContent,
      path: anchor.filePath,
      updatedAt: doc?.updatedAt || null,
      sourceUrl: anchor.sourceUrl || doc?.sourceUrl || null,
    });
  }, [docsByPath, onOpenText]);

  const openPersistentRuleText = React.useCallback((rule: { title: string; location: string; description: string; sourceUrl: string | null }) => {
    const location = asString(rule.location);
    const doc = location ? docsByPath.get(normalizePath(location)) : null;
    const fallbackContent = [
      `Правило: ${asString(rule.title) || "без названия"}`,
      location ? `Файл: ${location}` : "",
      asString(rule.description) ? `Фокус: ${rule.description}` : "",
      "",
      "Текст правила не найден в индексах документации.",
    ]
      .filter(Boolean)
      .join("\n");

    const fragment = extractMarkdownFragment(doc?.content || "", asString(rule.description) || null);
    onOpenText({
      title: asString(rule.title) || "Правило",
      content: doc?.content
        ? [
            `# ${asString(rule.title) || "Правило"}`,
            "",
            location ? `- Файл: \`${location}\`` : "",
            asString(rule.description) ? `- Фокус: ${asString(rule.description)}` : "",
            fragment.matchedHeading ? `- Раздел: ${fragment.matchedHeading}` : "",
            "",
            "## Релевантный фрагмент",
            fragment.content || doc.content,
          ]
            .filter(Boolean)
            .join("\n")
        : fallbackContent,
      path: location || null,
      updatedAt: doc?.updatedAt || null,
      sourceUrl: asString(rule.sourceUrl) || doc?.sourceUrl || null,
    });
  }, [docsByPath, onOpenText]);

  const renderTaskKeyList = React.useCallback(
    (taskKeys: string[], source: "task_event" | "review_error") => {
      if (taskKeys.length === 0) return "не зафиксировано";
      if (!onOpenTask) return taskKeys.join(", ");

      return taskKeys.map((taskKey, index) => (
        <React.Fragment key={`${agentId}-${source}-${taskKey}-${index}`}>
          <Link
            component="button"
            type="button"
            underline="hover"
            sx={{ fontSize: "inherit", p: 0, minWidth: 0 }}
            onClick={() => onOpenTask(taskKey, source)}
          >
            {taskKey}
          </Link>
          {index < taskKeys.length - 1 ? ", " : ""}
        </React.Fragment>
      ));
    },
    [agentId, onOpenTask],
  );

  return (
    <Stack spacing={1.25}>
      <Paper variant="outlined" sx={{ p: 1.25 }} id="memory-section-current-task">
        <SectionHeader
          title="1. Что агент решает сейчас"
          purpose="Понять текущую задачу агента и ограничение по времени на подбор контекста."
        />
        <Typography variant="body2">ID задачи: {asString(currentTask.task_id) || "не зафиксировано"}</Typography>
        <Typography variant="body2">Цель: {asString(currentTask.goal) || "не зафиксировано"}</Typography>
        <Typography variant="body2">Тип задачи: {asString(currentTask.task_type) || "не зафиксировано"}</Typography>
        <Typography variant="body2">Лимит времени на подбор контекста: {formatNumber(currentTask.context_sla_seconds)} с</Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25 }} id="memory-section-anchors">
        <SectionHeader
          title="2. Оперативная память"
          purpose="Показать, какие источники агент взял в работу прямо сейчас и почему именно их."
          tooltip="Контекст только текущего запуска задачи: какие документы выбраны сейчас, зачем выбраны и как влияют на решение. В следующем запуске набор может измениться."
        />
        {contextAnchors.length > 0 ? (
          <Stack spacing={0.85} divider={<Divider flexItem />}>
            {contextAnchors.map((anchor) => (
              <Box key={`${agentId}-anchor-${anchor.anchor_id}`}>
                <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{anchor.title}</Typography>
                  <Chip size="small" variant="outlined" label={toAnchorCategoryLabel(anchor.category)} />
                  <Chip size="small" label={anchor.freshness === "fresh" ? "актуально" : anchor.freshness === "stale" ? "устарело" : "не зафиксировано"} />
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div">Документ: {anchor.filePath}</Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Почему выбран: {asString(anchor.whySelected) || "не зафиксировано"}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Оценка токенов: {formatNumber(anchor.tokens_est)}
                </Typography>
                {anchor.pathHint ? (
                  <Typography variant="caption" color="text.secondary" component="div">Фокус: {anchor.pathHint}</Typography>
                ) : null}
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.45 }}>
                  <Button size="small" onClick={() => openAnchorText(anchor)}>Открыть фрагмент в модалке</Button>
                  {anchor.sourceUrl ? (
                    <Button
                      size="small"
                      component={Link}
                      href={anchor.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="none"
                    >
                      Открыть источник
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">не зафиксировано</Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25 }} id="memory-section-persistent-rules">
        <SectionHeader
          title="3. Долговременная память"
          purpose="Зафиксировать неизменные правила, которые агент обязан учитывать в каждой задаче."
          tooltip="Постоянные правила проекта, которые действуют во всех задачах: спецификация, контракты и политики. Эти правила задают границы решений агента."
        />
        {persistentRules.length > 0 ? (
          <Stack spacing={0.8}>
            {persistentRules.map((rule, index) => (
              <Box key={`${agentId}-persistent-rule-${index}`}>
                <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{rule.title}</Typography>
                  {rule.mandatory ? <Chip size="small" color="primary" label="обязательное правило" /> : null}
                </Stack>
                <Typography variant="caption" color="text.secondary" component="div">Документ: {rule.location}</Typography>
                <Typography variant="caption" color="text.secondary" component="div">{rule.description}</Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.35 }}>
                  <Button
                    size="small"
                    onClick={() =>
                      openPersistentRuleText({
                        title: asString(rule.title),
                        location: asString(rule.location),
                        description: asString(rule.description),
                        sourceUrl: asString(rule.sourceUrl) || null,
                      })
                    }
                  >
                    Открыть фрагмент в модалке
                  </Button>
                  {rule.sourceUrl ? (
                    <Button size="small" component={Link} href={rule.sourceUrl} target="_blank" rel="noopener noreferrer">
                      Открыть файл-источник
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">не зафиксировано</Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25 }} id="memory-section-retrieval">
        <SectionHeader
          title="4. Поиск контекста и источники"
          purpose="Объяснить, как агент ищет нужные данные и насколько качественно подобран контекст."
        />
        <Typography variant="body2">Режим поиска: {asString(retrieval.mode) || "не зафиксировано"}</Typography>
        <Typography variant="body2">Инструмент поиска: {asString(retrieval.tool) || "не зафиксировано"}</Typography>
        <Typography variant="body2">Сколько фрагментов берется за запрос: {formatNumber(retrieval.top_k)}</Typography>
        <Typography variant="body2">Ориентировочное время поиска (мс): {formatNumber(retrieval.latency_ms)}</Typography>
        {retrieval.qualitySignals.length > 0 ? (
          <Stack spacing={0.55} sx={{ mt: 0.6 }}>
            {retrieval.qualitySignals.map((signal, index) => (
              <Box key={`${agentId}-quality-signal-${index}`}>
                <Typography variant="caption" color="text.secondary" component="div">
                  Оценка качества: {formatNumber(signal.score)} | Покрытие: {formatPercent(signal.coverage)}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Ссылки на фрагменты: {signal.line_refs.length > 0 ? signal.line_refs.join(" | ") : "не зафиксировано"}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
            Метрики качества поиска: не зафиксировано
          </Typography>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25 }} id="memory-section-decision">
        <SectionHeader
          title="5. Что реально использовано в решении"
          purpose="Показать, какие источники действительно повлияли на решение, а не просто были прочитаны."
        />
        {decisionLinks.length > 0 ? (
          <Stack spacing={0.75}>
            {decisionLinks.map((link, index) => (
              <Box key={`${agentId}-decision-link-${index}`}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {anchorTitleById.get(link.anchor_id) || link.anchor_id}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Использован в решении: {link.usedInDecision ? "да" : "нет"}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  События задач: {renderTaskKeyList(link.taskEventIds, "task_event")}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Ошибки проверки: {renderTaskKeyList(link.reviewErrorIds, "review_error")}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Связанные улучшения: {link.improvementIds.length > 0 ? link.improvementIds.join(", ") : "не зафиксировано"}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">не зафиксировано</Alert>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25 }} id="memory-section-economics">
        <SectionHeader
          title="6. Экономика контекста"
          purpose="Оценить, сколько контекста расходуется и какая его доля приносит реальную пользу."
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 0.85,
          }}
        >
          <Typography variant="body2">Всего токенов контекста: {formatNumber(economics.total_context_tokens)}</Typography>
          <Typography variant="body2">Полезные токены контекста: {formatNumber(economics.useful_context_tokens)}</Typography>
          <Typography variant="body2">Полезная доля контекста: {formatPercent(economics.context_efficiency)}</Typography>
          <Typography variant="body2">Токенов на задачу: {formatNumber(economics.tokens_per_task)}</Typography>
          <Typography variant="body2">Токены из кэша: {formatNumber(economics.cached_tokens)}</Typography>
          <Typography variant="body2">Доля попаданий в кэш: {formatPercent(economics.cache_hit_rate)}</Typography>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25 }} id="memory-section-risks">
        <SectionHeader
          title="7. Риски и контроль"
          purpose="Рано предупредить о рисках, которые могут испортить решение или привести к лишним действиям."
        />
        <Typography variant="body2" sx={{ mb: 0.5 }}>
          Зафиксированные риски:
        </Typography>
        {riskControl.riskFlags.length > 0 ? (
          <Stack spacing={0.55} sx={{ mb: 0.7 }}>
            {riskControl.riskFlags.map((flag) => {
              const meta = toRiskFlagMeta(flag);
              return (
                <Box key={`${agentId}-${flag}`}>
                  <Chip size="small" color="warning" variant="outlined" label={meta.label} />
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.2 }}>
                    {meta.description}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.7 }}>
            не зафиксировано
          </Typography>
        )}
        <Typography variant="body2">
          Профиль политики инструментов: {toToolPolicyProfileLabel(riskControl.toolPolicy.profile)}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          Разрешенные действия: {riskControl.toolPolicy.allow.length > 0 ? riskControl.toolPolicy.allow.map(toToolActionLabel).join(", ") : "не зафиксировано"}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          Запрещенные действия: {riskControl.toolPolicy.deny.length > 0 ? riskControl.toolPolicy.deny.map(toToolActionLabel).join(", ") : "не зафиксировано"}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="div">
          Режим подтверждения: {toApprovalModeLabel(riskControl.toolPolicy.approval_mode)}
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.25 }} id="memory-section-next-actions">
        <SectionHeader
          title="8. Следующее действие"
          purpose="Зафиксировать ближайший шаг, ответственного и ожидаемый эффект, чтобы довести решение до результата."
        />
        {nextActions.length > 0 ? (
          <Stack spacing={0.8}>
            {nextActions.map((action, index) => (
              <Paper key={`${agentId}-next-action-${index}`} variant="outlined" sx={{ p: 0.9 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{action.title}</Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Ответственный: {asString(action.owner) || "не зафиксировано"} | Срок: {toDateLabel(asString(action.due_date))}
                </Typography>
                <Typography variant="caption" color="text.secondary" component="div">
                  Ожидаемый эффект: {asString(action.expected_effect) || "не зафиксировано"}
                </Typography>
                <Typography variant="caption" component="div" sx={{ mt: 0.3 }}>
                  Переход к основаниям:{" "}
                  <Link href="#memory-section-anchors" underline="hover">источники</Link>
                  {" | "}
                  <Link href="#memory-section-decision" underline="hover">решение и проверка</Link>
                  {" | "}
                  <Link href="#memory-section-risks" underline="hover">риски</Link>
                </Typography>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Alert severity="info">не зафиксировано</Alert>
        )}
      </Paper>
    </Stack>
  );
}
