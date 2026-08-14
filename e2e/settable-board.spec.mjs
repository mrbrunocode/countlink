// Setting the countdown on the board itself, across engines.
//
// These are the paths a person actually uses. The pure duration model is
// already covered by test/settable-board.test.mjs; what can only be caught
// here is whether the *interaction* survives a different browser — pointer
// events, focus-driven affordances, wheel deltas, clipboard delivery.
import { test, expect } from "@playwright/test";
import {
  boardValue, fieldKeys, field, chev, roll, typeOnBoard, preset,
  pasteText, secondsFromHash,
} from "./helpers.mjs";

test.describe("the ready board accepts input", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();
  });

  test("opens settable, showing the page's preset", async ({ page }) => {
    await expect(page.locator("#boardEl")).toHaveClass(/settable/);
    expect(await boardValue(page)).toBe("10:00");
    expect(await fieldKeys(page)).toBe("m,s");
    // Two spinbuttons, not six — the unit of interaction is a field, so a
    // screen reader reads "Minutes 10", never six loose digits.
    await expect(page.locator('#tiles [role="spinbutton"]')).toHaveCount(2);
  });

  test("a chevron is clickable on hover alone, with no click on the digits first", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith("mobile"), "no hover on touch — covered in touch.spec.mjs");
    // The original bug: the chevrons sit 10px clear of the flaps, and crossing
    // that gap dropped :hover, so they vanished before the pointer arrived and
    // only felt clickable once a click had pinned them open via focus.
    await field(page, "m").hover();
    await expect(chev(page, "m", "up")).toBeVisible();
    await chev(page, "m", "up").click();
    expect(await boardValue(page)).toBe("11:00");
  });

  test("typing fills from the right like a microwave keypad", async ({ page }) => {
    await typeOnBoard(page, "700");
    expect(await boardValue(page)).toBe("07:00");
    await preset(page, 10);
    await typeOnBoard(page, "1500");
    expect(await boardValue(page)).toBe("15:00");
  });

  test("typing an out-of-range value normalises instead of refusing it", async ({ page }) => {
    // 9000 means 90 minutes: legal to type, illegal to display as mm:ss.
    await typeOnBoard(page, "9000");
    expect(await boardValue(page)).toBe("01:30:00");
    expect(await fieldKeys(page)).toBe("h,m,s");
  });

  test("rolling seconds past a boundary carries instead of wrapping", async ({ page }) => {
    // The property the whole single-duration model exists for: independent
    // digit wheels would turn 10:00 into 10:59 here and lose a minute.
    await roll(page, "s", "down");
    expect(await boardValue(page)).toBe("09:59");
    await roll(page, "s", "up");
    expect(await boardValue(page)).toBe("10:00");
  });

  test("the hours pair appears and retracts on its own", async ({ page }) => {
    await typeOnBoard(page, "5900");
    expect(await boardValue(page)).toBe("59:00");
    expect(await fieldKeys(page)).toBe("m,s");

    await roll(page, "m", "up");
    expect(await boardValue(page)).toBe("01:00:00");
    expect(await fieldKeys(page)).toBe("h,m,s");

    await roll(page, "m", "down");
    expect(await boardValue(page)).toBe("59:00");
    expect(await fieldKeys(page)).toBe("m,s");
  });

  test("+hr and − Hrs switch the scope explicitly", async ({ page }) => {
    await page.locator("#addHrsBtn").click();
    expect(await fieldKeys(page)).toBe("h,m,s");
    expect(await boardValue(page)).toBe("00:10:00");
    // The ghost is gone once the hours it would add are already there.
    await expect(page.locator("#addHrsBtn")).toHaveCount(0);

    await field(page, "h").focus();
    await page.locator("#tiles .field[data-k='h'] .retract").click();
    expect(await fieldKeys(page)).toBe("m,s");
    expect(await boardValue(page)).toBe("10:00");
  });

  test("keyboard alone can set the whole duration", async ({ page }) => {
    await field(page, "m").focus();
    await page.keyboard.press("ArrowUp");
    expect(await boardValue(page)).toBe("11:00");
    await page.keyboard.press("Shift+ArrowUp");
    expect(await boardValue(page)).toBe("21:00");
    await page.keyboard.press("Shift+ArrowDown");
    expect(await boardValue(page)).toBe("11:00");
    // move to seconds and roll it
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    expect(await boardValue(page)).toBe("11:01");
    // Escape returns to the page's preset
    await page.keyboard.press("Escape");
    expect(await boardValue(page)).toBe("10:00");
  });

  test("the mouse wheel rolls the unit under the pointer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith("mobile"), "no wheel on touch devices");
    await field(page, "m").hover();
    await page.mouse.wheel(0, -120);
    expect(await boardValue(page)).toBe("11:00");
    await page.mouse.wheel(0, 120);
    expect(await boardValue(page)).toBe("10:00");
  });

  test("a pasted duration lands on the board", async ({ page }) => {
    // A real clipboard round-trip (see helpers.pasteText) — this is the path
    // that actually differs between engines, and the reason the handler is
    // bound to the document rather than to #tiles.
    await field(page, "m").focus();
    await pasteText(page, "1:30:00");
    expect(await boardValue(page)).toBe("01:30:00");

    await preset(page, 10);
    await field(page, "m").focus();
    await pasteText(page, "90m");
    expect(await boardValue(page)).toBe("01:30:00");

    await preset(page, 10);
    await field(page, "m").focus();
    await pasteText(page, "45");            // bare number = minutes
    expect(await boardValue(page)).toBe("45:00");
  });

  test("pasting into the form below the board is not hijacked", async ({ page }) => {
    await page.locator("#evtName").focus();
    await pasteText(page, "5:00");
    expect(await boardValue(page)).toBe("10:00");
  });

  test("an unreadable paste changes nothing", async ({ page }) => {
    await field(page, "m").focus();
    await pasteText(page, "next tuesday");
    expect(await boardValue(page)).toBe("10:00");
  });
});

