import React from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import { getAnalystCardData } from "../lib/analystCardData";
import { getOapKbIndex, getDocsIndex, type OapKbDocument, type DocsDocument } from "../lib/generatedData";
import { TextContentModal } from "../components/TextContentModal";

/* ------------------------------------------------------------------ */
/*  Mermaid loader                                                      */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    mermaid?: {
      initialize: (config: Record<string, unknown>) => void;
      render: (id: string, value: string) => Promise<{ svg: string }>;
    };
  }
}

const MERMAID_CDN = [
  "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
  "https://unpkg.com/mermaid@11/dist/mermaid.min.js",
];

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector(`script[data-ops-ve="${src}"]`) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.opsVe = src;
    script.addEventListener("load", () => { script.dataset.loaded = "true"; resolve(); }, { once: true });
    script.addEventListener("error", () => reject(new Error("mermaid_load_error")), { once: true });
    document.head.appendChild(script);
  });
}

async function loadMermaid(): Promise<void> {
  for (const src of MERMAID_CDN) {
    try { await loadScript(src); return; } catch { /* try next */ }
  }
  throw new Error("mermaid_unavailable");
}

/* ------------------------------------------------------------------ */
/*  Flowchart                                                           */
/* ------------------------------------------------------------------ */

const FLOW_DIAGRAM = `flowchart TD
  A([🚀 Запуск daily цикла]) --> B["Step 1 · started\\ntelemetry.py\\n→ analyst-agent.jsonl"]
  B --> C["Step 2 · Health-check\\nЧтение: registry.yaml\\ntelemetry_summary.json"]
  C --> D{Деградации\\nнайдены?}
  D -- Да --> E["🔴 Риски\\n→ analyst-agent.jsonl\\n(critical уведомление)"]
  D -- Нет --> F["Step 3 · Проверка KB\\nREADME.md · DESIGN_RULES.md\\nschema.json · AGENTS.md"]
  E --> F
  F --> G["Step 4 · Whitelist-источники\\n🌐 docs/changelog\\n→ recommendation_suggested"]
  G --> H["Step 5 · ICE-приоритизация\\nFull list → top-priority\\n→ registry.yaml improvements"]
  H --> I["Step 6 · Внедрение\\nbuild_content_index.mjs\\n→ agents-manifest.json"]
  I --> J["Step 7 · Верификация\\nЧтение: analyst-agent.jsonl\\n→ verify_passed / failed"]
  J --> K{Верификация\\nпрошла?}
  K -- Да --> L["Step 8 · completed\\nnotify_analyst_digest.mjs\\n→ Telegram digest"]
  K -- Нет --> M["❌ Откат → backlog"]
  M --> H
  L --> N([✅ Цикл завершён])

  style A fill:#eaf2ff,stroke:#1b5fa8,color:#101828
  style N fill:#eaf7ee,stroke:#2e7d32,color:#101828
  style D fill:#fff8e1,stroke:#f59e0b,color:#101828
  style K fill:#fff8e1,stroke:#f59e0b,color:#101828
  style E fill:#fff0f0,stroke:#ef5350,color:#101828
  style M fill:#ffebee,stroke:#ef5350,color:#101828
`;

/* ------------------------------------------------------------------ */
/*  Steps with CRUD file table                                          */
/* ------------------------------------------------------------------ */

type StepFile = { path: string; crud: string };
type StepDef = { num: number; label: string; description: string; files: StepFile[] };

