import { expect, test, type Page, type Locator } from "@playwright/test";

const overviewUrl = "/#/agents?agent=analyst-agent&tab=overview";
const dialogSurface = ".MuiDialog-paper";

async function openOverview(page: Page): Promise<Locator> {
  await page.goto(overviewUrl);
  const drawer = page.locator(".MuiDrawer-paper").last();
  await expect(drawer.getByText("Эффективность агента", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Ключевые метрики агента", { exact: true })).toBeVisible();
  await expect
    .poll(async () => drawer.getByText("загружаю...", { exact: true }).count(), { timeout: 10_000 })
    .toBe(0);
  return drawer;
}

function metricRow(root: Locator, label: string): Locator {
  return root
    .getByText(label, { exact: true })
    .locator('xpath=ancestor::*[contains(@class,"MuiPaper-root")][1]');
}

test.describe("Analyst agent efficiency metrics", () => {
  test("renders efficiency and key metrics blocks in the analyst card", async ({ page }) => {
    const drawer = await openOverview(page);

    await expect(drawer.getByText("Ср. расход токенов за 1 цикл сессии", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Ср. кол-во ошибок за 1 цикл сессии", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Ср. кол-во задач создано за 1 цикл сессии", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Кол-во задач от агента", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Средний прирост целевой метрики агентов", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Доля рекомендаций с подтвержденным эффектом", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Доля рекомендаций с документально подтверждённой актуальностью", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Посмотреть остальные метрики", { exact: true })).toBeVisible();

    await expect(metricRow(drawer, "Ср. расход токенов за 1 цикл сессии")).toContainText("46.4K");
    await expect(metricRow(drawer, "Кол-во задач от агента")).toContainText("5");
    await expect(metricRow(drawer, "Средний прирост целевой метрики агентов")).toContainText("17.5 п.п.");
  });

  test("opens the cycle errors modal from the average errors metric", async ({ page }) => {
    const drawer = await openOverview(page);

    const errorMetric = metricRow(drawer, "Ср. кол-во ошибок за 1 цикл сессии");
    await errorMetric.locator("button").click();

    const dialog = page.locator(dialogSurface).last();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Ошибки по циклам агента", { exact: true })).toBeVisible();
    await expect(dialog.getByText("context7 MCP деградирует второй день подряд", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Среднее на цикл:", { exact: false })).toBeVisible();
    await expect(dialog.getByText("Циклов в расчете:", { exact: false })).toBeVisible();
  });

  test("opens additional metrics modal and shows tooltip details", async ({ page }) => {
    const drawer = await openOverview(page);

    const tasksMetric = metricRow(drawer, "Кол-во задач от агента");
    await tasksMetric.locator('[data-testid="InfoOutlinedIcon"]').hover();

    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toContainText("Формула:");
    await expect(tooltip).toContainText("Источник:");
    await expect(tooltip).toContainText("Пример:");

    await drawer.getByText("Посмотреть остальные метрики", { exact: true }).click();

    const dialog = page.locator(dialogSurface).last();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Остальные метрики эффективности", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Успех верификации", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Исполнимость рекомендаций", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Benchmark pass@5", { exact: true })).toBeVisible();
  });
});
