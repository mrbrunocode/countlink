// Runs the actual generator and checks its output is complete and internally
// consistent — catches a PAGES row that breaks the build, or a page that
// silently isn't wired into the sitemap.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PAGES } from "../scripts/build-timer-pages.mjs";
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
    const matches = sitemap.match(new RegExp(`/timers/${p.slug}<`, "g")) || [];
    assert.equal(matches.length, 1, `expected exactly one sitemap entry for ${p.slug}, found ${matches.length}`);
  }
});

test("generated page contains its own h1 and canonical URL", () => {
  const p = PAGES[0];
  const html = readFileSync(join(ROOT, "timers", `${p.slug}.html`), "utf8");
  assert.ok(html.includes(p.h1), "generated page missing its own <h1>/title text");
  assert.ok(html.includes(`${SITE_URL}/timers/${p.slug}`), "generated page missing its own canonical URL");
});
