export type AgentTabKey =
  | "overview"
  | "mcp"
  | "skills_rules"
  | "tasks_quality"
  | "memory_context"
  | "improvements";

export type AgentsRouteState = {
  agentId: string | null;
  tabKey: AgentTabKey;
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
    return { agentId: null, tabKey: "overview" };
  }

  const params = new URLSearchParams(queryPart);
  const agentRaw = String(params.get("agent") || "").trim();
  const agentId = agentRaw.length > 0 ? agentRaw : null;
  const isModern = agentId ? (agentKindResolver?.(agentId) ?? null) : null;

  return {
    agentId,
    tabKey: normalizeTabKey(params.get("tab"), isModern),
  };
}

export function canonicalizeState(
  state: { agentId: string | null; tabKey: string | null | undefined },
  availableAgentIds: Iterable<string>,
  agentKindResolver?: AgentKindResolver,
): AgentsRouteState {
  const knownAgentIds = new Set(availableAgentIds);
  const normalizedAgentId = state.agentId && knownAgentIds.has(state.agentId) ? state.agentId : null;
  if (!normalizedAgentId) {
    return { agentId: null, tabKey: "overview" };
  }

  const isModern = agentKindResolver?.(normalizedAgentId) ?? null;
  return {
    agentId: normalizedAgentId,
    tabKey: normalizeTabKey(state.tabKey, isModern),
  };
}

export function buildAgentsHash(state: AgentsRouteState): string {
  if (!state.agentId) {
    return "#/agents";
  }
  const params = new URLSearchParams();
  params.set("agent", state.agentId);
  params.set("tab", state.tabKey);
  return `#/agents?${params.toString()}`;
}
