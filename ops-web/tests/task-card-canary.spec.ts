import { expect, test } from "@playwright/test";

const tasksResponse = [
  {
    id: "task-legacy-001",
    external_key: "TASK-LEGACY-001",
    title: "Обычная задача без canary UI",
    source_agent_id: "analyst-agent",
    executor_agent_id: "designer-agent",
    status: "ready",
    priority: "medium",
    origin_type: "recommendation",
    origin_type_label_ru: "Рекомендация",
    origin_ref: "analyst-agent.analystRecommendations[2]",
    evidence_refs: [],
    task_brief: {
      goal: "Оставить для большинства задач текущую карточку без изменений",
      expected_outcome: "Новая структура включается только по allowlist task.id",
      acceptance_criteria: ["legacy drawer продолжает открываться для обычных задач"],
      constraints: [],
      dependencies: [],
      target_artifacts: ["ops-web/src/components/tasks/TaskDetailsDrawer.tsx"],
      priority_reason: "Нужен безопасный canary rollout",
      context_package: {
        relevant_anchors: [],
        mandatory_rules: [],
      },
      origin_context: {
        source: "recommendation",
      },
    },
    readiness_auto_score: 4,
    readiness_auto_state: "ready",
    readiness_manual_state: "approved",
    readiness_final_state: "ready",
    created_at: "2026-03-08T09:30:00+02:00",
    updated_at: "2026-03-08T10:10:00+02:00",
    last_event_at: "2026-03-08T10:10:00+02:00",
    last_event_type: "recommendation_suggested",
    last_event_actor: "analyst-agent",
    last_event_time: "2026-03-08T10:10:00+02:00",
  },
  {
    id: "task-waiting-human-001",
    external_key: "TASK-WH-001",
    title: "Задача ожидающая решения человека",
    source_agent_id: "analyst-agent",
    executor_agent_id: "analyst-agent",
    status: "waiting_human",
    priority: "high",
    origin_type: "recommendation",
    origin_type_label_ru: "Рекомендация",
    origin_ref: null,
    evidence_refs: [],
    task_brief: {
      goal: "Проверить роутинг на экспериментальную карточку через service_mode",
      expected_outcome: "TaskDetailsDrawerExperimental открывается для задач с waiting_human",
      acceptance_criteria: ["experimental drawer открывается без allowlist ID"],
      constraints: [],
      dependencies: [],
      target_artifacts: ["ops-web/src/components/tasks/TaskDetailsDrawer.tsx"],
      priority_reason: "Нужно человеческое решение",
      context_package: {
        relevant_anchors: [],
        mandatory_rules: [],
      },
      origin_context: {
        source: "recommendation",
      },
    },
    readiness_auto_score: 5,
    readiness_auto_state: "ready",
    readiness_manual_state: "approved",
    readiness_final_state: "ready",
    created_at: "2026-03-10T09:00:00+02:00",
    updated_at: "2026-03-10T10:00:00+02:00",
    last_event_at: "2026-03-10T10:00:00+02:00",
    last_event_type: "human_gate_triggered",
    last_event_actor: "analyst-agent",
    last_event_time: "2026-03-10T10:00:00+02:00",
  },
];

const legacyDetailsResponse = {
  task: {
    id: "task-legacy-001",
    external_key: "TASK-LEGACY-001",
    title: "Обычная задача без canary UI",
    status: "ready",
    priority: "medium",
    source_agent_id: "analyst-agent",
    executor_agent_id: "designer-agent",
    created_at: "2026-03-08T09:30:00+02:00",
    updated_at: "2026-03-08T10:10:00+02:00",
    last_event_at: "2026-03-08T10:10:00+02:00",
  },
  what_to_do: {
    goal: "Оставить для большинства задач текущую карточку без изменений",
    expected_outcome: "Новая структура включается только по allowlist task.id",
    acceptance_criteria: ["legacy drawer продолжает открываться для обычных задач"],
    constraints: [],
    dependencies: [],
    target_artifacts: ["ops-web/src/components/tasks/TaskDetailsDrawer.tsx"],
    priority_reason: "Нужен безопасный canary rollout",
    context_to_task: {
      summary: "Большинство карточек не должно менять поведение, пока мы не утвердим новый UI.",
      why_now: "Нужно безопасно проверить новую структуру на одной задаче.",
      execution_notes: [],
      source_snapshot: null,
    },
  },
  origin: {
    origin_type: "recommendation",
    origin_type_label_ru: "Рекомендация",
    origin_ref: "analyst-agent.analystRecommendations[2]",
    source_agent_id: "analyst-agent",
    linked_improvement: null,
  },
  context_and_evidence: {
    evidence_refs: ["docs/tasks/task_rules.md"],
    context_package: {
      relevant_anchors: [{ path: "docs/tasks/task_rules.md" }],
      mandatory_rules: [{ path: "docs/subservices/oap/DESIGN_RULES.md" }],
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
      has_goal: true,
      has_expected_outcome: true,
      has_acceptance_criteria: true,
      has_target_artifacts: true,
      has_evidence_or_origin: true,
    },
    manual_actor: "analyst-agent",
    manual_event_time: "2026-03-08T10:10:00+02:00",
  },
  timeline: [],
};

