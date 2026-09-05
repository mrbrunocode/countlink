// Setup links (#for=25m) in a real browser.
//
// The unit tests in test/setup-link.test.mjs pin the parser. This file pins
// the thing the parser exists to cause: that a link written by somebody who
// could not possibly know the current time — a chat assistant, a bookmark, a
// lesson plan, an OBS scene — opens a board set to the right duration.
//
// The invariant under test, and the reason this is an e2e file rather than
// another unit test: a setup link must arrive READY, NOT RUNNING. A parser
// test cannot see the difference; only the rendered board can. If #for= ever
// auto-started, everyone opening the same link would start their own private
// countdown from whenever they happened to click — the per-visitor "evergreen
// countdown" this product deliberately refuses, and the exact opposite of
// "one fixed instant, identical on every screen".
import { test, expect } from "@playwright/test";
import { boardValue, fieldKeys, controlCensus, secondsFromHash } from "./helpers.mjs";

test.describe("a setup link presets the board", () => {
  test("#for=25m opens at 25:00, ready and not running", async ({ page }) => {
    await page.goto("/#for=25m");
    await expect(page.locator("#tiles")).toBeVisible();

    expect(await boardValue(page)).toBe("25:00");

    // Ready, not running: the start button is still there to be pressed, and
    // the board still carries its controls (a running board is stripped bare
    // — see sealed-board.spec.mjs).
    await expect(page.locator("#boardStartBtn")).toBeVisible();
    const census = await controlCensus(page);
    expect(census.settable).toBe(true);

    // Nothing has been minted yet: no #t= anywhere, because nobody started it.
    expect(await secondsFromHash(page)).toBeNull();
  });

  test("the countdown does not tick before somebody starts it", async ({ page }) => {
    // The sharpest form of "ready, not running" — if the link auto-started,
    // the digits would move on their own.
    await page.goto("/#for=10m");
    await expect(page.locator("#tiles")).toBeVisible();
    const first = await boardValue(page);
    await page.waitForTimeout(2200);
    expect(await boardValue(page)).toBe(first);
    expect(first).toBe("10:00");
  });

  test("every duration in the documented grammar lands on the board", async ({ page }) => {
    // These are exactly the forms llms.txt promises a model it can write.
    for (const [hash, expected] of [
      ["#for=5m", "05:00"],
      ["#for=90s", "01:30"],
      ["#for=1h30m", "01:30:00"],
      ["#for=5:00", "05:00"],
      ["#for=1:30:00", "01:30:00"],
      ["#for=45", "45:00"], // a bare number is minutes
    ]) {
      await page.goto("/" + hash);
      await expect(page.locator("#tiles")).toBeVisible();
      expect(await boardValue(page), hash).toBe(expected);
    }
  });

  test("an hours-length setup link grows the hours field", async ({ page }) => {
    await page.goto("/#for=2h");
    await expect(page.locator("#tiles")).toBeVisible();
    expect(await fieldKeys(page)).toBe("h,m,s");
    expect(await boardValue(page)).toBe("02:00:00");
  });

  test("a label on the link reaches the name field", async ({ page }) => {
    await page.goto("/#for=25m&l=Pomodoro");
    await expect(page.locator("#tiles")).toBeVisible();
    await expect(page.locator("#evtName")).toHaveValue("Pomodoro");
  });

  test("starting a setup link mints a real share link at that duration", async ({ page }) => {
    // The whole point of the two-shape contract: the setup link is the input,
    // and pressing start is what turns it into the fixed-instant link
    // everybody else opens.
    await page.goto("/#for=5m");
    await expect(page.locator("#tiles")).toBeVisible();
    await page.locator("#boardStartBtn").click();

    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);
    const seconds = await secondsFromHash(page);
    expect(seconds).not.toBeNull();
    expect(seconds).toBeGreaterThan(295);
    expect(seconds).toBeLessThanOrEqual(300);
  });

  test("setup links work on timer pages too, overriding the page default", async ({ page }) => {
    // The pomodoro page advertises 25 minutes; arriving with a duration in
    // hand should win, on whichever page the link happens to point at.
    await page.goto("/timers/pomodoro-timer");
    await expect(page.locator("#tiles")).toBeVisible();
    expect(await boardValue(page)).toBe("25:00");

    await page.goto("/timers/pomodoro-timer#for=50m");
    await expect(page.locator("#tiles")).toBeVisible();
    expect(await boardValue(page)).toBe("50:00");
  });

  test("a junk #for= falls back to the page default instead of breaking", async ({ page }) => {
    // Links get truncated by chat clients and hand-edited (see validTimestamp's
    // comment in app.js). A board that refuses to render is far worse than one
    // showing its normal default.
    await page.goto("/timers/pomodoro-timer#for=notaduration");
    await expect(page.locator("#tiles")).toBeVisible();
    expect(await boardValue(page)).toBe("25:00");
  });

  test("swapping one setup link for another re-renders without a reload", async ({ page }) => {
    await page.goto("/#for=5m");
    await expect(page.locator("#tiles")).toBeVisible();
    expect(await boardValue(page)).toBe("05:00");

    await page.evaluate(() => { location.hash = "for=20m"; });
    await expect.poll(() => boardValue(page)).toBe("20:00");
  });

  test("a stale #for= never disturbs a countdown that is already running", async ({ page }) => {
    // hashchange fires for reasons the board does not control. Re-rendering a
    // setup link over a live countdown would wipe the board mid-use, in front
    // of whoever is watching it.
    await page.goto("/#for=5m");
    await expect(page.locator("#tiles")).toBeVisible();
    await page.locator("#boardStartBtn").click();
    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);

    const running = await secondsFromHash(page);
    await page.evaluate(() => { location.hash = "for=90m"; });
    await page.waitForTimeout(300);

    // Still the countdown that was running, not a fresh 90-minute board.
    expect(await controlCensus(page)).toMatchObject({ settable: false });
    expect(await boardValue(page)).not.toBe("90:00");
    expect(running).not.toBeNull();
  });
});

