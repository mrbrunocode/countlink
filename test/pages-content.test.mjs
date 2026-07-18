// Content-integrity checks for the programmatic-SEO timer page collection.
// Duplicated title/meta/FAQ text across pages is the #1 reason these pages
// get filtered from Google's index instead of ranked — these tests catch
// that regression class, plus basic structural mistakes.
//
// Importing this module re-runs its top-level `main()` (it's a script, not
// a library — see scripts/build-timer-pages.mjs), which rewrites timers/*.html
// and sitemap.xml as a side effect. That's the same regeneration `npm run
// build` does; it's deterministic, so re-running it here is harmless.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGES } from "../scripts/build-timer-pages.mjs";

test("every page has a unique slug", () => {
  const slugs = PAGES.map((p) => p.slug);
  assert.equal(new Set(slugs).size, slugs.length, "duplicate slug found");
});

test("every slug is URL-safe (lowercase, digits, hyphens only)", () => {
  for (const p of PAGES) {
    assert.match(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad slug: ${p.slug}`);
  }
});

test("h1 headings are unique across the collection", () => {
  const h1s = PAGES.map((p) => p.h1);
  assert.equal(new Set(h1s).size, h1s.length, "duplicate h1 found");
});

test("meta descriptions are unique across the collection", () => {
  const metas = PAGES.map((p) => p.meta);
  assert.equal(new Set(metas).size, metas.length, "duplicate meta description found");
});

test("intros are unique across the collection", () => {
  const intros = PAGES.map((p) => p.intro);
  assert.equal(new Set(intros).size, intros.length, "duplicate intro found");
});

test("meta description stays within a reasonable length", () => {
  for (const p of PAGES) {
    assert.ok(p.meta.length <= 200, `${p.slug} meta is ${p.meta.length} chars, too long for a meta description`);
  }
});

test("every page's FAQ (when present) has non-empty, unique-within-page Q&A", () => {
  for (const p of PAGES) {
    if (!p.faq) continue;
    assert.ok(p.faq.length >= 2, `${p.slug} FAQ should have at least 2 entries`);
    const questions = p.faq.map((f) => f.q);
    assert.equal(new Set(questions).size, questions.length, `${p.slug} has a duplicate FAQ question`);
    for (const { q, a } of p.faq) {
      assert.ok(q && q.trim().length > 0, `${p.slug} has an empty FAQ question`);
      assert.ok(a && a.trim().length > 0, `${p.slug} has an empty FAQ answer`);
    }
  }
});

test("preset minutes are positive numbers (or omitted for date-based pages)", () => {
  for (const p of PAGES) {
    if (p.minutes === undefined) continue;
    assert.ok(Number.isFinite(p.minutes) && p.minutes > 0, `${p.slug} has an invalid minutes preset: ${p.minutes}`);
  }
});

test("untilMonthDay pages (New Year / Christmas style) use valid [month, day] pairs", () => {
  for (const p of PAGES) {
    if (!p.untilMonthDay) continue;
    const [m, d] = p.untilMonthDay;
    assert.ok(m >= 1 && m <= 12, `${p.slug} has an invalid month: ${m}`);
    assert.ok(d >= 1 && d <= 31, `${p.slug} has an invalid day: ${d}`);
  }
});
