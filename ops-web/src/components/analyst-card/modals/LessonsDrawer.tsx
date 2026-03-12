import React from "react";
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { getAnalystLatestCycle, getDocsIndex } from "../../../lib/generatedData";
import { FilePathLink } from "../FilePathLink";
import {
  NormalizedLessonCard,
  parseLessonsMarkdownToNormalized,
  type NormalizedLesson,
} from "../../lessons/LessonCard";
import {
  computeLessonsFreshness,
  type LessonsFreshness,
} from "../../lessons/lessonsFreshness";

const DEFAULT_GLOBAL_LESSONS_PATH = "docs/subservices/oap/tasks/lessons.global.md";

type LessonsDrawerProps = {
  open: boolean;
  onClose: () => void;
  lessonsPath: string;
  onOpenFile: (path: string) => void;
  agentId?: string | null;
  globalLessonsPath?: string;
  activeEntity?: "agent" | "global" | null;
  onEntityChange?: (entity: "agent" | "global") => void;
};

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "не указано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LessonsDrawer({
  open,
  onClose,
  lessonsPath,
  onOpenFile,
  agentId = "analyst-agent",
  globalLessonsPath = DEFAULT_GLOBAL_LESSONS_PATH,
  activeEntity,
  onEntityChange,
}: LessonsDrawerProps) {
  const [localEntity, setLocalEntity] = React.useState<"agent" | "global">("agent");

  const effectiveEntity: "agent" | "global" = activeEntity === "global" ? "global" : (activeEntity === "agent" ? "agent" : localEntity);
  const lessonsTab = effectiveEntity === "global" ? 1 : 0;

  const latestCycle = React.useMemo(() => (agentId === "analyst-agent" ? getAnalystLatestCycle() : null), [agentId]);
  const docs = React.useMemo(() => getDocsIndex(), []);

  React.useEffect(() => {
    if (!open && activeEntity == null) {
      setLocalEntity("agent");
    }
  }, [open]);

  const lessons = React.useMemo<NormalizedLesson[]>(() => {
    if (!lessonsPath) return [];
    const doc = docs.find((entry) => entry.path === lessonsPath || entry.path.endsWith(lessonsPath));
    if (!doc?.content) return [];
    return parseLessonsMarkdownToNormalized(doc.content);
  }, [docs, lessonsPath]);

  const globalLessons = React.useMemo<NormalizedLesson[]>(() => {
    const doc = docs.find((entry) => entry.path === globalLessonsPath || entry.path.endsWith(globalLessonsPath));
    if (!doc?.content) return [];
    return parseLessonsMarkdownToNormalized(doc.content);
  }, [docs, globalLessonsPath]);

  const freshness = React.useMemo<LessonsFreshness>(() => computeLessonsFreshness({
    lessonsPath,
    lessons,
    docsIndex: docs,
    latestCycleAt: latestCycle?.latest_cycle?.last_event_at ?? null,
  }), [docs, latestCycle?.latest_cycle?.last_event_at, lessons, lessonsPath]);

  const handleOpenFile = React.useCallback((path: string) => {
    onClose();
    onOpenFile(path);
  }, [onClose, onOpenFile]);

  const handleEntityChange = React.useCallback((entity: "agent" | "global") => {
    if (onEntityChange) {
      onEntityChange(entity);
      return;
    }
    setLocalEntity(entity);
  }, [onEntityChange]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 580 },
          p: 0,
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
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
          <Stack spacing={0.2} sx={{ mt: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              Актуальность данных
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Источник: {freshness.sourcePath}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Обновлено: {formatDateLabel(freshness.sourceUpdatedAt)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Последний урок: {formatDateLabel(freshness.latestLessonDate)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Статус: {freshness.statusLabel}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {freshness.reason}
            </Typography>
          </Stack>
        </Box>
        <IconButton onClick={onClose} aria-label="Закрыть боковую панель уроков">
          <CloseIcon />
        </IconButton>
      </Stack>
      <Divider />

      <Tabs
        value={lessonsTab}
        onChange={(_event, value) => handleEntityChange(value === 1 ? "global" : "agent")}
        sx={{ borderBottom: "1px solid", borderColor: "divider", flexShrink: 0, px: 1 }}
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab label={`Уроки данного агента (${lessons.length})`} />
        <Tab label={`Все уроки (${globalLessons.length})`} />
      </Tabs>

      <Box sx={{ flex: 1, overflow: "auto", p: 1.5 }}>
        {lessonsTab === 0 ? (
          <Stack spacing={0.75}>
            {lessonsPath ? (
              <FilePathLink path={lessonsPath} label={lessonsPath} onClick={handleOpenFile} />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Путь к файлу уроков не указан.
              </Typography>
            )}
            {lessons.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Уроки агента не найдены.
              </Typography>
            ) : (
              <List disablePadding dense sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {lessons.map((lesson, index) => (
                  <NormalizedLessonCard
                    key={`agent-lesson-${lesson.ref}-${index}`}
                    lesson={lesson}
                    lessonsPath={lessonsPath}
                    onOpenFile={handleOpenFile}
                  />
                ))}
              </List>
            )}
          </Stack>
        ) : (
          <Stack spacing={0.75}>
            <FilePathLink path={globalLessonsPath} label={globalLessonsPath} onClick={handleOpenFile} />
            {globalLessons.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Глобальный список уроков пуст.
              </Typography>
            ) : (
              <List disablePadding dense sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {globalLessons.map((lesson, index) => (
                  <NormalizedLessonCard
                    key={`global-lesson-${lesson.ref}-${index}`}
                    lesson={lesson}
                    lessonsPath={globalLessonsPath}
                    onOpenFile={handleOpenFile}
                  />
                ))}
              </List>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
