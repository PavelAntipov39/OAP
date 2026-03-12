import React from "react";
import { Box, Divider, Link, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AgentMemoryContext } from "../../../lib/generatedData";
import type { SessionFileOperation } from "../../../lib/analystCardData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";
import { OperativeMemoryModal } from "../modals/OperativeMemoryModal";

const DEFAULT_LESSONS_PATH = "docs/subservices/oap/tasks/lessons/analyst-agent.md";

type MemoryEntry = {
  title: string;
  path: string;
  status?: "read" | "write";
  lastReadAt?: string | null;
  lastWriteAt?: string | null;
  lastTouchedAt?: string | null;
  sourceStep?: string;
  sourceKind?: string;
  semanticLayer?: string;
  reason?: string;
  label?: string;
};

type FilePreviewResolver = (path: string) => { path: string; content: string; updatedAt: string | null } | null;

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

function buildFallbackOperations(entries: MemoryEntry[]): SessionFileOperation[] {
  return entries
    .map((entry): SessionFileOperation | null => {
      const path = String(entry.path || "").trim();
      if (!path) return null;
      return {
        path,
        op: entry.status === "write" ? "write" : "read",
        timestamp: entry.lastTouchedAt || entry.lastWriteAt || entry.lastReadAt || "",
        step: entry.sourceStep || "",
        taskId: "",
        runId: "",
        source: "fallback",
        sourceKind: entry.sourceKind || "unknown",
        semanticLayer: entry.semanticLayer || "unknown",
        reason: entry.reason || "оперативная память",
        label: entry.label || entry.title || path,
      };
    })
    .filter((entry): entry is SessionFileOperation => Boolean(entry));
}

export function MemorySection({
  memoryContext,
  onOpenFile,
  operativeMemoryEntries,
  operativeMemoryTrace,
  operativeMemorySessionId,
  operativeMemoryDefaultSessionId,
  operativeMemoryModalOpen,
  onOpenOperativeMemoryModal,
  onCloseOperativeMemoryModal,
  resolveFilePreview,
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
  operativeMemoryTrace?: SessionFileOperation[];
  operativeMemorySessionId?: string | null;
  operativeMemoryDefaultSessionId?: string | null;
  operativeMemoryModalOpen?: boolean;
  onOpenOperativeMemoryModal?: (sessionId: string | null) => void;
  onCloseOperativeMemoryModal?: () => void;
  resolveFilePreview?: FilePreviewResolver;
  persistentMemoryEntries?: MemoryEntry[];
  isPathOpenable?: (path: string) => boolean;
  selfImprovementLessonsPath?: string;
  selfImprovementTasksCount?: number;
  selfImprovementTasksLoading?: boolean;
  onOpenSelfImprovementTasks?: () => void;
}) {
  const [localOperativeMemoryModalOpen, setLocalOperativeMemoryModalOpen] = React.useState(false);

  const operative: MemoryEntry[] =
    operativeMemoryEntries ??
    (memoryContext?.contextAnchors ?? []).map((anchor) => ({
      title: anchor.title,
      path: anchor.filePath,
    }));
  const persistent: MemoryEntry[] =
    persistentMemoryEntries ??
    (memoryContext?.persistentRules ?? []).map((rule) => ({
      title: rule.title,
      path: rule.location,
    }));
  const openablePersistent = isPathOpenable ? persistent.filter((entry) => isPathOpenable(entry.path)) : persistent;
  const lessonsOpenable = isPathOpenable ? isPathOpenable(selfImprovementLessonsPath) : true;
  const tasksCountLabel = selfImprovementTasksLoading ? "загрузка..." : `${selfImprovementTasksCount} задач`;
  const readCount = operative.filter((entry) => (entry.status || "read") !== "write").length;
  const writeCount = operative.filter((entry) => entry.status === "write").length;
  const traceOperations = React.useMemo<SessionFileOperation[]>(() => {
    const fromTrace = (operativeMemoryTrace ?? []).filter((entry) => String(entry.path || "").trim().length > 0);
    if (fromTrace.length > 0) return fromTrace;
    return buildFallbackOperations(operative);
  }, [operative, operativeMemoryTrace]);
  const deleteCount = traceOperations.filter((entry) => entry.op === "delete").length;
  const isOperativeMemoryModalOpen = operativeMemoryModalOpen ?? localOperativeMemoryModalOpen;
  const openOperativeMemoryModal = React.useCallback(() => {
    const sessionId = operativeMemoryDefaultSessionId || operativeMemorySessionId || null;
    if (onOpenOperativeMemoryModal) {
      onOpenOperativeMemoryModal(sessionId);
      return;
    }
    setLocalOperativeMemoryModalOpen(true);
  }, [onOpenOperativeMemoryModal, operativeMemoryDefaultSessionId, operativeMemorySessionId]);
  const closeOperativeMemoryModal = React.useCallback(() => {
    if (onCloseOperativeMemoryModal) {
      onCloseOperativeMemoryModal();
      return;
    }
    setLocalOperativeMemoryModalOpen(false);
  }, [onCloseOperativeMemoryModal]);

  return (
    <SectionBlock
      title="Память"
      tooltip="Оперативная память — контекстные документы, загружаемые на каждый цикл. Долговременная память — правила и уроки, действующие постоянно"
    >
      <MemorySubsectionTitle
        title="Оперативная память"
        tooltip="Документы и контекст, которые агент подгружает на текущий цикл работы, чтобы решить задачу здесь и сейчас."
      />
      {operative.length === 0 ? (
        <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>
      ) : (
        <Stack spacing={0.35}>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ textAlign: "left", width: "fit-content" }}
            onClick={openOperativeMemoryModal}
          >
            Документов: {operative.length}
          </Link>
          <Typography variant="caption" color="text.secondary">
            {`active-набор: read ${readCount} · write ${writeCount}. Журнал операций: ${traceOperations.length} (delete: ${deleteCount}).`}
          </Typography>
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

      <OperativeMemoryModal
        open={isOperativeMemoryModalOpen}
        onClose={closeOperativeMemoryModal}
        documentCount={operative.length}
        sessionId={operativeMemorySessionId || null}
        operations={traceOperations}
        onOpenFile={onOpenFile}
        isPathOpenable={isPathOpenable}
        resolveFilePreview={resolveFilePreview}
      />
    </SectionBlock>
  );
}
