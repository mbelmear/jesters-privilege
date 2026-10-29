import { defineConfig, devices } from "@playwright/test";

const port = 4173;

// Firefox has no mobile emulation, so its phone project borrows this viewport.
const phone = { width: 390, height: 844 };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  // Phone and desktop sizes for each browser. Pull requests run Chromium and
  // WebKit; Firefox runs on the nightly schedule (see docs/testing.md).
  projects: [
    { name: "chromium-phone", use: { ...devices["Pixel 7"] } },
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-phone", use: { ...devices["iPhone 15"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
    {
      name: "firefox-phone",
      use: { ...devices["Desktop Firefox"], viewport: phone },
    },
    { name: "firefox-desktop", use: { ...devices["Desktop Firefox"] } },
  ],
  // Tests drive the built static export in out/, never the dev server.
  webServer: {
    command: `npx serve out --listen ${port} --no-request-logging`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
});
