import React from "react";
import {
  Alert,
  Box,
  CircularProgress,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import { getBpmnManifest } from "../lib/generatedData";

declare global {
  interface Window {
    bpmnvisu?: {
      BpmnVisualization?: new (opts: { container: HTMLElement | string }) => {
        load: (xml: string) => void;
      };
    };
  }
}

const BPMN_SCRIPT_CANDIDATES = [
  "https://cdn.jsdelivr.net/npm/bpmn-visualization@0.47.0/dist/bpmn-visualization.min.js",
  "https://unpkg.com/bpmn-visualization@0.47.0/dist/bpmn-visualization.min.js",
];

function loadScript(src: string): Promise<void> {
  const existing = document.querySelector(`script[data-ops-bpmn-script="${src}"]`) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "true") return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("bpmn_visualization_script_load_error")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.opsBpmnScript = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener("error", () => reject(new Error("bpmn_visualization_script_load_error")), { once: true });
    document.head.appendChild(script);
  });
}

async function loadFirstAvailableScript(candidates: string[]): Promise<void> {
  let lastError: unknown = null;
  for (const src of candidates) {
    try {
      await loadScript(src);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("bpmn_visualization_script_load_error");
}

async function loadBpmnXml(sourcePath: string): Promise<string> {
  const response = await fetch(sourcePath, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`bpmn_xml_load_failed:${response.status}`);
  }
  return response.text();
}

export function BpmnPage() {
  const diagrams = React.useMemo(() => getBpmnManifest(), []);
  const [selectedId, setSelectedId] = React.useState(diagrams[0]?.id || "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const selected = React.useMemo(() => diagrams.find((item) => item.id === selectedId) || null, [diagrams, selectedId]);

  React.useEffect(() => {
    if (!selected || !containerRef.current) return;
    const selectedDiagram = selected;
    let cancelled = false;

    async function renderDiagram() {
      setLoading(true);
      setError(null);
      try {
        const xml = await loadBpmnXml(selectedDiagram.filePath);
        await loadFirstAvailableScript(BPMN_SCRIPT_CANDIDATES);
        if (cancelled || !containerRef.current) return;
        const BpmnVisualization = window.bpmnvisu?.BpmnVisualization;
        if (!BpmnVisualization) throw new Error("bpmn_visualization_not_available");
        const viz = new BpmnVisualization({ container: containerRef.current });
        viz.load(xml);
      } catch (e) {
        if (!cancelled) setError(String((e as any)?.message || e || "bpmn_visualization_error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (diagrams.length === 0) {
    return (
      <Paper variant="outlined">
        <Stack spacing={1.25} sx={{ p: 2.25 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            BPMN
          </Typography>
          <Alert severity="info">No BPMN diagrams indexed. Add files to `docs/bpmn/*.bpmn` and run `make ops-prepare`.</Alert>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined">
      <Stack spacing={1.25} sx={{ p: 2.25 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          BPMN
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Process diagrams from `docs/bpmn/*.bpmn` (file-based source of truth).
        </Typography>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
          <Select
            size="small"
            value={selectedId}
            onChange={(e) => setSelectedId(String(e.target.value))}
            sx={{ minWidth: 320 }}
          >
            {diagrams.map((diagram) => (
              <MenuItem key={diagram.id} value={diagram.id}>
                {diagram.title}
              </MenuItem>
            ))}
          </Select>
          {selected ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ alignSelf: "center" }}>
              <Typography variant="caption" color="text.secondary">
                id: `{selected.id}` | process: `{selected.processName || "n/a"}` | source: `{selected.sourcePath}` |
                updated: {new Date(selected.updatedAt).toLocaleString()}
              </Typography>
              {selected.sourceUrl ? (
                <Link href={selected.sourceUrl} target="_blank" rel="noopener noreferrer" variant="caption">
                  Open source file
                </Link>
              ) : null}
            </Stack>
          ) : null}
        </Stack>

        {loading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading BPMN visualization...
            </Typography>
          </Box>
        ) : null}

        {error ? <Alert severity="error">BPMN render failed: {error}</Alert> : null}

        <Box
          ref={containerRef}
          sx={{
            minHeight: 460,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "auto",
            bgcolor: "background.paper",
          }}
        />
      </Stack>
    </Paper>
  );
}
