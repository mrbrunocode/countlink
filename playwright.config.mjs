// Cross-browser E2E config.
//
// Why this exists: the settable board (see README § "The board is the input")
// is the first thing on this site that is genuinely interaction-heavy —
// pointer events, focus-driven affordances, keyboard entry, wheel, touch drag
// and clipboard paste. Every one of those is somewhere engines actually
// differ, and the unit tests in test/ deliberately cover only the pure
// duration model, which can't catch any of it. A paste handler bound to the
// wrong element, for instance, worked perfectly in Chromium and did nothing
// at all in WebKit.
//
// The suite runs against the real dev server serving the real built files, so
// what's tested is what deploys.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4176; // deliberately not 4175 — leaves a hand-run `npm run dev` alone

export default defineConfig({
  testDir: "./e2e",
  // The board is time-sensitive in places (the finished-state tests start a
  // 1-2s countdown), so keep workers modest rather than hammering one machine.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 20_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    // Real touch emulation, not just a narrow viewport: hover does not exist
    // here, so the tap-to-reveal path is the only way in. iPhone runs WebKit
    // and Pixel runs Chromium, which is the split that actually matters.
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],

  webServer: {
    // Build first so the suite tests the generated pages, not stale ones.
    command: `node scripts/build-timer-pages.mjs && node scripts/dev-server.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
