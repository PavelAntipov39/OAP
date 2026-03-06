import React from "react";
import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Link,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import type { AgentSummary } from "../../lib/generatedData";

const STATUS_LABEL: Record<AgentSummary["status"], string> = {
  healthy: "Стабильно",
  degraded: "Деградация",
  offline: "Оффлайн",
};

const STATUS_COLOR: Record<AgentSummary["status"], "success" | "warning" | "default"> = {
  healthy: "success",
  degraded: "warning",
  offline: "default",
};

function formatDateTime(value: string | null): string {
  if (!value) return "не зафиксировано";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "не зафиксировано";
  return ts.toLocaleString();
}

export function AgentDetailsDrawer({
  open,
  agent,
  onClose,
}: {
  open: boolean;
  agent: AgentSummary | null;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState(0);

  React.useEffect(() => {
    if (!open) setTab(0);
  }, [open]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      disableEnforceFocus
      PaperProps={{ sx: { width: { xs: "100vw", md: 760 }, maxWidth: "100vw", bgcolor: "background.default" } }}
    >
      <Box sx={{ pt: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2.25, pb: 1.2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {agent?.name || "Агент"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {agent?.role || "не зафиксировано"}
            </Typography>
            {agent ? <Chip size="small" color={STATUS_COLOR[agent.status]} label={STATUS_LABEL[agent.status]} sx={{ mt: 0.7 }} /> : null}
          </Box>
          <IconButton onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Divider />

        <Tabs value={tab} onChange={(_, next) => setTab(next)} variant="scrollable" scrollButtons="auto" sx={{ px: 1 }}>
          <Tab label="Обзор" />
          <Tab label="Навыки" />
          <Tab label="MCP" />
          <Tab label="Контекст" />
          <Tab label="Улучшения" />
        </Tabs>

        <Stack spacing={1.25} sx={{ p: 2.25 }}>
          {!agent ? (
            <Typography variant="body2" color="text.secondary">
              Данные агента не найдены.
            </Typography>
          ) : null}

          {agent && tab === 0 ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Stack spacing={0.65}>
                <Typography variant="body2">
                  <strong>ID:</strong> {agent.id}
                </Typography>
                <Typography variant="body2">
                  <strong>Описание:</strong> {agent.notes || "не зафиксировано"}
                </Typography>
                <Typography variant="body2">
                  <strong>Источник:</strong> {agent.source}
                </Typography>
                <Typography variant="body2">
                  <strong>Обновлено:</strong> {formatDateTime(agent.updatedAt)}
                </Typography>
                <Typography variant="body2">
                  <strong>Задачи:</strong> в работе {agent.tasks.in_work}, на контроле {agent.tasks.on_control}, просрочено {agent.tasks.overdue}
                </Typography>
              </Stack>
            </Paper>
          ) : null}

          {agent && tab === 1 ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Навыки
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  {agent.skills.length === 0 ? <Typography variant="body2">не зафиксировано</Typography> : null}
                  {agent.skills.map((item) => (
                    <Chip key={item} size="small" variant="outlined" label={item} />
                  ))}
                </Stack>
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Используемые навыки
                </Typography>
                {agent.usedSkills.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    не зафиксировано
                  </Typography>
                ) : (
                  agent.usedSkills.map((item) => (
                    <Box key={item.name}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.usage || item.fullText || "не зафиксировано"}
                      </Typography>
                    </Box>
                  ))
                )}
              </Stack>
            </Paper>
          ) : null}

          {agent && tab === 2 ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  MCP серверы
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  {agent.mcpServers.map((server) => (
                    <Chip key={server.name} size="small" label={`${server.name}: ${server.status}`} />
                  ))}
                </Stack>
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Фактическое использование MCP
                </Typography>
                {agent.usedMcp.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    не зафиксировано
                  </Typography>
                ) : (
                  agent.usedMcp.map((item) => (
                    <Box key={item.name}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.note}
                      </Typography>
                    </Box>
                  ))
                )}
              </Stack>
            </Paper>
          ) : null}

          {agent && tab === 3 ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Контекст и ссылки
                </Typography>
                {agent.contextRefs.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    не зафиксировано
                  </Typography>
                ) : (
                  agent.contextRefs.map((item) => (
                    <Box key={`${item.filePath}-${item.title}`}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {item.filePath}
                      </Typography>
                      {item.sourceUrl ? (
                        <Link href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Источник
                        </Link>
                      ) : null}
                    </Box>
                  ))
                )}
              </Stack>
            </Paper>
          ) : null}

          {agent && tab === 4 ? (
            <Paper variant="outlined" sx={{ p: 1.25 }}>
              <Stack spacing={0.75}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Рекомендации аналитика
                </Typography>
                {agent.analystRecommendations.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    не зафиксировано
                  </Typography>
                ) : (
                  agent.analystRecommendations.map((item, index) => (
                    <Typography key={`${agent.id}-rec-${index}`} variant="body2">
                      {index + 1}. {item}
                    </Typography>
                  ))
                )}
                <Divider />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Улучшения
                </Typography>
                {agent.improvements.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    не зафиксировано
                  </Typography>
                ) : (
                  agent.improvements.map((item) => (
                    <Box key={`${agent.id}-imp-${item.title}`}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div">
                        Проблема: {item.problem}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div">
                        Решение: {item.solution}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" component="div">
                        Эффект: {item.effect}
                      </Typography>
                    </Box>
                  ))
                )}
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      </Box>
    </Drawer>
  );
}
