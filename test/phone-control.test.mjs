// Regression tests for the phone-control pure math (assets/app.js) — the
// part of the pause/resume/adjust feature that's actually worth locking in,
// since the pub/sub wiring around it (realtime.js) can't be exercised without
// a live Ably connection. See test/helpers/load-app.mjs for how this is
// loaded without a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { clampAdjustedEnd, clampAdjustedRemaining, computeResumeEnd, genSessionId } = loadDuration();

test("clampAdjustedEnd shifts the deadline by the delta", () => {
  const now = 1_000_000;
  assert.equal(clampAdjustedEnd(now + 60_000, now, 60_000), now + 120_000);
  assert.equal(clampAdjustedEnd(now + 60_000, now, -30_000), now + 30_000);
});

test("clampAdjustedEnd never lets a countdown go to zero or negative — floors at 1s from now", () => {
  const now = 1_000_000;
  // 10s left, someone taps -1 min: without a floor this would put the
  // deadline in the past, which draw() would render as already finished.
  assert.equal(clampAdjustedEnd(now + 10_000, now, -60_000), now + 1000);
});

test("clampAdjustedRemaining shifts the frozen paused value by the delta", () => {
  assert.equal(clampAdjustedRemaining(120_000, 60_000), 180_000);
  assert.equal(clampAdjustedRemaining(120_000, -60_000), 60_000);
});

test("clampAdjustedRemaining floors at 1s — a paused countdown can't be adjusted below that", () => {
  assert.equal(clampAdjustedRemaining(10_000, -60_000), 1000);
});

test("computeResumeEnd recomputes a deadline from 'now' plus the frozen remaining", () => {
  const now = 5_000_000;
  assert.equal(computeResumeEnd(now, 90_000), now + 90_000);
});

test("genSessionId produces a short, URL-safe, non-empty id, and doesn't repeat back to back", () => {
  const a = genSessionId();
  const b = genSessionId();
  assert.match(a, /^[a-z0-9]+$/);
  assert.ok(a.length >= 6);
  assert.notEqual(a, b);
});
