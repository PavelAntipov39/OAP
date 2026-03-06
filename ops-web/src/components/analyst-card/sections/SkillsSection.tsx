import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Chip, Stack, Tooltip, Typography } from "@mui/material";
import type { AgentSummary } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";

function displayPath(path: string): string {
  const value = String(path || "").trim();
  if (!value) return value;
  const repoMarker = "/Downloads/VS Code/ОАП/";
  const codexMarker = "/.codex/";
  const repoIdx = value.indexOf(repoMarker);
  if (repoIdx !== -1) return value.slice(repoIdx + repoMarker.length);
  const codexIdx = value.indexOf(codexMarker);
  if (codexIdx !== -1) return value.slice(codexIdx + 1);
  return value;
}

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

export function SkillsSection({
  agent,
  latestSessionSkillNames,
  onOpenFile,
}: {
  agent: AgentSummary;
  latestSessionSkillNames: string[];
  onOpenFile: (path: string) => void;
}) {
  const normalizedLatestSkills = Array.from(
    new Set((latestSessionSkillNames || []).map((value) => String(value || "").trim()).filter(Boolean)),
  );
  const usedSkillsCatalog = agent.usedSkills || [];
  const usedSkillsByName = new Map(usedSkillsCatalog.map((skill) => [skill.name, skill]));
  const effectiveUsedSkills =
    normalizedLatestSkills.length > 0
      ? normalizedLatestSkills.map((name) => usedSkillsByName.get(name)).filter(Boolean)
      : usedSkillsCatalog;
  const skillNamesToRender =
    normalizedLatestSkills.length > 0
      ? normalizedLatestSkills
      : Array.from(new Set(effectiveUsedSkills.map((item) => item?.name || "").filter(Boolean)));
  const skillPaths = Array.from(
    new Set(
      effectiveUsedSkills
        .map((item) => String(item?.skillFilePath || "").trim())
        .filter(Boolean),
    ),
  );
  const usedTools = Array.isArray(agent.usedTools) ? agent.usedTools : [];
  const availableTools = Array.isArray(agent.availableTools) ? agent.availableTools : [];
  const usedMcp = Array.isArray(agent.usedMcp) ? agent.usedMcp : [];
  const rulesApplied = Array.isArray(agent.rulesApplied) ? agent.rulesApplied : [];

  return (
    <SectionBlock
      title="Рабочий контур агента"
      tooltip="Единый рабочий контур: Навыки (SKILL.md), Инструменты (capabilities), MCP/Интеграции (подключения) и Правила (governance)."
    >
      <Stack spacing={1.5}>
        <Stack spacing={0.6}>
          <SectionTitle
            title="Навыки"
            tooltip="Только навыки с реальным SKILL.md, которые были использованы агентом в сессии."
          />
          {skillNamesToRender.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              не зафиксировано за последний цикл сессии
            </Typography>
          ) : (
            <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
              {skillNamesToRender.map((name) => (
                <Chip key={`work-contour-skill-${name}`} size="small" variant="outlined" label={name} />
              ))}
            </Stack>
          )}
          {skillPaths.length > 0 ? (
            <Stack spacing={0.35}>
              {skillPaths.map((path) => (
                <FilePathLink key={`work-contour-skill-path-${path}`} path={path} label={displayPath(path)} onClick={onOpenFile} />
              ))}
            </Stack>
          ) : null}
        </Stack>

        <Stack spacing={0.6}>
          <SectionTitle
            title="Инструменты"
            tooltip="Именованные capabilities, которые агент использует или рекомендует к использованию."
          />
          {usedTools.length > 0 ? (
            <Stack spacing={0.5}>
              {usedTools.map((tool) => (
                <Stack key={`work-contour-tool-${tool.name}`} direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                  <Chip size="small" variant="outlined" label={tool.name} />
                  <Typography variant="caption" color="text.secondary">
                    {tool.usage}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              фактические инструменты не зафиксированы
            </Typography>
          )}
          {availableTools.length > 0 ? (
            <Typography variant="caption" color="text.secondary">
              Рекомендовано: {availableTools.map((tool) => tool.name).join(", ")}
            </Typography>
          ) : null}
        </Stack>

        <Stack spacing={0.6}>
          <SectionTitle
            title="MCP / Интеграции"
            tooltip="Транспорт и подключения к внешним системам: серверы MCP, доступность и статус использования."
          />
          {usedMcp.length > 0 ? (
            <Stack direction="row" spacing={0.7} useFlexGap flexWrap="wrap">
              {usedMcp.map((item) => (
                <Chip key={`work-contour-mcp-${item.name}`} size="small" variant="outlined" label={`${item.name} (${item.status})`} />
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              активные MCP-интеграции не зафиксированы
            </Typography>
          )}
        </Stack>

        <Stack spacing={0.6}>
          <SectionTitle
            title="Правила"
            tooltip="Операционные планы и policy-документы, которыми агент руководствуется в задачах."
          />
          {rulesApplied.length > 0 ? (
            <Stack spacing={0.4}>
              {rulesApplied.map((rule, index) => {
                const ruleTitle = String(rule?.title || "").trim() || `Правило ${index + 1}`;
                const rulePath = String(rule?.location || "").trim();
                return (
                  <Stack key={`work-contour-rule-${index}`} spacing={0.15}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      {ruleTitle}
                    </Typography>
                    {rulePath ? (
                      <FilePathLink path={rulePath} label={displayPath(rulePath)} onClick={onOpenFile} />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        путь не зафиксирован
                      </Typography>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary">
              правила не зафиксированы
            </Typography>
          )}
        </Stack>
      </Stack>
    </SectionBlock>
  );
}
