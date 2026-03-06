import React from "react";
import {
  Box,
  Chip,
  Collapse,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TerminalIcon from "@mui/icons-material/Terminal";
import StorageIcon from "@mui/icons-material/Storage";
import EditNoteIcon from "@mui/icons-material/EditNote";
import SearchIcon from "@mui/icons-material/Search";
import DescriptionIcon from "@mui/icons-material/Description";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PublicIcon from "@mui/icons-material/Public";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import BlockIcon from "@mui/icons-material/Block";
import type { SessionActionStep } from "../../../lib/analystCardData";

const TOOL_ICONS: Record<string, React.ReactElement> = {
  Read: <DescriptionIcon sx={{ fontSize: 16 }} />,
  Write: <EditNoteIcon sx={{ fontSize: 16 }} />,
  Edit: <EditNoteIcon sx={{ fontSize: 16 }} />,
  Grep: <SearchIcon sx={{ fontSize: 16 }} />,
  Glob: <SearchIcon sx={{ fontSize: 16 }} />,
  Bash: <TerminalIcon sx={{ fontSize: 16 }} />,
  Supabase: <StorageIcon sx={{ fontSize: 16 }} />,
  Agent: <SmartToyIcon sx={{ fontSize: 16 }} />,
  WebSearch: <PublicIcon sx={{ fontSize: 16 }} />,
  WebFetch: <PublicIcon sx={{ fontSize: 16 }} />,
};

const STATUS_CONFIG: Record<
  SessionActionStep["status"],
  { icon: React.ReactElement; color: string; label: string }
> = {
  success: {
    icon: <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />,
    color: "#16a34a",
    label: "OK",
  },
  error: {
    icon: <ErrorOutlineIcon sx={{ fontSize: 14 }} />,
    color: "#dc2626",
    label: "Ошибка",
  },
  running: {
    icon: <HourglassEmptyIcon sx={{ fontSize: 14 }} />,
    color: "#d97706",
    label: "Выполняется",
  },
  skipped: {
    icon: <BlockIcon sx={{ fontSize: 14 }} />,
    color: "#6b7280",
    label: "Пропущено",
  },
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ActionRow({ step }: { step: SessionActionStep }) {
  const [expanded, setExpanded] = React.useState(false);
  const statusCfg = STATUS_CONFIG[step.status];
  const toolIcon = TOOL_ICONS[step.tool] ?? <BuildIcon sx={{ fontSize: 16 }} />;

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
      {/* Header row — clickable */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onClick={() => setExpanded((v) => !v)}
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
        {/* Expand chevron */}
        <Box sx={{ color: "text.secondary", display: "flex", alignItems: "center" }}>
          {expanded ? (
            <ExpandMoreIcon sx={{ fontSize: 18 }} />
          ) : (
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          )}
        </Box>

        {/* Tool icon */}
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
          {toolIcon}
        </Box>

        {/* Tool name chip */}
        <Chip
          label={step.tool}
          size="small"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.75rem",
            fontWeight: 600,
            height: 22,
            bgcolor: "rgba(27, 95, 168, 0.08)",
            color: "primary.dark",
          }}
        />

        {/* Title */}
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
          {step.title}
        </Typography>

        {/* Duration */}
        <Typography
          variant="caption"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "text.secondary",
            flexShrink: 0,
          }}
        >
          {formatDuration(step.durationMs)}
        </Typography>

        {/* Status */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            color: statusCfg.color,
            flexShrink: 0,
          }}
        >
          {statusCfg.icon}
        </Box>

        {/* Timestamp */}
        <Typography
          variant="caption"
          sx={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            color: "text.secondary",
            flexShrink: 0,
            minWidth: 42,
            textAlign: "right",
          }}
        >
          {step.timestamp}
        </Typography>
      </Stack>

      {/* Expandable content — Input / Output */}
      <Collapse in={expanded}>
        <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
          {/* Input */}
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
                maxHeight: 200,
              }}
            >
              {step.input || "—"}
            </Box>
          </Box>

          {/* Output */}
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
                bgcolor: step.status === "error" ? "rgba(220, 38, 38, 0.06)" : "#f1f5f9",
                color: step.status === "error" ? "#dc2626" : "#334155",
                border: step.status === "error" ? "1px solid rgba(220, 38, 38, 0.2)" : "1px solid rgba(15, 23, 42, 0.08)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.78rem",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                m: 0,
                overflow: "auto",
                maxHeight: 200,
              }}
            >
              {step.output || "—"}
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}

export function SessionActionLogModal({
  open,
  onClose,
  actions,
  sessionLabel,
}: {
  open: boolean;
  onClose: () => void;
  actions: SessionActionStep[];
  sessionLabel?: string;
}) {
  const successCount = actions.filter((a) => a.status === "success").length;
  const errorCount = actions.filter((a) => a.status === "error").length;
  const totalDuration = actions.reduce((sum, a) => sum + (a.durationMs ?? 0), 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: "calc(100vw - 16px)", sm: "min(860px, calc(100vw - 48px))" },
          height: { xs: "min(92vh, 820px)", sm: "88vh" },
          borderRadius: 2.5,
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Журнал действий агента во время цикла сессии
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
              {sessionLabel ? (
                <Chip size="small" variant="outlined" label={sessionLabel} />
              ) : null}
              <Chip size="small" variant="outlined" label={`${actions.length} действий`} />
              <Chip
                size="small"
                variant="outlined"
                label={`${successCount} успешных`}
                sx={{ color: "#16a34a", borderColor: "rgba(22, 163, 74, 0.3)" }}
              />
              {errorCount > 0 ? (
                <Chip
                  size="small"
                  variant="outlined"
                  color="error"
                  label={`${errorCount} ошибок`}
                />
              ) : null}
              <Chip
                size="small"
                variant="outlined"
                label={`Общее время: ${formatDuration(totalDuration)}`}
              />
            </Stack>
          </Box>
          <IconButton size="small" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Box sx={{ p: 1.5, overflow: "auto", minHeight: 0, flex: 1 }}>
          {actions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
              Нет зафиксированных действий
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {actions.map((action) => (
                <ActionRow key={action.id} step={action} />
              ))}
            </Stack>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
