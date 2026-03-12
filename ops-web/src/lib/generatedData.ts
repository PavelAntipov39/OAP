import c4Manifest from "../generated/c4-manifest.json";
import bpmnManifest from "../generated/bpmn-manifest.json";
import docsIndex from "../generated/docs-index.json";
import searchIndex from "../generated/search-index.json";
import agentsManifest from "../generated/agents-manifest.json";
import oapKbIndex from "../generated/oap-kb-index.json";
import oapKbSearchIndex from "../generated/oap-kb-search-index.json";
import oapKbRawLogs from "../generated/oap-kb-raw-logs.json";
import analystLatestCycle from "../generated/agent-latest-cycle-analyst.json";
import agentBenchmarkSummary from "../generated/agent-benchmark-summary.json";
import agentTelemetrySummary from "../generated/agent-telemetry-summary.json";
import hostAgentSmokeReport from "../generated/host-agent-smoke.json";
import agentImprovementHistory from "../generated/agent-improvement-history.json";

export type C4View = {
  id: string;
  title: string;
  description: string;
  pngPath: string;
  pngAvailable: boolean;
  playgroundUrl: string;
};

export type C4Manifest = {
  dslSourcePath: string;
  dsl: string;
  validatedAt: string | null;
  exportedAt: string | null;
  exportError: string | null;
  views: C4View[];
};

export type BpmnDiagram = {
  id: string;
  title: string;
  processName: string | null;
  processId: string | null;
  filePath: string;
  sourcePath: string;
  sourceUrl: string | null;
  updatedAt: string;
};

export type DocsDocument = {
  id: string;
  title: string;
  path: string;
  sourceUrl: string | null;
  section: string;
  headings: string[];
  updatedAt: string;
  content: string;
};

export type SearchDoc = {
  id: string;
  title: string;
  path: string;
  section: string;
  headings: string[];
  searchText: string;
};

export type SearchIndex = {
  updatedAt: string;
  documents: SearchDoc[];
};

export type AgentTaskStatus = "backlog" | "ready" | "in_progress" | "ab_test" | "waiting_human" | "in_review" | "done" | "completed";

export type AgentTaskPriority = "low" | "medium" | "high";

export type AgentTaskOriginType = "improvement" | "recommendation" | "telemetry";

export type AgentTaskReadinessState = "ready" | "needs_clarification";

export type AgentTaskReadinessManualState = "approved" | "needs_clarification" | "not_set";

export type AgentTaskBriefContextPackage = {
  relevant_anchors: unknown[];
  mandatory_rules: unknown[];
  operational_memory?: AgentTaskOperationalMemoryItem[];
  collaboration_plan?: AgentTaskCollaborationPlan;
  ab_test_plan?: AgentTaskAbTestPlan;
};

export type AgentTaskOperationalMemoryItem = {
  key: string;
  title: string;
  value: string;
  source_ref: string | null;
  updated_at: string | null;
};

export type AgentTaskCollaborationStrategy = "reuse_existing" | "create_new" | "mixed";

export type AgentTaskCollaborationReuseCandidate = {
  profile_id: string;
  name: string;
  score: number;
  decision: string;
  rationale: string;
};

export type AgentTaskCollaborationCreatedProfile = {
  id: string;
  name: string;
  created_by_agent_id: string | null;
  parent_template_id: string | null;
  derived_from_agent_id: string | null;
  specialization_scope: string;
  lifecycle: string;
  creation_reason: string | null;
  capability_contract: Record<string, unknown> | null;
};

export type AgentTaskCollaborationSpawnedInstance = {
  instance_id: string;
  profile_id: string;
  parent_instance_id: string | null;
  root_agent_id: string;
  task_id: string;
  purpose: string;
  depth: number;
  allowed_skills: string[];
  allowed_tools: string[];
  allowed_mcp: string[];
  applied_rules: string[];
  input_refs: string[];
  output_refs: string[];
  status: string;
  verify_status: string;
  phase_id?: string | null;
  execution_mode?: string | null;
  execution_backend?: string | null;
  context_window_id?: string | null;
  isolation_mode?: string | null;
  read_only?: boolean;
  ownership_scope?: string[];
  depends_on?: string[];
  merge_target?: string | null;
};

export type AgentTaskCollaborationPhase = {
  phase_id: string;
  label: string;
  mode: string;
  goal: string;
  participants: string[];
  depends_on: string[];
  outputs?: string[];
  status: string;
  merge_into?: string | null;
};

export type AgentTaskCollaborationHostPolicy = {
  display_name: string;
  execution_backend: string;
  native_delegation: boolean;
  isolated_context_windows: boolean;
  dispatcher_required: boolean;
  fallback_mode: string;
  adapter_strategy: string;
};

export type AgentTaskCollaborationHostExecutionStrategy = {
  default_host_id: string;
  selected_backend_by_default: string;
  context_isolation_policy: string;
  host_policies: Record<string, AgentTaskCollaborationHostPolicy>;
};

export type AgentTaskRoundtablePolicy = {
  enabled: boolean;
  moderated_by: string | null;
  max_rounds: number;
  transcript_visibility: string;
  allow_free_chat: boolean;
  allow_position_sharing: boolean;
  summary_required_each_round: boolean;
};

export type AgentTaskDiscussionRound = {
  round_id: string;
  round_index: number;
  participants: string[];
  summary: string;
  status: string;
  next_owner_agent_id?: string | null;
};

export type AgentTaskCollaborationBudget = {
  max_instances: number;
  max_tokens: number;
  max_wall_clock_minutes: number;
  max_no_progress_hops: number;
};

