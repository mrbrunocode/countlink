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

// The Pomodoro page's long break: every `longEvery`th round's rest is
// `longRestSec` instead of the plain `restSec`. Rounds no longer share one
// cycle length once this is on, so it gets its own coverage rather than
// trusting the modulo-based math above to generalize.
test("omitting longRestSec/longEvery behaves exactly as before — no cycle-length regression", () => {
  const total = s(30) * 8;
  for (let t = 0; t < total; t += 1000) {
    const withDefaults = intervalPhase(20, 10, 8, t);
    const explicitlyDisabled = intervalPhase(20, 10, 8, t, 0, 0);
    assert.deepEqual(explicitlyDisabled, withDefaults, `mismatch at ${t}ms`);
  }
});

test("long break lands on every Nth round and is the long length, not the short one", () => {
  // 25/5 work/rest (in seconds), 8 rounds, long break of 20 min every 4th round.
  const WORK = 25 * 60, REST = 5 * 60, LONG = 20 * 60;
  const at = (ms) => intervalPhase(WORK, REST, 8, ms, LONG, 4);

  const round1CycleEnd = s(WORK + REST);
  assert.equal(at(round1CycleEnd - 1).inWork, false, "still in round 1's short break");
  assert.equal(at(round1CycleEnd - 1).isLongBreak, false, "round 1's break is short, not long");

  // Round 4's rest starts after 4 focus blocks + 3 short breaks.
  const round4RestStart = s(WORK * 4 + REST * 3);
  assert.equal(at(round4RestStart).inWork, false);
  assert.equal(at(round4RestStart).isLongBreak, true, "round 4's break is the long one");
  assert.equal(at(round4RestStart).phaseTotalMs, s(LONG), "long break runs the long length");
  assert.equal(at(round4RestStart).round, 4);

  // Round 5 starts right after the 20-minute long break, not a 5-minute one.
  const round5Start = round4RestStart + s(LONG);
  assert.equal(at(round5Start).round, 5);
  assert.equal(at(round5Start).inWork, true);
});

test("isLongBreak is false during work, even on a long-break round", () => {
  const WORK = 25 * 60, REST = 5 * 60, LONG = 20 * 60;
  const p = intervalPhase(WORK, REST, 8, s(WORK * 3 + REST * 3), LONG, 4);
  assert.equal(p.round, 4);
  assert.equal(p.inWork, true, "round 4's work phase, right after round 3's short break");
  assert.equal(p.isLongBreak, false, "isLongBreak must not fire during the work half of the round");
});

test("longEvery=0 disables the long break even if longRestSec is set", () => {
  const total = s(30) * 8;
  for (let t = 0; t < total; t += 1000) {
    const p = intervalPhase(20, 10, 8, t, 999, 0);
    assert.equal(p.isLongBreak, false, `long break fired at ${t}ms despite longEvery=0`);
  }
});

test("totalMs accounts for the long breaks, so the run doesn't end early", () => {
  // 8 rounds of 25/5 with a 20-min long break every 4th round: 2 long-break
  // rounds (4 and 8) each adding (20−5) extra minutes over the plain total.
  const WORK = 25 * 60, REST = 5 * 60, LONG = 20 * 60;
  const plainTotal = s((WORK + REST) * 8);
  const p = intervalPhase(WORK, REST, 8, 0, LONG, 4);
  const extraPerLongBreak = s(LONG - REST);
  assert.equal(p.totalMs, plainTotal + extraPerLongBreak * 2, "two long-break rounds (4 and 8) in an 8-round run");
  assert.equal(intervalPhase(WORK, REST, 8, p.totalMs - 1, LONG, 4).done, false);
  assert.equal(intervalPhase(WORK, REST, 8, p.totalMs, LONG, 4).done, true);
});
