import type { DocsDocument } from "../../lib/generatedData";
import type { NormalizedLesson } from "./LessonCard";

export type LessonsFreshnessStatus = "fresh" | "stale" | "missing";

export type LessonsFreshness = {
  status: LessonsFreshnessStatus;
  sourcePath: string;
  sourceUpdatedAt: string | null;
  latestLessonDate: string | null;
  statusLabel: string;
  reason: string;
};

const STALE_LESSON_DAYS_THRESHOLD = 14;

function normalizePath(value: string): string {
  return String(value || "").trim().replace(/^(\.\/|\/+)+/, "");
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const dayValue = value.length >= 10 ? value.slice(0, 10) : value;
  const date = new Date(dayValue);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function pickLatestLessonDate(lessons: NormalizedLesson[]): string | null {
  let latest: Date | null = null;
  let latestRaw: string | null = null;
  for (const lesson of lessons) {
    const current = parseDay(lesson.date);
    if (!current) continue;
    if (!latest || current.getTime() > latest.getTime()) {
      latest = current;
      latestRaw = lesson.date;
    }
  }
  return latestRaw;
}

function formatDiffDays(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function computeLessonsFreshness({
  lessonsPath,
  lessons,
  docsIndex,
  latestCycleAt,
}: {
  lessonsPath: string;
  lessons: NormalizedLesson[];
  docsIndex: DocsDocument[];
  latestCycleAt?: string | null;
}): LessonsFreshness {
  const sourcePath = String(lessonsPath || "").trim();
  if (!sourcePath) {
    return {
      status: "missing",
      sourcePath: "не указан",
      sourceUpdatedAt: null,
      latestLessonDate: null,
      statusLabel: "нет данных",
      reason: "Путь к lessons-файлу не указан.",
    };
  }

  const normalizedSourcePath = normalizePath(sourcePath);
  const doc = docsIndex.find((entry) => {
    const normalizedDocPath = normalizePath(entry.path);
    return normalizedDocPath === normalizedSourcePath
      || normalizedDocPath.endsWith(normalizedSourcePath)
      || normalizedSourcePath.endsWith(normalizedDocPath);
  });

  const sourceUpdatedAt = doc?.updatedAt ? String(doc.updatedAt) : null;
  const latestLessonDate = pickLatestLessonDate(lessons);

  if (!sourceUpdatedAt) {
    return {
      status: "missing",
      sourcePath,
      sourceUpdatedAt: null,
      latestLessonDate,
      statusLabel: "нет данных",
      reason: "Файл уроков не найден в docs-index или не имеет даты обновления.",
    };
  }

  if (lessons.length === 0 || !latestLessonDate) {
    return {
      status: "stale",
      sourcePath,
      sourceUpdatedAt,
      latestLessonDate: null,
      statusLabel: "требуется обновление",
      reason: "Файл найден, но записи уроков отсутствуют.",
    };
  }

  const lessonDay = parseDay(latestLessonDate);
  const cycleDay = parseDay(latestCycleAt);
  if (lessonDay && cycleDay) {
    const diffDays = formatDiffDays(lessonDay, cycleDay);
    if (diffDays > STALE_LESSON_DAYS_THRESHOLD) {
      return {
        status: "stale",
        sourcePath,
        sourceUpdatedAt,
        latestLessonDate,
        statusLabel: "требуется обновление",
        reason: `Последний урок старше последнего цикла на ${diffDays} дн.`,
      };
    }
  }

  return {
    status: "fresh",
    sourcePath,
    sourceUpdatedAt,
    latestLessonDate,
    statusLabel: "актуально",
    reason: "Файл уроков и записи актуальны.",
  };
}
