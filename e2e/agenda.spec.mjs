// The agenda page (/timers/agenda-timer) booting from a shared #ag=...&s=...
// link, in a real browser — specifically the scheduled-start ("starts in")
// case create_agenda's start_at parameter produces.
//
// Why this needs a real browser and not just the computeAgendaState unit
// tests: the bug this guards against only shows up in what actually renders.
// A future start used to make the board read as already mid-segment-1, with
// the wait time folded into that segment's remaining time — a parser test
// can't see that distinction, only the rendered page can. See
// docs/ai-surface-expansion-plan.md's 1c decision for the full story.
import { test, expect } from "@playwright/test";

function agendaUrl(segments, start) {
  return "/timers/agenda-timer#ag=" + encodeURIComponent(JSON.stringify(segments)) + "&s=" + start;
}

test.describe("agenda: scheduled (future) start", () => {
  test("a future start shows a countdown to the start, not an inflated segment 1", async ({ page }) => {
    const start = Date.now() + 5 * 60000; // 5 minutes from now
    await page.goto(agendaUrl([{ label: "Intro", minutes: 10 }, { label: "Talk", minutes: 20 }], start));

    await expect(page.locator("#agendaNowLabel")).toHaveText("Starts soon");
    // Not "15:00" (10-minute segment 1 with the 5-minute wait folded in) —
    // the actual bug this feature's design log records finding.
    await expect(page.locator("#agendaNowTime")).not.toHaveText(/15:0/);
    const shown = await page.locator("#agendaNowTime").textContent();
    const [mm, ss] = shown.split(":").map(Number);
    expect(mm).toBeGreaterThanOrEqual(3); // allow for time elapsed since goto()
    expect(mm).toBeLessThanOrEqual(5);

    // No segment reads as "current" — every one is still upcoming.
    const items = page.locator(".agenda-item");
    await expect(items).toHaveCount(2);
    for (const cls of ["agenda-item--current", "agenda-item--done"]) {
      await expect(page.locator(`.${cls}`)).toHaveCount(0);
    }
    await expect(page.locator(".agenda-item--upcoming")).toHaveCount(2);
  });

  test("it counts down and switches over to the running view on its own", async ({ page }) => {
    const start = Date.now() + 2000; // 2 seconds out — short enough to actually cross live
    await page.goto(agendaUrl([{ label: "Intro", minutes: 10 }], start));
    await expect(page.locator("#agendaNowLabel")).toHaveText("Starts soon");

    // No reload, no re-navigation — the same 250ms tick that already drives
    // a running agenda is what has to notice the start instant has arrived.
    await expect(page.locator("#agendaNowLabel")).toHaveText("Intro", { timeout: 5000 });
    await expect(page.locator(".agenda-item--current")).toHaveCount(1);
    await expect(page.locator(".agenda-item--upcoming")).toHaveCount(0);
  });

  test("the sub-line names when it starts, including the day when it isn't today", async ({ page }) => {
    const start = Date.now() + 3 * 86400000; // 3 days out
    await page.goto(agendaUrl([{ label: "Intro", minutes: 10 }], start));
    const sub = await page.locator("#agendaNowSub").textContent();
    expect(sub).toMatch(/starts/i);
    // Must not read as "later today" for something 3 days out.
    expect(sub).not.toMatch(/starts at \d/i);
  });

  test("the run sheet is already populated with planned wall-clock times before it starts", async ({ page }) => {
    const start = Date.now() + 5 * 60000;
    await page.goto(agendaUrl([{ label: "Intro", minutes: 10 }, { label: "Talk", minutes: 20 }], start));
    await expect(page.locator("#runSheetBody tr")).toHaveCount(2);
    await expect(page.locator("#runSheetTotal")).toContainText("30 min");
  });

  test("a start_at already in the past behaves exactly like the existing now-start path", async ({ page }) => {
    const start = Date.now() - 60000; // 1 minute ago
    await page.goto(agendaUrl([{ label: "Intro", minutes: 10 }, { label: "Talk", minutes: 20 }], start));
    await expect(page.locator("#agendaNowLabel")).toHaveText("Intro");
    await expect(page.locator(".agenda-item--current")).toHaveCount(1);
    await expect(page.locator("#agendaNowSub")).toContainText("Segment 1 of 2");
  });
});