test.describe("&go=1 — the OBS overlay case", () => {
  // Why this exists: /timers/obs-countdown-timer holds ~65% of CountLink's
  // Bing Copilot citations, and its cited content is a complete 3-step recipe
  // whose payload — "paste the overlay link" — was behind a button you had to
  // be on the page to press. A model could recite the whole method and still
  // not hand over the URL. With &go=1 the overlay URL is writable.

  test("an overlay setup link is already counting down when the scene loads", async ({ page }) => {
    await page.goto("/embed/?overlay=1#for=10m&go=1");
    await expect(page.locator("#tiles")).toBeVisible();

    // Running, not ready — an OBS Browser Source showing a static board would
    // be useless, which is the whole reason this opt-in exists.
    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);
    const seconds = await secondsFromHash(page);
    expect(seconds).toBeGreaterThan(590);
    expect(seconds).toBeLessThanOrEqual(600);
  });

  test("the overlay is still stripped bare — no controls, no ad slot", async ({ page }) => {
    // Autostarting must not have re-introduced any of the page chrome the
    // overlay deliberately removes (an ad on a transparent, content-free
    // overlay is an AdSense policy problem — see overlay-ads.test.mjs).
    await page.goto("/embed/?overlay=1#for=10m&go=1");
    await expect(page.locator("#tiles")).toBeVisible();
    await expect(page.locator("body")).toHaveClass(/overlay-mode/);
    expect(await page.locator(".ad-slot").count()).toBe(0);
    expect(await controlCensus(page)).toMatchObject({ settable: false, buttons: 0, focusable: 0 });
  });

  test("without go=1 an overlay link just sits there, unstarted", async ({ page }) => {
    await page.goto("/embed/?overlay=1#for=10m");
    await expect(page.locator("#tiles")).toBeVisible();
    expect(await secondsFromHash(page)).toBeNull();
    expect(await boardValue(page)).toBe("10:00");
  });

  test("a reloaded scene starts the countdown fresh, not from a stale deadline", async ({ page }) => {
    // OBS keeps the URL it was configured with, so "Shutdown source when not
    // visible" reloads #for=...&go=1 and gets a new countdown — which is what
    // a "starting soon" scene wants. Documented behaviour, pinned here.
    await page.goto("/embed/?overlay=1#for=10m&go=1");
    await expect(page.locator("#tiles")).toBeVisible();
    await page.waitForTimeout(1500);
    const beforeReload = await secondsFromHash(page);
    expect(beforeReload).toBeLessThan(600);

    /* A fresh document, which is what OBS does when a scene reactivates. Going
       straight back to the same path+query would only be a hash change (the
       running board correctly refuses those — see the "stale #for=" test
       above), so it has to leave the page first to actually re-run boot. */
    await page.goto("about:blank");
    await page.goto("/embed/?overlay=1#for=10m&go=1");
    await expect(page.locator("#tiles")).toBeVisible();
    expect(await secondsFromHash(page)).toBeGreaterThan(beforeReload);
  });

  test("an overlay link carries its label too", async ({ page }) => {
    await page.goto("/embed/?overlay=1#for=5m&go=1&l=Soon");
    await expect(page.locator("#tiles")).toBeVisible();
    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);
    expect(await secondsFromHash(page)).toBeGreaterThan(290);
  });
});

test.describe("a share link still wins over a setup link", () => {
  test("#t= is honoured even when #for= is also present", async ({ page }) => {
    // A real deadline somebody is already watching must never be reinterpreted
    // as a fresh setup.
    await page.goto("/#for=90m");
    await expect(page.locator("#tiles")).toBeVisible();

    await page.evaluate(() => {
      location.hash = "t=" + (Date.now() + 5 * 60 * 1000) + "&for=90m";
    });
    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);
    expect(await boardValue(page)).not.toBe("90:00");
  });
});

test.describe("the label decode that used to crash the board", () => {
  // A REAL bug, found while building this feature: readHash() decoded the
  // label twice, so a label containing a literal % threw URIError at boot.
  // readHash() is called bare (`if(readHash())`), so the throw propagated and
  // the person who opened the shared link got a board that never rendered —
  // on the shared-link path, which is the entire product.
  test("a shared link labelled '50% done' still renders its countdown", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/#t=" + (Date.now() + 300000) + "&l=" + encodeURIComponent("50% done"));
    await expect(page.locator("#tiles")).toBeVisible();

    expect(errors, "boot must not throw on a percent sign in the label").toEqual([]);
    await expect(page.locator("#evtLabel")).toHaveText("50% done");
    expect(await secondsFromHash(page)).toBeGreaterThan(290);
  });

  test("a label with a plus sign is not mangled into spaces", async ({ page }) => {
    await page.goto("/#t=" + (Date.now() + 300000) + "&l=" + encodeURIComponent("C++ review"));
    await expect(page.locator("#evtLabel")).toHaveText("C++ review");
  });
});
