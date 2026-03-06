import React from "react";
import ReactMarkdown from "react-markdown";
import {
  Alert,
  Box,
  Button,
  Link,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { getOapKbIndex, getOapKbRawLogs, getOapKbSearchIndex, type OapKbDocument } from "../lib/generatedData";
import { TextContentModal } from "../components/TextContentModal";

type DocsGroup = "service" | "policies" | "registry_contracts" | "telemetry_reports" | "raw_logs";
const GROUP_ORDER: DocsGroup[] = ["service", "policies", "registry_contracts", "telemetry_reports", "raw_logs"];

const GROUP_TITLES: Record<DocsGroup, string> = {
  service: "Контур сервиса",
  policies: "Правила и политики",
  registry_contracts: "Реестр и контракты",
  telemetry_reports: "Телеметрия и отчеты",
  raw_logs: "Сырые логи (on-demand)",
};

function makeSourceUrl(path: string): string | null {
  const base = String(import.meta.env.VITE_REPO_BROWSE_BASE_URL || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/${path}`;
}

function containsAllTerms(haystack: string, terms: string[]) {
  return terms.every((term) => haystack.includes(term));
}

export function DocsPage() {
  const baseDocs = React.useMemo(() => getOapKbIndex(), []);
  const rawLogsDocs = React.useMemo(() => getOapKbRawLogs(), []);
  const searchIndex = React.useMemo(() => getOapKbSearchIndex(), []);
  const [query, setQuery] = React.useState("");
  const [rawLogsVisible, setRawLogsVisible] = React.useState(false);
  const docs = React.useMemo(() => (rawLogsVisible ? [...baseDocs, ...rawLogsDocs] : baseDocs), [baseDocs, rawLogsDocs, rawLogsVisible]);
  const [selectedId, setSelectedId] = React.useState(docs[0]?.id || "");
  const [textModalOpen, setTextModalOpen] = React.useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const matchedIds = React.useMemo(() => {
    if (!normalizedQuery) {
      return new Set(docs.map((doc) => doc.id));
    }
    const terms = normalizedQuery.split(/\s+/).filter(Boolean);
    const baseMatches = searchIndex.documents
      .filter((doc) => containsAllTerms(doc.searchText, terms))
      .map((doc) => doc.id);
    const rawLogMatches = rawLogsVisible
      ? rawLogsDocs
        .filter((doc) => containsAllTerms(`${doc.title}\n${doc.path}\n${doc.content}`.toLowerCase(), terms))
        .map((doc) => doc.id)
      : [];
    return new Set(
      [...baseMatches, ...rawLogMatches]
        .filter(Boolean),
    );
  }, [docs, normalizedQuery, rawLogsDocs, rawLogsVisible, searchIndex.documents]);

  const filteredDocs = React.useMemo(() => docs.filter((doc) => matchedIds.has(doc.id)), [docs, matchedIds]);

  React.useEffect(() => {
    if (!filteredDocs.some((doc) => doc.id === selectedId)) {
      setSelectedId(filteredDocs[0]?.id || "");
    }
  }, [filteredDocs, selectedId]);

  const groups = React.useMemo(() => {
    const grouped: Record<DocsGroup, OapKbDocument[]> = {
      service: [],
      policies: [],
      registry_contracts: [],
      telemetry_reports: [],
      raw_logs: [],
    };

    for (const doc of filteredDocs) {
      if (doc.section === "service"
        || doc.section === "policies"
        || doc.section === "registry_contracts"
        || doc.section === "telemetry_reports"
        || doc.section === "raw_logs") {
        grouped[doc.section].push(doc);
      }
    }

    return grouped;
  }, [filteredDocs]);

  const selectedDoc = React.useMemo(() => filteredDocs.find((doc) => doc.id === selectedId) || null, [filteredDocs, selectedId]);
  const rawLogsCount = rawLogsDocs.length;

  return (
    <Paper variant="outlined">
      <Stack spacing={1.25} sx={{ p: 2.25, minHeight: 640 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          База знаний ОАП
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Полнотекстовый поиск и просмотр операционного контекста ОАП для агентов, улучшающих процессы и логику панели.
        </Typography>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} sx={{ flex: 1, minHeight: 0 }}>
          <Paper variant="outlined" sx={{ width: { xs: "100%", lg: 380 }, display: "flex", flexDirection: "column" }}>
            <Box sx={{ p: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
              <TextField
                size="small"
                fullWidth
                label="Поиск по базе знаний ОАП"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Например: recommendation_action_rate"
              />
              <Typography variant="caption" color="text.secondary">
                Results: {filteredDocs.length}
              </Typography>
              <br />
              <Typography variant="caption" color="text.secondary">
                Index updated: {searchIndex.updatedAt ? new Date(searchIndex.updatedAt).toLocaleString() : "unknown"}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setRawLogsVisible((value) => !value)}
                  disabled={rawLogsCount === 0}
                >
                  {rawLogsVisible ? "Скрыть сырые логи" : `Загрузить сырые логи (${rawLogsCount})`}
                </Button>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {rawLogsVisible
                  ? "Сырые логи подключены в список документов."
                  : "Сырые логи исключены из поиска и списка до явного запроса."}
              </Typography>
            </Box>

            <Box sx={{ overflowY: "auto", minHeight: 0, maxHeight: { xs: 260, lg: 560 } }}>
              {filteredDocs.length === 0 ? (
                <Alert severity="info" sx={{ m: 1 }}>
                  Ничего не найдено.
                </Alert>
              ) : (
                <List dense disablePadding>
                  {GROUP_ORDER.map((groupKey) => {
                    const groupDocs = groups[groupKey];
                    if (groupDocs.length === 0) return null;
                    return (
                      <Box key={groupKey}>
                        <ListSubheader>{GROUP_TITLES[groupKey]}</ListSubheader>
                        {groupDocs.map((doc) => (
                          <ListItemButton
                            key={doc.id}
                            selected={doc.id === selectedId}
                            onClick={() => setSelectedId(doc.id)}
                          >
                            <ListItemText
                              primary={doc.title}
                              secondary={doc.path}
                              primaryTypographyProps={{ noWrap: true }}
                              secondaryTypographyProps={{ noWrap: true }}
                            />
                          </ListItemButton>
                        ))}
                      </Box>
                    );
                  })}
                </List>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {!selectedDoc ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="info">Выберите документ слева.</Alert>
              </Box>
            ) : (
              <>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1}
                  sx={{ p: 1.25, borderBottom: "1px solid", borderColor: "divider" }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {selectedDoc.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedDoc.path}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                    <Button size="small" variant="outlined" onClick={() => setTextModalOpen(true)}>
                      Открыть в модалке
                    </Button>
                    {selectedDoc.sourceUrl || makeSourceUrl(selectedDoc.path) ? (
                      <Button
                        size="small"
                        variant="outlined"
                        component={Link}
                        href={selectedDoc.sourceUrl || makeSourceUrl(selectedDoc.path) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Открыть source-файл
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        Set `VITE_REPO_BROWSE_BASE_URL` for source links
                      </Typography>
                    )}
                  </Stack>
                </Stack>
                <Box sx={{ p: 1.25, overflowY: "auto", minHeight: 0, maxHeight: { xs: 420, lg: 560 } }}>
                  <Typography variant="caption" color="text.secondary">
                    Updated: {new Date(selectedDoc.updatedAt).toLocaleString()}
                  </Typography>
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <Typography variant="h5" sx={{ mt: 1.5, mb: 1, fontWeight: 700 }}>
                          {children}
                        </Typography>
                      ),
                      h2: ({ children }) => (
                        <Typography variant="h6" sx={{ mt: 1.25, mb: 0.75, fontWeight: 700 }}>
                          {children}
                        </Typography>
                      ),
                      h3: ({ children }) => (
                        <Typography variant="subtitle1" sx={{ mt: 1.25, mb: 0.5, fontWeight: 700 }}>
                          {children}
                        </Typography>
                      ),
                      p: ({ children }) => (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {children}
                        </Typography>
                      ),
                      li: ({ children }) => (
                        <li>
                          <Typography variant="body2" component="span">
                            {children}
                          </Typography>
                        </li>
                      ),
                      code: ({ children }) => (
                        <Box
                          component="code"
                          sx={{
                            px: 0.5,
                            py: 0.125,
                            bgcolor: "#eff2f6",
                            borderRadius: 0.5,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontSize: "0.82rem",
                          }}
                        >
                          {children}
                        </Box>
                      ),
                      pre: ({ children }) => (
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            mb: 1,
                            p: 1,
                            bgcolor: "#f7f9fc",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 1,
                            overflowX: "auto",
                          }}
                        >
                          {children}
                        </Box>
                      ),
                      a: ({ href, children }) => (
                        <Link href={href || "#"} target="_blank" rel="noopener noreferrer">
                          {children}
                        </Link>
                      ),
                    }}
                  >
                    {selectedDoc.content}
                  </ReactMarkdown>
                </Box>
              </>
            )}
          </Paper>
        </Stack>
      </Stack>

      <TextContentModal
        open={Boolean(selectedDoc) && textModalOpen}
        onClose={() => setTextModalOpen(false)}
        title={selectedDoc?.title || "Документ"}
        content={selectedDoc?.content || ""}
        path={selectedDoc?.path || null}
        updatedAt={selectedDoc?.updatedAt || null}
        sourceUrl={selectedDoc?.sourceUrl || makeSourceUrl(selectedDoc?.path || "")}
        initialMode={selectedDoc?.path?.endsWith(".jsonl") ? "text" : "markdown"}
      />
    </Paper>
  );
}
