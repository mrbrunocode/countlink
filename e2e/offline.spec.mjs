// Offline: the installed app opens and runs with no connection.
//
// /features promised "the board keeps working offline", and until 2026-09-26
// that was only true of a page already open: sw.js deliberately cached the
// CSS and JS but never a page, so launching the installed app with no
// connection got the browser's offline error. This drives a real service
// worker through a real offline switch. Chromium only — Playwright's
// service-worker support on the other engines isn't reliable enough to tell
// a product bug from a harness one.
import { test, expect } from "@playwright/test";
import { boardValue } from "./helpers.mjs";

test.skip(({ browserName }) => browserName !== "chromium", "service workers under Playwright: Chromium only");

async function controlled(page, path) {
  await page.goto(path);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  // The first load registers the worker; it controls pages from the next one.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test("the start page opens offline and a shared countdown runs", async ({ page, context }) => {
  await controlled(page, "/");
  await page.goto("about:blank"); // so the next goto is a real load, not a same-page hash change
  await context.setOffline(true);
  await page.goto(`/#t=${Date.now() + 600_000}&l=Offline`);
  await expect(page.locator("#tiles")).toBeVisible();
  await expect.poll(() => boardValue(page)).toMatch(/^(10:00|09:5\d)$/);
  await context.setOffline(false);
});

test("a timer page visited before opens offline as itself", async ({ page, context }) => {
  await controlled(page, "/");
  await page.goto("/timers/exam-timer");
  await context.setOffline(true);
  await page.goto("/timers/exam-timer");
  await expect(page.locator("h1")).toContainText("Exam Timer");
  await context.setOffline(false);
});

test("a page never visited falls back to the working home page, not a browser error", async ({ page, context }) => {
  await controlled(page, "/");
  await context.setOffline(true);
  await page.goto("/timers/christmas-countdown");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#tiles")).toBeVisible();
  await expect(page.locator("#boardStartBtn")).toBeVisible(); // styled and scripted, not a bare document
  await context.setOffline(false);
});
