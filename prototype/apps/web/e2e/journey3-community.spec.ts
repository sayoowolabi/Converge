import { expect, test } from "./fixtures";

test("Journey 3: community opens after buying a ticket (FR 58, FR 59, FR 60)", async ({ page }) => {
  // Locked before buying.
  await page.goto("/events/e-cornerhouse/community");
  await expect(page.locator("#community-locked")).toContainText("For ticket holders only");

  // Buy a ticket (client-side navigation keeps the in-memory state).
  await page.getByRole("link", { name: "Get tickets" }).click();
  await page.getByRole("button", { name: "Get tickets" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Continue to checkout" }).click();
  await page.getByRole("button", { name: /^Pay/ }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  // Community tab now lists the event.
  await page.getByRole("navigation").getByRole("link", { name: "Community" }).click();
  // The demo user also organises two events, so their communities are listed too (FR 58: organiser access).
  await expect(page.getByTestId("community-row").filter({ hasText: "The Corner House Sessions" })).toHaveCount(1);
  await page.getByRole("link", { name: "The Corner House Sessions" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Corner House Sessions");

  // Existing posts and "coming on their own" list are visible.
  await expect(page.getByText("Coming on my own. Happy to meet anyone")).toBeVisible();
  const alone = page.getByTestId("alone-list");
  await expect(alone).toContainText("Nadia Okafor");
  await expect(alone).toContainText("You both like Trad & folk");

  // FR 60: mark myself as attending alone.
  const solo = page.getByRole("switch", { name: "I'm coming on my own" });
  await solo.click();
  await expect(solo).toHaveAttribute("aria-checked", "true");
  await expect(alone).toContainText("Aoife Kelly (you)");

  // FR 59: post, reply, delete my own post.
  await page.getByLabel("Write a post").fill("Anyone fancy a pint in the front bar at 7?");
  await page.getByRole("button", { name: "Post as Aoife Kelly" }).click();
  await expect(page.getByText("Anyone fancy a pint in the front bar at 7?")).toBeVisible();

  await page.getByRole("button", { name: "Reply to Nadia Okafor" }).click();
  await page.getByLabel("Reply to Nadia Okafor").fill("I'll be there, say hi!");
  await page.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText("I'll be there, say hi!")).toBeVisible();

  await page
    .getByRole("article", { name: "Post by Aoife Kelly" })
    .filter({ hasText: "front bar at 7" })
    .getByRole("button", { name: "Delete your post" })
    .click();
  await expect(page.getByText("Anyone fancy a pint in the front bar at 7?")).toHaveCount(0);
});
