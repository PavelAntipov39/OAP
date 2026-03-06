import React from "react";
import { Paper, Stack, Tooltip, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

export function SectionBlock({
  title,
  tooltip,
  children,
}: {
  title: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: "8px",
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: "0 2px 12px rgba(0,0,0,0.06)" },
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.95rem", letterSpacing: -0.1 }}>
            {title}
          </Typography>
          <Tooltip title={tooltip} arrow placement="top">
            <InfoOutlinedIcon sx={{ fontSize: 16, color: "text.secondary", cursor: "help" }} />
          </Tooltip>
        </Stack>
        {children}
      </Stack>
    </Paper>
  );
}
