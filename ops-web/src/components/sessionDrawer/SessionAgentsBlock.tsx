import React from "react";
import { Box, Paper, Stack, Tooltip, Typography, Chip } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { AnalystSession } from "../../lib/analystCardData";

export function SessionAgentsBlock({ session }: { session: AnalystSession }) {
  // Extract agent names from actionLog tool types
  const extractedAgents = new Set<string>();
  const agentCreatedNew = new Set<string>();

  // Parse action log for agent information
  session.actionLog.forEach((action) => {
    if (action.tool === "Agent") {
      const agentNameMatch = action.title.match(/Agent:\s*(\w+-agent)/);
      if (agentNameMatch) {
        extractedAgents.add(agentNameMatch[1]);
      }
    }
  });

  // Also check fileLog for references
  session.fileLog.forEach((entry) => {
    if (entry.context.includes("agent") || entry.context.includes("агент")) {
      // Try to extract agent names
      const matches = entry.context.match(/(\w+-agent)/g);
      if (matches) {
        matches.forEach((agentName) => extractedAgents.add(agentName));
      }
    }
  });

  const agents = Array.from(extractedAgents).sort();
  const hasAgents = agents.length > 0;

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
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Список задействованных агентов во время цикл сессии:
          </Typography>
          <Tooltip title="Агенты, которые использовались в этой сессии">
            <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
          </Tooltip>
        </Stack>

        {!hasAgents ? (
          <Typography variant="body2" color="text.secondary">
            Данные об агентах недоступны в этой сессии
          </Typography>
        ) : (
          <Stack spacing={1}>
            {agents.map((agent) => (
              <Box key={agent}>
                <Chip
                  label={agent}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontWeight: 500,
                  }}
                />
              </Box>
            ))}
          </Stack>
        )}

        {agentCreatedNew.size > 0 && (
          <Box sx={{ mt: 1, p: 1, backgroundColor: "info.lighter", borderRadius: "4px" }}>
            <Typography variant="caption" color="info.main">
              ℹ️ Новые агенты: {Array.from(agentCreatedNew).join(", ")}
            </Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
