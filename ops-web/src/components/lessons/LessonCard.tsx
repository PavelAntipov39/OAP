import React from "react";
import {
  Box,
  Chip,
  Collapse,
  ListItemButton,
  Stack,
  Typography,
} from "@mui/material";
import { FilePathLink } from "../analyst-card/FilePathLink";

export type LessonStatus = "active" | "monitoring" | "outdated" | "archived";

export type NormalizedLesson = {
  ref: string;
  date: string;
  title: string;
  status: LessonStatus;
  context: string;
  reason: string;
  rule: string;
  verification: string;
};

const UNKNOWN_VALUE = "не указано";

const LESSON_STATUS_COLOR: Record<LessonStatus, "success" | "info" | "warning" | "default"> = {
  active: "success",
  monitoring: "info",
  outdated: "warning",
  archived: "default",
};

const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  active: "активный",
  monitoring: "наблюдение",
  outdated: "устарел",
  archived: "архив",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFieldValue(value: string): string {
  const normalized = value
    .split("\n")
    .map((line) => line.trim().replace(/^-+\s*/, ""))
    .filter((line, index, arr) => line.length > 0 || (index > 0 && index < arr.length - 1))
    .join("\n")
    .trim();

  if (!normalized) return UNKNOWN_VALUE;
  return normalized;
}

function extractField(section: string, labels: string[]): string {
  for (const label of labels) {
    const blockRx = new RegExp(`-\\s*${escapeRegExp(label)}:\\s*\\n((?:\\s{2,}.+\\n?)*)`, "i");
    const blockMatch = section.match(blockRx);
    if (blockMatch?.[1]) {
      return normalizeFieldValue(blockMatch[1]);
    }

    const inlineRx = new RegExp(`-\\s*${escapeRegExp(label)}:\\s*(.+)`, "i");
    const inlineMatch = section.match(inlineRx);
    if (inlineMatch?.[1]) {
      return normalizeFieldValue(inlineMatch[1]);
    }
  }
  return UNKNOWN_VALUE;
}

export function parseLessonsMarkdownToNormalized(content: string): NormalizedLesson[] {
  const registryStatusMap = new Map<string, LessonStatus>();
  const tableMatch = content.match(/\|\s*lesson_ref\s*\|[\s\S]*?(?=\n##|\n---|\s*$)/);
  if (tableMatch) {
    const rows = tableMatch[0].split("\n").slice(2);
    for (const row of rows) {
      const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (cells.length < 2) continue;
      const ref = cells[0].replace(/`/g, "").trim();
      const status = cells[1].toLowerCase().trim() as LessonStatus;
      if (!ref) continue;
      if (status === "active" || status === "monitoring" || status === "outdated" || status === "archived") {
        registryStatusMap.set(ref, status);
      }
    }
  }

  const sections = content.split(/\n(?=## )/);
  const lessons: NormalizedLesson[] = [];

  for (const section of sections) {
    const h2Match = section.match(/^## (.+)/);
    if (!h2Match) continue;
    const heading = h2Match[1].trim();
    if (/Реестр актуальности|Analyst Agent Lessons|_TEMPLATE|Global Lessons Canon|Обязательные принципы|Seed правила|Формат канонической записи/i.test(heading)) {
      continue;
    }

    const dateMatch = heading.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const date = dateMatch[1];

    let status: LessonStatus = "active";
    for (const [key, value] of registryStatusMap.entries()) {
      if (heading.includes(key) || key.includes(heading.slice(0, 30))) {
        status = value;
        break;
      }
    }

    const context = extractField(section, ["Correction", "Principle"]);
    const reason = extractField(section, ["Root cause", "Trigger"]);
    const rule = extractField(section, ["Preventive rule", "Preventive gate"]);
    const verification = extractField(section, ["Validation", "Status evidence", "Source"]);

    lessons.push({
      ref: heading,
      date,
      title: heading,
      status,
      context,
      reason,
      rule,
      verification,
    });
  }

  return lessons.sort((a, b) => b.date.localeCompare(a.date));
}

function LessonDetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        {label}:
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", whiteSpace: "pre-line", mt: 0.2 }}>
        {value}
      </Typography>
    </Box>
  );
}

export function NormalizedLessonCard({
  lesson,
  onOpenFile,
  lessonsPath,
}: {
  lesson: NormalizedLesson;
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
      }}
    >
      <ListItemButton dense onClick={() => setExpanded((prev) => !prev)} sx={{ gap: 1, alignItems: "flex-start", px: 1.5, py: 0.75 }}>
        <Stack spacing={0.3} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={LESSON_STATUS_LABEL[lesson.status]}
              color={LESSON_STATUS_COLOR[lesson.status]}
              variant="outlined"
              sx={{ fontSize: "0.68rem", height: 18 }}
            />
            <Typography variant="caption" color="text.disabled">
              {lesson.date}
            </Typography>
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
            {lesson.title}
          </Typography>
        </Stack>
      </ListItemButton>
      <Collapse in={expanded} unmountOnExit>
        <Stack spacing={0.75} sx={{ px: 1.5, pb: 1.25 }}>
          <LessonDetailRow label="Контекст" value={lesson.context} />
          <LessonDetailRow label="Причина" value={lesson.reason} />
          <LessonDetailRow label="Правило" value={lesson.rule} />
          <LessonDetailRow label="Проверка" value={lesson.verification} />
          <FilePathLink path={lessonsPath} label="Открыть файл уроков" onClick={onOpenFile} />
        </Stack>
      </Collapse>
    </Box>
  );
}
