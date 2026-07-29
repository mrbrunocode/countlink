// Regression tests for the affiliate recommendation card (scripts/build-timer-pages.mjs).
// The two invariants that matter: (1) it must never render with real content
// until AFFILIATE_NAME/URL/BLURB are actually configured — no dead/broken
// links going live by accident — and (2) even once configured, it must only
// appear on pages explicitly tagged `affiliate: true` (the productivity
// timers), not on party/countdown pages where it wouldn't fit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { affiliateCard, PAGES } from "../scripts/build-timer-pages.mjs";

const CONFIGURED = { name: "Toggl Track", url: "https://toggl.com/track/", blurb: "Time your whole day, not just this call." };
const EMPTY = { name: "", url: "", blurb: "" };

test("renders nothing on an affiliate page when config is empty (current real site-config.mjs state)", () => {
  assert.equal(affiliateCard({ affiliate: true }, EMPTY), "");
});

test("renders nothing on a non-affiliate page even if config were set", () => {
  assert.equal(affiliateCard({ affiliate: false }, CONFIGURED), "");
  assert.equal(affiliateCard({}, CONFIGURED), ""); // affiliate flag omitted entirely
});

test("renders the card when both configured and tagged", () => {
  const html = affiliateCard({ affiliate: true }, CONFIGURED);
  assert.match(html, /Sponsored/);
  assert.match(html, /Toggl Track/);
  assert.match(html, /href="https:\/\/toggl\.com\/track\/"/);
  assert.match(html, /rel="sponsored noopener"/);
});

test("renders nothing if only some of the three config values are set (partial config)", () => {
  assert.equal(affiliateCard({ affiliate: true }, { name: "Toggl", url: "", blurb: "x" }), "");
  assert.equal(affiliateCard({ affiliate: true }, { name: "", url: "https://x.com", blurb: "x" }), "");
  assert.equal(affiliateCard({ affiliate: true }, { name: "Toggl", url: "https://x.com", blurb: "" }), "");
});

// Locks in exactly which pages are meant to carry the productivity-timer
// affiliate slot — a work-context set, deliberately excluding the party/
// countdown pages (see the original design reasoning in CLAUDE.md /
// site-config.mjs comments). If this list drifts, it should drift on
// purpose, not by accident.
test("exactly the intended productivity-context pages are tagged affiliate:true", () => {
  const tagged = PAGES.filter((p) => p.affiliate).map((p) => p.slug).sort();
  assert.deepEqual(tagged, [
    "classroom-timer",
    "exam-timer",
    "google-meet-timer",
    "group-study-timer",
    "pomodoro-timer",
    "standup-timer",
    "webinar-countdown",
    "workshop-timer",
    "zoom-meeting-timer",
  ]);
});

test("party/countdown pages are NOT tagged affiliate", () => {
  // "stopwatch" was in this list until 2026-07-29, when it was consolidated
  // into the /timers/ hub ("index"). The hub is untagged for the same reason:
  // it's a duration picker, not a productivity-context page.
  const untagged = ["game-night-timer", "new-year-countdown", "christmas-countdown", "auction-countdown", "index"];
  for (const slug of untagged) {
    const p = PAGES.find((pg) => pg.slug === slug);
    assert.ok(p, `fixture page ${slug} not found — did it get renamed?`);
    assert.ok(!p.affiliate, `${slug} should not be tagged affiliate:true`);
  }
});
