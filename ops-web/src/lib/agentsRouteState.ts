export type AgentTabKey =
  | "overview"
  | "mcp"
  | "skills_rules"
  | "tasks_quality"
  | "memory_context"
  | "improvements";

export type AgentsModalKey =
  | "capability_comparison"
  | "capability_journal"
  | "metrics_catalog"
  | "operative_memory"
  | "lessons"
  | "sessions"
  | "improvement_history";

export type AgentsRouteState = {
  agentId: string | null;
  tabKey: AgentTabKey;
  modalKey: AgentsModalKey | null;
  modalEntityKey: string | null;
};

export type AgentKindResolver = (agentId: string) => boolean | null | undefined;

export const MODERN_TAB_KEYS: AgentTabKey[] = [
  "overview",
  "mcp",
  "skills_rules",
  "tasks_quality",
  "memory_context",
  "improvements",
];

export const LEGACY_TAB_KEYS: AgentTabKey[] = [
  "overview",
  "skills_rules",
  "tasks_quality",
  "memory_context",
  "improvements",
];

function normalizeRawValue(value: string): string {
  return value.toLowerCase().trim().replace(/[\s-]+/g, "_");
}

function normalizeModalKey(rawModal: string | null | undefined): AgentsModalKey | null {
  const raw = rawModal ? normalizeRawValue(rawModal) : "";
  if (!raw) return null;
  if (raw === "capability_comparison" || raw === "comparison" || raw === "capability") return "capability_comparison";
  if (raw === "capability_journal" || raw === "journal" || raw === "capability_details") return "capability_journal";
  if (raw === "metrics_catalog" || raw === "metrics" || raw === "metric_catalog") return "metrics_catalog";
  if (raw === "operative_memory" || raw === "memory_journal" || raw === "memory_trace") return "operative_memory";
  if (raw === "lessons" || raw === "agent_lessons" || raw === "lessons_drawer") return "lessons";
  if (raw === "sessions" || raw === "session_list" || raw === "sessions_drawer") return "sessions";
  if (raw === "improvement_history" || raw === "history" || raw === "improvements_history") return "improvement_history";
  return null;
}

export function normalizeTabKey(rawTab: string | null | undefined, isModernAgent: boolean | null | undefined): AgentTabKey {
  const raw = rawTab ? normalizeRawValue(rawTab) : "";
  if (!raw) return "overview";
  void isModernAgent;
  return "overview";
}

