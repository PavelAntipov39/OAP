import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { METRIC_META } from "../../../lib/analystCardData";

export function SessionMetricsModal({
  open,
  onClose,
  metrics,
}: {
  open: boolean;
  onClose: () => void;
  metrics: Record<string, number | null>;
}) {
  const entries = Object.entries(metrics);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center" }}>
        Целевые метрики сессии
        <IconButton onClick={onClose} sx={{ ml: "auto" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>
        ) : (
          <Stack spacing={1.25}>
            {entries.map(([key, value]) => {
              const meta = METRIC_META[key];
              return (
                <Stack key={key} direction="row" alignItems="center" spacing={1}>
                  <Stack sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {meta?.label ?? key}
                      </Typography>
                      {meta ? (
                        <Tooltip
                          title={`${meta.description}\nФормула: ${meta.formula}`}
                          arrow
                          placement="top"
                        >
                          <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary", cursor: "help" }} />
                        </Tooltip>
                      ) : null}
                    </Stack>
                    {meta ? (
                      <Typography variant="caption" color="text.secondary">
                        {meta.description}
                      </Typography>
                    ) : null}
                  </Stack>
                  <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 50, textAlign: "right" }}>
                    {value != null ? `${value}%` : "—"}
                  </Typography>
                </Stack>
              );
            })}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
