import React from "react";
import {
  Button,
  ButtonBase,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { AnalystSession } from "../../../lib/analystCardData";
import { SectionBlock } from "../SectionBlock";

function formatDateTime(value: string): string {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "—";
  return ts.toLocaleString("ru-RU");
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function SessionsSection({
  sessions,
  onOpenFile,
  onSelectSession,
}: {
  sessions: AnalystSession[];
  onOpenFile: (path: string) => void;
  onSelectSession?: (session: AnalystSession) => void;
}) {
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const filtered = sessions.filter((s) => {
    const d = s.completedAt.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  const handleToday = () => {
    const today = toInputDate(new Date());
    setDateFrom(today);
    setDateTo(today);
  };

  return (
    <SectionBlock
      title="Сессии"
      tooltip="История рабочих сессий агента. Каждая сессия содержит логи, метрики, задействованный контекст и MCP"
    >
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <TextField
          type="date"
          size="small"
          label="От"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 155 }}
        />
        <TextField
          type="date"
          size="small"
          label="До"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 155 }}
        />
        <Button size="small" variant="outlined" onClick={handleToday} sx={{ textTransform: "none" }}>
          Сегодня
        </Button>
        {(dateFrom || dateTo) ? (
          <Button
            size="small"
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            sx={{ textTransform: "none" }}
          >
            Сбросить
          </Button>
        ) : null}
      </Stack>

      {filtered.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Нет сессий за выбранный период
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {filtered.map((session, idx) => (
            <Paper 
              key={session.id}
              elevation={0}
              sx={{ 
                border: 1, 
                borderColor: "divider", 
                borderRadius: "6px",
              }}
            >
              <ButtonBase
                onClick={() => onSelectSession?.(session)}
                disabled={!onSelectSession}
                sx={{
                  width: "100%",
                  p: 1.5,
                  display: "flex",
                  justifyContent: "flex-start",
                  textAlign: "left",
                  borderRadius: "6px",
                  cursor: onSelectSession ? "pointer" : "default",
                  "&:hover": onSelectSession ? { bgcolor: "action.hover" } : {},
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap" sx={{ width: "100%" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    №{filtered.length - idx}
                  </Typography>
                  <Typography variant="body2">
                    {formatDateTime(session.completedAt)}
                  </Typography>
                  <Chip size="small" variant="outlined" label={`${session.tasksTotal} задач`} />
                  {session.errorsCount > 0 ? (
                    <Chip size="small" color="error" variant="outlined" label={`${session.errorsCount} ошибок`} />
                  ) : null}
                </Stack>
              </ButtonBase>
            </Paper>
          ))}
        </Stack>
      )}
    </SectionBlock>
  );
}
