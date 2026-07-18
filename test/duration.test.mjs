// Regression tests for the actual shipped countdown-formatting logic
// (assets/app.js), not a reimplementation — see test/helpers/load-app.mjs
// for how it's loaded without a browser. This is the "is the countdown
// showing the right numbers" logic: fmt2 (zero-pad) and charsFor (ms
// remaining -> tile/digit breakdown), the actual product promise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { fmt2, charsFor } = loadDuration();

test("fmt2 zero-pads single digits, leaves two-digit numbers alone", () => {
  assert.equal(fmt2(0), "00");
  assert.equal(fmt2(5), "05");
  assert.equal(fmt2(45), "45");
  assert.equal(fmt2(9), "09");
});

test("charsFor in 'ms' mode: seconds-only countdown formats as mm:ss tiles", () => {
  // 1:05 remaining
  const c = charsFor(65000, "ms");
  assert.deepEqual(c.tiles.map((t) => t.v), ["0", "1", ":", "0", "5"]);
});

test("charsFor in 'ms' mode: exactly on a minute boundary", () => {
  const c = charsFor(120000, "ms"); // 2:00
  assert.deepEqual(c.tiles.map((t) => t.v), ["0", "2", ":", "0", "0"]);
});

test("charsFor in 'hms' mode: hours:minutes:seconds tiles", () => {
  // 1h 02m 05s remaining
  const c = charsFor(3725000, "hms");
  assert.deepEqual(c.tiles.map((t) => t.v), ["0", "1", ":", "0", "2", ":", "0", "5"]);
});

test("charsFor in 'hms' mode: tile count never grows past 2 digits per field", () => {
  // 99 hours, well within a single 2-digit tile pair per field
  const c = charsFor(99 * 3600 * 1000, "hms");
  assert.equal(c.tiles.length, 8); // hh : mm : ss = 2+1+2+1+2
});

test("charsFor in 'days' mode: 'Nd HH:MM:SS' plain string", () => {
  // exactly 1 day, 1 hour remaining
  const c = charsFor((24 + 1) * 3600 * 1000, "days");
  assert.equal(c.plain, "1d 01:00:00");
});

test("charsFor in 'days' mode: multi-day remainder formats correctly", () => {
  // 3 days, 4 hours, 5 minutes, 6 seconds
  const ms = (3 * 86400 + 4 * 3600 + 5 * 60 + 6) * 1000;
  const c = charsFor(ms, "days");
  assert.equal(c.plain, "3d 04:05:06");
});

test("charsFor clamps negative time-remaining to zero instead of going negative", () => {
  const c = charsFor(-5000, "ms");
  assert.deepEqual(c.tiles.map((t) => t.v), ["0", "0", ":", "0", "0"]);
});

test("charsFor floors sub-second remainders (999ms left reads as 0, not 1)", () => {
  const c = charsFor(999, "ms");
  assert.deepEqual(c.tiles.map((t) => t.v), ["0", "0", ":", "0", "0"]);
});

test("charsFor defaults to the module's closure `mode` when no override is passed", () => {
  // No real start()/bootFromHash() ran, so the closure `mode` is still its
  // initial `null` — charsFor falls through both mode checks to the
  // default (mm:ss) branch, same as the "ms" case above.
  const c = charsFor(65000);
  assert.deepEqual(c.tiles.map((t) => t.v), ["0", "1", ":", "0", "5"]);
});
