import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

export async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const width of [360, 1280]) {
  test.describe(`axe WCAG 2.1 AA at ${width}px: journey 1`, () => {
    test.use({ viewport: { width, height: 900 } });

    test("What's on", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: /Filters/ }).click();
      await scan(page);
      await noHorizontalScroll(page);
    });

    test("Event page and ticket dialog", async ({ page }) => {
      await page.goto("/events/e-afterdark");
      await scan(page);
      await noHorizontalScroll(page);
      await page.getByRole("button", { name: "Get tickets" }).first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await scan(page);
    });

    test("Sold Out event page", async ({ page }) => {
      await page.goto("/events/e-latestudio");
      await scan(page);
    });

    test("Checkout and My tickets", async ({ page }) => {
      await page.goto("/events/e-harbour");
      await page.getByRole("button", { name: "Get tickets" }).first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Continue to checkout" }).click();
      await expect(page).toHaveURL(/\/checkout\//);
      await scan(page);
      await noHorizontalScroll(page);
      await page.getByRole("button", { name: /^Pay/ }).click();
      await expect(page).toHaveURL(/\/tickets$/);
      await scan(page);
      await noHorizontalScroll(page);
    });
  });
}

test("prefers-reduced-motion turns off transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page
    .locator(".event-image")
    .first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
});
