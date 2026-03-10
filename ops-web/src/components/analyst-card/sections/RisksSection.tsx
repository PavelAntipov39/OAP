import React from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import type { AgentMemoryContext } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { RiskReportModal } from "../modals/RiskReportModal";

export function RisksSection({
  memoryContext,
}: {
  memoryContext: AgentMemoryContext | null | undefined;
}) {
  const [open, setOpen] = React.useState(false);
  const rc = memoryContext?.riskControl;
  const flags = rc?.riskFlags ?? [];

  return (
    <SectionBlock
      title="Риски"
      tooltip="Критические риски и флаги безопасности, обнаруженные в последнем цикле работы агента"
    >
      {flags.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          Критических рисков не обнаружено
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {flags.map((flag) => (
            <Alert key={flag} severity="warning" icon={<WarningAmberOutlinedIcon fontSize="small" />} sx={{ py: 0 }}>
              {flag.replace(/_/g, " ")}
            </Alert>
          ))}
        </Stack>
      )}
      <Button
        size="small"
        variant="outlined"
        onClick={() => setOpen(true)}
        sx={{ textTransform: "none", mt: 0.5, alignSelf: "flex-start" }}
      >
        Отчёт по рискам
      </Button>
      <RiskReportModal open={open} onClose={() => setOpen(false)} riskControl={rc ?? null} />
    </SectionBlock>
  );
}