export type AgentTaskCollaborationPlan = {
  analysis_required: boolean;
  suggested_agents: string[];
  selected_agents: string[];
  rationale: string;
  reviewed_at: string | null;
  strategy?: AgentTaskCollaborationStrategy;
  reuse_candidates?: AgentTaskCollaborationReuseCandidate[];
  created_profiles?: AgentTaskCollaborationCreatedProfile[];
  primary_coordinator_agent_id?: string | null;
  final_synthesizer_agent_id?: string | null;
  merge_owner_agent_id?: string | null;
  interaction_mode?: string | null;
  interaction_phases?: AgentTaskCollaborationPhase[];
  selection_basis?: string[];
  merge_strategy?: string | null;
  conflict_policy?: string | null;
  host_execution_strategy?: AgentTaskCollaborationHostExecutionStrategy | null;
  context_isolation_policy?: string | null;
  roundtable_policy?: AgentTaskRoundtablePolicy | null;
  discussion_rounds?: AgentTaskDiscussionRound[];
  spawned_instances?: AgentTaskCollaborationSpawnedInstance[];
  orchestration_budget?: AgentTaskCollaborationBudget;
  delegation_depth?: number;
};

export type AgentTaskAbTestPlan = {
  enabled: boolean;
  sessions_required: number;
  pass_rule: string;
  target_metric: string;
  expected_delta_pct: number | null;
  guardrails: string[];
  rollback_on_fail: boolean;
};

export type AgentTaskContextToTask = {
  summary: string;
  why_now: string | null;
  execution_notes: string[];
  source_snapshot: Record<string, unknown> | null;
};

export type AgentTaskLinkedElement = {
  type: string;
  id: string | null;
  title: string;
  ref: string | null;
  source_agent_id: string | null;
  source_url: string | null;
  open_mode: string | null;
  importance: string | null;
};

export type AgentTaskLinkedImprovement = {
  id: string;
  source_agent_id: string | null;
  title: string;
  problem: string;
  solution: string;
  effect: string;
  ownerSection: string | null;
  targetMetric: string | null;
  baselineWindow: string | null;
  expectedDelta: string | null;
  validationDate: string | null;
  detectionBasis: string | null;
  promptPath: string | null;
  promptTitle: string | null;
  promptMarkdown: string | null;
  promptSourceUrl: string | null;
  link_mode: string | null;
  similarity_score: number | null;
  ice: {
    impact: number | null;
    confidence: number | null;
    ease: number | null;
    score: number | null;
  };
};

