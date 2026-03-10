import React from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import type { SessionFlowSchema, SessionFlowTableRow } from "../../lib/analystCardData";
import { FilePathLink } from "../analyst-card/FilePathLink";
import { SkillToolMcpTooltip } from "../skill-tooltip/SkillToolMcpTooltip";
import type { ToolMcpMetadata } from "../../lib/toolsMcpRegistry";

const FILE_TYPE_GLOSSARY_METADATA: Record<string, ToolMcpMetadata> = {
  tools: {
    name: "Tools",
    type: "tool",
    description: "Инструменты, которые агент использует для конкретных операций в задаче.",
    practicalTasks: [
      "Используется для точечных действий внутри цикла выполнения.",
      "Помогает увидеть практический операционный контур задачи.",
    ],
    impactInNumbers: "Source of truth: docs/subservices/oap/CAPABILITY_GLOSSARY.json#capability_type.tool",
    filePath: "docs/subservices/oap/CAPABILITY_GLOSSARY.json#capability_type.tool",
  },
  skills: {
    name: "Skills",
    type: "skill",
    description: "Внутренние повторяемые навыки агента, используемые в рабочем контуре.",
    practicalTasks: [
      "Показывает устойчивые рабочие приемы агента.",
      "Связывает шаги с профильными сценариями выполнения.",
    ],
    impactInNumbers: "Source of truth: docs/subservices/oap/CAPABILITY_GLOSSARY.json#capability_type.skill",
    filePath: "docs/subservices/oap/CAPABILITY_GLOSSARY.json#capability_type.skill",
  },
  "mcp / integrations": {
    name: "MCP / Integrations",
    type: "mcp",
    description: "Внешние интеграции и сервисы, подключенные через MCP и runtime-адаптеры.",
    practicalTasks: [
      "Используется, когда агенту нужен внешний контекст и функции сервиса.",
      "Показывает связь шага с внешними зависимостями.",
    ],
    impactInNumbers: "Source of truth: docs/subservices/oap/CAPABILITY_GLOSSARY.json#capability_type.mcp",
    filePath: "docs/subservices/oap/CAPABILITY_GLOSSARY.json#capability_type.mcp",
  },
  rules: {
    name: "Rules",
    type: "rule",
    description: "Явные правила и ограничения, которые влияют на решение на этом шаге.",
    practicalTasks: [
      "Используется для контроля качества и безопасных ограничений.",
      "Фиксирует policy-контур принятия решения.",
    ],
    impactInNumbers: "Source of truth: docs/subservices/oap/CAPABILITY_GLOSSARY.json#capability_type.rule",
    filePath: "docs/subservices/oap/CAPABILITY_GLOSSARY.json#capability_type.rule",
  },
  "оперативная память": {
    name: "Оперативная память",
    type: "rule",
    description: "Контекст текущего цикла: спецификация, контракты и рабочие якоря задачи.",
    practicalTasks: [
      "Показывает данные, на которые агент опирается прямо сейчас.",
      "Нужна для прозрачности решения внутри активного цикла.",
    ],
    impactInNumbers: "Source of truth: docs/subservices/oap/CAPABILITY_GLOSSARY.json#term.file_type_operational_memory",
    filePath: "docs/subservices/oap/CAPABILITY_GLOSSARY.json#term.file_type_operational_memory",
  },
  "долговременная память": {
    name: "Долговременная память",
    type: "rule",
    description: "Стабильные уроки и накопленные правила, переносимые между циклами.",
    practicalTasks: [
      "Сохраняет практический опыт агента между задачами.",
      "Помогает не повторять одни и те же ошибки.",
    ],
    impactInNumbers: "Source of truth: docs/subservices/oap/CAPABILITY_GLOSSARY.json#term.file_type_long_term_memory",
    filePath: "docs/subservices/oap/CAPABILITY_GLOSSARY.json#term.file_type_long_term_memory",
  },
  "self-improvement loop": {
    name: "Self-improvement loop",
    type: "rule",
    description: "Контур фиксации уроков и обновления правил после проверки результата.",
    practicalTasks: [
      "Связывает verify с lesson capture и следующими улучшениями.",
      "Показывает цикл обучения агента на практике.",
    ],
    impactInNumbers: "Source of truth: docs/subservices/oap/CAPABILITY_GLOSSARY.json#term.file_type_self_improvement_loop",
    filePath: "docs/subservices/oap/CAPABILITY_GLOSSARY.json#term.file_type_self_improvement_loop",
  },
};

function fileTypeChipColor(fileType: string): "default" | "warning" | "success" | "primary" {
  const normalized = String(fileType || "").trim().toLowerCase();
  if (normalized === "tools") return "warning";
  if (normalized === "skills") return "success";
  if (normalized === "mcp / integrations") return "primary";
  return "default";
}

function fileTypeMetadata(fileType: string): ToolMcpMetadata | null {
  const normalized = String(fileType || "").trim().toLowerCase();
  return FILE_TYPE_GLOSSARY_METADATA[normalized] || null;
}

function renderFileTypeCell(fileType: string) {
  const label = String(fileType || "").trim();
  if (!label) return "";

  return (
    <SkillToolMcpTooltip
      name={label}
      label={label}
      size="small"
      variant="outlined"
      metadataOverride={fileTypeMetadata(label)}
      chipColorOverride={fileTypeChipColor(label)}
    />
  );
}

