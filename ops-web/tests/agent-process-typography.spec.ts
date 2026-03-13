import { expect, test, type Locator } from "@playwright/test";

type TextStyle = {
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
};

async function readStyle(locator: Locator): Promise<TextStyle> {
  return locator.evaluate((element: Element) => {
    const style = window.getComputedStyle(element as HTMLElement);
    return {
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
    };
  });
}

test.describe("Agent process section typography", () => {
  test("keeps action items in a single typography rhythm for analyst overview", async ({ page }) => {
    await page.goto("/#/agents?agent=analyst-agent&tab=overview");
    await expect(page.locator('button[aria-label="Закрыть"]').first()).toBeVisible({ timeout: 15_000 });

    const reference = page.locator('button:has-text("Описание правил работы агента")').first();
    const history = page.locator('button:has-text("История улучшений агента")').first();
    const sessions = page.locator('button:has-text("Список сессий цикла агента")').first();
    const lessons = page.locator('button:has-text("Самоулучшение агента (Self-improvement loop):")').first();

    await expect(reference).toBeVisible();
    await expect(history).toBeVisible();
    await expect(sessions).toBeVisible();
    await expect(lessons).toBeVisible();

    const referenceStyle = await readStyle(reference);
    const historyStyle = await readStyle(history);
    const sessionsStyle = await readStyle(sessions);
    const lessonsStyle = await readStyle(lessons);

    expect(historyStyle).toEqual(referenceStyle);
    expect(sessionsStyle).toEqual(referenceStyle);
    expect(lessonsStyle).toEqual(referenceStyle);
  });

  test("shows updated designer UX-gate wording for states and typography", async ({ page }) => {
    await page.goto("/#/agents?agent=designer-agent&tab=overview");
    await expect(page.locator('button[aria-label="Закрыть"]').first()).toBeVisible({ timeout: 15_000 });

    const rulesLink = page.locator('button:has-text("Описание правил работы агента")').first();
    await expect(rulesLink).toBeVisible();
    await rulesLink.click();

    await expect(page.getByText(/Консистентност[ьи] состояний и типографики/i)).toBeVisible();
  });
});
