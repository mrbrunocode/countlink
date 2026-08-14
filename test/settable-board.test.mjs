// Tests for the settable board's duration model (assets/app.js).
//
// The board is an INPUT in its ready state — you set the countdown on the
// flaps themselves — and everything about how a keystroke, chevron, wheel
// tick or paste turns into a duration lives in the pure functions exercised
// here. The DOM layer is a thin shell over these, so a bug in this file is a
// bug in every timer page at once.
//
// The single most important property under test is CARRY/BORROW: the board
// holds one duration, not three independent digit wheels. Get that wrong and
// rolling seconds up from 59 wraps to 00 and silently *shortens* the
// countdown by 59 seconds — the kind of fault nobody notices until an exam
// ends early.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDuration } from "./helpers/load-app.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const {
  clampTotalSeconds, fieldsFromTotal, totalFromFields, needsHours,
  parseKeypadDigits, bumpTotal, parsePastedDuration, maxSettable,
} = loadDuration();

const H = 3600, M = 60;

/* ---------------- clamping ---------------- */

test("clampTotalSeconds keeps values inside 0..99:59:59", () => {
  assert.equal(clampTotalSeconds(0), 0);
  assert.equal(clampTotalSeconds(600), 600);
  assert.equal(clampTotalSeconds(-1), 0, "a duration can never go negative");
  assert.equal(clampTotalSeconds(-99999), 0);
  assert.equal(clampTotalSeconds(maxSettable()), maxSettable());
  assert.equal(clampTotalSeconds(maxSettable() + 1), maxSettable(),
    "cannot exceed what six tiles can display");
});

test("clampTotalSeconds survives the junk that reaches it from the DOM", () => {
  // Every one of these has a plausible route in: an empty input, a cleared
  // keypad buffer, a wheel event with a fractional delta.
  assert.equal(clampTotalSeconds(NaN), 0);
  assert.equal(clampTotalSeconds(undefined), 0);
  assert.equal(clampTotalSeconds(null), 0);
  assert.equal(clampTotalSeconds(""), 0);
  // Non-finite input degrades to zero rather than to the ceiling: whatever
  // produced an Infinity is a bug, and "nothing set" is a far safer thing to
  // put on a shared board than a 99-hour countdown.
  assert.equal(clampTotalSeconds(Infinity), 0);
  assert.equal(clampTotalSeconds(-Infinity), 0);
  assert.equal(clampTotalSeconds(90.7), 90, "fractional seconds floor, never round up");
});

/* ---------------- field <-> total round trips ---------------- */

test("fieldsFromTotal splits a total into h/m/s", () => {
  assert.deepEqual(fieldsFromTotal(0), { h: 0, m: 0, s: 0 });
  assert.deepEqual(fieldsFromTotal(59), { h: 0, m: 0, s: 59 });
  assert.deepEqual(fieldsFromTotal(60), { h: 0, m: 1, s: 0 });
  assert.deepEqual(fieldsFromTotal(600), { h: 0, m: 10, s: 0 });
  assert.deepEqual(fieldsFromTotal(3599), { h: 0, m: 59, s: 59 });
  assert.deepEqual(fieldsFromTotal(3600), { h: 1, m: 0, s: 0 });
  assert.deepEqual(fieldsFromTotal(5410), { h: 1, m: 30, s: 10 });
});

test("fieldsFromTotal never emits a field that can't be shown in two tiles", () => {
  for (const t of [0, 1, 59, 60, 3599, 3600, 5400, 86399, maxSettable()]) {
    const f = fieldsFromTotal(t);
    assert.ok(f.m >= 0 && f.m <= 59, `minutes out of range at ${t}: ${f.m}`);
    assert.ok(f.s >= 0 && f.s <= 59, `seconds out of range at ${t}: ${f.s}`);
    assert.ok(f.h >= 0 && f.h <= 99, `hours out of range at ${t}: ${f.h}`);
  }
});

