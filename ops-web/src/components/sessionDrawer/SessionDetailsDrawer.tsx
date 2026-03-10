import React from "react";
import { Drawer, IconButton, Stack, Typography, Box } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import type { AnalystSession } from "../../lib/analystCardData";
import { SessionFileLogModal } from "../analyst-card/modals/SessionFileLogModal";
import { SessionActionLogModal } from "../analyst-card/modals/SessionActionLogModal";
import { TextContentModal } from "../TextContentModal";
import { SessionHeaderMetrics } from "./SessionHeaderMetrics";
import { SessionTasksBlock } from "./SessionTasksBlock";
import { SessionAgentsBlock } from "./SessionAgentsBlock";
import { SessionWorkingLoopBlock } from "./SessionWorkingLoopBlock";
import { SessionMemoryBlock } from "./SessionMemoryBlock";
import { SessionFlowSchemaModal } from "./SessionFlowSchemaModal";

type ModalState = {
  open: boolean;
  title: string;
  content: string;
  path: string | null;
  updatedAt: string | null;
};

const EMPTY_MODAL: ModalState = { open: false, title: "", content: "", path: null, updatedAt: null };

export type ResolvedDoc = {
  title: string;
  content: string;
  path: string;
  updatedAt: string | null;
};

export function SessionDetailsDrawer({
  open,
  session,
  onClose,
  onResolveFile,
  cycleTaskCount,
}: {
  open: boolean;
  session: AnalystSession | null;
  onClose: () => void;
  onResolveFile?: (path: string) => ResolvedDoc | null;
  cycleTaskCount?: number | null;
}) {
  const [fileLogModal, setFileLogModal] = React.useState<AnalystSession | null>(null);
  const [actionLogModal, setActionLogModal] = React.useState<AnalystSession | null>(null);
  const [flowSchemaOpen, setFlowSchemaOpen] = React.useState(false);
  const [textModal, setTextModal] = React.useState<ModalState>(EMPTY_MODAL);

  if (!session) return null;

  const handleOpenFile = (path: string) => {
    const resolved = onResolveFile?.(path) ?? null;
    if (resolved) {
      setTextModal({
        open: true,
        title: resolved.title,
        content: resolved.content,
        path: resolved.path,
        updatedAt: resolved.updatedAt,
      });
      return;
    }
    setTextModal({
      open: true,
      title: path.split("/").pop() ?? path,
      content: `Содержимое файла \`${path}\` не найдено в индексе документов.`,
      path,
      updatedAt: null,
    });
  };

  return (
    <>
      <Drawer
        anchor="right"
        open={open && !!session}
        onClose={onClose}
        PaperProps={{
          sx: {
            width: 760,
            backgroundColor: "#f6f8fc",
          },
        }}
      >
        {/* Header with close button */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Детали сессии
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              color: "text.secondary",
              "&:hover": { backgroundColor: "action.hover" },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Scrollable content */}
        <Stack
          spacing={2}
          sx={{
            p: 2,
            overflowY: "auto",
            flex: 1,
          }}
        >
          {/* 1. Header metrics */}
          <SessionHeaderMetrics session={session} />

          {/* 2. Tasks block */}
          <SessionTasksBlock session={session} cycleTaskCount={cycleTaskCount} onOpenFile={handleOpenFile} />

          {/* 3. Agents block */}
          <SessionAgentsBlock session={session} />

          {/* 4. Working loop block */}
          <SessionWorkingLoopBlock session={session} onOpenFile={handleOpenFile} />

          {/* 5. Memory block */}
          <SessionMemoryBlock
            session={session}
            onOpenFile={handleOpenFile}
            lessonsContent={onResolveFile?.("docs/subservices/oap/tasks/lessons/analyst-agent.md")?.content ?? undefined}
          />

          {/* Bottom buttons */}
          <Stack direction="row" spacing={1} sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <button
              onClick={() => setFlowSchemaOpen(true)}
              style={{
                flex: 1,
                padding: "8px 16px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Схема работы агента последней сессии
            </button>
            <button
              onClick={() => setActionLogModal(session)}
              style={{
                flex: 1,
                padding: "8px 16px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Журнал действий агента во время цикла сессии
            </button>
            <button
              onClick={() => setFileLogModal(session)}
              style={{
                flex: 1,
                padding: "8px 16px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                backgroundColor: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              Лог по файлам
            </button>
          </Stack>
        </Stack>
      </Drawer>

      {/* Nested modals */}
      {fileLogModal && (
        <SessionFileLogModal
          entries={fileLogModal.fileLog}
          open={!!fileLogModal}
          onClose={() => setFileLogModal(null)}
        />
      )}

      {actionLogModal && (
        <SessionActionLogModal
          actions={actionLogModal.actionLog}
          open={!!actionLogModal}
          onClose={() => setActionLogModal(null)}
        />
      )}

      <SessionFlowSchemaModal
        open={flowSchemaOpen}
        onClose={() => setFlowSchemaOpen(false)}
        flowSchema={session.flowSchema}
        onOpenFile={handleOpenFile}
      />

      {textModal.open && (
        <TextContentModal
          open={textModal.open}
          title={textModal.title}
          content={textModal.content}
          path={textModal.path}
          onClose={() => setTextModal(EMPTY_MODAL)}
        />
      )}
    </>
  );
}
