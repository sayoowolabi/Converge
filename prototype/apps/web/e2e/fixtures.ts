import { test as base, expect, type Page } from "@playwright/test";

/**
 * Block remote images and fonts so tests are fast and deterministic offline.
 * Layout doesn't depend on them (image boxes have fixed sizes and a background).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/images\.unsplash\.com|fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
    await use(page);
  },
});
export { expect };

/** Switch role view through the profile menu (desktop layout). */
export async function switchRole(page: Page, role: "Attendee" | "Organiser" | "Venue operator") {
  await page.getByRole("button", { name: /account and role menu/i }).click();
  await page.getByRole("radio", { name: new RegExp(`^${role}`) }).click();
}
