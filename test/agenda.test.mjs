// Regression tests for the chained-agenda-timer feature (assets/app.js) —
// the pure functions behind the "ordered, auto-advancing sequence" mode.
// See test/helpers/load-app.mjs for how app.js is loaded without a browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { boundaries, fmtAgenda, computeAgendaState, encodeAgendaHash, parseAgendaHash } = loadDuration();

test("boundaries: cumulative end time in ms for each segment", () => {
  const segs = [{ minutes: 5 }, { minutes: 10 }, { minutes: 2 }];
  assert.deepEqual(boundaries(segs), [5 * 60000, 15 * 60000, 17 * 60000]);
});

test("boundaries: empty segment list returns empty array", () => {
  assert.deepEqual(boundaries([]), []);
});

test("fmtAgenda: formats mm:ss, zero-padded", () => {
  assert.equal(fmtAgenda(0), "00:00");
  assert.equal(fmtAgenda(5000), "00:05");
  assert.equal(fmtAgenda(65000), "01:05");
});

test("fmtAgenda: clamps negative remaining to zero", () => {
  assert.equal(fmtAgenda(-5000), "00:00");
});

test("fmtAgenda: rounds up to the next whole second (ceil, not floor)", () => {
  // 4001ms left should still read 5s remaining, not 4 — never show "0
  // seconds left" while time genuinely remains.
  assert.equal(fmtAgenda(4001), "00:05");
});

test("computeAgendaState: mid-first-segment", () => {
  const segs = [{ minutes: 5 }, { minutes: 10 }];
  const start = 0;
  const s = computeAgendaState(segs, start, 2 * 60000); // 2 min elapsed
  assert.equal(s.idx, 0);
  assert.equal(s.total, 15 * 60000);
});

test("computeAgendaState: exactly on a segment boundary rolls into the next segment", () => {
  // bounds.findIndex(b => elapsed < b) — at elapsed === bounds[0] exactly,
  // segment 0 is done (elapsed is not < bounds[0]), segment 1 is current.
  const segs = [{ minutes: 5 }, { minutes: 10 }];
  const s = computeAgendaState(segs, 0, 5 * 60000);
  assert.equal(s.idx, 1);
});

test("computeAgendaState: mid-second-segment", () => {
  const segs = [{ minutes: 5 }, { minutes: 10 }];
  const s = computeAgendaState(segs, 0, 12 * 60000);
  assert.equal(s.idx, 1);
});

test("computeAgendaState: after every segment ends, idx is -1 (agenda complete)", () => {
  const segs = [{ minutes: 5 }, { minutes: 10 }];
  const s = computeAgendaState(segs, 0, 20 * 60000);
  assert.equal(s.idx, -1);
});

test("computeAgendaState: single-segment agenda", () => {
  const segs = [{ minutes: 5 }];
  assert.equal(computeAgendaState(segs, 0, 1000).idx, 0);
  assert.equal(computeAgendaState(segs, 0, 5 * 60000).idx, -1);
});

test("encodeAgendaHash / parseAgendaHash round-trip", () => {
  const segments = [{ label: "Intro", minutes: 5 }, { label: "Q&A", minutes: 10 }];
  const start = 1753000000000;
  const hash = encodeAgendaHash(segments, start);
  const decoded = parseAgendaHash(hash);
  assert.deepEqual(decoded, { segments, start });
});

test("parseAgendaHash: returns null for a hash with no agenda params", () => {
  assert.equal(parseAgendaHash(""), null);
  assert.equal(parseAgendaHash("t=12345&l=foo"), null); // a plain single-timer hash
});

test("parseAgendaHash: returns null for malformed JSON in the ag param", () => {
  assert.equal(parseAgendaHash("ag=not-json&s=1000"), null);
});

test("parseAgendaHash: returns null when segments is not an array", () => {
  const bad = "ag=" + encodeURIComponent(JSON.stringify({ not: "an array" })) + "&s=1000";
  assert.equal(parseAgendaHash(bad), null);
});

test("parseAgendaHash: returns null for an empty segments array", () => {
  const bad = "ag=" + encodeURIComponent(JSON.stringify([])) + "&s=1000";
  assert.equal(parseAgendaHash(bad), null);
});

test("parseAgendaHash: filters out malformed individual segments, keeps valid ones", () => {
  const raw = [
    { label: "Good", minutes: 5 },
    { label: "Bad — zero minutes", minutes: 0 },
    { label: "Bad — negative", minutes: -5 },
    { label: "Bad — no minutes field" },
    { minutes: 5 }, // no label field at all — still invalid (label must be a string)
    { label: "Also good", minutes: 10 },
  ];
  const hash = "ag=" + encodeURIComponent(JSON.stringify(raw)) + "&s=1000";
  const decoded = parseAgendaHash(hash);
  assert.deepEqual(decoded.segments, [
    { label: "Good", minutes: 5 },
    { label: "Also good", minutes: 10 },
  ]);
});

test("parseAgendaHash: null if every segment is malformed", () => {
  const raw = [{ label: "Bad", minutes: 0 }];
  const hash = "ag=" + encodeURIComponent(JSON.stringify(raw)) + "&s=1000";
  assert.equal(parseAgendaHash(hash), null);
});