function renderRows(rows: SessionFlowTableRow[], onOpenFile: (path: string) => void) {
  return rows.map((row, index) => (
    <TableRow key={`${row.stageKey}-${row.filePath || "empty"}-${index}`}>
      <TableCell sx={{ minWidth: 240 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {row.stageLabel}
        </Typography>
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap", minWidth: 120 }}>{row.stageStartedAt || ""}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap", minWidth: 100 }}>
        {row.stageTokens == null ? "" : row.stageTokens}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap", minWidth: 120 }}>{row.crudAction}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap", minWidth: 180 }}>{renderFileTypeCell(row.sourceLabel)}</TableCell>
      <TableCell sx={{ whiteSpace: "nowrap", minWidth: 180 }}>{renderFileTypeCell(row.semanticLabel)}</TableCell>
      <TableCell sx={{ minWidth: 360 }}>
        {row.filePath ? (
          <FilePathLink path={row.filePath} onClick={onOpenFile} />
        ) : (
          <Typography variant="body2" color="text.disabled">
            {row.isExecuted ? "без файловых операций" : ""}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  ));
}

export function SessionFlowSchemaModal({
  open,
  onClose,
  flowSchema,
  onOpenFile,
}: {
  open: boolean;
  onClose: () => void;
  flowSchema: SessionFlowSchema | null;
  onOpenFile: (path: string) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: "calc(100vw - 12px)", md: "min(1260px, calc(100vw - 48px))" },
          maxWidth: "100vw",
          height: { xs: "92vh", md: "88vh" },
        },
      }}
    >
      <DialogTitle sx={{ pr: 6, fontWeight: 700 }}>
        Схема работы агента последней сессии
        <IconButton onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }} aria-label="Закрыть">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {!flowSchema ? (
          <Typography variant="body2" color="text.secondary">
            Данные сессии не найдены.
          </Typography>
        ) : (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={0.8}>
                <Typography variant="body2">
                  <strong>ID сессии:</strong> {flowSchema.sessionId}
                </Typography>
                <Typography variant="body2">
                  <strong>Время запуска:</strong> {flowSchema.sessionStartedAtLabel || ""}
                </Typography>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.4 }}>
                    Файлы-источники таблицы:
                  </Typography>
                  <Stack spacing={0.25}>
                    {flowSchema.sourceFiles.map((path) => (
                      <FilePathLink key={path} path={path} onClick={onOpenFile} />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1.1}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Канонический backbone этой сессии
                </Typography>
                <Typography variant="body2">
                  <strong>Версия:</strong> {flowSchema.workflowBackbone.version}
                </Typography>
                <Typography variant="body2">
                  <strong>Исполнено этапов:</strong> {flowSchema.workflowBackbone.executedSteps.length} из{" "}
                  {flowSchema.workflowBackbone.commonCoreSteps.length}
                </Typography>
                <Typography variant="body2">
                  <strong>Skipped-этапы:</strong> {flowSchema.workflowBackbone.skippedSteps.length}
                </Typography>

                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.35 }}>
                    Общий backbone для всех агентов
                  </Typography>
                  <Stack spacing={0.3}>
                    {flowSchema.workflowBackbone.commonCoreSteps.map((step) => (
                      <Typography key={step.key} variant="body2">
                        {step.label}
                      </Typography>
                    ))}
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.35 }}>
                    Уникальная ветка агента
                  </Typography>
                  <Typography variant="body2">{flowSchema.workflowBackbone.roleWindow.purpose}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.7 }}>
                    <strong>Вход:</strong> {flowSchema.workflowBackbone.roleWindow.entryLabel}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Выход:</strong> {flowSchema.workflowBackbone.roleWindow.exitLabel}
                  </Typography>
                  <Box sx={{ mt: 0.7 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }}>
                      Внутренние шаги role window
                    </Typography>
                    <Stack spacing={0.3}>
                      {flowSchema.workflowBackbone.roleWindow.internalSteps.map((step) => (
                        <Typography key={step.key} variant="body2">
                          {step.label}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                  <Typography variant="body2" sx={{ mt: 0.7 }}>
                    <strong>Фактически зафиксированные шаги внутри ветки:</strong>{" "}
                    {flowSchema.workflowBackbone.roleWindow.observedSteps.length > 0
                      ? flowSchema.workflowBackbone.roleWindow.observedSteps.join(", ")
                      : "не зафиксировано"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Политика skipped:</strong>{" "}
                    {flowSchema.workflowBackbone.stepExecutionPolicy.skippedStepsAllowed
                      ? `разрешено, статус = ${flowSchema.workflowBackbone.stepExecutionPolicy.skippedStepStatus}`
                      : "не разрешено"}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Dynamic specialist instances:</strong>{" "}
                    {flowSchema.workflowBackbone.supportsDynamicInstances ? "поддерживаются" : "не поддерживаются"}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ overflow: "hidden" }}>
              <Box sx={{ maxHeight: 460, overflow: "auto" }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Этап</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Время начала</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Токены этапа</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Действие по CRUD</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Источник</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Слой</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Путь к файлу</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>{renderRows(flowSchema.canonicalRows, onOpenFile)}</TableBody>
                </Table>
              </Box>
            </Paper>

            {flowSchema.outOfCanonRows.length > 0 ? (
              <>
                <Divider />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Вне канона (фактические шаги telemetry)
                </Typography>
                <Paper variant="outlined" sx={{ overflow: "hidden" }}>
                  <Box sx={{ maxHeight: 300, overflow: "auto" }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Этап</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Время начала</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Токены этапа</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Действие по CRUD</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Источник</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Слой</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Путь к файлу</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>{renderRows(flowSchema.outOfCanonRows, onOpenFile)}</TableBody>
                    </Table>
                  </Box>
                </Paper>
              </>
            ) : null}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
