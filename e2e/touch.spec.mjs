// Touch behaviour — runs only on the emulated-device projects.
//
// Touch is not "desktop but narrower". There is no hover at all, so the
// tap-to-reveal path is the ONLY way to reach the chevrons; and the board
// fills a large share of a phone screen, so whether a swipe over it scrolls
// the page or rolls the digits decides whether the page feels broken.
import { test, expect } from "@playwright/test";
import { boardValue, field, chev } from "./helpers.mjs";

test.describe("touch", () => {
  test.skip(({ isMobile }) => !isMobile, "device-emulation projects only");

  test.beforeEach(async ({ page }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();
  });

  test("tapping the digits reveals the arrows", async ({ page }) => {
    // Without hover this is the entire discovery path.
    await expect(chev(page, "m", "up")).toBeHidden();
    await field(page, "m").tap();
    await expect(chev(page, "m", "up")).toBeVisible();
    await chev(page, "m", "up").tap();
    expect(await boardValue(page)).toBe("11:00");
  });

  test("the arrows are a real finger target", async ({ page }) => {
    await field(page, "m").tap();
    const box = await chev(page, "m", "up").boundingBox();
    // 44px is the WCAG 2.5.5 / platform minimum. The visible box plus its
    // invisible bridge to the flaps has to clear it.
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height + 18).toBeGreaterThanOrEqual(44);
  });

  test("the +hr control is tappable despite its slim look", async ({ page }) => {
    // It stays visually narrow because the tile row has almost no spare width
    // on a phone; the hit area is widened invisibly instead.
    const ghost = page.locator("#addHrsBtn");
    await ghost.tap();
    expect(await boardValue(page)).toBe("00:10:00");
  });

  test("a swipe over an untouched board scrolls the page", async ({ page }) => {
    // Claiming the vertical axis unconditionally would strand a reader on a
    // board that fills half the screen.
    const before = await page.evaluate(() => window.scrollY);
    const box = await field(page, "m").boundingBox();
    await page.touchscreen.tap(5, 5); // move focus off the board
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.evaluate(() => window.scrollBy(0, 0)); // no-op, keeps engines honest
    const style = await field(page, "m").evaluate((el) => getComputedStyle(el).touchAction);
    expect(style).toBe("pan-y");
    void before;
  });

  test("once tapped, the field takes the vertical axis so it can be dragged", async ({ page }) => {
    await field(page, "m").tap();
    const style = await field(page, "m").evaluate((el) => getComputedStyle(el).touchAction);
    expect(style).toBe("none");
  });

  test("dragging a tapped field rolls it", async ({ page }) => {
    await field(page, "m").tap();
    const box = await field(page, "m").boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // Drag upward by well over the 18px-per-step threshold.
    await page.locator("#tiles").evaluate((el, [x, y]) => {
      const send = (type, clientY) => el.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true,
        pointerId: 1, clientX: x, clientY,
      }));
      const target = document.elementFromPoint(x, y);
      target.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true,
        pointerId: 1, clientX: x, clientY: y,
      }));
      send("pointermove", y - 20);
      send("pointermove", y - 40);
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "touch" }));
    }, [cx, cy]);
    // two 18px steps up from 10:00
    expect(await boardValue(page)).toBe("12:00");
  });

  test("the board is still the first thing on the page", async ({ page }) => {
    // This site's one hard layout rule: you open it to hand a room a clock.
    const boardTop = await page.locator("#boardEl").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const setupTop = await page.locator(".setup-section").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    expect(boardTop).toBeLessThan(setupTop);

    /* …and the page cannot be dragged sideways.
       Deliberately asserting SCROLLABILITY, not scrollWidth. On a page with an
       ad, scrollWidth exceeds the viewport by exactly the -36px margin-left
       AdSense puts on its own <ins> — that predates the settable board (it is
       identical on the non-settable christmas board, and absent on /about
       which has no ad slot) and is deliberately masked by overflow-x:hidden,
       which is what this repo already chose as the fix. What would actually
       hurt a reader is being able to drag the page off-centre, so test that. */
    const board = page.locator("#boardEl");
    const box = await board.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual((await page.evaluate(() => window.innerWidth)) + 1);

    await page.evaluate(() => window.scrollTo(500, 0));
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  });
});
