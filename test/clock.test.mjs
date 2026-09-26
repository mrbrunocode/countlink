// Clock correction (assets/clock.js + functions/api/now.js).
//
// A shared link carries an absolute instant, so a device with a wrong clock
// shows the wrong time left — and the devices most often projected from
// (classroom PCs, venue laptops) are the ones that drift. clock.js measures
// this device against /api/now and corrects for it. What matters, and what's
// pinned here:
//
//   - the estimate is NTP's: the server's time against the midpoint of the
//     round trip, from the fastest sample;
//   - a device that is already right is left ALONE — a correction smaller
//     than the measurement's own uncertainty is noise, and applying noise
//     would make well-synced screens disagree with each other;
//   - a round trip too slow to place "now" is discarded rather than trusted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const mod = { exports: {} };
new Function("module", "exports", readFileSync(join(ROOT, "assets", "clock.js"), "utf8"))(mod, mod.exports);
const { estimateOffset, appliedOffset, describeOffset, APPLY_MARGIN_MS, MAX_USABLE_RTT_MS } = mod.exports;
const nowFn = await import("data:text/javascript," + encodeURIComponent(readFileSync(join(ROOT, "functions", "api", "now.js"), "utf8")));

test("offset is server time minus the midpoint of the round trip", () => {
  // Device thinks 1000→1100; the server said 61050 at the midpoint: device is 60s slow.
  const est = estimateOffset([{ t0: 1000, server: 61050, t1: 1100 }]);
  assert.deepEqual(est, { offset: 60000, uncertainty: 50, rtt: 100 });
});

test("the fastest round trip wins — it has the smallest window for the answer", () => {
  const est = estimateOffset([
    { t0: 0, server: 130000, t1: 800 },   // slow sample, says +129.6s
    { t0: 2000, server: 122040, t1: 2080 }, // fast sample, says +120s
  ]);
  assert.equal(est.offset, 120000);
  assert.equal(est.rtt, 80);
});

test("unusable samples are ignored, and none usable means no estimate", () => {
  assert.equal(estimateOffset([]), null);
  assert.equal(estimateOffset(null), null);
  assert.equal(estimateOffset([{ t0: 0, server: NaN, t1: 10 }]), null);
  assert.equal(estimateOffset([{ t0: 10, server: 5, t1: 0 }]), null, "a negative round trip (clock stepped mid-request)");
  assert.equal(estimateOffset([{ t0: 0, server: 99999, t1: MAX_USABLE_RTT_MS + 1 }]), null);
});

test("a well-synced device is left alone: corrections inside the noise are not applied", () => {
  // 80ms round trip → ±40ms uncertainty; a 200ms "error" is within 40 + margin.
  assert.equal(appliedOffset({ offset: 200, uncertainty: 40, rtt: 80 }), 0);
  assert.equal(appliedOffset({ offset: -(40 + APPLY_MARGIN_MS), uncertainty: 40, rtt: 80 }), 0, "exactly on the threshold is still noise");
  assert.equal(appliedOffset(null), 0);
});

test("a real error is applied in full, in either direction", () => {
  assert.equal(appliedOffset({ offset: 134000, uncertainty: 40, rtt: 80 }), 134000);
  assert.equal(appliedOffset({ offset: -3000, uncertainty: 40, rtt: 80 }), -3000);
});

test("describeOffset reads as a person would say it, and names the direction", () => {
  assert.equal(describeOffset(134000), "2 min 14 s slow", "server ahead of the device = device is slow");
  assert.equal(describeOffset(-5000), "5 s fast");
  assert.equal(describeOffset(-3 * 3600e3 - 60e3 - 7000), "3 h 1 min fast", "seconds are dropped once hours are involved");
  assert.equal(describeOffset(400), "");
});

test("/api/now answers the time as JSON and is never cached", async () => {
  const before = Date.now();
  const res = await nowFn.onRequest({ request: new Request("https://countlink.app/api/now") });
  const after = Date.now();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const { now } = await res.json();
  assert.ok(now >= before && now <= after, `${now} not within [${before}, ${after}]`);
});

test("/api/now accepts only GET/HEAD", async () => {
  const res = await nowFn.onRequest({ request: new Request("https://countlink.app/api/now", { method: "POST" }) });
  assert.equal(res.status, 405);
});
