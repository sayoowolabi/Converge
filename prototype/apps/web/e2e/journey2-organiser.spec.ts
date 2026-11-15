import type { Page } from "@playwright/test";
import { expect, switchRole, test } from "./fixtures";

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/**
 * Journey 2 runs in one page session: state is in memory, so the test only
 * navigates by clicking (page.goto would reset the demo data).
 */
test("Journey 2: book a venue, approve, confirm, create and publish an event", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await switchRole(page, "Organiser");
  await expect(h1(page)).toHaveText("Your dashboard");

  // EX1: no Confirmed booking yet, so no event.
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(page.locator("#create-blocked")).toContainText("EX1");
  await expect(page.locator("#create-blocked")).toBeFocused();

  // FR 15: venue search with guests, date, distance and nearest stop.
  await page.getByRole("navigation").getByRole("link", { name: "Find a venue" }).click();
  await expect(page.getByTestId("venue-count")).toHaveText("3 venues");
  const lockKeeper = page.getByTestId("venue-card").filter({ hasText: "The Lock Keeper's Room" });
  await expect(lockKeeper).toContainText("Luas Charlemont, 400 m (5 min walk)");
  await expect(lockKeeper).toContainText("Available for your time");
  await lockKeeper.getByRole("link", { name: "The Lock Keeper's Room" }).click();

  // FR 16 + FR 19: venue page, request → Pending.
  await expect(h1(page)).toHaveText("The Lock Keeper's Room");
  await expect(page.getByLabel("Date")).toHaveValue("2026-12-12");
  await page.getByLabel("Message to the venue").fill("Winter supper club for about 60, long tables please.");
  await page.getByRole("button", { name: "Send booking request" }).click();
  await expect(page).toHaveURL(/\/organiser\/bookings\//);
  await expect(page.getByText("Booking status: Pending")).toBeVisible();

  // Switch to Venue operator and approve (BT2).
  await page.getByRole("button", { name: "Switch to Venue operator view" }).click();
  await expect(page).toHaveURL(/\/venue\/bookings\//);
  await expect(page.getByRole("heading", { name: "Clashing bookings" })).toBeVisible();
  await page.getByRole("button", { name: "Approve and hold the date" }).click();
  await expect(page.getByText("Booking status: Approved").first()).toBeVisible();

  // BX2: the overlapping Pending request from Dublin Board Gamers can no longer be approved.
  await page.getByRole("navigation").getByRole("link", { name: "Requests" }).click();
  const niamh = page.getByTestId("request-row").filter({ hasText: "Dublin Board Gamers" });
  await expect(niamh).toContainText("Clashes");
  await niamh.getByRole("link").click();
  const approve = page.getByRole("button", { name: "Approve and hold the date" });
  await expect(approve).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#approve-blocked")).toContainText("BX2");

  // Back to our own booking, then switch to Organiser to pay the deposit (BT6).
  await page.getByRole("link", { name: "View" }).first().click();
  await page.getByRole("button", { name: "Switch to Organiser view" }).click();
  await expect(page).toHaveURL(/\/organiser\/bookings\//);
  await page.getByRole("button", { name: "Pay €100.00 deposit · test mode" }).click();
  await expect(page.getByText("Booking status: Confirmed")).toBeVisible();

  // ET1: create the event from the Confirmed booking.
  await page.getByRole("button", { name: "Create event from this booking" }).click();
  await expect(page).toHaveURL(/\/organiser\/events\//);
  await page.getByLabel("Title").fill("Liberties Winter Supper Club");

  // EX3: can't publish without a ticket type.
  const publish = page.getByRole("button", { name: "Publish event" });
  await expect(publish).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#publish-blocked")).toContainText("EX3");

  // FR 28: add a ticket type, then publish (ET2).
  await page.getByLabel("Name", { exact: true }).fill("Supper seat");
  await page.getByLabel("Price (€)").fill("35");
  await page.getByLabel("Quantity").fill("60");
  await page.getByRole("button", { name: "Add ticket type" }).click();
  await expect(page.getByRole("row", { name: /Supper seat/ })).toBeVisible();
  await publish.click();
  await expect(page.getByTestId("publish-success")).toBeVisible();
  await expect(page.getByText("Event status: Published").first()).toBeVisible();

  // The event appears on the attendee map.
  await page.getByRole("link", { name: "See it on the map" }).click();
  await expect(page.getByTestId("result-count")).toHaveText("8 local events");
  await expect(
    page.getByRole("button", { name: "Liberties Winter Supper Club, Sat, 12 Dec, from €35" }),
  ).toBeVisible();
});

test("BX1: can't request a slot already Confirmed for another organiser", async ({ page }) => {
  await page.goto("/venues/v-loft?date=2026-12-05&from=19:00&to=22:00&guests=40");
  await page.getByRole("button", { name: "Switch to Organiser view" }).click();
  await page.getByRole("button", { name: "Send booking request" }).click();
  await expect(page.locator("#request-error")).toContainText("BX1");
  await expect(page.locator("#request-error")).toBeFocused();
});

test("Booking request outside availability is refused (Mondays closed)", async ({ page }) => {
  await page.goto("/venues/v-forge?date=2026-12-07&from=19:00&to=22:00&guests=40");
  await page.getByRole("button", { name: "Switch to Organiser view" }).click();
  await page.getByRole("button", { name: "Send booking request" }).click();
  await expect(page.locator("#request-error")).toContainText("Outside the venue's availability");
});

test("Venue operator pages are role-gated (FR 4)", async ({ page }) => {
  await page.goto("/venue");
  await expect(h1(page)).toHaveText("This page is part of the Venue operator view");
  await page.getByRole("button", { name: "Switch to Venue operator view" }).click();
  await expect(h1(page)).toHaveText("Booking requests");
});
