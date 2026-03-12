import React from "react";
import { Chip, Divider, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";

import type { AgentTaskTimelineEvent } from "../../lib/tasksApi";

function formatDateTime(value: string | null): string {
  if (!value) return "не зафиксировано";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "не зафиксировано";
  return ts.toLocaleString();
}

export function TaskTimeline({ events }: { events: AgentTaskTimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        События пока не зафиксированы.
      </Typography>
    );
  }

  const groups = events.reduce<Array<{ key: string; label: string; items: AgentTaskTimelineEvent[] }>>((acc, event) => {
    const payload = (event.payload && typeof event.payload === "object" && !Array.isArray(event.payload))
      ? event.payload as Record<string, unknown>
      : {};
    const phaseId = String(payload.phase_id || "").trim();
    const phaseLabel = phaseId
      ? String(payload.phase_label || phaseId).trim() || phaseId
      : "Без зафиксированной фазы";
    const key = phaseId || "no-phase";
    const last = acc[acc.length - 1];
    if (last && last.key === key) {
      last.items.push(event);
      return acc;
    }
    acc.push({ key, label: phaseLabel, items: [event] });
    return acc;
  }, []);

  return (
    <Stack spacing={1}>
      {groups.map((group) => (
        <Paper key={group.key} variant="outlined" sx={{ p: 0.8 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
            {group.label}
          </Typography>
          <List dense disablePadding>
            {group.items.map((event, index) => {
              const payload = (event.payload && typeof event.payload === "object" && !Array.isArray(event.payload))
                ? event.payload as Record<string, unknown>
                : {};
              const executionMode = String(payload.execution_mode || "").trim();
              const executionBackend = String(payload.execution_backend || "").trim();
              const readOnly = payload.read_only === true;
              const roundIndex = Number(payload.round_index);
              return (
                <React.Fragment key={event.id}>
                  <ListItem disableGutters sx={{ py: 1 }}>
                    <ListItemText
                      primaryTypographyProps={{ component: "div" }}
                      secondaryTypographyProps={{ component: "div" }}
                      primary={
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} useFlexGap>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {event.step_label || event.event_type || "не зафиксировано"}
                          </Typography>
                          {event.step_key ? <Chip size="small" variant="outlined" label={event.step_key} /> : null}
                          {event.status_to ? <Chip size="small" label={event.status_to} /> : null}
                          {executionMode ? <Chip size="small" variant="outlined" label={executionMode} /> : null}
                          {readOnly ? <Chip size="small" color="info" variant="outlined" label="read-only" /> : null}
                          {Number.isFinite(roundIndex) && roundIndex > 0 ? <Chip size="small" variant="outlined" label={`Раунд ${roundIndex}`} /> : null}
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.2} sx={{ mt: 0.4 }}>
                          {event.step_raw && event.step_raw !== event.step_key ? (
                            <Typography variant="caption" color="text.secondary">
                              Источник шага: {event.step_raw}
                            </Typography>
                          ) : null}
                          <Typography variant="caption" color="text.secondary">
                            Агент: {event.actor_agent_id || "не зафиксировано"}
                          </Typography>
                          {executionBackend ? (
                            <Typography variant="caption" color="text.secondary">
                              Backend: {executionBackend}
                            </Typography>
                          ) : null}
                          <Typography variant="caption" color="text.secondary">
                            Время: {formatDateTime(event.event_time)}
                          </Typography>
                        </Stack>
                      }
                    />
                  </ListItem>
                  {index < group.items.length - 1 ? <Divider component="li" /> : null}
                </React.Fragment>
              );
            })}
          </List>
        </Paper>
      ))}
    </Stack>
  );
}