const STEPS: StepDef[] = [
  {
    num: 1,
    label: "Запуск цикла",
    description: "Агент фиксирует статус started в телеметрии. Создаётся трассировка новой сессии с уникальным run_id и trace_id.",
    files: [
      { path: "scripts/agent_telemetry.py", crud: "Запуск" },
      { path: "docs/agents/registry.yaml", crud: "Чтение" },
      { path: "docs/subservices/oap/README.md", crud: "Чтение" },
      { path: ".logs/agents/analyst-agent.jsonl", crud: "Запись (started)" },
    ],
  },
  {
    num: 2,
    label: "Health-check агентов",
    description: "Проверка статусов всех агентов реестра: задачи, review-ошибки, деградации MCP. При деградации — немедленная фиксация риска и critical-уведомление.",
    files: [
      { path: "docs/agents/registry.yaml", crud: "Чтение" },
      { path: "artifacts/agent_telemetry_summary.json", crud: "Чтение" },
      { path: ".logs/agents/analyst-agent.jsonl", crud: "Запись" },
    ],
  },
  {
    num: 3,
    label: "Проверка базы знаний ОАП",
    description: "Сверка актуальности spec, контрактов и правил ОАП. Schema Guard валидирует структуру карточек агентов. Убеждаемся, что решения опираются на актуальные стандарты.",
    files: [
      { path: "docs/subservices/oap/README.md", crud: "Чтение" },
      { path: "docs/subservices/oap/DESIGN_RULES.md", crud: "Чтение" },
      { path: "docs/subservices/oap/agents-card.schema.json", crud: "Чтение + валидация" },
      { path: "AGENTS.md", crud: "Чтение" },
      { path: ".logs/agents/analyst-agent.jsonl", crud: "Запись" },
    ],
  },
  {
    num: 4,
    label: "Мониторинг внешних источников",
    description: "Опрос whitelist-источников: официальные docs/changelog Anthropic/OpenAI, OSS-практики. При обнаружении новой практики — фиксация candidate со статусом candidate_received.",
    files: [
      { path: "docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md", crud: "Чтение (sourcePolicy)" },
      { path: ".logs/agents/analyst-agent.jsonl", crud: "Запись (candidate_received)" },
    ],
  },
  {
    num: 5,
    label: "Формирование и приоритизация улучшений",
    description: "Генерация полного списка кандидатов с owner, metric, baseline, expected delta. Приоритизация по ICE-score (Impact × Confidence × Ease). Top-priority идут в внедрение, остальное — в backlog.",
    files: [
      { path: "docs/agents/registry.yaml", crud: "Чтение" },
      { path: "docs/subservices/oap/agents-card.schema.json", crud: "Чтение" },
      { path: "artifacts/agent_telemetry_summary.json", crud: "Чтение" },
      { path: "docs/agents/registry.yaml", crud: "Запись (improvements[], приоритеты)" },
      { path: ".logs/agents/analyst-agent.jsonl", crud: "Запись" },
    ],
  },
  {
    num: 6,
    label: "Внедрение top-priority изменений",
    description: "Применение только подтверждённых top-priority улучшений. Остальное остаётся в backlog. Перестройка content-индексов после изменений.",
    files: [
      { path: "ops-web/scripts/build_content_index.mjs", crud: "Запуск" },
      { path: "ops-web/src/generated/agents-manifest.json", crud: "Запись" },
      { path: ".logs/agents/analyst-agent.jsonl", crud: "Запись (recommendation_applied)" },
    ],
  },
  {
    num: 7,
    label: "Верификация эффекта и регрессий",
    description: "Проверка target-метрик и регрессий после внедрения. Запись verify_started → verify_passed или verify_failed. При провале — откат изменения в backlog.",
    files: [
      { path: ".logs/agents/analyst-agent.jsonl", crud: "Чтение + Запись (verify_*)" },
      { path: "artifacts/agent_telemetry_summary.json", crud: "Чтение + Запись" },
      { path: "artifacts/agent_telemetry_summary.md", crud: "Запись" },
    ],
  },
  {
    num: 8,
    label: "Финализация и уведомления",
    description: "Запись completed или failed. Фиксация урока (lesson_captured). Critical-уведомления — сразу. Daily digest — в конце цикла в Telegram.",
    files: [
      { path: ".logs/agents/analyst-agent.jsonl", crud: "Запись (lesson_captured, completed/failed)" },
      { path: "artifacts/agent_telemetry_summary.json", crud: "Запись" },
      { path: "scripts/notify_analyst_digest.mjs", crud: "Запуск" },
      { path: "artifacts/agent_cycle_validation_report.json", crud: "Запись" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

type ModalState = { open: boolean; title: string; content: string; path: string | null; updatedAt: string | null };
const EMPTY_MODAL: ModalState = { open: false, title: "", content: "", path: null, updatedAt: null };

export function VisualExplainerPage() {
  const mermaidRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [modal, setModal] = React.useState<ModalState>(EMPTY_MODAL);
  const [expanded, setExpanded] = React.useState<number | false>(false);

  const kbDocs = React.useMemo(() => getOapKbIndex(), []);
  const docsDocs = React.useMemo(() => getDocsIndex(), []);
  const cardData = React.useMemo(() => getAnalystCardData(), []);

  const lastRunAt = React.useMemo(() => {
    const sessions = cardData?.sessions ?? [];
    if (sessions.length === 0) return null;
    const latest = sessions.reduce((a, b) => (a.completedAt > b.completedAt ? a : b));
    return new Date(latest.completedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" });
  }, [cardData]);

  const handleOpenFile = React.useCallback(
    (path: string) => {
      const allDocs: Array<{ title: string; path: string; content: string; updatedAt: string }> = [
        ...kbDocs.map((d: OapKbDocument) => ({ title: d.title, path: d.path, content: d.content, updatedAt: d.updatedAt })),
        ...docsDocs.map((d: DocsDocument) => ({ title: d.title, path: d.path, content: d.content, updatedAt: d.updatedAt })),
      ];
      const norm = path.replace(/^\/+/, "");
      const doc = allDocs.find((d) => {
        const dp = d.path.replace(/^\/+/, "");
        return dp === norm || dp.endsWith(norm) || norm.endsWith(dp);
      });
      if (doc) {
        setModal({ open: true, title: doc.title, content: doc.content, path: doc.path, updatedAt: doc.updatedAt });
      } else {
        setModal({ open: true, title: path.split("/").pop() ?? path, content: `Содержимое файла \`${path}\` не найдено в индексе.`, path, updatedAt: null });
      }
    },
    [kbDocs, docsDocs],
  );

  React.useEffect(() => {
    let cancelled = false;

    async function render() {
      setLoading(true);
      setError(null);
      try {
        await loadMermaid();
        if (cancelled || !mermaidRef.current) return;

        const mermaid = window.mermaid;
        if (!mermaid) throw new Error("mermaid_not_found");

        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            background: "#ffffff",
            primaryColor: "#eaf2ff",
            primaryBorderColor: "#93c5fd",
            lineColor: "#1b5fa8",
            tertiaryColor: "#f6f8fc",
            fontFamily: "Inter, Google Sans, Segoe UI, Roboto, Arial, sans-serif",
            fontSize: "13px",
          },
        });

        const id = `ve-analyst-flow-${Date.now()}`;
        const { svg } = await mermaid.render(id, FLOW_DIAGRAM);
        if (!cancelled && mermaidRef.current) {
          mermaidRef.current.innerHTML = svg;
        }
      } catch (err) {
        if (!cancelled) setError(String((err as Error)?.message || err || "render_error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void render();
    return () => { cancelled = true; };
  }, []);

  const agentName = cardData?.agent?.name ?? "analyst-agent";
  const agentDescription = cardData?.agent?.shortDescription
    ?? "Пошаговая схема daily-цикла: что читает, что пишет, как принимает решения.";

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", py: 3, px: 2 }}>
      {/* Back */}
      <Button
        size="small"
        startIcon={<ArrowBackIcon />}
        href="#/agents"
        sx={{ mb: 2.5, textTransform: "none" }}
        variant="text"
      >
        Назад к агентам
      </Button>

      {/* Header */}
      <Stack spacing={0.75} sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
            Процесс работы агента — {agentName}
          </Typography>
          <Chip size="small" label="Business Logic" variant="outlined" />
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720, lineHeight: 1.65 }}>
          {agentDescription} Схема отражает 8 шагов daily-цикла, артефакты каждого шага и точки принятия
          решений. Построена по{" "}
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            onClick={() => handleOpenFile("docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md")}
            sx={{ verticalAlign: "baseline" }}
          >
            OPERATING_PLAN.md
          </Link>
          .
        </Typography>

        <Stack direction="row" spacing={3} alignItems="center" sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <FolderOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">
              Путь агента:&nbsp;
            </Typography>
            <Box component="span" sx={{ fontFamily: "monospace", fontSize: "0.78rem", color: "text.primary" }}>
              docs/subservices/oap/agents/analyst-agent/
            </Box>
            <Tooltip
              title="Все файлы агента лежат в папке docs/subservices/oap/agents/analyst-agent/. Правило: один агент = одна папка. Подробнее в OPERATING_PLAN.md."
              arrow
            >
              <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary", cursor: "help", ml: 0.25 }} />
            </Tooltip>
          </Stack>

          {lastRunAt ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 15, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary">
                Последний запуск:&nbsp;
                <Box component="span" sx={{ color: "text.primary", fontWeight: 500 }}>{lastRunAt}</Box>
              </Typography>
            </Stack>
          ) : null}
        </Stack>
      </Stack>

      {/* Mermaid flowchart */}
      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Процесс работы агента (flowchart)
          </Typography>
          <Tooltip
            title="Схема daily-цикла. Узлы показывают ключевые файлы и артефакты каждого шага. Кликните шаг в списке ниже для деталей."
            arrow
          >
            <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.secondary", cursor: "help" }} />
          </Tooltip>
        </Stack>

        {loading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 4, justifyContent: "center" }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">Загрузка диаграммы…</Typography>
          </Box>
        ) : null}

        {error ? (
          <Alert severity="warning" sx={{ mt: 1 }}>
            Не удалось загрузить Mermaid: {error}
          </Alert>
        ) : null}

        <Box
          ref={mermaidRef}
          sx={{
            overflow: "auto",
            "& svg": { maxWidth: "100%", height: "auto" },
            display: loading ? "none" : "block",
          }}
        />
      </Paper>

      {/* Steps breakdown — Accordion */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Детализация шагов
      </Typography>

      <Stack spacing={0.5}>
        {STEPS.map((step) => (
          <Accordion
            key={step.num}
            expanded={expanded === step.num}
            onChange={(_, isExpanded) => setExpanded(isExpanded ? step.num : false)}
            variant="outlined"
            sx={{
              borderRadius: "12px !important",
              "&:before": { display: "none" },
              overflow: "hidden",
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, minHeight: 48 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    minWidth: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: "primary.light",
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.82rem",
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {step.label}
                </Typography>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.65 }}>
                {step.description}
              </Typography>

              {step.files.length > 0 ? (
                <Table size="small" sx={{ "& td, & th": { py: 0.5, px: 1.5 } }}>
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell>Файл</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>Действие (CRUD)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {step.files.map((f, idx) => (
                      <TableRow key={`${f.path}-${idx}`} sx={{ "&:last-child td": { border: 0 } }}>
                        <TableCell>
                          <Link
                            component="button"
                            type="button"
                            variant="body2"
                            underline="hover"
                            onClick={() => handleOpenFile(f.path)}
                            sx={{ fontFamily: "monospace", fontSize: "0.78rem", textAlign: "left", cursor: "pointer", color: "primary.main" }}
                          >
                            {f.path}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={f.crud}
                            variant="outlined"
                            sx={{ fontSize: "0.71rem", height: 20, borderRadius: 1 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      {/* Source */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="caption" color="text.secondary">
          Источник:{" "}
          <Link
            component="button"
            type="button"
            variant="caption"
            underline="hover"
            onClick={() => handleOpenFile("docs/subservices/oap/agents/analyst-agent/OPERATING_PLAN.md")}
          >
            OPERATING_PLAN.md
          </Link>
          {" · "}
          <Link
            component="button"
            type="button"
            variant="caption"
            underline="hover"
            onClick={() => handleOpenFile("docs/subservices/oap/agents/analyst-agent/FLOW.md")}
          >
            FLOW.md
          </Link>
        </Typography>
      </Box>

      <TextContentModal
        open={modal.open}
        title={modal.title}
        content={modal.content}
        path={modal.path}
        updatedAt={modal.updatedAt}
        onClose={() => setModal(EMPTY_MODAL)}
      />
    </Box>
  );
}
