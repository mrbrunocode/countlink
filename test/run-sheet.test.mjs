// The agenda run of show.
//
// The sheet and the running clock must be derived from the same segment list
// via the same boundaries() — a printed running order that disagrees with the
// timer on the screen is worse than no printed running order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { runSheetRows, boundaries, computeAgendaState } = loadDuration();
const SEGS = [
  { label: "Intro", minutes: 5 },
  { label: "Demo", minutes: 20 },
  { label: "Q&A", minutes: 10 },
];
const START = 1_800_000_000_000;

test("each row's window is contiguous with the next", () => {
  const rows = runSheetRows(SEGS, START);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].startsAt, START);
  for (let i = 1; i < rows.length; i++) {
    assert.equal(rows[i].startsAt, rows[i - 1].endsAt, `gap or overlap before segment ${i + 1}`);
  }
  assert.equal(rows[2].endsAt - START, 35 * 60000, "the sheet does not span the whole agenda");
});

test("the sheet agrees with the timer's own segment boundaries", () => {
  // The property that matters: same source of truth, not merely same numbers.
  const rows = runSheetRows(SEGS, START);
  const bounds = boundaries(SEGS);
  assert.deepEqual(rows.map((r) => r.endsAt - START), bounds);
});

test("a row's window contains the instant the timer calls that segment current", () => {
  const rows = runSheetRows(SEGS, START);
  for (const r of rows) {
    const mid = (r.startsAt + r.endsAt) / 2;
    const { idx } = computeAgendaState(SEGS, START, mid);
    assert.equal(idx, r.n - 1, `at the midpoint of "${r.label}" the timer is on a different segment`);
  }
});

test("an unlabelled segment gets a positional name rather than an empty cell", () => {
  const rows = runSheetRows([{ label: "", minutes: 5 }], START);
  assert.equal(rows[0].label, "Segment 1");
});

test("a single-segment agenda still produces a whole sheet", () => {
  const rows = runSheetRows([{ label: "Talk", minutes: 45 }], START);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].endsAt - rows[0].startsAt, 45 * 60000);
});
