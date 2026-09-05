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

test("parseAgendaHash: a label containing % round-trips (decode exactly once)", () => {
  // URLSearchParams.get() already percent-decodes; decoding again threw
  // URIError on "50% done" ("% d" is not an escape) and the whole link came
  // back null — the same double-decode bug labelFromHash was fixed for.
  // functions/mcp.js's create_agenda emits exactly these links.
  const hash = encodeAgendaHash([{ label: "50% done", minutes: 5 }], 1757000000000);
  const back = parseAgendaHash(hash);
  assert.ok(back);
  assert.equal(back.segments[0].label, "50% done");
});

/* ======================= .ics calendar export ======================= */
// See test/mcp-server.test.mjs for the cross-check corpus against
// functions/mcp.js's own copy of these functions — this file only tests
// app.js's copy in isolation.

const { icsFilename, icsEscapeText, icsTimestamp, icsHash, icsUid, icsFold, buildIcs } = loadDuration();

test("icsFilename slugs a label the same way standaloneFilename does", () => {
  assert.equal(icsFilename("Exam Timer"), "countlink-exam-timer.ics");
  assert.equal(icsFilename(""), "countlink-timer.ics");
  assert.equal(icsFilename(null), "countlink-timer.ics");
  assert.equal(icsFilename("C++ Review!! "), "countlink-c-review.ics");
});

test("icsEscapeText escapes exactly the four RFC 5545 §3.3.11 structural characters", () => {
  assert.equal(icsEscapeText("a;b,c\\d"), "a\\;b\\,c\\\\d");
  assert.equal(icsEscapeText("line one\nline two"), "line one\\nline two");
  assert.equal(icsEscapeText("crlf\r\nhere"), "crlf\\nhere", "a CRLF pair collapses to one \\n, not two");
});

test("icsTimestamp emits the RFC 5545 UTC form", () => {
  assert.equal(icsTimestamp(Date.UTC(2026, 8, 5, 19, 25, 29)), "20260905T192529Z");
  assert.equal(icsTimestamp(Date.UTC(2026, 0, 1, 0, 0, 0)), "20260101T000000Z", "midnight, single-digit month/day pad correctly");
});

test("icsHash is deterministic and label-sensitive", () => {
  assert.equal(icsHash("Focus"), icsHash("Focus"));
  assert.notEqual(icsHash("Focus"), icsHash("Break"));
  assert.equal(icsHash(""), icsHash(undefined), "an empty/undefined label hashes the same, consistently");
});

test("icsUid is stable for the same countdown and differs for a different one", () => {
  assert.equal(icsUid(1757000000000, "Focus"), icsUid(1757000000000, "Focus"), "re-exporting the same countdown produces the same UID");
  assert.notEqual(icsUid(1757000000000, "Focus"), icsUid(1757000000000, "Break"));
  assert.notEqual(icsUid(1757000000000, "Focus"), icsUid(1757000600000, "Focus"));
  assert.match(icsUid(1757000000000, "Focus"), /^1757000000000-[0-9a-f]{8}@countlink\.app$/);
});

test("icsFold leaves short lines alone and folds long ones with a leading space", () => {
  const short = "SUMMARY:Focus";
  assert.equal(icsFold(short), short);
  const long = "SUMMARY:" + "x".repeat(100);
  const folded = icsFold(long);
  const parts = folded.split("\r\n");
  assert.ok(parts.length > 1, "a 108-char line must fold");
  assert.ok(parts[0].length <= 75, parts[0].length);
  for (const cont of parts.slice(1)) assert.ok(cont.startsWith(" "), JSON.stringify(cont));
  // Unfolding is: first line as-is, plus every continuation line with its
  // one mandatory leading space stripped (RFC 5545 §3.1) — not a blind
  // join, which would keep that space as content that was never there.
  const unfolded = parts[0] + parts.slice(1).map((p) => p.slice(1)).join("");
  assert.equal(unfolded, long, "unfolding must reproduce the original exactly");
});

test("buildIcs produces a well-formed single-event calendar with CRLF line endings", () => {
  const now = 1757000000000, end = now + 1500000; // 25 minutes later
  const ics = buildIcs([{ uid: icsUid(end, "Focus"), summary: "Focus", startMs: end, endMs: end, url: "https://countlink.app/#t=" + end }], now);
  assert.match(ics, /\r\n/, "must use CRLF, not bare LF");
  assert.ok(!/[^\r]\n/.test(ics), "every LF must be preceded by CR — no bare LF anywhere");
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.match(ics, /BEGIN:VEVENT\r\n/);
  assert.match(ics, /SUMMARY:Focus\r\n/);
  assert.match(ics, new RegExp(`DTSTART:${icsTimestamp(end)}\\r\\n`));
  assert.match(ics, new RegExp(`DTEND:${icsTimestamp(end)}\\r\\n`));
  assert.match(ics, /URL:https:\/\/countlink\.app\/#t=\d+\r\n/);
});

test("buildIcs escapes a label containing structural characters inside SUMMARY", () => {
  // Computed via icsEscapeText itself (already pinned above) rather than a
  // hand-written double-escaped literal — a semicolon/comma/backslash mix
  // written by hand in both a JS string AND a regex is exactly the kind of
  // thing that silently asserts the wrong value; see the fix this test
  // itself needed during review.
  const now = 1757000000000;
  const summary = "Q&A; break, review\\notes";
  const ics = buildIcs([{ uid: icsUid(now, "x"), summary, startMs: now, endMs: now }], now);
  assert.ok(ics.includes(`SUMMARY:${icsEscapeText(summary)}`), ics);
  // And independently confirm the escaping actually happened — this line
  // would also pass if icsEscapeText were a no-op, which the line above
  // alone would not catch.
  assert.ok(!ics.includes("SUMMARY:Q&A; break"), "the raw, unescaped semicolon must not appear");
});

test("buildIcs emits one VEVENT per event, in order", () => {
  const now = 1757000000000;
  const ics = buildIcs([
    { uid: "a@countlink.app", summary: "Intro", startMs: now, endMs: now + 600000 },
    { uid: "b@countlink.app", summary: "Talk", startMs: now + 600000, endMs: now + 3000000 },
  ], now);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.indexOf("SUMMARY:Intro") < ics.indexOf("SUMMARY:Talk"), "segments stay in order");
});
