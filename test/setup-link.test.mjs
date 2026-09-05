// The URL contract: #t= (a running countdown) vs #for= (a setup link).
//
// Why this file exists: until now the ONLY way to produce a working CountLink
// URL was to be a human, in a browser, who had already pressed start — the
// share link carries an absolute end timestamp. That makes the link
// unwritable in advance, which rules out every context that can't know the
// current epoch time: a chat assistant answering "give me a 25 minute shared
// timer", a bookmark, a calendar invite, a lesson plan, a saved OBS scene.
// #for= is the setup half of the contract.
//
// The property that must never regress: a setup link is READY, not RUNNING.
// If #for= ever auto-started, three people opening the same link at three
// different times would each get their own countdown — the per-visitor
// "evergreen countdown" this app deliberately does not do, and the exact
// opposite of "one fixed instant, identical on every screen". The tests below
// pin the parse layer; e2e/setup-link.spec.mjs pins the board state itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { parseSetupHash, labelFromHash, parsePastedDuration, maxSettable } = loadDuration();

/* ---------------- what counts as a setup link ---------------- */

test("#for= parses the same duration grammar the board accepts on paste", () => {
  // Not a second syntax — parseSetupHash defers to parsePastedDuration so
  // that "#for=1h30m" and pasting "1h30m" onto the flaps can never diverge,
  // and llms.txt only has to teach one grammar to a model.
  assert.equal(parseSetupHash("#for=10m").seconds, 600);
  assert.equal(parseSetupHash("#for=25m").seconds, 1500);
  assert.equal(parseSetupHash("#for=1h30m").seconds, 5400);
  assert.equal(parseSetupHash("#for=5:00").seconds, 300);
  assert.equal(parseSetupHash("#for=1:30:00").seconds, 5400);
  assert.equal(parseSetupHash("#for=90s").seconds, 90);
  assert.equal(parseSetupHash("#for=45").seconds, 2700, "a bare number is minutes");
});

test("every #for= value agrees with parsePastedDuration exactly", () => {
  // Belt and braces on the line above: if someone later "optimises"
  // parseSetupHash into its own regex, this fails rather than letting the two
  // grammars drift apart silently.
  for (const raw of ["10m", "1h30m", "5:00", "1:30:00", "90s", "45", "7", "2h"]) {
    assert.equal(parseSetupHash("#for=" + raw).seconds, parsePastedDuration(raw), raw);
  }
});

test("the leading # is optional, so callers can pass location.hash or a bare string", () => {
  assert.equal(parseSetupHash("for=10m").seconds, 600);
  assert.equal(parseSetupHash("#for=10m").seconds, 600);
});

test("a label rides along and is optional", () => {
  assert.equal(parseSetupHash("#for=10m&l=Standup").label, "Standup");
  assert.equal(parseSetupHash("#for=10m").label, "", "no label is empty, never undefined");
});

test("order of the params does not matter", () => {
  const a = parseSetupHash("#for=10m&l=Standup");
  const b = parseSetupHash("#l=Standup&for=10m");
  assert.deepEqual(a, b);
});

/* ---------------- &go=1, the opt-in autostart ---------------- */
//
// This is the one way a link can start itself, and it exists for the OBS
// overlay — a Browser Source is a single scene on a single machine with every
// control stripped out and no link to copy from it, so there is no second
// viewer to fall out of sync with. Keeping it OPT-IN is what stops "a link you
// share never auto-starts" from decaying into a per-page exception that nobody
// can see from the URL.

test("a setup link does not start itself unless it says so", () => {
  // The default, and the one that must never flip. If this test ever fails
  // because the default changed, every #for= link ever written becomes a
  // per-viewer countdown.
  assert.equal(parseSetupHash("#for=25m").autostart, false);
  assert.equal(parseSetupHash("#for=25m&l=Focus").autostart, false);
});

test("&go=1 opts a link into starting on load", () => {
  assert.equal(parseSetupHash("#for=10m&go=1").autostart, true);
  assert.equal(parseSetupHash("#go=1&for=10m").autostart, true);
  assert.equal(parseSetupHash("#for=10m&l=Soon&go=1").autostart, true);
});

test("only the exact value 1 arms it — anything else stays ready", () => {
  // A truthy-ish check here would make "go=0" start the timer, which is the
  // worst possible way to get this wrong.
  for (const v of ["0", "", "true", "yes", "2", "on"]) {
    assert.equal(parseSetupHash(`#for=10m&go=${v}`).autostart, false, `go=${v}`);
  }
});

