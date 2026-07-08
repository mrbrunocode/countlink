#!/usr/bin/env node
/**
 * Switches Google AdSense on across the whole site in one command, in the
 * two phases AdSense actually happens in:
 *
 *   Phase 1 — application/verification (run the day you apply):
 *       node scripts/enable-adsense.mjs ca-pub-1234567890123456
 *     Injects the AdSense loader <script> into every page's <head> (that's
 *     how AdSense verifies you own the site) and writes the real ads.txt
 *     line. No visible change for visitors — no ad units render yet.
 *
 *   Phase 2 — after approval, once you've created a Display/Horizontal/
 *   Responsive ad unit in the AdSense dashboard:
 *       node scripts/enable-adsense.mjs ca-pub-1234567890123456 --slot 1234567890
 *     Everything in phase 1, plus replaces the commented-out ad-slot
 *     placeholder (below the timer, above supporting content — the
 *     vClock-proven position, see docs/monetization.md) with the live unit
 *     on index.html and every /timers/ page.
 *
 * Safe to re-run: existing IDs are updated in place, nothing duplicates.
 * Regenerates /timers/ pages itself — don't hand-edit those.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// ---------- args ----------
const args = process.argv.slice(2);
const pubId = args.find((a) => !a.startsWith("--"));
const slotIdx = args.indexOf("--slot");
const slotId = slotIdx !== -1 ? args[slotIdx + 1] : null;

if (!pubId || !/^ca-pub-\d{16}$/.test(pubId)) {
  console.error("Usage: node scripts/enable-adsense.mjs ca-pub-<16 digits> [--slot <digits>]");
  console.error("The publisher ID comes from AdSense → Account → Account information.");
  process.exit(1);
}
if (slotIdx !== -1 && !/^\d{8,12}$/.test(slotId ?? "")) {
  console.error("--slot must be the numeric ad-unit ID from AdSense → Ads → By ad unit.");
  process.exit(1);
}
const pubDigits = pubId.replace("ca-pub-", "");

// ---------- markup ----------
const LOADER = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}" crossorigin="anonymous"></script>`;

// min-height reserves the space before the ad loads, so the page never
// shifts under the visitor (CLS). .ad-slot is already display:none in
// fullscreen and OBS-overlay modes via style.css, so ads can never appear
// on a projector screen or in a stream overlay.
//
// data-ad-format="auto" (not "horizontal") deliberately matches whatever
// AdSense's own dashboard generates for the ad unit — "horizontal"/
// "vertical"/"rectangle" combined with full-width-responsive is a legacy
// combo Google discourages and was observed reserving a much taller block
// than intended (large blank gap on mobile) instead of sizing normally.
const AD_UNIT = `<div class="ad-slot">
    <ins class="adsbygoogle" style="display:block;min-height:90px"
         data-ad-client="${pubId}" data-ad-slot="${slotId}"
         data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>`;

// ---------- helpers ----------
async function patch(relPath, edits) {
  const path = join(ROOT, relPath);
  let src = await readFile(path, "utf8");
  for (const [name, re, replacement] of edits) {
    if (!re.test(src)) {
      console.error(`ERROR: could not find ${name} in ${relPath} — file layout changed? Nothing written.`);
      process.exit(1);
    }
    src = src.replace(re, replacement);
  }
  await writeFile(path, src);
  console.log(`patched ${relPath}`);
}

// Matches either the original commented-out ADSENSE head block or an
// already-live loader (so re-runs update the ID instead of duplicating).
const HEAD_BLOCK = /<!--\s*\n\s*ADSENSE \(disabled[\s\S]*?-->|<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+" crossorigin="anonymous"><\/script>/;

// Matches the commented-out ad-slot placeholder (with its explainer
// comment) or an already-live unit.
const SLOT_BLOCK = /<!-- Ad slot deliberately not rendered[\s\S]*?-->\s*<!--\s*<div class="ad-slot">[\s\S]*?-->|<div class="ad-slot">\s*<ins class="adsbygoogle"[\s\S]*?<\/div>/;

// The 6 hand-written pages besides index.html never had an ADSENSE
// placeholder (only index.html's template included one) — they only got
// the GA4 snippet when analytics was wired up. Anchor on the GA4 config
// line instead, and match an already-inserted loader right after it too
// (idempotent re-run).
const STATIC_PAGES = ["about.html", "compare.html", "contact.html", "how-it-works.html", "privacy.html", "terms.html"];
const GA_ANCHOR = /(gtag\('js',new Date\(\)\);gtag\('config','G-WM4M28L7Y1'\);<\/script>)(\n<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+" crossorigin="anonymous"><\/script>)?/;

// ---------- phase 1: loader + ads.txt ----------
await patch("index.html", [["ADSENSE head block", HEAD_BLOCK, LOADER]]);
for (const page of STATIC_PAGES) {
  await patch(page, [["GA4 anchor / AdSense loader", GA_ANCHOR, `$1\n${LOADER}`]]);
}
await patch("scripts/build-timer-pages.mjs", [[
  "ADSENSE head marker",
  /<!-- ANALYTICS \/ ADSENSE placeholders — see index\.html head and docs\/monetization\.md -->|<script async src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-\d+" crossorigin="anonymous"><\/script>/,
  LOADER,
]]);

const adsTxtLine = `google.com, pub-${pubDigits}, DIRECT, f08c47fec0942fa0`;
await writeFile(join(ROOT, "ads.txt"), adsTxtLine + "\n");
console.log(`wrote ads.txt: ${adsTxtLine}`);

// ---------- phase 2: live ad unit ----------
if (slotId) {
  await patch("index.html", [["ad-slot placeholder", SLOT_BLOCK, AD_UNIT]]);
  await patch("scripts/build-timer-pages.mjs", [["ad-slot placeholder", SLOT_BLOCK, AD_UNIT]]);
} else {
  console.log("no --slot given: loader + ads.txt only (application phase). Re-run with --slot after approval.");
}

// ---------- regenerate ----------
execFileSync("node", [join(ROOT, "scripts/build-timer-pages.mjs")], { stdio: "inherit" });

console.log("\nDone. Review with `git diff`, verify one page in the preview, then commit + push to deploy.");
if (slotId) {
  console.log("Post-approval reminder: enable the EEA/UK consent message in AdSense → Privacy & messaging (required for ads in the UK/EEA — dashboard toggle, no code).");
}
