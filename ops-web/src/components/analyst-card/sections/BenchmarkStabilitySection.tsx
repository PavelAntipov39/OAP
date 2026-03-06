import { Alert, Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AgentBenchmarkSummary } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";

type BenchmarkSnapshot = Record<string, unknown> & { agent_id?: string };

type MetricConfig = {
  key: string;
  label: string;
  description: string;
  formula: string;
  source: string;
  format: (value: number | null) => string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatPercent(value: number | null): string {
  if (value === null) return "не зафиксировано";
  const normalized = value <= 1 ? value * 100 : value;
  return `${roundTo(normalized, 1).toFixed(1)}%`;
}

function formatDuration(value: number | null): string {
  if (value === null) return "не зафиксировано";
  if (value < 1000) return `${Math.round(value)} мс`;
  return `${roundTo(value / 1000, 2).toFixed(2)} с`;
}

function formatCurrency(value: number | null): string {
  if (value === null) return "не зафиксировано";
  return `$${roundTo(value, 3).toFixed(3)}`;
}

function formatHours(value: number | null): string {
  if (value === null) return "не зафиксировано";
  return `${roundTo(value, 1).toFixed(1)} ч`;
}

function formatPlain(value: number | null): string {
  if (value === null) return "не зафиксировано";
  return roundTo(value, 4).toFixed(4);
}

function MetricRow({
  metric,
  value,
}: {
  metric: MetricConfig;
  value: number | null;
}) {
  return (
    <Box sx={{ pt: 0.75, borderTop: "1px solid", borderColor: "divider" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} alignItems={{ sm: "center" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.35} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {metric.label}
            </Typography>
            <Tooltip
              arrow
              placement="top-start"
              title={
                <Box sx={{ maxWidth: 420 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: "block" }}>
                    Как считается
                  </Typography>
                  <Typography variant="caption" sx={{ display: "block" }}>
                    {metric.formula}
                  </Typography>
                  <Typography variant="caption" sx={{ mt: 0.4, display: "block", opacity: 0.95 }}>
                    Источник: {metric.source}
                  </Typography>
                </Box>
              }
            >
              <IconButton size="small" aria-label={`Как считается метрика ${metric.key}`} sx={{ p: 0.4 }}>
                <InfoOutlinedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {metric.description}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: { sm: 135 }, textAlign: { sm: "right" } }}>
          {metric.format(value)}
        </Typography>
      </Stack>
    </Box>
  );
}

function buildSnapshot(summary: AgentBenchmarkSummary, agentId: string): BenchmarkSnapshot | null {
  const list = summary.agents;
  if (Array.isArray(list)) {
    const found = list.find((item) => asString((item as { agent_id?: unknown }).agent_id) === agentId);
    if (found && typeof found === "object") {
      return found as BenchmarkSnapshot;
    }
  }

  if (asString(summary.run?.agent_id) === agentId) {
    return {
      agent_id: agentId,
      ...summary.metrics,
      ...summary.impact_metrics,
      ...summary.telemetry_metrics,
    };
  }

  return null;
}

const QUALITY_METRICS: MetricConfig[] = [
  {
    key: "pass_at_5",
    label: "Стабильность pass@5",
    description: "Доля кейсов, где хотя бы один из 5 повторов успешен.",
    formula: "successful_cases / cases_total * 100",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPercent,
  },
  {
    key: "fact_coverage_mean",
    label: "Покрытие фактов",
    description: "Среднее покрытие ожидаемых фактов в ответах.",
    formula: "avg(facts_covered / expected_facts) * 100",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPercent,
  },
  {
    key: "schema_valid_rate",
    label: "Валидность схемы",
    description: "Доля ответов, прошедших структурную валидацию.",
    formula: "valid_schema_attempts / attempts_total * 100",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPercent,
  },
  {
    key: "trajectory_compliance_rate",
    label: "Соблюдение траектории",
    description: "Доля прогонов с корректным lifecycle-процессом.",
    formula: "trajectory_ok_attempts / attempts_total * 100",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPercent,
  },
  {
    key: "judge_disagreement_rate",
    label: "Несогласие judge/human",
    description: "Доля расхождений между LLM-судьей и human-проверкой.",
    formula: "judge_human_disagreements / human_calibrated_cases * 100",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPercent,
  },
  {
    key: "cost_per_success",
    label: "Стоимость успеха",
    description: "Средняя стоимость одного успешного benchmark-кейса.",
    formula: "cost_total_usd / successful_cases",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatCurrency,
  },
  {
    key: "pass_rate_variance",
    label: "Дисперсия pass-rate",
    description: "Разброс результата по кейсам (меньше = стабильнее).",
    formula: "var(case_pass_rate)",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPlain,
  },
  {
    key: "latency_p95_ms",
    label: "Latency p95",
    description: "95-й перцентиль времени ответа benchmark-прогонов.",
    formula: "p95(latency_ms)",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatDuration,
  },
];

const IMPACT_METRICS: MetricConfig[] = [
  {
    key: "recommendation_executability_rate",
    label: "Исполнимость рекомендаций",
    description: "Доля рекомендаций, которые можно сразу внедрять.",
    formula: "executable_recommendations / total_recommendations * 100",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPercent,
  },
  {
    key: "evidence_link_coverage",
    label: "Покрытие evidence-ссылками",
    description: "Доля рекомендаций с подтверждающими ссылками.",
    formula: "recommendations_with_evidence_links / total_recommendations * 100",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPercent,
  },
  {
    key: "time_to_action_p50",
    label: "Время до действия p50",
    description: "Медианное время от рекомендации до начала внедрения.",
    formula: "median(time_to_action_hours)",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatHours,
  },
  {
    key: "validated_impact_rate",
    label: "Подтвержденный impact",
    description: "Доля рекомендаций с подтвержденным эффектом.",
    formula: "recommendations_with_validated_impact / recommendations_applied * 100",
    source: "artifacts/agent_benchmark_summary.json",
    format: formatPercent,
  },
];

export function BenchmarkStabilitySection({
  summary,
  agentId,
}: {
  summary: AgentBenchmarkSummary;
  agentId: string;
}) {
  const snapshot = buildSnapshot(summary, agentId);
  const runId = asString(summary.run?.run_id);
  const casesTotal = asFiniteNumber(summary.dataset?.cases_total);
  const attemptsTotal = asFiniteNumber(summary.metrics?.attempts_total);
  const gateStatus = snapshot ? summary.gate?.status : null;
  const failedMetrics = Array.isArray(summary.gate?.failed_metrics) ? summary.gate.failed_metrics : [];
  const missingMetrics = Array.isArray(summary.gate?.missing_metrics) ? summary.gate.missing_metrics : [];

  return (
    <SectionBlock
      title="Benchmark стабильность"
      tooltip="Local-first benchmark quality: стабильность, качество ответа, impact рекомендаций и gate-статус."
    >
      {snapshot ? (
        <Stack spacing={1}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} useFlexGap flexWrap="wrap" alignItems={{ sm: "center" }}>
            <Typography variant="body2">run_id: {runId || "не зафиксировано"}</Typography>
            <Typography variant="body2">кейсы: {casesTotal === null ? "не зафиксировано" : Math.round(casesTotal)}</Typography>
            <Typography variant="body2">attempts: {attemptsTotal === null ? "не зафиксировано" : Math.round(attemptsTotal)}</Typography>
            {gateStatus ? (
              <Chip
                size="small"
                color={gateStatus === "passed" ? "success" : gateStatus === "failed" ? "error" : "warning"}
                variant={gateStatus === "warning" ? "outlined" : "filled"}
                label={`Benchmark gate: ${gateStatus}`}
              />
            ) : null}
          </Stack>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
              Стабильность и качество ответа
            </Typography>
            <Stack spacing={0.65}>
              {QUALITY_METRICS.map((metric) => (
                <MetricRow
                  key={metric.key}
                  metric={metric}
                  value={asFiniteNumber(snapshot[metric.key])}
                />
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.25 }}>
              Impact рекомендаций
            </Typography>
            <Stack spacing={0.65}>
              {IMPACT_METRICS.map((metric) => (
                <MetricRow
                  key={metric.key}
                  metric={metric}
                  value={asFiniteNumber(snapshot[metric.key])}
                />
              ))}
            </Stack>
          </Box>

          {gateStatus ? (
            <Alert severity={gateStatus === "passed" ? "success" : gateStatus === "failed" ? "error" : "warning"}>
              {gateStatus === "passed"
                ? "Benchmark gate пройден."
                : `Benchmark gate ${gateStatus}: провалены [${failedMetrics.join(", ") || "нет"}], missing [${missingMetrics.join(", ") || "нет"}].`}
            </Alert>
          ) : null}
        </Stack>
      ) : (
        <Alert severity="info">Для analyst-agent benchmark-данные пока не зафиксированы.</Alert>
      )}
    </SectionBlock>
  );
}