export type AgentTaskOriginContext = {
  source?: string | null;
  recommendation_id?: string | null;
  recommendation_text?: string | null;
  link_mode?: string | null;
  linked_improvement_id?: string | null;
  similarity_score?: number | null;
  origin_cycle_id?: string | null;
  linked_improvement_snapshot?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type AgentTaskBrief = {
  goal: string;
  expected_outcome: string;
  acceptance_criteria: string[];
  constraints: string[];
  dependencies: string[];
  target_artifacts: string[];
  priority_reason: string;
  context_package: AgentTaskBriefContextPackage;
  context_to_task?: AgentTaskContextToTask;
  linked_elements?: AgentTaskLinkedElement[];
  origin_context?: AgentTaskOriginContext;
};

export type AgentTaskRow = {
  id: string;
  external_key: string;
  title: string;
  source_agent_id: string;
  executor_agent_id: string;
  status: AgentTaskStatus;
  priority: AgentTaskPriority;
  origin_type: AgentTaskOriginType;
  origin_type_label_ru: string;
  origin_ref: string | null;
  evidence_refs: unknown[];
  task_brief: AgentTaskBrief;
  readiness_auto_score: number;
  readiness_auto_state: AgentTaskReadinessState;
  readiness_manual_state: AgentTaskReadinessManualState;
  readiness_final_state: AgentTaskReadinessState;
  created_at: string;
  updated_at: string;
  last_event_at: string | null;
  last_event_type: string | null;
  last_event_actor: string | null;
  last_event_time: string | null;
};

export type AgentTaskTimelineEvent = {
  id: string;
  actor_agent_id: string;
  event_time: string | null;
  event_type: string;
  status_from: string | null;
  status_to: string | null;
  payload: Record<string, unknown>;
  step_key: string | null;
  step_label: string | null;
  step_raw: string | null;
};

export type AgentTaskUsageItem = {
  name: string;
  events: number;
  tasks: number;
};

export type AgentTaskImplementationUsage = {
  source: string;
  mcp_in_task: AgentTaskUsageItem[];
  skills_in_task: AgentTaskUsageItem[];
  mcp_frequency_across_tasks: AgentTaskUsageItem[];
  skills_frequency_across_tasks: AgentTaskUsageItem[];
};

export type AgentTaskDetails = {
  task: {
    id: string;
    external_key: string;
    title: string;
    status: AgentTaskStatus;
    priority: AgentTaskPriority;
    source_agent_id: string;
    executor_agent_id: string;
    created_at: string;
    updated_at: string;
    last_event_at: string | null;
  };
  what_to_do: {
    goal: string;
    expected_outcome: string;
    acceptance_criteria: string[];
    constraints: string[];
    dependencies: string[];
    target_artifacts: string[];
    priority_reason: string;
    context_to_task: AgentTaskContextToTask;
  };
  origin: {
    origin_type: AgentTaskOriginType;
    origin_type_label_ru: string;
    origin_ref: string | null;
    source_agent_id: string;
    linked_improvement: AgentTaskLinkedImprovement | null;
  };
  context_and_evidence: {
    evidence_refs: string[];
    context_package: AgentTaskBriefContextPackage;
    linked_elements: AgentTaskLinkedElement[];
    related_logs: AgentTaskTimelineEvent[];
  };
  implementation_usage: AgentTaskImplementationUsage;
  readiness: {
    readiness_auto_score: number;
    readiness_auto_state: AgentTaskReadinessState;
    readiness_manual_state: AgentTaskReadinessManualState;
    readiness_final_state: AgentTaskReadinessState;
    checks: Record<string, boolean>;
    manual_actor: string | null;
    manual_event_time: string | null;
  };
  timeline: AgentTaskTimelineEvent[];
};

export type AgentTaskStatusCount = {
  status: AgentTaskStatus;
  total: number;
};

export type AgentTaskBoardConfig = {
  source: string;
  statusFlow: AgentTaskStatus[];
  fields: string[];
  filters: string[];
  notes?: string | null;
};

export type OapKbSection =
  | "service"
  | "policies"
  | "registry_contracts"
  | "telemetry_reports"
  | "raw_logs"
  | string;

export type OapKbDocument = {
  id: string;
  title: string;
  path: string;
  sourceUrl: string | null;
  section: OapKbSection;
  headings: string[];
  updatedAt: string;
  content: string;
};

export type OapKbSearchDoc = {
  id: string;
  title: string;
  path: string;
  section: OapKbSection;
  headings: string[];
  searchText: string;
};

export type OapKbSearchIndex = {
  updatedAt: string;
  documents: OapKbSearchDoc[];
};

export type AgentTaskCounters = {
  queued: number;
  running: number;
  retrying: number;
  waiting_review: number;
  blocked: number;
  waiting_external: number;
  overdue: number;
  in_work: number;
  on_control: number;
};

export type AgentMcpServer = {
  name: string;
  status: "online" | "degraded" | "offline";
};

export type AgentRepository = {
  name: string;
  url: string;
  branch: string | null;
};

export type AgentCapabilityDecisionGuidance = {
  purpose?: string | null;
  useWhen?: string | null;
  avoidWhen?: string | null;
  requiredContext?: string[];
  expectedOutput?: string | null;
  failureModes?: string[];
  fallbackTo?: string[];
  examples?: string[];
};

export type AgentCapabilityQualitySignals = {
  reviewStatus?: "draft" | "approved" | "stale" | null;
  lastReviewedAt?: string | null;
  descriptionCompletenessScore?: number | null;
  verifyPassAfterUseRate?: number | null;
  fallbackAfterUseRate?: number | null;
  improvementHint?: string | null;
  recommendation?: "rewrite_current" | "trial_alternative" | "keep_current" | "replace_after_trial" | null;
};

export type AgentSkillSourceRegistryEntry = {
  id: string;
  title: string;
  url: string | null;
  trust: "official" | "curated" | "rejected" | "discovery_only";
  kind: "catalog_index" | "official_docs" | "official_repo" | "curated_repo";
  description: string;
  usagePolicy: string;
};

export type AgentExternalSkillTrialMetrics = {
  taskSuccessRate?: number | null;
  verificationPassRate?: number | null;
  timeToSolutionDeltaPct?: number | null;
  tokenCostDeltaPct?: number | null;
  fallbackRate?: number | null;
  humanCorrectionRate?: number | null;
};

export type AgentExternalSkillCandidate = {
  id: string;
  name: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string | null;
  trust: "official" | "curated" | "rejected" | "discovery_only";
  summary: string;
  targetSkills: string[];
  expectedEffect?: string | null;
  decisionGuidance: AgentCapabilityDecisionGuidance;
  qualitySignals: AgentCapabilityQualitySignals;
  trialStatus: "not_started" | "scheduled" | "running" | "passed" | "failed";
  promotionStatus: "human_review_required" | "approved" | "watchlist" | "rejected";
  recommendation: "rewrite_current" | "trial_alternative" | "keep_current" | "replace_after_trial";
  recommendationReason?: string | null;
  trialMetrics?: AgentExternalSkillTrialMetrics | null;
};

export type AgentSkillShadowTrialArtifactTrial = {
  trialId: string;
  candidateId: string;
  candidateName: string;
  sourceTitle: string;
  sourceUrl?: string | null;
  sourceTrust: string;
  baselineSkillName?: string | null;
  baselineSkillState?: string | null;
  baselineContractScore?: number | null;
  baselineReviewStatus?: string | null;
  candidateRecommendation?: string | null;
  candidatePromotionStatus?: string | null;
  candidateTrialStatus?: string | null;
  representativeTasks: string[];
  eligible: boolean;
  blockReasons: string[];
};

export type AgentSkillShadowTrialArtifactComparison = {
  metric: string;
  status: string;
  baseline?: number | null;
  shadow?: number | null;
  deltaPp?: number | null;
  deltaPct?: number | null;
};

export type AgentSkillShadowTrialArtifactJudgement = {
  trialId: string;
  candidateId: string;
  recommendation?: string | null;
  humanApprovalRequired: boolean;
  blockers: string[];
  comparisons: AgentSkillShadowTrialArtifactComparison[];
};

export type AgentSkillShadowTrialArtifacts = {
  planPath?: string | null;
  judgementPath?: string | null;
  planGeneratedAt?: string | null;
  judgementGeneratedAt?: string | null;
  trials: AgentSkillShadowTrialArtifactTrial[];
  judgements: AgentSkillShadowTrialArtifactJudgement[];
};

export type AgentCapabilityOptimizationPolicy = {
  enabled: boolean;
  refreshMode: "on_run";
  sourcePolicy: "official_first";
  trialMode: "shadow";
  promotionMode: "human_approve";
  minShadowSampleSize: number;
  staleAfterHours: number;
};

export type AgentCapabilitySnapshotRow = {
  key: string;
  type: "rule" | "tool" | "skill" | "mcp";
  name: string;
  stateLabel: string;
  sourceLabel: string;
  sourceUrl: string | null;
  trustLabel: string;
  decisionGuidance: AgentCapabilityDecisionGuidance | null;
  qualitySignals: AgentCapabilityQualitySignals | null;
  bestCandidate?: AgentExternalSkillCandidate | null;
  planTrial?: AgentSkillShadowTrialArtifactTrial | null;
  judgement?: AgentSkillShadowTrialArtifactJudgement | null;
  decisionStatus: "rewrite_current" | "trial_alternative" | "keep_current" | "replace_after_trial";
  decisionReason?: string | null;
  decisionBlockedByStale: boolean;
  decisionBlockReason?: string | null;
};

export type AgentCapabilitySnapshot = {
  version: string;
  agentId: string;
  lastRefreshedAt: string | null;
  lastRunId: string | null;
  refreshMode: "on_run";
  freshnessStatus: "fresh" | "stale" | "missing";
  staleReason: string | null;
  staleAfterHours: number;
  sourceFingerprint: string | null;
  planArtifactPath: string | null;
  judgementArtifactPath: string | null;
  snapshotArtifactPath: string | null;
  tableRows: AgentCapabilitySnapshotRow[];
  summary: {
    rowsTotal: number;
    externalCandidatesTotal: number;
    judgedTotal: number;
    blockedByPolicyTotal: number;
    eligibleTrialsTotal: number;
  };
  staleBeforeRefresh?: boolean | null;
  staleBeforeRefreshReason?: string | null;
};

export type AgentUsedSkill = {
  name: string;
  usage: string | null;
  fullText: string;
  practicalTasks: string[];
  lastUsedAt?: string | null;
  skillFilePath?: string | null;
  skillFileText?: string | null;
  skillFileLoaded?: boolean | null;
  decisionGuidance?: AgentCapabilityDecisionGuidance | null;
  qualitySignals?: AgentCapabilityQualitySignals | null;
};

export type AgentAvailableSkill = {
  name: string;
  benefit: string | null;
  recommendationBasis: string | null;
  expectedEffect: string | null;
  fullText: string | null;
  practicalTasks: string[];
  link: string | null;
  decisionGuidance?: AgentCapabilityDecisionGuidance | null;
  qualitySignals?: AgentCapabilityQualitySignals | null;
};

export type AgentUsedTool = {
  name: string;
  usage: string;
  fullText: string;
  source: string;
  practicalTasks: string[];
  lastUsedAt?: string | null;
  decisionGuidance?: AgentCapabilityDecisionGuidance | null;
  qualitySignals?: AgentCapabilityQualitySignals | null;
};

export type AgentAvailableTool = {
  name: string;
  benefit: string;
  recommendationBasis: string;
  expectedEffect: string;
  fullText: string;
  source: string;
  practicalTasks: string[];
  decisionGuidance?: AgentCapabilityDecisionGuidance | null;
  qualitySignals?: AgentCapabilityQualitySignals | null;
};

export type AgentUsedMcp = {
  name: string;
  status: "active" | "reauth_required" | "degraded" | "offline";
  note: string;
  impactInNumbers: string;
  practicalTasks: string[];
  lastUsedAt?: string | null;
  decisionGuidance?: AgentCapabilityDecisionGuidance | null;
  qualitySignals?: AgentCapabilityQualitySignals | null;
};

export type AgentAvailableMcp = {
  name: string;
  whyUseful?: string | null;
  description: string;
  whenToUse: string;
  expectedEffect: string;
  basis: string;
  practicalTasks: string[];
  link: string | null;
  installComplexity: string;
  decisionGuidance?: AgentCapabilityDecisionGuidance | null;
  qualitySignals?: AgentCapabilityQualitySignals | null;
};

export type AgentContextRef = {
  title: string;
  filePath: string;
  pathHint?: string | null;
  sourceUrl?: string | null;
};

export type AgentMemoryCurrentTask = {
  task_id: string;
  goal: string;
  task_type: string;
  context_sla_seconds: number;
};

export type AgentMemoryContextAnchor = {
  anchor_id: string;
  category: "spec" | "contract" | "governance" | "runbook" | "unknown";
  title: string;
  filePath: string;
  pathHint: string | null;
  whySelected: string;
  tokens_est: number;
  sourceUrl: string | null;
  freshness: "fresh" | "stale" | "unknown";
};

export type AgentMemoryPersistentRule = {
  mandatory: boolean;
  title: string;
  location: string;
  description: string;
  sourceUrl: string | null;
};

export type AgentMemoryQualitySignal = {
  score: number | null;
  line_refs: string[];
  coverage: number | null;
};

export type AgentMemoryRetrieval = {
  mode: string;
  tool: string;
  top_k: number;
  latency_ms: number | null;
  qualitySignals: AgentMemoryQualitySignal[];
};

export type AgentMemoryDecisionLink = {
  anchor_id: string;
  usedInDecision: boolean;
  taskEventIds: string[];
  reviewErrorIds: string[];
  improvementIds: string[];
};

export type AgentMemoryDecisionUsage = {
  decisionLinks: AgentMemoryDecisionLink[];
};

export type AgentMemoryEconomics = {
  total_context_tokens: number;
  useful_context_tokens: number;
  context_efficiency: number | null;
  tokens_per_task: number | null;
  cached_tokens: number | null;
  cache_hit_rate: number | null;
};

export type AgentMemoryToolPolicy = {
  profile: string;
  allow: string[];
  deny: string[];
  approval_mode: string;
};

export type AgentMemoryRiskControl = {
  riskFlags: Array<"injection_risk" | "missing_evidence" | "stale_anchor" | "tool_overreach">;
  toolPolicy: AgentMemoryToolPolicy;
};

export type AgentMemoryNextAction = {
  title: string;
  owner: string;
  due_date: string;
  expected_effect: string;
};

export type AgentMemoryContext = {
  currentTask: AgentMemoryCurrentTask;
  contextAnchors: AgentMemoryContextAnchor[];
  persistentRules: AgentMemoryPersistentRule[];
  retrieval: AgentMemoryRetrieval;
  decisionUsage: AgentMemoryDecisionUsage;
  economics: AgentMemoryEconomics;
  riskControl: AgentMemoryRiskControl;
  nextActions: AgentMemoryNextAction[];
};

export type AgentRuleApplied = {
  title: string;
  location: string | null;
  description: string | null;
  fullText: string | null;
  sourceUrl: string | null;
  decisionGuidance?: AgentCapabilityDecisionGuidance | null;
  qualitySignals?: AgentCapabilityQualitySignals | null;
};

export type AgentTaskEvent = {
  id: string;
  title: string;
  completedAt: string;
  reviewErrors: number;
};

export type AgentImprovement = {
  title: string;
  problem: string;
  solution: string;
  effect: string;
  priority: string;
  section?: string | null;
  ownerSection: string;
  detectionBasis: string;
  promptPath: string;
  promptTitle: string;
  promptMarkdown: string;
  promptSourceUrl: string;
  targetMetric: string;
  baselineWindow: string;
  expectedDelta: string;
  validationDate: string;
  ice: { impact: number; confidence: number; ease: number };
};

export type AgentOperatingPlanSourcePolicy = {
  mode: string;
  whitelist: string[];
  updateRule: string;
  validationCriteria: string[];
};

export type AgentOperatingPlanNotificationPolicy = {
  mode: string;
  criticalCases: string[];
  digestFields: string[];
};

export type AgentOperatingPlanMetricsCatalog = {
  agents: string[];
  analyst: string[];
};

export type AgentOperatingPlan = {
  mission: string;
  dailyLoop: string[];
  sourcePolicy: AgentOperatingPlanSourcePolicy;
  notificationPolicy: AgentOperatingPlanNotificationPolicy;
  improvementLifecycle: string[];
  metricsCatalog: AgentOperatingPlanMetricsCatalog;
  decisionRules: string[];
};

export type AgentWorkflowPolicy = {
  planDefault: boolean;
  replanOnDeviation: boolean;
  verifyBeforeDone: boolean;
  selfImprovementLoop: boolean;
  autonomousBugfix: boolean;
};

export type AgentWorkflowBackboneRoleWindow = {
  entryStep: string;
  exitStep: string;
  purpose: string;
  internalSteps: string[];
};

export type AgentWorkflowBackboneStepExecutionPolicy = {
  skippedStepsAllowed: boolean;
  skippedStepStatus: "skipped";
};

export type AgentWorkflowBackbone = {
  version: "universal_backbone_v1";
  commonCoreSteps: string[];
  roleWindow: AgentWorkflowBackboneRoleWindow;
  stepExecutionPolicy: AgentWorkflowBackboneStepExecutionPolicy;
  supportsDynamicInstances: boolean;
};

export type AgentLearningArtifacts = {
  todoPath: string;
  lessonsPath: string;
  lastLessonAt: string | null;
  changeLogPath?: string | null;
};

export type AgentDoneGatePolicy = {
  mode: "soft_warning" | "strict";
  requiredChecks: string[];
  fallbackStatus: AgentTaskStatus;
};

export type AgentCapabilityContract = {
  mission: string;
  entryCriteria: string[];
  doneCondition: string;
  outputSchema: string;
};

export type AgentSummary = {
  id: string;
  name: string;
  role: string;
  status: "healthy" | "degraded" | "offline";
  agentClass: "core" | "specialist";
  origin: "manual" | "dynamic";
  createdByAgentId: string | null;
  parentTemplateId: string | null;
  derivedFromAgentId: string | null;
  specializationScope: string;
  lifecycle: "active" | "retire_candidate" | "retired";
  creationReason: string | null;
  capabilityContract: AgentCapabilityContract;
  auditDisposition: "keep" | "merge" | "retire_candidate";
  auditNote: string | null;
  skills: string[];
  usedSkills: AgentUsedSkill[];
  availableSkills: AgentAvailableSkill[];
  usedTools: AgentUsedTool[];
  availableTools: AgentAvailableTool[];
  repositories: AgentRepository[];
  mcpServers: AgentMcpServer[];
  usedMcp: AgentUsedMcp[];
  availableMcp: AgentAvailableMcp[];
  capabilityOptimization?: AgentCapabilityOptimizationPolicy | null;
  skillSourceRegistry?: AgentSkillSourceRegistryEntry[];
  externalSkillCandidates?: AgentExternalSkillCandidate[];
  skillShadowTrial?: AgentSkillShadowTrialArtifacts | null;
  capabilitySnapshot?: AgentCapabilitySnapshot | null;
  contextRefs: AgentContextRef[];
  memoryContext?: AgentMemoryContext | null;
  taskBoard?: AgentTaskBoardConfig | null;
  rulesApplied?: AgentRuleApplied[];
  tasks: AgentTaskCounters;
  taskEvents: AgentTaskEvent[];
  analystRecommendations: string[];
  improvements: AgentImprovement[];
  operatingPlan?: AgentOperatingPlan | null;
  workflowPolicy?: AgentWorkflowPolicy | null;
  workflowBackbone?: AgentWorkflowBackbone | null;
  learningArtifacts?: AgentLearningArtifacts | null;
  workflowMetricsCatalog?: string[];
  doneGatePolicy?: AgentDoneGatePolicy | null;
  updatedAt: string;
  source: string;
  trackerUrl: string | null;
  runbook: string | null;
  notes: string | null;
  shortDescription?: string | null;
};

export type AgentsManifest = {
  updatedAt: string;
  source: string;
  sourceVersion: string;
  agents: AgentSummary[];
};

export type AgentLatestCycleMetricMeta = {
  label: string;
  description: string;
  formula: string;
  source: string;
};

export type AgentLatestCycleArtifactRef = {
  path: string;
  source_kind?: string;
  semantic_layer?: string;
  reason?: string;
  label?: string;
};

export type AgentLatestCycleArtifactOperation = {
  path: string;
  op: "read" | "write" | "create" | "update" | "delete";
  timestamp?: string;
  step?: string;
  task_id?: string;
  run_id?: string;
  source?: string;
  source_kind?: string;
  semantic_layer?: string;
  reason?: string;
  label?: string;
};

export type AgentLatestCycleTimelineEvent = {
  timestamp: string | null;
  step: string;
  step_raw?: string;
  step_label?: string;
  status: string;
  run_id: string;
  trace_id: string;
  recommendation_id: string;
  outcome: string;
  tokens_in?: number;
  tokens_out?: number;
  artifacts_read: Array<string | AgentLatestCycleArtifactRef>;
  artifacts_written: Array<string | AgentLatestCycleArtifactRef>;
  artifact_operations?: AgentLatestCycleArtifactOperation[];
  artifact_contract_version?: string;
  artifact_ops_origin?: "explicit" | "mirrored_legacy" | "step_fallback" | "none";
  artifacts_source: "telemetry" | "fallback";
};

export type AgentLatestCycleFileTraceEdge = {
  step: string;
  step_label?: string;
  kind: "read" | "write" | "delete";
  path: string;
  source_kind?: string;
  semantic_layer?: string;
  reason?: string;
  label?: string;
  source: "telemetry" | "fallback";
};

export type AgentLatestCycleCanonicalStage = {
  step_key: string;
  step_label: string;
  executed: boolean;
  events_total: number;
  started_at: string | null;
  last_event_at: string | null;
  status: string | null;
  tokens_in: number;
  tokens_out: number;
  tokens_total: number;
  artifacts_read: Array<string | AgentLatestCycleArtifactRef>;
  artifacts_written: Array<string | AgentLatestCycleArtifactRef>;
  raw_steps: string[];
};

export type AgentLatestCycleSnapshot = {
  generated_at: string;
  version: string;
  agent_id: string;
  available: boolean;
  source: {
    summary_path: string;
    cycle_report_path: string;
    log_dir: string;
  };
  metrics: {
    verification_pass_rate: number | null;
    lesson_capture_rate: number | null;
    review_error_rate: number | null;
    recommendation_action_rate: number | null;
    replan_rate: number | null;
    decision_time_avg_ms: number | null;
    time_to_solution_min: number | null;
  };
  metric_meta: Record<string, AgentLatestCycleMetricMeta>;
  latest_cycle: {
    task_id: string;
    first_event_at: string | null;
    last_event_at: string | null;
    latest_final_status: string | null;
    final_scope: string;
    events_total: number;
  } | null;
  timeline: AgentLatestCycleTimelineEvent[];
  canonical_stages: AgentLatestCycleCanonicalStage[];
  out_of_canon: AgentLatestCycleTimelineEvent[];
  file_trace: {
    edges: AgentLatestCycleFileTraceEdge[];
    fallback_used: boolean;
  };
};

export type AgentBenchmarkGateResult = {
  metric: string;
  status: "pass" | "fail" | "missing";
  value: number | null;
  threshold: number;
  direction: "min" | "max";
  message: string;
};

export type AgentBenchmarkSummary = {
  generated_at: string;
  version: string;
  mode: "soft_warning" | "strict";
  source: {
    dataset_path: string;
    run_path: string;
    telemetry_summary_path: string;
  };
  dataset: {
    agent_id: string;
    cases_total: number;
    valid_cases: number;
    invalid_cases: number;
    invalid_reasons: string[];
    judge_rubric_version: string | null;
  };
  run: {
    run_id: string | null;
    agent_id: string;
    target_k: number;
    judge_model: string | null;
    judge_rubric_version: string | null;
    started_at: string | null;
    finished_at: string | null;
  };
  thresholds: {
    pass_at_5: number;
    fact_coverage_mean: number;
    schema_valid_rate: number;
    trajectory_compliance_rate: number;
    judge_disagreement_rate: number;
    recommendation_action_rate: number;
  };
  metrics: {
    pass_at_5: number | null;
    fact_coverage_mean: number | null;
    schema_valid_rate: number | null;
    trajectory_compliance_rate: number | null;
    judge_disagreement_rate: number | null;
    cost_per_success: number | null;
    attempts_total: number;
    cases_total: number;
    cases_with_results: number;
    successful_cases: number;
    cost_total: number;
    latency_p95_ms: number | null;
    pass_rate_variance: number | null;
  };
  impact_metrics: {
    recommendation_executability_rate: number | null;
    evidence_link_coverage: number | null;
    time_to_action_p50: number | null;
    validated_impact_rate: number | null;
  };
  telemetry_metrics: {
    recommendation_action_rate: number | null;
  };
  gate: {
    status: "passed" | "warning" | "failed";
    failed_metrics: string[];
    missing_metrics: string[];
    results: AgentBenchmarkGateResult[];
  };
  agents: Array<Record<string, unknown>>;
};

export type AgentTelemetrySummaryAgent = {
  agent_id: string;
  events_total: number;
  tasks_total: number;
  invocation_count?: number;
  completed_tasks: number;
  completed_task_count?: number;
  failed_tasks: number;
  verification_pass_rate?: number | null;
  recommendation_action_rate?: number | null;
  handoff_use_rate?: number | null;
  overlap_with_analyst_rate?: number | null;
  orchestration_cost_per_completed_task?: number | null;
  orchestration_cost_unit?: string | null;
  host_adapter_sync_status?: "synced" | "partial" | "missing" | "archived" | string;
};

export type AgentTelemetrySummary = {
  generated_at: string;
  version: string;
  log_dir: string;
  totals: Record<string, unknown>;
  warnings: Array<Record<string, unknown>>;
  agents: AgentTelemetrySummaryAgent[];
};

export type HostAgentSmokeSpec = {
  path: string;
  exists: boolean;
  matches: boolean;
};

export type HostAgentSmokeAgentCheck = {
  agent_id: string;
  ok: boolean;
  specs: HostAgentSmokeSpec[];
  written?: string[];
};

export type HostAgentSmokeHostCheck = {
  ok: boolean;
  agents: HostAgentSmokeAgentCheck[];
};

export type HostAgentSmokeValidation = {
  ok: boolean;
  issues: string[];
};

export type HostAgentSmokeReport = {
  generated_at: string;
  version: string;
  available: boolean;
  ok: boolean;
  command: string;
  active_top_level_agents: string[];
  hosts: Record<string, HostAgentSmokeHostCheck>;
  handoff_validation: HostAgentSmokeValidation;
  error: string | null;
};

export type AgentImprovementHistorySourceTool = "codex" | "copilot" | "claude" | "other";

export type AgentImprovementHistoryResultStatus = "captured" | "applied" | "verified" | "rollback" | "rejected";

export type AgentImprovementHistoryEvent = {
  event_id: string;
  occurred_at: string;
  agent_id: string;
  source_tool: AgentImprovementHistorySourceTool;
  source_ref: string | null;
  extracted_value: string;
  applied_change: string;
  target_scope: string;
  result_status: AgentImprovementHistoryResultStatus;
  result_note: string;
  metric_name?: string | null;
  metric_delta?: number | null;
  evidence_refs: string[];
};

export type AgentImprovementHistoryFeed = {
  generated_at: string;
  version: "improvement_history.v1";
  source: string;
  events: AgentImprovementHistoryEvent[];
};

export function getC4Manifest(): C4Manifest {
  return c4Manifest as C4Manifest;
}

export function getBpmnManifest(): BpmnDiagram[] {
  return ((bpmnManifest as { diagrams?: BpmnDiagram[] }).diagrams || []) as BpmnDiagram[];
}

export function getDocsIndex(): DocsDocument[] {
  return ((docsIndex as { documents?: DocsDocument[] }).documents || []) as DocsDocument[];
}

export function getSearchIndex(): SearchIndex {
  return {
    updatedAt: (searchIndex as SearchIndex).updatedAt || "",
    documents: ((searchIndex as { documents?: SearchDoc[] }).documents || []) as SearchDoc[],
  };
}

export function getOapKbIndex(): OapKbDocument[] {
  return ((oapKbIndex as { documents?: OapKbDocument[] }).documents || []) as OapKbDocument[];
}

export function getOapKbSearchIndex(): OapKbSearchIndex {
  return {
    updatedAt: (oapKbSearchIndex as OapKbSearchIndex).updatedAt || "",
    documents: ((oapKbSearchIndex as { documents?: OapKbSearchDoc[] }).documents || []) as OapKbSearchDoc[],
  };
}

export function getOapKbRawLogs(): OapKbDocument[] {
  return ((oapKbRawLogs as { documents?: OapKbDocument[] }).documents || []) as OapKbDocument[];
}

export function getAgentsManifest(): AgentsManifest {
  const fallback: AgentsManifest = {
    updatedAt: "",
    source: "unknown",
    sourceVersion: "v0",
    agents: [],
  };

  const manifest = agentsManifest as Partial<AgentsManifest>;
  if (!manifest || !Array.isArray(manifest.agents)) {
    return fallback;
  }

  return {
    updatedAt: String(manifest.updatedAt || ""),
    source: String(manifest.source || "unknown"),
    sourceVersion: String(manifest.sourceVersion || "v0"),
    agents: manifest.agents as AgentSummary[],
  };
}

export function getAnalystLatestCycle(): AgentLatestCycleSnapshot {
  const fallback: AgentLatestCycleSnapshot = {
    generated_at: "",
    version: "agent_latest_cycle_analyst.v1",
    agent_id: "analyst-agent",
    available: false,
    source: {
      summary_path: "artifacts/agent_telemetry_summary.json",
      cycle_report_path: "artifacts/agent_cycle_validation_report.json",
      log_dir: ".logs/agents",
    },
    metrics: {
      verification_pass_rate: null,
      lesson_capture_rate: null,
      review_error_rate: null,
      recommendation_action_rate: null,
      replan_rate: null,
      decision_time_avg_ms: null,
      time_to_solution_min: null,
    },
    metric_meta: {},
    latest_cycle: null,
    timeline: [],
    canonical_stages: [],
    out_of_canon: [],
    file_trace: { edges: [], fallback_used: false },
  };
  const parsed = analystLatestCycle as unknown as Partial<AgentLatestCycleSnapshot>;
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }
  return {
    ...fallback,
    ...parsed,
  };
}

