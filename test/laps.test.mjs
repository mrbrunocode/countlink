// The stopwatch lap model.
//
// Splits are derived from the marks on every read rather than stored, so the
// list can never disagree with itself — that is the property worth pinning
// here, along with the two rules the UI depends on: newest row first, and no
// fastest/slowest labelling until there are two splits to compare.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { lapRows, fmtLap, lapExtremes } = loadDuration();

test("splits are the gap from the previous mark, and the first is the mark itself", () => {
  const rows = lapRows([1000, 2500, 9000]);
  // Newest first.
  assert.deepEqual(rows.map((r) => r.n), [3, 2, 1]);
  assert.deepEqual(rows.map((r) => r.total), [9000, 2500, 1000]);
  assert.deepEqual(rows.map((r) => r.split), [6500, 1500, 1000]);
});

test("totals always equal the running sum of the splits", () => {
  // The invariant that makes deriving-not-storing worth doing.
  const marks = [340, 1200, 1201, 8000, 60000];
  const rows = lapRows(marks).slice().reverse(); // oldest first
  let acc = 0;
  for (const r of rows) {
    acc += r.split;
    assert.equal(r.total, acc, `lap ${r.n} total drifted from the sum of splits`);
  }
});

test("an empty list produces no rows", () => {
  assert.deepEqual(lapRows([]), []);
});

test("fastest and slowest need at least two splits", () => {
  assert.deepEqual(lapExtremes(lapRows([5000])), { fastest: null, slowest: null });
  const two = lapExtremes(lapRows([5000, 6000]));
  assert.equal(two.fastest, 1000);
  assert.equal(two.slowest, 5000);
});

test("lap times render as mm:ss.cc, growing an hours field only when needed", () => {
  assert.equal(fmtLap(0), "00:00.00");
  assert.equal(fmtLap(1234), "00:01.23");
  assert.equal(fmtLap(61000), "01:01.00");
  assert.equal(fmtLap(3661000), "1:01:01.00");
  // A negative can only arrive from a clock jump; it must not render as "-1".
  assert.equal(fmtLap(-500), "00:00.00");
});
