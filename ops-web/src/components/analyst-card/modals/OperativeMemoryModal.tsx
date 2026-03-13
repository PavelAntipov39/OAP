import React from "react";
import {
  Alert,
  Box,
  Chip,
  Collapse,
  Divider,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DescriptionIcon from "@mui/icons-material/Description";
import EditNoteIcon from "@mui/icons-material/EditNote";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import type { SessionFileOperation } from "../../../lib/analystCardData";
import {
  getTraceSemanticLayerGlossary,
  getTraceSourceKindGlossary,
  type TraceTaxonomyGlossaryEntry,
} from "../../../lib/capabilityGlossary";
import { FilePathLink } from "../FilePathLink";

type FilePreviewResolver = (path: string) => { path: string; content: string; updatedAt: string | null } | null;

type ActiveDocumentState = {
  path: string;
  status: "read" | "write";
  lastReadAt: string | null;
  lastWriteAt: string | null;
  lastTouchedAt: string | null;
  sourceKind: string;
  semanticLayer: string;
  reason: string;
  label: string;
};

function formatTimestamp(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimestampLong(value: string): string {
  if (!value) return "не зафиксировано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "не зафиксировано";
  return date.toLocaleString("ru-RU");
}

function fileNameFromPath(path: string): string {
  const normalized = String(path || "").replace(/\\/g, "/");
  const chunks = normalized.split("/").filter(Boolean);
  return chunks[chunks.length - 1] || path;
}

function resolveOperationOutcome(operation: SessionFileOperation): string {
  if (operation.rawOp === "create") return "Документ создан в рабочем контуре.";
  if (operation.rawOp === "update") return "Документ обновлён в рабочем контуре.";
  if (operation.op === "read") return "Документ прочитан и использован в контуре сессии.";
  if (operation.op === "write") return "Документ записан в рабочем контуре.";
  return "Документ удалён из активного набора оперативной памяти.";
}

function resolveWriteType(operation: SessionFileOperation): string {
  if (operation.rawOp === "create") return "создано";
  if (operation.rawOp === "update") return "обновлено";
  return "записано";
}

function formatOperationKind(operation: SessionFileOperation): string {
  const normalized = operation.op;
  if (operation.rawOp && operation.rawOp !== operation.op) {
    return `${normalized} (raw: ${operation.rawOp})`;
  }
  return normalized;
}

function operationIcon(op: SessionFileOperation["op"]): React.ReactElement {
  if (op === "read") return <DescriptionIcon sx={{ fontSize: 16 }} />;
  if (op === "write") return <EditNoteIcon sx={{ fontSize: 16 }} />;
  return <DeleteOutlineIcon sx={{ fontSize: 16 }} />;
}

function operationChipSx(op: SessionFileOperation["op"]): Record<string, string | number> {
  if (op === "read") {
    return {
      bgcolor: "rgba(15, 23, 42, 0.06)",
      color: "#334155",
    };
  }
  if (op === "write") {
    return {
      bgcolor: "rgba(2, 132, 199, 0.1)",
      color: "#0369a1",
    };
  }
  return {
    bgcolor: "rgba(220, 38, 38, 0.1)",
    color: "#b91c1c",
  };
}

function toDateMs(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildActiveDocuments(operations: SessionFileOperation[]): ActiveDocumentState[] {
  const activeByPath = new Map<string, ActiveDocumentState>();
  const ordered = operations
    .map((operation, index) => ({ operation, index }))
    .sort((left, right) => {
      const byTime = toDateMs(left.operation.timestamp) - toDateMs(right.operation.timestamp);
      if (byTime !== 0) return byTime;
      return left.index - right.index;
    });

  for (const { operation } of ordered) {
    const path = String(operation.path || "").trim();
    if (!path) continue;

    if (operation.op === "delete") {
      activeByPath.delete(path);
      continue;
    }

    const touchedAt = String(operation.timestamp || "").trim() || null;
    const existing = activeByPath.get(path);
    if (!existing) {
      activeByPath.set(path, {
        path,
        status: operation.op === "write" ? "write" : "read",
        lastReadAt: operation.op === "read" ? touchedAt : null,
        lastWriteAt: operation.op === "write" ? touchedAt : null,
        lastTouchedAt: touchedAt,
        sourceKind: operation.sourceKind || "unknown",
        semanticLayer: operation.semanticLayer || "unknown",
        reason: operation.reason || "unknown",
        label: operation.label || fileNameFromPath(path),
      });
      continue;
    }

    if (operation.op === "write") {
      existing.status = "write";
      existing.lastWriteAt = touchedAt || existing.lastWriteAt;
    } else {
      existing.lastReadAt = touchedAt || existing.lastReadAt;
    }
    existing.lastTouchedAt = touchedAt || existing.lastTouchedAt;
    existing.sourceKind = operation.sourceKind || existing.sourceKind;
    existing.semanticLayer = operation.semanticLayer || existing.semanticLayer;
    existing.reason = operation.reason || existing.reason;
    existing.label = operation.label || existing.label;
    activeByPath.set(path, existing);
  }

  return [...activeByPath.values()].sort((left, right) => {
    const byTime = toDateMs(right.lastTouchedAt || "") - toDateMs(left.lastTouchedAt || "");
    if (byTime !== 0) return byTime;
    return left.path.localeCompare(right.path, "ru");
  });
}

function statusChipSx(status: "read" | "write"): Record<string, string | number> {
  return operationChipSx(status);
}

function traceChipTooltip(kind: "source_kind" | "semantic_layer", glossary: TraceTaxonomyGlossaryEntry): string {
  const roleText =
    kind === "source_kind"
      ? "Откуда пришла информация о документе в file trace."
      : "К какому семантическому контуру относится документ.";
  const unknownHint = glossary.raw === "unknown" ? " producer не передал детализацию." : "";
  return `${roleText} ${glossary.tooltip} raw: ${kind}=${glossary.raw}.${unknownHint}`;
}

function ActiveDocumentRow({
  document,
  onOpenFile,
  isPathOpenable,
}: {
  document: ActiveDocumentState;
  onOpenFile: (path: string) => void;
  isPathOpenable?: (path: string) => boolean;
}) {
  const openable = isPathOpenable ? isPathOpenable(document.path) : true;
  const sourceGlossary = getTraceSourceKindGlossary(document.sourceKind);
  const semanticGlossary = getTraceSemanticLayerGlossary(document.semanticLayer);
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "8px",
        px: 1.25,
        py: 0.95,
      }}
    >
      <Stack direction="row" spacing={0.8} alignItems="center">
        <Chip
          label={document.status}
          size="small"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.75rem",
            fontWeight: 600,
            height: 22,
            ...statusChipSx(document.status),
          }}
        />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {document.label || fileNameFromPath(document.path)}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            flexShrink: 0,
          }}
        >
          {formatTimestamp(document.lastTouchedAt || "")}
        </Typography>
      </Stack>
      <Box sx={{ mt: 0.6 }}>
        {openable ? (
          <FilePathLink path={document.path} onClick={onOpenFile} />
        ) : (
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              wordBreak: "break-word",
            }}
          >
            {document.path}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
        <Tooltip title={traceChipTooltip("source_kind", sourceGlossary)} placement="top" arrow>
          <Chip
            size="small"
            variant="outlined"
            label={sourceGlossary.label}
            aria-label={`source-kind-chip:${sourceGlossary.raw}`}
          />
        </Tooltip>
        <Tooltip title={traceChipTooltip("semantic_layer", semanticGlossary)} placement="top" arrow>
          <Chip
            size="small"
            variant="outlined"
            label={semanticGlossary.label}
            aria-label={`semantic-layer-chip:${semanticGlossary.raw}`}
          />
        </Tooltip>
      </Stack>
    </Box>
  );
}

