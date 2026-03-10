import React from "react";
import { Link, Stack } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <OpenInNewIcon sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }} />
      <Link
        component="a"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        variant="body2"
        underline="hover"
        sx={{
          color: "primary.main",
          cursor: "pointer",
          userSelect: "text",
          WebkitUserSelect: "text",
          MozUserSelect: "text",
        }}
      >
        {children}
      </Link>
    </Stack>
  );
}
