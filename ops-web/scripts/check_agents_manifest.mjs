#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const opsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(opsRoot, "..");
const manifestPath = path.join(opsRoot, "src", "generated", "agents-manifest.json");
const assistantGovernanceContractPath = path.join(
  repoRoot,
  ".specify",
  "specs",
  "001-oap",
  "contracts",
  "assistant-governance.json",
);
const uiSectionContractPath = path.join(opsRoot, "src", "generated", "ui-section-contract.json");
const hostSmokeReportPath = path.join(opsRoot, "src", "generated", "host-agent-smoke.json");
const schemaPath = path.resolve(opsRoot, "..", "docs", "subservices", "oap", "agents-card.schema.json");
const MODERN_AGENT_IDS = new Set(["analyst-agent", "designer-agent"]);
const REQUIRED_TOP_LEVEL_HOSTS = ["codex", "claude_code", "github_copilot"];
const UNIVERSAL_BACKBONE_STEPS = [
  "step_0_intake",
  "step_1_start",
  "step_2_preflight",
  "step_3_orchestration",
  "step_4_context_sync",
  "step_5_role_window",
  "step_6_role_exit_decision",
  "step_7_apply_or_publish",
  "step_7_contract_gate",
  "step_8_verify",
  "step_8_error_channel",
  "step_9_finalize",
  "step_9_publish_snapshots",
];
const EXPECTED_ROLE_WINDOW_BY_AGENT = {
  "reader-agent": {
    internalSteps: ["role_collect_sources", "role_synthesize_answer", "role_check_coverage"],
    purposeIncludes: "контекст",
  },
  "designer-agent": {
    internalSteps: ["role_review_ui_kit", "role_review_clarity", "role_prepare_design_actions"],
    purposeIncludes: "UX/UI",
  },
  "analyst-agent": {
    internalSteps: ["role_collect_quality_signals", "role_score_candidates", "role_select_priority"],
    purposeIncludes: "анализ кандидатов",
  },
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : NaN;
}

function assertNonEmptyString(value, message) {
  assert(typeof value === "string" && value.trim().length > 0, message);
}

function assertStringArray(value, message) {
  assert(Array.isArray(value), message);
  for (const item of value) {
    assertNonEmptyString(item, `${message}:item`);
  }
}

function assertExactStringArray(value, expected, message) {
  assert(Array.isArray(value), message);
  assert(
    value.length === expected.length && value.every((item, index) => item === expected[index]),
    `${message}:${JSON.stringify(value)}!=${JSON.stringify(expected)}`,
  );
}

function assertOptionalUrl(value, message) {
  if (value === null || value === undefined || value === "") return;
  assertNonEmptyString(value, message);
  try {
    // eslint-disable-next-line no-new
    new URL(String(value));
  } catch {
    throw new Error(`${message}:invalid_url`);
  }
}

function assertOptionalNumber(value, message) {
  if (value === null || value === undefined || value === "") return;
  const numeric = Number(value);
  assert(!Number.isNaN(numeric), message);
}

function renderAssistantEntryPointer({
  assistantId,
  displayName,
  canonicalFile,
  templateVersion,
}) {
  const specPath = "/.specify/specs/001-oap/spec.md";
  const uiSectionsPath = "ops-web/src/generated/ui-section-contract.json";
  return [
    `# ${displayName} Entry Point`,
    "",
    "<!-- generated: assistant-governance-v2 -->",
    "<!-- do-not-edit: use `npm --prefix ops-web run prepare-content` -->",
    "",
    `Этот файл является короткой точкой входа для \`${assistantId}\` и генерируется автоматически.`,
    "",
    "## Канон правил",
    `- Канонический файл правил: \`${canonicalFile}\`.`,
    "- Локальные правила в этом файле не задаются.",
    "",
    "## Порядок чтения",
    `1. \`${specPath}\``,
    `2. \`${canonicalFile}\``,
    "3. Этот entry-файл",
    "",
    "## Политика UI-ссылок",
    `- Использовать semantic ids из \`${uiSectionsPath}\`.`,
    "- Текущий display label брать из section-contract, а не из памяти.",
    "- При отсутствии section-contract сверяться с актуальным runtime/code.",
    "",
    `Template version: \`${templateVersion}\`.`,
    "",
  ].join("\n");
}

async function validateAssistantGovernance() {
  const raw = await fs.readFile(assistantGovernanceContractPath, "utf8");
  const contract = JSON.parse(raw);
  const canonicalFile = asString(contract?.canonical_file);
  const entryStrategy = asString(contract?.entry_strategy);
  const templateVersion = asString(contract?.template_version) || "v2";
  const assistants = Array.isArray(contract?.supported_assistants) ? contract.supported_assistants : [];

  assert(canonicalFile === "AGENTS.md", "assistant_governance_canonical_file_invalid");
  assert(entryStrategy === "generated_pointer", "assistant_governance_entry_strategy_invalid");
  assert(assistants.length > 0, "assistant_governance_supported_assistants_empty");

  for (const assistant of assistants) {
    if (assistant?.enabled === false) continue;
    const assistantId = asString(assistant?.assistant_id);
    const displayName = asString(assistant?.display_name) || assistantId;
    const entryFile = asString(assistant?.entry_file);
    assert(assistantId.length > 0, "assistant_governance_assistant_id_missing");
    assert(entryFile.length > 0, `assistant_governance_entry_file_missing:${assistantId}`);

    const absoluteEntry = path.join(repoRoot, entryFile);
    let actualContent = "";
    try {
      actualContent = await fs.readFile(absoluteEntry, "utf8");
    } catch {
      throw new Error(`assistant_governance_entry_file_not_found:${entryFile}`);
    }
    const expectedContent = renderAssistantEntryPointer({
      assistantId,
      displayName,
      canonicalFile,
      templateVersion,
    });
    assert(
      actualContent === expectedContent,
      `assistant_governance_entry_file_mismatch:${entryFile}`,
    );

    const lineCount = actualContent.split(/\r?\n/).length;
    assert(lineCount <= 40, `assistant_governance_entry_file_too_long:${entryFile}:${lineCount}`);
  }
}

