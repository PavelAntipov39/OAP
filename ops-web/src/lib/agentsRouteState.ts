export type AgentTabKey =
  | "overview"
  | "mcp"
  | "skills_rules"
  | "tasks_quality"
  | "memory_context"
  | "improvements";

export type AgentsModalKey = "capability_comparison" | "capability_journal";

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
  return null;
}

export function normalizeTabKey(rawTab: string | null | undefined, isModernAgent: boolean | null | undefined): AgentTabKey {
  const raw = rawTab ? normalizeRawValue(rawTab) : "";
  if (!raw) return "overview";

  const tabOrder = isModernAgent === false ? LEGACY_TAB_KEYS : MODERN_TAB_KEYS;
  if (/^\d+$/.test(raw)) {
    const index = Number(raw);
    return tabOrder[index] || "overview";
  }

  if (raw === "overview" || raw === "home") return "overview";
  if (raw === "skills" || raw === "rules" || raw === "skills_rules") return "skills_rules";
  if (raw === "tasks" || raw === "quality" || raw === "tasks_quality") return "tasks_quality";
  if (raw === "memory" || raw === "context" || raw === "memory_context") return "memory_context";
  if (raw === "improvement" || raw === "improvements") return "improvements";

  if (raw === "mcp") {
    return isModernAgent === false ? "overview" : "mcp";
  }

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
  const modalEntityRaw = String(params.get("capability") || "").trim();

  return {
    agentId,
    tabKey: normalizeTabKey(params.get("tab"), isModern),
    modalKey,
    modalEntityKey: modalKey === "capability_journal" && modalEntityRaw.length > 0 ? modalEntityRaw : null,
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

  const resolvedModal = (() => {
    if (!normalizedModalKey) return { modalKey: null, modalEntityKey: null };
    if (normalizedModalKey === "capability_journal") {
      if (!normalizedModalEntityKey) {
        return { modalKey: "capability_comparison" as const, modalEntityKey: null };
      }
      return { modalKey: "capability_journal" as const, modalEntityKey: normalizedModalEntityKey };
    }
    return { modalKey: "capability_comparison" as const, modalEntityKey: null };
  })();

  if (!normalizedAgentId) {
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
  }

  return `#/agents?${params.toString()}`;
}
