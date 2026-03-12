import React from "react";
import { Box, Link, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  getDocsIndex,
  type AgentDoneGatePolicy,
  type AgentMemoryContext,
  type AgentOperatingPlan,
} from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";

const DEFAULT_OPERATING_PLAN_PATH = "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md";
const DEFAULT_LESSONS_PATH = "docs/subservices/oap/tasks/lessons/analyst-agent.md";
const DESIGNER_OPERATING_PLAN_PATH = "docs/subservices/oap/agents/designer-agent/OPERATING_PLAN.md";
const DESIGNER_UX_GATE_RULES_PATH = "docs/subservices/oap/DESIGN_RULES.md";
const DESIGNER_UX_GATE_ITEMS: Array<{
  key: string;
  title: string;
  check: string;
  prevents: string;
  impacts: string;
}> = [
  {
    key: "priority-first-screen",
    title: "Приоритет первого экрана",
    check: "На первом экране оставляем только данные, нужные для следующего действия.",
    prevents: "Снижает риск пропустить критичный статус и уменьшает время поиска нужной информации.",
    impacts: "Влияет на скорость выполнения задачи и на долю задач без доуточнений.",
  },
  {
    key: "cta-clarity",
    title: "Ясность действия",
    check: "Кнопка и заголовок однозначно объясняют результат действия после клика.",
    prevents: "Уменьшает ошибочные действия и повторные открытия одной и той же задачи.",
    impacts: "Влияет на качество выполнения задач и длительность рабочего цикла.",
  },
  {
    key: "state-consistency",
    title: "Консистентность состояний",
    check: "Одинаковые статусы, цвета и подписи трактуются одинаково во всех блоках.",
    prevents: "Убирает противоречивые трактовки состояния задачи в разных частях интерфейса.",
    impacts: "Влияет на количество ошибок проверки и стабильность процесса.",
  },
  {
    key: "tooltip-inline-help",
    title: "Пояснения в точке риска",
    check: "Для неоднозначных метрик и действий есть tooltip или inline-help простым языком.",
    prevents: "Снижает число ручных уточнений перед запуском задачи.",
    impacts: "Влияет на скорость старта задачи и на количество возвратов в дизайн.",
  },
  {
    key: "safe-action-guardrails",
    title: "Защита рискованных действий",
    check: "Для действий с риском потери данных есть подтверждение и понятное описание последствий.",
    prevents: "Снижает вероятность случайных изменений и откатов.",
    impacts: "Влияет на регрессии, время исправлений и скорость доставки изменений.",
  },
];

function openInNewTab(hash: string) {
  const base = window.location.origin + window.location.pathname;
  window.open(`${base}${hash}`, "_blank", "noopener,noreferrer");
}