test("&go=1 without a readable duration is still not a link", () => {
  assert.equal(parseSetupHash("#go=1"), null);
  assert.equal(parseSetupHash("#for=&go=1"), null);
  assert.equal(parseSetupHash("#for=junk&go=1"), null);
});

/* ---------------- what is NOT a setup link ---------------- */

test("a running countdown always wins over a stray #for=", () => {
  // #t= is a real deadline somebody is already watching. If a URL somehow
  // carries both, reinterpreting it as a fresh setup would blank a live
  // board — so the setup parser stands down and readHash() takes it.
  assert.equal(parseSetupHash("#t=1757000000000&for=10m"), null);
  assert.equal(parseSetupHash("#t=1757000000000"), null);
});

test("junk in #for= is rejected rather than guessed at", () => {
  for (const bad of ["", "abc", "10x", "--", "1h30", "99:99:99:99", "NaN", "1e3"]) {
    assert.equal(parseSetupHash("#for=" + bad), null, JSON.stringify(bad));
  }
});

test("a zero-length setup link is not a timer", () => {
  // Reachable by hand ("0m", "0:00") and it would otherwise boot a board
  // that is already over — confusing, and it renders as 00:00 with a start
  // button that does nothing useful.
  assert.equal(parseSetupHash("#for=0m"), null);
  assert.equal(parseSetupHash("#for=0:00"), null);
  assert.equal(parseSetupHash("#for=0"), null);
});

test("hashes with no #for= at all are cheap nulls, not throws", () => {
  assert.equal(parseSetupHash(""), null);
  assert.equal(parseSetupHash(null), null);
  assert.equal(parseSetupHash(undefined), null);
  assert.equal(parseSetupHash("#"), null);
  assert.equal(parseSetupHash("#m=%5B%5D"), null, "the multi-timer dashboard hash");
  assert.equal(parseSetupHash("#l=Standup"), null, "a label with no duration is not a setup link");
});

test("an over-long duration clamps instead of being rejected", () => {
  // parsePastedDuration clamps to what six tiles can display. Rejecting
  // outright would be worse: "#for=200h" is a legible intent, and a clamped
  // board is more useful than a silently ignored link.
  assert.equal(parseSetupHash("#for=200h").seconds, maxSettable());
});

/* ---------------- the label decode, which used to crash ---------------- */
//
// This is a REAL bug that shipped, found while adding #for=. readHash() did
// `decodeURIComponent(m.get("l"))` on a value URLSearchParams had already
// decoded — a double decode. A label containing a literal % made the second
// pass throw URIError, and because readHash() is called bare at boot
// (`if(readHash())`), the throw propagated out of the boot block and the
// person who opened the shared link got a board that never rendered at all.
// makeLink() percent-encodes the label, so "50% done" was enough to do it.

test("a label containing % survives instead of throwing", () => {
  const encoded = encodeURIComponent("50% done");
  assert.equal(labelFromHash("#t=1757000000000&l=" + encoded), "50% done");
});

test("labels round-trip through the encoder makeLink actually uses", () => {
  for (const label of [
    "50% done", "20% off — final call", "C++ review", "a+b", "Q3 100% target",
    "Ünïcodé ✓", "quiz #3", "break & regroup", "1/2 way", "done?",
  ]) {
    const hash = "t=1757000000000&l=" + encodeURIComponent(label);
    assert.equal(labelFromHash(hash), label, JSON.stringify(label));
  }
});

test("a malformed escape degrades to the raw text instead of throwing", () => {
  // Hand-edited and chat-client-truncated links are a documented reality here
  // (see validTimestamp's comment in app.js). Showing a slightly wrong label
  // beats failing to render the countdown.
  assert.equal(labelFromHash("#t=1&l=100%"), "100%");
  assert.equal(labelFromHash("#t=1&l=%E0%A4%A"), "%E0%A4%A");
});

test("labelFromHash reads only its own param", () => {
  assert.equal(labelFromHash("#t=1&l=Standup&d=up"), "Standup");
  assert.equal(labelFromHash("#t=1&d=up"), "");
  assert.equal(labelFromHash("#for=10m&l=Focus"), "Focus");
  // "l" must not match the tail of another key — &l= is anchored.
  assert.equal(labelFromHash("#t=1&intl=Nope"), "", "a key ending in 'l' is not the label");
});

test("a setup link's label goes through the same safe decode", () => {
  assert.equal(parseSetupHash("#for=10m&l=" + encodeURIComponent("50% done")).label, "50% done");
  assert.equal(parseSetupHash("#for=10m&l=100%").label, "100%", "malformed escape does not throw");
});
