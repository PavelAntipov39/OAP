import React from "react";
import { Link, Stack } from "@mui/material";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";

export function FilePathLink({
  path,
  label,
  onClick,
}: {
  path: string;
  label?: string;
  onClick: (path: string) => void;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <InsertDriveFileOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
      <Link
        component="button"
        type="button"
        variant="body2"
        underline="hover"
        onClick={() => onClick(path)}
        sx={{
          textAlign: "left",
          fontFamily: "monospace",
          fontSize: "0.8rem",
          color: "primary.main",
          cursor: "pointer",
          userSelect: "text",
          WebkitUserSelect: "text",
          MozUserSelect: "text",
        }}
      >
        {label || path}
      </Link>
    </Stack>
  );
}