export function getAgentBenchmarkSummary(): AgentBenchmarkSummary {
  const fallback: AgentBenchmarkSummary = {
    generated_at: "",
    version: "agent_benchmark_summary.v1",
    mode: "soft_warning",
    source: {
      dataset_path: "artifacts/analyst_benchmark_dataset.json",
      run_path: "artifacts/agent_benchmark_run_results.json",
      telemetry_summary_path: "artifacts/agent_telemetry_summary.json",
    },
    dataset: {
      agent_id: "analyst-agent",
      cases_total: 0,
      valid_cases: 0,
      invalid_cases: 0,
      invalid_reasons: [],
      judge_rubric_version: null,
    },
    run: {
      run_id: null,
      agent_id: "analyst-agent",
      target_k: 5,
      judge_model: null,
      judge_rubric_version: null,
      started_at: null,
      finished_at: null,
    },
    thresholds: {
      pass_at_5: 0.8,
      fact_coverage_mean: 0.85,
      schema_valid_rate: 0.98,
      trajectory_compliance_rate: 0.9,
      judge_disagreement_rate: 0.15,
      recommendation_action_rate: 0.3,
    },
    metrics: {
      pass_at_5: null,
      fact_coverage_mean: null,
      schema_valid_rate: null,
      trajectory_compliance_rate: null,
      judge_disagreement_rate: null,
      cost_per_success: null,
      attempts_total: 0,
      cases_total: 0,
      cases_with_results: 0,
      successful_cases: 0,
      cost_total: 0,
      latency_p95_ms: null,
      pass_rate_variance: null,
    },
    impact_metrics: {
      recommendation_executability_rate: null,
      evidence_link_coverage: null,
      time_to_action_p50: null,
      validated_impact_rate: null,
    },
    telemetry_metrics: {
      recommendation_action_rate: null,
    },
    gate: {
      status: "warning",
      failed_metrics: [],
      missing_metrics: [],
      results: [],
    },
    agents: [],
  };

  const parsed = agentBenchmarkSummary as unknown as Partial<AgentBenchmarkSummary>;
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }
  return {
    ...fallback,
    ...parsed,
    source: {
      ...fallback.source,
      ...(parsed.source || {}),
    },
    dataset: {
      ...fallback.dataset,
      ...(parsed.dataset || {}),
    },
    run: {
      ...fallback.run,
      ...(parsed.run || {}),
    },
    thresholds: {
      ...fallback.thresholds,
      ...(parsed.thresholds || {}),
    },
    metrics: {
      ...fallback.metrics,
      ...(parsed.metrics || {}),
    },
    impact_metrics: {
      ...fallback.impact_metrics,
      ...(parsed.impact_metrics || {}),
    },
    telemetry_metrics: {
      ...fallback.telemetry_metrics,
      ...(parsed.telemetry_metrics || {}),
    },
    gate: {
      ...fallback.gate,
      ...(parsed.gate || {}),
      failed_metrics: Array.isArray(parsed.gate?.failed_metrics) ? parsed.gate.failed_metrics : [],
      missing_metrics: Array.isArray(parsed.gate?.missing_metrics) ? parsed.gate.missing_metrics : [],
      results: Array.isArray(parsed.gate?.results) ? parsed.gate.results as AgentBenchmarkGateResult[] : [],
    },
    agents: Array.isArray(parsed.agents) ? parsed.agents : [],
  };
}

