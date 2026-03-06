import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import type { AgentSummary } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";
import { ExternalLink } from "../ExternalLink";

// MECE-разграничение элементов раздела:
// - Уроки агента (lessonsPath)   = аналитические паттерны/выводы из ошибок (КАК улучшились)
// - История изменений (changeLogPath) = аудит-лог: дата/файл/что изменено (ЧТО сделано)
// - Список задач для самоулучшения   = живая страница задач с фильтром (ЧТО запланировано)
// - "План задач" (todoPath) удалён — дублировал "Список задач для самоулучшения"

function formatRuDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SelfImprovementSection({
  agent,
  onOpenFile,
}: {
  agent: AgentSummary;
  onOpenFile: (path: string) => void;
}) {
  const improvements = agent.improvements ?? [];
  const rules = agent.rulesApplied ?? [];
  const wp = agent.workflowPolicy;
  const la = agent.learningArtifacts;
  const operatingPlan = agent.operatingPlan;
  const highPriority = improvements.filter((imp) => imp.priority === "Высокий" || imp.priority === "high").length;

  return (
    <SectionBlock
      title="Самоулучшение агента (Self-improvement loop)"
      tooltip="Система непрерывного улучшения агента: найденные улучшения, бизнес-логика самоулучшения, история изменений и активные задачи"
    >
      {/* Блок 1 — Счётчики */}
      <Stack direction="row" spacing={2}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
            {improvements.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Улучшений найдено
          </Typography>
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "primary.main" }}>
            {highPriority}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Высокий приоритет
          </Typography>
        </Box>
      </Stack>

      {/* Топ-5 улучшений */}
      <Stack spacing={0.5}>
        {improvements.slice(0, 5).map((imp) => (
          <Box key={imp.title}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {imp.title}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`ICE: ${imp.ice.impact + imp.ice.confidence + imp.ice.ease}`}
                sx={{ fontSize: "0.7rem" }}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {imp.problem}
            </Typography>
          </Box>
        ))}
      </Stack>

      {/* Блок 2 — Правила самоулучшения (если есть) */}
      {rules.length > 0 ? (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Правила самоулучшения
          </Typography>
          <Stack spacing={0.5}>
            {rules.map((rule, i) => (
              <Box key={i}>
                <Typography variant="body2">{rule.title}</Typography>
                {rule.description ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {rule.description}
                  </Typography>
                ) : null}
              </Box>
            ))}
          </Stack>
        </>
      ) : null}

      {/* Блок 3 — Хронология и документация */}
      <Divider sx={{ my: 0.5 }} />

      <Stack direction="row" alignItems="baseline" spacing={0.5}>
        <Typography variant="body2" color="text.secondary">
          Время последнего улучшения:
        </Typography>
        <Typography variant="body2">
          {formatRuDate(la?.lastLessonAt)}
        </Typography>
      </Stack>

      <Box>
        <FilePathLink
          path="docs/subservices/oap/ANALYST_OPERATING_PLAN.md"
          label="Описание бизнес-логики самоулучшения агента"
          onClick={onOpenFile}
        />
        {wp ? (
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
            {wp.selfImprovementLoop && (
              <Chip size="small" label="Self-improvement loop" color="success" variant="outlined" />
            )}
            {wp.verifyBeforeDone && (
              <Chip size="small" label="Verify before done" variant="outlined" />
            )}
            {wp.autonomousBugfix && (
              <Chip size="small" label="Autonomous bugfix" variant="outlined" />
            )}
          </Stack>
        ) : null}
      </Box>

      {operatingPlan && operatingPlan.improvementLifecycle.length > 0 ? (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Схема бизнес-логики самоулучшения агента:
          </Typography>
          <Stack component="ol" sx={{ m: 0, pl: 2.5 }} spacing={0.25}>
            {operatingPlan.improvementLifecycle.map((step, i) => (
              <Typography component="li" variant="body2" key={i}>
                {step}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : null}

      {/* Блок 4 — История изменений и список задач */}
      <Divider sx={{ my: 0.5 }} />

      <Box>
        {la?.changeLogPath ? (
          <>
            <FilePathLink
              path={la.changeLogPath}
              label="История изменений по улучшению ИИ агента"
              onClick={onOpenFile}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontFamily: "monospace" }}>
              {la.changeLogPath}
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            История изменений по улучшению ИИ агента —{" "}
            <Typography component="span" variant="body2" sx={{ fontStyle: "italic" }}>
              файл не зафиксирован
            </Typography>
          </Typography>
        )}
      </Box>

      <ExternalLink href="#/tasks">
        Список задач для самоулучшения — {improvements.length} задач
      </ExternalLink>

      {/* Блок 5 — Источники обучения (только Уроки агента) */}
      {la ? (
        <>
          <Divider sx={{ my: 0.5 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Источники обучения
          </Typography>
          <FilePathLink path={la.lessonsPath} label="Уроки агента" onClick={onOpenFile} />
        </>
      ) : null}
    </SectionBlock>
  );
}
