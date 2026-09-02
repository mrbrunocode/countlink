// "Your time" labelling.
//
// The end of a countdown is an absolute instant, so every device already
// renders it in its own zone. What this covers is the part that is a decision
// rather than a consequence: when a day is shown at all. A time of day with no
// date attached is a lie for anything further out than tonight, and a date
// attached to something ending in ten minutes is noise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";

const { localEndLabel } = loadDuration();

// Local-time constructor on purpose: the whole feature is about the reader's
// own zone, so the test has to reason in the same terms the code does.
const at = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm).getTime();

test("no day is shown when the instant lands on the reader's today", () => {
  const now = at(2026, 9, 2, 9, 0);
  assert.equal(localEndLabel(at(2026, 9, 2, 17, 30), now).day, "");
});

test("the next calendar day reads as 'tomorrow', not as a date", () => {
  const now = at(2026, 9, 2, 23, 50);
  assert.equal(localEndLabel(at(2026, 9, 3, 0, 10), now).day, "tomorrow");
});

test("anything further out gets a real date", () => {
  const now = at(2026, 9, 2, 9, 0);
  const day = localEndLabel(at(2026, 12, 25, 0, 0), now).day;
  assert.notEqual(day, "");
  assert.notEqual(day, "tomorrow");
  assert.match(day, /Dec|12/, `expected a December date, got ${day}`);
});

test("a same-clock-time instant on a different day is not mistaken for today", () => {
  // The bug this guards: comparing only hours/minutes, so a countdown to the
  // same time next week renders as if it ends this afternoon.
  const now = at(2026, 9, 2, 14, 0);
  assert.notEqual(localEndLabel(at(2026, 9, 9, 14, 0), now).day, "");
});

test("a time is always produced, and a zone is optional but never undefined", () => {
  const l = localEndLabel(at(2026, 9, 2, 17, 30), at(2026, 9, 2, 9, 0));
  assert.match(l.time, /\d/, "no time rendered");
  assert.equal(typeof l.zone, "string", "zone must be a string even when unavailable");
});
