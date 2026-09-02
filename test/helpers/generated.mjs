// Reading generated pages from a test, safely.
//
// node --test runs test FILES in parallel, and build.test.mjs re-runs the real
// generator as one of its cases — so every other file that reads timers/*.html
// is racing a process that is rewriting those exact files. The symptoms are
// two, and both were showing up roughly one run in ten:
//
//   * readdirSync sees 17 of 18 pages, because one has been unlinked and not
//     yet recreated;
//   * readFileSync returns "" for a file caught mid-write.
//
// Both are artefacts of the harness, not of the site, so they are handled here
// once rather than worked around per test. The page list comes from PAGES —
// the same source the build itself uses — instead of from the directory, and
// reads retry briefly on an empty result. A file that is genuinely empty (or
// genuinely missing) still fails, just after the retries are exhausted.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PAGES } from "../../scripts/build-timer-pages.mjs";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function readStable(...parts) {
  const file = join(ROOT, ...parts);
  let last = "";
  for (let i = 0; i < 40; i++) {
    try {
      last = readFileSync(file, "utf8");
      if (last.length) return last;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    // Busy-wait rather than sleep: node:test cases are synchronous here, and a
    // rewrite of a 20KB file is over in well under a millisecond.
    const until = Date.now() + 5;
    while (Date.now() < until);
  }
  throw new Error(`${parts.join("/")} was empty or missing across every retry`);
}

/** index.html plus every generated timer page, as [pathParts, html] pairs. */
export function allBoardPages() {
  return [
    ["index.html"],
    ...PAGES.map((p) => ["timers", `${p.slug}.html`]),
  ].map((parts) => [parts, readStable(...parts)]);
}

export const timerPageCount = () => PAGES.length;
