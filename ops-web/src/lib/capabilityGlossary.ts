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