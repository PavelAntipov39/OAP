import { expect, test, type Page } from "@playwright/test";

const drawerCloseButton = (page: Page) => page.locator('button[aria-label="Закрыть"]').first();

const drawerSurface = (page: Page) => page.locator(".MuiDrawer-paper").last();
const gotoHash = async (page: Page, hash: string) => {
  await page.goto(hash, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#root")).toBeVisible({ timeout: 15_000 });
};

const expectDrawerOpened = async (page: Page) => {
  await expect(drawerSurface(page)).toBeVisible({ timeout: 15_000 });
  await expect(drawerCloseButton(page)).toBeVisible({ timeout: 15_000 });
};

test.describe("Agents deep-link smoke", () => {
  test("shows cross-host smoke status for active top-level set", async ({ page }) => {
    await gotoHash(page, "/#/agents");

    await expect(page.getByText("Синхронизация агентов", { exact: true })).toBeVisible();
    await expect(page.getByText("cross-host smoke", { exact: true })).toBeVisible();
    await expect(page.getByText("Claude Code: ok (4)", { exact: true })).toBeVisible();
    await expect(page.getByText("GitHub Copilot: ok (4)", { exact: true })).toBeVisible();
    await expect(page.getByText("Codex: ok (4)", { exact: true })).toBeVisible();
    await expect(page.getByText("Передача задач: ok", { exact: true })).toBeVisible();
    await expect(page.getByText("Проверяемые агенты", { exact: true })).toHaveCount(0);
  });

  test("opens analyst agent on explicit deeplink and preserves canonical tab", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=analyst-agent&tab=tasks_quality");

    await expectDrawerOpened(page);
    const drawer = drawerSurface(page);
    await expect(drawer.getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview$/);
    await expect(page.getByText("Анализ эффективности агента", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Автономный агент", { exact: true })).toBeVisible();
  });

  test("shows process agent type label for specialist profile", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=ui-verification&tab=overview");

    await expectDrawerOpened(page);
    const drawer = drawerSurface(page);
    await expect(drawer.getByText("Процессный агент", { exact: true })).toBeVisible();
  });

  test("keeps designer overview UX aligned with analyst card controls", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=designer-agent&tab=overview");

    await expectDrawerOpened(page);
    const drawer = drawerSurface(page);

    await expect(drawer.getByText("Продакт дизайнер", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Анализ эффективности агента", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Настроить метрики", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Каталог метрик", { exact: true })).toHaveCount(0);
  });

  test("opens orchestrator agent on explicit deeplink and renders the same overview structure", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=orchestrator-agent&tab=skills_rules");

    await expectDrawerOpened(page);
    const drawer = drawerSurface(page);

    await expect(drawer.getByText("Оркестратор", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=orchestrator-agent&tab=overview$/);
    await expect(drawer.getByText("Анализ эффективности агента", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Как работает ИИ агент", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Рабочий контур агента", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Память", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Риски", { exact: true })).toBeVisible();
    await expect(drawer.getByRole("tab")).toHaveCount(0);

    await gotoHash(page, "/#/agents?agent=orchestrator-agent&tab=overview&modal=improvement_history");
    await expect(page).toHaveURL(/#\/agents\?agent=orchestrator-agent&tab=overview&modal=improvement_history$/);
    await page.getByLabel("Закрыть историю улучшений агента").click();
    await expect(page).toHaveURL(/#\/agents\?agent=orchestrator-agent&tab=overview$/);
  });

  test("canonicalizes legacy agent mcp tab to overview", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=reader-agent&tab=mcp");

    await expectDrawerOpened(page);
    await expect(drawerSurface(page).getByText("Разработчик", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=reader-agent&tab=overview$/);
  });

  test("opens operative memory modal by deeplink and removes modal params on close", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=analyst-agent&tab=overview&modal=operative_memory&entity=latest");

    await expectDrawerOpened(page);
    await expect(drawerSurface(page).getByText("Аналитик", { exact: true })).toBeVisible();
    await expect(page.getByText("Журнал файлов оперативной памяти", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview&modal=operative_memory&entity=/);

    const modal = page.locator('[role="dialog"]').filter({ hasText: "Журнал файлов оперативной памяти" }).first();
    await expect(modal).toBeVisible();
    await modal.getByLabel("Закрыть").click();

    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview$/);
    await expect(page.getByText("Журнал файлов оперативной памяти", { exact: true })).toHaveCount(0);
  });

  test("opens lessons modal by deeplink, switches entity and clears params on close", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=designer-agent&tab=overview&modal=lessons&entity=agent");

    await expectDrawerOpened(page);
    await expect(page.getByText("Уроки агента", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=designer-agent&tab=overview&modal=lessons&entity=agent$/);

    const globalTab = page.locator('button[role="tab"]').filter({ hasText: "Все уроки" }).first();
    await expect(globalTab).toBeVisible();
    await globalTab.click();
    await expect(page).toHaveURL(/#\/agents\?agent=designer-agent&tab=overview&modal=lessons&entity=global$/);

    await page.getByLabel("Закрыть боковую панель уроков").click();
    await expect(page).toHaveURL(/#\/agents\?agent=designer-agent&tab=overview$/);
  });

  test("opens sessions modal by deeplink and clears params on close", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=reader-agent&tab=overview&modal=sessions&entity=latest");

    await expectDrawerOpened(page);
    await expect(page.getByLabel("Закрыть список сессий")).toBeVisible();
    await expect(page.getByText("Сессии цикла пока не зафиксированы.", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=reader-agent&tab=overview&modal=sessions&entity=latest$/);

    await page.getByLabel("Закрыть список сессий").click();
    await expect(page).toHaveURL(/#\/agents\?agent=reader-agent&tab=overview$/);
  });

  test("analyst sessions deeplink keeps latest list with participation marker", async ({ page }) => {
    await gotoHash(page, "/#/agents?agent=analyst-agent&tab=overview&modal=sessions&entity=latest");

    await expectDrawerOpened(page);
    await expect(page.getByLabel("Закрыть список сессий")).toBeVisible();
    await expect(page).toHaveURL(/#\/agents\?agent=analyst-agent&tab=overview&modal=sessions&entity=latest$/);

    const sessionSummaries = page.locator(".MuiAccordionSummary-root");
    const count = await sessionSummaries.count();
    if (count === 0) {
      test.skip(true, "No analyst sessions data available");
      return;
    }

    await expect(sessionSummaries.first().getByText(/direct|delegated/)).toBeVisible();
    const staleWarning = page.getByText("Generated-данные устарели", { exact: false });
    if (await staleWarning.count()) {
      await expect(staleWarning.first()).toBeVisible();
    }
  });
});
