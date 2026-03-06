import {
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { SessionFileLogEntry } from "../../../lib/analystCardData";

export function SessionFileLogModal({
  open,
  onClose,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  entries: SessionFileLogEntry[];
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: "flex", alignItems: "center" }}>
        Лог по файлам
        <IconButton onClick={onClose} sx={{ ml: "auto" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {entries.length === 0 ? (
          <Typography variant="body2" color="text.secondary">не зафиксировано</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Время</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Этап</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Затронутые файлы</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Контекст</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{entry.time}</TableCell>
                  <TableCell>{entry.step}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.78rem" }}>
                    {entry.files.length > 0 ? entry.files.join(", ") : "—"}
                  </TableCell>
                  <TableCell>{entry.context}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
