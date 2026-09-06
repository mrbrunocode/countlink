// /features — the page this site did not have, and the reason it was being
// described as "minimalist" by the assistants that send it most of its
// traffic (see docs/perception-gap-2026-09-06.md).
//
// What these tests actually protect is not markup, it is a property: the
// feature list the page shows, the structured data it emits, and the list
// llms.txt hands to a crawler must all be THE SAME LIST. Three copies of a
// feature inventory is precisely the drift this repo has been bitten by four
// times (the README domain table, the footer links, llms.txt, /embed/), and a
// feature list drifts faster than any of those because it changes on every
// ship. So: one source (FEATURES), and these tests fail if any renderer stops
// agreeing with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FEATURES } from "../scripts/build-timer-pages.mjs";
import { SITE_URL } from "../scripts/site-config.mjs";
import { readStable } from "./helpers/generated.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const names = FEATURES.flatMap(([, items]) => items.map(([name]) => name));

test("the page exists and is a real page, not a stub", () => {
  assert.ok(existsSync(join(ROOT, "features.html")), "features.html was not generated");
  const html = readStable("features.html");
  assert.match(html, /<link rel="canonical" href="https:\/\/countlink\.app\/features">/);
  assert.match(html, /<h1[^>]*>Everything CountLink does<\/h1>/);
});

test("every feature in FEATURES is actually named on the page", () => {
  const html = readStable("features.html");
  for (const name of names) {
    // The point of the page is that a summariser can enumerate it. A feature
    // that exists in the data and not in the markup is invisible again.
    assert.ok(html.includes(`<dt>${name}</dt>`), `not rendered on /features: ${name}`);
  }
});

test("the structured data lists the same features, in the same order", () => {
  const html = readStable("features.html");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]));
  const app = blocks.find((b) => b["@type"] === "WebApplication");
  const list = blocks.find((b) => b["@type"] === "ItemList");
  assert.ok(app, "no WebApplication block");
  assert.ok(list, "no ItemList block");
  assert.deepEqual(app.featureList, names, "featureList drifted from FEATURES");
  assert.deepEqual(list.itemListElement.map((i) => i.name), names, "ItemList drifted from FEATURES");
  // Free, and stated as free in the data — this is the claim the whole
  // positioning rests on, and the one a competitor comparison will check.
  assert.equal(app.offers.price, "0");
});

test("llms.txt enumerates the features rather than only narrating them", () => {
  const llms = readStable("llms.txt");
  const featuresSection = llms.split("## Features")[1];
  assert.ok(featuresSection, "llms.txt has no ## Features section");
  const beforeNextHeading = featuresSection.split("\n## ")[0];
  for (const name of names) {
    assert.ok(beforeNextHeading.includes(name), `missing from llms.txt's feature list: ${name}`);
  }
  assert.ok(llms.includes(`${SITE_URL}/features`), "llms.txt does not link the features page");
});

test("the features page is in the sitemap exactly once", () => {
  // It is generated rather than one of the hand-written STATIC_PAGES, so it
  // needs its own <loc>. The first version of this declared the URL and never
  // interpolated it — the page shipped unlisted and the build said nothing.
  const sitemap = readStable("sitemap.xml");
  const matches = sitemap.match(new RegExp(`<loc>${SITE_URL}/features</loc>`, "g")) || [];
  assert.equal(matches.length, 1, `expected one /features sitemap entry, found ${matches.length}`);
});

test("the nav points at /features from every page that carries the chassis", () => {
  for (const file of ["index.html", "about.html", "how-it-works.html", "compare.html", "features.html"]) {
    assert.match(readStable(file), /<a href="\/features"/, `${file} does not link /features`);
  }
});

test("features are named as capabilities, not described as absences", () => {
  // The failure mode this whole page exists to fix: a list that reads
  // "no account, no limit, no paid tier" gives a summariser nothing to
  // enumerate. Absences are real and stay on the page — but in their own
  // section, never as the name of a feature.
  for (const name of names) {
    assert.doesNotMatch(name, /^No\b/i, `"${name}" is an absence, not a capability — move it to FEATURE_NEVERS`);
  }
});
