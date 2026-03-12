import { expect, test } from "@playwright/test";

test("agent flow page renders simplified pipeline, mermaid loop and factual cycle", async ({ page }) => {
  await page.goto("/#/agent-flow?agent=analyst-agent");

  await expect(page.getByRole("heading", { name: "Аналитик" })).toBeVisible();
  await expect(page.locator(".MuiChip-label", { hasText: "Проверка результата" }).first()).toBeVisible();
  await expect(page.locator(".MuiChip-label", { hasText: "Обновление способностей" }).first()).toBeVisible();
  await expect(page.getByText("Архитектура (C4 process views)")).toBeVisible();
  await expect(page.getByText("Mermaid: unified capability optimization loop")).toBeVisible();
  await expect(page.getByText("Последний цикл (факт)")).toBeVisible();
  await expect(page.getByText("Таймлайн шагов")).toHaveCount(0);

  await page.getByRole("button", { name: "Обновить" }).click();
  await expect(page.getByText("KPI цикла")).toBeVisible();

  const metricInfo = page.getByLabel("Как считается метрика verification_pass_rate");
  await metricInfo.hover();
  await expect(page.getByText("Как считается")).toBeVisible();
});

test("agent flow keeps the same simplified model for non-analyst agent", async ({ page }) => {
  await page.goto("/#/agent-flow?agent=designer-agent");

  await expect(page.locator(".MuiChip-label", { hasText: "Проверка результата" }).first()).toBeVisible();
  await expect(page.locator(".MuiChip-label", { hasText: "Обновление способностей" }).first()).toBeVisible();
  await expect(page.getByText("Mermaid: unified capability optimization loop")).toBeVisible();
});
