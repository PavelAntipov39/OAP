import React from "react";
import ReactMarkdown from "react-markdown";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import TextSnippetOutlinedIcon from "@mui/icons-material/TextSnippetOutlined";
import ViewHeadlineOutlinedIcon from "@mui/icons-material/ViewHeadlineOutlined";
import WrapTextOutlinedIcon from "@mui/icons-material/WrapTextOutlined";

type TextRenderMode = "markdown" | "text";

export type TextContentModalProps = {
  open: boolean;
  title: string;
  content: string;
  path?: string | null;
  updatedAt?: string | null;
  sourceUrl?: string | null;
  onClose: () => void;
  initialMode?: TextRenderMode;
};

function formatDateTime(value?: string | null): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU");
}

export function TextContentModal(props: TextContentModalProps) {
  const { open, title, content, path, updatedAt, sourceUrl, onClose, initialMode = "markdown" } = props;
  const [mode, setMode] = React.useState<TextRenderMode>(initialMode);
  const [wrap, setWrap] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  const contentLength = content.length;
  const largeContent = contentLength > 220_000;
  const effectiveMode = largeContent && mode === "markdown" ? "text" : mode;

  React.useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setWrap(true);
    setCopied(false);
  }, [open, initialMode, title, contentLength]);

  const onCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content || "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }, [content]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: { xs: "calc(100vw - 16px)", sm: "min(1100px, calc(100vw - 48px))" },
          height: { xs: "min(92vh, 820px)", sm: "88vh" },
          borderRadius: 2.5,
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {title || "Текстовый просмотр"}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
              {path ? <Chip size="small" variant="outlined" label={path} /> : null}
              <Chip size="small" variant="outlined" label={`Размер: ${contentLength.toLocaleString("ru-RU")} символов`} />
              <Chip size="small" variant="outlined" label={`Обновлено: ${formatDateTime(updatedAt)}`} />
            </Stack>
          </Box>
          <IconButton size="small" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={0.75}
          alignItems={{ sm: "center" }}
          justifyContent="space-between"
          sx={{
            px: 1.25,
            py: 0.85,
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            onChange={(_, value: TextRenderMode | null) => {
              if (value) setMode(value);
            }}
          >
            <ToggleButton value="markdown">
              <TextSnippetOutlinedIcon fontSize="inherit" />
              <Box component="span" sx={{ ml: 0.5 }}>Разметка</Box>
            </ToggleButton>
            <ToggleButton value="text">
              <ViewHeadlineOutlinedIcon fontSize="inherit" />
              <Box component="span" sx={{ ml: 0.5 }}>Текст</Box>
            </ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              startIcon={<WrapTextOutlinedIcon />}
              onClick={() => setWrap((value) => !value)}
              disabled={effectiveMode !== "text"}
            >
              Перенос: {wrap ? "вкл" : "выкл"}
            </Button>
            <Tooltip title={copied ? "Скопировано" : "Скопировать текст"}>
              <span>
                <Button size="small" variant="outlined" startIcon={<ContentCopyOutlinedIcon />} onClick={onCopy}>
                  Копировать
                </Button>
              </span>
            </Tooltip>
            {sourceUrl ? (
              <Button size="small" variant="outlined" component={Link} href={sourceUrl} target="_blank" rel="noopener noreferrer">
                Открыть source
              </Button>
            ) : null}
          </Stack>
        </Stack>

        {largeContent ? (
          <Alert severity="info" sx={{ borderRadius: 0 }}>
            Файл большой. Для стабильной работы включен упрощенный режим рендера.
          </Alert>
        ) : null}

        <Box sx={{ p: 1.25, overflow: "auto", minHeight: 0, flex: 1 }}>
          {effectiveMode === "markdown" ? (
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <Typography variant="h5" sx={{ mt: 1.25, mb: 0.75, fontWeight: 700 }}>
                    {children}
                  </Typography>
                ),
                h2: ({ children }) => (
                  <Typography variant="h6" sx={{ mt: 1.2, mb: 0.7, fontWeight: 700 }}>
                    {children}
                  </Typography>
                ),
                h3: ({ children }) => (
                  <Typography variant="subtitle1" sx={{ mt: 1, mb: 0.45, fontWeight: 700 }}>
                    {children}
                  </Typography>
                ),
                p: ({ children }) => (
                  <Typography variant="body2" sx={{ mb: 1.1, lineHeight: 1.7 }}>
                    {children}
                  </Typography>
                ),
                li: ({ children }) => (
                  <li>
                    <Typography variant="body2" component="span" sx={{ lineHeight: 1.65 }}>
                      {children}
                    </Typography>
                  </li>
                ),
                code: ({ children }) => (
                  <Box
                    component="code"
                    sx={{
                      px: 0.45,
                      py: 0.1,
                      borderRadius: 0.5,
                      bgcolor: "rgba(27,95,168,0.1)",
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
                      mb: 1.1,
                      p: 1.1,
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "#0f172a",
                      color: "#dbeafe",
                      overflowX: "auto",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: "0.83rem",
                      lineHeight: 1.6,
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
              {content || ""}
            </ReactMarkdown>
          ) : (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "#0b1220",
                color: "#d6e2f5",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: "0.84rem",
                lineHeight: 1.55,
                whiteSpace: wrap ? "pre-wrap" : "pre",
                overflowX: "auto",
              }}
            >
              {content || "Нет данных для отображения."}
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
