import { expect, test, type Page } from "@playwright/test";

test.describe("Agents deep-link routing", () => {
  test.describe.configure({ mode: "serial" });

  const drawerCloseButton = (page: Page) => page.locator('button[aria-label="Закрыть"]').first();

  const drawerSurface = (page: Page) => page.locator(".MuiDrawer-paper").last();

  test("opens target agent and MCP tab from URL", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=mcp");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=mcp$/);
  });

  test("normalizes unknown tab to overview", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=unknown");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview$/);
  });

  test("falls back to overview for legacy agent when tab=mcp", async ({ page }) => {
    await page.goto("/#/agents?agent=reader-agent&tab=mcp");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Разработчик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=reader-agent&tab=overview$/);
  });

  test("normalizes numeric tab aliases", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=1");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=mcp$/);
  });

  test("close action returns to list route", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=memory_context");

    await expect(drawerCloseButton(page)).toBeVisible();
    await drawerCloseButton(page).click();
    await expect(page).toHaveURL(/#\/agents$/);
    await expect(drawerCloseButton(page)).toHaveCount(0);
  });

  test("route canonicalization does not pollute browser history", async ({ page }) => {
    await page.goto("/#/overview");
    await page.goto("/#/agents?agent=designer-agent&tab=unknown");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=designer-agent&tab=overview$/);

    await page.goBack();
    await expect(page).toHaveURL(/#\/overview$/);
  });

  test("keeps analyst metrics visible for deep-link with tasks_quality tab", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=tasks_quality");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(page.getByText("Эффективность агента", { exact: true })).toBeVisible();
    await expect(page.getByText("Ключевые метрики агента", { exact: true })).toBeVisible();

    const metricInfo = page.getByLabel("Как считается метрика tasks_from_agent");
    await metricInfo.hover();
    await expect(page.getByText("Как считается")).toBeVisible();
  });
});