export function getAgentTelemetrySummary(): AgentTelemetrySummary {
  const fallback: AgentTelemetrySummary = {
    generated_at: "",
    version: "agent_telemetry_report.v1",
    log_dir: ".logs/agents",
    totals: {},
    warnings: [],
    agents: [],
  };

  const parsed = agentTelemetrySummary as unknown as Partial<AgentTelemetrySummary>;
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  return {
    ...fallback,
    ...parsed,
    agents: Array.isArray(parsed.agents) ? parsed.agents as AgentTelemetrySummaryAgent[] : [],
  };
}

export function getAgentTelemetrySummaryByAgent(agentId: string): AgentTelemetrySummaryAgent | null {
  const normalized = String(agentId || "").trim();
  if (!normalized) return null;
  return getAgentTelemetrySummary().agents.find((item) => String(item.agent_id || "").trim() === normalized) || null;
}

export function getHostAgentSmokeReport(): HostAgentSmokeReport {
  const fallback: HostAgentSmokeReport = {
    generated_at: "",
    version: "host_agent_smoke_report.v1",
    available: false,
    ok: false,
    command: "python3 scripts/export_host_agents.py smoke-active-set",
    active_top_level_agents: [],
    hosts: {},
    handoff_validation: {
      ok: false,
      issues: [],
    },
    error: "smoke_not_available",
  };

  const parsed = hostAgentSmokeReport as unknown as Partial<HostAgentSmokeReport>;
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  return {
    ...fallback,
    ...parsed,
    active_top_level_agents: Array.isArray(parsed.active_top_level_agents) ? parsed.active_top_level_agents as string[] : [],
    hosts: parsed.hosts && typeof parsed.hosts === "object" ? parsed.hosts as Record<string, HostAgentSmokeHostCheck> : {},
    handoff_validation: {
      ...fallback.handoff_validation,
      ...(parsed.handoff_validation || {}),
      issues: Array.isArray(parsed.handoff_validation?.issues) ? parsed.handoff_validation.issues as string[] : [],
    },
    error: typeof parsed.error === "string" ? parsed.error : null,
  };
}

export function getAgentImprovementHistory(): AgentImprovementHistoryFeed {
  const fallback: AgentImprovementHistoryFeed = {
    generated_at: "",
    version: "improvement_history.v1",
    source: "generated",
    events: [],
  };

  const parsed = agentImprovementHistory as unknown as Partial<AgentImprovementHistoryFeed>;
  if (!parsed || typeof parsed !== "object") {
    return fallback;
  }

  const events = Array.isArray(parsed.events)
    ? parsed.events.filter((item) => item && typeof item === "object") as AgentImprovementHistoryEvent[]
    : [];

  return {
    ...fallback,
    ...parsed,
    events,
  };
}

export function getAgentImprovementHistoryByAgent(agentId: string): AgentImprovementHistoryEvent[] {
  const normalized = String(agentId || "").trim();
  if (!normalized) return [];
  return getAgentImprovementHistory().events.filter((event) => String(event.agent_id || "").trim() === normalized);
}
