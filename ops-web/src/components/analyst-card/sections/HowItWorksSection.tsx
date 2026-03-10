import { Button, Stack } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { SectionBlock } from "../SectionBlock";

function openPage(hash: string) {
  const base = window.location.origin + window.location.pathname;
  window.open(`${base}${hash}`, "_blank", "noopener,noreferrer");
}

const LINKS = [
  { label: "C4 / Excalidraw-схема", hash: "#/agent-flow" },
  { label: "BPMN-диаграмма",        hash: "#/bpmn" },
  { label: "Visual Explainer",      hash: "#/visual-explainer" },
  { label: "Архитектура",           hash: "#/architecture" },
];

export function HowItWorksSection() {
  return (
    <SectionBlock
      title="Как это работает"
      tooltip="Визуальные схемы бизнес-логики агента: C4/Excalidraw для архитектурных диаграмм, BPMN для процессов, Visual Explainer для пошагового разбора логики"
    >
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {LINKS.map(({ label, hash }) => (
          <Button
            key={hash}
            variant="outlined"
            size="small"
            startIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
            onClick={() => openPage(hash)}
            sx={{ textTransform: "none" }}
          >
            {label}
          </Button>
        ))}
      </Stack>
    </SectionBlock>
  );
}
