import React from "react";
import { Box, Divider, Paper, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AnalystSession } from "../../lib/analystCardData";

function formatDateTime(value: string): string {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "—";
  return ts.toLocaleString("ru-RU");
}

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ч ${m}мин`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function SessionHeaderMetrics({ session }: { session: AnalystSession }) {
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
      {/* Session number and basic info */}
      <Stack spacing={2}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            № сессии цикла
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {session.id.slice(0, 8)}
          </Typography>
        </Box>

        <Divider />

        {/* Timing info */}
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Начало сессии цикла
                </Typography>
                <Tooltip title="Время старта сессии">
                  <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
                </Tooltip>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatDateTime(session.startedAt)}
              </Typography>
            </Box>

            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Завершение
                </Typography>
                <Tooltip title="Время завершения сессии">
                  <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
                </Tooltip>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatDateTime(session.completedAt)}
              </Typography>
            </Box>

            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Длительность
                </Typography>
                <Tooltip title="Общее время выполнения сессии">
                  <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
                </Tooltip>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatDuration(session.durationMs)}
              </Typography>
            </Box>
          </Stack>
        </Stack>

        <Divider />

        {/* Resource usage */}
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Расход токенов за 1 цикл сессии
                </Typography>
                <Tooltip title="Всего токенов использовано в этой сессии">
                  <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
                </Tooltip>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {formatTokens(session.tokensUsed)}
              </Typography>
            </Box>

            <Box>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  Кол-во ошибок за 1 цикл сессии
                </Typography>
                <Tooltip title="Количество ошибок, произошедших в этой сессии">
                  <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
                </Tooltip>
              </Stack>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: session.errorsCount > 0 ? "error.main" : "success.main",
                }}
              >
                {session.errorsCount}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
