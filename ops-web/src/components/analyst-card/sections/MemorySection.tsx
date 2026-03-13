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

type OperationStats = {
  operationsTotal: number;
  readTotal: number;
  writeTotal: number;
  deleteTotal: number;
};

function summarizeOperations(operations: SessionFileOperation[]): OperationStats {
  return {
    operationsTotal: operations.length,
    readTotal: operations.filter((entry) => entry.op === "read").length,
    writeTotal: operations.filter((entry) => entry.op === "write").length,
    deleteTotal: operations.filter((entry) => entry.op === "delete").length,
  };
}

function formatOperationStats(stats: OperationStats): string {
  return `операций: ${stats.operationsTotal} read: ${stats.readTotal} write: ${stats.writeTotal} delete: ${stats.deleteTotal}`;
}

function MemorySubsectionTitle({
  title,
  tooltip,
  rightAction,
}: {
  title: string;
  tooltip: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} useFlexGap>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Tooltip title={tooltip} placement="top">
          <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.secondary", cursor: "help" }} />
        </Tooltip>
      </Stack>
      {rightAction}
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
  const [persistentMemoryModalOpen, setPersistentMemoryModalOpen] = React.useState(false);

  const operative: MemoryEntry[] =
    operativeMemoryEntries ??
    (memoryContext?.contextAnchors ?? []).map((anchor) => ({
      title: anchor.title,
      path: anchor.filePath,
    }));
  const persistent: MemoryEntry[] = persistentMemoryEntries ?? [];
  const openablePersistent = isPathOpenable ? persistent.filter((entry) => isPathOpenable(entry.path)) : persistent;
  const lessonsOpenable = isPathOpenable ? isPathOpenable(selfImprovementLessonsPath) : true;
  const tasksCountLabel = selfImprovementTasksLoading ? "загрузка..." : `${selfImprovementTasksCount} задач`;
  const traceOperations = React.useMemo<SessionFileOperation[]>(() => {
    const fromTrace = (operativeMemoryTrace ?? []).filter((entry) => String(entry.path || "").trim().length > 0);
    if (fromTrace.length > 0) return fromTrace;
    return buildFallbackOperations(operative);
  }, [operative, operativeMemoryTrace]);
  const persistentTraceOperations = React.useMemo<SessionFileOperation[]>(
    () => buildFallbackOperations(openablePersistent),
    [openablePersistent],
  );
  const operativeStats = React.useMemo<OperationStats>(
    () => summarizeOperations(traceOperations),
    [traceOperations],
  );
  const persistentStats = React.useMemo<OperationStats>(
    () => summarizeOperations(persistentTraceOperations),
    [persistentTraceOperations],
  );
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
      tooltip="Оперативная память — контекстные документы текущего цикла. Долговременная память — уроки и устойчивые знания из предыдущих циклов."
    >
      <MemorySubsectionTitle
        title="Оперативная память"
        tooltip="Документы и контекст, которые агент подгружает на текущий цикл работы, чтобы решить задачу здесь и сейчас."
        rightAction={operative.length > 0 ? (
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ textAlign: "right", width: "fit-content", whiteSpace: "nowrap" }}
            onClick={openOperativeMemoryModal}
          >
            Документов: {operative.length}
          </Link>
        ) : null}
      />
      <Stack spacing={0.35}>
        <Typography variant="caption" color="text.secondary">
          {formatOperationStats(operativeStats)}
        </Typography>
        {operative.length === 0 ? (
          <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>
        ) : null}
      </Stack>

      <Divider sx={{ my: 0.5 }} />

      <MemorySubsectionTitle
        title="Долговременная память"
        tooltip="Уроки и устойчивые знания, накопленные в предыдущих циклах и влияющие на следующие решения агента."
        rightAction={openablePersistent.length > 0 ? (
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ textAlign: "right", width: "fit-content", whiteSpace: "nowrap" }}
            onClick={() => setPersistentMemoryModalOpen(true)}
          >
            Документов: {openablePersistent.length}
          </Link>
        ) : null}
      />
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {formatOperationStats(persistentStats)}
        </Typography>
        {openablePersistent.length === 0 ? (
          <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>
        ) : (
          openablePersistent.map((entry) => (
            <Stack key={`${entry.title}:${entry.path}`} spacing={0.15}>
              <Typography variant="body2">{entry.title}</Typography>
              <FilePathLink path={entry.path} onClick={onOpenFile} />
            </Stack>
          ))
        )}
      </Stack>

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

      <OperativeMemoryModal
        open={persistentMemoryModalOpen}
        onClose={() => setPersistentMemoryModalOpen(false)}
        documentCount={openablePersistent.length}
        sessionId={null}
        operations={persistentTraceOperations}
        onOpenFile={onOpenFile}
        isPathOpenable={isPathOpenable}
        resolveFilePreview={resolveFilePreview}
        title="Журнал файлов долговременной памяти"
      />
    </SectionBlock>
  );
}