test("totalFromFields inverts fieldsFromTotal", () => {
  for (const t of [0, 1, 59, 60, 61, 599, 600, 3599, 3600, 3661, 5410, 86399, maxSettable()]) {
    assert.equal(totalFromFields(fieldsFromTotal(t)), t, `round trip failed at ${t}`);
  }
});

test("totalFromFields tolerates missing keys", () => {
  assert.equal(totalFromFields({}), 0);
  assert.equal(totalFromFields({ m: 5 }), 300);
  assert.equal(totalFromFields(null), 0);
});

/* ---------------- carry and borrow: the core property ---------------- */

test("rolling seconds up from 59 ADDS a minute rather than wrapping", () => {
  // The whole reason the board holds one total. Independent wheels would
  // give 0:59 -> 0:00 here, quietly removing 59 seconds.
  const t = bumpTotal(59, 1, +1);
  assert.equal(t, 60);
  assert.deepEqual(fieldsFromTotal(t), { h: 0, m: 1, s: 0 });
});

test("rolling seconds down from 0 borrows from minutes", () => {
  const t = bumpTotal(10 * M, 1, -1);
  assert.equal(t, 599);
  assert.deepEqual(fieldsFromTotal(t), { h: 0, m: 9, s: 59 });
});

test("rolling minutes up past 59 carries into hours", () => {
  const t = bumpTotal(59 * M, M, +1);
  assert.equal(t, H);
  assert.deepEqual(fieldsFromTotal(t), { h: 1, m: 0, s: 0 });
  assert.ok(needsHours(t), "the hours pair must appear at exactly 1:00:00");
});

test("rolling minutes back down under an hour borrows from hours", () => {
  const t = bumpTotal(H, M, -1);
  assert.equal(t, 59 * M);
  assert.deepEqual(fieldsFromTotal(t), { h: 0, m: 59, s: 0 });
  assert.ok(!needsHours(t), "and the hours pair retracts again");
});

test("bumping down at zero stays at zero instead of wrapping to the maximum", () => {
  // Wrapping here would turn "roll it to nothing" into a 99-hour countdown.
  assert.equal(bumpTotal(0, 1, -1), 0);
  assert.equal(bumpTotal(0, M, -1), 0);
  assert.equal(bumpTotal(0, H, -1), 0);
  assert.equal(bumpTotal(30, M, -1), 0, "a partial minute floors to zero, never negative");
});

test("bumping up at the ceiling stays at the ceiling", () => {
  assert.equal(bumpTotal(maxSettable(), 1, +1), maxSettable());
  assert.equal(bumpTotal(maxSettable(), H, +1), maxSettable());
});

test("bumpTotal handles the shift-key ten-step and multi-unit deltas", () => {
  assert.equal(bumpTotal(10 * M, M, +10), 20 * M);
  assert.equal(bumpTotal(10 * M, M, -10), 0);
  assert.equal(bumpTotal(0, M, +10), 10 * M);
});

/* ---------------- keypad entry ---------------- */

test("keypad digits fill from the right, microwave style", () => {
  assert.equal(parseKeypadDigits("5"), 5, "a lone 5 is five seconds");
  assert.equal(parseKeypadDigits("30"), 30);
  assert.equal(parseKeypadDigits("130"), 90, "1:30");
  assert.equal(parseKeypadDigits("500"), 5 * M, "5:00");
  assert.equal(parseKeypadDigits("700"), 7 * M);
  assert.equal(parseKeypadDigits("1500"), 15 * M);
  assert.equal(parseKeypadDigits("13000"), H + 30 * M, "1:30:00");
  assert.equal(parseKeypadDigits("130000"), 13 * H, "13:00:00");
});

test("keypad entry normalises out-of-range fields rather than rejecting them", () => {
  // "9000" is 90 minutes: legal to type, illegal to display as mm:ss.
  assert.equal(parseKeypadDigits("9000"), 90 * M);
  assert.deepEqual(fieldsFromTotal(parseKeypadDigits("9000")), { h: 1, m: 30, s: 0 });
  assert.equal(parseKeypadDigits("99"), 99, "99 seconds becomes 1:39");
  assert.deepEqual(fieldsFromTotal(parseKeypadDigits("99")), { h: 0, m: 1, s: 39 });
});

