import { expect, test, type Page } from "@playwright/test";

test.describe("Agents deep-link routing", () => {
  test.describe.configure({ mode: "serial" });

  const drawerCloseButton = (page: Page) => page.locator('button[aria-label="Закрыть"]').first();

  const drawerSurface = (page: Page) => page.locator(".MuiDrawer-paper").last();

  test("canonicalizes analyst deep-link tabs to overview", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=mcp");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview$/);
  });

  test("normalizes unknown tab to overview", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=unknown");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview$/);
  });

  test("canonicalizes reader deep-link tabs to overview", async ({ page }) => {
    await page.goto("/#/agents?agent=reader-agent&tab=mcp");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Разработчик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=reader-agent&tab=overview$/);
  });

  test("normalizes numeric tab aliases to overview", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=1");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(drawerSurface(page).getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview$/);
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

  test("keeps analyst overview visible for legacy tab deep-link", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=tasks_quality");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview$/);
    await expect(page.getByText("Анализ эффективности агента", { exact: true })).toBeVisible();
    await expect(page.getByText("Кол-во задач от агента", { exact: true })).toBeVisible();
  });

  test("opens improvement history modal from deep-link", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=overview&modal=improvement_history");

    await expect(drawerCloseButton(page)).toBeVisible();
    await expect(page.locator(".MuiDialog-paper").last().getByText("История улучшений агента", { exact: true })).toBeVisible();
    await page.getByLabel("Закрыть историю улучшений агента").click();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview$/);
  });
});