async function validateUiSectionContract() {
  const raw = await fs.readFile(uiSectionContractPath, "utf8");
  const contract = JSON.parse(raw);
  const sections = Array.isArray(contract?.sections) ? contract.sections : [];
  assert(sections.length > 0, "ui_section_contract_sections_empty");

  const seen = new Set();
  for (const section of sections) {
    const sectionId = asString(section?.section_id);
    const currentLabel = asString(section?.current_label);
    const containerType = asString(section?.container_type);
    const cardType = asString(section?.card_type);
    const visibility = asString(section?.visibility);
    const sourceFile = asString(section?.source_file);

    assert(sectionId.length > 0, "ui_section_contract_section_id_missing");
    assert(!seen.has(sectionId), `ui_section_contract_duplicate_section_id:${sectionId}`);
    seen.add(sectionId);

    assert(currentLabel.length > 0, `ui_section_contract_current_label_missing:${sectionId}`);
    assert(["tab", "section", "drawer_block"].includes(containerType), `ui_section_contract_container_type_invalid:${sectionId}`);
    assert(cardType.length > 0, `ui_section_contract_card_type_missing:${sectionId}`);
    assert(visibility.length > 0, `ui_section_contract_visibility_missing:${sectionId}`);
    assert(sourceFile.length > 0, `ui_section_contract_source_file_missing:${sectionId}`);
    await assertFileExists(sourceFile, `ui_section_contract_source_file_not_found:${sectionId}`);
  }
}

