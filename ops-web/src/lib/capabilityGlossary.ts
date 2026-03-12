import glossary from "../generated/capability-glossary.json";
import type { ToolMcpMetadata } from "./toolsMcpRegistry";

export type CapabilityTypeKey = "skill" | "tool" | "mcp" | "rule";

export type CapabilityGlossaryText = {
  id: string;
  label: string;
  tooltip?: string;
  what: string;
  why: string;
  howInTable: string;
};

export type CapabilityTypeGlossaryEntry = CapabilityGlossaryText & {
  type: CapabilityTypeKey;
  where: string;
};

export type CapabilitySystemTermEntry = CapabilityGlossaryText & {
  where: string;
};

type CapabilityGlossaryData = {
  meta?: {
    title?: string;
    path?: string;
    description?: string;
  };
  capabilityTypes?: CapabilityTypeGlossaryEntry[];
  systemTerms?: CapabilitySystemTermEntry[];
  tableColumns?: CapabilityGlossaryText[];
};

const capabilityGlossary = glossary as CapabilityGlossaryData;
const glossaryPath = capabilityGlossary.meta?.path || "docs/subservices/oap/CAPABILITY_GLOSSARY.json";

const capabilityTypeMap = new Map(
  (capabilityGlossary.capabilityTypes || []).map((entry) => [entry.type, entry]),
);

const capabilityColumnMap = new Map(
  (capabilityGlossary.tableColumns || []).map((entry) => [entry.id, entry]),
);

const capabilitySystemTermMap = new Map(
  (capabilityGlossary.systemTerms || []).map((entry) => [entry.id, entry]),
);

export type TraceTaxonomyKind = "source_kind" | "semantic_layer";

export type TraceTaxonomyGlossaryEntry = {
  kind: TraceTaxonomyKind;
  raw: string;
  termId: string;
  label: string;
  tooltip: string;
  filePath: string;
  isFallback: boolean;
};

const TRACE_SOURCE_KIND_TERM_IDS: Record<string, string> = {
  registry: "term.trace_source_kind.registry",
  template_catalog: "term.trace_source_kind.template_catalog",
  operating_plan: "term.trace_source_kind.operating_plan",
  spec: "term.trace_source_kind.spec",
  contract: "term.trace_source_kind.contract",
  telemetry_log: "term.trace_source_kind.telemetry_log",
  generated_artifact: "term.trace_source_kind.generated_artifact",
  capability_snapshot: "term.trace_source_kind.capability_snapshot",
  unknown: "term.trace_source_kind.unknown",
};

const TRACE_SEMANTIC_LAYER_TERM_IDS: Record<string, string> = {
  skills: "term.trace_semantic_layer.skills",
  tools: "term.trace_semantic_layer.tools",
  mcp: "term.trace_semantic_layer.mcp",
  rules: "term.trace_semantic_layer.rules",
  tasks: "term.trace_semantic_layer.tasks",
  memory: "term.trace_semantic_layer.memory",
  schema: "term.trace_semantic_layer.schema",
  telemetry: "term.trace_semantic_layer.telemetry",
  unknown: "term.trace_semantic_layer.unknown",
};

function normalizeTraceTaxonomyRaw(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase() || "unknown";
}

function fallbackTraceLabel(raw: string): string {
  const cleaned = raw.replace(/[_-]+/g, " ").trim();
  if (!cleaned) return "Unknown";
  return cleaned[0].toUpperCase() + cleaned.slice(1);
}

function resolveTraceTaxonomy(
  kind: TraceTaxonomyKind,
  rawValue: string | null | undefined,
): TraceTaxonomyGlossaryEntry {
  const raw = normalizeTraceTaxonomyRaw(rawValue);
  const knownMap = kind === "source_kind" ? TRACE_SOURCE_KIND_TERM_IDS : TRACE_SEMANTIC_LAYER_TERM_IDS;
  const unknownTermId = kind === "source_kind" ? "term.trace_source_kind.unknown" : "term.trace_semantic_layer.unknown";
  const otherTermId = kind === "source_kind" ? "term.trace_source_kind.other" : "term.trace_semantic_layer.other";

  const isKnown = Boolean(knownMap[raw]);
  const termId = knownMap[raw] || (raw === "unknown" ? unknownTermId : otherTermId);
  const term = capabilitySystemTermMap.get(termId);
  const fallbackTooltip = `raw: ${kind}=${raw}`;

  return {
    kind,
    raw,
    termId,
    label: term?.label || fallbackTraceLabel(raw),
    tooltip: term?.tooltip || term?.what || fallbackTooltip,
    filePath: `${glossaryPath}#${termId}`,
    isFallback: !isKnown,
  };
}

export function getCapabilityGlossaryMeta() {
  return capabilityGlossary.meta || {};
}

export function getCapabilityTypeGlossary(type: CapabilityTypeKey): CapabilityTypeGlossaryEntry | null {
  return capabilityTypeMap.get(type) || null;
}

export function getCapabilityColumnGlossary(id: string): CapabilityGlossaryText | null {
  return capabilityColumnMap.get(id) || null;
}

export function getCapabilityColumnTooltip(id: string): string {
  const entry = getCapabilityColumnGlossary(id);
  if (!entry) return "";
  return entry.tooltip || entry.what;
}

export function getCapabilitySystemTermGlossaryList(): CapabilitySystemTermEntry[] {
  return [...capabilitySystemTermMap.values()];
}

export function getCapabilityTypeGlossaryList(): CapabilityTypeGlossaryEntry[] {
  return [...capabilityTypeMap.values()];
}

export function getCapabilityColumnGlossaryList(): CapabilityGlossaryText[] {
  return [...capabilityColumnMap.values()];
}

export function getTraceSourceKindGlossary(rawValue: string | null | undefined): TraceTaxonomyGlossaryEntry {
  return resolveTraceTaxonomy("source_kind", rawValue);
}

export function getTraceSemanticLayerGlossary(rawValue: string | null | undefined): TraceTaxonomyGlossaryEntry {
  return resolveTraceTaxonomy("semantic_layer", rawValue);
}

export function getCapabilityTypeTooltipMetadata(type: CapabilityTypeKey): ToolMcpMetadata | null {
  const entry = getCapabilityTypeGlossary(type);
  if (!entry) return null;

  return {
    name: entry.label,
    type,
    description: entry.what,
    practicalTasks: [
      `Где применяется: ${entry.where}`,
      `Как помогает в таблице: ${entry.howInTable}`,
    ],
    impactInNumbers: `Зачем нужно: ${entry.why}`,
    filePath: `${glossaryPath}#${entry.id}`,
  };
}
