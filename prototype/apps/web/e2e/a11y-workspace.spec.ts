import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page, where: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const summary = results.violations.map(
    (v) => `${where}: ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${where}: horizontal scroll`).toBeLessThanOrEqual(0);
}

for (const width of [360, 1280]) {
  test.describe(`axe WCAG 2.1 AA at ${width}px: journeys 2 and 3`, () => {
    test.use({ viewport: { width, height: 900 } });
    test.setTimeout(120_000);

    test("host, organiser and venue-operator screens", async ({ page }) => {
      await page.goto("/host");
      await scan(page, "host landing");
      await page.getByRole("button", { name: "Switch to Organiser view" }).click();
      await page.getByRole("button", { name: "Create event" }).click();
      await scan(page, "organiser dashboard with EX1");

      await page.goto("/venues/v-lockkeeper");
      await page.getByRole("button", { name: "Switch to Organiser view" }).click();
      await scan(page, "venue page");
      await page.getByRole("button", { name: "Send booking request" }).click();
      await expect(page).toHaveURL(/\/organiser\/bookings\//);
      await scan(page, "booking detail (Pending)");

      await page.getByRole("button", { name: "Switch to Venue operator view" }).click();
      await scan(page, "booking review");
      await page.getByRole("button", { name: "Approve and hold the date" }).click();
      await page.getByRole("button", { name: "Switch to Organiser view" }).click();
      await page.getByRole("button", { name: /deposit · test mode/ }).click();
      await page.getByRole("button", { name: "Create event from this booking" }).click();
      await page.getByRole("button", { name: "Publish event" }).click({ force: true });
      await scan(page, "event editor with EX3");
    });

    test("venue search and listings", async ({ page }) => {
      await page.goto("/");
      await page.goto("/organiser/venues");
      await page.getByRole("button", { name: "Switch to Organiser view" }).click();
      await scan(page, "venue search");
      await page.goto("/venue/listings");
      await page.getByRole("button", { name: "Switch to Venue operator view" }).click();
      await scan(page, "my venues");
      await page.goto("/venue");
      await page.getByRole("button", { name: "Switch to Venue operator view" }).click();
      await scan(page, "requests");
    });

    test("community screens", async ({ page }) => {
      await page.goto("/events/e-harbour/community");
      await scan(page, "community locked");
      await page.goto("/community");
      await scan(page, "community index empty");
      await page.goto("/events/e-harbour");
      await page.getByRole("button", { name: "Get tickets" }).first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Continue to checkout" }).click();
      await page.getByRole("button", { name: /^Pay/ }).click();
      await page.getByRole("link", { name: /Event community/ }).first().click();
      await scan(page, "community page");
    });
  });
}
