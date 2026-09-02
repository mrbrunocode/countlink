// Two behaviours that only exist in a real browser.
//
// The overlay redirect is a policy guarantee, not a feature: an ?overlay=1
// screen is a transparent board with no publisher content on it, and AdSense
// treats serving an ad there as a violation. Neutering the ad code in place was
// tried first and failed — with the <ins> removed from the DOM and the inline
// push() skipped, the AdSense library still injected its own auto-ad <ins> a
// moment later. That failure is invisible to a static test of the HTML, which
// is exactly why this lives here: it asserts on what actually rendered.
//
// Laps are here for the ordinary reason: they are a click sequence with
// derived state, and the pure model tests in test/laps.test.mjs cannot see
// whether the button is reachable or the rows render.
import { test, expect } from "@playwright/test";

test.describe("an overlay screen never displays an ad", () => {
  test("?overlay=1 lands on /embed/, carrying the timer with it", async ({ page }) => {
    await page.goto("/timers/obs-countdown-timer?overlay=1#t=1788999999999&l=Stream%20starts");
    await expect(page).toHaveURL(/\/embed\/\?overlay=1#t=1788999999999&l=Stream%20starts/);

    // The hash is the timer, so it has to survive the redirect intact.
    await expect(page.locator("#evtLabel")).toHaveText("Stream starts");

    // What actually matters, and what the old CSS-hiding approach could not
    // deliver: nothing ad-shaped exists on the screen that gets rendered.
    // Before this, the AdSense library injected its own auto-ad <ins> onto the
    // overlay a moment after app.js had removed the static one.
    expect(await page.locator("ins.adsbygoogle").count()).toBe(0);
    expect(await page.locator(".ad-slot").count()).toBe(0);
    expect(await page.locator('script[src*="googlesyndication"]').count()).toBe(0);
    expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
  });

  test("the document that renders the overlay makes no ad or analytics request", async ({ page }) => {
    // Scoped to the /embed/ document deliberately. The content page that
    // redirects *does* still start those two requests before the redirect
    // fires — the browser's preload scanner queues an async <script src> ahead
    // of any inline script, so no in-document guard can prevent it. Nothing is
    // ever rendered from them, and the document is torn down immediately, but
    // closing that last gap needs an edge redirect rather than a JS one.
    // See docs/overlay-ads.md.
    const requests = [];
    page.on("request", (r) => {
      if (/googlesyndication|doubleclick|googleads|googletagmanager/.test(r.url())) requests.push(r.url());
    });
    await page.goto("/embed/?overlay=1#t=1788999999999&l=Stream%20starts");
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
  });

  test("a normal page still loads the ad library, so verification can find it", async ({ page }) => {
    // The other half of the guarantee: the fix must not quietly de-monetise
    // every real page. The loader tag stays static and unconditional there.
    // Counts are lower bounds — the library injects further tags of its own.
    await page.goto("/timers/obs-countdown-timer");
    expect(await page.locator('script[src*="googlesyndication"]').count()).toBeGreaterThanOrEqual(1);
    expect(await page.locator("ins.adsbygoogle").count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("stopwatch laps", () => {
  test("the button appears only for a running count-up, and rows accumulate", async ({ page }) => {
    await page.goto("/timers/exam-timer");
    await expect(page.locator("#lapBtn")).toBeHidden();

    // A countdown has no splits to take.
    await page.locator("#boardStartBtn").click();
    await expect(page.locator("#lapBtn")).toBeHidden();
    await page.locator("#stopBtn").click();

    await page.locator('[data-dir="up"]').click();
    await page.locator("#startBtn").click();
    await expect(page.locator("#lapBtn")).toBeVisible();

    await page.locator("#lapBtn").click();
    await expect(page.locator(".lap-row")).toHaveCount(1);
    await page.waitForTimeout(250);
    await page.locator("#lapBtn").click();
    await expect(page.locator(".lap-row")).toHaveCount(2);

    // Newest first — the row you just made is the one you want to read.
    await expect(page.locator(".lap-row").first().locator(".lap-n")).toHaveText("2");

    // Two splits is the point at which comparing them starts to mean something.
    await expect(page.locator(".lap-tag")).toHaveCount(2);
  });

  test("stopping clears the splits rather than leaving a stale list", async ({ page }) => {
    await page.goto("/timers/exam-timer");
    await page.locator('[data-dir="up"]').click();
    await page.locator("#startBtn").click();
    await page.locator("#lapBtn").click();
    await expect(page.locator(".lap-row")).toHaveCount(1);

    await page.locator("#stopBtn").click();
    await expect(page.locator("#lapPanel")).toBeHidden();
    await expect(page.locator(".lap-row")).toHaveCount(0);
  });
});

test.describe("the agenda run of show", () => {
  test("builds a printable sheet whose windows are contiguous", async ({ page }) => {
    await page.goto("/timers/agenda-timer");
    await expect(page.locator("#runSheet")).toBeHidden();

    for (const [label, mins] of [["Intro", "5"], ["Demo", "20"], ["Q&A", "10"]]) {
      await page.locator("#agendaLabel").fill(label);
      await page.locator("#agendaMinutes").fill(mins);
      await page.locator("#agendaAddBtn").click();
    }

    await expect(page.locator("#runSheet")).toBeVisible();
    await expect(page.locator("#runSheetBody tr")).toHaveCount(3);
    await expect(page.locator("#runSheetTotal")).toContainText("3 segments · 35 min");

    // Each segment starts exactly where the previous one ended.
    const cells = await page.locator("#runSheetBody tr").evaluateAll((rows) =>
      rows.map((r) => [...r.cells].map((c) => c.textContent.trim())),
    );
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i][3]).toBe(cells[i - 1][4]);
    }
  });
});

test.describe("the embed builder", () => {
  test("produces a snippet that frames /embed/ and links back from outside it", async ({ page }) => {
    await page.goto("/timers/webinar-countdown");
    await page.locator("#boardStartBtn").click();
    await page.locator("#embedBtn").click();

    const fluid = await page.locator("#embedCode").inputValue();
    expect(fluid).toContain("/embed/?overlay=1");
    expect(fluid).toContain("aspect-ratio:400/160");
    // The attribution link is the whole point of the feature, and it only
    // counts if it is outside the frame — a link inside an iframe is credited
    // to the frame's own document, not to the page hosting it.
    expect(fluid.indexOf("</div>")).toBeLessThan(fluid.indexOf('<a href="https://countlink.app/">'));

    await page.locator("#embedStyle").selectOption("light");
    await page.locator("#embedResponsive").uncheck();
    const fixed = await page.locator("#embedCode").inputValue();
    expect(fixed).toContain("style=light");
    expect(fixed).toContain('width="400" height="160"');
    expect(fixed).not.toContain("aspect-ratio");
  });

  test("the default board style is left out of the URL", async ({ page }) => {
    await page.goto("/timers/webinar-countdown");
    await page.locator("#boardStartBtn").click();
    await page.locator("#embedBtn").click();
    // "style=" on its own would match the inline CSS attributes in the snippet.
    expect(await page.locator("#embedCode").inputValue()).not.toContain("&style=");
    expect(await page.locator("#embedCode").inputValue()).not.toContain("?overlay=1&style");
  });
});
