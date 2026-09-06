// The /vs/ comparison pages.
//
// These pages make factual claims about four other companies' pricing and
// limits, which is a different kind of risk from anything else on this site:
// a wrong number here is unfair to them and destroys the page's credibility at
// the same time. So the tests are mostly about honesty and freshness, not
// markup — whether every page cites its source, whether it admits what the
// competitor does better, and whether the figures have been re-checked
// recently enough to still be worth publishing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COMPARISONS } from "../scripts/comparisons.mjs";
import { SITE_URL } from "../scripts/site-config.mjs";
import { readStable } from "./helpers/generated.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test("every comparison generates a page", () => {
  for (const c of COMPARISONS) {
    assert.ok(existsSync(join(ROOT, "vs", `${c.slug}.html`)), `missing vs/${c.slug}.html`);
  }
});

test("every page cites the source it got the competitor's numbers from", () => {
  // The single most important property here. A pricing claim with no source
  // is a rumour, and this site's credibility with a summariser rests on being
  // checkable.
  for (const c of COMPARISONS) {
    const html = readStable("vs", `${c.slug}.html`);
    assert.ok(html.includes(c.pricingUrl), `vs/${c.slug} does not link ${c.name}'s pricing page`);
    assert.match(html, /verified against/i, `vs/${c.slug} does not say the figures were verified`);
    assert.match(html, /Prices and limits change/i, `vs/${c.slug} does not warn the figures can go stale`);
  }
});

test("outbound links to competitors are nofollow and do not leak the opener", () => {
  for (const c of COMPARISONS) {
    const html = readStable("vs", `${c.slug}.html`);
    const links = [...html.matchAll(/<a href="(https?:\/\/[^"]+)"([^>]*)>/g)]
      .filter(([, href]) => !href.startsWith(SITE_URL));
    assert.ok(links.length, `vs/${c.slug} links to no external source at all`);
    for (const [, href, attrs] of links) {
      assert.match(attrs, /rel="[^"]*nofollow/, `${href} on vs/${c.slug} is not nofollow`);
      assert.match(attrs, /rel="[^"]*noopener/, `${href} on vs/${c.slug} is missing noopener`);
    }
  }
});

test("every page says what the competitor does better, at real length", () => {
  // A comparison in which the author wins every row is an advert. This is the
  // section that makes the rest of the page believable, so it is required to
  // exist and required not to be a token sentence.
  for (const c of COMPARISONS) {
    assert.ok(c.theyWinHtml, `${c.slug} has no theyWinHtml`);
    const words = c.theyWinHtml.replace(/<[^>]+>/g, " ").trim().split(/\s+/).length;
    assert.ok(words >= 60, `${c.slug}'s "what they do better" is only ${words} words — too thin to be honest`);
    const html = readStable("vs", `${c.slug}.html`);
    assert.ok(html.includes(`What ${c.name} does better`), `vs/${c.slug} omits the section heading`);
  }
});

test("no page calls a competitor names", () => {
  // Hostile copy is not quotable, and an unquotable comparison page is a
  // comparison page that no assistant will cite. State what a product does and
  // what it costs; never editorialise about it.
  const SLURS = /\b(crippled|greedy|rip-?off|scam|bloated|clunky|useless|garbage|nickel-and-dime)\b/i;
  for (const c of COMPARISONS) {
    const text = readStable("vs", `${c.slug}.html`).replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(text, SLURS, `vs/${c.slug} editorialises about ${c.name}`);
  }
});

test("the figures are fresh enough to publish", () => {
  // Six months is generous for SaaS pricing; past that the page is asserting
  // something nobody has checked. Fails loudly rather than quietly ageing.
  const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;
  for (const c of COMPARISONS) {
    const age = Date.now() - Date.parse(`${c.verified}T00:00:00Z`);
    assert.ok(age < SIX_MONTHS_MS,
      `${c.name}'s figures were last verified ${c.verified} — re-check ${c.pricingUrl} and update scripts/comparisons.mjs`);
    assert.ok(age > -86_400_000, `${c.name}'s verified date is in the future`);
  }
});

test("the cluster has a root: /compare links every page and every page links back", () => {
  // Four orphan pages on a domain with an indexation problem is four pages
  // that never get crawled. /compare is the hub; this keeps it wired.
  const compare = readStable("compare.html");
  for (const c of COMPARISONS) {
    assert.ok(compare.includes(`/vs/${c.slug}`), `/compare does not link vs/${c.slug}`);
    const html = readStable("vs", `${c.slug}.html`);
    assert.ok(html.includes('href="/compare"'), `vs/${c.slug} does not link back to /compare`);
    for (const other of COMPARISONS) {
      if (other.slug === c.slug) continue;
      assert.ok(html.includes(`/vs/${other.slug}`), `vs/${c.slug} does not link vs/${other.slug}`);
    }
  }
});

test("each page is in the sitemap exactly once, and canonicalises to itself", () => {
  const sitemap = readStable("sitemap.xml");
  for (const c of COMPARISONS) {
    const loc = `<loc>${SITE_URL}/vs/${c.slug}</loc>`;
    assert.equal((sitemap.match(new RegExp(loc, "g")) || []).length, 1, `sitemap entry for vs/${c.slug}`);
    const html = readStable("vs", `${c.slug}.html`);
    assert.ok(html.includes(`<link rel="canonical" href="${SITE_URL}/vs/${c.slug}">`), `vs/${c.slug} canonical`);
  }
});

test("llms.txt lists every comparison", () => {
  const llms = readStable("llms.txt");
  for (const c of COMPARISONS) {
    assert.ok(llms.includes(`${SITE_URL}/vs/${c.slug}`), `llms.txt omits vs/${c.slug}`);
  }
});

test("the FAQ schema matches the questions actually on the page", () => {
  for (const c of COMPARISONS) {
    const html = readStable("vs", `${c.slug}.html`);
    const block = html.match(/"@type":"FAQPage","mainEntity":(\[[\s\S]*?\])\}<\/script>/);
    assert.ok(block, `vs/${c.slug} has no FAQPage JSON-LD`);
    const asked = JSON.parse(block[1]).map((q) => q.name);
    assert.deepEqual(asked, c.faq.map((f) => f.q), `vs/${c.slug} schema drifted from its visible FAQ`);
    for (const q of asked) {
      assert.ok(html.includes(`<h3>${q}</h3>`), `vs/${c.slug}: "${q}" is in the schema but not on the page`);
    }
  }
});
