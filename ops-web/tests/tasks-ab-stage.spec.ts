import { expect, test } from "@playwright/test";

test("tasks page exposes A/B stage in status filter", async ({ page }) => {
  await page.goto("/#/tasks");
  await page.getByRole("combobox", { name: "Статус" }).click();
  const abOption = page.locator('[role="option"]').filter({ hasText: /A\/B/ }).first();
  await expect(abOption).toBeVisible();
  await abOption.click();
  await expect(page.getByText(/A\/B тест:/)).toBeVisible();
});
