import { expect, switchRole, test } from "./fixtures";

test.describe("Journey 1: attendee discovers and buys", () => {
  test("What's on → event page → ticket modal → checkout → My tickets", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find something");
    await expect(page.getByRole("link", { name: "What’s on" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("result-count")).toHaveText("7 local events");

    // Map pins carry the event name, not just the price.
    await expect(
      page.getByRole("button", { name: "The Corner House Sessions, Sat, 21 Nov, from €22" }),
    ).toBeVisible();

    // The event card is reachable and opens with the keyboard.
    const cardLink = page.getByRole("link", { name: "The Corner House Sessions" });
    await cardLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/events\/e-cornerhouse$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Corner House Sessions");

    // FR 40: venue, nearest stop with walking distance, organiser rating.
    await expect(page.getByText("Luas Red Line · Smithfield")).toBeVisible();
    await expect(page.getByText(/150 m, about 2 min walk/)).toBeVisible();
    await expect(page.getByText("4.8", { exact: true })).toBeVisible();

    // Ticket modal: dialog semantics, focus trap, Escape, focus return.
    const getTickets = page.getByRole("button", { name: "Get tickets" }).first();
    await getTickets.click();
    const dialog = page.getByRole("dialog", { name: "The Corner House Sessions" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(getTickets).toBeFocused();

    // Choose two tickets.
    await getTickets.click();
    await dialog.getByRole("button", { name: "Add one General admission ticket" }).click();
    await expect(dialog.getByTestId("modal-total")).toHaveText("€44.00");
    await dialog.getByRole("button", { name: "Continue to checkout" }).click();

    // FR 47: full price before payment. TT1: tickets are Reserved and held.
    await expect(page).toHaveURL(/\/checkout\//);
    await expect(page.getByTestId("hold-timer")).toContainText("2 tickets held for you");
    await expect(page.getByText("Booking fee")).toBeVisible();
    await expect(page.getByText("Included", { exact: true })).toBeVisible();
    await expect(page.getByTestId("checkout-total")).toHaveText("€44.00");
    await page.getByRole("button", { name: "Pay €44.00 · test mode" }).click();

    // FR 50: Paid tickets with a QR placeholder in My tickets.
    await expect(page).toHaveURL(/\/tickets$/);
    const order = page.getByTestId("ticket-order").filter({ hasText: "The Corner House Sessions" });
    await expect(order).toBeVisible();
    await expect(order.getByRole("img", { name: /QR code placeholder for ticket/ })).toHaveCount(2);
    await expect(order.getByText("Ticket status: Paid", { exact: true })).toHaveCount(2);

    // Past ticket from the seed shows the Checked In state.
    await expect(page.getByRole("link", { name: "Samhain Céilí" })).toBeVisible();
    await expect(page.getByText("Ticket status: Checked In", { exact: true })).toBeVisible();
  });

  test("TX1: a Sold Out event can't be bought", async ({ page }) => {
    await page.goto("/events/e-latestudio");
    const getTickets = page.getByRole("button", { name: "Get tickets" }).first();
    await expect(getTickets).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("#tickets-blocked")).toContainText("TX1");
    await getTickets.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#tickets-blocked")).toBeFocused();
  });

  test("TT3: an expired hold releases the tickets", async ({ page }) => {
    await page.goto("/events/e-bigtable");
    await page.getByRole("button", { name: "Get tickets" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Continue to checkout" }).click();
    await expect(page).toHaveURL(/\/checkout\//);
    await page.getByRole("button", { name: "Demo: let the hold expire now" }).click();
    await expect(page.locator("#hold-ended")).toContainText("TT3");
    await expect(page.getByRole("button", { name: /^Pay/ })).toHaveCount(0);
    // Stock returned: still 8 seats left on the event page.
    await page.getByRole("link", { name: "Choose tickets again" }).click();
    await expect(page.getByText("Only 8 left")).toBeVisible();
  });

  test("filters, save and the filter drawer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Arts & culture" }).click();
    await expect(page.getByTestId("result-count")).toHaveText("1 local event");
    await page.getByRole("button", { name: /^Saved/ }).click();
    await expect(page.getByTestId("result-count")).toHaveText("1 local event");
    await page.getByRole("button", { name: "All events" }).click();

    const save = page.getByRole("button", { name: "Save The Corner House Sessions" });
    await save.click();
    await expect(save).toHaveAttribute("aria-pressed", "true");

    const filters = page.getByRole("button", { name: /Filters/ });
    await expect(filters).toHaveAttribute("aria-expanded", "false");
    await filters.click();
    await expect(filters).toHaveAttribute("aria-expanded", "true");
    const solo = page.getByRole("switch", { name: "Welcoming if you’re coming on your own" });
    await solo.click();
    await expect(solo).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("result-count")).toHaveText("6 local events");

    await page.getByRole("searchbox", { name: "What" }).fill("harbour");
    await expect(page.getByTestId("result-count")).toHaveText("1 local event");
  });

  test("role switcher changes the navigation (FR 4)", async ({ page }) => {
    await page.goto("/");
    await switchRole(page, "Organiser");
    await expect(page).toHaveURL(/\/organiser$/);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Find a venue" })).toBeVisible();
  });
});
