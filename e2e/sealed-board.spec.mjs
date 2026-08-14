// "Settable when idle, sealed when live" — the rule the product promise rests
// on.
//
// CountLink's whole claim is that everyone opening a link sees the identical
// countdown. If a viewer can nudge the digits, that breaks silently and on
// someone else's screen. So a running board must offer nobody a control, and
// the controls must be GONE rather than merely invisible: a hidden button is
// still reachable by keyboard, by a screen reader, and by anything that
// scripts the page.
import { test, expect } from "@playwright/test";
import { boardValue, controlCensus, field, roll, typeOnBoard, preset } from "./helpers.mjs";

test.describe("a running board is sealed", () => {
  test("every control leaves the DOM the moment a countdown starts", async ({ page }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();

    const before = await controlCensus(page);
    expect(before.settable).toBe(true);
    expect(before.spinbuttons).toBe(2);
    expect(before.chevrons).toBe(4);

    await page.locator("#boardStartBtn").click();
    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);

    const after = await controlCensus(page);
    expect(after).toMatchObject({
      settable: false,
      spinbuttons: 0,
      chevrons: 0,
      retract: 0,
      ghost: 0,
      buttons: 0,     // not one pressable thing inside the tile row
      focusable: 0,   // and nothing a Tab key can reach
    });
  });

  test("input does nothing to a running board", async ({ page, isMobile }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();
    await typeOnBoard(page, "3000");            // 30:00
    await page.locator("#boardStartBtn").click();
    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);

    const minutesBefore = (await boardValue(page)).split(":")[0];
    // Try every route in: keys, digits, wheel over the tiles.
    await page.locator("#tiles").click({ position: { x: 40, y: 20 }, force: true });
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("9");
    await page.keyboard.press("9");
    // Mobile WebKit has no wheel at all, so there is nothing to defend against
    // there — skip rather than fail on a gesture the platform can't make.
    if (!isMobile) await page.mouse.wheel(0, -240);

    const minutesAfter = (await boardValue(page)).split(":")[0];
    // Still counting down from ~30, not jumped to 99 or bumped to 31.
    expect(Number(minutesAfter)).toBeLessThanOrEqual(Number(minutesBefore));
    expect(Number(minutesAfter)).toBeGreaterThanOrEqual(Number(minutesBefore) - 1);
  });

  test("someone opening a shared link has nothing to press", async ({ page }) => {
    // This is the case that matters most: a recipient must never be able to
    // alter what the room is looking at.
    await page.goto("/timers/classroom-timer");
    await page.evaluate(() => {
      location.hash = `t=${Date.now() + 300000}&l=Break%20ends`;
    });
    await page.reload();
    await expect(page.locator("#evtLabel")).toHaveText("Break ends");

    const census = await controlCensus(page);
    expect(census).toMatchObject({
      settable: false, spinbuttons: 0, chevrons: 0, ghost: 0, buttons: 0, focusable: 0,
    });
  });
});

test.describe("a finished board reopens", () => {
  test("it becomes settable again and keeps what you set on it", async ({ page }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();
    await preset(page, 1);
    await typeOnBoard(page, "1");               // 00:01
    expect(await boardValue(page)).toBe("00:01");
    await page.locator("#boardStartBtn").click();

    // wait for it to hit zero
    await expect(page.locator("#boardEl")).toHaveClass(/settable/, { timeout: 8000 });

    const census = await controlCensus(page);
    expect(census.spinbuttons).toBe(2);
    expect(census.chevrons).toBe(4);

    // Roll it to something new…
    await roll(page, "m", "up");
    expect(await boardValue(page)).toBe("01:01");

    // …and it must SURVIVE. The 250ms draw loop used to keep running over a
    // finished board and repaint 00:00 over anything set on it.
    await page.waitForTimeout(900);
    expect(await boardValue(page)).toBe("01:01");
  });

  test("the restart button stops promising the old duration once it changes", async ({ page }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();
    await preset(page, 1);
    await typeOnBoard(page, "1");
    await page.locator("#boardStartBtn").click();
    await expect(page.locator("#boardEl")).toHaveClass(/settable/, { timeout: 8000 });

    await expect(page.locator("#boardStartBtn")).toHaveText(/Restart/);
    await roll(page, "m", "up");
    await expect(page.locator("#boardStartBtn")).toHaveText("Start countdown");
  });
});
