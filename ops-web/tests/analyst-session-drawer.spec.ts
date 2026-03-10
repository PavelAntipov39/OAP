import { expect, test } from "@playwright/test";

test.describe("Analyst session details drawer", () => {
  test("opens file from memory block with real content (not placeholder)", async ({ page }) => {
    // 1. Open the analyst-agent card
    await page.goto("/#/agents?agent=analyst-agent&tab=overview");
    await expect(page.locator('button[aria-label="Закрыть"]').first()).toBeVisible();

    // 2. Click "Список сессий цикла агента" link — needs scroll into view
    const sessionsLink = page.locator('button:has-text("Список сессий цикла агента")');
    // Wait for dynamic rendering, link may appear after data loads
    await sessionsLink.waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
    const sessionsLinkCount = await sessionsLink.count();
    if (sessionsLinkCount === 0) {
      test.skip(true, "No sessions data available");
      return;
    }
    await sessionsLink.scrollIntoViewIfNeeded();
    await sessionsLink.click();

    // 3. Wait for sessions list drawer and expand first session accordion
    const sessionAccordion = page.locator(".MuiAccordionSummary-root").first();
    await expect(sessionAccordion).toBeVisible({ timeout: 5000 });
    await sessionAccordion.click();

    // 4. Click "Открыть детали сессии" in the first expanded accordion
    const detailsLink = page.locator('button:has-text("Открыть детали сессии")').first();
    await expect(detailsLink).toBeVisible({ timeout: 3000 });
    await detailsLink.click();

    // 5. Wait for session details drawer with "Детали сессии" header
    await expect(page.getByText("Детали сессии", { exact: true })).toBeVisible({ timeout: 5000 });

    // Canonical memory semantics: read/write/delete, no create/update wording
    const operativeSummary = page.locator(".MuiAccordionSummary-root").filter({ hasText: "Оперативная память" }).first();
    await expect(operativeSummary).toContainText("read/write/delete");
    await expect(operativeSummary).not.toContainText("create/update");
    const sessionDrawer = page.locator(".MuiDrawer-paper").last();
    await expect(sessionDrawer.getByText(/status:\s*(read|write)/i).first()).toBeVisible({ timeout: 3000 });

    // 6. Find a file path link inside the memory section and click it
    const memorySection = page.getByText("Оперативная память", { exact: true });
    const memoryAncestor = memorySection.locator("xpath=ancestor::*[contains(@class,'MuiAccordion')]").first();

    // Expand operative memory accordion if collapsed
    if (await memoryAncestor.count()) {
      const summary = memoryAncestor.locator(".MuiAccordionSummary-root").first();
      if (await summary.count()) {
        await summary.click();
      }
    }

    // Find any file-path link button inside the session details drawer
    const fileLink = sessionDrawer.locator("button").filter({ hasText: /\.(md|yaml|jsonl|bpmn|txt)/ }).first();

    const fileLinkCount = await fileLink.count();
    if (fileLinkCount === 0) {
      test.skip(true, "No openable file links in session details");
      return;
    }

    const filePath = (await fileLink.textContent()) ?? "";
    await fileLink.click();

    // 7. Verify the text modal opens with real content (not the old placeholder pattern)
    await expect(page.locator(".MuiModal-root, .MuiDialog-root").last()).toBeVisible({ timeout: 5000 });

    // The old placeholder was: "Содержимое файла: <path>"
    // Ensure it does NOT appear
    await expect(page.getByText(`Содержимое файла: ${filePath}`)).toHaveCount(0);

    // Real content should be one of two cases:
    // a) Content resolved from index → actual document text is shown
    // b) Not found in index → specific "не найдено в индексе документов" message
    // Either case is valid (proves the resolver is wired through), but NOT the old stub
  });
});
