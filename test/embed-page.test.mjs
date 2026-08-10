// What /embed/ must and must not contain.
//
// It is the root index.html copied one directory down so _headers can exempt
// it from X-Frame-Options: DENY and let other sites frame the countdown. That
// copy is the whole feature, and it silently carried two things it shouldn't:
// relative asset paths (covered by asset-refs.test.mjs) and the site's ad and
// analytics tags.
//
// The ad tag matters beyond tidiness. The embed snippet the site hands out is
// a 400x160 iframe, and an AdSense slot inside it has availableWidth=0 — it
// throws TagError on every single load. Serving ads from inside a frame on
// pages we don't control is also the kind of placement that a pending AdSense
// review is entitled to take a dim view of, and all three sites in this family
// are currently sitting on "Low value content" rejections. Analytics goes for
// a plainer reason: an embed impression on someone else's site is not a
// session on this one, and counting it inflates exactly the numbers used to
// judge whether this site has an audience.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildEmbedHtml } from "../scripts/build-timer-pages.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const embedHtml = () => readFileSync(join(ROOT, "embed", "index.html"), "utf8");

test("the built /embed/ page carries no AdSense tag", () => {
  const html = embedHtml();
  assert.doesNotMatch(html, /pagead2\.googlesyndication\.com/, "AdSense loader is still in /embed/");
  assert.doesNotMatch(html, /class="adsbygoogle"/, "AdSense <ins> slot is still in /embed/");
  assert.doesNotMatch(html, /adsbygoogle\s*=\s*window\.adsbygoogle/, "adsbygoogle.push() is still in /embed/");
});

test("the built /embed/ page carries no analytics tag", () => {
  assert.doesNotMatch(embedHtml(), /googletagmanager\.com|gtag\(/, "GA is still in /embed/");
});

test("the built /embed/ page carries no third-party widget scripts at all", () => {
  // Grow (faves.grow.me) survived the first pass of this stripping and was
  // only caught by listing document.scripts on the deployed page — it renders
  // a floating share button and a content-recommendation card straight over
  // the countdown inside the frame.
  assert.doesNotMatch(embedHtml(), /grow\.me|data-grow-initializer/, "Grow is still in /embed/");

  // Stated as a general rule rather than a list, so the next tag someone adds
  // to index.html fails here instead of silently shipping into other people's
  // pages. Only this site's own scripts belong in an embed.
  const external = [...embedHtml().matchAll(/<script[^>]+src="(https?:)?\/\/([^"]+)"/g)].map((m) => m[2]);
  assert.deepEqual(
    external,
    [],
    `/embed/ is pasted onto sites we don't control; it must load nothing but our own assets. Found: ${external.join(", ")}`,
  );
});

test("the built /embed/ page is noindex", () => {
  assert.match(embedHtml(), /<meta name="robots" content="noindex,follow">/);
});

test("the built /embed/ page still has the board and the app script", () => {
  // The stripping above is regex-driven; this is the guard against a future
  // pattern getting greedy and quietly removing the timer itself, which would
  // leave every assertion above passing on an empty page.
  const html = embedHtml();
  assert.match(html, /id="tiles"/, "/embed/ lost the board");
  assert.match(html, /src="\/assets\/app\.js/, "/embed/ lost app.js");
  assert.match(html, /src="\/assets\/realtime\.js"/, "/embed/ lost realtime.js");
});

test("buildEmbedHtml rewrites relative asset refs and leaves absolute ones alone", () => {
  const out = buildEmbedHtml(
    '<head></head><link href="assets/style.css?v=abc"><script src="assets/app.js"></script>' +
      '<link rel="manifest" href="manifest.json"><img src="/assets/og-image.png"><a href="/timers/">t</a>',
  );
  assert.match(out, /href="\/assets\/style\.css\?v=abc"/);
  assert.match(out, /src="\/assets\/app\.js"/);
  assert.match(out, /href="\/manifest\.json"/);
  assert.match(out, /src="\/assets\/og-image\.png"/, "an already-absolute ref must not gain a second slash");
  assert.doesNotMatch(out, /\/\/assets/, "double slash introduced by the rewrite");
  assert.match(out, /href="\/timers\/"/, "page links must be untouched");
});

test("buildEmbedHtml is idempotent", () => {
  // The build reruns constantly and /embed/ is rewritten from index.html each
  // time; running the transform on its own output must not compound.
  const once = buildEmbedHtml('<head></head><link href="assets/style.css">');
  assert.equal(buildEmbedHtml(once), once);
});
