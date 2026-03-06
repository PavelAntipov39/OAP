import { Box, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AgentLatestCycleSnapshot } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";

function fmt(value: number | null | undefined, suffix: string, decimals = 0): string {
  if (value == null) return "—";
  return `${value.toFixed(decimals)}${suffix}`;
}

function KpiCell({
  label,
  value,
  tooltip,
  warn,
}: {
  label: string;
  value: string;
  tooltip: string;
  warn?: boolean;
}) {
  return (
    <Box sx={{ minWidth: 96 }}>
      <Stack direction="row" alignItems="center" spacing={0.25} sx={{ mb: 0.25 }}>
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
          {label}
        </Typography>
        <Tooltip title={tooltip} arrow placement="top">
          <InfoOutlinedIcon sx={{ fontSize: 12, color: "text.disabled", cursor: "help" }} />
        </Tooltip>
      </Stack>
      <Typography
        variant="h5"
        sx={{ fontWeight: 800, lineHeight: 1, color: warn ? "warning.main" : "primary.main", fontSize: "1.35rem" }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return "не зафиксировано";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "не зафиксировано";
  return ts.toLocaleString("ru-RU");
}

export function ActivitySection({ cycle }: { cycle: AgentLatestCycleSnapshot }) {
  const lastRun = cycle.latest_cycle?.last_event_at ?? null;
  const eventsTotal = cycle.latest_cycle?.events_total ?? 0;
  const m = cycle.metrics;

  return (
    <SectionBlock
      title="Активность и метрики качества"
      tooltip="KPI последнего цикла агента: успешность верификации, фиксация уроков, реализация рекомендаций, время цикла"
    >
      <Box>
        <Typography variant="body2" color="text.secondary">
          Последний запуск
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {formatDateTime(lastRun)}
        </Typography>
      </Box>

      <Stack direction="row" spacing={2.5} useFlexGap flexWrap="wrap">
        <KpiCell
          label="Событий"
          value={eventsTotal > 0 ? String(eventsTotal) : "—"}
          tooltip="Количество зафиксированных событий в последнем цикле"
        />
        <KpiCell
          label="Верификация"
          value={fmt(m.verification_pass_rate, "%")}
          tooltip="verify_passed / verify_started × 100 — доля успешных проверок"
          warn={m.verification_pass_rate != null && m.verification_pass_rate < 80}
        />
        <KpiCell
          label="Уроки"
          value={fmt(m.lesson_capture_rate, "%")}
          tooltip="lesson_captured / (verify_passed + verify_failed) × 100 — стабильность фиксации уроков"
          warn={m.lesson_capture_rate != null && m.lesson_capture_rate < 80}
        />
        <KpiCell
          label="Ошибки review"
          value={fmt(m.review_error_rate, "", 2)}
          tooltip="review_errors_total / completed_tasks — среднее число ошибок на задачу"
          warn={m.review_error_rate != null && m.review_error_rate > 0}
        />
        <KpiCell
          label="Рекомендации"
          value={fmt(m.recommendation_action_rate, "%")}
          tooltip="recommendations_applied / recommendations_suggested × 100 — % предложенных рекомендаций, которые были применены"
          warn={m.recommendation_action_rate != null && m.recommendation_action_rate < 50}
        />
        <KpiCell
          label="Перепланирование"
          value={fmt(m.replan_rate, "%")}
          tooltip="replanned / planned × 100 — как часто план пересматривается внутри цикла"
          warn={m.replan_rate != null && m.replan_rate > 30}
        />
        <KpiCell
          label="Время цикла"
          value={fmt(m.time_to_solution_min, " мин", 0)}
          tooltip="Длительность последнего завершённого цикла от started до completed"
        />
        <KpiCell
          label="Время решения"
          value={m.decision_time_avg_ms != null ? fmt(m.decision_time_avg_ms / 1000, " с", 1) : "—"}
          tooltip="Среднее время принятия решения о выборе улучшения (metrics.decision_time_ms в логах)"
        />
      </Stack>
    </SectionBlock>
  );
}