test("keypad entry ignores non-digits and keeps only the last six", () => {
  assert.equal(parseKeypadDigits(""), 0);
  assert.equal(parseKeypadDigits(null), 0);
  assert.equal(parseKeypadDigits("abc"), 0);
  assert.equal(parseKeypadDigits("1a2b3c"), 83, "1:23 once the letters are dropped");
  assert.equal(parseKeypadDigits("1234567"), parseKeypadDigits("234567"),
    "a seventh digit pushes the oldest out rather than overflowing");
});

test("keypad entry can never exceed the displayable maximum", () => {
  assert.ok(parseKeypadDigits("999999") <= maxSettable());
  assert.equal(parseKeypadDigits("995959"), maxSettable());
});

/* ---------------- hours visibility ---------------- */

test("needsHours flips at exactly one hour, matching start()'s hms threshold", () => {
  assert.equal(needsHours(0), false);
  assert.equal(needsHours(3599), false, "59:59 still fits in four tiles");
  assert.equal(needsHours(3600), true);
  assert.equal(needsHours(maxSettable()), true);
});

/* ---------------- paste ---------------- */

test("pasting a clock-style duration", () => {
  assert.equal(parsePastedDuration("5:00"), 5 * M);
  assert.equal(parsePastedDuration("05:00"), 5 * M);
  assert.equal(parsePastedDuration("1:30:00"), H + 30 * M);
  assert.equal(parsePastedDuration("00:00:45"), 45);
  assert.equal(parsePastedDuration("  10:00  "), 10 * M, "whitespace is trimmed");
});

test("pasting unit-style durations", () => {
  assert.equal(parsePastedDuration("90m"), 90 * M);
  assert.equal(parsePastedDuration("2h"), 2 * H);
  assert.equal(parsePastedDuration("1h30m"), H + 30 * M);
  assert.equal(parsePastedDuration("1h 30m"), H + 30 * M);
  assert.equal(parsePastedDuration("45s"), 45);
  assert.equal(parsePastedDuration("2H"), 2 * H, "case-insensitive");
});

test("a bare number pasted is read as minutes, not seconds", () => {
  // "45" off a calendar invite means 45 minutes every time.
  assert.equal(parsePastedDuration("45"), 45 * M);
  assert.equal(parsePastedDuration("5"), 5 * M);
});

test("parsePastedDuration returns null for anything it cannot read", () => {
  // null, not 0 — so the caller can say "couldn't read that" instead of
  // silently setting the board to zero.
  assert.equal(parsePastedDuration(""), null);
  assert.equal(parsePastedDuration("   "), null);
  assert.equal(parsePastedDuration("tomorrow"), null);
  assert.equal(parsePastedDuration("https://countlink.app"), null);
  assert.equal(parsePastedDuration(null), null);
  assert.equal(parsePastedDuration(undefined), null);
});

test("pasted durations are clamped like every other input", () => {
  assert.ok(parsePastedDuration("99:59:59") === maxSettable());
  assert.ok(parsePastedDuration("999h") <= maxSettable());
});

/* ---------------- the properties that must hold for any input ---------------- */

test("no sequence of bumps can produce an undisplayable board", () => {
  // Fuzz the actual interaction: random rolls on random fields, asserting
  // after every step that the board can still be rendered in six tiles.
  let total = 600;
  const units = [1, M, H];
  let seed = 42;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 4000; i++) {
    const u = units[Math.floor(rand() * units.length)];
    const d = rand() < 0.5 ? -1 : 1;
    const step = rand() < 0.2 ? 10 : 1;
    total = bumpTotal(total, u, d * step);
    assert.ok(Number.isInteger(total), "total stayed an integer");
    assert.ok(total >= 0 && total <= maxSettable(), `total escaped range: ${total}`);
    const f = fieldsFromTotal(total);
    assert.ok(f.h <= 99 && f.m <= 59 && f.s <= 59, `unrenderable fields: ${JSON.stringify(f)}`);
    assert.equal(totalFromFields(f), total, "fields still describe the same duration");
  }
});

