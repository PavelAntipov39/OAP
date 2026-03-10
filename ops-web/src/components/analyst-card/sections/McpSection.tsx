import React from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import type { AgentSummary, AgentUsedMcp, AgentAvailableMcp } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";

/* ------------------------------------------------------------------ */
/*  Константы                                                           */
/* ------------------------------------------------------------------ */

const MCP_STATUS_ORDER: Record<string, number> = {
  active: 0,
  online: 0,
  degraded: 1,
  reauth_required: 2,
  offline: 3,
  not_connected: 4,
};

const MCP_STATUS_COLOR: Record<string, "success" | "warning" | "error" | "default"> = {
  active: "success",
  online: "success",
  degraded: "warning",
  reauth_required: "warning",
  offline: "error",
  not_connected: "default",
};

const MCP_STATUS_LABEL: Record<string, string> = {
  active: "Активен",
  online: "Активен",
  degraded: "Деградация",
  reauth_required: "Требует авторизации",
  offline: "Оффлайн",
  not_connected: "Не подключён",
};

const STATUS_TOOLTIP_CONTENT = (
  <Box sx={{ p: 0.25 }}>
    <Typography variant="caption" display="block" fontWeight={700} sx={{ mb: 0.5 }}>
      Статусы MCP-серверов:
    </Typography>
    <Typography variant="caption" display="block">✅ Активен — работает без ошибок, доступен агенту</Typography>
    <Typography variant="caption" display="block">⚠️ Деградация — отвечает, но с ошибками или задержками</Typography>
    <Typography variant="caption" display="block">🔐 Требует авторизации — истекли токены, нужна повторная авторизация</Typography>
    <Typography variant="caption" display="block">⛔ Оффлайн — сервер не отвечает, недоступен</Typography>
    <Typography variant="caption" display="block">➖ Не подключён — рекомендован, но не установлен</Typography>
  </Box>
);

/* ------------------------------------------------------------------ */
/*  Путь к конфигу MCP                                                  */
/* ------------------------------------------------------------------ */

const MCP_CONFIG_PATH = "ai/mcp/README.md";

/* ------------------------------------------------------------------ */
/*  Промпт задачи на подключение                                       */
/* ------------------------------------------------------------------ */

const STATUS_PROBLEM: Record<string, string> = {
  degraded: "MCP работает с ошибками или задержками. Необходима диагностика сервера.",
  reauth_required: "Истекли токены доступа. Необходима повторная авторизация.",
  offline: "MCP-сервер недоступен — не отвечает на запросы.",
  not_connected: "MCP рекомендован для агента, но не установлен в окружение.",
};

const STATUS_STEP2: Record<string, string> = {
  degraded: "Проверить логи MCP-сервера и устранить источник ошибок",
  reauth_required: "Обновить токены авторизации согласно документации MCP",
  offline: "Перезапустить MCP-сервер и проверить сетевую доступность",
  not_connected: "Установить MCP согласно инструкции в ai/mcp/README.md",
};

