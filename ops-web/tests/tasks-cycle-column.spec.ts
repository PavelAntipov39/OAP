import { expect, test } from "@playwright/test";

const tasksResponse = [
  {
    id: "task-with-cycle",
    external_key: "TASK-CYCLE-001",
    title: "Задача с циклом",
    source_agent_id: "analyst-agent",
    executor_agent_id: "designer-agent",
    status: "ready",
    priority: "medium",
    origin_type: "recommendation",
    origin_type_label_ru: "Рекомендация",
    origin_ref: "analyst-agent.analystRecommendations[1]",
    evidence_refs: [],
    task_brief: {
      goal: "Показать цикл в таблице задач",
      expected_outcome: "Новый столбец отображается без дополнительных запросов",
      acceptance_criteria: ["Столбец Цикл показывает значение origin_cycle_id"],
      constraints: [],
      dependencies: [],
      target_artifacts: ["ops-web/src/pages/TasksPage.tsx"],
      priority_reason: "UX-прозрачность происхождения задачи",
      context_package: {
        relevant_anchors: [],
        mandatory_rules: [],
      },
      origin_context: {
        source: "recommendation",
        origin_cycle_id: "cycle-20260306-2",
      },
    },
    readiness_auto_score: 4,
    readiness_auto_state: "ready",
    readiness_manual_state: "approved",
    readiness_final_state: "ready",
    created_at: "2026-03-06T09:30:00+02:00",
    updated_at: "2026-03-06T10:10:00+02:00",
    last_event_at: "2026-03-06T10:10:00+02:00",
    last_event_type: "candidate_assessed",
    last_event_actor: "analyst-agent",
    last_event_time: "2026-03-06T10:10:00+02:00",
  },
  {
    id: "task-without-cycle",
    external_key: "TASK-CYCLE-002",
    title: "Задача без цикла",
    source_agent_id: "reader-agent",
    executor_agent_id: "analyst-agent",
    status: "backlog",
    priority: "low",
    origin_type: "telemetry",
    origin_type_label_ru: "Telemetry",
    origin_ref: "artifacts/agent_telemetry_summary.json",
    evidence_refs: [],
    task_brief: {
      goal: "Проверить fallback по циклу",
      expected_outcome: "В ячейке видно не зафиксировано",
      acceptance_criteria: ["При пустом origin_cycle_id UI показывает fallback"],
      constraints: [],
      dependencies: [],
      target_artifacts: [],
      priority_reason: "Контракт обратной совместимости",
      context_package: {
        relevant_anchors: [],
        mandatory_rules: [],
      },
      origin_context: {
        source: "telemetry",
      },
    },
    readiness_auto_score: 2,
    readiness_auto_state: "needs_clarification",
    readiness_manual_state: "not_set",
    readiness_final_state: "needs_clarification",
    created_at: "2026-03-06T08:30:00+02:00",
    updated_at: "2026-03-06T08:45:00+02:00",
    last_event_at: "2026-03-06T08:45:00+02:00",
    last_event_type: "candidate_received",
    last_event_actor: "reader-agent",
    last_event_time: "2026-03-06T08:45:00+02:00",
  },
];

const taskDetailsResponse = {
  task: {
    id: "task-with-cycle",
    external_key: "TASK-CYCLE-001",
    title: "Задача с циклом",
    status: "ready",
    priority: "medium",
    source_agent_id: "analyst-agent",
    executor_agent_id: "designer-agent",
    created_at: "2026-03-06T09:30:00+02:00",
    updated_at: "2026-03-06T10:10:00+02:00",
    last_event_at: "2026-03-06T10:10:00+02:00",
  },
  what_to_do: {
    goal: "Показать цикл в таблице задач",
    expected_outcome: "Новый столбец отображается без дополнительных запросов",
    acceptance_criteria: ["Столбец Цикл показывает значение origin_cycle_id"],
    constraints: [],
    dependencies: [],
    target_artifacts: ["ops-web/src/pages/TasksPage.tsx"],
    priority_reason: "UX-прозрачность происхождения задачи",
    context_to_task: {
      summary: "Нужно показать, в каком цикле задача появилась в task board.",
      why_now: "Пользователь просит сделать происхождение задач прозрачнее.",
      execution_notes: [],
      source_snapshot: null,
    },
  },
  origin: {
    origin_type: "recommendation",
    origin_type_label_ru: "Рекомендация",
    origin_ref: "analyst-agent.analystRecommendations[1]",
    source_agent_id: "analyst-agent",
    linked_improvement: null,
  },
  context_and_evidence: {
    evidence_refs: [],
    context_package: {
      relevant_anchors: [],
      mandatory_rules: [],
    },
    linked_elements: [],
    related_logs: [],
  },
  implementation_usage: {
    source: "test",
    mcp_in_task: [],
    skills_in_task: [],
    mcp_frequency_across_tasks: [],
    skills_frequency_across_tasks: [],
  },
  readiness: {
    readiness_auto_score: 4,
    readiness_auto_state: "ready",
    readiness_manual_state: "approved",
    readiness_final_state: "ready",
    checks: {
      goal_present: true,
      outcome_present: true,
      acceptance_present: true,
      evidence_present: true,
    },
    manual_actor: "analyst-agent",
    manual_event_time: "2026-03-06T10:10:00+02:00",
  },
  timeline: [],
};

test("tasks page shows cycle provenance column and updated analyst cycle copy", async ({ page }) => {
  await page.route("**/rest/v1/rpc/get_agent_tasks", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tasksResponse),
    });
  });

  await page.route("**/rest/v1/rpc/get_agent_task_details", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(taskDetailsResponse),
    });
  });

  await page.goto("/#/tasks");

  await expect(page.getByRole("columnheader", { name: /Цикл/ })).toBeVisible();
  await page.getByLabel("Пояснение для столбца Цикл").hover();
  await expect(page.getByText("Цикл, в котором задача была обнаружена или создана. Это не A/B сессия.")).toBeVisible();

  const rows = page.locator("tbody tr");
  await expect(rows.nth(0).getByText("cycle-20260306-2")).toBeVisible();
  await expect(rows.nth(1).getByText("не зафиксировано")).toBeVisible();

  await page.getByRole("button", { name: "Задача с циклом" }).click();
  await expect(page.getByText("Цикл аналитика -> найден сигнал -> задача формализована -> выполнена -> проверена -> закрыта.")).toBeVisible();
});
