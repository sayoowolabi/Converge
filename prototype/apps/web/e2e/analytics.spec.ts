import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function openAs(page: Page, path: string, role: "Organiser" | "Venue operator") {
  await page.goto(path);
  await page.getByRole("button", { name: `Switch to ${role} view` }).click();
  await expect(page.getByTestId("insights")).toBeVisible();
}

test.describe("Analytics dashboards (FR 67–FR 71)", () => {
  test("venue dashboard finds the Thursday vs Friday bar-spend insight with its evidence", async ({ page }) => {
    await openAs(page, "/venue/analytics", "Venue operator");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Venue analytics");
    await expect(page.getByText("Synthetic demo data")).toBeVisible();

    const insight = page
      .getByTestId("insight")
      .filter({ hasText: /Events held on Thursdays with ticket prices between €10 and €15 generated \d+% higher bar revenue per attendee than comparable Friday events\./ });
    await expect(insight).toHaveCount(1);
    await insight.getByText("How this was worked out").click();
    await expect(insight).toContainText("95% CI");
    await expect(insight).toContainText(/\d+ events/);
    await expect(insight).toContainText("Bonferroni");

    // FR 69: bar sales by 15-minute interval with the peak named.
    await expect(page.getByText(/Peak: 45–60 min/)).toBeVisible();
  });

  test("organiser dashboard: KPIs, forecast flag and table view", async ({ page }) => {
    await openAs(page, "/organiser/analytics", "Organiser");
    await expect(page.getByText("Tickets sold", { exact: true })).toBeVisible();

    // FR 70: the under-selling event is flagged, and its pace chart is shown.
    const midwinter = page.getByTestId("forecast-card").filter({ hasText: "Midwinter Long Table" });
    await expect(midwinter).toContainText("Tracking below similar events");
    await expect(page.getByRole("img", { name: /Sales pace for Midwinter Long Table/ })).toBeVisible();
    await expect(
      page.getByTestId("insight").filter({ hasText: /Midwinter Long Table is tracking \d+% below similar events/ }),
    ).toHaveCount(1);

    // Every chart has a table view.
    const card = page.locator(".chart-card").filter({ hasText: "Ticket revenue by month" });
    await card.getByRole("button", { name: "Show table" }).click();
    await expect(card.getByRole("table")).toBeVisible();
    await expect(card.getByRole("row", { name: /Jan/ })).toBeVisible();
  });

  test("the period filter re-scopes every figure; small samples give no segment claims", async ({ page }) => {
    await openAs(page, "/organiser/analytics", "Organiser");
    const sold = page.locator(".stat-tile.hero .stat-value");
    const ytd = await sold.textContent();
    await page.getByRole("radio", { name: "Last 3 months" }).check();
    await expect(sold).not.toHaveText(ytd ?? "");
    await expect(page.locator(".stat-tile.hero")).toContainText("vs previous 3 months");
    // With ~a quarter of the events, weekday comparisons don't reach 8 per group, so only the forecast flag remains.
    await expect(page.getByTestId("insight")).toHaveCount(1);
    await expect(page.getByTestId("insight")).toContainText("Midwinter Long Table");
  });

  test("insights are reproducible (seeded) across reloads", async ({ page }) => {
    await openAs(page, "/venue/analytics", "Venue operator");
    const first = await page.getByTestId("insight").allTextContents();
    await openAs(page, "/venue/analytics", "Venue operator");
    expect(await page.getByTestId("insight").allTextContents()).toEqual(first);
  });

  for (const width of [360, 1280]) {
    test(`axe WCAG 2.1 AA and no horizontal scroll at ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      for (const [path, role] of [
        ["/organiser/analytics", "Organiser"],
        ["/venue/analytics", "Venue operator"],
      ] as const) {
        await openAs(page, path, role);
        await page.locator("details summary").first().click();
        const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
        const summary = results.violations.map(
          (v) => `${path}: ${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        );
        expect(summary, summary.join("\n")).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${path}: horizontal scroll`).toBeLessThanOrEqual(0);
      }
    });
  }
});
