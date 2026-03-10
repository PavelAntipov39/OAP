import {
  Alert,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { AgentMemoryRiskControl } from "../../../lib/generatedData";

export function RiskReportModal({
  open,
  onClose,
  riskControl,
}: {
  open: boolean;
  onClose: () => void;
  riskControl: AgentMemoryRiskControl | null;
}) {
  const flags = riskControl?.riskFlags ?? [];
  const tp = riskControl?.toolPolicy;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center" }}>
        Отчёт по рискам
        <IconButton onClick={onClose} sx={{ ml: "auto" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Флаги рисков
          </Typography>
          {flags.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Критических рисков не обнаружено
            </Typography>
          ) : (
            <Stack spacing={0.5}>
              {flags.map((flag) => (
                <Alert key={flag} severity="warning" sx={{ py: 0 }}>
                  {flag.replace(/_/g, " ")}
                </Alert>
              ))}
            </Stack>
          )}

          <Divider />

          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Политика инструментов
          </Typography>
          {tp ? (
            <Stack spacing={0.75}>
              <Typography variant="body2">
                <strong>Профиль:</strong> {tp.profile}
              </Typography>
              <Typography variant="body2">
                <strong>Режим одобрения:</strong> {tp.approval_mode}
              </Typography>
              {tp.allow.length > 0 ? (
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Allow:</Typography>
                  {tp.allow.map((t) => (
                    <Chip key={t} size="small" label={t} color="success" variant="outlined" />
                  ))}
                </Stack>
              ) : null}
              {tp.deny.length > 0 ? (
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Deny:</Typography>
                  {tp.deny.map((t) => (
                    <Chip key={t} size="small" label={t} color="error" variant="outlined" />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              не зафиксировано
            </Typography>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
