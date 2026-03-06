import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { SessionSearchProcess } from "../../../lib/analystCardData";

export function SessionSearchModal({
  open,
  onClose,
  searchProcess,
}: {
  open: boolean;
  onClose: () => void;
  searchProcess: SessionSearchProcess;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center" }}>
        Процесс поиска информации
        <IconButton onClick={onClose} sx={{ ml: "auto" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2">
            <strong>Подход:</strong> {searchProcess.approach}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Шаги:
          </Typography>
          <Stack component="ol" sx={{ m: 0, pl: 2.5 }} spacing={0.25}>
            {searchProcess.steps.map((step, i) => (
              <Typography component="li" variant="body2" key={i}>
                {step}
              </Typography>
            ))}
          </Stack>
          <Typography variant="body2">
            <strong>Качество:</strong> {searchProcess.quality}
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
