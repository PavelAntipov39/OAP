import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AgentSummary } from "../../../lib/generatedData";

const STATUS_LABEL: Record<AgentSummary["status"], string> = {
  healthy: "Стабильно",
  degraded: "Деградация",
  offline: "Оффлайн",
};

const STATUS_COLOR: Record<AgentSummary["status"], "success" | "warning" | "default"> = {
  healthy: "success",
  degraded: "warning",
  offline: "default",
};

const STATUS_TOOLTIP = (
  <Box sx={{ p: 0.25 }}>
    <Typography variant="caption" display="block" fontWeight={700} sx={{ mb: 0.5 }}>
      Статусы агента:
    </Typography>
    <Typography variant="caption" display="block">✅ Стабильно — агент работает без ошибок и деградаций</Typography>
    <Typography variant="caption" display="block">⚠️ Деградация — агент работает, но с ошибками или сниженной эффективностью</Typography>
    <Typography variant="caption" display="block">⛔ Оффлайн — агент не активен, цикл не запускается</Typography>
  </Box>
);

function formatRunAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function HeaderSection({
  agent,
  lastRunAt,
}: {
  agent: AgentSummary;
  lastRunAt?: string | null;
}) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Tooltip title={STATUS_TOOLTIP} arrow placement="right">
          <Chip
            size="small"
            color={STATUS_COLOR[agent.status]}
            label={STATUS_LABEL[agent.status]}
            sx={{ cursor: "help" }}
          />
        </Tooltip>
        <Tooltip title={STATUS_TOOLTIP} arrow placement="top">
          <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.secondary", cursor: "help" }} />
        </Tooltip>
      </Stack>
      {lastRunAt ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontSize: "0.82rem" }}>
          Последний запуск: {formatRunAt(lastRunAt)}
        </Typography>
      ) : null}
    </Box>
  );
}
