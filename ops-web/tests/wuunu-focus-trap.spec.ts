import { expect, test } from "@playwright/test";

test("wuunu widget must not stay aria-hidden when MUI drawer opens", async ({ page }) => {
  test.skip(
    process.env.VITE_ENABLE_WUUNU !== "true" && process.env.VITE_ENABLE_WUUNU !== "1",
    "WUUNU behavior is only relevant when VITE_ENABLE_WUUNU is enabled.",
  );

  await page.goto("/#/tasks");
  await expect(page.getByRole("heading", { name: "Задачи" })).toBeVisible();

  const firstTaskButton = page.locator("tbody tr td:first-child button").first();
  await firstTaskButton.click();
  await expect(page.locator(".MuiModal-root")).toBeVisible();

  await page.evaluate(() => {
    const widget = document.querySelector("wuunu-widget");
    if (widget) widget.setAttribute("aria-hidden", "true");
  });

  await expect
    .poll(async () => {
      return page.evaluate(() => document.querySelector("wuunu-widget")?.getAttribute("aria-hidden") ?? null);
    })
    .toBeNull();
});
