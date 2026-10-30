import { createHash } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// Each worktree serves its own out/ on its own port, picked from its path in
// a range clear of common dev servers, so parallel sessions never test one
// another's build. A taken port fails the run rather than being reused.
const PORT_BASE = 20000;
const PORT_SPAN = 10000;
const pathHash = createHash("sha1").update(__dirname).digest();
const port = PORT_BASE + (pathHash.readUInt16BE(0) % PORT_SPAN);

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
    reuseExistingServer: false,
  },
});
