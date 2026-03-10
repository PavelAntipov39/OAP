import { expect, test } from "@playwright/test";

test("agent flow page renders architecture, bpm, factual cycle and metric tooltip", async ({ page }) => {
  await page.goto("/#/agent-flow");

  await expect(page.getByRole("heading", { name: "Agent Flow: analyst-agent" })).toBeVisible();
  await expect(page.getByText("Как устроен агент (C4 process views)")).toBeVisible();
  await expect(page.getByText("Как должен работать (BPMN)")).toBeVisible();
  await expect(page.getByText("Как сработал последний цикл (факт)")).toBeVisible();

  await page.getByRole("button", { name: "Обновить" }).click();
  await expect(page.getByText("KPI цикла")).toBeVisible();

  const metricInfo = page.getByLabel("Как считается метрика verification_pass_rate");
  await metricInfo.hover();
  await expect(page.getByText("Как считается")).toBeVisible();
});

