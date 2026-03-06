import React from "react";
import {
  Alert,
  Box,
  Button,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import { getC4Manifest } from "../lib/generatedData";

export function ArchitecturePage() {
  const manifest = React.useMemo(() => getC4Manifest(), []);

  return (
    <Paper variant="outlined">
      <Stack spacing={1.25} sx={{ p: 2.25 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Architecture
        </Typography>
        <Typography variant="body2" color="text.secondary">
          C4 views (required 4) from generated `c4-manifest.json`.
        </Typography>

        {manifest.exportError ? (
          <Alert severity="warning">
            PNG export unavailable. Fallback to DSL + external links is active.
            <br />
            {manifest.exportError}
          </Alert>
        ) : null}

        <Stack spacing={1.25}>
          {manifest.views.map((view) => (
            <Paper key={view.id} variant="outlined" sx={{ p: 1.25 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {view.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {view.description}
                </Typography>
                {view.pngAvailable ? (
                  <Box
                    component="img"
                    src={view.pngPath}
                    alt={view.title}
                    sx={{
                      width: "100%",
                      maxHeight: 420,
                      objectFit: "contain",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      bgcolor: "background.paper",
                    }}
                  />
                ) : (
                  <Alert severity="info">
                    Local PNG preview not available for `{view.id}`. Use DSL or open playground view.
                  </Alert>
                )}
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    component={Link}
                    href={view.playgroundUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in LikeC4 Playground
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
          Raw DSL
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.25,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "#f9fafc",
            maxHeight: 360,
            overflow: "auto",
            fontSize: 12,
            lineHeight: 1.45,
            whiteSpace: "pre",
          }}
        >
          {manifest.dsl}
        </Box>
      </Stack>
    </Paper>
  );
}
