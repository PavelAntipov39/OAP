import type { AgentLatestCycleFileTraceEdge, AgentLatestCycleSnapshot } from "./generatedData";

function quote(value: string): string {
  return value.replace(/"/g, '\\"');
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "не зафиксировано";
  return `${value.toFixed(1)}%`;
}

export function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "не зафиксировано";
  return `${value}`;
}

export function formatDateTime(value: string | null): string {
  if (!value) return "не зафиксировано";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

export async function fetchLatestCycleRuntime(): Promise<AgentLatestCycleSnapshot | null> {
  try {
    const response = await fetch(`/generated/agent-latest-cycle-analyst.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as AgentLatestCycleSnapshot;
  } catch {
    return null;
  }
}

function pickTopEdges(edges: AgentLatestCycleFileTraceEdge[], limit = 40): AgentLatestCycleFileTraceEdge[] {
  if (edges.length <= limit) return edges;
  return edges.slice(0, limit);
}

export function buildFileTraceMermaid(snapshot: AgentLatestCycleSnapshot): string {
  const edges = pickTopEdges(snapshot.file_trace?.edges || []);
  if (edges.length === 0) {
    return 'flowchart LR\n  A["Нет file-trace"] --> B["Добавьте artifacts_read/artifacts_written в telemetry"]';
  }

  const lines: string[] = ["flowchart LR"];
  const stepIds = new Map<string, string>();
  const fileIds = new Map<string, string>();
  let stepIndex = 0;
  let fileIndex = 0;

  const stepNode = (step: string): string => {
    if (stepIds.has(step)) return stepIds.get(step)!;
    stepIndex += 1;
    const id = `S${stepIndex}`;
    stepIds.set(step, id);
    lines.push(`  ${id}["${quote(step)}"]`);
    return id;
  };

  const fileNode = (path: string): string => {
    if (fileIds.has(path)) return fileIds.get(path)!;
    fileIndex += 1;
    const id = `F${fileIndex}`;
    fileIds.set(path, id);
    lines.push(`  ${id}["${quote(path)}"]`);
    return id;
  };

  for (const edge of edges) {
    const s = stepNode(edge.step || "unknown-step");
    const f = fileNode(edge.path || "unknown-path");
    const edgeLabel = edge.kind === "write" ? "write" : "read";
    lines.push(`  ${s} -->|"${edgeLabel}"| ${f}`);
  }

  return lines.join("\n");
}

