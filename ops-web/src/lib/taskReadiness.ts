import type { AgentTaskReadinessManualState, AgentTaskReadinessState } from "./generatedData";

export const READINESS_LABEL: Record<AgentTaskReadinessState, string> = {
  ready: "Можно брать",
  needs_clarification: "Нужно уточнение",
};

export const READINESS_COLOR: Record<AgentTaskReadinessState, "success" | "warning"> = {
  ready: "success",
  needs_clarification: "warning",
};

export const MANUAL_READINESS_LABEL: Record<AgentTaskReadinessManualState, string> = {
  approved: "Подтверждено ревьюером",
  needs_clarification: "Нужно уточнение у постановщика",
  not_set: "Ручная проверка не выполнена",
};

const CHECK_LABEL: Record<string, string> = {
  has_goal: "цель задачи",
  has_expected_outcome: "ожидаемый результат",
  has_acceptance_criteria: "критерии приемки",
  has_target_artifacts: "целевые артефакты",
  has_evidence_or_origin: "доказательства или источник",
};

export function getMissingReadinessItems(checks: Record<string, boolean>): string[] {
  return Object.entries(CHECK_LABEL)
    .filter(([key]) => checks[key] === false)
    .map(([, label]) => label);
}

export function formatReadinessSummary(
  autoScore: number,
  autoState: AgentTaskReadinessState,
  manualState: AgentTaskReadinessManualState,
): string {
  return `Авто: ${READINESS_LABEL[autoState]} (${autoScore}/5), ручная проверка: ${MANUAL_READINESS_LABEL[manualState]}`;
}
