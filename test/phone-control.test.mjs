// Regression tests for the phone-control pure math (assets/app.js) — the
// part of the pause/resume/adjust feature that's actually worth locking in,
// since the pub/sub wiring around it (realtime.js) can't be exercised without
// a live Ably connection. See test/helpers/load-app.mjs for how this is
// loaded without a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { clampAdjustedEnd, clampAdjustedRemaining, computeResumeEnd, genSessionId, remoteStateAction } = loadDuration();

// ── remoteStateAction ─────────────────────────────────────────────────────
//
// Every connected tab broadcasts its own state on a 4s heartbeat, and every
// tab applies what it receives. The rule below decides what an incoming
// broadcast is allowed to do to the screen receiving it, and getting it wrong
// was destructive rather than merely wrong: "finished" used to be handled in
// the same branch as "ready", i.e. as a stop command.
//
// So the moment a phone-controlled countdown hit zero, the first board to
// heartbeat "finished" made every other board tear itself down — the "Time."
// readout and its Restart button replaced by "Stopped on this screen", the
// hash cleared — and that board's own stop broadcast rippled onward. A
// classroom projector blanked itself seconds after the exam ended.

test("a finished broadcast never stops another screen — it is a fact, not a command", () => {
  for (const current of ["running", "paused", "finished", "ready"]) {
    assert.notEqual(
      remoteStateAction({ state: "finished" }, current),
      "stop",
      `a peer reaching zero tore down a board that was "${current}"`,
    );
  }
});

test("an explicit stop still stops every screen that isn't already stopped", () => {
  // stopTimer() broadcasts "ready", and that IS a command — it's how the
  // controller's Stop button reaches other screens. This must keep working.
  assert.equal(remoteStateAction({ state: "ready" }, "running"), "stop");
  assert.equal(remoteStateAction({ state: "ready" }, "paused"), "stop");
  assert.equal(remoteStateAction({ state: "ready" }, "finished"), "stop");
});

test("a stop broadcast to an already-stopped screen is inert, so stops can't ripple forever", () => {
  // stopTimer() itself rebroadcasts "ready"; without this, two boards would
  // bounce stop messages off each other indefinitely.
  assert.equal(remoteStateAction({ state: "ready" }, "ready"), "none");
});

test("pause and resume drive state changes only when the state actually differs", () => {
  assert.equal(remoteStateAction({ state: "paused" }, "running"), "pause");
  assert.equal(remoteStateAction({ state: "paused" }, "paused"), "repaint-paused",
    "a repeat heartbeat repaints the frozen tiles without re-entering the state");
  assert.equal(remoteStateAction({ state: "running" }, "paused"), "resume");
  assert.equal(remoteStateAction({ state: "running" }, "running"), "sync-end",
    "a running heartbeat only re-syncs the deadline; it must not restart the render loop");
});

test("a missing or malformed broadcast does nothing", () => {
  assert.equal(remoteStateAction(null, "running"), "none");
  assert.equal(remoteStateAction(undefined, "running"), "none");
  assert.equal(remoteStateAction({}, "running"), "none");
  assert.equal(remoteStateAction({ state: "nonsense" }, "running"), "none");
});

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
