import React, { useState } from "react";
import {
  Box,
  Chip,
  Popover,
  Paper,
  Stack,
  Typography,
  Link,
} from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  getToolMcpMetadata,
  formatPracticalTasks,
  type ToolMcpMetadata,
} from "../../lib/toolsMcpRegistry";

interface SkillToolMcpTooltipProps {
  name: string;
  label?: string;
  variant?: "outlined" | "filled";
  size?: "small" | "medium";
  onOpenFile?: (path: string) => void;
  status?: string; // For MCP status badge
  metadataOverride?: ToolMcpMetadata | null;
  chipColorOverride?: ChipProps["color"];
}

/**
 * Reusable component for displaying Chip with Material 3 Popover tooltip
 * Shows description, practical tasks, and file path when hovered/clicked
 * Used for: Tools, MCP Integrations, Skills in SessionWorkingLoopBlock and elsewhere
 */
export function SkillToolMcpTooltip({
  name,
  label,
  variant = "outlined",
  size = "small",
  onOpenFile,
  status,
  metadataOverride,
  chipColorOverride,
}: SkillToolMcpTooltipProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const metadata = metadataOverride || getToolMcpMetadata(name);

  const handleChipClick = (event: React.MouseEvent<HTMLElement>) => {
    if (metadata) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const id = open ? `tooltip-popover-${name}` : undefined;

  // Determine chip color based on type
  const getChipColor = (): ChipProps["color"] => {
    if (chipColorOverride) {
      return chipColorOverride;
    }
    if (!metadata) return "default";
    if (metadata.type === "mcp" && status === "reauth_required") {
      return "default";
    }
    if (metadata.type === "mcp" && (status === "active" || status === "online")) {
      return "success";
    }
    return "default";
  };

  return (
    <>
      <Chip
        label={label || name}
        variant={variant}
        size={size}
        color={getChipColor()}
        onClick={handleChipClick}
        icon={metadata ? <InfoOutlinedIcon sx={{ fontSize: "0.875rem" }} /> : undefined}
        sx={{
          cursor: metadata ? "pointer" : "default",
          transition: "all 0.2s ease",
          "&:hover": metadata
            ? {
                backgroundColor: "action.hover",
                borderColor: "primary.main",
              }
            : undefined,
        }}
      />

      {metadata && (
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 2,
              backgroundColor: "#fff",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "10px",
              maxWidth: "320px",
              width: "min(320px, calc(100vw - 32px))",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              backdropFilter: "blur(4px)",
            }}
          >
            <Stack spacing={1.5}>
              {/* Header: Type badge + Name */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    textTransform: "uppercase",
                    fontSize: "0.7rem",
                    px: 1,
                    py: 0.5,
                    backgroundColor:
                      metadata.type === "mcp"
                        ? "info.light"
                        : metadata.type === "skill"
                          ? "success.light"
                          : metadata.type === "rule"
                            ? "secondary.light"
                            : "warning.light",
                    color:
                      metadata.type === "mcp"
                        ? "info.dark"
                        : metadata.type === "skill"
                          ? "success.dark"
                          : metadata.type === "rule"
                            ? "secondary.dark"
                            : "warning.dark",
                    borderRadius: "4px",
                  }}
                >
                  {metadata.type === "mcp"
                    ? "Интеграция"
                    : metadata.type === "skill"
                      ? "Навык"
                      : metadata.type === "rule"
                        ? "Правило"
                        : "Инструмент"}
                </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: "text.primary",
                      fontSize: "0.9rem",
                      lineHeight: 1.2,
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {metadata.name}
                  </Typography>
                {status && metadata.type === "mcp" && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 500,
                      color:
                        status === "active" || status === "online"
                          ? "success.main"
                          : "warning.main",
                      fontSize: "0.75rem",
                    }}
                  >
                    {status === "reauth_required"
                      ? "⚠️ Требуется авторизация"
                      : status === "online" || status === "active"
                        ? "✓ Активна"
                        : `${status}`}
                  </Typography>
                )}
              </Stack>

              {/* Description */}
              <Typography
                variant="body2"
                sx={{
                  color: "text.primary",
                  lineHeight: 1.5,
                  fontSize: "0.875rem",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                }}
              >
                {metadata.description}
              </Typography>

              {/* Impact/Effect */}
              {metadata.impactInNumbers && (
                <Typography
                  variant="caption"
                  sx={{
                    color: "primary.main",
                    fontWeight: 500,
                    fontSize: "0.8rem",
                    fontStyle: "italic",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  }}
                >
                  📊 {metadata.impactInNumbers}
                </Typography>
              )}

              {metadata.agentNames && metadata.agentNames.length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      fontWeight: 600,
                      color: "text.secondary",
                      fontSize: "0.75rem",
                      mb: 0.5,
                    }}
                  >
                    Используют агенты:
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.8rem",
                      lineHeight: 1.4,
                      display: "block",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {metadata.agentNames.join(", ")}
                  </Typography>
                </Box>
              )}

              {/* Practical Tasks */}
              {metadata.practicalTasks && metadata.practicalTasks.length > 0 && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      fontWeight: 600,
                      color: "text.secondary",
                      fontSize: "0.75rem",
                      mb: 0.5,
                    }}
                  >
                    Практические задачи:
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.8rem",
                      lineHeight: 1.4,
                      display: "block",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {formatPracticalTasks(metadata.practicalTasks)}
                  </Typography>
                </Box>
              )}

              {/* File Path */}
              {metadata.filePath && (
                <Box
                  sx={{
                    pt: 1,
                    borderTop: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      fontWeight: 600,
                      color: "text.secondary",
                      fontSize: "0.75rem",
                      mb: 0.5,
                  }}
                  >
                    Путь:
                  </Typography>
                  <Link
                    component="span"
                    onClick={() => {
                      if (onOpenFile) {
                        onOpenFile(metadata.filePath!);
                        handleClose();
                      }
                    }}
                    sx={{
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      color: "primary.main",
                      cursor: onOpenFile ? "pointer" : "default",
                      textDecoration: "none",
                      "&:hover": onOpenFile
                        ? {
                            textDecoration: "underline",
                            color: "primary.dark",
                          }
                        : undefined,
                      display: "block",
                      wordBreak: "break-all",
                    }}
                  >
                    {metadata.filePath}
                  </Link>
                </Box>
              )}
            </Stack>
          </Paper>
        </Popover>
      )}
    </>
  );
}
