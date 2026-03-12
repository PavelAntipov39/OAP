import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import { getAgentsManifest, getAgentTelemetrySummaryByAgent, type AgentTelemetrySummaryAgent } from "../../lib/generatedData";
import { getAgentTaskDetails, HUMAN_DECISION_LABEL, TASK_UI_STAGE_ORDER, TASK_UI_STAGE_META, type AgentTaskDetails, type AgentTaskHumanDecisionType, type AgentTaskServiceMode } from "../../lib/tasksApi";
import {
  formatReadinessSummary,
  getMissingReadinessItems,
  MANUAL_READINESS_LABEL,
  READINESS_COLOR,
  READINESS_LABEL,
} from "../../lib/taskReadiness";
import { TASK_RULES_CONTENT, TASK_RULES_PATH } from "../../lib/taskRulesContent";
import { TextContentModal } from "../TextContentModal";
import { SkillToolMcpTooltip } from "../skill-tooltip/SkillToolMcpTooltip";
import { AgentInstanceGraph } from "./AgentInstanceGraph";
import { TaskDetailsDrawerExperimental } from "./TaskDetailsDrawerExperimental";
import { TaskTimeline } from "./TaskTimeline";

const TASK_STATUS_LABEL: Record<AgentTaskDetails["task"]["status"], string> = {
  backlog: "Backlog",
  ready: "Можно брать",
  in_progress: "В работе",
  ab_test: "A/B тест",
  waiting_human: "Ожидает человека",
  in_review: "На ревью",
  done: "Готово",
  completed: "Завершённый",
};

const WUUNU_DEV_MODE = import.meta.env.DEV;
const EXPERIMENTAL_TASK_CARD_IDS = new Set(["demo-human-approve"]);
const ACTIVE_AGENT_IDS = new Set(getAgentsManifest().agents.map((agent) => agent.id));
const HOST_SYNC_LABEL: Record<string, string> = {
  synced: "synced",
  partial: "partial",
  missing: "missing",
  archived: "archived",
};

type TaskDetailsDrawerProps = {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onOpenAgent: (agentId: string) => void;
  serviceMode?: AgentTaskServiceMode;
};

function shouldUseExperimentalTaskCard(taskId: string | null, serviceMode?: AgentTaskServiceMode): boolean {
  return Boolean(
    (taskId && EXPERIMENTAL_TASK_CARD_IDS.has(taskId)) ||
    serviceMode === "waiting_human"
  );
}

