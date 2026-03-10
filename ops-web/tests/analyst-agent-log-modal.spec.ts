import { expect, test } from "@playwright/test";

test.describe("Analyst agent action log modal", () => {
  const journalButton = 'button:has-text("Журнал действий агента")';
  const journalFileButton = 'button:has-text(".logs/agents/analyst-agent.jsonl")';
  const dialogSurface = ".MuiDialog-paper";

  test("opens the same journal viewer from title and file link", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=overview");

    await expect(page.locator(journalButton).first()).toBeVisible();

    await page.locator(journalButton).first().click();
    const dialog = page.locator(dialogSurface).last();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Последнее событие:", { exact: false })).toBeVisible();

    await page.getByLabel("Закрыть журнал действий агента").click();
    await expect(page.locator(dialogSurface)).toHaveCount(0);

    await page.locator(journalFileButton).first().click();
    await expect(page.locator(dialogSurface).last()).toBeVisible();
    await expect(page.locator(dialogSurface).last().getByText("Последнее событие:", { exact: false })).toBeVisible();
  });

  test("keeps trace searchable while hiding default process noise", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=overview");

    await page.locator(journalButton).first().click();

    const dialog = page.locator(dialogSurface).last();
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText("vibe_coding");
    await expect(dialog).not.toContainText("Процесс:");

    const search = page.getByLabel("Поиск по дате, времени, шагу, статусу, trace, outcome");
    await search.fill("2894015918cf4a13bf969e7d8c21bd09");
    await expect(dialog.getByText(/Найдено событий: 1 из \d+/)).toBeVisible();

    await dialog.locator(".MuiAccordionSummary-root").first().click();
    await expect(dialog.getByText(/trace_id:/)).toBeVisible();
    await expect(dialog.getByText(/Строка в логе:/)).toBeVisible();
    await expect(dialog).not.toContainText("recommendation_id: не зафиксировано");
  });

  test("renders a compact fallback when both artifact groups are empty", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=overview");

    await page.locator(journalButton).first().click();

    const dialog = page.locator(dialogSurface).last();
    await expect(dialog).toBeVisible();
    const search = page.getByLabel("Поиск по дате, времени, шагу, статусу, trace, outcome");
    await search.fill("Anthropic");
    await expect(dialog.getByText(/Найдено событий: 1 из \d+/)).toBeVisible();

    await dialog.locator(".MuiAccordionSummary-root").first().click();
    await expect(dialog.getByText("Артефакты", { exact: true })).toBeVisible();
    await expect(dialog.getByText("не зафиксировано")).toBeVisible();
    await expect(dialog.getByText("Прочитано")).toHaveCount(0);
    await expect(dialog.getByText("Записано")).toHaveCount(0);
  });
});
