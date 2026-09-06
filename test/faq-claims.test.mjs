// Stale promises in FAQ copy.
//
// The workshop-timer FAQ said chained agendas were "on the roadmap" for weeks
// after /timers/agenda-timer shipped. Nobody noticed because it was true when
// it was written — and FAQ answers are emitted verbatim into FAQPage JSON-LD,
// which is precisely the surface AI assistants quote back to people. A page
// telling ChatGPT a shipped feature doesn't exist is worse than saying nothing.
//
// So: any phrase that describes a feature as *future* is banned from shipped
// page copy. If something genuinely is future, say so somewhere that isn't
// an FAQ answer, and update it when it lands. Scans the generated HTML (what
// actually ships), not the source arrays, so hand-written pages are covered
// too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STALE = /on the roadmap|coming soon|not yet available|isn'?t available yet|is not available yet/i;

function htmlIn(dir) {
  return readdirSync(join(ROOT, dir))
    .filter((f) => f.endsWith(".html"))
    .map((f) => (dir === "." ? f : `${dir}/${f}`));
}

test("no shipped page promises a feature as future", () => {
  const pages = [...htmlIn("."), ...htmlIn("timers"), ...htmlIn("guides"), ...htmlIn("embed")];
  assert.ok(pages.length > 20, `expected the built site, found ${pages.length} pages`);
  const offenders = [];
  for (const rel of pages) {
    const html = readFileSync(join(ROOT, rel), "utf8");
    const m = html.match(STALE);
    if (m) offenders.push(`${rel}: "…${html.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, " ")}…"`);
  }
  assert.deepEqual(offenders, [], "these pages describe something as not-yet-shipped:\n" + offenders.join("\n"));
});

/* The inverse failure, found 2026-09-06: not a promise about the future, but
 * a DENIAL of something already shipped. /how-it-works said, in prose and
 * again inside its FAQPage JSON-LD, that a pause could not be pushed to
 * viewers — written truthfully in July, still there weeks after phone control
 * shipped in August. Same surface, same audience, and strictly worse than the
 * roadmap case: an assistant reading it told people CountLink lacked the one
 * feature competitors are praised for, using CountLink's own words.
 *
 * The rule: any page allowed to discuss the no-live-connection trade-off must
 * also name the opt-out on the same page. Deliberately not a ban on the
 * phrasing — the trade-off is real, it is the reason viewers are free, and
 * explaining it is good. It just may not be the last word. */
test("no page denies live control without naming phone control", () => {
  const DENIAL = /no channel to (push|broadcast)|nothing can be pushed|can'?t be paused for everyone/i;
  const pages = [...htmlIn("."), ...htmlIn("timers"), ...htmlIn("guides")];
  for (const rel of pages) {
    const html = readFileSync(join(ROOT, rel), "utf8");
    if (!DENIAL.test(html)) continue;
    assert.match(html, /phone control/i,
      `${rel} describes live control as impossible without mentioning phone control, which does it`);
  }
});
