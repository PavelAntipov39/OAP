import { expect, test } from "@playwright/test";

test("analyst BPMN file path opens actual BPMN file content", async ({ page }) => {
  await page.goto("/#/agents?agent=analyst-agent&tab=overview");

  await expect(page.locator('button[aria-label="Закрыть"]').first()).toBeVisible();

  const bpmnFileButton = page.locator('button:has-text("docs/bpmn/analyst-agent-flow.bpmn")').first();
  await expect(bpmnFileButton).toBeVisible();

  await bpmnFileButton.click();
  await expect(page.getByText("BPMN:", { exact: false }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("<?xml version=\"1.0\" encoding=\"UTF-8\"?>").first()).toBeVisible();
  await expect(page.getByText("Содержимое файла `docs/bpmn/analyst-agent-flow.bpmn` не найдено в индексе документов.")).toHaveCount(0);
});
