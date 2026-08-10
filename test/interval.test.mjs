// intervalPhase() — the work/rest derivation behind the interval timer page.
//
// Two bugs live here, both found by driving a real interval link in a browser
// rather than by reading the code:
//
// 1. The board's "final 10 seconds" urgency was a bare phaseLeftMs<=10000,
//    which assumes every phase is comfortably longer than 10s. On this site's
//    own advertised Tabata default — 20s work, 10s rest — the rest phase is
//    10s, so it was urgent from its first frame to its last, and work was
//    urgent for half its length. The board pulsed red continuously. An
//    escalation that is always on is not an escalation.
// 2. The progress bar divided the REST phase's remaining time by the whole
//    cycle length instead of by the rest length, so at each work→rest boundary
//    the bar snapped backwards to ~67% and crawled from there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { intervalPhase } = loadDuration();

const s = (n) => n * 1000;

test("phases and rounds advance off elapsed time alone", () => {
  const at = (ms) => intervalPhase(20, 10, 8, ms);

  assert.equal(at(0).round, 1);
  assert.equal(at(0).inWork, true);
  assert.equal(at(0).phaseLeftMs, s(20));

  assert.equal(at(s(19)).inWork, true, "still working at 19s");
  assert.equal(at(s(20)).inWork, false, "rest begins exactly at the work boundary");
  assert.equal(at(s(20)).phaseLeftMs, s(10), "rest starts with the full rest length left");
  assert.equal(at(s(29)).inWork, false);

  assert.equal(at(s(30)).round, 2, "a new cycle is a new round");
  assert.equal(at(s(30)).inWork, true);
});

test("the run ends after exactly rounds × cycle, not a frame later", () => {
  const total = s(30) * 8;
  assert.equal(intervalPhase(20, 10, 8, total - 1).done, false);
  assert.equal(intervalPhase(20, 10, 8, total).done, true);
  assert.equal(intervalPhase(20, 10, 8, total + s(60)).done, true);
});

test("a 20/10 Tabata never pulses urgent — the regression that started this", () => {
  // Sample every 250ms (the real draw() cadence) across a whole 8-round run.
  const total = s(30) * 8;
  const urgentFrames = [];
  for (let t = 0; t < total; t += 250) {
    if (intervalPhase(20, 10, 8, t).urgent) urgentFrames.push(t);
  }
  assert.deepEqual(
    urgentFrames,
    [],
    "the site's own default interval preset pulsed red for most of its run",
  );
});

test("phases longer than 20s keep the final-10-seconds escalation", () => {
  const p = (ms) => intervalPhase(60, 30, 3, ms);
  assert.equal(p(s(49)).urgent, false, "49s in, 11s left — not yet");
  assert.equal(p(s(50)).urgent, true, "exactly 10s left — escalate");
  assert.equal(p(s(59)).urgent, true);
  // The 30s rest phase is also over the threshold, so it escalates too.
  assert.equal(p(s(79)).urgent, false, "rest, 11s left");
  assert.equal(p(s(80)).urgent, true, "rest, 10s left");
});

test("a phase exactly at the 20s threshold does not pulse", () => {
  // Boundary pinned deliberately: 20s is the default work length, and "is the
  // default quiet?" is the question this whole rule exists to answer.
  const anyUrgent = [];
  for (let t = 0; t < s(20); t += 250) if (intervalPhase(20, 20, 2, t).urgent) anyUrgent.push(t);
  assert.deepEqual(anyUrgent, []);
});

test("phaseTotalMs is the current phase's own length, so the bar can fill 0→100 in both", () => {
  // The bar renders 1 - phaseLeftMs/phaseTotalMs. Using the cycle length for
  // rest is what made it jump backwards mid-round.
  const work = intervalPhase(20, 10, 8, s(0));
  assert.equal(work.phaseTotalMs, s(20));
  assert.equal(1 - work.phaseLeftMs / work.phaseTotalMs, 0, "work starts the bar at 0%");

  const rest = intervalPhase(20, 10, 8, s(20));
  assert.equal(rest.phaseTotalMs, s(10), "rest must be measured against the rest length");
  assert.equal(1 - rest.phaseLeftMs / rest.phaseTotalMs, 0, "rest also starts the bar at 0%");

  const restEnd = intervalPhase(20, 10, 8, s(30) - 1);
  assert.ok(1 - restEnd.phaseLeftMs / restEnd.phaseTotalMs > 0.99, "and finishes it at ~100%");
});

test("zero rest is supported — back-to-back rounds never land in a rest phase", () => {
  // The FAQ advertises this; numOr() exists partly because `||` was silently
  // turning an entered 0 into 10.
  for (let t = 0; t < s(60); t += 250) {
    assert.equal(intervalPhase(20, 0, 3, t).inWork, true, `rest phase appeared at ${t}ms`);
  }
  assert.equal(intervalPhase(20, 0, 3, s(20)).round, 2);
});

test("the phase key used for the round-transition beep changes exactly once per boundary", () => {
  // draw() beeps when `round + (inWork?"w":"r")` changes. Boundaries in a
  // 20/10 × 3 run: 20, 30, 50, 60, 80 — five transitions, and none at t=0.
  const keys = [];
  const total = s(30) * 3;
  for (let t = 0; t < total; t += 250) {
    const p = intervalPhase(20, 10, 3, t);
    const k = p.round + (p.inWork ? "w" : "r");
    if (keys[keys.length - 1] !== k) keys.push(k);
  }
  assert.deepEqual(keys, ["1w", "1r", "2w", "2r", "3w", "3r"]);
});
