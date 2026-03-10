import React from "react";
import { Box, Link, Paper, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AnalystSession } from "../../lib/analystCardData";

export function SessionTasksBlock({
  session,
  cycleTaskCount,
  onOpenFile,
}: {
  session: AnalystSession;
  cycleTaskCount?: number | null;
  onOpenFile: (path: string) => void;
}) {
  const displayCount = cycleTaskCount ?? 0;
  const handleTasksLink = () => {
    const url = new URL(window.location.href);
    url.hash = `#/tasks?session_id=${encodeURIComponent(session.id)}`;
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: "#fff",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "8px",
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Список задач создано:
          </Typography>
          <Tooltip title="Количество задач, созданных в данной сессии">
            <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
          </Tooltip>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 700, color: "primary.main" }}>
            {displayCount}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            задач
          </Typography>
        </Stack>

        {displayCount > 0 && (
          <Box sx={{ mt: 1 }}>
            <Link
              component="button"
              onClick={handleTasksLink}
              type="button"
              variant="body2"
              sx={{
                color: "primary.main",
                textDecoration: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              Открыть список задач по этой сессии →
            </Link>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
