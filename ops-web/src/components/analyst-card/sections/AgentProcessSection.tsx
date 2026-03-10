import { Box, Chip, Divider, Link, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { AgentDoneGatePolicy, AgentLearningArtifacts, AgentMemoryContext, AgentOperatingPlan } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";

const DEFAULT_OPERATING_PLAN_PATH = "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md";
const DEFAULT_BPMN_FLOW_PATH = "docs/bpmn/analyst-agent-flow.bpmn";
const DEFAULT_LOG_PATH = ".logs/agents/analyst-agent.jsonl";
const DEFAULT_ERROR_LOG_PATH = ".logs/agents/analyst-agent-errors.jsonl";
const DEFAULT_RISKS_REPORT_PATH = "artifacts/agent_cycle_validation_report.json";
const ANALYST_FLOW_HASH = "#/agent-flow";
const DESIGNER_OPERATING_PLAN_PATH = "docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md";
const DESIGNER_UX_GATE_RULES_PATH = "docs/subservices/oap/DESIGN_RULES.md";
const DESIGNER_UX_GATE_ITEMS: Array<{
  key: string;
  title: string;
  check: string;
  prevents: string;
  impacts: string;
}> = [
  {
    key: "priority-first-screen",
    title: "Приоритет первого экрана",
    check: "На первом экране оставляем только данные, нужные для следующего действия.",
    prevents: "Снижает риск пропустить критичный статус и уменьшает время поиска нужной информации.",
    impacts: "Влияет на скорость выполнения задачи и на долю задач без доуточнений.",
  },
  {
    key: "cta-clarity",
    title: "Ясность действия",
    check: "Кнопка и заголовок однозначно объясняют результат действия после клика.",
    prevents: "Уменьшает ошибочные действия и повторные открытия одной и той же задачи.",
    impacts: "Влияет на качество выполнения задач и длительность рабочего цикла.",
  },
  {
    key: "state-consistency",
    title: "Консистентность состояний",
    check: "Одинаковые статусы, цвета и подписи трактуются одинаково во всех блоках.",
    prevents: "Убирает противоречивые трактовки состояния задачи в разных частях интерфейса.",
    impacts: "Влияет на количество ошибок проверки и стабильность процесса.",
  },
  {
    key: "tooltip-inline-help",
    title: "Пояснения в точке риска",
    check: "Для неоднозначных метрик и действий есть tooltip или inline-help простым языком.",
    prevents: "Снижает число ручных уточнений перед запуском задачи.",
    impacts: "Влияет на скорость старта задачи и на количество возвратов в дизайн.",
  },
  {
    key: "safe-action-guardrails",
    title: "Защита рискованных действий",
    check: "Для действий с риском потери данных есть подтверждение и понятное описание последствий.",
    prevents: "Снижает вероятность случайных изменений и откатов.",
    impacts: "Влияет на регрессии, время исправлений и скорость доставки изменений.",
  },
];

function openInNewTab(hash: string) {
  const base = window.location.origin + window.location.pathname;
  window.open(`${base}${hash}`, "_blank", "noopener,noreferrer");
}

export function AgentProcessSection({
  operatingPlan,
  doneGatePolicy,
  shortDescription,
  learningArtifacts,
  memoryContext,
  operatingPlanPath = DEFAULT_OPERATING_PLAN_PATH,
  flowPath = DEFAULT_BPMN_FLOW_PATH,
  flowLinkHash,
  agentLogPath = DEFAULT_LOG_PATH,
  errorLogPath = DEFAULT_ERROR_LOG_PATH,
  risksReportPath = DEFAULT_RISKS_REPORT_PATH,
  hasSessions = true,
  onOpenFile,
  onOpenModal,
  onOpenAgentLog,
  onOpenSessionsList,
}: {
  operatingPlan: AgentOperatingPlan | null | undefined;
  doneGatePolicy?: AgentDoneGatePolicy | null;
  shortDescription?: string | null;
  learningArtifacts?: AgentLearningArtifacts | null;
  memoryContext?: AgentMemoryContext | null;
  operatingPlanPath?: string;
  flowPath?: string | null;
  flowLinkHash?: string | null;
  agentLogPath?: string;
  errorLogPath?: string;
  risksReportPath?: string;
  hasSessions?: boolean;
  onOpenFile: (path: string) => void;
  onOpenModal: (title: string, content: string) => void;
  onOpenAgentLog: () => void;
  onOpenSessionsList: () => void;
}) {
  const rulesContent = operatingPlan
    ? [
        `## Миссия\n${operatingPlan.mission}`,
        `\n## Процесс работы (${operatingPlan.dailyLoop.length} шагов)\n` +
          operatingPlan.dailyLoop.map((s, i) => `${i + 1}. ${s}`).join("\n"),
        operatingPlan.improvementLifecycle.length
          ? `\n## Цикл самосовершенствования\n` +
            operatingPlan.improvementLifecycle.map((s, i) => `${i + 1}. ${s}`).join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Операционный стандарт не загружен.";

  const modeValue = doneGatePolicy?.mode === "strict" ? "strict" : "soft_warning";
  const modeLabel = doneGatePolicy?.mode === "strict" ? "строгий" : "мягкий";
  const isDesignerAgent = operatingPlanPath.trim().toLowerCase() === DESIGNER_OPERATING_PLAN_PATH.toLowerCase();

  return (
    <SectionBlock
      title="Как работает ИИ агент"
      tooltip="Описание агента, правила его работы, схема бизнес-логики и журнал действий"
    >
      <Stack spacing={1.25}>
        {/* Описание — перенесено из шапки */}
        {shortDescription ? (
          <Typography variant="body2" sx={{ lineHeight: 1.6, color: "text.primary" }}>
            {shortDescription}
          </Typography>
        ) : null}

        <Box>
          <Typography variant="body2">
            <strong>Режим работы агента:</strong> {modeValue}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Фактический режим: {modeLabel}. Fallback status: {doneGatePolicy?.fallbackStatus || "in_review"}.
          </Typography>
        </Box>

        {/* Описание правил работы агента */}
        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
            onClick={() => onOpenModal("Описание правил работы агента", rulesContent)}
          >
            Описание правил работы агента
          </Link>
          <Box sx={{ mt: 0.5, pl: 1.5 }}>
            <FilePathLink
              path={operatingPlanPath}
              label={operatingPlanPath}
              onClick={onOpenFile}
            />
          </Box>
        </Box>

        {isDesignerAgent ? (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              UX-гейт качества перед передачей в разработку
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              Контрольный список продакт-дизайнера, который снижает риск регрессий и возвратов после внедрения.
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.8 }}>
              {DESIGNER_UX_GATE_ITEMS.map((item, index) => (
                <Box key={`designer-ux-gate-${item.key}`} sx={{ pl: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {index + 1}. {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2 }}>
                    Что проверяем: {item.check}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.1 }}>
                    Что предотвращает: {item.prevents}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.1 }}>
                    На какие метрики влияет: {item.impacts}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Box sx={{ mt: 0.6, pl: 1.5 }}>
              <FilePathLink
                path={DESIGNER_UX_GATE_RULES_PATH}
                label={DESIGNER_UX_GATE_RULES_PATH}
                onClick={onOpenFile}
              />
            </Box>
          </Box>
        ) : null}

        {/* Схема работы агента */}
        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5 }}
            onClick={() => {
              if (flowLinkHash) {
                openInNewTab(flowLinkHash);
                return;
              }
              if (flowPath) onOpenFile(flowPath);
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 14 }} />
            Схема работы агента
          </Link>
          {flowPath ? (
            <Box sx={{ mt: 0.5, pl: 1.5 }}>
              <FilePathLink
                path={flowPath}
                label={flowPath}
                onClick={onOpenFile}
              />
            </Box>
          ) : null}
        </Box>

        {/* Журнал действий агента */}
        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
            onClick={onOpenAgentLog}
          >
            Журнал действий агента
          </Link>
          <Box sx={{ mt: 0.5, pl: 1.5 }}>
            <FilePathLink
              path={agentLogPath}
              label={agentLogPath}
              onClick={() => onOpenAgentLog()}
            />
          </Box>
        </Box>

        {hasSessions ? (
          <Box>
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
              onClick={onOpenSessionsList}
            >
              Список сессий цикла агента
            </Link>
          </Box>
        ) : null}

        <Divider />

        {/* Журнал предложений по самоулучшению */}
        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
            onClick={() => {
              const path = learningArtifacts?.lessonsPath ?? "docs/subservices/oap/tasks/lessons/analyst-agent.md";
              onOpenFile(path);
            }}
          >
            Журнал предложений по самоулучшению агента
          </Link>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Предложения, которые агент фиксирует в процессе работы для своего улучшения (self-improvement loop)
          </Typography>
          <Box sx={{ mt: 0.5, pl: 1.5 }}>
            <FilePathLink
              path={learningArtifacts?.lessonsPath ?? "docs/subservices/oap/tasks/lessons/analyst-agent.md"}
              onClick={onOpenFile}
            />
          </Box>
        </Box>

        {/* Журнал списка ошибок */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
              onClick={() => onOpenFile(errorLogPath)}
            >
              Журнал списка ошибок
            </Link>
            <Tooltip title="Ошибки, зафиксированные самим агентом в ходе выполнения цикла его сессии" placement="top">
              <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.secondary", cursor: "help" }} />
            </Tooltip>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Время, контекст и описание каждой ошибки — для проверки и устранения
          </Typography>
          <Box sx={{ mt: 0.5, pl: 1.5 }}>
            <FilePathLink
              path={errorLogPath}
              onClick={onOpenFile}
            />
          </Box>
        </Box>

        {/* Риски */}
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
              onClick={() => onOpenFile(risksReportPath)}
            >
              Риски
            </Link>
            {memoryContext?.riskControl?.riskFlags && memoryContext.riskControl.riskFlags.length > 0 ? (
              <Chip
                size="small"
                color="warning"
                variant="outlined"
                label={`${memoryContext.riskControl.riskFlags.length} флаг${memoryContext.riskControl.riskFlags.length > 1 ? "а" : ""}`}
                sx={{ fontSize: "0.7rem", height: 18 }}
              />
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Критические риски и флаги безопасности, обнаруженные агентом в последнем цикле работы
          </Typography>
          <Box sx={{ mt: 0.5, pl: 1.5 }}>
            <FilePathLink
              path={risksReportPath}
              onClick={onOpenFile}
            />
          </Box>
        </Box>
      </Stack>
    </SectionBlock>
  );
}
