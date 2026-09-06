// Join codes, on a real phone-sized engine.
//
// WHY THIS FILE EXISTS, specifically:
// The join-code entry row shipped broken to production for one deploy. On any
// viewport under 480px the Join button filled the row and the input collapsed
// to roughly 60px — a field for a five-character code, too narrow to show a
// five-character code. Cause: `.btn` carries `width:100%` below 480px, so a
// flex child left on `flex-basis:auto` resolves its basis from that and takes
// the whole row.
//
// It got through because the mobile check that was run asserted the page did
// not scroll sideways. It didn't. The row fitted its container perfectly; it
// was simply apportioned backwards, and no overflow assertion can see that.
// The only thing that catches it is measuring the two boxes against each
// other, on an engine that applies the mobile rules — which is what this does.
//
// The general lesson, worth keeping: "does it overflow" is not the same
// question as "does it look right", and only the first one is cheap to assert.
import { test, expect } from "@playwright/test";

const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{4,7}$/; // Crockford base 32: no I, L, O, U

test.describe("join code entry", () => {
  test("the code field is the wide half of the row, not the button", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("#joinInput");
    const button = page.locator(".join-entry-row .btn");
    await expect(input).toBeVisible();

    const [i, b] = [await input.boundingBox(), await button.boundingBox()];
    expect(i.width, "the code field must be wider than the Join button").toBeGreaterThan(b.width);

    // Concrete floor as well as a relative one: the field has to actually show
    // a whole code. The placeholder is a five-character example, and a field
    // narrower than it is the exact failure this file exists for.
    expect(i.width, "the code field must fit a five-character code").toBeGreaterThan(120);

    // And the row must still fit — fixing the apportioning by letting it
    // overflow instead would be no fix at all.
    const row = await page.locator(".join-entry-row").boundingBox();
    expect(i.width + b.width).toBeLessThanOrEqual(row.width + 1);
  });

  test("the placeholder code is not clipped", async ({ page }) => {
    await page.goto("/");
    // scrollWidth > clientWidth on an input means its own content is cut off,
    // which is how a too-narrow field actually fails for a reader.
    const clipped = await page.locator("#joinInput").evaluate((el) => {
      el.value = el.placeholder;          // measure against a real five-char code
      const cut = el.scrollWidth > el.clientWidth + 1;
      el.value = "";
      return cut;
    });
    expect(clipped, "a five-character code must fit inside the field").toBe(false);
  });

  test("starting a countdown offers a code, and the code opens the same countdown", async ({ page }) => {
    await page.goto("/");
    await page.locator("#boardStartBtn").click();

    const code = page.locator("#joinCodeText");
    await expect(code).toBeVisible();
    const value = (await code.textContent()).trim();
    expect(value).toMatch(CODE_RE);

    // The whole point: someone reads the code out, someone else types it in —
    // in the wrong case, with a hyphen, because that is what people do.
    const typed = value.toLowerCase().replace(/^(..)/, "$1-");
    await page.goto("/");
    await page.locator("#joinInput").fill(typed);
    await page.locator(".join-entry-row .btn").click();

    // The dev server has no Pages Functions, so /j/ cannot resolve here — the
    // redirect is covered by test/join-code.test.mjs and verified against
    // production. What this asserts is the client half: the form accepts a
    // garbled code and navigates to the canonical /j/<CODE> for it, rather
    // than rejecting what the person actually typed.
    await page.waitForURL(/\/j\//, { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe(`/j/${value}`);
  });

  test("count-up mode is offered no code, because a code cannot carry one", async ({ page }) => {
    await page.goto("/");
    // A code encodes an instant and nothing else — no direction flag — so a
    // stopwatch link must not get one rather than get one that resolves to the
    // wrong kind of timer.
    await page.locator('.dir-toggle button, [data-dir="up"]').first().click().catch(() => {});
    const upSelected = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const up = btns.find((b) => /count up/i.test(b.textContent));
      if (up) { up.click(); return true; }
      return false;
    });
    test.skip(!upSelected, "count-up control not present on this page");
    await page.locator("#boardStartBtn").click();
    await expect(page.locator("#joinCodeWrap")).toBeHidden();
  });
});
