import { expect, test } from "@playwright/test";

test("wuunu widget script is not injected when WUUNU is disabled", async ({ page }) => {
  test.skip(
    process.env.VITE_ENABLE_WUUNU === "true" || process.env.VITE_ENABLE_WUUNU === "1",
    "This regression check is only relevant when WUUNU is disabled.",
  );

  await page.goto("/");

  const script = page.locator("#wuunu-widget-script");
  const widget = page.locator("wuunu-widget");

  await expect(script).toHaveCount(0);
  await expect(widget).toHaveCount(0);
});
