// Page-shape layout on a real phone-sized engine.
//
// WHY THIS FILE EXISTS:
// e2e/touch.spec.mjs already guards the one hard layout rule — "the board is
// the first thing on the page, and the page cannot be dragged sideways" — but
// only on /timers/classroom-timer. This site has several other page SHAPES
// that lay out differently on a phone and have each broken here before:
//
//   - the homepage, whose timer index rail reflows below the tool under 900px
//     (the AdSense <ins> negative margin once inflated that column and clipped
//     the board's bottom-right bolt off screen — fixed, but nothing re-checks
//     the other pages built from the same skeleton);
//   - a running / "viewing" board opened from a shared link, which hides the
//     hero and restacks the stage buttons full-width;
//   - the /vs and /compare pages, whose comparison tables are wider than a
//     phone and must scroll inside their own box, never the page;
//   - the agenda and multi-timer dashboards, which are separate flows with
//     their own grids and their own run-sheet table.
//
// The assertion, per e2e/touch.spec.mjs's reasoning, is SCROLLABILITY, not
// scrollWidth: an ad's -36px margin-left legitimately makes scrollWidth exceed
// the viewport, and that is masked by overflow-x:hidden by design. What would
// actually hurt a reader is being able to drag the page off-centre, or a
// primary element sitting partly off-screen — so that is what this measures.
import { test, expect } from "@playwright/test";

test.describe("mobile page layout", () => {
  test.skip(({ isMobile }) => !isMobile, "device-emulation projects only");

  /** The page must not scroll or drag horizontally, whatever is on it. */
  async function expectNoSidewaysDrag(page) {
    await page.evaluate(() => window.scrollTo(600, window.scrollY));
    expect(await page.evaluate(() => window.scrollX), "page dragged sideways").toBe(0);
  }

  /** `selector` must be fully inside the viewport horizontally. */
  async function expectWithinViewport(page, selector) {
    const box = await page.locator(selector).first().boundingBox();
    const vw = await page.evaluate(() => window.innerWidth);
    expect(box, `${selector} has no box`).not.toBeNull();
    expect(box.x, `${selector} starts off the left edge`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `${selector} runs off the right edge`).toBeLessThanOrEqual(vw + 1);
  }

  test("homepage: the ready board fits and the page holds still", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#tiles .field").first()).toBeVisible();
    await expectWithinViewport(page, "#boardEl");
    await expectNoSidewaysDrag(page);
  });

  test("a shared link (running board) fits and the page holds still", async ({ page }) => {
    // Far-future instant so the board is unambiguously running, not finished.
    await page.goto("/#t=" + (Date.now() + 45 * 60 * 1000) + "&l=Team%20standup");
    await expect(page.locator("#boardEl")).toBeVisible();
    await expectWithinViewport(page, "#boardEl");
    // The stage buttons restack full-width in this state — they must not spill.
    await expectWithinViewport(page, "#shareBtn");
    await expectNoSidewaysDrag(page);
  });

  test("/compare: the comparison table scrolls inside its box, not the page", async ({ page }) => {
    await page.goto("/compare");
    const table = page.locator("table").first();
    await expect(table).toBeVisible();

    // The table is deliberately wider than a phone; its wrapper owns the
    // horizontal scroll.
    const wrapOverflowX = await table.evaluate(
      (t) => getComputedStyle(t.parentElement).overflowX,
    );
    expect(["auto", "scroll"]).toContain(wrapOverflowX);

    const tableW = (await table.boundingBox()).width;
    const vw = await page.evaluate(() => window.innerWidth);
    expect(tableW, "table should be the wide element the wrapper scrolls").toBeGreaterThan(vw);

    await expectNoSidewaysDrag(page);
  });

  test("agenda dashboard (running) fits, including its run sheet", async ({ page }) => {
    const segs = [
      { label: "Introductions and context setting", minutes: 10 },
      { label: "Main discussion", minutes: 25 },
      { label: "Q&A", minutes: 10 },
      { label: "Wrap up and next steps", minutes: 5 },
    ];
    await page.goto(
      "/timers/agenda-timer#ag=" +
        encodeURIComponent(JSON.stringify(segs)) +
        "&s=" +
        Date.now(),
    );
    await expect(page.locator("#agendaRunning")).toBeVisible();
    await expectWithinViewport(page, "#agendaRunning");
    await expectWithinViewport(page, "#runSheet");
    await expectNoSidewaysDrag(page);
  });

  test("multi-timer dashboard fits with several timers running", async ({ page }) => {
    const timers = [
      { label: "Pasta", end: Date.now() + 8 * 60 * 1000 },
      { label: "Oven — roast potatoes", end: Date.now() + 40 * 60 * 1000 },
      { label: "Garlic bread", end: Date.now() + 12 * 60 * 1000 },
    ];
    await page.goto(
      "/timers/multiple-timers-at-once#m=" + encodeURIComponent(JSON.stringify(timers)),
    );
    await expect(page.locator(".multi-card").first()).toBeVisible();
    await expectWithinViewport(page, "#multiCards");
    await expectNoSidewaysDrag(page);
  });

  test("a guide page holds still despite its inline data table", async ({ page }) => {
    await page.goto("/guides/the-pomodoro-technique");
    const table = page.locator("table.data-table").first();
    await expect(table).toBeVisible();
    const wrapOverflowX = await table.evaluate(
      (t) => getComputedStyle(t.parentElement).overflowX,
    );
    expect(["auto", "scroll"]).toContain(wrapOverflowX);
    await expectNoSidewaysDrag(page);
  });
});
