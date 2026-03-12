import React from "react";
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type {
  AgentImprovementHistoryEvent,
  AgentImprovementHistoryResultStatus,
  AgentImprovementHistorySourceTool,
} from "../../../lib/generatedData";

type StatusFilter = "all" | "applied" | "rollback" | "rejected";
type ToolFilter = "all" | AgentImprovementHistorySourceTool;

const STATUS_LABEL: Record<AgentImprovementHistoryResultStatus, string> = {
  captured: "Зафиксировано",
  applied: "Применено",
  verified: "Проверено",
  rollback: "Откат",
  rejected: "Отклонено",
};

const STATUS_COLOR: Record<AgentImprovementHistoryResultStatus, "default" | "success" | "warning" | "error" | "info"> = {
  captured: "info",
  applied: "success",
  verified: "success",
  rollback: "warning",
  rejected: "error",
};

const TOOL_LABEL: Record<AgentImprovementHistorySourceTool, string> = {
  codex: "Codex",
  copilot: "GitHub Copilot",
  claude: "Claude",
  other: "Другой источник",
};

function formatDateTime(value: string): string {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return "не зафиксировано";
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function asText(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  return normalized || "не зафиксировано";
}

function asPath(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return /^https?:\/\//i.test(normalized) ? null : normalized;
}

function asUrl(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  return /^https?:\/\//i.test(normalized) ? normalized : null;
}

function filterByStatus(event: AgentImprovementHistoryEvent, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "applied") {
    return event.result_status === "applied" || event.result_status === "verified";
  }
  if (filter === "rollback") return event.result_status === "rollback";
  return event.result_status === "rejected";
}

export function ImprovementHistoryModal({
  open,
  onClose,
  agentName,
  events,
  onOpenFile,
}: {
  open: boolean;
  onClose: () => void;
  agentName: string;
  events: AgentImprovementHistoryEvent[];
  onOpenFile: (path: string) => void;
}) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [toolFilter, setToolFilter] = React.useState<ToolFilter>("all");

  React.useEffect(() => {
    if (!open) {
      setStatusFilter("all");
      setToolFilter("all");
    }
  }, [open]);

  const filteredEvents = React.useMemo(() => {
    return events
      .filter((event) => filterByStatus(event, statusFilter))
      .filter((event) => (toolFilter === "all" ? true : event.source_tool === toolFilter));
  }, [events, statusFilter, toolFilter]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pb: 1.25 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              История улучшений агента
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {agentName}: лента изменений в формате «Откуда → Что взяли → Что изменили → Где применили → Результат».
            </Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Закрыть историю улучшений агента">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 2 }}>
        <Stack spacing={1.25}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap>
            <TextField
              select
              size="small"
              label="Статус"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="applied">Применено</MenuItem>
              <MenuItem value="rollback">Откат</MenuItem>
              <MenuItem value="rejected">Отклонено</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label="Источник"
              value={toolFilter}
              onChange={(event) => setToolFilter(event.target.value as ToolFilter)}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="all">Все</MenuItem>
              <MenuItem value="codex">Codex</MenuItem>
              <MenuItem value="copilot">GitHub Copilot</MenuItem>
              <MenuItem value="claude">Claude</MenuItem>
              <MenuItem value="other">Другой источник</MenuItem>
            </TextField>
            <Box sx={{ display: "flex", alignItems: "center", ml: "auto" }}>
              <Typography variant="caption" color="text.secondary">
                Показано: {filteredEvents.length} из {events.length}
              </Typography>
            </Box>
          </Stack>

          {filteredEvents.length === 0 ? (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                По выбранным фильтрам записей нет.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1}>
              {filteredEvents.map((event) => {
                const sourceUrl = asUrl(event.source_ref);
                const sourcePath = asPath(event.source_ref);
                const evidenceRefs = Array.isArray(event.evidence_refs) ? event.evidence_refs : [];
                const metricDeltaLabel = event.metric_delta == null ? "не зафиксировано" : `${event.metric_delta}`;

                return (
                  <Paper key={event.event_id} variant="outlined" sx={{ p: 1.2 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {formatDateTime(event.occurred_at)}
                        </Typography>
                        <Chip size="small" variant="outlined" label={STATUS_LABEL[event.result_status]} color={STATUS_COLOR[event.result_status]} />
                        <Chip size="small" variant="outlined" label={TOOL_LABEL[event.source_tool]} />
                      </Stack>

                      <Box>
                        <Typography variant="caption" color="text.secondary">Откуда</Typography>
                        <Typography variant="body2" sx={{ mt: 0.2 }}>
                          {sourceUrl ? (
                            <Link href={sourceUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                              {sourceUrl}
                            </Link>
                          ) : sourcePath ? (
                            <Link
                              component="button"
                              type="button"
                              underline="hover"
                              sx={{ textAlign: "left" }}
                              onClick={() => onOpenFile(sourcePath)}
                            >
                              {sourcePath}
                            </Link>
                          ) : (
                            asText(event.source_ref)
                          )}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">Что взяли</Typography>
                        <Typography variant="body2" sx={{ mt: 0.2 }}>{asText(event.extracted_value)}</Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">Что изменили</Typography>
                        <Typography variant="body2" sx={{ mt: 0.2 }}>{asText(event.applied_change)}</Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">Где применили</Typography>
                        <Typography variant="body2" sx={{ mt: 0.2 }}>
                          {asText(event.target_scope)} · агент: {asText(event.agent_id)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="caption" color="text.secondary">Результат</Typography>
                        <Typography variant="body2" sx={{ mt: 0.2 }}>
                          {STATUS_LABEL[event.result_status]} · {asText(event.result_note)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.15 }}>
                          Метрика: {asText(event.metric_name)} · Δ: {metricDeltaLabel}
                        </Typography>
                      </Box>

                      <Divider />

                      <Box>
                        <Typography variant="caption" color="text.secondary">Доказательства</Typography>
                        {evidenceRefs.length === 0 ? (
                          <Typography variant="body2" sx={{ mt: 0.2 }}>не зафиксировано</Typography>
                        ) : (
                          <Stack spacing={0.3} sx={{ mt: 0.2 }}>
                            {evidenceRefs.map((ref) => {
                              const refUrl = asUrl(ref);
                              const refPath = asPath(ref);
                              if (refUrl) {
                                return (
                                  <Link key={`${event.event_id}-${ref}`} href={refUrl} target="_blank" rel="noopener noreferrer" underline="hover">
                                    {refUrl}
                                  </Link>
                                );
                              }
                              if (refPath) {
                                return (
                                  <Link
                                    key={`${event.event_id}-${ref}`}
                                    component="button"
                                    type="button"
                                    underline="hover"
                                    sx={{ textAlign: "left", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                                    onClick={() => onOpenFile(refPath)}
                                  >
                                    {refPath}
                                  </Link>
                                );
                              }
                              return (
                                <Typography key={`${event.event_id}-${ref}`} variant="body2">
                                  {ref}
                                </Typography>
                              );
                            })}
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