/* ---------------- the seal: structural invariants ----------------
   The product promise is that everyone opening a shared link sees the
   identical countdown, so a running board must offer nobody a control. That
   is enforced in three independent places (app.js only BUILDS controls for a
   settable board, setState() strips them on the way into a live state, and
   the CSS only reveals them under .board.settable). These tests guard the
   third, because it's the one a later stylesheet edit could quietly undo. */

test("every rule that reveals a board control is gated behind .board.settable", () => {
  const css = readFileSync(join(ROOT, "assets", "style.css"), "utf8");
  // Pull out each rule that turns a control visible.
  const revealing = [];
  for (const [, rawSel, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (!/display\s*:\s*(grid|flex|block|inline)/.test(body)) continue;
    for (const sel of rawSel.split(",")) {
      const s = sel.trim().replace(/\s+/g, " ");
      if (!s) continue;
      // Only count a rule as "revealing a control" when the control is the
      // element being styled — i.e. the LAST compound selector. `.chev svg`
      // and `.ghost .stack` style children of a control, not the control.
      const last = s.split(" ").pop();
      if (/\.chev|\.ghost|\.retract/.test(last)) revealing.push(s);
    }
  }

  assert.ok(revealing.length > 0, "expected to find rules that reveal the controls");
  for (const sel of revealing) {
    assert.match(
      sel, /\.board\.settable/,
      `"${sel}" makes a board control visible without requiring .board.settable — ` +
      `a running or shared board could show it`,
    );
  }
});

test("app.js gates the settable class on the board's lifecycle state", () => {
  const js = readFileSync(join(ROOT, "assets", "app.js"), "utf8");
  // setState() is the single place the class is toggled; if that moves, the
  // "sealed when live" rule has been re-implemented somewhere else and needs
  // re-reviewing rather than silently passing.
  const setState = js.slice(js.indexOf("function setState("), js.indexOf("function start("));
  assert.match(setState, /classList\.toggle\("settable"/,
    "setState() no longer toggles the settable class — the seal may have moved");
  assert.match(setState, /s==="ready"\|\|s==="finished"/,
    "the settable states are no longer exactly ready+finished");
});

test("the board's input layer never runs without boardIsSettable()", () => {
  const js = readFileSync(join(ROOT, "assets", "app.js"), "utf8");
  for (const fn of ["bumpBoardField", "typeBoardDigit", "addBoardHours", "dropBoardHours"]) {
    const i = js.indexOf("function " + fn + "(");
    assert.ok(i > -1, `${fn} is missing`);
    const body = js.slice(i, i + 260);
    assert.match(body, /if\(!boardIsSettable\(\)\)return;/,
      `${fn} does not bail out when the board isn't settable`);
  }
});

test("reaching zero stops the draw loop before the board becomes settable", () => {
  // draw() runs every 250ms and repaints the tiles. That was harmless while a
  // finished board was a pure readout; it is not now, because a finished board
  // accepts input again — a still-running loop repainted 00:00 over whatever
  // duration the user had just rolled on, within a quarter of a second.
  const js = readFileSync(join(ROOT, "assets", "app.js"), "utf8");
  const finishes = [...js.matchAll(/if\(!fired\)\{([\s\S]{0,900}?)setState\("finished"\)/g)];
  assert.equal(finishes.length, 2,
    "expected exactly two places that flip the board to finished (countdown + interval)");
  for (const [, body] of finishes) {
    assert.match(body, /clearInterval\(tick\)/,
      "a finished board flips settable without stopping the 250ms draw loop, " +
      "so the loop will repaint zero over anything the user sets");
  }
});
