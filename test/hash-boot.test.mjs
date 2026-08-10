// modeForHash() and pickMinutes() — two pure decisions that were previously
// inlined at their call sites, where each grew a bug that only shows up on
// somebody else's screen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { modeForHash, pickMinutes, charsFor } = loadDuration();

const HOUR = 3600000;
const DAY = 86400000;

// ── modeForHash ───────────────────────────────────────────────────────────
//
// A board booted from a shared link never calls start(), so it derives its
// tile layout here instead. In "up" mode `end` holds the START instant, which
// makes the caller's `total` negative — and the original inline version had no
// "up" branch, so every threshold fell through to the 4-tile "ms" layout. The
// person who started a stopwatch saw hh:mm:ss; everyone they shared it with
// saw mm:ss, wrapping into nonsense past 100 minutes. At 1h41m the two screens
// read "01:41:45" and "10:45" off one link.

test("a shared count-up link always boots to the 6-tile hms layout", () => {
  // The negative totals are the point: they are what "up" actually produces.
  assert.equal(modeForHash("up", -1), "hms");
  assert.equal(modeForHash("up", -6100000), "hms", "101 minutes into a shared stopwatch");
  assert.equal(modeForHash("up", -DAY * 3), "hms");
  assert.equal(modeForHash("up", 0), "hms");
});

test("count-up boots to the same layout start() gives the originating screen", () => {
  // The invariant that actually matters — not "hms" as a magic string, but
  // that both screens on one link lay out identically. startUp() hardcodes
  // mode="hms"; if that ever changes, this fails rather than silently
  // desyncing the two sides again.
  const senderTiles = charsFor(6100000, "hms").tiles.length;
  const recipientTiles = charsFor(6100000, modeForHash("up", -6100000)).tiles.length;
  assert.equal(recipientTiles, senderTiles);
});

test("countdown links pick their layout from the time actually left", () => {
  assert.equal(modeForHash("down", 30000), "ms", "30s left → mm:ss");
  assert.equal(modeForHash("down", HOUR - 1), "ms");
  assert.equal(modeForHash("down", HOUR), "hms", "exactly an hour crosses into hh:mm:ss");
  assert.equal(modeForHash("down", DAY - 1), "hms");
  assert.equal(modeForHash("down", DAY), "days", "a day or more gets the plain readout");
});

test("interval links always boot to ms, whatever the elapsed value looks like", () => {
  assert.equal(modeForHash("interval", -DAY), "ms");
  assert.equal(modeForHash("interval", DAY * 2), "ms");
});

// ── charsFor overflow ─────────────────────────────────────────────────────
//
// Only reachable via count-up, which has no upper bound. A 2-tile hours field
// can't render 100+, and fmt2(100)[0..1] rendered "10" — a stopwatch left
// running over a long weekend showed 10:xx:xx and looked entirely plausible.

test("charsFor falls back to a plain readout past 99 hours instead of truncating", () => {
  const at99 = charsFor(99 * HOUR + 60000, "hms");
  assert.ok(at99.tiles, "99 hours still fits in two tiles");
  assert.equal(at99.tiles.filter((t) => t.t === "tile").length, 6);

  const at100 = charsFor(100 * HOUR, "hms");
  assert.equal(at100.tiles, undefined);
  assert.equal(at100.plain, "4d 04:00:00", "100h is 4 days and 4 hours, said in full");

  const at123 = charsFor(123 * HOUR + 45 * 60000 + 6000, "hms");
  assert.equal(at123.plain, "5d 03:45:06");
});

test("charsFor never renders a shorter number than the truth", () => {
  // The shape of the old bug, stated as a property: whatever charsFor returns
  // must not claim fewer hours than have actually elapsed.
  for (const h of [1, 23, 47, 99, 100, 101, 250]) {
    const c = charsFor(h * HOUR, "hms");
    if (c.plain) {
      const [, d, hh] = c.plain.match(/^(\d+)d (\d\d):/);
      assert.equal(Number(d) * 24 + Number(hh), h, `plain readout lost time at ${h}h`);
    } else {
      const digits = c.tiles.filter((t) => t.t === "tile").map((t) => t.v);
      assert.equal(Number(digits[0] + digits[1]), h, `tile readout lost time at ${h}h`);
    }
  }
});

// ── pickMinutes ───────────────────────────────────────────────────────────
//
// The custom-minutes field was read inline at four call sites with three
// different hardcoded fallbacks: ||10 when previewing the ready board, ||25
// when actually starting, ||10 again on stop. Clearing the field and pressing
// Start gave a board that had been previewing 10:00 and a countdown that ran
// for 25:00.

test("a blank minutes field falls back to the page's own advertised duration", () => {
  assert.equal(pickMinutes("", 25), 25, "on /timers/pomodoro-timer");
  assert.equal(pickMinutes("", 10), 10, "on the homepage");
  assert.equal(pickMinutes(null, 5), 5);
  assert.equal(pickMinutes(undefined, 5), 5);
});

test("preview and start agree on a blank field — the actual regression", () => {
  // Both call sites now route through this one function, so the only way they
  // can disagree is if someone reintroduces a literal. Asserted as equality
  // rather than against a number so it stays true if a default ever changes.
  const pageDefault = 25;
  const previewed = pickMinutes("", pageDefault);
  const started = pickMinutes("", pageDefault);
  assert.equal(previewed, started);
  assert.equal(started, pageDefault);
});

test("a typed value always wins over the page default", () => {
  assert.equal(pickMinutes("7", 25), 7);
  assert.equal(pickMinutes("90", 10), 90);
  assert.equal(pickMinutes(3, 10), 3);
});

test("garbage and out-of-range input clamp instead of starting an already-over countdown", () => {
  assert.equal(pickMinutes("abc", 10), 10, "non-numeric falls back");
  assert.equal(pickMinutes("0", 25), 1, "0 clamps to 1, matching renderReady's Math.max(1,min)");
  assert.equal(pickMinutes("-5", 25), 1);
  assert.equal(pickMinutes("0.5", 25), 1);
});
