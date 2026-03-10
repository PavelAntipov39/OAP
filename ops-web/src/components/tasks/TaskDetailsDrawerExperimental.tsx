import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
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
  Typography,
} from "@mui/material";

import { getDocsIndex } from "../../lib/generatedData";
import {
  getAgentTaskDetails,
  TASK_UI_STAGE_META,
  TASK_UI_STAGE_ORDER,
  type AgentTaskDetails,
  type AgentTaskHumanDecisionType,
} from "../../lib/tasksApi";
import {
  getMissingReadinessItems,
  MANUAL_READINESS_LABEL,
  READINESS_COLOR,
} from "../../lib/taskReadiness";
import { TASK_RULES_PATH } from "../../lib/taskRulesContent";
import { TextContentModal } from "../TextContentModal";
import { SkillToolMcpTooltip } from "../skill-tooltip/SkillToolMcpTooltip";
import { TaskTimeline } from "./TaskTimeline";

const WUUNU_DEV_MODE = import.meta.env.DEV;

type TaskDetailsDrawerExperimentalProps = {
  open: boolean;
  taskId: string | null;
  onClose: () => void;
  onOpenAgent: (agentId: string) => void;
};

type RoleViewModel = {
  label: string;
  description: string;
  agentId: string | null;
  emptyText: string;
};

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

const HUMAN_DECISION_ORDER: AgentTaskHumanDecisionType[] = ["done", "cancel", "retry_ai"];

const HUMAN_DECISION_ACTION_LABEL: Record<AgentTaskHumanDecisionType, string> = {
  done: "Подтвердить запуск",
  cancel: "Отменить задачу",
  retry_ai: "Вернуть агенту",
};

const HUMAN_DECISION_DESCRIPTION: Record<AgentTaskHumanDecisionType, string> = {
  done: "Подтвердить, что задачу можно переводить дальше с учетом комментария.",
  cancel: "Закрыть задачу, потому что она потеряла актуальность или запуск больше не нужен.",
  retry_ai: "Вернуть задачу агенту на перепроверку без участия человека в исполнении.",
};

const READINESS_CHECK_ALIASES: Record<string, string[]> = {
  has_goal: ["has_goal", "goal_present"],
  has_expected_outcome: ["has_expected_outcome", "expected_outcome_present", "outcome_present"],
  has_acceptance_criteria: ["has_acceptance_criteria", "acceptance_present"],
  has_target_artifacts: ["has_target_artifacts", "artifacts_present", "target_artifacts_present"],
  has_evidence_or_origin: ["has_evidence_or_origin", "evidence_present", "origin_present"],
};

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

function getPathFromAnchor(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const anchor = value as Record<string, unknown>;
  if (typeof anchor.path === "string") return anchor.path;
  if (typeof anchor.value === "string") return anchor.value;
  return "";
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

function linkedElementPurposeText(type: string): string {
  const normalized = (type || "").toLowerCase();
  if (normalized === "rule") return "Это правило, на которое опирается решение по задаче.";
  if (normalized === "doc") return "Это документ-основание, который помогает принять решение.";
  if (normalized === "metric") return "Это метрика контроля, по которой будем проверять эффект.";
  if (normalized === "recommendation") return "Это исходная рекомендация, из которой выросла задача.";
  return "Это связанный источник, который помогает понять контекст задачи.";
}

function linkedImprovementModeLabel(value: string | null): string {
  const mode = (value || "").toLowerCase();
  if (mode === "explicit") return "Подтвержденная связь";
  if (mode === "fallback") return "Автосопоставление";
  return "Связь не зафиксирована";
}

function collaborationStrategyLabel(value: string | undefined): string {
  const normalized = (value || "").toLowerCase();
  if (normalized === "reuse_existing") return "reuse_existing (переиспользование профиля)";
  if (normalized === "create_new") return "create_new (создание нового профиля)";
  if (normalized === "mixed") return "mixed (переиспользование + создание)";
  return "не зафиксировано";
}

function passRuleLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "target_plus_guardrails") return "target + guardrails";
  return value || "не зафиксировано";
}

