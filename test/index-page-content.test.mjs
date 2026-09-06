// index.html has every FAQ answer written twice — once as visible <dd> copy,
// once inside the FAQPage JSON-LD schema, so Google's rich-result snippet
// says the same thing a reader sees. Nothing enforces they stay in sync
// except discipline; this test is the enforcement, added after the phone
// control feature required editing both copies of the same answer by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(ROOT, "index.html"), "utf8");

function jsonLdFaqAnswers(source) {
  const m = source.match(/"@type":\s*"FAQPage"[\s\S]*?"mainEntity":\s*(\[[\s\S]*?\])\s*\}\s*<\/script>/);
  assert.ok(m, "FAQPage JSON-LD block not found in index.html");
  const parsed = JSON.parse(m[1]);
  return new Map(parsed.map((q) => [q.name, q.acceptedAnswer.text]));
}

function visibleFaqAnswers(source) {
  const grid = source.match(/<dl class="faq-grid">([\s\S]*?)<\/dl>/);
  assert.ok(grid, "visible FAQ grid not found in index.html");
  const items = [...grid[1].matchAll(/<h3>(.*?)<\/h3>\s*<dd>(.*?)<\/dd>/gs)];
  assert.ok(items.length > 0, "no <h3>/<dd> FAQ pairs found");
  return new Map(items.map(([, q, a]) => [q.trim(), a.trim()]));
}

test("every visible FAQ question has a matching JSON-LD entry", () => {
  const jsonLd = jsonLdFaqAnswers(html);
  const visible = visibleFaqAnswers(html);
  for (const question of visible.keys()) {
    assert.ok(jsonLd.has(question), `"${question}" is in the visible FAQ but missing from JSON-LD`);
  }
});

test("JSON-LD FAQ answers match the visible <dd> text exactly (plain-text comparison, tags stripped)", () => {
  const jsonLd = jsonLdFaqAnswers(html);
  const visible = visibleFaqAnswers(html);
  const stripTags = (s) => s.replace(/<[^>]+>/g, "").trim();
  for (const [question, visibleAnswer] of visible) {
    const ldAnswer = jsonLd.get(question);
    assert.equal(stripTags(visibleAnswer), stripTags(ldAnswer),
      `answer text differs between visible FAQ and JSON-LD for "${question}"`);
  }
});

test("the pause/adjust/stop FAQ answer mentions phone control as the live exception", () => {
  const visible = visibleFaqAnswers(html);
  const answer = visible.get("Can I pause or extend a countdown that's already running?");
  assert.ok(answer, "expected FAQ question not found");
  assert.match(answer, /phone control/i);
});

/* ── hero illustration ────────────────────────────────────────────────────
 * Added 2026-09-06 alongside /features. The homepage asserted "everyone
 * counts down to the same instant" in prose and never showed it; every
 * competitor's hero carries a product shot doing exactly that, which is part
 * of why CountLink read as the smaller tool (docs/perception-gap-2026-09-06).
 *
 * What these guard is not the drawing — it is the two properties that make a
 * decorative SVG acceptable on this particular page: it must be described to
 * a screen reader (it carries the pitch, so an unlabelled <svg> would hide
 * the pitch), and it must not exist on mobile, where the hero collapses to a
 * shallow strip specifically so the board lands inside the first 375x667
 * viewport. That property was hard-won in the mobile-first rebuild and a
 * decorative illustration is exactly the kind of thing that quietly undoes it.
 */
test("the hero illustration is described, not just drawn", () => {
  const fig = html.match(/<figure class="hero-fig">[\s\S]*?<\/figure>/);
  assert.ok(fig, "hero figure missing from index.html");
  const svg = fig[0];
  assert.match(svg, /role="img"/, "the SVG is not exposed as an image");
  assert.match(svg, /aria-labelledby="heroFigTitle heroFigDesc"/);
  assert.match(svg, /<title id="heroFigTitle">[^<]{10,}<\/title>/, "no meaningful <title>");
  assert.match(svg, /<desc id="heroFigDesc">[^<]{60,}<\/desc>/, "no meaningful <desc>");
  assert.match(svg, /<figcaption>[^<]{20,}<\/figcaption>/, "no caption");
});

test("the hero illustration and trust row are desktop-only", () => {
  // Asserted against the stylesheet rather than a rendered page so it holds
  // without a browser: both must default to display:none and only be turned
  // on inside a min-width media query.
  const css = readFileSync(join(ROOT, "assets", "style.css"), "utf8");
  for (const cls of [".hero-fig", ".hero-checks"]) {
    assert.match(css, new RegExp(`\\${cls}\\{display:none\\}`),
      `${cls} must be hidden by default so it cannot push the board below the mobile fold`);
  }
});

test("the hero illustration shows the same duration the board defaults to", () => {
  // A drawing that says 05:00 beside a board reading 10:00 is a small lie the
  // eye catches immediately. Ten minutes is the homepage default (PAGES'
  // index row) and the digits in the figure are hand-set, so they can drift.
  const fig = html.match(/<figure class="hero-fig">[\s\S]*?<\/figure>/)[0];
  const digits = [...fig.matchAll(/class="hf-digit"[^>]*>(\d)</g)].map((m) => m[1]);
  assert.equal(digits.length, 12, "expected four digits on each of three screens");
  // Three screens, and all three must read the same thing — that IS the point
  // of the picture.
  const screens = [digits.slice(0, 4).join(""), digits.slice(4, 8).join(""), digits.slice(8, 12).join("")];
  assert.deepEqual(screens, ["1000", "1000", "1000"],
    "all three screens must show the board's default 10:00, identically");
});
