import type { AgentSummary } from "./generatedData";

export type AgentFlowInlineMarker = {
  id: "verify_branch" | "capability_loop";
  label: string;
  hint: string;
  tone: "info" | "warning";
};

export function isCapabilityLoopMandatory(agent: AgentSummary): boolean {
  const policy = agent.capabilityOptimization;
  return Boolean(policy?.enabled) && String(policy?.refreshMode || "").toLowerCase() === "on_run";
}

export function buildStepInlineMarkers(stepId: string, agent: AgentSummary): AgentFlowInlineMarker[] {
  const markers: AgentFlowInlineMarker[] = [];
  if (stepId === "step_8_verify") {
    markers.push({
      id: "verify_branch",
      label: "Проверка результата",
      hint: "Здесь агент проверяет, сработало ли изменение. Если нет — возвращается к исправлению и повторной проверке.",
      tone: "info",
    });
  }
  if (stepId === "step_9_publish_snapshots" && isCapabilityLoopMandatory(agent)) {
    markers.push({
      id: "capability_loop",
      label: "Обновление способностей",
      hint: "После завершения цикла агент обновляет свой рабочий профиль, чтобы в следующем запуске действовать точнее.",
      tone: "warning",
    });
  }
  return markers;
}
