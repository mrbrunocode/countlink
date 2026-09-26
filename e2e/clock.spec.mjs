// Clock correction, as a room sees it.
//
// A projector PC whose clock is 2 min 14 s slow used to show a shared
// 10-minute countdown as 12:14 — the link was right, the screen was wrong.
// clock.js now measures the device against /api/now and corrects. Here the
// "server" is made to disagree with the browser by a known amount (the
// route below), which is indistinguishable, from the page's point of view,
// from the device's own clock being wrong by that amount.
import { test, expect } from "@playwright/test";
import { boardValue } from "./helpers.mjs";

const SLOW_BY_MS = 134_000; // this device is 2 min 14 s behind real time

test("a device with a slow clock still shows the shared countdown correctly, and says why", async ({ page }) => {
  await page.route("**/api/now", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ now: Date.now() + SLOW_BY_MS }) }));
  // A link minted on a correct clock: ten minutes from REAL now.
  const realNow = Date.now() + SLOW_BY_MS;
  await page.goto(`/#t=${realNow + 600_000}`);
  await expect(page.locator("#clockNote")).toContainText("2 min 14 s slow");
  await expect.poll(() => boardValue(page), { timeout: 5000 }).toMatch(/^(10:00|09:5\d)$/);
});

test("a correctly-set device is left alone: no note, no correction", async ({ page }) => {
  await page.goto(`/#t=${Date.now() + 600_000}`);
  await page.evaluate(() => window.CountlinkClock.ready);
  expect(await page.evaluate(() => window.CountlinkClock.offset())).toBe(0);
  await expect(page.locator("#clockNote")).toHaveCount(0);
});

test("with /api/now unreachable the countdown runs on the device clock, exactly as before", async ({ page }) => {
  await page.route("**/api/now", (route) => route.abort());
  await page.goto(`/#t=${Date.now() + 600_000}`);
  await page.evaluate(() => window.CountlinkClock.ready);
  expect(await page.evaluate(() => window.CountlinkClock.offset())).toBe(0);
  await expect.poll(() => boardValue(page)).toMatch(/^(10:00|09:5\d)$/);
});

test("a countdown started on a slow device writes a link that is right for everyone else", async ({ page }) => {
  await page.route("**/api/now", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify({ now: Date.now() + SLOW_BY_MS }) }));
  await page.goto("/");
  await page.evaluate(() => window.CountlinkClock.ready);
  const before = Date.now() + SLOW_BY_MS;
  await page.locator("#boardStartBtn").click();
  await expect(page).toHaveURL(/#t=\d+/);
  const t = +new URL(page.url()).hash.match(/t=(\d+)/)[1];
  // The page's default is 10 minutes; the deadline must be 10 minutes from REAL now.
  expect(t - before).toBeGreaterThan(599_000);
  expect(t - before).toBeLessThan(603_000);
});