function yesNoLabel(value: boolean): string {
  return value ? "да" : "нет";
}

function stageChipColor(details: AgentTaskDetails): "default" | "info" | "warning" | "success" {
  if (details.current_stage_ui === "closed") return "success";
  if (details.current_stage_ui === "review") return "info";
  if (details.current_stage_ui === "in_work") return "warning";
  return "default";
}

function humanDecisionPreviewMeta(decisionType: AgentTaskHumanDecisionType): {
  severity: "success" | "warning" | "info";
  title: string;
  nextStep: string;
} {
  if (decisionType === "done") {
    return {
      severity: "success",
      title: "Запуск подтвержден.",
      nextStep: "Агент берет комментарий как ограничение для следующего шага и двигает задачу дальше по циклу.",
    };
  }
  if (decisionType === "cancel") {
    return {
      severity: "warning",
      title: "Отмена выбрана.",
      nextStep: "Агент фиксирует причину отмены и завершает задачу без запуска следующего действия.",
    };
  }
  return {
    severity: "info",
    title: "Задача возвращена агенту.",
    nextStep: "Агент перепроверяет предпосылки, дорабатывает контекст и повторно выносит решение, если это потребуется.",
  };
}

function SectionCard(
  props: React.PropsWithChildren<{
    title: string;
    action?: React.ReactNode;
  }>,
) {
  const { title, action, children } = props;
  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={0.75} sx={{ mb: 0.8 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function EmptyValue({ text = "не зафиксировано" }: { text?: string }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {text}
    </Typography>
  );
}

function renderStringList(values: string[], emptyText = "не зафиксировано") {
  if (values.length === 0) {
    return <EmptyValue text={emptyText} />;
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

function renderUsageTable(
  values: Array<{ name: string; events: number; tasks: number }>,
  emptyText = "не зафиксировано",
) {
  if (values.length === 0) {
    return <EmptyValue text={emptyText} />;
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

function renderAgentLinks(agentIds: string[], onOpenAgent: (agentId: string) => void, emptyText = "не зафиксировано") {
  if (agentIds.length === 0) {
    return <EmptyValue text={emptyText} />;
  }
  return (
    <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
      {agentIds.map((agentId) => (
        <Link key={agentId} component="button" type="button" underline="hover" onClick={() => onOpenAgent(agentId)}>
          {agentId}
        </Link>
      ))}
    </Stack>
  );
}

function normalizeReadinessChecks(checks: Record<string, boolean>): Record<string, boolean> {
  return Object.entries(READINESS_CHECK_ALIASES).reduce<Record<string, boolean>>((acc, [canonicalKey, aliases]) => {
    const matchedKey = aliases.find((alias) => Object.prototype.hasOwnProperty.call(checks, alias));
    if (matchedKey) {
      acc[canonicalKey] = Boolean(checks[matchedKey]);
    }
    return acc;
  }, {});
}

function buildRolesViewModel(details: AgentTaskDetails): RoleViewModel[] {
  const requesterId = details.origin.source_agent_id || details.task.source_agent_id || null;
  const executorId = details.task.executor_agent_id || null;

  return [
    {
      label: "Постановщик",
      description: "формулирует цель, критерии приемки и прикладывает контекст",
      agentId: requesterId,
      emptyText: "не назначен",
    },
    {
      label: "Исполнитель",
      description: "основной ответственный за выполнение и результат",
      agentId: executorId,
      emptyText: "не назначен",
    },
    {
      label: "Соисполнители",
      description: "выполняют отдельные части задачи",
      agentId: null,
      emptyText: "не назначены",
    },
    {
      label: "Наблюдатель",
      description: "следит за ходом задачи и подключается при уточнениях",
      agentId: null,
      emptyText: "не назначен",
    },
  ];
}

function findRulesDocument() {
  return getDocsIndex().find((item) => item.path === TASK_RULES_PATH) || null;
}

function summarizeList(values: string[], maxItems = 2): string {
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) return "не зафиксировано";
  if (normalized.length <= maxItems) return normalized.join(", ");
  return `${normalized.slice(0, maxItems).join(", ")} и еще ${normalized.length - maxItems}`;
}

function buildMainStatusLabel(details: AgentTaskDetails): string {
  if (details.service_mode === "waiting_human") return "Нужно ваше решение";
  return TASK_STATUS_LABEL[details.task.status];
}

function buildReadinessLabel(details: AgentTaskDetails): string {
  return details.readiness.readiness_final_state === "ready" ? "Контекст готов" : "Контекст нужно уточнить";
}

function buildReadinessSummary(details: AgentTaskDetails, missingItems: string[]): string {
  if (missingItems.length > 0) {
    return `Перед решением нужно уточнить: ${missingItems.join(", ")}.`;
  }
  if (details.readiness.readiness_final_state === "ready") {
    return "Материалы для решения собраны: цель, результат, критерии и доказательства уже есть в карточке.";
  }
  return "Часть обязательного контекста еще не зафиксирована.";
}

function buildToolsSummary(details: AgentTaskDetails): string {
  const mcpCount = details.implementation_usage.mcp_in_task.length;
  const skillCount = details.implementation_usage.skills_in_task.length;
  const parts: string[] = [];
  if (mcpCount > 0) parts.push(`${mcpCount} MCP`);
  if (skillCount > 0) parts.push(`${skillCount} навык${skillCount === 1 ? "" : skillCount < 5 ? "а" : "ов"}`);
  return parts.length > 0
    ? `В задаче зафиксировано ${parts.join(" и ")}. Названия скрыты до раскрытия технических деталей.`
    : "Инструменты и навыки скрыты до раскрытия технических деталей.";
}

export function TaskDetailsDrawerExperimental({ open, taskId, onClose, onOpenAgent }: TaskDetailsDrawerExperimentalProps) {
  const [details, setDetails] = React.useState<AgentTaskDetails | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [rulesModalOpen, setRulesModalOpen] = React.useState(false);
  const [copiedPrompt, setCopiedPrompt] = React.useState("");
  const [humanDecisionComment, setHumanDecisionComment] = React.useState("");
  const [humanDecisionPreview, setHumanDecisionPreview] = React.useState<{
    decisionType: AgentTaskHumanDecisionType;
    comment: string;
  } | null>(null);
  const [contextDetailsOpen, setContextDetailsOpen] = React.useState(false);
  const [stageDetailsOpen, setStageDetailsOpen] = React.useState(false);
  const [technicalDetailsOpen, setTechnicalDetailsOpen] = React.useState(false);

  const rulesDocument = React.useMemo(() => findRulesDocument(), []);

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
    setContextDetailsOpen(false);
    setStageDetailsOpen(false);
    setTechnicalDetailsOpen(false);
  }, [open, taskId]);

  const normalizedReadinessChecks = React.useMemo(
    () => normalizeReadinessChecks(details?.readiness.checks || {}),
    [details?.readiness.checks],
  );
  const readinessMissing = React.useMemo(
    () => getMissingReadinessItems(normalizedReadinessChecks),
    [normalizedReadinessChecks],
  );
  const roles = React.useMemo(() => (details ? buildRolesViewModel(details) : []), [details]);
  const linkedImprovement = details?.origin.linked_improvement ?? null;

  const copyText = React.useCallback(async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedPrompt(value);
    window.setTimeout(() => {
      setCopiedPrompt((current) => (current === value ? "" : current));
    }, 1400);
  }, []);

  const handlePreviewHumanDecision = React.useCallback(
    (decisionType: AgentTaskHumanDecisionType, commentRequired: boolean) => {
      const comment = humanDecisionComment.trim();
      if (commentRequired && !comment) return;
      setHumanDecisionPreview({
        decisionType,
        comment,
      });
    },
    [humanDecisionComment],
  );

  const humanGate = details?.context_and_evidence.context_package.human_gate;
  const abTestPlan = details?.context_and_evidence.context_package.ab_test_plan;
  const collaborationPlan = details?.context_and_evidence.context_package.collaboration_plan;
  const operationalMemory = details?.context_and_evidence.context_package.operational_memory || [];
  const commentRequired = humanGate?.comment_required ?? true;
  const mainStatusLabel = details ? buildMainStatusLabel(details) : "";
  const readinessUiLabel = details ? buildReadinessLabel(details) : "";
  const stageNowText =
    details?.service_mode === "waiting_human"
      ? "Задача остановлена на ручном решении человека."
      : details?.stage_description || "не зафиксировано";
  const waitingActorText = details?.service_mode === "waiting_human" ? "человека" : details?.signal_actor_label || "не зафиксировано";
  const afterThisText = details?.next_step_label || "не зафиксировано";
  const evidenceRefs = details?.context_and_evidence.evidence_refs || [];
  const anchorPaths = details?.context_and_evidence.context_package.relevant_anchors.map(getPathFromAnchor).filter(Boolean) || [];
  const rulePaths = details?.context_and_evidence.context_package.mandatory_rules.map(getPathFromAnchor).filter(Boolean) || [];
  const isDemoTask = Boolean(taskId?.startsWith("demo-") || details?.task.external_key?.startsWith("DEMO-"));
  const whyHumanText =
    humanGate?.instruction ||
    collaborationPlan?.rationale ||
    details?.next_step_label ||
    "Причина ручного решения не зафиксирована.";
  const keyFactText =
    operationalMemory[0]?.value ||
    humanGate?.completion_criteria ||
    summarizeList(anchorPaths, 1) ||
    "не зафиксировано";

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
      <Box data-testid="task-details-experimental" sx={{ pt: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2.25, pb: 1.2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {details?.task.title || "Задача"}
            </Typography>
            {details ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                <Chip size="small" label={details.task.external_key} variant="outlined" />
                <Chip size="small" color={details.service_mode === "waiting_human" ? "warning" : "default"} label={mainStatusLabel} />
                <Chip size="small" variant="outlined" label={`Стадия: ${details.stage_label}`} />
                <Chip size="small" color={READINESS_COLOR[details.readiness.readiness_final_state]} label={readinessUiLabel} />
              </Stack>
            ) : null}
          </Box>
          <IconButton onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider />

        <Stack spacing={1.25} sx={{ p: 2.25 }}>
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
              {isDemoTask ? (
                <Alert severity="info">
                  Демо-сценарий: карточка открыта по отдельной ссылке для проверки интерфейса решения человека.
                </Alert>
              ) : null}

              {details.service_mode === "waiting_human" ? (
                <Alert severity="warning">
                  Сейчас от вас требуется одно решение: сначала оставьте комментарий, затем выберите действие в блоке ниже.
                </Alert>
              ) : null}

              <SectionCard
                title="Сводка задачи"
                action={<Chip size="small" variant="outlined" label={`Приоритет: ${details.task.priority || "не зафиксировано"}`} />}
              >
                <Stack spacing={0.8}>
                  <Typography variant="body2">
                    <strong>Ключ задачи:</strong> {details.task.external_key || details.task.id}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Создана:</strong> {formatDateTimeShort(details.task.created_at)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Последнее изменение:</strong> {formatDateTimeShort(details.task.updated_at)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Последнее событие:</strong> {formatDateTimeShort(details.task.last_event_at)}
                  </Typography>
                </Stack>
              </SectionCard>

              <SectionCard
                title="Правила по работе с задачами"
                action={
                  <Link component="button" type="button" underline="hover" variant="body2" onClick={() => setRulesModalOpen(true)}>
                    Открыть описание правил
                  </Link>
                }
              >
                <Stack spacing={0.6}>
                  <Typography variant="caption" color="text.secondary">
                    {TASK_RULES_PATH}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Канонический документ по ролям, жизненному циклу, readiness и правилам ведения задачи.
                  </Typography>
                </Stack>
              </SectionCard>

              <SectionCard title="Что нужно сделать">
                <Stack spacing={0.8}>
                  <Typography variant="body2">
                    <strong>Цель:</strong> {details.what_to_do.goal || "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Ожидаемый результат:</strong> {details.what_to_do.expected_outcome || "не зафиксировано"}
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
              </SectionCard>

              <SectionCard title="Контекст к задаче">
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
              </SectionCard>

              <SectionCard title="Как появилась задача">
                <Stack spacing={0.6}>
                  <Typography variant="body2">
                    <strong>Тип постановки:</strong> {details.origin.origin_type_label_ru || "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Источник в данных:</strong> {details.origin.origin_ref || "не зафиксировано"}
                  </Typography>
                </Stack>
              </SectionCard>

              <SectionCard title="Роли в задаче">
                <Stack spacing={0.8}>
                  {roles.map((role) => (
                    <Box key={role.label}>
                      <Typography variant="body2">
                        <strong>{role.label}:</strong>{" "}
                        {role.agentId ? (
                          <Link component="button" type="button" underline="hover" onClick={() => onOpenAgent(role.agentId!)}>
                            {role.agentId}
                          </Link>
                        ) : (
                          <Typography component="span" variant="body2" color="text.secondary">
                            {role.emptyText}
                          </Typography>
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {role.description}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </SectionCard>

              <SectionCard
                title="Текущая стадия задачи"
                action={
                  <Button size="small" variant="text" onClick={() => setStageDetailsOpen((value) => !value)}>
                    {stageDetailsOpen ? "Скрыть детали стадии" : "Подробнее о стадии"}
                  </Button>
                }
              >
                <Stack spacing={0.8}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip size="small" color={stageChipColor(details)} label={details.stage_label} />
                    {details.service_mode_label ? <Chip size="small" variant="outlined" label={details.service_mode_label} /> : null}
                    {details.close_resolution_label ? <Chip size="small" variant="outlined" color="success" label={`Резолюция: ${details.close_resolution_label}`} /> : null}
                  </Stack>
                  <Typography variant="body2">
                    <strong>Сейчас:</strong> {stageNowText}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Ждем решение от:</strong> {waitingActorText}
                  </Typography>
                  <Typography variant="body2">
                    <strong>После этого:</strong> {afterThisText}
                  </Typography>

                  <Collapse in={stageDetailsOpen}>
                    <Stack spacing={0.8} sx={{ pt: 0.6 }}>
                      <Typography variant="body2">
                        <strong>Зачем нужна стадия:</strong> {details.stage_why}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Что делает агент Аналитик:</strong> {details.analyst_stage_action}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Кто переводит дальше:</strong> {details.next_actor_label}
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
                    </Stack>
                  </Collapse>
                </Stack>
              </SectionCard>

              <SectionCard title="Связанные элементы">
                {details.context_and_evidence.linked_elements.length === 0 ? (
                  <EmptyValue />
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
                        <Typography variant="caption" color="text.secondary" component="div">
                          Зачем здесь: {linkedElementPurposeText(item.type)}
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.45 }}>
                          {item.source_agent_id ? (
                            <Link component="button" type="button" underline="hover" onClick={() => onOpenAgent(item.source_agent_id as string)}>
                              Открыть агента-источник
                            </Link>
                          ) : null}
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
              </SectionCard>

              {linkedImprovement ? (
                <SectionCard title="Связь с улучшением">
                  <Stack spacing={0.6}>
                    <Typography variant="body2">
                      <strong>Тип связи:</strong> {linkedImprovementModeLabel(linkedImprovement.link_mode)}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Раздел:</strong> {linkedImprovement.ownerSection || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Точка роста:</strong> {linkedImprovement.problem || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Решение:</strong> {linkedImprovement.solution || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Ожидаемый эффект:</strong> {linkedImprovement.effect || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>ICE:</strong> Score {linkedImprovement.ice.score ?? "не зафиксировано"}, Impact {linkedImprovement.ice.impact ?? "не зафиксировано"}, Confidence {linkedImprovement.ice.confidence ?? "не зафиксировано"}, Ease {linkedImprovement.ice.ease ?? "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Целевая метрика:</strong> {linkedImprovement.targetMetric || "не зафиксировано"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Ожидаемый сдвиг:</strong> {linkedImprovement.expectedDelta || "не зафиксировано"}
                    </Typography>
                  </Stack>
                </SectionCard>
              ) : null}

              <SectionCard
                title="Контекст и доказательства"
                action={
                  <Button size="small" variant="text" onClick={() => setContextDetailsOpen((value) => !value)}>
                    {contextDetailsOpen ? "Скрыть детали контекста" : "Показать детали контекста"}
                  </Button>
                }
              >
                <Stack spacing={0.8}>
                  <Typography variant="body2">
                    <strong>Почему нужен человек:</strong> {whyHumanText}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Главные основания:</strong> {summarizeList(evidenceRefs, 2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Ключевой факт для решения:</strong> {keyFactText}
                  </Typography>
                  {collaborationPlan?.rationale ? (
                    <Typography variant="body2">
                      <strong>Обоснование решения:</strong> {collaborationPlan.rationale}
                    </Typography>
                  ) : null}

                  <Collapse in={contextDetailsOpen}>
                    <Stack spacing={0.8} sx={{ pt: 0.6 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Доказательства
                      </Typography>
                      {renderStringList(evidenceRefs)}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Релевантные anchors
                      </Typography>
                      {renderStringList(anchorPaths)}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Обязательные правила
                      </Typography>
                      {renderStringList(rulePaths)}
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Оперативная память задачи
                      </Typography>
                      {operationalMemory.length === 0 ? (
                        <EmptyValue />
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
                        <EmptyValue />
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
                            <strong>Стратегия оркестрации:</strong> {collaborationStrategyLabel(collaborationPlan.strategy)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Проверено: {formatDateTimeShort(collaborationPlan.reviewed_at)}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Collapse>
                </Stack>
              </SectionCard>

              {humanGate || details.service_mode === "waiting_human" ? (
                <SectionCard title="Режим: требуется решение человека">
                  <Stack spacing={1}>
                    <Alert severity="warning">
                      Это локальный предпросмотр: выбор решения и комментарий показывают будущий сценарий работы, но не записывают событие в базу, telemetry или историю задачи.
                    </Alert>
                    <Typography variant="body2">
                      <strong>Что нужно сделать человеку:</strong> {humanGate?.instruction || "Агент ожидает решение человека по этой задаче."}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Что считается выполнением:</strong> {humanGate?.completion_criteria || "Нужно выбрать решение и, если требуется, оставить комментарий."}
                    </Typography>

                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Stack spacing={0.75}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          1. Напишите комментарий
                        </Typography>
                        <TextField
                          label="Комментарий человека"
                          size="small"
                          multiline
                          minRows={3}
                          value={humanDecisionComment}
                          onChange={(event) => setHumanDecisionComment(event.target.value)}
                          helperText={commentRequired ? "Комментарий обязателен для предпросмотра решения." : "Комментарий необязателен, но помогает зафиксировать причину решения."}
                        />
                      </Stack>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Stack spacing={0.75}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          2. Выберите решение
                        </Typography>
                        <List dense disablePadding>
                          {HUMAN_DECISION_ORDER.map((decisionType) => (
                            <ListItem key={decisionType} disableGutters sx={{ py: 0.15 }}>
                              <ListItemText
                                primaryTypographyProps={{ variant: "body2" }}
                                secondaryTypographyProps={{ variant: "caption", color: "text.secondary" }}
                                primary={HUMAN_DECISION_ACTION_LABEL[decisionType]}
                                secondary={HUMAN_DECISION_DESCRIPTION[decisionType]}
                              />
                            </ListItem>
                          ))}
                        </List>
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1} useFlexGap flexWrap="wrap">
                          {HUMAN_DECISION_ORDER.map((decisionType) => (
                            <Button
                              key={decisionType}
                              size="small"
                              variant={humanDecisionPreview?.decisionType === decisionType ? "contained" : "outlined"}
                              color={decisionType === "done" ? "success" : decisionType === "cancel" ? "warning" : "info"}
                              disabled={commentRequired && !humanDecisionComment.trim()}
                              onClick={() => handlePreviewHumanDecision(decisionType, commentRequired)}
                            >
                              {HUMAN_DECISION_ACTION_LABEL[decisionType]}
                            </Button>
                          ))}
                        </Stack>
                      </Stack>
                    </Paper>

                    {humanDecisionPreview ? (
                      <Alert severity={humanDecisionPreviewMeta(humanDecisionPreview.decisionType).severity}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {humanDecisionPreviewMeta(humanDecisionPreview.decisionType).title}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Что будет дальше:</strong> {humanDecisionPreviewMeta(humanDecisionPreview.decisionType).nextStep}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Комментарий человека:</strong> {humanDecisionPreview.comment || "не указан"}
                        </Typography>
                      </Alert>
                    ) : null}
                  </Stack>
                </SectionCard>
              ) : null}

              {abTestPlan ? (
                <SectionCard title="План A/B">
                  <Stack spacing={0.6}>
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
                      <strong>Ожидаемый delta, %:</strong> {abTestPlan.expected_delta_pct === null ? "не зафиксировано" : abTestPlan.expected_delta_pct}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Guardrails
                    </Typography>
                    {renderStringList(abTestPlan.guardrails)}
                    <Typography variant="body2">
                      <strong>Откат при провале:</strong> {yesNoLabel(abTestPlan.rollback_on_fail)}
                    </Typography>
                  </Stack>
                </SectionCard>
              ) : null}

              <SectionCard
                title="Технические детали"
                action={
                  <Button size="small" variant="text" onClick={() => setTechnicalDetailsOpen((value) => !value)}>
                    {technicalDetailsOpen ? "Скрыть технические детали" : "Показать технические детали"}
                  </Button>
                }
              >
                <Stack spacing={0.8}>
                  <Typography variant="body2" color="text.secondary">
                    {buildToolsSummary(details)}
                  </Typography>

                  <Collapse in={technicalDetailsOpen}>
                    <Stack spacing={0.8} sx={{ pt: 0.6 }}>
                      {humanGate?.codex_prompt ? (
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Промпт для Codex
                          </Typography>
                          <Button size="small" variant="outlined" sx={{ width: "fit-content" }} onClick={() => void copyText(humanGate.codex_prompt)}>
                            {copiedPrompt === humanGate.codex_prompt ? "Скопировано" : "Скопировать промпт для Codex"}
                          </Button>
                        </Stack>
                      ) : null}
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
                  </Collapse>
                </Stack>
              </SectionCard>

              <SectionCard title="Контекст готов">
                <Stack spacing={0.8}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="body2" component="span">
                      <strong>Статус:</strong>
                    </Typography>
                    <Chip
                      size="small"
                      color={READINESS_COLOR[details.readiness.readiness_final_state]}
                      label={readinessUiLabel}
                    />
                  </Box>
                  <Typography variant="body2">{buildReadinessSummary(details, readinessMissing)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ручная проверка: {MANUAL_READINESS_LABEL[details.readiness.readiness_manual_state]}
                  </Typography>
                </Stack>
              </SectionCard>

              <SectionCard title="История событий">
                <TaskTimeline events={details.timeline} />
              </SectionCard>
            </>
          ) : null}
        </Stack>
      </Box>

      <TextContentModal
        open={rulesModalOpen}
        title={rulesDocument?.title || "Правила по работе с задачами"}
        content={rulesDocument?.content || `Файл ${TASK_RULES_PATH} не найден в docs-index. Обновите content index.`}
        path={TASK_RULES_PATH}
        updatedAt={rulesDocument?.updatedAt || null}
        sourceUrl={rulesDocument?.sourceUrl || null}
        onClose={() => setRulesModalOpen(false)}
      />
    </Drawer>
  );
}
