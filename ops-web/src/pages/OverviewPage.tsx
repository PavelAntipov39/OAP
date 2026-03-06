import React from "react";
import { Alert, Paper, Stack, Typography } from "@mui/material";

import { getBpmnManifest, getC4Manifest, getDocsIndex, getSearchIndex } from "../lib/generatedData";

export function OverviewPage() {
  const c4 = React.useMemo(() => getC4Manifest(), []);
  const bpmn = React.useMemo(() => getBpmnManifest(), []);
  const docs = React.useMemo(() => getDocsIndex(), []);
  const search = React.useMemo(() => getSearchIndex(), []);

  const cards = [
    { label: "C4 Views", value: c4.views.length.toString() },
    { label: "BPMN Diagrams", value: bpmn.length.toString() },
    { label: "Docs Indexed", value: docs.length.toString() },
    { label: "C4 Validated", value: c4.validatedAt ? new Date(c4.validatedAt).toLocaleString() : "unknown" },
    { label: "Search Index", value: search.updatedAt ? new Date(search.updatedAt).toLocaleString() : "unknown" },
  ];

  return (
    <Paper variant="outlined">
      <Stack spacing={1.25} sx={{ p: 2.25 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Overview
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Hub status по архитектуре, BPMN и документации на основе generated manifests.
        </Typography>

        {c4.exportError ? <Alert severity="warning">C4 PNG export fallback mode: {c4.exportError}</Alert> : null}

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
          {cards.map((card) => (
            <Paper key={card.label} variant="outlined" sx={{ p: 1.25, minWidth: 220 }}>
              <Typography variant="caption" color="text.secondary">
                {card.label}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.25 }}>
                {card.value}
              </Typography>
            </Paper>
          ))}
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Source indexes: `ops-web/src/generated/*.json`
        </Typography>
      </Stack>
    </Paper>
  );
}
