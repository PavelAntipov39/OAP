import { expect, test, type Page } from "@playwright/test";

const drawerCloseButton = (page: Page) => page.locator('button[aria-label="Закрыть"]').first();

const drawerSurface = (page: Page) => page.locator(".MuiDrawer-paper").last();

test.describe("Agents deep-link smoke", () => {
  test("opens analyst agent on explicit deeplink and preserves canonical tab", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=tasks_quality");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=tasks_quality$/);
    await expect(page.getByText("Ключевые метрики агента", { exact: true })).toBeVisible();
  });

  test("canonicalizes legacy agent mcp tab to overview", async ({ page }) => {
    await page.goto("/#/agents?agent=reader-agent&tab=mcp");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Разработчик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=reader-agent&tab=overview$/);
  });
});