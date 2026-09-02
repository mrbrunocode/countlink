// Where the one ad unit is allowed to sit.
//
// Two rules, both learned the hard way:
//
// 1. The ad may not come between the board and the "Change the countdown"
//    panel. It used to, and ~90px of ad wedged between a tool and its own
//    controls is what put the duration controls 282px below the fold — the
//    observation that drove the settable board. AdSense also treats an ad
//    placed in the middle of a control flow as interfering with content.
// 2. The 404 page carries no ad code at all, loader included. An error page
//    has no publisher content on it, so there is nothing for an ad to sit
//    beside; leaving the library loaded there only invites auto ads to fill it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readStable, allBoardPages } from "./helpers/generated.mjs";

const read = readStable;
const boardPages = allBoardPages;

test("the ad never sits between the board and the setup panel", () => {
  for (const [p, html] of boardPages()) {
    const setupAt = html.indexOf('class="setup-section"');
    if (setupAt === -1) continue; // multi-timer / agenda pages have no setup panel
    const adAt = html.indexOf('class="ad-slot"');
    if (adAt === -1) continue;
    assert.ok(
      adAt > setupAt,
      `${p.join("/")} places the ad above the setup panel — it must come after the controls`,
    );
  }
});

test("there is at most one ad unit per page", () => {
  // Density is its own signal. One slot was always the design (see
  // docs/monetization.md); this stops a second creeping in per page.
  for (const [p, html] of boardPages()) {
    const n = (html.match(/class="adsbygoogle"/g) || []).length;
    assert.ok(n <= 1, `${p.join("/")} has ${n} ad units`);
  }
});

test("the 404 page carries no ad code at all", () => {
  const html = read("404.html");
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com/, "404 still loads the AdSense library");
  assert.doesNotMatch(html, /class="adsbygoogle"/, "404 has an ad unit on it");
});
