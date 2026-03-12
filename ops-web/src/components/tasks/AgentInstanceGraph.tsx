import React from "react";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import SubdirectoryArrowRightIcon from "@mui/icons-material/SubdirectoryArrowRight";
import {
  Box,
  Chip,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import type { AgentTaskCollaborationPlan } from "../../lib/tasksApi";
import { getAgentsManifest } from "../../lib/generatedData";

type AgentInstanceGraphProps = {
  collaborationPlan: AgentTaskCollaborationPlan;
  onOpenAgent: (agentId: string) => void;
};

type SpawnedInstance = NonNullable<AgentTaskCollaborationPlan["spawned_instances"]>[number];
const ACTIVE_AGENT_IDS = new Set(getAgentsManifest().agents.map((agent) => agent.id));

function EmptyValue({ text = "не зафиксировано" }: { text?: string }) {
  return (
    <Typography variant="body2" color="text.secondary">
      {text}
    </Typography>
  );
}

function summarizeList(values: string[], fallback = "не зафиксировано") {
  if (values.length === 0) {
    return fallback;
  }
  return values.join(", ");
}

function interactionModeLabel(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "mixed_phased") return "Смешанный режим";
  if (normalized === "parallel_read_only") return "Параллельно, только чтение";
  if (normalized === "sequential") return "Последовательно";
  return "не зафиксировано";
}

function phaseModeLabel(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "parallel_read_only") return "Параллельно";
  if (normalized === "roundtable") return "Roundtable";
  if (normalized === "sequential") return "Последовательно";
  return value || "не зафиксировано";
}

function isOpenableAgentProfile(agentId: string) {
  const normalized = agentId.trim();
  return normalized.toLowerCase().endsWith("-agent") && ACTIVE_AGENT_IDS.has(normalized);
}

function buildDepthMap(instances: SpawnedInstance[]) {
  const byId = new Map<string, SpawnedInstance>();
  const children = new Map<string, SpawnedInstance[]>();
  const roots: SpawnedInstance[] = [];

  instances.forEach((instance) => {
    byId.set(instance.instance_id, instance);
  });

  instances.forEach((instance) => {
    const parentId = instance.parent_instance_id;
    if (!parentId || !byId.has(parentId)) {
      roots.push(instance);
      return;
    }
    const current = children.get(parentId) || [];
    current.push(instance);
    children.set(parentId, current);
  });

  roots.sort((left, right) => left.depth - right.depth || left.instance_id.localeCompare(right.instance_id));
  children.forEach((value) => value.sort((left, right) => left.depth - right.depth || left.instance_id.localeCompare(right.instance_id)));

  return { children, roots };
}

function StatusChip(props: { label: string; tone: "default" | "warning" | "success" | "info" }) {
  return <Chip size="small" variant="outlined" color={props.tone} label={props.label} sx={{ height: 22 }} />;
}

function ArchivedAgentLabel({ agentId }: { agentId: string }) {
  return (
    <Stack component="span" direction="row" spacing={0.5} alignItems="center" useFlexGap flexWrap="wrap">
      <Typography variant="body2" component="span">
        {agentId}
      </Typography>
      <Chip size="small" variant="outlined" label="архив" sx={{ height: 20 }} />
    </Stack>
  );
}

function instanceStatusTone(status: string): "default" | "warning" | "success" | "info" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed") return "success";
  if (normalized === "running") return "info";
  if (normalized === "failed" || normalized === "cancelled") return "warning";
  return "default";
}

function verifyTone(status: string): "default" | "warning" | "success" | "info" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "passed") return "success";
  if (normalized === "failed") return "warning";
  if (normalized === "started" || normalized === "pending") return "info";
  return "default";
}