function countLessonsFromMarkdown(content: string): number {
  const registryStatusMap = new Map<string, "active" | "monitoring" | "outdated" | "archived">();
  const tableMatch = content.match(/\|\s*lesson_ref\s*\|[\s\S]*?(?=\n##|\n---|\s*$)/);
  if (tableMatch) {
    const rows = tableMatch[0].split("\n").slice(2);
    for (const row of rows) {
      const cells = row.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length < 2) continue;
      const ref = cells[0].replace(/`/g, "").trim();
      const status = cells[1].toLowerCase().trim();
      if (!ref) continue;
      if (status === "active" || status === "monitoring" || status === "outdated" || status === "archived") {
        registryStatusMap.set(ref, status);
      }
    }
  }

  const sections = content.split(/\n(?=## )/);
  let lessonsCount = 0;
  for (const section of sections) {
    const h2Match = section.match(/^## (.+)/);
    if (!h2Match) continue;
    const heading = h2Match[1].trim();
    if (/Реестр актуальности|Analyst Agent Lessons|_TEMPLATE/i.test(heading)) continue;
    const dateMatch = heading.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    // Keep the same compatibility behavior as previous lessons parser:
    // registry map is built to keep matching semantics stable across files.
    if (registryStatusMap.size > 0) {
      for (const key of registryStatusMap.keys()) {
        if (heading.includes(key) || key.includes(heading.slice(0, 30))) break;
      }
    }

    lessonsCount += 1;
  }
  return lessonsCount;
}

export function AgentProcessSection({
  operatingPlan,
  doneGatePolicy,
  shortDescription,
  memoryContext,
  operatingPlanPath = DEFAULT_OPERATING_PLAN_PATH,
  flowLinkHash,
  hasSessions = true,
  lessonsPath = DEFAULT_LESSONS_PATH,
  onOpenFile,
  onOpenLessonsModal,
  onOpenSessionsList,
  onOpenImprovementHistory,
}: {
  operatingPlan: AgentOperatingPlan | null | undefined;
  doneGatePolicy?: AgentDoneGatePolicy | null;
  shortDescription?: string | null;
  memoryContext?: AgentMemoryContext | null;
  operatingPlanPath?: string;
  flowLinkHash?: string | null;
  hasSessions?: boolean;
  lessonsPath?: string;
  onOpenFile: (path: string) => void;
  onOpenLessonsModal: () => void;
  onOpenSessionsList: () => void;
  onOpenImprovementHistory: () => void;
}) {
  const modeValue = doneGatePolicy?.mode === "strict" ? "strict" : "soft_warning";
  const modeLabel = doneGatePolicy?.mode === "strict" ? "строгий" : "мягкий";
  const isDesignerAgent = operatingPlanPath.trim().toLowerCase() === DESIGNER_OPERATING_PLAN_PATH.toLowerCase();
  const lessonsCount = React.useMemo(() => {
    const targetPath = (lessonsPath || DEFAULT_LESSONS_PATH).trim();
    if (!targetPath) return 0;
    const docs = getDocsIndex();
    const doc = docs.find((entry) => entry.path === targetPath || entry.path.endsWith(targetPath));
    if (!doc?.content) return 0;
    return countLessonsFromMarkdown(doc.content);
  }, [lessonsPath]);

  return (
    <SectionBlock
      title="Как работает ИИ агент"
      tooltip="Описание агента, правила его работы, схема бизнес-логики и журнал действий"
    >
      <Stack spacing={1.25}>
        {/* Описание — перенесено из шапки */}
        {shortDescription ? (
          <Typography variant="body2" sx={{ lineHeight: 1.6, color: "text.primary" }}>
            {shortDescription}
          </Typography>
        ) : null}

        <Box>
          <Typography variant="body2">
            <strong>Режим работы агента:</strong> {modeValue}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Фактический режим: {modeLabel}. Fallback status: {doneGatePolicy?.fallbackStatus || "in_review"}.
          </Typography>
        </Box>

        {/* Описание правил работы агента */}
        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
            onClick={() => onOpenFile(operatingPlanPath)}
          >
            Описание правил работы агента
          </Link>
        </Box>

        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
            onClick={onOpenImprovementHistory}
          >
            История улучшений агента
          </Link>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Откуда пришла практика, что взяли, что изменили, где применили и какой результат получили.
          </Typography>
        </Box>

        {isDesignerAgent ? (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              UX-гейт качества перед передачей в разработку
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
              Контрольный список продакт-дизайнера, который снижает риск регрессий и возвратов после внедрения.
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.8 }}>
              {DESIGNER_UX_GATE_ITEMS.map((item, index) => (
                <Box key={`designer-ux-gate-${item.key}`} sx={{ pl: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {index + 1}. {item.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.2 }}>
                    Что проверяем: {item.check}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.1 }}>
                    Что предотвращает: {item.prevents}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.1 }}>
                    На какие метрики влияет: {item.impacts}
                  </Typography>
                </Box>
              ))}
            </Stack>
            <Box sx={{ mt: 0.6, pl: 1.5 }}>
              <FilePathLink
                path={DESIGNER_UX_GATE_RULES_PATH}
                label={DESIGNER_UX_GATE_RULES_PATH}
                onClick={onOpenFile}
              />
            </Box>
          </Box>
        ) : null}

        {/* Схема работы агента */}
        {flowLinkHash ? (
          <Box>
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              sx={{ fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 0.5 }}
              onClick={() => openInNewTab(flowLinkHash)}
            >
              <OpenInNewIcon sx={{ fontSize: 14 }} />
              Схема работы агента
            </Link>
          </Box>
        ) : null}

        <Box>
          {hasSessions ? (
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              sx={{ fontWeight: 600, cursor: "pointer", display: "inline" }}
              onClick={onOpenSessionsList}
            >
              Список сессий цикла агента
            </Link>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
              Список сессий цикла агента
            </Typography>
          )}
          <Box sx={{ mt: 0.45 }}>
            <Link
              component="button"
              type="button"
              variant="caption"
              underline="hover"
              sx={{ cursor: "pointer", display: "inline" }}
              onClick={onOpenLessonsModal}
            >
                Самоулучшение агента (Self-improvement loop): {lessonsCount}
            </Link>
          </Box>
        </Box>


      </Stack>
    </SectionBlock>
  );
}
