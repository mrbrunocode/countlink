// Every URL we publish must be the form Cloudflare Pages serves at HTTP 200 —
// never a form it answers with a 308 to the "real" one.
//
// Pages' default `html_handling` is "auto-trailing-slash", which means the
// canonical form of a URL is decided by the file layout, not by our taste:
//
//   dist/foo.html        →  /foo    is 200,  /foo/  and /foo.html 308 away
//   dist/foo/index.html  →  /foo/   is 200,  /foo            308s to /foo/
//
// This existed as a live bug from 2026-07-23 (when guides/ landed) until
// 2026-08-06: `guides/index.html` is a directory index, so /guides 308s to
// /guides/ — but sitemap.xml advertised the bare /guides, the guides index
// page set its OWN canonical to the bare /guides (a canonical pointing at a
// URL that redirects, which is self-defeating), and all 34 pages linked to it
// in the chassis nav and footer. Search Console's "Page with redirect" bucket
// is exactly what that produces once Google gets around to crawling it.
//
// The deploy workflow's sitemap guard did NOT catch this: it only asks
// "does some file exist for this path", and `dist/guides//index.html`
// resolves fine. Existence was never the problem — form was.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SITE_URL } from "../scripts/site-config.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * What Cloudflare Pages will actually do with `path` given the files on disk.
 * Returns "file" (serve <path>.html), "dir" (serve <path>/index.html), or
 * null when nothing backs it.
 */
function resolveKind(path) {
  const clean = path.replace(/^\/+|\/+$/g, "");
  if (clean === "") return "dir"; // the root, served by index.html
  if (existsSync(join(ROOT, `${clean}.html`))) return "file";
  if (existsSync(join(ROOT, clean, "index.html"))) return "dir";
  return null;
}

/** The one URL form that returns 200 for a path, or null if unroutable. */
function canonicalForm(path) {
  const clean = path.replace(/^\/+|\/+$/g, "");
  const kind = resolveKind(clean);
  if (kind === null) return null;
  if (clean === "") return "/";
  return kind === "dir" ? `/${clean}/` : `/${clean}`;
}

const sitemapLocs = () => {
  const xml = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
};

test("every sitemap URL is the form Pages serves at 200, not a 308 source", () => {
  for (const loc of sitemapLocs()) {
    assert.ok(loc.startsWith(SITE_URL), `sitemap loc is not on ${SITE_URL}: ${loc}`);
    const path = loc.slice(SITE_URL.length) || "/";
    const want = canonicalForm(path);
    assert.notEqual(want, null, `sitemap lists ${path} but no file backs it`);
    assert.equal(
      path,
      want,
      `sitemap lists ${path}, which Pages 308s to ${want} — list ${want} instead`,
    );
  }
});

test("no page sets a canonical pointing at a URL that redirects", () => {
  for (const file of htmlFiles()) {
    const html = readFileSync(file, "utf8");
    const m = html.match(/<link rel="canonical" href="([^"]+)"/);
    if (!m) continue;
    const href = m[1];
    if (!href.startsWith(SITE_URL)) continue;
    const path = href.slice(SITE_URL.length) || "/";
    const want = canonicalForm(path);
    if (want === null) continue; // noindex/utility pages may point elsewhere
    assert.equal(
      path,
      want,
      `${rel(file)} canonical is ${path}, which 308s to ${want}`,
    );
  }
});

test("no internal link points at a URL that redirects", () => {
  const offenders = [];
  for (const file of htmlFiles()) {
    const html = readFileSync(file, "utf8");
    for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
      // Only judge links that resolve to a generated page; assets, /embed/
      // and anything unbacked are out of scope here.
      const want = canonicalForm(href);
      if (want === null || want === href) continue;
      offenders.push(`${rel(file)} → ${href} (308s to ${want})`);
    }
  }
  assert.deepEqual(offenders, [], `internal links that redirect:\n${offenders.join("\n")}`);
});

function rel(f) {
  return f.slice(ROOT.length + 1);
}

function htmlFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "archive") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) out.push(p);
    }
  };
  walk(ROOT);
  return out;
}
