import React from "react";
import {
  Box,
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
import {
  NormalizedLessonCard,
  parseLessonsMarkdownToNormalized,
} from "../lessons/LessonCard";

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
              const parsed = lessonsContent ? parseLessonsMarkdownToNormalized(lessonsContent) : [];
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
                    <NormalizedLessonCard
                      key={`${lesson.ref}-${idx}`}
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