function renderStringList(values: string[], emptyText = "не зафиксировано") {
  if (values.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  return (
    <List dense disablePadding>
      {values.map((value) => (
        <ListItem key={value} disableGutters sx={{ py: 0.25 }}>
          <ListItemText primaryTypographyProps={{ variant: "body2" }} primary={value} />
        </ListItem>
      ))}
    </List>
  );
}

function getPathFromAnchor(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const anchor = value as Record<string, unknown>;
  if (typeof anchor.path === "string") return anchor.path;
  if (typeof anchor.value === "string") return anchor.value;
  return "";
}

function toPathCandidate(value: string): string {
  return value.trim().replace(/^\.?\//, "");
}

function looksLikeRepoPath(value: string): boolean {
  return /^(docs|ops-web|web|scripts|supabase|etl)\//.test(value);
}

function slugify(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "task";
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const RU_SHORT_MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function formatDateTimeShort(value: string | null): string {
  if (!value) return "не зафиксировано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "не зафиксировано";
  const day = date.getDate();
  const month = RU_SHORT_MONTHS[date.getMonth()] || "неизв";
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${hh}:${mm}`;
}

function linkedElementTypeLabel(value: string): string {
  const type = (value || "").toLowerCase();
  if (type === "improvement") return "Улучшение";
  if (type === "task") return "Задача";
  if (type === "doc") return "Документ";
  if (type === "rule") return "Правило";
  if (type === "metric") return "Метрика";
  if (type === "incident") return "Инцидент";
  if (type === "mcp") return "MCP";
  if (type === "skill") return "Навык";
  if (type === "bpmn") return "BPMN";
  if (type === "c4") return "C4";
  if (type === "url") return "Ссылка";
  if (type === "recommendation") return "Рекомендация";
  return "Элемент";
}

function linkedImprovementModeLabel(value: string | null): string {
  const mode = (value || "").toLowerCase();
  if (mode === "explicit") return "Подтвержденная связь";
  if (mode === "fallback") return "Автосопоставление";
  return "Связь не зафиксирована";
}

function renderUsageTable(
  values: Array<{ name: string; events: number; tasks: number }>,
  emptyText = "не зафиксировано",
) {
  if (values.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  return (
    <Stack spacing={0.6}>
      {values.map((item) => (
        <Stack key={item.name} direction="row" spacing={0.8} alignItems="center" useFlexGap flexWrap="wrap">
          <SkillToolMcpTooltip name={item.name} size="small" variant="outlined" />
          <Typography variant="body2" color="text.secondary">
            событий: {item.events}, задач: {item.tasks}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

function passRuleLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "target_plus_guardrails") return "target + guardrails";
  return value || "не зафиксировано";
}

function yesNoLabel(value: boolean): string {
  return value ? "да" : "нет";
}

function collaborationStrategyLabel(value: string | undefined): string {
  const normalized = (value || "").toLowerCase();
  if (normalized === "reuse_existing") return "reuse_existing (переиспользование профиля)";
  if (normalized === "create_new") return "create_new (создание нового профиля)";
  if (normalized === "mixed") return "mixed (переиспользование + создание)";
  return "не зафиксировано";
}

function stageChipColor(details: AgentTaskDetails): "default" | "info" | "warning" | "success" {
  if (details.current_stage_ui === "closed") return "success";
  if (details.current_stage_ui === "review") return "info";
  if (details.current_stage_ui === "in_work") return "warning";
  return "default";
}

function renderAgentLinks(agentIds: string[], onOpenAgent: (agentId: string) => void, emptyText = "не зафиксировано") {
  if (agentIds.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  return (
    <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
      {agentIds.map((agentId) => renderAgentRef(agentId, onOpenAgent, agentId))}
    </Stack>
  );
}

function isActiveAgentId(agentId: string | null | undefined): agentId is string {
  const normalized = (agentId || "").trim();
  return normalized.length > 0 && ACTIVE_AGENT_IDS.has(normalized);
}

function renderAgentRef(agentId: string | null | undefined, onOpenAgent: (agentId: string) => void, emptyText = "не зафиксировано") {
  const normalized = (agentId || "").trim();
  if (!normalized) {
    return (
      <Typography component="span" variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  if (isActiveAgentId(normalized)) {
    return (
      <Link component="button" type="button" underline="hover" onClick={() => onOpenAgent(normalized)}>
        {normalized}
      </Link>
    );
  }
  return (
    <Stack component="span" direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
      <Typography component="span" variant="body2">
        {normalized}
      </Typography>
      <Chip size="small" variant="outlined" label="архив" sx={{ height: 20 }} />
    </Stack>
  );
}

function formatPercentMetric(value: number | null | undefined, emptyText = "не зафиксировано"): string {
  return typeof value === "number" ? `${value}%` : emptyText;
}

function formatCostMetric(value: number | null | undefined, unit: string | null | undefined): string {
  if (typeof value !== "number") return "не зафиксировано";
  return `${value} ${unit || ""}`.trim();
}

function MetricLine({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Typography variant="body2">
      <strong>{label}:</strong> {value}{" "}
      <Tooltip title={hint} placement="top" arrow>
        <Typography component="span" variant="caption" sx={{ textDecoration: "underline dotted", cursor: "help" }}>
          Как считается
        </Typography>
      </Tooltip>
    </Typography>
  );
}

function AgentViabilityCard(
  props: {
    agentId: string;
    telemetry: AgentTelemetrySummaryAgent | null;
    roleLabel: string;
    onOpenAgent: (agentId: string) => void;
  },
) {
  const { agentId, telemetry, roleLabel, onOpenAgent } = props;
  const hostSyncStatus = telemetry?.host_adapter_sync_status || "missing";
  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Stack spacing={0.6}>
        <Stack direction="row" spacing={0.8} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography variant="body2">
            <strong>{roleLabel}:</strong> {renderAgentRef(agentId, onOpenAgent, agentId)}
          </Typography>
          <Chip size="small" variant="outlined" label={`Adapters: ${HOST_SYNC_LABEL[hostSyncStatus] || hostSyncStatus}`} />
        </Stack>
        {!telemetry ? (
          <Typography variant="body2" color="text.secondary">
            Телеметрия по агенту пока не собрана.
          </Typography>
        ) : (
          <Stack spacing={0.45}>
            <MetricLine
              label="Запусков"
              value={String(telemetry.invocation_count ?? telemetry.tasks_total ?? 0)}
              hint="Количество отдельных запусков агента. Формула: count(distinct run_id), если run_id отсутствует — fallback на tasks_total."
            />
            <MetricLine
              label="Завершено задач"
              value={String(telemetry.completed_task_count ?? telemetry.completed_tasks ?? 0)}
              hint="Сколько задач агент довел до terminal success. Формула: completed_tasks."
            />
            <MetricLine
              label="Использование делегирования"
              value={formatPercentMetric(telemetry.handoff_use_rate)}
              hint="Доля задач, где агент реально создавал child-run. Формула: tasks_with_agent_instance_spawned / tasks_total * 100."
            />
            <MetricLine
              label="Пересечение с analyst-agent"
              value={formatPercentMetric(telemetry.overlap_with_analyst_rate, "не применимо")}
              hint="Как часто агент участвовал в тех же task_id, что и analyst-agent. Формула: shared_tasks_with_analyst / tasks_total * 100."
            />
            <MetricLine
              label="Verify pass rate"
              value={formatPercentMetric(telemetry.verification_pass_rate)}
              hint="Доля verify_passed среди verify_started для этого агента."
            />
            <MetricLine
              label="Стоимость на завершенную задачу"
              value={formatCostMetric(telemetry.orchestration_cost_per_completed_task, telemetry.orchestration_cost_unit)}
              hint="Средняя стоимость на одну завершенную задачу. Формула: cost_total / completed_tasks, либо token proxy / completed_tasks."
            />
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

const HUMAN_DECISION_ORDER: AgentTaskHumanDecisionType[] = ["done", "cancel", "retry_ai"];

function humanDecisionPreviewMeta(decisionType: AgentTaskHumanDecisionType): {
  severity: "success" | "warning" | "info";
  title: string;
  next_step: string;
} {
  if (decisionType === "done") {
    return {
      severity: "success",
      title: "Человек подтвердил выполнение.",
      next_step: "Агент переводит задачу в «Проверка результата» и валидирует эффект.",
    };
  }
  if (decisionType === "cancel") {
    return {
      severity: "warning",
      title: "Человек отменил задачу.",
      next_step: "Агент закрывает задачу с резолюцией «Отменено человеком» и фиксирует урок.",
    };
  }
  return {
    severity: "info",
    title: "Человек вернул задачу агенту на самопроверку.",
    next_step: "Агент оставляет задачу в «В работе», перепроверяет предпосылки и повторно собирает контекст.",
  };
}

function TaskDetailsDrawerLegacy({ open, taskId, onClose, onOpenAgent }: TaskDetailsDrawerProps) {
  const [details, setDetails] = React.useState<AgentTaskDetails | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [copiedVisualCommand, setCopiedVisualCommand] = React.useState("");
  const [rulesModalOpen, setRulesModalOpen] = React.useState(false);
  const [humanDecisionComment, setHumanDecisionComment] = React.useState("");
  const [humanDecisionPreview, setHumanDecisionPreview] = React.useState<{
    decisionType: AgentTaskHumanDecisionType;
    comment: string;
  } | null>(null);

  React.useEffect(() => {
    if (!open || !taskId) {
      setDetails(null);
      setError("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    getAgentTaskDetails(taskId, controller.signal)
      .then((payload) => {
        if (!payload) {
          setDetails(null);
          setError("Карточка задачи не найдена.");
          return;
        }
        setDetails(payload);
      })
      .catch((fetchError) => {
        const message = fetchError instanceof Error ? fetchError.message : "Ошибка загрузки карточки задачи.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [open, taskId]);

  React.useEffect(() => {
    setHumanDecisionComment("");
    setHumanDecisionPreview(null);
  }, [open, taskId]);

  const readinessMissing = React.useMemo(
    () => (details ? getMissingReadinessItems(details.readiness.checks) : []),
    [details],
  );

  const visualReview = React.useMemo(() => {
    if (!details) return null;
    const taskKey = details.task.external_key || details.task.id;
    const taskSlug = slugify(taskKey);

    const artifactPrefixes = Array.from(
      new Set(
        [
          ...details.what_to_do.target_artifacts,
          ...details.context_and_evidence.context_package.relevant_anchors.map(getPathFromAnchor),
          details.origin.origin_ref || "",
        ]
          .map(toPathCandidate)
          .filter((value) => value.length > 0 && looksLikeRepoPath(value)),
      ),
    );

    const diffCommandParts = [
      "python3 scripts/visual_explainer_oap.py diff-review",
      "--base-ref main",
      `--task-key ${shellQuote(taskKey)}`,
      ...artifactPrefixes.map((value) => `--artifact-prefix ${shellQuote(value)}`),
    ];

    const planCandidate = [
      details.origin.origin_ref || "",
      ...details.what_to_do.target_artifacts,
      ...details.context_and_evidence.context_package.relevant_anchors.map(getPathFromAnchor),
    ]
      .map(toPathCandidate)
      .find((value) => looksLikeRepoPath(value) && value.endsWith(".md"));

    const planCommand = planCandidate
      ? `python3 scripts/visual_explainer_oap.py plan-review --plan ${shellQuote(planCandidate)} --task-key ${shellQuote(taskKey)}`
      : null;

    return {
      taskKey,
      taskSlug,
      artifactPrefixes,
      diffCommand: diffCommandParts.join(" "),
      planCommand,
      diffUrl: `http://localhost:8765/oap-diff-review-task-${taskSlug}-latest.html`,
      planUrl: `http://localhost:8765/oap-plan-review-task-${taskSlug}-latest.html`,
    };
  }, [details]);

  const handleCopyVisualCommand = React.useCallback(async (command: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedVisualCommand(command);
    window.setTimeout(() => {
      setCopiedVisualCommand((current) => (current === command ? "" : current));
    }, 1400);
  }, []);

  const handlePreviewHumanDecision = React.useCallback((decisionType: AgentTaskHumanDecisionType) => {
    const comment = humanDecisionComment.trim();
    if (!comment) return;
    setHumanDecisionPreview({
      decisionType,
      comment,
    });
  }, [humanDecisionComment]);

  const linkedImprovement = details?.origin.linked_improvement ?? null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      hideBackdrop={WUUNU_DEV_MODE}
      ModalProps={
        WUUNU_DEV_MODE
          ? {
              disablePortal: true,
              container: () => document.getElementById("root") || document.body,
              disableEnforceFocus: true,
              disableAutoFocus: true,
              disableRestoreFocus: true,
            }
          : undefined
      }
      PaperProps={{ sx: { width: { xs: "100vw", md: 760 }, maxWidth: "100vw", bgcolor: "background.default" } }}
    >
      <Box sx={{ pt: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2.25, pb: 1.2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {details?.task.title || "Задача"}
            </Typography>
            {details ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                <Chip size="small" label={details.task.external_key} variant="outlined" />
                <Chip size="small" label={TASK_STATUS_LABEL[details.task.status]} />
                <Chip size="small" color={READINESS_COLOR[details.readiness.readiness_final_state]} label={READINESS_LABEL[details.readiness.readiness_final_state]} />
              </Stack>
            ) : null}
          </Box>
          <IconButton onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider />

        <Stack spacing={1.25} sx={{ p: 2.25 }}>
          <Paper variant="outlined" sx={{ p: 1.25 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Правила по работе с задачами
              </Typography>
              <Link
                component="button"
                type="button"
                underline="hover"
                variant="body2"
                onClick={() => setRulesModalOpen(true)}
              >
                Открыть описание правил
              </Link>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {TASK_RULES_PATH}
            </Typography>
          </Paper>

          {details?.service_mode === "waiting_human" ? (
            <Alert severity="warning">
              По этой задаче нужен ваш ручной ввод: откройте блок human-gate ниже, напишите комментарий и выберите одно из трех решений.
            </Alert>
          ) : null}

          {loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Загружаем карточку задачи...
              </Typography>
            </Stack>
          ) : null}

          {error ? <Alert severity="error">{error}</Alert> : null}

          {details ? (
            <>
              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Что нужно сделать
                </Typography>
                <Stack spacing={0.8}>
                  <Typography variant="body2">
                    <strong>Цель:</strong> {details.what_to_do.goal || "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Ожидаемый результат:</strong> {details.what_to_do.expected_outcome || "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Время создания:</strong> {formatDateTimeShort(details.task.created_at)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Время изменения:</strong> {formatDateTimeShort(details.task.updated_at)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Критерии приемки
                  </Typography>
                  {renderStringList(details.what_to_do.acceptance_criteria)}
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Целевые артефакты
                  </Typography>
                  {renderStringList(details.what_to_do.target_artifacts)}
                  <Typography variant="body2">
                    <strong>Причина приоритета:</strong> {details.what_to_do.priority_reason || "не зафиксировано"}
                  </Typography>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Контекст к задаче
                </Typography>
                <Stack spacing={0.8}>
                  <Typography variant="body2">
                    <strong>Краткий контекст:</strong> {details.what_to_do.context_to_task.summary || "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Почему сейчас:</strong> {details.what_to_do.context_to_task.why_now || "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Примечания к выполнению
                  </Typography>
                  {renderStringList(details.what_to_do.context_to_task.execution_notes)}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Как появилась задача
                </Typography>
                <Stack spacing={0.6}>
                  <Typography variant="body2">
                    <strong>Тип постановки:</strong> {details.origin.origin_type_label_ru || "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Источник в данных:</strong> {details.origin.origin_ref || "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Постановщик:</strong>{" "}
                    {renderAgentRef(details.origin.source_agent_id, onOpenAgent)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Исполнитель:</strong>{" "}
                    {renderAgentRef(details.task.executor_agent_id, onOpenAgent)}
                  </Typography>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Роли в задаче
                </Typography>
                <Stack spacing={0.6}>
                  <Typography variant="body2">
                    <strong>Постановщик</strong>{" "}
                    <Typography component="span" variant="caption" color="text.secondary">
                      — тот, кто ставит задачу:
                    </Typography>{" "}
                    {renderAgentRef(details.origin.source_agent_id, onOpenAgent)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Исполнитель</strong>{" "}
                    <Typography component="span" variant="caption" color="text.secondary">
                      — основной ответственный:
                    </Typography>{" "}
                    {renderAgentRef(details.task.executor_agent_id, onOpenAgent)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Соисполнители</strong>{" "}
                    <Typography component="span" variant="caption" color="text.secondary">
                      — выполняют свою часть задачи:
                    </Typography>{" "}
                    <Typography component="span" variant="body2" color="text.secondary">
                      не зафиксировано
                    </Typography>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Наблюдатель</strong>{" "}
                    <Typography component="span" variant="caption" color="text.secondary">
                      — в курсе хода, привлекается для уточнений:
                    </Typography>{" "}
                    <Typography component="span" variant="body2" color="text.secondary">
                      не зафиксировано
                    </Typography>
                  </Typography>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Жизнеспособность задействованных агентов
                </Typography>
                <Stack spacing={0.8}>
                  {Array.from(
                    new Map(
                      [
                        { roleLabel: "Постановщик", agentId: details.origin.source_agent_id || details.task.source_agent_id || "" },
                        { roleLabel: "Исполнитель", agentId: details.task.executor_agent_id || "" },
                      ]
                        .map((entry) => ({ ...entry, agentId: (entry.agentId || "").trim() }))
                        .filter((entry) => entry.agentId.length > 0)
                        .map((entry) => [entry.agentId, entry] as const),
                    ).values(),
                  ).map((entry) => (
                    <AgentViabilityCard
                      key={`${entry.roleLabel}-${entry.agentId}`}
                      agentId={entry.agentId}
                      telemetry={getAgentTelemetrySummaryByAgent(entry.agentId)}
                      roleLabel={entry.roleLabel}
                      onOpenAgent={onOpenAgent}
                    />
                  ))}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Текущая стадия задачи
                </Typography>
                <Stack spacing={0.8}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip size="small" color={stageChipColor(details)} label={details.stage_label} />
                    {details.service_mode_label ? <Chip size="small" variant="outlined" label={details.service_mode_label} /> : null}
                    {details.close_resolution_label ? <Chip size="small" variant="outlined" color="success" label={`Резолюция: ${details.close_resolution_label}`} /> : null}
                  </Stack>
                  <Typography variant="body2">
                    <strong>Что происходит:</strong> {details.stage_description}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Зачем нужна стадия:</strong> {details.stage_why}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Что делает агент Аналитик:</strong> {details.analyst_stage_action}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Кто дает сигнал:</strong> {details.signal_actor_label}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Кто переводит дальше:</strong> {details.next_actor_label}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Следующий шаг:</strong> {details.next_step_label}
                  </Typography>
                  {details.is_analyst_path ? (
                    <>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Путь задачи аналитика
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {"Цикл аналитика -> найден сигнал -> задача формализована -> выполнена -> проверена -> закрыта."}
                      </Typography>
                      <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
                        {TASK_UI_STAGE_ORDER.map((stageKey) => (
                          <Chip
                            key={stageKey}
                            size="small"
                            color={details.current_stage_ui === stageKey ? stageChipColor(details) : "default"}
                            variant={details.current_stage_ui === stageKey ? "filled" : "outlined"}
                            label={TASK_UI_STAGE_META[stageKey].label}
                          />
                        ))}
                      </Stack>
                    </>
                  ) : null}
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Связанные элементы
                </Typography>
                {details.context_and_evidence.linked_elements.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    не зафиксировано
                  </Typography>
                ) : (
                  <Stack spacing={0.75}>
                    {details.context_and_evidence.linked_elements.map((item, index) => (
                      <Paper key={`${item.type}-${item.id || item.title}-${index}`} variant="outlined" sx={{ p: 0.9 }}>
                        <Typography variant="body2">
                          <strong>{linkedElementTypeLabel(item.type)}:</strong> {item.title}
                        </Typography>
                        {item.ref ? (
                          <Typography variant="caption" color="text.secondary" component="div">
                            ref: {item.ref}
                          </Typography>
                        ) : null}
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.45 }}>
                          {item.source_agent_id ? renderAgentRef(item.source_agent_id, onOpenAgent, "агент не зафиксирован") : null}
                          {item.source_url ? (
                            <Link href={item.source_url} target="_blank" rel="noopener noreferrer">
                              Открыть источник
                            </Link>
                          ) : null}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>

              {linkedImprovement ? (
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                    Связь с улучшением
                  </Typography>
                  <Stack spacing={0.6}>
                    <Typography variant="body2" color="text.secondary">
                      <strong>Тип связи:</strong> {linkedImprovementModeLabel(linkedImprovement.link_mode)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Раздел: {linkedImprovement.ownerSection || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Оценка эффекта ICE: Score: {linkedImprovement.ice.score ?? "не зафиксировано"} | Impact:{" "}
                      {linkedImprovement.ice.impact ?? "не зафиксировано"} | Confidence:{" "}
                      {linkedImprovement.ice.confidence ?? "не зафиксировано"} | Ease:{" "}
                      {linkedImprovement.ice.ease ?? "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Точка роста: {linkedImprovement.problem || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Решение: {linkedImprovement.solution || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ожидаемый эффект: {linkedImprovement.effect || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Целевая метрика: {linkedImprovement.targetMetric || "не зафиксировано"} | База:{" "}
                      {linkedImprovement.baselineWindow || "не зафиксировано"} | Ожидаемый сдвиг:{" "}
                      {linkedImprovement.expectedDelta || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Дата валидации эффекта: {linkedImprovement.validationDate || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Основание: {linkedImprovement.detectionBasis || "не зафиксировано"}
                    </Typography>
                    {linkedImprovement.promptMarkdown ? (
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{ width: "fit-content" }}
                        onClick={() => void handleCopyVisualCommand(linkedImprovement.promptMarkdown || "")}
                      >
                        {copiedVisualCommand === linkedImprovement.promptMarkdown
                          ? "Скопировано"
                          : "Скопировать промт для внедрения"}
                      </Button>
                    ) : null}
                  </Stack>
                </Paper>
              ) : null}

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Контекст и доказательства
                </Typography>
                {(() => {
                  const contextPackage = details.context_and_evidence.context_package;
                  const operationalMemory = contextPackage.operational_memory || [];
                  const collaborationPlan = contextPackage.collaboration_plan;
                  const abTestPlan = contextPackage.ab_test_plan;
                  const humanGate = contextPackage.human_gate;

                  return (
                    <Stack spacing={0.8}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Evidence refs
                      </Typography>
                      {renderStringList(details.context_and_evidence.evidence_refs)}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Контекст-пакет задачи - релевантные anchors
                      </Typography>
                      {renderStringList(
                        contextPackage.relevant_anchors
                          .map(getPathFromAnchor)
                          .filter(Boolean),
                      )}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Обязательные правила
                      </Typography>
                      {renderStringList(
                        contextPackage.mandatory_rules
                          .map(getPathFromAnchor)
                          .filter(Boolean),
                      )}

                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Оперативная память задачи
                      </Typography>
                      {operationalMemory.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          не зафиксировано
                        </Typography>
                      ) : (
                        <Stack spacing={0.7}>
                          {operationalMemory.map((item) => (
                            <Paper key={item.key} variant="outlined" sx={{ p: 0.85 }}>
                              <Typography variant="body2">
                                <strong>{item.title}</strong> ({item.key})
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {item.value || "не зафиксировано"}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" component="div">
                                источник: {item.source_ref || "не зафиксировано"} | обновлено: {formatDateTimeShort(item.updated_at)}
                              </Typography>
                            </Paper>
                          ))}
                        </Stack>
                      )}

                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        План подключения агентов
                      </Typography>
                      {!collaborationPlan ? (
                        <Typography variant="body2" color="text.secondary">
                          не зафиксировано
                        </Typography>
                      ) : (
                        <Stack spacing={0.6}>
                          <Typography variant="body2">
                            <strong>Анализ обязателен:</strong> {yesNoLabel(collaborationPlan.analysis_required)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Рекомендованные агенты:</strong>
                          </Typography>
                          {renderAgentLinks(collaborationPlan.suggested_agents, onOpenAgent)}
                          <Typography variant="body2">
                            <strong>Выбранные агенты:</strong>
                          </Typography>
                          {renderAgentLinks(collaborationPlan.selected_agents, onOpenAgent)}
                          <Typography variant="body2">
                            <strong>Обоснование:</strong> {collaborationPlan.rationale || "не зафиксировано"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Проверено: {formatDateTimeShort(collaborationPlan.reviewed_at)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Стратегия оркестрации:</strong> {collaborationStrategyLabel(collaborationPlan.strategy)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Режим взаимодействия:</strong> {collaborationPlan.interaction_mode || "sequential"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Глубина делегирования:</strong>{" "}
                            {Number.isFinite(Number(collaborationPlan.delegation_depth))
                              ? Math.max(0, Math.round(Number(collaborationPlan.delegation_depth)))
                              : 0}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Бюджет оркестрации:</strong>{" "}
                            {collaborationPlan.orchestration_budget
                              ? [
                                  `instances=${collaborationPlan.orchestration_budget.max_instances}`,
                                  `tokens=${collaborationPlan.orchestration_budget.max_tokens}`,
                                  `wall-clock=${collaborationPlan.orchestration_budget.max_wall_clock_minutes}m`,
                                  `no-progress-hops=${collaborationPlan.orchestration_budget.max_no_progress_hops}`,
                                ].join(", ")
                              : "не зафиксировано"}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Reuse candidates
                          </Typography>
                          {!collaborationPlan.reuse_candidates || collaborationPlan.reuse_candidates.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              не зафиксировано
                            </Typography>
                          ) : (
                            <Stack spacing={0.5}>
                              {collaborationPlan.reuse_candidates.map((candidate) => (
                                <Paper key={`${candidate.profile_id}-${candidate.name}`} variant="outlined" sx={{ p: 0.7 }}>
                                  <Typography variant="body2">
                                    <strong>{candidate.name}</strong> ({candidate.profile_id})
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" component="div">
                                    score={candidate.score.toFixed(2)} | decision={candidate.decision}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" component="div">
                                    {candidate.rationale || "обоснование не зафиксировано"}
                                  </Typography>
                                </Paper>
                              ))}
                            </Stack>
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Созданные профили
                          </Typography>
                          {!collaborationPlan.created_profiles || collaborationPlan.created_profiles.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">
                              нет
                            </Typography>
                          ) : (
                            <Stack spacing={0.5}>
                              {collaborationPlan.created_profiles.map((profile) => (
                                <Paper key={profile.id} variant="outlined" sx={{ p: 0.7 }}>
                                  <Typography variant="body2">
                                    <strong>{profile.name}</strong> ({profile.id})
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" component="div">
                                    scope={profile.specialization_scope} | lifecycle={profile.lifecycle}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" component="div">
                                    reason={profile.creation_reason || "не зафиксировано"}
                                  </Typography>
                                </Paper>
                              ))}
                            </Stack>
                          )}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Схема работы агентов
                          </Typography>
                          <AgentInstanceGraph collaborationPlan={collaborationPlan} onOpenAgent={onOpenAgent} />
                        </Stack>
                      )}

                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Режим: требуется решение человека
                      </Typography>
                      {!humanGate && details.service_mode !== "waiting_human" ? (
                        <Typography variant="body2" color="text.secondary">
                          не зафиксировано
                        </Typography>
                      ) : (
                        <Stack spacing={0.6}>
                          <Typography variant="body2">
                            <strong>Что нужно сделать человеку:</strong>{" "}
                            {humanGate?.instruction || "Агент ожидает решение человека по этой задаче."}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Что считается выполнением:</strong>{" "}
                            {humanGate?.completion_criteria || "Человек должен выбрать решение и оставить комментарий."}
                          </Typography>
                          {humanGate?.codex_prompt ? (
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ width: "fit-content" }}
                              onClick={() => void handleCopyVisualCommand(humanGate.codex_prompt)}
                            >
                              {copiedVisualCommand === humanGate.codex_prompt
                                ? "Скопировано"
                                : "Скопировать промпт для Codex"}
                            </Button>
                          ) : null}
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Возможные решения человека
                          </Typography>
                          <List dense disablePadding>
                            {HUMAN_DECISION_ORDER.map((decisionType) => (
                              <ListItem key={decisionType} disableGutters sx={{ py: 0.15 }}>
                                <ListItemText
                                  primaryTypographyProps={{ variant: "body2" }}
                                  secondaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                                  primary={HUMAN_DECISION_LABEL[decisionType]}
                                  secondary={
                                    decisionType === "done"
                                      ? "Агент проверяет результат и переводит задачу в «Проверка результата»."
                                      : decisionType === "cancel"
                                        ? "Агент закрывает задачу с резолюцией «Отменено»."
                                        : "Агент возвращает задачу в обычный режим «В работе» и перепроверяет предпосылки."
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                          <TextField
                            label="Комментарий человека"
                            size="small"
                            multiline
                            minRows={3}
                            value={humanDecisionComment}
                            onChange={(event) => setHumanDecisionComment(event.target.value)}
                            helperText="Комментарий обязателен. Здесь можно проверить UI ручного ввода без записи решения в БД."
                          />
                          <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                            {HUMAN_DECISION_ORDER.map((decisionType) => (
                              <Button
                                key={decisionType}
                                size="small"
                                variant={humanDecisionPreview?.decisionType === decisionType ? "contained" : "outlined"}
                                color={decisionType === "done" ? "success" : decisionType === "cancel" ? "warning" : "info"}
                                disabled={!humanDecisionComment.trim()}
                                onClick={() => handlePreviewHumanDecision(decisionType)}
                              >
                                {HUMAN_DECISION_LABEL[decisionType]}
                              </Button>
                            ))}
                          </Stack>
                          {humanDecisionPreview ? (
                            <Alert severity={humanDecisionPreviewMeta(humanDecisionPreview.decisionType).severity}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {humanDecisionPreviewMeta(humanDecisionPreview.decisionType).title}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Следующий шаг агента:</strong> {humanDecisionPreviewMeta(humanDecisionPreview.decisionType).next_step}
                              </Typography>
                              <Typography variant="body2">
                                <strong>Комментарий человека:</strong> {humanDecisionPreview.comment}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Это локальный предпросмотр UI. Реальная запись `human_decision` в telemetry в этом интерфейсе пока не подключена.
                              </Typography>
                            </Alert>
                          ) : null}
                          <Typography variant="caption" color="text.secondary">
                            Комментарий человека обязателен во всех трех решениях.
                          </Typography>
                        </Stack>
                      )}

                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        План A/B
                      </Typography>
                      {!abTestPlan ? (
                        <Typography variant="body2" color="text.secondary">
                          не зафиксировано
                        </Typography>
                      ) : (
                        <Stack spacing={0.6}>
                          {details.service_mode === "ab_test" ? (
                            <Typography variant="body2">
                              <strong>Режим задачи:</strong> идет A/B тест
                            </Typography>
                          ) : null}
                          <Typography variant="body2">
                            <strong>Включен:</strong> {yesNoLabel(abTestPlan.enabled)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Сессий требуется:</strong> {abTestPlan.sessions_required}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Правило прохождения:</strong> {passRuleLabel(abTestPlan.pass_rule)}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Целевая метрика:</strong> {abTestPlan.target_metric || "не зафиксировано"}
                          </Typography>
                          <Typography variant="body2">
                            <strong>Ожидаемый delta, %:</strong>{" "}
                            {abTestPlan.expected_delta_pct === null ? "не зафиксировано" : abTestPlan.expected_delta_pct}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Guardrails
                          </Typography>
                          {renderStringList(abTestPlan.guardrails)}
                          <Typography variant="body2">
                            <strong>Откат при провале:</strong> {yesNoLabel(abTestPlan.rollback_on_fail)}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  );
                })()}
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Применённые MCP и навыки
                </Typography>
                <Stack spacing={0.8}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    MCP в этой задаче
                  </Typography>
                  {renderUsageTable(details.implementation_usage.mcp_in_task)}
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Навыки в этой задаче
                  </Typography>
                  {renderUsageTable(details.implementation_usage.skills_in_task)}
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Частота MCP по всем задачам
                  </Typography>
                  {renderUsageTable(details.implementation_usage.mcp_frequency_across_tasks)}
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Частота навыков по всем задачам
                  </Typography>
                  {renderUsageTable(details.implementation_usage.skills_frequency_across_tasks)}
                  <Typography variant="caption" color="text.secondary">
                    Источник: telemetry payload (`mcp_tools`, `skills`/`skills_used`/`skill`).
                  </Typography>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  Готовность к работе
                </Typography>
                <Stack spacing={0.8}>
                  <Typography variant="body2">
                    {formatReadinessSummary(
                      details.readiness.readiness_auto_score,
                      details.readiness.readiness_auto_state,
                      details.readiness.readiness_manual_state,
                    )}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="body2" component="span">
                      <strong>Итог:</strong>
                    </Typography>
                    <Chip
                      size="small"
                      color={READINESS_COLOR[details.readiness.readiness_final_state]}
                      label={READINESS_LABEL[details.readiness.readiness_final_state]}
                    />
                  </Box>
                  {readinessMissing.length > 0 ? (
                    <Typography variant="body2" color="warning.main">
                      Нужно уточнить: {readinessMissing.join(", ")}.
                    </Typography>
                  ) : null}
                  <Typography variant="caption" color="text.secondary">
                    Ручная проверка: {MANUAL_READINESS_LABEL[details.readiness.readiness_manual_state]}
                  </Typography>
                </Stack>
              </Paper>

              {visualReview ? (
                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                    Visual review по этой задаче
                  </Typography>
                  <Stack spacing={0.8}>
                    <Typography variant="body2">
                      <strong>Скоуп:</strong> {visualReview.artifactPrefixes.length > 0 ? visualReview.artifactPrefixes.join(", ") : "весь diff (артефакты не зафиксированы)"}
                    </Typography>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                      <Button size="small" variant="contained" onClick={() => void handleCopyVisualCommand(visualReview.diffCommand)}>
                        {copiedVisualCommand === visualReview.diffCommand ? "Скопировано" : "Скопировать diff-команду"}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        component="a"
                        href={visualReview.diffUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Открыть diff отчет
                      </Button>
                    </Stack>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                      <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        disabled={!visualReview.planCommand}
                        onClick={() => {
                          if (visualReview.planCommand) {
                            void handleCopyVisualCommand(visualReview.planCommand);
                          }
                        }}
                      >
                        {visualReview.planCommand && copiedVisualCommand === visualReview.planCommand
                          ? "Скопировано"
                          : "Скопировать plan-команду"}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        component="a"
                        href={visualReview.planUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Открыть plan отчет
                      </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Сначала запусти скопированную команду в корне репозитория, потом открой отчет. Если план-файл в задаче не указан, plan-команда отключена.
                    </Typography>
                  </Stack>
                </Paper>
              ) : null}

              <Paper variant="outlined" sx={{ p: 1.25 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.8 }}>
                  История событий
                </Typography>
                <TaskTimeline events={details.timeline} />
              </Paper>
            </>
          ) : null}
        </Stack>
      </Box>
      <TextContentModal
        open={rulesModalOpen}
        title="Правила по работе с задачами"
        content={TASK_RULES_CONTENT}
        path={TASK_RULES_PATH}
        onClose={() => setRulesModalOpen(false)}
      />
    </Drawer>
  );
}

export function TaskDetailsDrawer(props: TaskDetailsDrawerProps) {
  if (shouldUseExperimentalTaskCard(props.taskId, props.serviceMode)) {
    return <TaskDetailsDrawerExperimental {...props} />;
  }

  return <TaskDetailsDrawerLegacy {...props} />;
}
