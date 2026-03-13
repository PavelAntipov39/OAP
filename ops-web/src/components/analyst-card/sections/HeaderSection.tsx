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

type AgentTypeMeta = {
  label: string;
  color: "primary" | "info" | "default";
  description: string;
};

const AGENT_TYPE_META: Record<AgentSummary["agentClass"], AgentTypeMeta> = {
  core: {
    label: "Автономный агент",
    color: "primary",
    description: "Самостоятельная роль системы: может быть основной точкой входа в задачу.",
  },
  specialist: {
    label: "Процессный агент",
    color: "info",
    description: "Узкий sub-agent: подключается внутри цикла и работает через orchestration.",
  },
};

const AGENT_TYPE_FALLBACK: AgentTypeMeta = {
  label: "Процессный агент",
  color: "default",
  description: "Тип агента уточняется.",
};

function resolveAgentTypeMeta(agentClass: unknown): AgentTypeMeta {
  return agentClass === "core" || agentClass === "specialist"
    ? AGENT_TYPE_META[agentClass]
    : AGENT_TYPE_FALLBACK;
}

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
  const agentTypeMeta = resolveAgentTypeMeta((agent as { agentClass?: string | null }).agentClass);
  const agentTypeTooltip = (
    <Box sx={{ p: 0.25 }}>
      <Typography variant="caption" display="block" fontWeight={700} sx={{ mb: 0.5 }}>
        Тип агента:
      </Typography>
      <Typography variant="caption" display="block">{agentTypeMeta.description}</Typography>
    </Box>
  );

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
        <Tooltip title={agentTypeTooltip} arrow placement="top">
          <Chip
            size="small"
            variant="outlined"
            color={agentTypeMeta.color}
            label={agentTypeMeta.label}
            sx={{ cursor: "help" }}
          />
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
