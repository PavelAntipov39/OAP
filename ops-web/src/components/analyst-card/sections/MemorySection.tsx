import { Box, Divider, Link, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AgentMemoryContext } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";

const DEFAULT_LESSONS_PATH = "docs/subservices/oap/tasks/lessons/analyst-agent.md";
type MemoryEntry = { title: string; path: string };

function MemorySubsectionTitle({
  title,
  tooltip,
}: {
  title: string;
  tooltip: string;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Tooltip title={tooltip} placement="top">
        <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.secondary", cursor: "help" }} />
      </Tooltip>
    </Stack>
  );
}

export function MemorySection({
  memoryContext,
  onOpenFile,
  operativeMemoryEntries,
  persistentMemoryEntries,
  isPathOpenable,
  selfImprovementLessonsPath = DEFAULT_LESSONS_PATH,
  selfImprovementTasksCount = 0,
  selfImprovementTasksLoading = false,
  onOpenSelfImprovementTasks,
}: {
  memoryContext: AgentMemoryContext | null | undefined;
  onOpenFile: (path: string) => void;
  operativeMemoryEntries?: MemoryEntry[];
  persistentMemoryEntries?: MemoryEntry[];
  isPathOpenable?: (path: string) => boolean;
  selfImprovementLessonsPath?: string;
  selfImprovementTasksCount?: number;
  selfImprovementTasksLoading?: boolean;
  onOpenSelfImprovementTasks?: () => void;
}) {
  const operative = operativeMemoryEntries ?? (memoryContext?.contextAnchors ?? []).map((anchor) => ({
    title: anchor.title,
    path: anchor.filePath,
  }));
  const persistent = persistentMemoryEntries ?? (memoryContext?.persistentRules ?? []).map((rule) => ({
    title: rule.title,
    path: rule.location,
  }));
  const openableOperative = isPathOpenable ? operative.filter((entry) => isPathOpenable(entry.path)) : operative;
  const openablePersistent = isPathOpenable ? persistent.filter((entry) => isPathOpenable(entry.path)) : persistent;
  const lessonsOpenable = isPathOpenable ? isPathOpenable(selfImprovementLessonsPath) : true;
  const tasksCountLabel = selfImprovementTasksLoading ? "загрузка..." : `${selfImprovementTasksCount} задач`;

  return (
    <SectionBlock
      title="Память"
      tooltip="Оперативная память — контекстные документы, загружаемые на каждый цикл. Долговременная память — правила и уроки, действующие постоянно"
    >
      <MemorySubsectionTitle
        title="Оперативная память"
        tooltip="Документы и контекст, которые агент подгружает на текущий цикл работы, чтобы решить задачу здесь и сейчас."
      />
      {openableOperative.length === 0 ? (
        <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>
      ) : (
        <Stack spacing={0.5}>
          {openableOperative.map((entry) => (
            <Stack key={`${entry.title}:${entry.path}`} spacing={0.15}>
              <Typography variant="body2">{entry.title}</Typography>
              <FilePathLink path={entry.path} onClick={onOpenFile} />
            </Stack>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 0.5 }} />

      <MemorySubsectionTitle
        title="Долговременная память"
        tooltip="Постоянные правила, стандарты и опорные знания, которые агент использует не только в одной задаче, а в работе в целом."
      />
      {openablePersistent.length === 0 ? (
        <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>
      ) : (
        <Stack spacing={0.5}>
          {openablePersistent.map((entry) => (
            <Stack key={`${entry.title}:${entry.path}`} spacing={0.15}>
              <Typography variant="body2">{entry.title}</Typography>
              <FilePathLink path={entry.path} onClick={onOpenFile} />
            </Stack>
          ))}
        </Stack>
      )}

      <Divider sx={{ my: 0.5 }} />

      <MemorySubsectionTitle
        title="Самоулучшение агента (Self-improvement loop)"
        tooltip="Уроки из практического опыта агента: какие ошибки и выводы уже зафиксированы, чтобы не повторять их в следующих циклах."
      />

      <Stack spacing={0.35}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography variant="body2">
            Память и правила, полученные из практического опыта агента
          </Typography>
          <Tooltip
            title="Это журнал опыта агента: какие ошибки уже были, почему они возникали и какое правило помогает не повторять их в следующих циклах."
            placement="top"
          >
            <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.secondary", cursor: "help" }} />
          </Tooltip>
        </Stack>
        <Box sx={{ pl: 1.5 }}>
          {lessonsOpenable ? (
            <FilePathLink
              path={selfImprovementLessonsPath}
              label={selfImprovementLessonsPath}
              onClick={onOpenFile}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              путь не найден в индексе контента: {selfImprovementLessonsPath}
            </Typography>
          )}
        </Box>
      </Stack>

      <Link
        component="button"
        type="button"
        variant="body2"
        underline="hover"
        sx={{ textAlign: "left" }}
        onClick={() => onOpenSelfImprovementTasks?.()}
      >
        Список актуальных задач, созданных для самоулучшения агента: {tasksCountLabel}
      </Link>
    </SectionBlock>
  );
}