function OperationRow({
  operation,
  onOpenFile,
  isPathOpenable,
  resolveFilePreview: _resolveFilePreview,
}: {
  operation: SessionFileOperation;
  onOpenFile: (path: string) => void;
  isPathOpenable?: (path: string) => boolean;
  resolveFilePreview?: FilePreviewResolver;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const openable = isPathOpenable ? isPathOpenable(operation.path) : true;
  const operationKind = formatOperationKind(operation);
  const operationOutcome = resolveOperationOutcome(operation);
  const writeSubject = operation.label || fileNameFromPath(operation.path);
  const writeLines = operation.op === "write"
    ? [
      `что_записано: ${writeSubject}`,
      `куда_записано: ${operation.path}`,
      `тип_записи: ${resolveWriteType(operation)}`,
    ]
    : [];
  const inputText = [
    `crud_status: ${operation.op}`,
    `operation_kind: ${operationKind}`,
    `step: ${operation.step || "не зафиксировано"}`,
    `timestamp: ${formatTimestampLong(operation.timestamp)}`,
    `task_id: ${operation.taskId || "не зафиксировано"}`,
    `run_id: ${operation.runId || "не зафиксировано"}`,
    `source: ${operation.source}`,
    `source_kind: ${operation.sourceKind || "unknown"}`,
    `semantic_layer: ${operation.semanticLayer || "unknown"}`,
    `reason: ${operation.reason || "unknown"}`,
    `target_path: ${operation.path}`,
  ].join("\n");
  const outputText = [
    `result: ${operationOutcome}`,
    `label: ${operation.label || fileNameFromPath(operation.path)}`,
  ].join("\n");

  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: expanded ? "rgba(27, 95, 168, 0.25)" : "divider",
        borderRadius: "8px",
        overflow: "hidden",
        transition: "border-color 0.15s",
        "&:hover": {
          borderColor: "rgba(27, 95, 168, 0.35)",
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={() => setExpanded((value) => !value)}
        sx={{
          px: 1.5,
          py: 0.85,
          cursor: "pointer",
          bgcolor: expanded ? "rgba(27, 95, 168, 0.04)" : "transparent",
          userSelect: "none",
          transition: "background-color 0.15s",
          "&:hover": { bgcolor: "rgba(27, 95, 168, 0.06)" },
        }}
      >
        <Box sx={{ color: "text.secondary", display: "flex", alignItems: "center" }}>
          {expanded ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
        </Box>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "6px",
            bgcolor: "rgba(27, 95, 168, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.main",
            flexShrink: 0,
          }}
        >
          {operationIcon(operation.op)}
        </Box>
        <Chip
          label={operation.op}
          size="small"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.75rem",
            fontWeight: 600,
            height: 22,
            ...operationChipSx(operation.op),
          }}
        />
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 500,
          }}
        >
          {operation.label || fileNameFromPath(operation.path)}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "text.secondary",
            flexShrink: 0,
            minWidth: 56,
            textAlign: "right",
          }}
        >
          {formatTimestamp(operation.timestamp)}
        </Typography>
      </Stack>

      <Collapse in={expanded}>
        <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
          <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}
            >
              Input
            </Typography>
            <Box
              component="pre"
              sx={{
                mt: 0.5,
                p: 1,
                borderRadius: "6px",
                bgcolor: "#0f172a",
                color: "#e2e8f0",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.78rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                m: 0,
                mb: 0.5,
                overflow: "auto",
                maxHeight: 220,
              }}
            >
              {inputText}
            </Box>
          </Box>
          <Box sx={{ px: 1.5, pt: 0.5, pb: 1 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}
            >
              Output
            </Typography>
            <Box
              component="pre"
              sx={{
                mt: 0.5,
                p: 1,
                borderRadius: "6px",
                bgcolor: operation.op === "delete" ? "rgba(220, 38, 38, 0.06)" : "#f1f5f9",
                color: operation.op === "delete" ? "#b91c1c" : "#334155",
                border: operation.op === "delete" ? "1px solid rgba(220, 38, 38, 0.2)" : "1px solid rgba(15, 23, 42, 0.08)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.78rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                m: 0,
                overflow: "auto",
                maxHeight: 220,
              }}
            >
              {outputText}
            </Box>
            <Box
              sx={{
                mt: 0.85,
                p: 1,
                borderRadius: "6px",
                border: "1px solid rgba(15, 23, 42, 0.12)",
                bgcolor: "rgba(248, 250, 252, 0.92)",
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}
              >
                Изменение документа
              </Typography>
              <Box
                component="pre"
                sx={{
                  mt: 0.45,
                  mb: 0,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "0.76rem",
                  lineHeight: 1.55,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  color: "#334155",
                }}
              >
                {[
                  `operation_kind: ${operationKind}`,
                  `result: ${operationOutcome}`,
                  `step: ${operation.step || "не зафиксировано"}`,
                  `reason: ${operation.reason || "unknown"}`,
                  `source: ${operation.source}`,
                  ...writeLines,
                  `target_path: ${operation.path}`,
                ].join("\n")}
              </Box>
              {operation.op === "write" ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.45 }}>
                  точный diff до/после не зафиксирован telemetry; показан только структурный факт изменения.
                </Typography>
              ) : null}
              {operation.source === "fallback" ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  source=fallback: детализация изменения ограничена legacy-полями `artifacts_read/artifacts_written`.
                </Typography>
              ) : null}
            </Box>
            <Box sx={{ mt: 0.75 }}>
              {openable ? (
                <FilePathLink path={operation.path} onClick={onOpenFile} />
              ) : (
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                >
                  {operation.path}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

export function OperativeMemoryModal({
  open,
  onClose,
  documentCount,
  sessionId,
  operations,
  onOpenFile,
  isPathOpenable,
  resolveFilePreview,
  title,
}: {
  open: boolean;
  onClose: () => void;
  documentCount: number;
  sessionId: string | null;
  operations: SessionFileOperation[];
  onOpenFile: (path: string) => void;
  isPathOpenable?: (path: string) => boolean;
  resolveFilePreview?: FilePreviewResolver;
  title?: string;
}) {
  const sortedOperations = React.useMemo(
    () =>
      [...operations].sort((a, b) => {
        const byTime = toDateMs(b.timestamp) - toDateMs(a.timestamp);
        if (byTime !== 0) return byTime;
        return a.path.localeCompare(b.path, "ru");
      }),
    [operations],
  );
  const activeDocuments = React.useMemo(
    () => buildActiveDocuments(sortedOperations),
    [sortedOperations],
  );

  const readCount = sortedOperations.filter((operation) => operation.op === "read").length;
  const writeCount = sortedOperations.filter((operation) => operation.op === "write").length;
  const deleteCount = sortedOperations.filter((operation) => operation.op === "delete").length;
  const hasCountDrift = documentCount !== activeDocuments.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: "calc(100vw - 16px)", sm: "min(940px, calc(100vw - 48px))" },
          height: { xs: "min(92vh, 840px)", sm: "88vh" },
          borderRadius: 2.5,
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {title ?? "Журнал файлов оперативной памяти"}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
              <Chip size="small" variant="outlined" label={`Документов: ${activeDocuments.length}`} />
              {hasCountDrift ? <Chip size="small" variant="outlined" label={`в карточке: ${documentCount}`} /> : null}
              {sessionId ? <Chip size="small" variant="outlined" label={`Сессия: ${sessionId}`} /> : null}
              <Chip size="small" variant="outlined" label={`Операций: ${sortedOperations.length}`} />
              <Chip size="small" variant="outlined" label={`read: ${readCount}`} />
              <Chip size="small" variant="outlined" label={`write: ${writeCount}`} />
              <Chip size="small" variant="outlined" label={`delete: ${deleteCount}`} />
            </Stack>
          </Box>
          <IconButton size="small" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box sx={{ p: 1.5, overflow: "auto", minHeight: 0, flex: 1 }}>
          <Stack spacing={1.25}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.6 }}>
                Используемые документы сейчас
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.8 }}>
                Active-set на конец сессии: `read` фиксирует обращение, `write` закрепляет статус записи, `delete` удаляет документ из набора.
              </Typography>
              {activeDocuments.length === 0 ? (
                <Alert severity="info" variant="outlined">
                  Активный набор пуст. Документы могли быть удалены (`delete`) или не зафиксированы в trace.
                </Alert>
              ) : (
                <Stack spacing={0.6}>
                  {activeDocuments.map((document) => (
                    <ActiveDocumentRow
                      key={`${document.path}:${document.lastTouchedAt || "na"}`}
                      document={document}
                      onOpenFile={onOpenFile}
                      isPathOpenable={isPathOpenable}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.6 }}>
                Лента операций
              </Typography>
              {sortedOperations.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                  Нет зафиксированных операций
                </Typography>
              ) : (
                <Stack spacing={0.75}>
                  {sortedOperations.map((operation, index) => (
                    <OperationRow
                      key={`${operation.path}:${operation.op}:${operation.timestamp}:${operation.step}:${index}`}
                      operation={operation}
                      onOpenFile={onOpenFile}
                      isPathOpenable={isPathOpenable}
                      resolveFilePreview={resolveFilePreview}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
