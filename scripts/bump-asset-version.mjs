#!/usr/bin/env node
/**
 * Cache-busts assets/style.css and assets/app.js by stamping each with a
 * content hash query string (?v=<8 hex chars of its own sha256>) everywhere
 * it's referenced, so a returning visitor's browser is forced to re-fetch
 * the file the moment its content actually changes — instead of serving a
 * stale copy for up to the 4-hour Cache-Control max-age set in _headers.
 *
 * Why this exists: on 2026-07-08 a same-day CSS/JS fix (ad-format gap, sync
 * dot color/visibility) was correctly deployed to the origin and Cloudflare's
 * edge, confirmed via curl — but real visitors (including the site owner on
 * a phone) kept seeing the OLD styling for hours, because their browser's
 * disk cache still held the previous style.css/app.js and had no reason to
 * revalidate within its cache window. A plain unversioned <link>/<script>
 * src can't detect a same-URL content change; a hash in the query string
 * changes the request URL itself, forcing a fresh fetch unconditionally.
 *
 * Usage (run whenever assets/style.css or assets/app.js changes, before
 * committing):
 *     node scripts/bump-asset-version.mjs
 *
 * Idempotent: re-running with no content change is a no-op (same hash in,
 * same hash out). Updates the 7 hand-written pages directly and the
 * timer-page template, then regenerates /timers/ itself — don't hand-edit
 * the query string anywhere.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

async function hashOf(relPath) {
  const buf = await readFile(join(ROOT, relPath));
  return createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

const cssHash = await hashOf("assets/style.css");
const jsHash = await hashOf("assets/app.js");

// Anchored to href="…"/src="…" so only real asset references are touched.
// Unanchored, these matched the filename ANYWHERE in a file — which quietly
// rewrote prose in code comments that happened to mention assets/style.css,
// and (2026-07-25) corrupted a string literal in build-timer-pages.mjs into a
// path that could not be opened. Matching the plain reference or one already
// carrying a stale ?v= keeps re-runs idempotent rather than accumulating.
const CSS_RE = /((?:href|src)="(?:\.\.\/)?assets\/style\.css)(\?v=[0-9a-f]+)?"/g;
const JS_RE = /((?:href|src)="(?:\.\.\/)?assets\/app\.js)(\?v=[0-9a-f]+)?"/g;

async function patch(relPath) {
  const path = join(ROOT, relPath);
  const before = await readFile(path, "utf8");
  const after = before
    .replace(CSS_RE, (_, base) => `${base}?v=${cssHash}"`)
    .replace(JS_RE, (_, base) => `${base}?v=${jsHash}"`);
  if (after !== before) {
    await writeFile(path, after);
    console.log(`patched ${relPath}`);
  }
}

const STATIC_PAGES = ["index.html", "about.html", "compare.html", "contact.html", "how-it-works.html", "privacy.html", "terms.html", "control.html"];
for (const page of STATIC_PAGES) await patch(page);
await patch("scripts/build-timer-pages.mjs");

console.log(`\nstyle.css -> ?v=${cssHash}`);
console.log(`app.js    -> ?v=${jsHash}`);

execFileSync("node", [join(ROOT, "scripts/build-timer-pages.mjs")], { stdio: "inherit" });

console.log("\nDone. Review with `git diff`, then commit + push to deploy.");
