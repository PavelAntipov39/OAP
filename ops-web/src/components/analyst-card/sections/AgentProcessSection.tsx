import React from "react";
import { Box, Link, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
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
    key: "state-typography-consistency",
    title: "Консистентность состояний и типографики",
    check: "Одинаковые статусы, цвета, подписи и типографический ритм (font-size/weight/line-height) трактуются одинаково во всех блоках.",
    prevents: "Убирает противоречивые трактовки состояния задачи и визуальные расхождения между однотипными элементами интерфейса.",
    impacts: "Влияет на количество ошибок проверки, стабильность процесса и скорость чтения карточки.",
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
  const bodyTextSx = { lineHeight: 1.55, color: "text.primary" } as const;
  const actionTextSx = { fontWeight: 600, lineHeight: 1.45, cursor: "pointer", display: "inline-flex", alignItems: "center" } as const;
  const secondaryTextSx = { display: "block", mt: 0.25, lineHeight: 1.45, color: "text.secondary" } as const;
  const hintIconSx = { fontSize: 14, color: "text.secondary", cursor: "help", ml: 0.5, verticalAlign: "middle" } as const;

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
          <Typography variant="body2" sx={bodyTextSx}>
            {shortDescription}
          </Typography>
        ) : null}

        <Box>
          <Typography variant="body2" sx={bodyTextSx}>
            <Box component="span" sx={{ fontWeight: 600 }}>Режим работы агента:</Box>{" "}
            <Box component="span">{modeValue}</Box>
            <Tooltip title="Определяет, как строго агент проверяет результат перед завершением задачи. В мягком режиме (soft_warning) нарушения фиксируются, но не блокируют. В строгом (strict) — задача не закроется без прохождения всех проверок." arrow placement="top">
              <InfoOutlinedIcon sx={hintIconSx} />
            </Tooltip>
          </Typography>
        </Box>

        {/* Описание правил работы агента */}
        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={actionTextSx}
            onClick={() => onOpenFile(operatingPlanPath)}
          >
            Описание правил работы агента
          </Link>
          <Tooltip title="Открывает операционный стандарт агента: ежедневный цикл, политику источников, правила принятия решений, метрики и жизненный цикл улучшений." arrow placement="top">
            <InfoOutlinedIcon sx={hintIconSx} />
          </Tooltip>
        </Box>

        <Box>
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            sx={actionTextSx}
            onClick={onOpenImprovementHistory}
          >
            История улучшений агента
          </Link>
          <Tooltip title="Журнал всех принятых улучшений: откуда пришла практика, что изменилось, на какие метрики повлияло и был ли откат. Помогает отслеживать эволюцию агента." arrow placement="top">
            <InfoOutlinedIcon sx={hintIconSx} />
          </Tooltip>
        </Box>

        {isDesignerAgent ? (
          <Box>
            <Typography variant="body2" sx={{ ...actionTextSx, cursor: "default" }}>
              UX-гейт качества перед передачей в разработку
            </Typography>
            <Typography variant="body2" sx={secondaryTextSx}>
              Контрольный список продакт-дизайнера, который снижает риск регрессий и возвратов после внедрения.
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.8 }}>
              {DESIGNER_UX_GATE_ITEMS.map((item, index) => (
                <Box key={`designer-ux-gate-${item.key}`} sx={{ pl: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {index + 1}. {item.title}
                  </Typography>
                  <Typography variant="body2" sx={{ ...secondaryTextSx, mt: 0.2 }}>
                    Что проверяем: {item.check}
                  </Typography>
                  <Typography variant="body2" sx={{ ...secondaryTextSx, mt: 0.1 }}>
                    Что предотвращает: {item.prevents}
                  </Typography>
                  <Typography variant="body2" sx={{ ...secondaryTextSx, mt: 0.1 }}>
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
              sx={{ ...actionTextSx, gap: 0.5 }}
              onClick={() => openInNewTab(flowLinkHash)}
            >
              <OpenInNewIcon sx={{ fontSize: 14 }} />
              Схема работы агента
            </Link>
            <Tooltip title="Визуальная схема бизнес-процесса агента: шаги, точки принятия решений, источники данных и результаты каждого этапа. Открывается в новой вкладке." arrow placement="top">
              <InfoOutlinedIcon sx={hintIconSx} />
            </Tooltip>
          </Box>
        ) : null}

        <Box>
          {hasSessions ? (
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              sx={actionTextSx}
              onClick={onOpenSessionsList}
            >
              Список сессий цикла агента
            </Link>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary" }}>
              Список сессий цикла агента
            </Typography>
          )}
          <Tooltip title="Хронологический список рабочих сессий агента: когда запускался, какие задачи выполнял, сколько длилась сессия и какой был результат." arrow placement="top">
            <InfoOutlinedIcon sx={hintIconSx} />
          </Tooltip>
          <Box sx={{ mt: 0.45 }}>
            <Link
              component="button"
              type="button"
              variant="body2"
              underline="hover"
              sx={actionTextSx}
              onClick={onOpenLessonsModal}
            >
                Самоулучшение агента (Self-improvement loop): {lessonsCount}
            </Link>
            <Tooltip title="Контур обучения агента: сколько уроков зафиксировано после ошибок и коррекций. Каждый урок содержит причину, превентивное правило и влияние на будущие решения." arrow placement="top">
              <InfoOutlinedIcon sx={hintIconSx} />
            </Tooltip>
          </Box>
        </Box>


      </Stack>
    </SectionBlock>
  );
}
