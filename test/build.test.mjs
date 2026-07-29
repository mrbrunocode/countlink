// Runs the actual generator and checks its output is complete and internally
// consistent — catches a PAGES row that breaks the build, or a page that
// silently isn't wired into the sitemap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PAGES, hrefFor } from "../scripts/build-timer-pages.mjs";
import { SITE_URL } from "../scripts/site-config.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test("scripts/build-timer-pages.mjs runs to completion", () => {
  const out = execFileSync("node", ["scripts/build-timer-pages.mjs"], { cwd: ROOT, encoding: "utf8" });
  assert.match(out, /Wrote \d+ pages to/);
});

test("every page slug has a generated HTML file", () => {
  for (const p of PAGES) {
    const file = join(ROOT, "timers", `${p.slug}.html`);
    assert.ok(existsSync(file), `missing generated file for ${p.slug}`);
  }
});

test("sitemap.xml lists every timer page exactly once", () => {
  const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  for (const p of PAGES) {
    const matches = sitemap.match(new RegExp(`${hrefFor(p.slug)}<`, "g")) || [];
    assert.equal(matches.length, 1, `expected exactly one sitemap entry for ${p.slug}, found ${matches.length}`);
  }
});

test("generated page contains its own h1 and canonical URL", () => {
  const p = PAGES[0];
  const html = readFileSync(join(ROOT, "timers", `${p.slug}.html`), "utf8");
  assert.ok(html.includes(p.h1), "generated page missing its own <h1>/title text");
  assert.ok(html.includes(`${SITE_URL}${hrefFor(p.slug)}`), "generated page missing its own canonical URL");
});

// ── Layout architecture ────────────────────────────────────────────────────
// The July 2026 redesign replaced `main.wrap` at 1000px centred — the same
// skeleton on all 38 pages — with the Swiss instrument panel: a chassis strip,
// a fixed index rail, and the board as the one object on it. CountLink is
// hand-built, so seven of those pages are real files that receive their chrome
// by marker sync rather than by being generated; these tests are what catch a
// hand-written page drifting out of the system.

test("every timer slug is filed under exactly one index heading", async () => {
  const { GROUPS } = await import("../scripts/build-timer-pages.mjs");
  const filed = GROUPS.flatMap(([, slugs]) => slugs);
  assert.deepEqual(filed.filter((s, i) => filed.indexOf(s) !== i), [],
    "a slug appears under more than one heading");
  for (const p of PAGES) {
    assert.ok(filed.includes(p.slug), `${p.slug} is not filed in GROUPS — it would vanish from navigation`);
  }
  for (const s of filed) {
    assert.ok(PAGES.some((p) => p.slug === s), `GROUPS lists "${s}", which is not a real page`);
  }
});

test("every page — generated and hand-written — uses the rig, not the old centred column", () => {
  const files = [
    "index.html", "about.html", "how-it-works.html", "compare.html",
    "privacy.html", "terms.html", "contact.html",
    join("timers", "pomodoro-timer.html"), join("guides", "index.html"),
  ];
  for (const f of files) {
    const html = readFileSync(join(ROOT, f), "utf8");
    assert.doesNotMatch(html, /<main class="wrap"/, `${f} still uses the old centred main.wrap`);
    assert.doesNotMatch(html, /class="main-nav"/, `${f} still carries the old nav row`);
    assert.match(html, /<div class="rig">/, `${f} is not mounted in the rig grid`);
    assert.match(html, /<header class="chassis">/, `${f} is missing the chassis`);
  }
});

test("the index rail links every timer, from a generated page and a hand-written one", () => {
  for (const f of [join("timers", "exam-timer.html"), "about.html"]) {
    const html = readFileSync(join(ROOT, f), "utf8");
    const start = html.indexOf('<nav class="rig-index"');
    const rail = html.slice(start, html.indexOf("</nav>", start));
    assert.ok(start > -1, `${f} has no index rail`);
    for (const p of PAGES) {
      assert.ok(rail.includes(`"${hrefFor(p.slug)}"`), `${f}'s rail is missing ${p.slug}`);
    }
  }
  const exam = readFileSync(join(ROOT, "timers", "exam-timer.html"), "utf8");
  assert.match(exam, /href="\/timers\/exam-timer" aria-current="page"/,
    "a timer page should mark itself as current in its own rail");
});

test("the chassis is identical everywhere, so a hand-written page cannot drift", () => {
  const chassisOf = (f) => {
    const html = readFileSync(join(ROOT, f), "utf8");
    const s = html.indexOf('<header class="chassis">');
    return html.slice(s, html.indexOf("</header>", s));
  };
  const reference = chassisOf(join("timers", "pomodoro-timer.html"));
  for (const f of ["privacy.html", "terms.html", "contact.html"]) {
    // Hand-written pages mark their own nav item; compare with that stripped.
    const strip = (s) => s.replace(/ aria-current="page"/g, "");
    assert.equal(strip(chassisOf(f)), strip(reference), `${f}'s chassis has drifted from the generated one`);
  }
});