async function mockLegacyTaskEndpoints(page: import("@playwright/test").Page) {
  await page.route("**/rest/v1/rpc/get_agent_tasks", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(tasksResponse),
    });
  });

  await page.route("**/rest/v1/rpc/get_agent_task_details", async (route) => {
    const body = route.request().postDataJSON() as { p_task_id?: string } | undefined;
    if (body?.p_task_id === "task-waiting-human-001") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          task: {
            id: "task-waiting-human-001",
            external_key: "TASK-WH-001",
            title: "Задача ожидающая решения человека",
            status: "waiting_human",
            priority: "high",
            source_agent_id: "analyst-agent",
            executor_agent_id: "analyst-agent",
            created_at: "2026-03-10T09:00:00+02:00",
            updated_at: "2026-03-10T10:00:00+02:00",
            last_event_at: "2026-03-10T10:00:00+02:00",
          },
          what_to_do: {
            goal: "Проверить роутинг на экспериментальную карточку через service_mode",
            expected_outcome: "TaskDetailsDrawerExperimental открывается для задач с waiting_human",
            acceptance_criteria: ["experimental drawer открывается без allowlist ID"],
            constraints: [],
            dependencies: [],
            target_artifacts: [],
            priority_reason: "Нужно человеческое решение",
            context_to_task: {
              summary: "Задача ждёт решения оператора.",
              why_now: "Автоматическое исполнение заблокировано до получения ввода.",
              execution_notes: [],
              source_snapshot: null,
            },
          },
          origin: {
            origin_type: "recommendation",
            origin_type_label_ru: "Рекомендация",
            origin_ref: null,
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
            readiness_auto_score: 5,
            readiness_auto_state: "ready",
            readiness_manual_state: "approved",
            readiness_final_state: "ready",
            checks: {
              has_goal: true,
              has_expected_outcome: true,
              has_acceptance_criteria: true,
              has_target_artifacts: false,
              has_evidence_or_origin: false,
            },
            manual_actor: "analyst-agent",
            manual_event_time: "2026-03-10T10:00:00+02:00",
          },
          timeline: [],
        }),
      });
      return;
    }
    if (body?.p_task_id !== "task-legacy-001") {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "task_not_found" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(legacyDetailsResponse),
    });
  });
}

test("canary task id opens experimental task card with real rules document", async ({ page }) => {
  await mockLegacyTaskEndpoints(page);

  await page.goto("/#/tasks?task=demo-human-approve");
  const drawer = page.getByTestId("task-details-experimental");
  await expect(drawer.getByText("Нужно ваше решение").first()).toBeVisible();
  await expect(drawer.getByText("Сводка задачи")).toBeVisible();
  await expect(drawer.getByText("Header задачи")).toHaveCount(0);
  await expect(drawer.getByText("не назначены").first()).toBeVisible();
  await expect(drawer.getByText("не назначен").first()).toBeVisible();
  await expect(drawer.getByText("1. Напишите комментарий")).toBeVisible();
  await expect(drawer.getByText("Подтвердить запуск").first()).toBeVisible();
  await expect(drawer.getByText("Отменить задачу").first()).toBeVisible();
  await expect(drawer.getByText("Вернуть агенту").first()).toBeVisible();
  await expect(drawer.getByText(/локальный предпросмотр: выбор решения и комментарий показывают будущий сценарий работы/i)).toBeVisible();
  await expect(page).toHaveURL(/#\/tasks\?task=demo-human-approve$/);

  await drawer.getByText("Открыть описание правил").click();
  const dialog = page.locator('[role="dialog"]').last();
  await expect(dialog.getByText("Что такое задача")).toBeVisible();
  await expect(dialog.getByText("docs/tasks/task_rules.md").first()).toBeVisible();
});

test("non-canary task id keeps legacy task card", async ({ page }) => {
  await mockLegacyTaskEndpoints(page);

  await page.goto("/#/tasks");
  await page.getByText("Обычная задача без canary UI").first().click();
  await expect(page).toHaveURL(/#\/tasks\?task=task-legacy-001$/);
  await expect(page.getByText("Visual review по этой задаче")).toBeVisible();
  await page.locator('[aria-label="Закрыть"]').last().click();
  await expect(page).toHaveURL(/#\/tasks$/);
});

test("waiting_human service_mode opens experimental task card via row click", async ({ page }) => {
  await mockLegacyTaskEndpoints(page);

  await page.goto("/#/tasks");
  // задача с waiting_human появляется в секции «требует вашего решения»
  await page.getByText("Задача ожидающая решения человека").first().click();
  const drawer = page.getByTestId("task-details-experimental");
  await expect(drawer.getByText("Нужно ваше решение").first()).toBeVisible();
  await expect(drawer.getByText("Сводка задачи")).toBeVisible();
  await expect(drawer.getByText("Подтвердить запуск").first()).toBeVisible();
  await expect(drawer.getByText("Отменить задачу").first()).toBeVisible();
  await expect(drawer.getByText("Вернуть агенту").first()).toBeVisible();
});
