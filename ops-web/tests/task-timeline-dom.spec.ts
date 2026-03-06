import { expect, test } from "@playwright/test";

test("tasks page should not emit DOM nesting warnings", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/#/tasks");
  await expect(page.getByText(/A\/B тест:/)).toBeVisible();

  const hasNestingWarning = consoleErrors.some((item) => item.includes("validateDOMNesting"));
  expect(hasNestingWarning).toBeFalsy();
});
