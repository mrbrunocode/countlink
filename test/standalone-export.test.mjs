// Tests for the pure logic behind two features (assets/app.js):
//
// - "Download this timer as one HTML file" (buildStandaloneTimerHtml/
//   standaloneFilename) — a separate, minimal, fully offline file, not a
//   copy of this app. The one property that matters most here is that it
//   makes ZERO external requests, ever — that's the whole point of "offline
//   copy" — so the no-external-URL assertions below are the load-bearing
//   ones, not a formality.
// - The "how this works" read-only panel (describeLinkState) — formats the
//   same live state draw()/makeLink() already read, never adds a way to set
//   the timer (see test/settable-board.test.mjs for the rule this must not
//   violate).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { buildStandaloneTimerHtml, standaloneFilename, describeLinkState } = loadDuration();

/* ---------------- buildStandaloneTimerHtml ---------------- */

test("down-mode: produces a self-contained page with the deadline baked in", () => {
  const end = Date.now() + 5 * 60000;
  const html = buildStandaloneTimerHtml(end, "", "down");
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, new RegExp(String(end)), "the end timestamp must be inlined as a literal, not derived");
  assert.match(html, /dir\s*=\s*"down"/, "direction must be baked in as down");
  assert.match(html, /setInterval\(tick,\s*250\)/, "must render itself without any server round-trip");
});

test("up-mode: bakes in the start instant and 'up' direction", () => {
  const start = Date.now() - 90000;
  const html = buildStandaloneTimerHtml(start, "", "up");
  assert.match(html, new RegExp(String(start)));
  assert.match(html, /dir\s*=\s*"up"/);
});

test("a direction other than up/down (e.g. interval) falls back to down rather than throwing", () => {
  const end = Date.now() + 1000;
  assert.doesNotThrow(() => buildStandaloneTimerHtml(end, "", "interval"));
  const html = buildStandaloneTimerHtml(end, "", "interval");
  assert.match(html, /dir\s*=\s*"down"/);
});

test("with a label: the label appears in both the visible page and the title", () => {
  const html = buildStandaloneTimerHtml(Date.now() + 1000, "Break ends", "down");
  assert.match(html, /Break ends/);
  assert.match(html, /<title>Break ends.*<\/title>/);
});

test("without a label: no label markup is emitted, and the title still makes sense on its own", () => {
  const html = buildStandaloneTimerHtml(Date.now() + 1000, "", "down");
  assert.doesNotMatch(html, /class="label"/);
  assert.match(html, /<title>Offline countdown<\/title>/);
});

test("a label is HTML-escaped, since it is free-typed text going straight into markup", () => {
  const html = buildStandaloneTimerHtml(Date.now() + 1000, '<script>alert(1)</script>', "down");
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("the file makes zero external requests — no http(s) URL anywhere in the output", () => {
  const cases = [
    buildStandaloneTimerHtml(Date.now() + 1000, "", "down"),
    buildStandaloneTimerHtml(Date.now() - 1000, "", "up"),
    buildStandaloneTimerHtml(Date.now() + 3600000, "Workshop resumes", "down"),
  ];
  for (const html of cases) {
    assert.doesNotMatch(html, /http/i, "an offline file must contain no http/https reference of any kind (fonts, CDNs, images, anything)");
  }
});

test("no Google Fonts, no external stylesheet or script tag of any kind", () => {
  const html = buildStandaloneTimerHtml(Date.now() + 1000, "", "down");
  assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.match(html, /font-family:-apple-system/, "must fall back to the system font stack, not a webfont");
});

test("is reasonably small — a few KB, not a copy of the full app", () => {
  const html = buildStandaloneTimerHtml(Date.now() + 1000, "A fairly long label for good measure", "down");
  assert.ok(html.length < 4000, `expected a small standalone file, got ${html.length} bytes`);
});

/* ---------------- standaloneFilename ---------------- */

test("standaloneFilename slugifies a label into a safe filename", () => {
  assert.equal(standaloneFilename("Break ends!"), "countlink-break-ends.html");
  assert.equal(standaloneFilename("  Round 2 :: Semis  "), "countlink-round-2-semis.html");
});

test("standaloneFilename falls back to a generic name when there is no label", () => {
  assert.equal(standaloneFilename(""), "countlink-timer.html");
  assert.equal(standaloneFilename(null), "countlink-timer.html");
  assert.equal(standaloneFilename(undefined), "countlink-timer.html");
});

test("standaloneFilename never emits path separators or other filesystem-unsafe characters", () => {
  const name = standaloneFilename("../../etc/passwd?<script>");
  assert.doesNotMatch(name, /[\/\\?<>:*"|]/);
});

/* ---------------- describeLinkState ---------------- */

test("describeLinkState reports no timer when end is not a finite number", () => {
  assert.equal(describeLinkState(null, "", "down", "").hasTimer, false);
  assert.equal(describeLinkState(NaN, "", "down", "").hasTimer, false);
  assert.equal(describeLinkState(undefined, "", "down", "").hasTimer, false);
});

test("describeLinkState describes down/up/interval with distinct copy", () => {
  const end = Date.now() + 60000;
  assert.match(describeLinkState(end, "", "down", "t=1").modeText, /Counts down to/);
  assert.match(describeLinkState(end, "", "up", "t=1").modeText, /Counts up from/);
  assert.match(describeLinkState(end, "", "interval", "t=1").modeText, /Interval cycle/);
});

test("describeLinkState passes the label and raw hash straight through, unmodified", () => {
  const info = describeLinkState(Date.now(), "Quiz round 2", "down", "t=123&l=Quiz%20round%202");
  assert.equal(info.label, "Quiz round 2");
  assert.equal(info.rawHash, "t=123&l=Quiz%20round%202");
});

test("describeLinkState never returns anything shaped like an editable field — read-only by construction", () => {
  const info = describeLinkState(Date.now() + 1000, "x", "down", "t=1");
  // Whatever this returns, it must be a plain description object: no function
  // values (which would imply it hands back a setter), no key that looks
  // like an input hook.
  for (const [k, v] of Object.entries(info)) {
    assert.notEqual(typeof v, "function", `describeLinkState returned a function under "${k}" — this must stay read-only`);
  }
});