export function parseAgentsHash(hash: string, agentKindResolver?: AgentKindResolver): AgentsRouteState {
  const normalizedHash = String(hash || "").replace(/^#\/?/, "");
  const [routePart, queryPart = ""] = normalizedHash.split("?");
  if (!routePart.startsWith("agents")) {
    return { agentId: null, tabKey: "overview", modalKey: null, modalEntityKey: null };
  }

  const params = new URLSearchParams(queryPart);
  const agentRaw = String(params.get("agent") || "").trim();
  const agentId = agentRaw.length > 0 ? agentRaw : null;
  const isModern = agentId ? (agentKindResolver?.(agentId) ?? null) : null;
  const modalKey = normalizeModalKey(params.get("modal"));
  const capabilityRaw = String(params.get("capability") || "").trim();
  const entityRaw = String(params.get("entity") || "").trim();
  const modalEntityKey = (() => {
    if (modalKey === "capability_journal") return capabilityRaw.length > 0 ? capabilityRaw : null;
    if (modalKey === "metrics_catalog") return entityRaw.length > 0 ? entityRaw : (agentId || "analyst");
    if (modalKey === "operative_memory") return entityRaw.length > 0 ? entityRaw : "latest";
    if (modalKey === "lessons") return entityRaw === "global" ? "global" : "agent";
    if (modalKey === "sessions") return entityRaw.length > 0 ? entityRaw : "latest";
    if (modalKey === "improvement_history") return null;
    return null;
  })();

  return {
    agentId,
    tabKey: normalizeTabKey(params.get("tab"), isModern),
    modalKey,
    modalEntityKey,
  };
}

export function canonicalizeState(
  state: {
    agentId: string | null;
    tabKey: string | null | undefined;
    modalKey?: string | null | undefined;
    modalEntityKey?: string | null | undefined;
  },
  availableAgentIds: Iterable<string>,
  agentKindResolver?: AgentKindResolver,
): AgentsRouteState {
  const knownAgentIds = new Set(availableAgentIds);
  const normalizedAgentId = state.agentId && knownAgentIds.has(state.agentId) ? state.agentId : null;
  const normalizedModalKey = normalizeModalKey(state.modalKey);
  const modalEntityRaw = typeof state.modalEntityKey === "string" ? state.modalEntityKey.trim() : "";
  const normalizedModalEntityKey = modalEntityRaw.length > 0 ? modalEntityRaw : null;
  const agentScopedModal = normalizedModalKey === "metrics_catalog"
    || normalizedModalKey === "operative_memory"
    || normalizedModalKey === "lessons"
    || normalizedModalKey === "sessions"
    || normalizedModalKey === "improvement_history";

  const resolvedModal = (() => {
    if (!normalizedModalKey) return { modalKey: null, modalEntityKey: null };
    if (normalizedModalKey === "capability_journal") {
      if (!normalizedModalEntityKey) {
        return { modalKey: "capability_comparison" as const, modalEntityKey: null };
      }
      return { modalKey: "capability_journal" as const, modalEntityKey: normalizedModalEntityKey };
    }
    if (normalizedModalKey === "metrics_catalog") {
      return { modalKey: "metrics_catalog" as const, modalEntityKey: normalizedModalEntityKey || normalizedAgentId || "analyst" };
    }
    if (normalizedModalKey === "operative_memory") {
      return { modalKey: "operative_memory" as const, modalEntityKey: normalizedModalEntityKey || "latest" };
    }
    if (normalizedModalKey === "lessons") {
      return { modalKey: "lessons" as const, modalEntityKey: normalizedModalEntityKey === "global" ? "global" : "agent" };
    }
    if (normalizedModalKey === "sessions") {
      return { modalKey: "sessions" as const, modalEntityKey: normalizedModalEntityKey || "latest" };
    }
    if (normalizedModalKey === "improvement_history") {
      return { modalKey: "improvement_history" as const, modalEntityKey: null };
    }
    return { modalKey: "capability_comparison" as const, modalEntityKey: null };
  })();

  if (!normalizedAgentId) {
    if (agentScopedModal) {
      return { agentId: null, tabKey: "overview", modalKey: null, modalEntityKey: null };
    }
    return { agentId: null, tabKey: "overview", ...resolvedModal };
  }

  const isModern = agentKindResolver?.(normalizedAgentId) ?? null;
  return {
    agentId: normalizedAgentId,
    tabKey: normalizeTabKey(state.tabKey, isModern),
    ...resolvedModal,
  };
}

export function buildAgentsHash(state: AgentsRouteState): string {
  if (!state.agentId && !state.modalKey) {
    return "#/agents";
  }

  const params = new URLSearchParams();
  if (state.agentId) {
    params.set("agent", state.agentId);
    params.set("tab", state.tabKey);
  }
  if (state.modalKey) {
    params.set("modal", state.modalKey);
    if (state.modalKey === "capability_journal" && state.modalEntityKey) {
      params.set("capability", state.modalEntityKey);
    }
    if (state.modalKey === "metrics_catalog") {
      params.set("entity", state.modalEntityKey || "analyst");
    }
    if (state.modalKey === "operative_memory") {
      params.set("entity", state.modalEntityKey || "latest");
    }
    if (state.modalKey === "lessons") {
      params.set("entity", state.modalEntityKey === "global" ? "global" : "agent");
    }
    if (state.modalKey === "sessions") {
      params.set("entity", state.modalEntityKey || "latest");
    }
  }

  return `#/agents?${params.toString()}`;
}
