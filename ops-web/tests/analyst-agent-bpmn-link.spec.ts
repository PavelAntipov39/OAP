import { expect, test } from "@playwright/test";

test("analyst BPMN file path opens agent flow instead of empty text modal", async ({ page }) => {
  await page.goto("/#/agents?agent=analyst-agent&tab=overview");

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "docs/bpmn/analyst-agent-flow.bpmn" }).click();
  const popup = await popupPromise;

  await expect(popup).toHaveURL(/#\/agent-flow$/);
  await expect(popup.getByRole("heading", { name: "Agent Flow: analyst-agent" })).toBeVisible();

  await expect(page.getByText("Содержимое файла `docs/bpmn/analyst-agent-flow.bpmn` не найдено в индексе документов.")).toHaveCount(0);
});
