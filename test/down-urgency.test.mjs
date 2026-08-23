// downUrgency() — the down-mode countdown's two-stage urgency signal.
//
// `final` is the original last-10-seconds pulse. `warn` is a quieter, static
// first stage from 60s down to 10s remaining, added so a countdown long
// enough to be worth an early heads-up gets one — gated on total>180000
// (3 minutes) so a short timer doesn't spend its whole run "warning", the
// same failure mode intervalPhase's own urgency gate exists to avoid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { downUrgency } = loadDuration();

const s = (n) => n * 1000;

test("a long countdown (>3 min) gets both stages in order", () => {
  const total = s(300); // 5 minutes
  assert.deepEqual(downUrgency(s(120), total), { final: false, warn: false }, "2 min left — neither stage yet");
  assert.deepEqual(downUrgency(s(61), total), { final: false, warn: false }, "61s left — not yet");
  assert.deepEqual(downUrgency(s(60), total), { final: false, warn: true }, "exactly 60s left — warn starts");
  assert.deepEqual(downUrgency(s(30), total), { final: false, warn: true }, "30s left — still warn");
  assert.deepEqual(downUrgency(s(11), total), { final: false, warn: true }, "11s left — still warn");
  assert.deepEqual(downUrgency(s(10), total), { final: true, warn: false }, "exactly 10s left — final takes over");
  assert.deepEqual(downUrgency(s(1), total), { final: true, warn: false }, "1s left — final");
  assert.deepEqual(downUrgency(0, total), { final: true, warn: false }, "0 left — final");
});

test("a short countdown (<=3 min) never gets the warn stage", () => {
  const total = s(180); // exactly 3 minutes — the boundary itself is excluded
  assert.equal(downUrgency(s(60), total).warn, false, "at the gate boundary, still off");
  assert.equal(downUrgency(s(30), total).warn, false);
  // final-10s still applies regardless of total — it's the original,
  // ungated behaviour and this change doesn't touch it.
  assert.equal(downUrgency(s(5), total).final, true);
});

test("final and warn are never both true", () => {
  for (let total = s(30); total <= s(600); total += s(30)) {
    for (let left = 0; left <= total; left += s(1)) {
      const { final, warn } = downUrgency(left, total);
      assert.ok(!(final && warn), `left=${left} total=${total} set both flags`);
    }
  }
});