test.describe("the board drives the countdown", () => {
  test("starting uses the board's value, seconds included", async ({ page }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();
    await typeOnBoard(page, "730");
    expect(await boardValue(page)).toBe("07:30");

    await page.locator("#boardStartBtn").click();
    const secs = await secondsFromHash(page);
    // 450s, not the 480s the minutes-only form field would have rounded to.
    expect(secs).toBeGreaterThanOrEqual(447);
    expect(secs).toBeLessThanOrEqual(451);
  });

  test("a preset below the board still drives it", async ({ page }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();
    await preset(page, 5);
    expect(await boardValue(page)).toBe("05:00");
    await page.locator("#boardStartBtn").click();
    const secs = await secondsFromHash(page);
    expect(secs).toBeGreaterThanOrEqual(297);
    expect(secs).toBeLessThanOrEqual(301);
  });

  test("a page defaulting over an hour opens with hours already shown", async ({ page }) => {
    await page.goto("/timers/exam-timer");
    await expect(field(page, "m")).toBeVisible();
    expect(await boardValue(page)).toBe("01:00:00");
    expect(await fieldKeys(page)).toBe("h,m,s");
    // …and typing a short duration drops the hours pair rather than leaving
    // a 00 in front of it.
    await typeOnBoard(page, "4500");
    expect(await boardValue(page)).toBe("45:00");
    expect(await fieldKeys(page)).toBe("m,s");
  });
});

test.describe("boards with nothing to roll opt out", () => {
  test("a date-target board is not settable", async ({ page }) => {
    await page.goto("/timers/christmas-countdown");
    await expect(page.locator("#tiles .tile-day")).toBeVisible();
    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);
    await expect(page.locator('#tiles [role="spinbutton"]')).toHaveCount(0);
  });

  test("switching to count-up removes the controls", async ({ page }) => {
    await page.goto("/timers/classroom-timer");
    await expect(field(page, "m")).toBeVisible();
    await page.locator('.dir-toggle .q[data-dir="up"]').click();
    await expect(page.locator("#boardEl")).not.toHaveClass(/settable/);
    await expect(page.locator('#tiles [role="spinbutton"]')).toHaveCount(0);
    await page.locator('.dir-toggle .q[data-dir="down"]').click();
    await expect(page.locator("#boardEl")).toHaveClass(/settable/);
  });
});
