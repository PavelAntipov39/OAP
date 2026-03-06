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

export type AgentTaskCollaborationPlan = {
  analysis_required: boolean;
  suggested_agents: string[];
  selected_agents: string[];
  rationale: string;
  reviewed_at: string | null;
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

export type AgentUsedSkill = {
  name: string;
  usage: string | null;
  fullText: string;
  practicalTasks: string[];
  lastUsedAt?: string | null;
  skillFilePath?: string | null;
  skillFileText?: string | null;
  skillFileLoaded?: boolean | null;
};

export type AgentAvailableSkill = {
  name: string;
  benefit: string | null;
  recommendationBasis: string | null;
  expectedEffect: string | null;
  fullText: string | null;
  practicalTasks: string[];
  link: string | null;
};

export type AgentUsedTool = {
  name: string;
  usage: string;
  fullText: string;
  source: string;
  practicalTasks: string[];
  lastUsedAt?: string | null;
};

export type AgentAvailableTool = {
  name: string;
  benefit: string;
  recommendationBasis: string;
  expectedEffect: string;
  fullText: string;
  source: string;
  practicalTasks: string[];
};

export type AgentUsedMcp = {
  name: string;
  status: "active" | "reauth_required" | "degraded" | "offline";
  note: string;
  impactInNumbers: string;
  practicalTasks: string[];
  lastUsedAt?: string | null;
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

export type AgentSummary = {
  id: string;
  name: string;
  role: string;
  status: "healthy" | "degraded" | "offline";
  skills: string[];
  usedSkills: AgentUsedSkill[];
  availableSkills: AgentAvailableSkill[];
  usedTools: AgentUsedTool[];
  availableTools: AgentAvailableTool[];
  repositories: AgentRepository[];
  mcpServers: AgentMcpServer[];
  usedMcp: AgentUsedMcp[];
  availableMcp: AgentAvailableMcp[];
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

export type AgentLatestCycleTimelineEvent = {
  timestamp: string | null;
  step: string;
  status: string;
  run_id: string;
  trace_id: string;
  recommendation_id: string;
  outcome: string;
  artifacts_read: string[];
  artifacts_written: string[];
  artifacts_source: "telemetry" | "fallback";
};

export type AgentLatestCycleFileTraceEdge = {
  step: string;
  kind: "read" | "write";
  path: string;
  source: "telemetry" | "fallback";
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
