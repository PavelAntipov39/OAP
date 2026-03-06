import React from "react";
import {
  AppBar,
  Box,
  Container,
  Link,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import SchemaOutlinedIcon from "@mui/icons-material/SchemaOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";

import { OverviewPage } from "../pages/OverviewPage";
import { ArchitecturePage } from "../pages/ArchitecturePage";
import { BpmnPage } from "../pages/BpmnPage";
import { DocsPage } from "../pages/DocsPage";
import { AgentsPage } from "../pages/AgentsPage";
import { TasksPage } from "../pages/TasksPage";
import { AgentFlowPage } from "../pages/AgentFlowPage";
import { VisualExplainerPage } from "../pages/VisualExplainerPage";

type OpsRoute = "overview" | "architecture" | "bpmn" | "docs" | "tasks" | "agents" | "agent-flow" | "visual-explainer";

function readRoute(): OpsRoute {
  const hash = (location.hash || "").replace(/^#\/?/, "");
  if (hash.startsWith("architecture")) return "architecture";
  if (hash.startsWith("bpmn")) return "bpmn";
  if (hash.startsWith("docs")) return "docs";
  if (hash.startsWith("tasks")) return "tasks";
  if (hash.startsWith("agents")) return "agents";
  if (hash.startsWith("agent-flow")) return "agent-flow";
  if (hash.startsWith("visual-explainer")) return "visual-explainer";
  return "overview";
}

function setRoute(route: OpsRoute) {
  location.hash = `#/${route}`;
}

export function App() {
  const [route, setRouteState] = React.useState<OpsRoute>(() => readRoute());

  React.useEffect(() => {
    const onHash = () => setRouteState(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const tab =
    route === "overview" ? 0 : route === "architecture" ? 1 : route === "bpmn" ? 2 : route === "docs" ? 3 : 4;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="transparent">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            OAP Ops Hub
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Architecture + BPMN + OAP Knowledge Base
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Link href="#/overview" underline="hover" color="inherit">
            Hub
          </Link>
          <Link href="#/agents" underline="hover" color="inherit">
            Agents (phase 2)
          </Link>
          <Link href="#/tasks" underline="hover" color="inherit">
            Tasks
          </Link>
          <Link href="#/agent-flow" underline="hover" color="inherit">
            Agent Flow
          </Link>
        </Toolbar>
        <Tabs
          value={route === "agents" || route === "agent-flow" ? false : tab}
          onChange={(_, value: number) => {
            const next: OpsRoute =
              value === 0
                ? "overview"
                : value === 1
                  ? "architecture"
                  : value === 2
                    ? "bpmn"
                    : value === 3
                      ? "docs"
                      : "tasks";
            setRoute(next);
          }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ px: 2 }}
        >
          <Tab icon={<HomeOutlinedIcon />} iconPosition="start" label="Overview" />
          <Tab icon={<AccountTreeOutlinedIcon />} iconPosition="start" label="Architecture" />
          <Tab icon={<SchemaOutlinedIcon />} iconPosition="start" label="BPMN" />
          <Tab icon={<DescriptionOutlinedIcon />} iconPosition="start" label="База знаний ОАП" />
          <Tab icon={<AssignmentTurnedInOutlinedIcon />} iconPosition="start" label="Задачи" />
        </Tabs>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 2 }}>
        {route === "overview" ? <OverviewPage /> : null}
        {route === "architecture" ? <ArchitecturePage /> : null}
        {route === "bpmn" ? <BpmnPage /> : null}
        {route === "docs" ? <DocsPage /> : null}
        {route === "tasks" ? <TasksPage /> : null}
        {route === "agents" ? <AgentsPage /> : null}
        {route === "agent-flow" ? <AgentFlowPage /> : null}
        {route === "visual-explainer" ? <VisualExplainerPage /> : null}
      </Container>
    </Box>
  );
}
