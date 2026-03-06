import { Stack, Typography } from "@mui/material";
import type { AgentLatestCycleSnapshot } from "../../../lib/generatedData";
import { SectionBlock } from "../SectionBlock";
import { FilePathLink } from "../FilePathLink";

function formatTime(value: string | null): string {
  if (!value) return "—";
  const ts = new Date(value);
  if (Number.isNaN(ts.getTime())) return "—";
  return ts.toLocaleString("ru-RU");
}

export function ChangeLogSection({
  cycle,
  onOpenFile,
}: {
  cycle: AgentLatestCycleSnapshot;
  onOpenFile: (path: string) => void;
}) {
  const hasTimeline = cycle.timeline.length > 0;

  return (
    <SectionBlock
      title="История изменений"
      tooltip="Лента событий последнего цикла агента и ссылка на полный лог работы"
    >
      {hasTimeline ? (
        <Stack spacing={0.5}>
          {cycle.timeline.map((ev, i) => (
            <Typography variant="body2" key={i}>
              <strong>{formatTime(ev.timestamp)}</strong> — {ev.step}: {ev.outcome}
              {ev.status !== "ok" ? ` (${ev.status})` : ""}
            </Typography>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Лента событий пуста — телеметрия не зафиксирована
        </Typography>
      )}

      <FilePathLink
        path={cycle.source.summary_path}
        label={cycle.source.summary_path}
        onClick={onOpenFile}
      />
    </SectionBlock>
  );
}