async function validateGovernanceNoHardcodedUiLabels() {
  const governanceFiles = [
    path.join(repoRoot, ".github", "copilot-instructions.md"),
    path.join(repoRoot, "CLAUDE.md"),
  ];
  const disallowedLabels = [
    "Как работает ИИ агент",
    "Рабочий контур агента",
    "Навыки и Правила",
    "Задачи и качество",
    "Память и контекст",
  ];

  for (const filePath of governanceFiles) {
    let content = "";
    try {
      content = await fs.readFile(filePath, "utf8");
    } catch {
      throw new Error(`governance_file_missing:${path.relative(repoRoot, filePath).replace(/\\/g, "/")}`);
    }
    for (const label of disallowedLabels) {
      assert(
        !content.includes(label),
        `governance_hardcoded_ui_label_detected:${path.relative(repoRoot, filePath).replace(/\\/g, "/")}:${label}`,
      );
    }
  }
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function sortedUniqueStrings(value) {
  return [...new Set(normalizeStringArray(value))].sort((a, b) => a.localeCompare(b));
}

async function validateTopLevelHostGovernance(manifest) {
  const activeAgentsRaw = execFileSync("python3", ["scripts/export_host_agents.py", "list-active-agents"], {
    cwd: repoRoot,
    stdio: "pipe",
  }).toString("utf8");
  const activeAgentsPayload = JSON.parse(activeAgentsRaw);
  const activeAgents = Array.isArray(activeAgentsPayload?.agents) ? activeAgentsPayload.agents : [];
  assert(activeAgents.length > 0, "host_active_agents_missing");

  const smokeRaw = await fs.readFile(hostSmokeReportPath, "utf8");
  const smokeReport = JSON.parse(smokeRaw);

  const topLevelAgents = activeAgents.filter((item) => item && item.kind === "top_level");
  assert(topLevelAgents.length > 0, "host_active_top_level_empty");
  const topLevelAgentIds = new Set(topLevelAgents.map((item) => asString(item?.id)).filter(Boolean));

  const manifestAgents = manifest.agents.filter((item) => item && item.lifecycle === "active");
  const manifestTopLevelAgents = manifestAgents.filter((item) => topLevelAgentIds.has(asString(item?.id)));
  const manifestAgentIds = sortedUniqueStrings(manifestTopLevelAgents.map((item) => item.id));
  const topLevelAgentList = sortedUniqueStrings(topLevelAgents.map((item) => item.id));
  assert(
    JSON.stringify(manifestAgentIds) === JSON.stringify(topLevelAgentList),
    `top_level_manifest_active_agents_mismatch:${JSON.stringify(manifestAgentIds)}!=${JSON.stringify(topLevelAgentList)}`,
  );

  const manifestById = new Map(manifestTopLevelAgents.map((item) => [item.id, item]));

  for (const topLevelAgent of topLevelAgents) {
    const agentId = asString(topLevelAgent?.id);
    assertNonEmptyString(agentId, "host_active_top_level_id_missing");
    assert(asString(topLevelAgent?.sourceProfileId) === agentId, `host_active_source_profile_mismatch:${agentId}`);
    assertNonEmptyString(topLevelAgent?.mission, `host_active_mission_missing:${agentId}`);
    assertStringArray(topLevelAgent?.useWhen, `host_active_use_when_invalid:${agentId}`);
    assert(topLevelAgent.useWhen.length > 0, `host_active_use_when_empty:${agentId}`);
    assertStringArray(topLevelAgent?.avoidWhen, `host_active_avoid_when_invalid:${agentId}`);
    assert(topLevelAgent.avoidWhen.length > 0, `host_active_avoid_when_empty:${agentId}`);
    assertNonEmptyString(topLevelAgent?.inputContract, `host_active_input_contract_missing:${agentId}`);
    assertNonEmptyString(topLevelAgent?.outputContract, `host_active_output_contract_missing:${agentId}`);
    assertStringArray(topLevelAgent?.allowedSkills, `host_active_allowed_skills_invalid:${agentId}`);
    assert(topLevelAgent.allowedSkills.length > 0, `host_active_allowed_skills_empty:${agentId}`);
    assertStringArray(topLevelAgent?.allowedTools, `host_active_allowed_tools_invalid:${agentId}`);
    assert(topLevelAgent.allowedTools.length > 0, `host_active_allowed_tools_empty:${agentId}`);
    assertStringArray(topLevelAgent?.allowedRules, `host_active_allowed_rules_invalid:${agentId}`);
    assert(topLevelAgent.allowedRules.length > 0, `host_active_allowed_rules_empty:${agentId}`);
    assertStringArray(topLevelAgent?.supportedHosts, `host_active_supported_hosts_invalid:${agentId}`);
    assert(
      REQUIRED_TOP_LEVEL_HOSTS.every((hostId) => topLevelAgent.supportedHosts.includes(hostId)),
      `host_active_supported_hosts_missing:${agentId}:${JSON.stringify(topLevelAgent.supportedHosts)}`,
    );
    assertStringArray(topLevelAgent?.supportedScopes, `host_active_supported_scopes_invalid:${agentId}`);
    assert(topLevelAgent.supportedScopes.includes("repo"), `host_active_supported_scopes_repo_missing:${agentId}`);
    assertStringArray(topLevelAgent?.handoffTargets, `host_active_handoffs_invalid:${agentId}`);
    assert(topLevelAgent.handoffTargets.length > 0, `host_active_handoffs_empty:${agentId}`);
    assertStringArray(topLevelAgent?.stopConditions, `host_active_stop_conditions_invalid:${agentId}`);
    assert(topLevelAgent.stopConditions.length > 0, `host_active_stop_conditions_empty:${agentId}`);
    assert(topLevelAgent?.executionMode === "sequential", `host_active_execution_mode_invalid:${agentId}`);
    assert(topLevelAgent?.hostAdapters && typeof topLevelAgent.hostAdapters === "object", `host_active_host_adapters_missing:${agentId}`);
    assert(topLevelAgent.hostAdapters.github_copilot && typeof topLevelAgent.hostAdapters.github_copilot === "object", `host_active_github_adapter_missing:${agentId}`);
    assertNonEmptyString(topLevelAgent.hostAdapters.github_copilot.description, `host_active_github_description_missing:${agentId}`);
    assertStringArray(topLevelAgent.hostAdapters.github_copilot.tools, `host_active_github_tools_invalid:${agentId}`);
    assertStringArray(topLevelAgent.hostAdapters.github_copilot.agents, `host_active_github_agents_invalid:${agentId}`);

    const manifestAgent = manifestById.get(agentId);
    assert(manifestAgent, `top_level_agent_missing_in_manifest:${agentId}`);
    assert(["core", "specialist"].includes(manifestAgent.agentClass), `top_level_agent_class_invalid:${agentId}:${manifestAgent.agentClass}`);
    assert(manifestAgent.lifecycle === "active", `top_level_agent_lifecycle_invalid:${agentId}:${manifestAgent.lifecycle}`);
    assert(
      asString(manifestAgent.capabilityContract?.outputSchema).length > 0,
      `top_level_agent_capability_output_schema_missing:${agentId}`,
    );
    assert(
      manifestAgent.workflowBackbone?.supportsDynamicInstances === true,
      `top_level_agent_dynamic_instances_disabled:${agentId}`,
    );
  }

  assert(smokeReport && typeof smokeReport === "object", "host_smoke_report_invalid");
  assert(smokeReport.available === true, "host_smoke_report_unavailable");
  assert(smokeReport.ok === true, "host_smoke_report_not_ok");
  assert(
    JSON.stringify(sortedUniqueStrings(smokeReport.active_top_level_agents)) === JSON.stringify(topLevelAgentList),
    `host_smoke_active_set_mismatch:${JSON.stringify(smokeReport.active_top_level_agents)}!=${JSON.stringify(topLevelAgentList)}`,
  );
  assert(smokeReport.handoff_validation?.ok === true, "host_smoke_handoff_validation_failed");
  for (const hostId of REQUIRED_TOP_LEVEL_HOSTS) {
    assert(smokeReport.hosts?.[hostId], `host_smoke_missing_host:${hostId}`);
    assert(smokeReport.hosts[hostId].ok === true, `host_smoke_host_not_ok:${hostId}`);
  }
}

async function assertFileExists(relPath, message) {
  const raw = typeof relPath === "string" ? relPath.trim() : "";
  if (!raw) return;
  if (/\s/.test(raw) && !raw.startsWith("./") && !raw.startsWith("../")) return;
  const looksLikeLocalPath =
    raw.startsWith("./")
    || raw.startsWith("../")
    || raw.startsWith(".specify/")
    || raw.startsWith("docs/")
    || raw.startsWith("scripts/")
    || raw.startsWith("artifacts/")
    || raw.startsWith(".logs/")
    || raw.includes("/");
  if (!looksLikeLocalPath) return;
  const normalized = raw.replace(/^\.?\//, "");
  const absolutePath = path.join(repoRoot, normalized);
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`${message}:${normalized}`);
  }
}

