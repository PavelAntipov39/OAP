import { Box, Chip, Divider, Link, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { AgentDoneGatePolicy, AgentLearningArtifacts, AgentMemoryContext, AgentOperatingPlan } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";

const OPERATING_PLAN_PATH = "docs/subservices/oap/ANALYST_OPERATING_PLAN.md";
const BPMN_FLOW_PATH = "docs/bpmn/analyst-agent-flow.bpmn";
const LOG_PATH = ".logs/agents/analyst-agent.jsonl";
const ERROR_LOG_PATH = ".logs/agents/analyst-agent-errors.jsonl";
const RISKS_REPORT_PATH = "artifacts/agent_cycle_validation_report.json";
const ANALYST_FLOW_HASH = "#/agent-flow";

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
              path={OPERATING_PLAN_PATH}
              label={OPERATING_PLAN_PATH}
              onClick={onOpenFile}
            />
          </Box>
        </Box>

        {/* Схема работы агента */}
        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5 }}
            onClick={() => openInNewTab(ANALYST_FLOW_HASH)}
          >
            <OpenInNewIcon sx={{ fontSize: 14 }} />
            Схема работы агента
          </Link>
          <Box sx={{ mt: 0.5, pl: 1.5 }}>
            <FilePathLink
              path={BPMN_FLOW_PATH}
              label={BPMN_FLOW_PATH}
              onClick={() => openInNewTab(ANALYST_FLOW_HASH)}
            />
          </Box>
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
              path={LOG_PATH}
              label={LOG_PATH}
              onClick={() => onOpenAgentLog()}
            />
          </Box>
        </Box>

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
              onClick={() => onOpenFile(ERROR_LOG_PATH)}
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
              path={ERROR_LOG_PATH}
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
              onClick={() => onOpenFile(RISKS_REPORT_PATH)}
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
              path={RISKS_REPORT_PATH}
              onClick={onOpenFile}
            />
          </Box>
        </Box>
      </Stack>
    </SectionBlock>
  );
}
