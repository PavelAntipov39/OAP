import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { AnalystSession } from "../../../lib/analystCardData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";
import { SessionFileLogModal } from "../modals/SessionFileLogModal";
import { SessionSearchModal } from "../modals/SessionSearchModal";
import { SessionMetricsModal } from "../modals/SessionMetricsModal";
import { SessionActionLogModal } from "../modals/SessionActionLogModal";

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

function formatDateTime(value: string): string {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "—";
  return ts.toLocaleString("ru-RU");
}

function formatDate(value: string): string {
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "—";
  return ts.toLocaleDateString("ru-RU");
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function SessionsSection({
  sessions,
  onOpenFile,
}: {
  sessions: AnalystSession[];
  onOpenFile: (path: string) => void;
}) {
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [logModal, setLogModal] = React.useState<AnalystSession | null>(null);
  const [searchModal, setSearchModal] = React.useState<AnalystSession | null>(null);
  const [metricsModal, setMetricsModal] = React.useState<AnalystSession | null>(null);
  const [actionLogModal, setActionLogModal] = React.useState<AnalystSession | null>(null);

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
            <Accordion key={session.id} disableGutters elevation={0} sx={{ border: 1, borderColor: "divider", borderRadius: "6px", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
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
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.25}>
                  <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
                    <Box>
                      <Typography variant="caption" color="text.secondary">Время завершения</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDateTime(session.completedAt)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Длительность</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDuration(session.durationMs)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Токенов</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatTokens(session.tokensUsed)}</Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">
                      Всего задач: <strong>{session.tasksTotal}</strong>
                    </Typography>
                    {session.errorsCount > 0 ? (
                      <Typography variant="body2" color="error.main">
                        | Ошибок: <strong>{session.errorsCount}</strong>
                      </Typography>
                    ) : null}
                    {session.risksCount > 0 ? (
                      <Typography variant="body2" color="warning.main">
                        | Рисков: <strong>{session.risksCount}</strong>
                      </Typography>
                    ) : null}
                  </Stack>

                  <Divider />

                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Button size="small" variant="outlined" onClick={() => setLogModal(session)} sx={{ textTransform: "none" }}>
                      Лог по файлам
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => setSearchModal(session)} sx={{ textTransform: "none" }}>
                      Процесс поиска информации
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => setMetricsModal(session)} sx={{ textTransform: "none" }}>
                      Целевые метрики
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => setActionLogModal(session)} sx={{ textTransform: "none" }}>
                      Журнал действий агента во время цикла сессии
                    </Button>
                  </Stack>

                  <Divider />

                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Метрика эффективности</Typography>
                  <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
                    <Box>
                      <Typography variant="caption" color="text.secondary">Контекст токенов</Typography>
                      <Typography variant="body2">{formatTokens(session.efficiency.contextTokens)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Полезных</Typography>
                      <Typography variant="body2">{formatTokens(session.efficiency.usefulTokens)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Cache hit rate</Typography>
                      <Typography variant="body2">{session.efficiency.cacheHitRate != null ? `${Math.round(session.efficiency.cacheHitRate * 100)}%` : "—"}</Typography>
                    </Box>
                  </Stack>

                  <Divider />

                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Оперативная память</Typography>
                  {session.operativeMemory.map((m) => (
                    <Stack key={m.path} spacing={0.15}>
                      <Typography variant="body2">{m.title}</Typography>
                      <FilePathLink path={m.path} onClick={onOpenFile} />
                    </Stack>
                  ))}

                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Долговременная память</Typography>
                  {session.persistentMemory.map((m) => (
                    <Stack key={m.path} spacing={0.15}>
                      <Typography variant="body2">{m.title}</Typography>
                      <FilePathLink path={m.path} onClick={onOpenFile} />
                    </Stack>
                  ))}

                  <Divider />

                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Задействованные MCP</Typography>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    {session.mcpUsed.map((mcp) => (
                      <Chip key={mcp.name} size="small" label={`${mcp.name} (${mcp.status})`} color="success" variant="outlined" />
                    ))}
                  </Stack>

                  {session.controlTaskListUrl ? (
                    <>
                      <Divider />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Контроль</Typography>
                      <Link href={session.controlTaskListUrl} underline="hover" variant="body2">
                        Список выполненных задач
                      </Link>
                    </>
                  ) : null}
                </Stack>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}

      <SessionFileLogModal
        open={logModal !== null}
        onClose={() => setLogModal(null)}
        entries={logModal?.fileLog ?? []}
      />
      <SessionSearchModal
        open={searchModal !== null}
        onClose={() => setSearchModal(null)}
        searchProcess={searchModal?.searchProcess ?? { approach: "", steps: [], quality: "" }}
      />
      <SessionMetricsModal
        open={metricsModal !== null}
        onClose={() => setMetricsModal(null)}
        metrics={metricsModal?.targetMetrics ?? {}}
      />
      <SessionActionLogModal
        open={actionLogModal !== null}
        onClose={() => setActionLogModal(null)}
        actions={actionLogModal?.actionLog ?? []}
        sessionLabel={actionLogModal ? `Сессия ${actionLogModal.id}` : undefined}
      />
    </SectionBlock>
  );
}
