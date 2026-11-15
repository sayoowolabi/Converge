import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end and accessibility tests for the prototype (DECISIONS D-021).
 * Chromium only. Starts the Vite dev server unless one is already running.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "corepack pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