function buildMcpTaskPrompt(name: string, status: string): string {
  const problem = STATUS_PROBLEM[status] ?? "Неизвестная проблема с MCP.";
  const step2 = STATUS_STEP2[status] ?? "Устранить проблему согласно документации";
  return [
    `Задача: Восстановить/подключить MCP [${name}]`,
    ``,
    `Статус: ${MCP_STATUS_LABEL[status] ?? status}`,
    `Проблема: ${problem}`,
    ``,
    `Шаги решения:`,
    `1. Открыть конфигурацию: ai/mcp/README.md`,
    `2. ${step2}`,
    `3. Проверить соединение (MCP inspector или тестовый запрос)`,
    `4. Убедиться что статус в registry.yaml соответствует реальному`,
    ``,
    `Примечание: При следующем цикле analyst-agent автоматически проверит`,
    `статус MCP. Если проблема решена — задача будет переведена в «Завершена».`,
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/*  McpTaskModal                                                        */
/* ------------------------------------------------------------------ */

type TaskModalState = {
  open: boolean;
  name: string;
  status: string;
  note: string;
  impactInNumbers: string;
};

const EMPTY_TASK: TaskModalState = { open: false, name: "", status: "", note: "", impactInNumbers: "" };

function McpTaskModal({ state, onClose }: { state: TaskModalState; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  const prompt = buildMcpTaskPrompt(state.name, state.status);

  function handleCopy() {
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={state.open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          Задача: подключить MCP — {state.name}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", top: 12, right: 12 }}
          aria-label="Закрыть"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Stack spacing={1.5}>
          {/* Статус */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">Текущий статус:</Typography>
            <Chip
              size="small"
              label={MCP_STATUS_LABEL[state.status] ?? state.status}
              color={MCP_STATUS_COLOR[state.status] ?? "default"}
              sx={{ fontSize: "0.74rem" }}
            />
          </Stack>

          {/* Описание проблемы */}
          <Box sx={{ bgcolor: "warning.lighter", borderRadius: 2, p: 1.5, border: "1px solid", borderColor: "warning.light" }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Проблема</Typography>
            <Typography variant="body2">{STATUS_PROBLEM[state.status] ?? "Неизвестная проблема с MCP."}</Typography>
          </Box>

          {/* Промпт задачи */}
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>Промпт задачи</Typography>
            <Box
              sx={{
                fontFamily: "monospace",
                fontSize: "0.78rem",
                bgcolor: "action.hover",
                borderRadius: 2,
                p: 1.5,
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                maxHeight: 220,
                overflowY: "auto",
              }}
            >
              {prompt}
            </Box>
            <Button
              size="small"
              variant="outlined"
              startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
              onClick={handleCopy}
              sx={{ mt: 1, textTransform: "none" }}
              color={copied ? "success" : "primary"}
            >
              {copied ? "Скопировано" : "Скопировать промпт"}
            </Button>
          </Box>

          <Divider />

          {/* Авто-закрытие */}
          <Typography variant="caption" color="text.secondary">
            При следующем цикле analyst-agent автоматически проверит статус MCP.
            Если проблема решена — задача будет переведена в статус «Завершена».
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Unified MCP list item                                               */
/* ------------------------------------------------------------------ */

type McpListItem =
  | { kind: "used"; data: AgentUsedMcp; serverStatus: string | undefined }
  | { kind: "available"; data: AgentAvailableMcp; serverStatus: string | undefined };

function getEffectiveStatus(item: McpListItem): string {
  if (item.kind === "used") return item.data.status;
  return item.serverStatus ?? "not_connected";
}

/* ------------------------------------------------------------------ */
/*  McpSection                                                          */
/* ------------------------------------------------------------------ */

export function McpSection({
  agent,
  onOpenFile,
}: {
  agent: AgentSummary;
  onOpenFile: (path: string) => void;
}) {
  const [taskModal, setTaskModal] = React.useState<TaskModalState>(EMPTY_TASK);

  const serverStatusMap = React.useMemo(
    () => new Map(agent.mcpServers.map((s) => [s.name.toLowerCase(), s.status])),
    [agent.mcpServers],
  );

  // Базовый список используемых MCP (fallback на mcpServers)
  const usedList: AgentUsedMcp[] = agent.usedMcp.length > 0
    ? agent.usedMcp
    : agent.mcpServers.map((s) => ({
        name: s.name,
        status: s.status as AgentUsedMcp["status"],
        note: "",
        practicalTasks: [],
        impactInNumbers: "",
        lastUsedAt: null,
      }));

  // Доступные но не используемые
  const availList: AgentAvailableMcp[] = agent.availableMcp.filter(
    (a) => !usedList.some((u) => u.name.toLowerCase() === a.name.toLowerCase()),
  );

  // Объединённый список
  const allItems: McpListItem[] = [
    ...usedList.map((d): McpListItem => ({
      kind: "used",
      data: d,
      serverStatus: serverStatusMap.get(d.name.toLowerCase()),
    })),
    ...availList.map((d): McpListItem => ({
      kind: "available",
      data: d,
      serverStatus: serverStatusMap.get(d.name.toLowerCase()),
    })),
  ];

  // Сортировка: активные вверху
  const sorted = [...allItems].sort((a, b) => {
    const sa = MCP_STATUS_ORDER[getEffectiveStatus(a)] ?? 9;
    const sb = MCP_STATUS_ORDER[getEffectiveStatus(b)] ?? 9;
    return sa - sb;
  });

  return (
    <SectionBlock
      title="MCP которые использует ИИ агент"
      tooltip="Список MCP-серверов с фактическим статусом. Активные сверху. Если MCP не активен — появляется задача на устранение."
    >
      {sorted.length === 0 ? (
        <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>
      ) : (
        <Stack spacing={1.25}>
          {sorted.map((item) => {
            const name = item.kind === "used" ? item.data.name : item.data.name;
            const effectiveStatus = getEffectiveStatus(item);
            const isActive = effectiveStatus === "active" || effectiveStatus === "online";
            const note = item.kind === "used" ? item.data.note : (item.data.description ?? "");
            const impact = item.kind === "used" ? item.data.impactInNumbers : (item.data.expectedEffect ?? "");

            const tooltipContent = (
              <Box sx={{ p: 0.25, maxWidth: 260 }}>
                {note ? <Typography variant="caption" display="block">{note}</Typography> : null}
                {impact ? (
                  <Typography variant="caption" display="block" sx={{ mt: note ? 0.5 : 0, fontWeight: 600 }}>
                    Эффект: {impact}
                  </Typography>
                ) : null}
                {!note && !impact ? (
                  <Typography variant="caption" color="text.secondary">Описание не указано</Typography>
                ) : null}
              </Box>
            );

            return (
              <Box key={name}>
                {/* Строка: название + статус */}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Tooltip title={tooltipContent} arrow placement="top">
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, cursor: "help", textDecoration: "underline dotted", textDecorationColor: "text.disabled" }}
                    >
                      {name}
                    </Typography>
                  </Tooltip>

                  <Tooltip title={STATUS_TOOLTIP_CONTENT} arrow placement="top">
                    <Chip
                      size="small"
                      label={MCP_STATUS_LABEL[effectiveStatus] ?? effectiveStatus}
                      color={MCP_STATUS_COLOR[effectiveStatus] ?? "default"}
                      sx={{ fontSize: "0.74rem", cursor: "help" }}
                    />
                  </Tooltip>
                </Stack>

                {/* Путь к конфигу MCP */}
                <Box sx={{ mt: 0.25 }}>
                  <FilePathLink
                    path={MCP_CONFIG_PATH}
                    label={MCP_CONFIG_PATH}
                    onClick={onOpenFile}
                  />
                </Box>

                {/* Задача на подключение (если не активен) */}
                {!isActive ? (
                  <Link
                    component="button"
                    type="button"
                    variant="caption"
                    underline="hover"
                    onClick={() =>
                      setTaskModal({
                        open: true,
                        name,
                        status: effectiveStatus,
                        note,
                        impactInNumbers: impact,
                      })
                    }
                    sx={{ display: "block", mt: 0.25, color: "warning.dark", cursor: "pointer" }}
                  >
                    ↳ Задача: подключить/восстановить {name}
                  </Link>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      )}

      <McpTaskModal state={taskModal} onClose={() => setTaskModal(EMPTY_TASK)} />
    </SectionBlock>
  );
}
