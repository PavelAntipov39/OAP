import { expect, test } from "@playwright/test";

test.describe("Analyst operative memory modal", () => {
  test("shows active-list chips with human labels and raw tooltips", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=overview&modal=operative_memory&entity=latest");

    const modal = page.locator('[role="dialog"]').filter({ hasText: "Журнал файлов оперативной памяти" }).first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    await expect(modal.getByText("Используемые документы сейчас", { exact: true })).toBeVisible();
    await expect(modal.getByText("Active-set на конец сессии", { exact: false })).toBeVisible();
    const sourceChip = modal.locator('[aria-label^="source-kind-chip:"]').first();
    const layerChip = modal.locator('[aria-label^="semantic-layer-chip:"]').first();
    await expect(sourceChip).toBeVisible();
    await expect(layerChip).toBeVisible();
    await expect(sourceChip).not.toContainText("Источник:");
    await expect(layerChip).not.toContainText("Контур:");

    await sourceChip.hover();
    await expect(page.getByText(/raw:\s*source_kind=/i).first()).toBeVisible();

    await layerChip.hover();
    await expect(page.getByText(/raw:\s*semantic_layer=/i).first()).toBeVisible();

    const unknownSourceChip = modal.locator('[aria-label="source-kind-chip:unknown"]').first();
    const unknownSourceCount = await unknownSourceChip.count();
    if (unknownSourceCount > 0) {
      await expect(unknownSourceChip).toContainText("Unknown");
      await unknownSourceChip.hover();
      await expect(page.getByText(/producer не передал детализацию/i).first()).toBeVisible();
    }
  });

  test("shows write transparency details when write operations exist", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=overview&modal=operative_memory&entity=latest");

    const modal = page.locator('[role="dialog"]').filter({ hasText: "Журнал файлов оперативной памяти" }).first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    const operationsSection = modal.getByRole("heading", { name: "Лента операций", exact: true }).locator("xpath=..");
    const writeChipLabels = operationsSection.getByText(/^write$/);
    const writeOperationsCount = await writeChipLabels.count();
    if (writeOperationsCount === 0) {
      test.skip(true, "No write operations in operative memory trace");
      return;
    }

    await writeChipLabels.first().click();

    const visibleChangeBlock = operationsSection.locator("pre:visible").filter({ hasText: /что_записано:\s*/i }).first();
    await expect(visibleChangeBlock).toBeVisible();
    await expect(visibleChangeBlock).toContainText(/operation_kind:\s*write/i);
    await expect(visibleChangeBlock).toContainText(/step:\s*/i);
    await expect(visibleChangeBlock).toContainText(/reason:\s*/i);
    await expect(visibleChangeBlock).toContainText(/source:\s*/i);
    await expect(visibleChangeBlock).toContainText(/что_записано:\s*/i);
    await expect(visibleChangeBlock).toContainText(/куда_записано:\s*/i);
    await expect(visibleChangeBlock).toContainText(/тип_записи:\s*(создано|обновлено|записано)/i);
    await expect(visibleChangeBlock).toContainText(/target_path:\s*/i);

    const visibleChangePanel = visibleChangeBlock.locator('xpath=ancestor::div[contains(@class,"MuiBox-root")][1]');
    await expect(visibleChangePanel.getByText(/точный diff до\/после не зафиксирован telemetry/i)).toBeVisible();
    await expect(visibleChangePanel.getByText(/Current preview/i)).toHaveCount(0);
  });
});
