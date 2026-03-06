import React from "react";
import { Chip, Divider, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";

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

  return (
    <List dense disablePadding>
      {events.map((event, index) => (
        <React.Fragment key={event.id}>
          <ListItem disableGutters sx={{ py: 1 }}>
            <ListItemText
              primaryTypographyProps={{ component: "div" }}
              secondaryTypographyProps={{ component: "div" }}
              primary={
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} useFlexGap>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {event.event_type || "не зафиксировано"}
                  </Typography>
                  {event.status_to ? <Chip size="small" label={event.status_to} /> : null}
                </Stack>
              }
              secondary={
                <Stack spacing={0.2} sx={{ mt: 0.4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Агент: {event.actor_agent_id || "не зафиксировано"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Время: {formatDateTime(event.event_time)}
                  </Typography>
                </Stack>
              }
            />
          </ListItem>
          {index < events.length - 1 ? <Divider component="li" /> : null}
        </React.Fragment>
      ))}
    </List>
  );
}
