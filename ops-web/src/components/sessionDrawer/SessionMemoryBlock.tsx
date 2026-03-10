import React from "react";
import {
  Box,
  Chip,
  Collapse,
  ListItemButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AnalystSession } from "../../lib/analystCardData";
import { FilePathLink } from "../analyst-card/FilePathLink";

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
      if (heading.includes(key) || key.includes(heading.slice(0, 30))) { status = val; break; }
    }
    lessons.push({
      ref: heading, date,
      correction: getCaptureBlock("Correction"),
      rootCause: getCaptureBlock("Root cause"),
      preventiveRule: getCaptureBlock("Preventive rule"),
      status,
    });
  }
  return lessons.filter((l) => !!l.date).sort((a, b) => b.date.localeCompare(a.date));
}

const LESSON_STATUS_COLOR: Record<LessonStatus, "success" | "info" | "warning" | "default"> = {
  active: "success", monitoring: "info", outdated: "warning", archived: "default",
};
const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  active: "активный", monitoring: "наблюдение", outdated: "устарел", archived: "архив",
};

function LessonMiniCard({
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
    <Box sx={{ border: "1px solid", borderColor: expanded ? "primary.light" : "divider", borderRadius: "4px", overflow: "hidden" }}>
      <ListItemButton dense onClick={() => setExpanded((v) => !v)} sx={{ px: 1, py: 0.5, gap: 0.75 }}>
        <Stack spacing={0.2} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Chip size="small" label={LESSON_STATUS_LABEL[lesson.status]} color={LESSON_STATUS_COLOR[lesson.status]} variant="outlined" sx={{ fontSize: "0.62rem", height: 16 }} />
            <Typography variant="caption" color="text.disabled">{lesson.date}</Typography>
          </Stack>
          <Typography variant="caption" sx={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {lesson.correction || lesson.ref}
          </Typography>
        </Stack>
      </ListItemButton>
      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={0.5} sx={{ px: 1, pb: 1 }}>
          {lesson.rootCause ? (
            <Typography variant="caption" color="text.secondary"><b>Причина:</b> {lesson.rootCause}</Typography>
          ) : null}
          {lesson.preventiveRule ? (
            <Typography variant="caption" color="text.secondary"><b>Правило:</b> {lesson.preventiveRule}</Typography>
          ) : null}
          <FilePathLink path={lessonsPath} label="Открыть файл уроков" onClick={onOpenFile} />
        </Stack>
      </Collapse>
    </Box>
  );
}

function formatMemoryTimestamp(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "не зафиксировано";
  return `${value.toFixed(1)}%`;
}

export function SessionMemoryBlock({
  session,
  onOpenFile,
  lessonsContent,
}: {
  session: AnalystSession;
  onOpenFile: (path: string) => void;
  lessonsContent?: string;
}) {
  const filesUsedSet = new Set<string>();
  session.fileLog.forEach((entry) => {
    entry.files.forEach((file) => filesUsedSet.add(file));
  });
  const filesUsed = Array.from(filesUsedSet).sort();

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: "#fff",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "8px",
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Память
          </Typography>
          <Tooltip title="Память, задействованная во время цикла сессии">
            <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
          </Tooltip>
        </Stack>

        {/* Operational Memory */}
        <Accordion
          disableGutters
          elevation={0}
          defaultExpanded
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: "6px", "&:before": { display: "none" } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Оперативная память
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Контекст текущей сессии (read/write/delete; read фиксирует доступ и время)
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            {session.operativeMemory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Оперативной памяти не обнаружено
              </Typography>
            ) : (
              <Stack spacing={1}>
                {session.operativeMemory.map((item, idx) => {
                  const lastTouchedLabel = formatMemoryTimestamp(item.lastTouchedAt);
                  return (
                    <Box key={idx}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                        {`status: ${item.status}${lastTouchedLabel ? ` · последнее обращение: ${lastTouchedLabel}` : ""}`}
                      </Typography>
                      <FilePathLink path={item.path} onClick={onOpenFile} />
                    </Box>
                  );
                })}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Persistent Memory */}
        <Accordion
          disableGutters
          elevation={0}
          defaultExpanded={session.persistentMemory.length > 0}
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: "6px", "&:before": { display: "none" } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Долговременная память
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Правила и знания, накопленные в предыдущих сессиях
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            {session.persistentMemory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Долговременной памяти не обнаружено
              </Typography>
            ) : (
              <Stack spacing={1}>
                {session.persistentMemory.map((item, idx) => (
                  <Box key={idx}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                      {item.title}
                    </Typography>
                    <FilePathLink path={item.path} onClick={onOpenFile} />
                  </Box>
                ))}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Used Files */}
        <Accordion
          disableGutters
          elevation={0}
          defaultExpanded
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: "6px", "&:before": { display: "none" } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Использованные файлы
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Полный факт-трейс файлов с дедупликацией путей (включая удаленные в сессии)
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {`Операций: ${session.efficiency.traceQuality.operationsTotal}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {`Delete: ${session.efficiency.traceQuality.deleteOperations}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {`Explicit coverage: ${formatPercent(session.efficiency.traceQuality.explicitCoveragePct)} (${session.efficiency.traceQuality.explicitEvents})`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {`Fallback share: ${formatPercent(session.efficiency.traceQuality.fallbackSharePct)} (${session.efficiency.traceQuality.fallbackEvents})`}
              </Typography>
            </Stack>
            {filesUsed.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                Файлы не были посещены
              </Typography>
            ) : (
              <Stack spacing={0.75} sx={{ maxHeight: "250px", overflowY: "auto" }}>
                {filesUsed.map((file, idx) => (
                  <Box key={idx}>
                    <FilePathLink path={file} onClick={onOpenFile} />
                  </Box>
                ))}
              </Stack>
            )}
          </AccordionDetails>
        </Accordion>

        {/* Self-Improvement Loop */}
        <Accordion
          disableGutters
          elevation={0}
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: "6px", "&:before": { display: "none" } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Самоулучшение агента (Self-improvement loop)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Уроки и исправления, зафиксированные в этой сессии
              </Typography>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0.5 }}>
            {(() => {
              const lessonsPath = "docs/subservices/oap/tasks/lessons/analyst-agent.md";
              const parsed = lessonsContent ? parseLessonsMarkdown(lessonsContent) : [];
              const active = parsed.filter((l) => l.status !== "archived");
              if (active.length === 0) {
                return (
                  <Stack spacing={1}>
                    <FilePathLink path={lessonsPath} label="Файл уроков агента" onClick={onOpenFile} />
                    <Typography variant="caption" color="text.secondary">
                      Уроки ещё не зафиксированы или файл недоступен.
                    </Typography>
                  </Stack>
                );
              }
              return (
                <Stack spacing={0.5}>
                  {active.map((lesson, idx) => (
                    <LessonMiniCard
                      key={idx}
                      lesson={lesson}
                      onOpenFile={onOpenFile}
                      lessonsPath={lessonsPath}
                    />
                  ))}
                </Stack>
              );
            })()}
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Paper>
  );
}
