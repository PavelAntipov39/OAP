import React, { Suspense } from "react";
import {
  AppBar,
  Box,
  CircularProgress,
  Container,
  Link,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";

const OverviewPage = React.lazy(() => import("../pages/OverviewPage").then((module) => ({ default: module.OverviewPage })));
const ArchitecturePage = React.lazy(() => import("../pages/ArchitecturePage").then((module) => ({ default: module.ArchitecturePage })));
const BpmnPage = React.lazy(() => import("../pages/BpmnPage").then((module) => ({ default: module.BpmnPage })));
const DocsPage = React.lazy(() => import("../pages/DocsPage").then((module) => ({ default: module.DocsPage })));
const GlossaryPage = React.lazy(() => import("../pages/GlossaryPage").then((module) => ({ default: module.GlossaryPage })));
const AgentsPage = React.lazy(() => import("../pages/AgentsPage").then((module) => ({ default: module.AgentsPage })));
const TasksPage = React.lazy(() => import("../pages/TasksPage").then((module) => ({ default: module.TasksPage })));
const AgentFlowPage = React.lazy(() => import("../pages/AgentFlowPage").then((module) => ({ default: module.AgentFlowPage })));
const VisualExplainerPage = React.lazy(() => import("../pages/VisualExplainerPage").then((module) => ({ default: module.VisualExplainerPage })));

type OpsRoute = "overview" | "architecture" | "bpmn" | "docs" | "glossary" | "tasks" | "agents" | "agent-flow" | "visual-explainer";

function readRoute(): OpsRoute {
  const hash = (location.hash || "").replace(/^#\/?/, "");
  if (hash.startsWith("architecture")) return "architecture";
  if (hash.startsWith("bpmn")) return "bpmn";
  if (hash.startsWith("docs")) return "docs";
  if (hash.startsWith("glossary")) return "glossary";
  if (hash.startsWith("tasks")) return "tasks";
  if (hash.startsWith("agents")) return "agents";
  if (hash.startsWith("agent-flow")) return "agent-flow";
  if (hash.startsWith("visual-explainer")) return "visual-explainer";
  return "overview";
}

function RouteFallback() {
  return (
    <Paper
      elevation={0}
      sx={{
        minHeight: 240,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        bgcolor: "transparent",
      }}
    >
      <CircularProgress size={24} />
      <Typography variant="body2" color="text.secondary">
        Loading page...
      </Typography>
    </Paper>
  );
}

export function App() {
  const [route, setRouteState] = React.useState<OpsRoute>(() => readRoute());

  React.useEffect(() => {
    const onHash = () => setRouteState(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky" color="transparent">
        <Toolbar sx={{ gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            OAP Ops Hub
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Link href="#/agents" underline="hover" color="inherit">
            Agents
          </Link>
          <Link href="#/tasks" underline="hover" color="inherit">
            Tasks
          </Link>
          <Link href="#/docs" underline="hover" color="inherit">
            Docs
          </Link>
          <Link href="#/glossary" underline="hover" color="inherit">
            Glossary
          </Link>
          <Link href="#/agent-flow" underline="hover" color="inherit">
            Agent Flow
          </Link>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 2 }}>
        <Suspense fallback={<RouteFallback />}>
          {route === "overview" ? <OverviewPage /> : null}
          {route === "architecture" ? <ArchitecturePage /> : null}
          {route === "bpmn" ? <BpmnPage /> : null}
          {route === "docs" ? <DocsPage /> : null}
          {route === "glossary" ? <GlossaryPage /> : null}
          {route === "tasks" ? <TasksPage /> : null}
          {route === "agents" ? <AgentsPage /> : null}
          {route === "agent-flow" ? <AgentFlowPage /> : null}
          {route === "visual-explainer" ? <VisualExplainerPage /> : null}
        </Suspense>
      </Container>
    </Box>
  );
}