function InstanceCard(props: {
  instance: SpawnedInstance;
  childrenByParent: Map<string, SpawnedInstance[]>;
  onOpenAgent: (agentId: string) => void;
  level?: number;
}) {
  const { instance, childrenByParent, onOpenAgent, level = 0 } = props;
  const children = childrenByParent.get(instance.instance_id) || [];

  return (
    <Stack spacing={0.75}>
      <Paper variant="outlined" sx={{ p: 0.9, ml: level * 2 }}>
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
            {level > 0 ? <SubdirectoryArrowRightIcon fontSize="small" color="action" /> : <AccountTreeOutlinedIcon fontSize="small" color="action" />}
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {instance.instance_id}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              профиль:
            </Typography>
            {isOpenableAgentProfile(instance.profile_id) ? (
              <Link component="button" type="button" underline="hover" onClick={() => onOpenAgent(instance.profile_id)}>
                {instance.profile_id}
              </Link>
            ) : (
              <ArchivedAgentLabel agentId={instance.profile_id} />
            )}
            <StatusChip label={`status: ${instance.status || "planned"}`} tone={instanceStatusTone(instance.status)} />
            <StatusChip label={`verify: ${instance.verify_status || "pending"}`} tone={verifyTone(instance.verify_status)} />
            {instance.phase_id ? <StatusChip label={`phase: ${instance.phase_id}`} tone="default" /> : null}
            {instance.read_only ? <StatusChip label="read-only" tone="info" /> : null}
          </Stack>

          <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
            <Typography variant="caption" color="text.secondary">
              depth: {instance.depth}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              parent: {instance.parent_instance_id || "root"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              root: {instance.root_agent_id || "не зафиксировано"}
            </Typography>
            {instance.execution_backend ? (
              <Typography variant="caption" color="text.secondary">
                backend: {instance.execution_backend}
              </Typography>
            ) : null}
            {instance.context_window_id ? (
              <Typography variant="caption" color="text.secondary">
                window: {instance.context_window_id}
              </Typography>
            ) : null}
          </Stack>

          <Typography variant="body2">
            <strong>Purpose:</strong> {instance.purpose || "не зафиксировано"}
          </Typography>

          <Divider flexItem />

          <Stack spacing={0.35}>
            <Typography variant="caption" color="text.secondary">
              Skills: {summarizeList(instance.allowed_skills, "none")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Tools: {summarizeList(instance.allowed_tools, "none")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              MCP: {summarizeList(instance.allowed_mcp, "none")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Rules: {summarizeList(instance.applied_rules, "none")}
            </Typography>
            {instance.ownership_scope && instance.ownership_scope.length > 0 ? (
              <Typography variant="caption" color="text.secondary">
                Scope: {summarizeList(instance.ownership_scope, "none")}
              </Typography>
            ) : null}
          </Stack>

          <Divider flexItem />

          <Stack spacing={0.35}>
            <Typography variant="caption" color="text.secondary">
              Input refs: {summarizeList(instance.input_refs, "не зафиксировано")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Output refs: {summarizeList(instance.output_refs, "не зафиксировано")}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      {children.length > 0 ? (
        <Box>
          {children.map((child) => (
            <InstanceCard
              key={child.instance_id}
              instance={child}
              childrenByParent={childrenByParent}
              onOpenAgent={onOpenAgent}
              level={level + 1}
            />
          ))}
        </Box>
      ) : null}
    </Stack>
  );
}

export function AgentInstanceGraph(props: AgentInstanceGraphProps) {
  const { collaborationPlan, onOpenAgent } = props;
  const instances = collaborationPlan.spawned_instances || [];
  const phases = collaborationPlan.interaction_phases || [];
  const roundtablePolicy = collaborationPlan.roundtable_policy;
  const discussionRounds = collaborationPlan.discussion_rounds || [];
  const defaultHostId = collaborationPlan.host_execution_strategy?.default_host_id || "codex";
  const defaultHostPolicy = collaborationPlan.host_execution_strategy?.host_policies?.[defaultHostId];

  return (
    <Stack spacing={0.8}>
      <Paper variant="outlined" sx={{ p: 0.9 }}>
        <Stack spacing={0.55}>
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Режим:
            </Typography>
            <Chip size="small" variant="outlined" label={interactionModeLabel(collaborationPlan.interaction_mode)} />
            {collaborationPlan.roundtable_policy?.enabled ? <Chip size="small" color="info" variant="outlined" label={`Roundtable до ${roundtablePolicy?.max_rounds || 4} раундов`} /> : null}
            {defaultHostPolicy ? <Chip size="small" variant="outlined" label={`${defaultHostPolicy.display_name}: ${defaultHostPolicy.execution_backend}`} /> : null}
          </Stack>
          <Typography variant="body2">
            <strong>Координатор:</strong>{" "}
            {isOpenableAgentProfile(collaborationPlan.primary_coordinator_agent_id || "") ? (
              <Link component="button" type="button" underline="hover" onClick={() => onOpenAgent(collaborationPlan.primary_coordinator_agent_id || "")}>
                {collaborationPlan.primary_coordinator_agent_id}
              </Link>
            ) : (
              collaborationPlan.primary_coordinator_agent_id || "не зафиксировано"
            )}
          </Typography>
          <Typography variant="body2">
            <strong>Merge owner:</strong> {collaborationPlan.merge_owner_agent_id || "не зафиксировано"}
          </Typography>
          <Typography variant="body2">
            <strong>Финальный синтезатор:</strong> {collaborationPlan.final_synthesizer_agent_id || "не зафиксировано"}
          </Typography>
          <Typography variant="body2">
            <strong>Изоляция контекста:</strong> {collaborationPlan.context_isolation_policy || "не зафиксировано"}
          </Typography>
          <Typography variant="body2">
            <strong>Merge policy:</strong> {collaborationPlan.merge_strategy || "не зафиксировано"}
          </Typography>
          <Typography variant="body2">
            <strong>Conflict policy:</strong> {collaborationPlan.conflict_policy || "не зафиксировано"}
          </Typography>
          {collaborationPlan.selection_basis && collaborationPlan.selection_basis.length > 0 ? (
            <Typography variant="caption" color="text.secondary">
              Основание выбора: {collaborationPlan.selection_basis.join(", ")}
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      <Stack spacing={0.6}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Фазы
        </Typography>
        {phases.length === 0 ? (
          <EmptyValue text="Фазы не зафиксированы." />
        ) : (
          phases.map((phase) => (
            <Paper key={phase.phase_id} variant="outlined" sx={{ p: 0.85 }}>
              <Stack spacing={0.4}>
                <Stack direction="row" spacing={0.6} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {phase.label}
                  </Typography>
                  <Chip size="small" variant="outlined" label={phaseModeLabel(phase.mode)} />
                  <Chip size="small" variant="outlined" label={phase.status || "planned"} />
                  <Typography variant="caption" color="text.secondary">
                    {phase.phase_id}
                  </Typography>
                </Stack>
                {phase.goal ? (
                  <Typography variant="body2" color="text.secondary">
                    {phase.goal}
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  Участники: {summarizeList(phase.participants)}
                </Typography>
                {phase.depends_on.length > 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    После: {phase.depends_on.join(", ")}
                  </Typography>
                ) : null}
                {phase.merge_into ? (
                  <Typography variant="caption" color="text.secondary">
                    Merge в: {phase.merge_into}
                  </Typography>
                ) : null}
              </Stack>
            </Paper>
          ))
        )}
      </Stack>

      {roundtablePolicy?.enabled ? (
        <Stack spacing={0.6}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            История roundtable
          </Typography>
          <Paper variant="outlined" sx={{ p: 0.85 }}>
            <Stack spacing={0.35}>
              <Typography variant="body2">
                <strong>Модератор:</strong> {roundtablePolicy.moderated_by || "не зафиксировано"}
              </Typography>
              <Typography variant="body2">
                <strong>Raw transcript:</strong> {roundtablePolicy.transcript_visibility === "summary_only" ? "скрыт, показываем только краткие тезисы" : roundtablePolicy.transcript_visibility}
              </Typography>
            </Stack>
          </Paper>
          {discussionRounds.length === 0 ? (
            <EmptyValue text="Раунды еще не зафиксированы. После исполнения здесь появятся краткие тезисы по каждому раунду." />
          ) : (
            discussionRounds.map((round) => (
              <Paper key={round.round_id} variant="outlined" sx={{ p: 0.85 }}>
                <Stack spacing={0.35}>
                  <Stack direction="row" spacing={0.6} alignItems="center" useFlexGap flexWrap="wrap">
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Раунд {round.round_index}
                    </Typography>
                    <Chip size="small" variant="outlined" label={round.status || "planned"} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Участники: {summarizeList(round.participants)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {round.summary || "Краткий тезис еще не зафиксирован."}
                  </Typography>
                  {round.next_owner_agent_id ? (
                    <Typography variant="caption" color="text.secondary">
                      Следующий owner: {round.next_owner_agent_id}
                    </Typography>
                  ) : null}
                </Stack>
              </Paper>
            ))
          )}
        </Stack>
      ) : null}

      <Typography variant="body2">
        <strong>Как читать:</strong> ниже показаны фактические child-runs, их parent/root lineage и какой контур им был разрешен на выполнение.
      </Typography>

      {instances.length === 0 ? (
        <EmptyValue text="Фактические child-runs не зафиксированы." />
      ) : (
        (() => {
          const { children, roots } = buildDepthMap(instances);
          return roots.map((instance) => (
            <InstanceCard key={instance.instance_id} instance={instance} childrenByParent={children} onOpenAgent={onOpenAgent} />
          ));
        })()
      )}
    </Stack>
  );
}
