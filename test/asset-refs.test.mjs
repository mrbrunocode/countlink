// Every local file a page asks the browser for must actually exist at the
// path that page resolves it to.
//
// url-forms.test.mjs deliberately scopes itself to *page* links and to the
// question of trailing-slash form ("does /guides 308 to /guides/"). It says so
// in its own comment: "assets, /embed/ and anything unbacked are out of scope
// here". This file covers the gap, and the gap was not hypothetical.
//
// /embed/index.html is written by copying the root index.html into a
// subdirectory. The root links its assets RELATIVELY — href="assets/style.css",
// src="assets/app.js" — which is correct at the root and wrong one level down,
// where all four resolve to /embed/assets/… and 404. The embed widget was
// therefore shipped with no stylesheet, no script and a dead board: an iframe
// of unstyled full-site chrome. It stayed that way from the day the "Embed on
// your site" button landed until 2026-08-10, on the one feature whose entire
// purpose is to be pasted onto other people's sites.
//
// Nothing caught it. The build only string-replaced <head>. The deploy guard
// checks that a file exists for each sitemap path, and /embed/ is noindex so
// it isn't in the sitemap. Every existing test asked about pages; none asked
// what a page loads.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const rel = (f) => f.slice(ROOT.length + 1);

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

/** Local sub-resource refs (things the browser fetches without a click). */
function subresourceRefs(html) {
  const refs = [];
  for (const [, attr, val] of html.matchAll(/\b(src|href)="([^"]+)"/g)) {
    if (/^(https?:)?\/\//.test(val)) continue;            // absolute / protocol-relative
    if (/^(#|mailto:|tel:|data:|javascript:)/.test(val)) continue;
    // href is used for both stylesheets/icons and ordinary page links; only
    // the ones that name a real file extension are sub-resources.
    if (attr === "href" && !/\.(css|svg|png|jpg|jpeg|ico|webmanifest|json|xml|txt)(\?|$)/.test(val)) continue;
    refs.push(val);
  }
  return refs;
}

test("every local sub-resource a page references exists at the path that page resolves it to", () => {
  const missing = [];
  for (const file of htmlFiles()) {
    const html = readFileSync(file, "utf8");
    for (const ref of subresourceRefs(html)) {
      const bare = ref.split("?")[0].split("#")[0];
      // Root-absolute resolves against ROOT; anything else against the
      // referencing file's OWN directory — which is precisely the distinction
      // the /embed/ copy got wrong.
      const onDisk = bare.startsWith("/")
        ? join(ROOT, bare)
        : resolve(dirname(file), bare);
      if (!existsSync(onDisk)) missing.push(`${rel(file)} → ${ref}  (resolves to ${rel(onDisk)}, which does not exist)`);
    }
  }
  assert.deepEqual(missing, [], `pages referencing files that aren't there:\n${missing.join("\n")}`);
});

// The specific rule for /embed/, stated directly rather than left implied by
// the check above: a document served from a subdirectory cannot carry
// root-relative asset paths at all, whatever they happen to resolve to today.
test("/embed/index.html references its assets root-absolutely, never relatively", () => {
  const html = readFileSync(join(ROOT, "embed", "index.html"), "utf8");
  const relative = subresourceRefs(html).filter((r) => !r.startsWith("/"));
  assert.deepEqual(
    relative,
    [],
    `/embed/ is one directory deep, so these resolve under /embed/ and 404:\n${relative.join("\n")}`,
  );
});
