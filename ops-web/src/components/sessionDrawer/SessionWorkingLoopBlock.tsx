import React from "react";
import {
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AnalystSession } from "../../lib/analystCardData";
import { SkillToolMcpTooltip } from "../skill-tooltip/SkillToolMcpTooltip";
import type { ToolMcpMetadata } from "../../lib/toolsMcpRegistry";

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <Stack direction="row" spacing={0.7} alignItems="center">
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Tooltip title={tooltip} arrow placement="top">
        <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary", cursor: "help" }} />
      </Tooltip>
    </Stack>
  );
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function toSkillName(filePath: string): string {
  const normalized = String(filePath || "").trim();
  if (!normalized) return "skill";
  const parts = normalized.split("/").filter(Boolean);
  const tail = String(parts[parts.length - 1] || "").toLowerCase();
  if (tail === "skill.md") {
    return parts[parts.length - 2] || "skill";
  }
  const base = parts[parts.length - 1] || "skill";
  return base.replace(/\.[^.]+$/, "") || "skill";
}

function toRuleTitle(filePath: string, fallbackIndex: number): string {
  const normalized = String(filePath || "").trim();
  const lower = normalized.toLowerCase();
  if (lower === "agents.md") return "Операционный стандарт analyst-agent";
  if (lower.includes("qmd") && lower.includes("policy")) return "QMD Retrieval Policy";
  const parts = normalized.split("/").filter(Boolean);
  const base = (parts[parts.length - 1] || "").replace(/\.[^.]+$/, "").trim();
  if (!base) return `Правило ${fallbackIndex + 1}`;
  return base.replace(/[-_]+/g, " ");
}

export function SessionWorkingLoopBlock({
  session,
  onOpenFile,
}: {
  session: AnalystSession;
  onOpenFile: (path: string) => void;
}) {
  const flowRows = [...session.flowSchema.canonicalRows, ...session.flowSchema.outOfCanonRows];

  const skillPathCandidates = uniqueStrings(
    flowRows
      .filter((row) => String(row.semanticLayer || "").trim().toLowerCase() === "skills")
      .map((row) => String(row.filePath || "")),
  );
  const skillEntries = skillPathCandidates.map((path) => ({
    name: toSkillName(path),
    path,
  }));

  const toolsUsed = [...session.toolsUsed].sort();

  const mcpIntegrations = session.mcpUsed || [];

  const rulesFromFlow = uniqueStrings(
    flowRows
      .filter((row) => String(row.semanticLayer || "").trim().toLowerCase() === "rules")
      .map((row) => String(row.filePath || "")),
  );
  const rulesFromMemory = uniqueStrings(
    session.persistentMemory
      .filter((item) => {
        const lower = String(item.path || "").toLowerCase();
        return lower.includes("rule") || lower.includes("policy") || lower.includes("agents.md");
      })
      .map((item) => item.path),
  );
  const rulePaths = uniqueStrings([...rulesFromFlow, ...rulesFromMemory]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        backgroundColor: "#fff",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "8px",
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Рабочий контур агента
          </Typography>
          <Tooltip
            title="Единый рабочий контур: Навыки (SKILL.md), Инструменты (capabilities), MCP/Интеграции (подключения) и Правила (governance)."
            arrow
            placement="top"
          >
            <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary", cursor: "help" }} />
          </Tooltip>
        </Stack>

        <Stack spacing={1.5}>
          <Stack spacing={0.6}>
            <SectionTitle
              title="Навыки"
              tooltip="Только навыки с реальным SKILL.md, которые были использованы агентом в сессии."
            />
            {skillEntries.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                не зафиксировано за последний цикл сессии
              </Typography>
            ) : (
              <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                {skillEntries.map((skill) => {
                  const metadataOverride: ToolMcpMetadata = {
                    name: skill.name,
                    type: "skill",
                    description: "Навык, зафиксированный в рабочем контуре последней сессии.",
                    filePath: skill.path,
                  };
                  return (
                    <SkillToolMcpTooltip
                      key={`session-work-skill-${skill.path}`}
                      name={skill.name}
                      variant="outlined"
                      size="small"
                      onOpenFile={onOpenFile}
                      metadataOverride={metadataOverride}
                    />
                  );
                })}
              </Stack>
            )}
          </Stack>

          <Stack spacing={0.6}>
            <SectionTitle
              title="Инструменты"
              tooltip="Именованные capabilities, которые агент использует или рекомендует к использованию."
            />
            {toolsUsed.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                фактические инструменты не зафиксированы
              </Typography>
            ) : (
              <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                {toolsUsed.map((tool) => (
                  <SkillToolMcpTooltip
                    key={`session-work-tool-${tool}`}
                    name={tool}
                    variant="outlined"
                    size="small"
                    onOpenFile={onOpenFile}
                  />
                ))}
              </Stack>
            )}
          </Stack>

          <Stack spacing={0.6}>
            <SectionTitle
              title="MCP / Интеграции"
              tooltip="Транспорт и подключения к внешним системам: серверы MCP, доступность и статус использования."
            />
            {mcpIntegrations.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                активные MCP-интеграции не зафиксированы
              </Typography>
            ) : (
              <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                {mcpIntegrations.map((mcp, idx) => (
                  <SkillToolMcpTooltip
                    key={`session-work-mcp-${mcp.name}-${idx}`}
                    name={mcp.name}
                    status={mcp.status}
                    variant="outlined"
                    size="small"
                    onOpenFile={onOpenFile}
                  />
                ))}
              </Stack>
            )}
          </Stack>

          <Stack spacing={0.6}>
            <SectionTitle
              title="Правила"
              tooltip="Операционные планы и policy-документы, которыми агент руководствуется в задачах."
            />
            {rulePaths.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                правила не зафиксированы
              </Typography>
            ) : (
              <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
                {rulePaths.map((path, idx) => {
                  const ruleTitle = toRuleTitle(path, idx);
                  const metadataOverride: ToolMcpMetadata = {
                    name: ruleTitle,
                    type: "rule",
                    description: "Правило из рабочего контура последней сессии.",
                    filePath: path,
                  };
                  return (
                    <SkillToolMcpTooltip
                      key={`session-work-rule-${path}-${idx}`}
                      name={ruleTitle}
                      label={ruleTitle}
                      variant="outlined"
                      size="small"
                      onOpenFile={onOpenFile}
                      metadataOverride={metadataOverride}
                    />
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
