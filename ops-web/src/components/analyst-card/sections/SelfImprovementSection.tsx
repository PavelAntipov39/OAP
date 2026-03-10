import React from "react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  List,
  ListItemButton,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AgentSummary } from "../../../lib/generatedData";
import { getDocsIndex } from "../../../lib/generatedData";
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
    if (/Реестр актуальности|Analyst Agent Lessons|_TEMPLATE/i.test(heading)) continue;

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
      correction: getCaptureBlock("Correction"),
      rootCause: getCaptureBlock("Root cause"),
      preventiveRule: getCaptureBlock("Preventive rule"),
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

const CYCLE_STEPS = ["planned", "verify_started", "verify_passed", "lesson_captured", "completed"];

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

  const activeLessons = lessons.filter((l) => l.status !== "archived");

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
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Уроки агента
        </Typography>
        {activeLessons.length > 0 && (
          <Chip
            size="small"
            label={`${activeLessons.length}`}
            variant="outlined"
            sx={{ fontSize: "0.7rem", height: 18 }}
          />
        )}
        <Tooltip
          title="Выводы из закрытых задач. Нажмите на урок — раскроются причина и превентивное правило."
          arrow
          placement="top"
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary", cursor: "help" }} />
        </Tooltip>
      </Stack>
      {activeLessons.length === 0 ? (
        la?.lessonsPath ? (
          <FilePathLink path={la.lessonsPath} label="Файл уроков агента" onClick={onOpenFile} />
        ) : (
          <Typography variant="caption" color="text.secondary">
            Уроки не зафиксированы
          </Typography>
        )
      ) : (
        <List disablePadding dense sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {activeLessons.map((lesson, idx) => (
            <LessonCard
              key={idx}
              lesson={lesson}
              onOpenFile={onOpenFile}
              lessonsPath={la?.lessonsPath ?? ""}
            />
          ))}
        </List>
      )}

      {/* Блок 4 — Схема цикла самоулучшения */}
      {la?.lastLessonAt ? (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Последний цикл завершён
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatRuDate(la.lastLessonAt)}
            </Typography>
          </Stack>
          <Stepper alternativeLabel sx={{ "& .MuiStepLabel-label": { fontSize: "0.62rem" } }}>
            {CYCLE_STEPS.map((step) => (
              <Step key={step} completed>
                <StepLabel>{step.replace(/_/g, " ")}</StepLabel>
              </Step>
            ))}
          </Stepper>
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
