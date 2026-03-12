import React from "react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItemButton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AgentSummary } from "../../../lib/generatedData";
import { getAnalystLatestCycle, getDocsIndex } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";
import { ExternalLink } from "../ExternalLink";

// MECE-разграничение элементов раздела:
// - Уроки агента (lessonsPath)   = аналитические паттерны/выводы из ошибок (КАК улучшились)
// - История изменений (changeLogPath) = аудит-лог: дата/файл/что изменено (ЧТО сделано)
// - Список задач для самоулучшения   = живая страница задач с фильтром (ЧТО запланировано)
// - "План задач" (todoPath) удалён — дублировал "Список задач для самоулучшения"

type LessonStatus = "active" | "monitoring" | "outdated" | "archived";

type LessonEntry = {
  ref: string;
  date: string;
  correction: string;
  rootCause: string;
  preventiveRule: string;
  status: LessonStatus;
};

function parseLessonsMarkdown(content: string): LessonEntry[] {
  const registryStatusMap = new Map<string, LessonStatus>();

  const tableMatch = content.match(/\|\s*lesson_ref\s*\|[\s\S]*?(?=\n##|\n---|\s*$)/);
  if (tableMatch) {
    const rows = tableMatch[0].split("\n").slice(2);
    for (const row of rows) {
      const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 2) {
        const ref = cells[0].replace(/`/g, "").trim();
        const status = cells[1].toLowerCase().trim() as LessonStatus;
        if (ref && ["active", "monitoring", "outdated", "archived"].includes(status)) {
          registryStatusMap.set(ref, status);
        }
      }
    }
  }

  const sections = content.split(/\n(?=## )/);
  const lessons: LessonEntry[] = [];

  for (const section of sections) {
    const h2Match = section.match(/^## (.+)/);
    if (!h2Match) continue;
    const heading = h2Match[1].trim();
    if (/Реестр актуальности|Analyst Agent Lessons|_TEMPLATE|Обязательные принципы|Формат|Seed/i.test(heading)) continue;

    const getCaptureBlock = (label: string) => {
      const rx = new RegExp(`- ${label}:\\s*\\n((?:  .+\\n?)+)`, "i");
      const m = section.match(rx);
      if (m) return m[1].replace(/^  /gm, "").trim();
      const rx2 = new RegExp(`- ${label}:\\s*(.+)`, "i");
      const m2 = section.match(rx2);
      return m2 ? m2[1].trim() : "";
    };

    const dateMatch = heading.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : "";

    let status: LessonStatus = "active";
    for (const [key, val] of registryStatusMap) {
      if (heading.includes(key) || key.includes(heading.slice(0, 30))) {
        status = val;
        break;
      }
    }

    lessons.push({
      ref: heading,
      date,
      correction: getCaptureBlock("Correction") || getCaptureBlock("Principle"),
      rootCause: getCaptureBlock("Root cause") || getCaptureBlock("Trigger"),
      preventiveRule: getCaptureBlock("Preventive rule") || getCaptureBlock("Preventive gate"),
      status,
    });
  }

  return lessons.filter((l) => !!l.date).sort((a, b) => b.date.localeCompare(a.date));
}

const STATUS_COLOR: Record<LessonStatus, "success" | "info" | "warning" | "default"> = {
  active: "success",
  monitoring: "info",
  outdated: "warning",
  archived: "default",
};

const STATUS_LABEL: Record<LessonStatus, string> = {
  active: "активный",
  monitoring: "наблюдение",
  outdated: "устарел",
  archived: "архив",
};

function LessonCard({
  lesson,
  onOpenFile,
  lessonsPath,
}: {
  lesson: LessonEntry;
  onOpenFile: (path: string) => void;
  lessonsPath: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: expanded ? "primary.light" : "divider",
        borderRadius: "6px",
        overflow: "hidden",
        transition: "border-color 0.15s",
      }}
    >
      <ListItemButton
        dense
        onClick={() => setExpanded((v) => !v)}
        sx={{ gap: 1, alignItems: "flex-start", px: 1.5, py: 0.75 }}
      >
        <Stack spacing={0.3} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={STATUS_LABEL[lesson.status]}
              color={STATUS_COLOR[lesson.status]}
              variant="outlined"
              sx={{ fontSize: "0.68rem", height: 18 }}
            />
            {lesson.date ? (
              <Typography variant="caption" color="text.disabled">
                {lesson.date}
              </Typography>
            ) : null}
          </Stack>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontSize: "0.82rem",
            }}
          >
            {lesson.correction || lesson.ref}
          </Typography>
        </Stack>
      </ListItemButton>
      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={0.75} sx={{ px: 1.5, pb: 1.25 }}>
          {lesson.rootCause ? (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Причина:
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {lesson.rootCause}
              </Typography>
            </Box>
          ) : null}
          {lesson.preventiveRule ? (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Превентивное правило:
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {lesson.preventiveRule}
              </Typography>
            </Box>
          ) : null}
          <FilePathLink path={lessonsPath} label="Открыть файл уроков" onClick={onOpenFile} />
        </Stack>
      </Collapse>
    </Box>
  );
}

function formatRuDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SelfImprovementSection({
  agent,
  onOpenFile,
  operatingPlanPath,
}: {
  agent: AgentSummary;
  onOpenFile: (path: string) => void;
  operatingPlanPath?: string;
}) {
  const improvements = agent.improvements ?? [];
  const rules = agent.rulesApplied ?? [];
  const wp = agent.workflowPolicy;
  const la = agent.learningArtifacts;
  const operatingPlan = agent.operatingPlan;
  const highPriority = improvements.filter((imp) => imp.priority === "Высокий" || imp.priority === "high").length;
  const effectiveOperatingPlanPath = operatingPlanPath
    || (agent.id === "designer-agent" ? "docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md" : "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md");

  const lessons = React.useMemo<LessonEntry[]>(() => {
    if (!la?.lessonsPath) return [];
    const docs = getDocsIndex();
    const doc = docs.find(
      (d) => d.path === la.lessonsPath || d.path.endsWith(la.lessonsPath)
    );
    if (!doc?.content) return [];
    return parseLessonsMarkdown(doc.content);
  }, [la?.lessonsPath]);

  const globalLessons = React.useMemo<LessonEntry[]>(() => {
    const docs = getDocsIndex();
    const doc = docs.find((d) => d.path === "docs/subservices/oap/tasks/lessons.global.md");
    if (!doc?.content) return [];
    return parseLessonsMarkdown(doc.content);
  }, []);

  const latestCycle = React.useMemo(
    () => (agent.id === "analyst-agent" ? getAnalystLatestCycle() : null),
    [agent.id]
  );
  const cycleStages = latestCycle?.canonical_stages ?? [];

  const [lessonsModalOpen, setLessonsModalOpen] = React.useState(false);
  const [lessonsTab, setLessonsTab] = React.useState(0);
  const lessonsPath = la?.lessonsPath ?? "";

  const globalLessonsPath = "docs/subservices/oap/tasks/lessons.global.md";

  return (
    <SectionBlock
      title="Самоулучшение агента (Self-improvement loop)"
      tooltip="Система непрерывного улучшения агента: найденные улучшения, бизнес-логика самоулучшения, история изменений и активные задачи"
    >
      {/* Блок 1 — Счётчики */}
      <Stack direction="row" spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
            {improvements.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Улучшений найдено
          </Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
            {highPriority}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Высокий приоритет
          </Typography>
        </Box>
      </Stack>

      {/* Топ-5 улучшений */}
      <Stack spacing={0.5}>
        {improvements.slice(0, 5).map((imp) => (
          <Box key={imp.title}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {imp.title}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`ICE: ${imp.ice.impact + imp.ice.confidence + imp.ice.ease}`}
                sx={{ fontSize: "0.7rem" }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {imp.problem}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Блок 2 — Правила самоулучшения (если есть) */}
      {rules.length > 0 ? (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Правила самоулучшения
          </Typography>
          <Stack spacing={0.5}>
            {rules.map((rule, i) => (
              <Box key={i}>
                <Typography variant="body2">{rule.title}</Typography>
                {rule.description ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {rule.description}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
        </>
      ) : null}

      {/* Блок 3 — Уроки агента */}
      <Divider sx={{ my: 0.5 }} />
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Link
          component="button"
          type="button"
          variant="body2"
          underline="hover"
          sx={{ fontWeight: 600, textAlign: "left", lineHeight: 1.35 }}
          onClick={() => setLessonsModalOpen(true)}
        >
          Уроки данного агента: {lessons.length}
        </Link>
        <Tooltip
          title={`Уроки данного агента (${lessons.length}) из файла ${lessonsPath || "—"}. Глобальный канон содержит ${globalLessons.length} урока.`}
          arrow
          placement="top"
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary", cursor: "help" }} />
        </Tooltip>
      </Stack>
      <Drawer
        anchor="right"
        open={lessonsModalOpen}
        onClose={() => { setLessonsModalOpen(false); setLessonsTab(0); }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 580 },
            p: 0,
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        {/* Header */}
        <Stack
          direction="row"
          alignItems="flex-start"
          spacing={1}
          sx={{ p: 2, pb: 1.5, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.default", flexShrink: 0 }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Уроки агента
            </Typography>
          </Box>
          <IconButton onClick={() => { setLessonsModalOpen(false); setLessonsTab(0); }} aria-label="Закрыть боковую панель уроков">
            <CloseIcon />
          </IconButton>
        </Stack>

        {/* Tabs */}
        <Tabs
          value={lessonsTab}
          onChange={(_e, v) => setLessonsTab(v)}
          sx={{ borderBottom: "1px solid", borderColor: "divider", flexShrink: 0, px: 1 }}
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label={`Уроки данного агента (${lessons.length})`} />
          <Tab label={`Все уроки (${globalLessons.length})`} />
        </Tabs>

        {/* Tab content */}
        <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
          {lessonsTab === 0 && (
            <Stack spacing={0.75}>
              {lessonsPath && (
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", display: "block", mb: 0.5 }}>
                  {lessonsPath}
                </Typography>
              )}
              {lessons.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Уроки агента не найдены.
                </Typography>
              ) : (
                <List disablePadding dense sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {lessons.map((lesson, idx) => (
                    <LessonCard
                      key={idx}
                      lesson={lesson}
                      onOpenFile={(path) => { setLessonsModalOpen(false); onOpenFile(path); }}
                      lessonsPath={lessonsPath}
                    />
                  ))}
                </List>
              )}
            </Stack>
          )}
          {lessonsTab === 1 && (
            <Stack spacing={0.75}>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", display: "block", mb: 0.5 }}>
                {globalLessonsPath}
              </Typography>
              {globalLessons.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Глобальный список уроков пуст.
                </Typography>
              ) : (
                <List disablePadding dense sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {globalLessons.map((lesson, idx) => (
                    <LessonCard
                      key={idx}
                      lesson={lesson}
                      onOpenFile={(path) => { setLessonsModalOpen(false); onOpenFile(path); }}
                      lessonsPath={globalLessonsPath}
                    />
                  ))}
                </List>
              )}
            </Stack>
          )}
        </Box>
      </Drawer>

      {/* Блок 4 — Схема цикла самоулучшения */}
      {(la?.lastLessonAt || cycleStages.length > 0) ? (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Последний цикл
            </Typography>
            {la?.lastLessonAt && (
              <Typography variant="caption" color="text.secondary">
                {formatRuDate(la.lastLessonAt)}
              </Typography>
            )}
          </Stack>
          {cycleStages.length > 0 ? (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                Выполнено {cycleStages.filter((s) => s.executed).length} из {cycleStages.length} этапов
              </Typography>
              <Stepper orientation="vertical" sx={{ "& .MuiStepLabel-label": { fontSize: "0.68rem" } }}>
                {cycleStages.map((stage) => (
                  <Step key={stage.step_key} completed={stage.executed}>
                    <StepLabel>{stage.step_label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </>
          ) : null}
        </>
      ) : null}

      {/* Блок 5 — Хронология и документация */}
      <Divider sx={{ my: 0.5 }} />

      <Stack direction="row" alignItems="baseline" spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Время последнего улучшения:
        </Typography>
        <Typography variant="body2">
          {formatRuDate(la?.lastLessonAt)}
        </Typography>
      </Stack>

      <Box>
        <FilePathLink
          path={effectiveOperatingPlanPath}
          label="Описание бизнес-логики самоулучшения агента"
          onClick={onOpenFile}
        />
        {wp ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {wp.selfImprovementLoop && (
              <Chip size="small" label="Self-improvement loop" color="success" variant="outlined" />
            )}
            {wp.verifyBeforeDone && (
              <Chip size="small" label="Verify before done" variant="outlined" />
            )}
            {wp.autonomousBugfix && (
              <Chip size="small" label="Autonomous bugfix" variant="outlined" />
            )}
          </Stack>
        ) : null}
      </Box>

      {operatingPlan && operatingPlan.improvementLifecycle.length > 0 ? (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Схема бизнес-логики самоулучшения агента:
          </Typography>
          <Stack component="ol" sx={{ m: 0, pl: 2.5 }} spacing={0.25}>
            {operatingPlan.improvementLifecycle.map((step, i) => (
              <Typography component="li" variant="body2" key={i}>
                {step}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : null}

      {/* Блок 6 — История изменений и список задач */}
      <Divider sx={{ my: 0.5 }} />

      <Box>
        {la?.changeLogPath ? (
          <>
            <FilePathLink
              path={la.changeLogPath}
              label="История изменений по улучшению ИИ агента"
              onClick={onOpenFile}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontFamily: "monospace" }}>
              {la.changeLogPath}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            История изменений по улучшению ИИ агента —{" "}
            <Typography component="span" variant="body2" sx={{ fontStyle: "italic" }}>
              файл не зафиксирован
            </Typography>
          </Typography>
        )}
      </Box>

      <ExternalLink href="#/tasks">
        Список задач для самоулучшения — {improvements.length} задач
      </ExternalLink>
    </SectionBlock>
  );
}