async function main() {
  await validateAssistantGovernance();
  await validateUiSectionContract();
  await validateGovernanceNoHardcodedUiLabels();

  const schemaRaw = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(schemaRaw);
  assertNonEmptyString(schema.$id, "schema_missing_id");
  assert(schema?.$defs?.agent, "schema_missing_agent_def");

  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  assert(manifest && typeof manifest === "object", "manifest_invalid_shape");
  assert(typeof manifest.updatedAt === "string" && manifest.updatedAt.length > 0, "manifest_missing_updatedAt");
  assert(Array.isArray(manifest.agents), "manifest_missing_agents");
  await validateTopLevelHostGovernance(manifest);

  for (const agent of manifest.agents) {
    assert(typeof agent.id === "string" && agent.id.length > 0, "agent_missing_id");
    assert(typeof agent.name === "string" && agent.name.length > 0, `agent_missing_name:${agent.id}`);
    assert(typeof agent.role === "string" && agent.role.length > 0, `agent_missing_role:${agent.id}`);
    assert(["healthy", "degraded", "offline"].includes(agent.status), `agent_invalid_status:${agent.id}`);
    assert(["core", "specialist"].includes(agent.agentClass), `agent_class_invalid:${agent.id}`);
    assert(["manual", "dynamic"].includes(agent.origin), `agent_origin_invalid:${agent.id}`);
    assert(typeof agent.specializationScope === "string" && agent.specializationScope.trim().length > 0, `agent_scope_missing:${agent.id}`);
    assert(["active", "retire_candidate", "retired"].includes(agent.lifecycle), `agent_lifecycle_invalid:${agent.id}`);
    assert(agent.capabilityContract && typeof agent.capabilityContract === "object", `agent_capability_contract_missing:${agent.id}`);
    assertNonEmptyString(agent.capabilityContract.mission, `agent_capability_mission_missing:${agent.id}`);
    assertStringArray(agent.capabilityContract.entryCriteria, `agent_capability_entry_criteria_invalid:${agent.id}`);
    assertNonEmptyString(agent.capabilityContract.doneCondition, `agent_capability_done_condition_missing:${agent.id}`);
    assertNonEmptyString(agent.capabilityContract.outputSchema, `agent_capability_output_schema_missing:${agent.id}`);
    assert(agent.capabilityOptimization && typeof agent.capabilityOptimization === "object", `agent_capability_optimization_missing:${agent.id}`);
    assert(agent.capabilityOptimization.enabled === true, `agent_capability_optimization_enabled_invalid:${agent.id}`);
    assert(agent.capabilityOptimization.refreshMode === "on_run", `agent_capability_optimization_refresh_mode_invalid:${agent.id}`);
    assert(agent.capabilityOptimization.sourcePolicy === "official_first", `agent_capability_optimization_source_policy_invalid:${agent.id}`);
    assert(agent.capabilityOptimization.trialMode === "shadow", `agent_capability_optimization_trial_mode_invalid:${agent.id}`);
    assert(agent.capabilityOptimization.promotionMode === "human_approve", `agent_capability_optimization_promotion_mode_invalid:${agent.id}`);
    assert(
      Number.isFinite(Number(agent.capabilityOptimization.minShadowSampleSize))
      && Number(agent.capabilityOptimization.minShadowSampleSize) >= 3,
      `agent_capability_optimization_min_shadow_sample_size_invalid:${agent.id}`,
    );
    assert(
      Number.isFinite(Number(agent.capabilityOptimization.staleAfterHours))
      && Number(agent.capabilityOptimization.staleAfterHours) >= 1,
      `agent_capability_optimization_stale_after_hours_invalid:${agent.id}`,
    );
    assert(["keep", "merge", "retire_candidate"].includes(agent.auditDisposition), `agent_audit_disposition_invalid:${agent.id}`);
    assert(Array.isArray(agent.skills), `agent_missing_skills:${agent.id}`);
    assert(Array.isArray(agent.repositories), `agent_missing_repositories:${agent.id}`);
    assert(Array.isArray(agent.mcpServers), `agent_missing_mcp:${agent.id}`);
    assert(Array.isArray(agent.usedMcp), `agent_missing_used_mcp:${agent.id}`);
    assert(Array.isArray(agent.availableMcp), `agent_missing_available_mcp:${agent.id}`);
    assert(Array.isArray(agent.usedSkills), `agent_missing_used_skills:${agent.id}`);
    assert(Array.isArray(agent.availableSkills), `agent_missing_available_skills:${agent.id}`);
    assert(Array.isArray(agent.contextRefs), `agent_missing_context_refs:${agent.id}`);
    assert(Array.isArray(agent.taskEvents), `agent_missing_task_events:${agent.id}`);
    assert(Array.isArray(agent.analystRecommendations), `agent_missing_analyst_recommendations:${agent.id}`);
    assert(Array.isArray(agent.improvements), `agent_missing_improvements:${agent.id}`);
    assert(agent.tasks && typeof agent.tasks === "object", `agent_missing_tasks:${agent.id}`);
    assertNonEmptyString(agent.updatedAt, `agent_missing_updated_at:${agent.id}`);
    assertNonEmptyString(agent.source, `agent_missing_source:${agent.id}`);
    assertOptionalUrl(agent.trackerUrl, `agent_invalid_tracker_url:${agent.id}`);

    if (MODERN_AGENT_IDS.has(agent.id)) {
      assert(agent.operatingPlan && typeof agent.operatingPlan === "object", `agent_operating_plan_missing:${agent.id}`);
    }

    assert(agent.workflowPolicy && typeof agent.workflowPolicy === "object", `agent_workflow_policy_missing:${agent.id}`);
    assert(typeof agent.workflowPolicy.planDefault === "boolean", `agent_workflow_policy_plan_default_invalid:${agent.id}`);
    assert(typeof agent.workflowPolicy.replanOnDeviation === "boolean", `agent_workflow_policy_replan_invalid:${agent.id}`);
    assert(typeof agent.workflowPolicy.verifyBeforeDone === "boolean", `agent_workflow_policy_verify_invalid:${agent.id}`);
    assert(typeof agent.workflowPolicy.selfImprovementLoop === "boolean", `agent_workflow_policy_learn_invalid:${agent.id}`);
    assert(typeof agent.workflowPolicy.autonomousBugfix === "boolean", `agent_workflow_policy_bugfix_invalid:${agent.id}`);

    assert(agent.workflowBackbone && typeof agent.workflowBackbone === "object", `agent_workflow_backbone_missing:${agent.id}`);
    assertNonEmptyString(agent.workflowBackbone.version, `agent_workflow_backbone_version_missing:${agent.id}`);
    assert(agent.workflowBackbone.version === "universal_backbone_v1", `agent_workflow_backbone_version_invalid:${agent.id}`);
    assertExactStringArray(
      agent.workflowBackbone.commonCoreSteps,
      UNIVERSAL_BACKBONE_STEPS,
      `agent_workflow_backbone_core_steps_invalid:${agent.id}`,
    );
    assert(agent.workflowBackbone.roleWindow && typeof agent.workflowBackbone.roleWindow === "object", `agent_workflow_backbone_role_window_missing:${agent.id}`);
    assertNonEmptyString(agent.workflowBackbone.roleWindow.entryStep, `agent_workflow_backbone_role_entry_missing:${agent.id}`);
    assertNonEmptyString(agent.workflowBackbone.roleWindow.exitStep, `agent_workflow_backbone_role_exit_missing:${agent.id}`);
    assertNonEmptyString(agent.workflowBackbone.roleWindow.purpose, `agent_workflow_backbone_role_purpose_missing:${agent.id}`);
    assertStringArray(agent.workflowBackbone.roleWindow.internalSteps, `agent_workflow_backbone_role_steps_invalid:${agent.id}`);
    assert(agent.workflowBackbone.stepExecutionPolicy && typeof agent.workflowBackbone.stepExecutionPolicy === "object", `agent_workflow_backbone_step_policy_missing:${agent.id}`);
    assert(typeof agent.workflowBackbone.stepExecutionPolicy.skippedStepsAllowed === "boolean", `agent_workflow_backbone_skip_allowed_invalid:${agent.id}`);
    assert(agent.workflowBackbone.stepExecutionPolicy.skippedStepStatus === "skipped", `agent_workflow_backbone_skip_status_invalid:${agent.id}`);
    assert(typeof agent.workflowBackbone.supportsDynamicInstances === "boolean", `agent_workflow_backbone_dynamic_flag_invalid:${agent.id}`);

    const expectedRoleWindow = EXPECTED_ROLE_WINDOW_BY_AGENT[agent.id];
    if (expectedRoleWindow) {
      assertExactStringArray(
        agent.workflowBackbone.roleWindow.internalSteps,
        expectedRoleWindow.internalSteps,
        `agent_workflow_backbone_role_steps_mismatch:${agent.id}`,
      );
      assert(
        agent.workflowBackbone.roleWindow.purpose.toLowerCase().includes(expectedRoleWindow.purposeIncludes.toLowerCase()),
        `agent_workflow_backbone_role_purpose_mismatch:${agent.id}:${agent.workflowBackbone.roleWindow.purpose}`,
      );
    }

    assert(agent.learningArtifacts && typeof agent.learningArtifacts === "object", `agent_learning_artifacts_missing:${agent.id}`);
    assertNonEmptyString(agent.learningArtifacts.todoPath, `agent_learning_todo_path_missing:${agent.id}`);
    assertNonEmptyString(agent.learningArtifacts.lessonsPath, `agent_learning_lessons_path_missing:${agent.id}`);

    assert(Array.isArray(agent.workflowMetricsCatalog), `agent_workflow_metrics_catalog_missing:${agent.id}`);
    assertStringArray(agent.workflowMetricsCatalog, `agent_workflow_metrics_catalog_invalid:${agent.id}`);

    assert(agent.doneGatePolicy && typeof agent.doneGatePolicy === "object", `agent_done_gate_policy_missing:${agent.id}`);
    assert(["soft_warning", "strict"].includes(agent.doneGatePolicy.mode), `agent_done_gate_mode_invalid:${agent.id}`);
    assertStringArray(agent.doneGatePolicy.requiredChecks, `agent_done_gate_required_checks_invalid:${agent.id}`);
    assert(
      ["backlog", "ready", "in_progress", "ab_test", "in_review", "done"].includes(agent.doneGatePolicy.fallbackStatus),
      `agent_done_gate_fallback_status_invalid:${agent.id}`,
    );

    const queued = asNumber(agent.tasks.queued);
    const running = asNumber(agent.tasks.running);
    const retrying = asNumber(agent.tasks.retrying);
    const waitingReview = asNumber(agent.tasks.waiting_review);
    const blocked = asNumber(agent.tasks.blocked);
    const waitingExternal = asNumber(agent.tasks.waiting_external);
    const inWork = asNumber(agent.tasks.in_work);
    const onControl = asNumber(agent.tasks.on_control);

    assert(!Number.isNaN(queued), `agent_task_invalid_queued:${agent.id}`);
    assert(!Number.isNaN(running), `agent_task_invalid_running:${agent.id}`);
    assert(!Number.isNaN(retrying), `agent_task_invalid_retrying:${agent.id}`);
    assert(!Number.isNaN(waitingReview), `agent_task_invalid_waiting_review:${agent.id}`);
    assert(!Number.isNaN(blocked), `agent_task_invalid_blocked:${agent.id}`);
    assert(!Number.isNaN(waitingExternal), `agent_task_invalid_waiting_external:${agent.id}`);
    assert(!Number.isNaN(inWork), `agent_task_invalid_in_work:${agent.id}`);
    assert(!Number.isNaN(onControl), `agent_task_invalid_on_control:${agent.id}`);

    assert(
      inWork === queued + running + retrying,
      `agent_task_formula_in_work_failed:${agent.id}:${inWork}:${queued}+${running}+${retrying}`,
    );
    assert(
      onControl === waitingReview + blocked + waitingExternal,
      `agent_task_formula_on_control_failed:${agent.id}:${onControl}:${waitingReview}+${blocked}+${waitingExternal}`,
    );

    for (const [index, repo] of agent.repositories.entries()) {
      assertNonEmptyString(repo?.name, `agent_repository_missing_name:${agent.id}:${index}`);
      assertOptionalUrl(repo?.url, `agent_repository_invalid_url:${agent.id}:${index}`);
    }

    for (const [index, server] of agent.mcpServers.entries()) {
      assertNonEmptyString(server?.name, `agent_mcp_server_missing_name:${agent.id}:${index}`);
      assert(["online", "degraded", "offline"].includes(server?.status), `agent_mcp_server_invalid_status:${agent.id}:${index}`);
    }

    for (const [index, used] of agent.usedMcp.entries()) {
      assertNonEmptyString(used?.name, `agent_used_mcp_missing_name:${agent.id}:${index}`);
      assert(["active", "reauth_required", "degraded", "offline"].includes(used?.status), `agent_used_mcp_invalid_status:${agent.id}:${index}`);
      assertNonEmptyString(used?.note, `agent_used_mcp_missing_note:${agent.id}:${index}`);
      assertNonEmptyString(used?.impactInNumbers, `agent_used_mcp_missing_impact:${agent.id}:${index}`);
      assertStringArray(used?.practicalTasks, `agent_used_mcp_missing_practical_tasks:${agent.id}:${index}`);
    }

    for (const [index, available] of agent.availableMcp.entries()) {
      assertNonEmptyString(available?.name, `agent_available_mcp_missing_name:${agent.id}:${index}`);
      assertNonEmptyString(available?.description, `agent_available_mcp_missing_description:${agent.id}:${index}`);
      assertNonEmptyString(available?.whenToUse, `agent_available_mcp_missing_when_to_use:${agent.id}:${index}`);
      assertNonEmptyString(available?.expectedEffect, `agent_available_mcp_missing_expected_effect:${agent.id}:${index}`);
      assertNonEmptyString(available?.basis, `agent_available_mcp_missing_basis:${agent.id}:${index}`);
      assertStringArray(available?.practicalTasks, `agent_available_mcp_missing_practical_tasks:${agent.id}:${index}`);
      assertNonEmptyString(available?.installComplexity, `agent_available_mcp_missing_install_complexity:${agent.id}:${index}`);
      assertOptionalUrl(available?.link, `agent_available_mcp_invalid_link:${agent.id}:${index}`);
    }

    for (const [index, usedSkill] of agent.usedSkills.entries()) {
      assertNonEmptyString(usedSkill?.name, `agent_used_skill_missing_name:${agent.id}:${index}`);
      assertNonEmptyString(usedSkill?.usage, `agent_used_skill_missing_usage:${agent.id}:${index}`);
      assertNonEmptyString(usedSkill?.fullText, `agent_used_skill_missing_full_text:${agent.id}:${index}`);
      assertStringArray(usedSkill?.practicalTasks, `agent_used_skill_missing_practical_tasks:${agent.id}:${index}`);
    }

    for (const [index, availableSkill] of agent.availableSkills.entries()) {
      assertNonEmptyString(availableSkill?.name, `agent_available_skill_missing_name:${agent.id}:${index}`);
      assertNonEmptyString(availableSkill?.benefit, `agent_available_skill_missing_benefit:${agent.id}:${index}`);
      assertNonEmptyString(availableSkill?.recommendationBasis, `agent_available_skill_missing_basis:${agent.id}:${index}`);
      assertNonEmptyString(availableSkill?.expectedEffect, `agent_available_skill_missing_expected_effect:${agent.id}:${index}`);
      assertNonEmptyString(availableSkill?.fullText, `agent_available_skill_missing_full_text:${agent.id}:${index}`);
      assertStringArray(availableSkill?.practicalTasks, `agent_available_skill_missing_practical_tasks:${agent.id}:${index}`);
      assertOptionalUrl(availableSkill?.link, `agent_available_skill_invalid_link:${agent.id}:${index}`);
    }

    for (const [index, ref] of agent.contextRefs.entries()) {
      assertNonEmptyString(ref?.title, `agent_context_ref_missing_title:${agent.id}:${index}`);
      assertNonEmptyString(ref?.filePath, `agent_context_ref_missing_file_path:${agent.id}:${index}`);
      await assertFileExists(ref?.filePath, `agent_context_ref_missing_file:${agent.id}:${index}`);
      assertOptionalUrl(ref?.sourceUrl, `agent_context_ref_invalid_source_url:${agent.id}:${index}`);
    }

    if (agent.memoryContext !== undefined && agent.memoryContext !== null) {
      const memoryContext = agent.memoryContext;
      assert(memoryContext && typeof memoryContext === "object", `agent_memory_context_invalid:${agent.id}`);

      assert(memoryContext.currentTask && typeof memoryContext.currentTask === "object", `agent_memory_current_task_missing:${agent.id}`);
      assertNonEmptyString(memoryContext.currentTask.task_id, `agent_memory_task_id_missing:${agent.id}`);
      assertNonEmptyString(memoryContext.currentTask.goal, `agent_memory_goal_missing:${agent.id}`);
      assertNonEmptyString(memoryContext.currentTask.task_type, `agent_memory_task_type_missing:${agent.id}`);
      assertOptionalNumber(memoryContext.currentTask.context_sla_seconds, `agent_memory_context_sla_invalid:${agent.id}`);

      assert(Array.isArray(memoryContext.contextAnchors), `agent_memory_context_anchors_missing:${agent.id}`);
      for (const [index, anchor] of memoryContext.contextAnchors.entries()) {
        assertNonEmptyString(anchor?.anchor_id, `agent_memory_anchor_id_missing:${agent.id}:${index}`);
        assert(["spec", "contract", "governance", "runbook", "unknown"].includes(anchor?.category), `agent_memory_anchor_category_invalid:${agent.id}:${index}`);
        assertNonEmptyString(anchor?.title, `agent_memory_anchor_title_missing:${agent.id}:${index}`);
        assertNonEmptyString(anchor?.filePath, `agent_memory_anchor_file_path_missing:${agent.id}:${index}`);
        await assertFileExists(anchor?.filePath, `agent_memory_anchor_missing_file:${agent.id}:${index}`);
        assertNonEmptyString(anchor?.whySelected, `agent_memory_anchor_why_selected_missing:${agent.id}:${index}`);
        assertOptionalNumber(anchor?.tokens_est, `agent_memory_anchor_tokens_invalid:${agent.id}:${index}`);
        assert(["fresh", "stale", "unknown"].includes(anchor?.freshness), `agent_memory_anchor_freshness_invalid:${agent.id}:${index}`);
        assertOptionalUrl(anchor?.sourceUrl, `agent_memory_anchor_source_url_invalid:${agent.id}:${index}`);
      }

      assert(Array.isArray(memoryContext.persistentRules), `agent_memory_persistent_rules_missing:${agent.id}`);
      for (const [index, rule] of memoryContext.persistentRules.entries()) {
        assert(typeof rule?.mandatory === "boolean", `agent_memory_persistent_rule_mandatory_invalid:${agent.id}:${index}`);
        assertNonEmptyString(rule?.title, `agent_memory_persistent_rule_title_missing:${agent.id}:${index}`);
        assertNonEmptyString(rule?.location, `agent_memory_persistent_rule_location_missing:${agent.id}:${index}`);
        await assertFileExists(rule?.location, `agent_memory_persistent_rule_missing_file:${agent.id}:${index}`);
        assertNonEmptyString(rule?.description, `agent_memory_persistent_rule_description_missing:${agent.id}:${index}`);
        assertOptionalUrl(rule?.sourceUrl, `agent_memory_persistent_rule_source_url_invalid:${agent.id}:${index}`);
      }

      assert(memoryContext.retrieval && typeof memoryContext.retrieval === "object", `agent_memory_retrieval_missing:${agent.id}`);
      assertNonEmptyString(memoryContext.retrieval.mode, `agent_memory_retrieval_mode_missing:${agent.id}`);
      assertNonEmptyString(memoryContext.retrieval.tool, `agent_memory_retrieval_tool_missing:${agent.id}`);
      assertOptionalNumber(memoryContext.retrieval.top_k, `agent_memory_retrieval_top_k_invalid:${agent.id}`);
      assertOptionalNumber(memoryContext.retrieval.latency_ms, `agent_memory_retrieval_latency_invalid:${agent.id}`);
      assert(Array.isArray(memoryContext.retrieval.qualitySignals), `agent_memory_retrieval_quality_signals_missing:${agent.id}`);
      for (const [index, signal] of memoryContext.retrieval.qualitySignals.entries()) {
        assertOptionalNumber(signal?.score, `agent_memory_quality_signal_score_invalid:${agent.id}:${index}`);
        assertStringArray(signal?.line_refs, `agent_memory_quality_signal_line_refs_missing:${agent.id}:${index}`);
        assertOptionalNumber(signal?.coverage, `agent_memory_quality_signal_coverage_invalid:${agent.id}:${index}`);
      }

      assert(memoryContext.decisionUsage && typeof memoryContext.decisionUsage === "object", `agent_memory_decision_usage_missing:${agent.id}`);
      assert(Array.isArray(memoryContext.decisionUsage.decisionLinks), `agent_memory_decision_links_missing:${agent.id}`);
      for (const [index, link] of memoryContext.decisionUsage.decisionLinks.entries()) {
        assertNonEmptyString(link?.anchor_id, `agent_memory_decision_link_anchor_missing:${agent.id}:${index}`);
        assert(typeof link?.usedInDecision === "boolean", `agent_memory_decision_link_used_invalid:${agent.id}:${index}`);
        assertStringArray(link?.taskEventIds, `agent_memory_decision_link_task_event_ids_missing:${agent.id}:${index}`);
        assertStringArray(link?.reviewErrorIds, `agent_memory_decision_link_review_error_ids_missing:${agent.id}:${index}`);
        assertStringArray(link?.improvementIds, `agent_memory_decision_link_improvement_ids_missing:${agent.id}:${index}`);
      }

      assert(memoryContext.economics && typeof memoryContext.economics === "object", `agent_memory_economics_missing:${agent.id}`);
      assertOptionalNumber(memoryContext.economics.total_context_tokens, `agent_memory_economics_total_invalid:${agent.id}`);
      assertOptionalNumber(memoryContext.economics.useful_context_tokens, `agent_memory_economics_useful_invalid:${agent.id}`);
      assertOptionalNumber(memoryContext.economics.context_efficiency, `agent_memory_economics_efficiency_invalid:${agent.id}`);
      assertOptionalNumber(memoryContext.economics.tokens_per_task, `agent_memory_economics_tokens_per_task_invalid:${agent.id}`);
      assertOptionalNumber(memoryContext.economics.cached_tokens, `agent_memory_economics_cached_tokens_invalid:${agent.id}`);
      assertOptionalNumber(memoryContext.economics.cache_hit_rate, `agent_memory_economics_cache_hit_rate_invalid:${agent.id}`);

      assert(memoryContext.riskControl && typeof memoryContext.riskControl === "object", `agent_memory_risk_control_missing:${agent.id}`);
      assert(Array.isArray(memoryContext.riskControl.riskFlags), `agent_memory_risk_flags_missing:${agent.id}`);
      for (const [index, flag] of memoryContext.riskControl.riskFlags.entries()) {
        assert(["injection_risk", "missing_evidence", "stale_anchor", "tool_overreach"].includes(flag), `agent_memory_risk_flag_invalid:${agent.id}:${index}`);
      }
      assert(memoryContext.riskControl.toolPolicy && typeof memoryContext.riskControl.toolPolicy === "object", `agent_memory_tool_policy_missing:${agent.id}`);
      assertNonEmptyString(memoryContext.riskControl.toolPolicy.profile, `agent_memory_tool_policy_profile_missing:${agent.id}`);
      assertStringArray(memoryContext.riskControl.toolPolicy.allow, `agent_memory_tool_policy_allow_missing:${agent.id}`);
      assertStringArray(memoryContext.riskControl.toolPolicy.deny, `agent_memory_tool_policy_deny_missing:${agent.id}`);
      assertNonEmptyString(memoryContext.riskControl.toolPolicy.approval_mode, `agent_memory_tool_policy_approval_mode_missing:${agent.id}`);

      assert(Array.isArray(memoryContext.nextActions), `agent_memory_next_actions_missing:${agent.id}`);
      for (const [index, action] of memoryContext.nextActions.entries()) {
        assertNonEmptyString(action?.title, `agent_memory_next_action_title_missing:${agent.id}:${index}`);
        assertNonEmptyString(action?.owner, `agent_memory_next_action_owner_missing:${agent.id}:${index}`);
        assertNonEmptyString(action?.due_date, `agent_memory_next_action_due_date_missing:${agent.id}:${index}`);
        assertNonEmptyString(action?.expected_effect, `agent_memory_next_action_expected_effect_missing:${agent.id}:${index}`);
      }
    }

    for (const [index, event] of agent.taskEvents.entries()) {
      assertNonEmptyString(event?.id, `agent_task_event_missing_id:${agent.id}:${index}`);
      assertNonEmptyString(event?.title, `agent_task_event_missing_title:${agent.id}:${index}`);
      assertNonEmptyString(event?.completedAt, `agent_task_event_missing_completed_at:${agent.id}:${index}`);
      assert(!Number.isNaN(asNumber(event?.reviewErrors)), `agent_task_event_invalid_review_errors:${agent.id}:${index}`);
    }

    for (const [index, rec] of agent.analystRecommendations.entries()) {
      assertNonEmptyString(rec, `agent_analyst_recommendation_empty:${agent.id}:${index}`);
    }

    for (const [index, improvement] of agent.improvements.entries()) {
      assertNonEmptyString(improvement?.title, `agent_improvement_missing_title:${agent.id}:${index}`);
      assertNonEmptyString(improvement?.problem, `agent_improvement_missing_problem:${agent.id}:${index}`);
      assertNonEmptyString(improvement?.solution, `agent_improvement_missing_solution:${agent.id}:${index}`);
      assertNonEmptyString(improvement?.effect, `agent_improvement_missing_effect:${agent.id}:${index}`);
      assertNonEmptyString(improvement?.priority, `agent_improvement_missing_priority:${agent.id}:${index}`);
    }
  }

  process.stdout.write(`[ops-web] agents manifest check passed: agents=${manifest.agents.length}\n`);
}

main().catch((error) => {
  process.stderr.write(`[ops-web] agents manifest check failed: ${String(error)}\n`);
  process.exit(1);
});
