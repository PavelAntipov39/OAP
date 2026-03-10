import React from "react";
import {
  Alert,
  Box,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

import {
  getCapabilityGlossaryMeta,
  getCapabilityTypeGlossaryList,
  getCapabilitySystemTermGlossaryList,
  type CapabilitySystemTermEntry,
  type CapabilityTypeGlossaryEntry,
} from "../lib/capabilityGlossary";

type GlossaryEntry =
  | ({ kind: "type" } & CapabilityTypeGlossaryEntry)
  | ({ kind: "term" } & CapabilitySystemTermEntry);

function normalizeText(value: string): string {
  return String(value || "").toLowerCase().trim();
}

function glossaryEntryMatches(entry: GlossaryEntry, query: string) {
  const normalized = normalizeText(query);
  if (!normalized) return true;
  const haystack = normalizeText([
    entry.label,
    entry.tooltip || "",
    entry.what,
    entry.why,
    entry.howInTable,
    entry.where,
  ].join("\n"));
  return normalized.split(/\s+/).every((term) => haystack.includes(term));
}

function readGlossaryState() {
  const rawHash = String(window.location.hash || "");
  const queryIndex = rawHash.indexOf("?");
  const params = new URLSearchParams(queryIndex >= 0 ? rawHash.slice(queryIndex + 1) : "");
  return {
    search: String(params.get("search") || "").trim(),
    term: String(params.get("term") || "").trim(),
  };
}

function writeGlossaryState(search: string, term: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (term.trim()) params.set("term", term.trim());
  const query = params.toString();
  const nextHash = query ? `#/glossary?${query}` : "#/glossary";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function capabilityTypeColor(type: CapabilityTypeGlossaryEntry["type"]): "default" | "primary" | "success" | "warning" {
  if (type === "tool") return "warning";
  if (type === "skill") return "success";
  if (type === "mcp") return "primary";
  return "default";
}

function entryAnchorId(entry: GlossaryEntry): string {
  return entry.id;
}

export function GlossaryPage() {
  const initialState = React.useMemo(() => readGlossaryState(), []);
  const [query, setQuery] = React.useState(initialState.search);
  const [selectedId, setSelectedId] = React.useState(initialState.term);

  const meta = React.useMemo(() => getCapabilityGlossaryMeta(), []);
  const typeEntries = React.useMemo(() => getCapabilityTypeGlossaryList().map((entry) => ({ ...entry, kind: "type" as const })), []);
  const systemTermEntries = React.useMemo(() => getCapabilitySystemTermGlossaryList().map((entry) => ({ ...entry, kind: "term" as const })), []);

  const entries = React.useMemo(() => [...typeEntries, ...systemTermEntries], [systemTermEntries, typeEntries]);

  const filteredEntries = React.useMemo(
    () => entries.filter((entry) => glossaryEntryMatches(entry, query)),
    [entries, query],
  );

  const filteredTypeEntries = React.useMemo(
    () => filteredEntries.filter((entry): entry is { kind: "type" } & CapabilityTypeGlossaryEntry => entry.kind === "type"),
    [filteredEntries],
  );

  const filteredSystemTermEntries = React.useMemo(
    () => filteredEntries.filter((entry): entry is { kind: "term" } & CapabilitySystemTermEntry => entry.kind === "term"),
    [filteredEntries],
  );

  const selectedEntry = React.useMemo(() => {
    if (selectedId) {
      return filteredEntries.find((entry) => entry.id === selectedId) || null;
    }
    return filteredEntries[0] || null;
  }, [filteredEntries, selectedId]);

  React.useEffect(() => {
    if (!selectedEntry && filteredEntries.length > 0) {
      setSelectedId(filteredEntries[0].id);
      return;
    }
    if (selectedEntry && selectedId !== selectedEntry.id) {
      setSelectedId(selectedEntry.id);
    }
  }, [filteredEntries, selectedEntry, selectedId]);

  React.useEffect(() => {
    writeGlossaryState(query, selectedId);
  }, [query, selectedId]);

  React.useEffect(() => {
    const onHashChange = () => {
      const nextState = readGlossaryState();
      setQuery(nextState.search);
      setSelectedId(nextState.term);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <Paper variant="outlined">
      <Stack spacing={1.5} sx={{ p: 2.25, minHeight: 640 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Словарь терминов ОАП
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Единая точка, где простым языком объясняются ключевые понятия системы ОАП.
        </Typography>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} sx={{ flex: 1, minHeight: 0 }}>
          <Paper variant="outlined" sx={{ width: { xs: "100%", lg: 380 }, display: "flex", flexDirection: "column" }}>
            <Box sx={{ p: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
              <TextField
                size="small"
                fullWidth
                label="Поиск по терминам"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Например: lesson, candidate, telemetry"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Элементов: {filteredEntries.length}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Источник: {meta.path || "не зафиксировано"}
              </Typography>
            </Box>

            <Box sx={{ overflowY: "auto", minHeight: 0, maxHeight: { xs: 300, lg: 560 } }}>
              {filteredEntries.length === 0 ? (
                <Alert severity="info" sx={{ m: 1 }}>
                  По этому запросу терминов не найдено.
                </Alert>
              ) : (
                <Stack spacing={0.75} sx={{ p: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ px: 0.25, pt: 0.25 }}>
                    Типы capability ({filteredTypeEntries.length})
                  </Typography>
                  {filteredTypeEntries.map((entry) => {
                    const active = selectedEntry?.id === entry.id;
                    return (
                      <Paper
                        key={entry.id}
                        variant="outlined"
                        onClick={() => setSelectedId(entry.id)}
                        sx={{
                          p: 1,
                          cursor: "pointer",
                          borderColor: active ? "primary.main" : "divider",
                          backgroundColor: active ? "rgba(27,95,168,0.05)" : "background.paper",
                        }}
                      >
                        <Stack spacing={0.65}>
                          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                            <Chip size="small" label={entry.label} color={capabilityTypeColor(entry.type)} variant="outlined" />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {entry.label}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {entry.what}
                          </Typography>
                        </Stack>
                      </Paper>
                    );
                  })}

                  <Typography variant="caption" color="text.secondary" sx={{ px: 0.25, pt: 0.75 }}>
                    Термины системы ({filteredSystemTermEntries.length})
                  </Typography>
                  {filteredSystemTermEntries.map((entry) => {
                    const active = selectedEntry?.id === entry.id;
                    return (
                      <Paper
                        key={entry.id}
                        variant="outlined"
                        onClick={() => setSelectedId(entry.id)}
                        sx={{
                          p: 1,
                          cursor: "pointer",
                          borderColor: active ? "primary.main" : "divider",
                          backgroundColor: active ? "rgba(27,95,168,0.05)" : "background.paper",
                        }}
                      >
                        <Stack spacing={0.65}>
                          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
                            <Chip size="small" label="Термин" variant="outlined" />
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {entry.label}
                            </Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {entry.what}
                          </Typography>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {!selectedEntry ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="info">Выберите термин слева.</Alert>
              </Box>
            ) : (
              <Stack spacing={1.5} sx={{ p: 2, minHeight: 0, overflow: "auto" }}>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  {selectedEntry.kind === "type" ? (
                    <Chip size="small" label={selectedEntry.label} color={capabilityTypeColor(selectedEntry.type)} variant="outlined" />
                  ) : (
                    <Chip size="small" label="Термин системы" color="primary" variant="outlined" />
                  )}
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {selectedEntry.label}
                  </Typography>
                </Stack>

                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Что это
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedEntry.what}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Где применяется
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedEntry.where}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Зачем это нужно
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedEntry.why}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Как это читать в общей таблице
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedEntry.howInTable}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 1.25 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    Source of truth
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", wordBreak: "break-word" }}>
                    {(meta.path || "docs/subservices/oap/CAPABILITY_GLOSSARY.json") + `#${entryAnchorId(selectedEntry)}`}
                  </Typography>
                </Paper>
              </Stack>
            )}
          </Paper>
        </Stack>
      </Stack>
    </Paper>
  );
}