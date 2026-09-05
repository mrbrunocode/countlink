// The badge endpoint (functions/badge.svg.js), served at /badge.svg.
//
// This is the one place on the whole site that serves an image rather than
// HTML or JSON — a GitHub README, forum post or similar embeds it with a
// bare <img src>, so the failure modes worth testing are: does it always
// return something a browser/proxy will render as an image (never a JSON
// error body, never a 200 with broken XML), and is the coarse time text
// actually honest about what a cached, non-ticking image can promise.
//
// Loaded the same way test/mcp-server.test.mjs loads functions/mcp.js — a
// data: URL, so these are the exact bytes that deploy, no build step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "functions", "badge.svg.js"), "utf8");
const badge = await import("data:text/javascript," + encodeURIComponent(src));
const { onRequest, renderBadgeSvg, invalidBadgeSvg, badgeTimeText } = badge;

const get = (qs) => onRequest({ request: new Request(`https://countlink.app/badge.svg${qs}`) });

/* ======================= badgeTimeText ======================= */

test("badgeTimeText is coarse: days+hours, then hours+minutes, then minutes, then Ended", () => {
  assert.equal(badgeTimeText(0), "Ended");
  assert.equal(badgeTimeText(-500), "Ended", "never negative time on a badge");
  assert.equal(badgeTimeText(30), "<1m left");
  assert.equal(badgeTimeText(59), "<1m left");
  assert.equal(badgeTimeText(60), "1m left");
  assert.equal(badgeTimeText(47 * 60), "47m left", "the plan's own example");
  assert.equal(badgeTimeText(3599), "59m left");
  assert.equal(badgeTimeText(3600), "1h 00m left");
  assert.equal(badgeTimeText(3600 * 2 + 60 * 15), "2h 15m left");
  assert.equal(badgeTimeText(86399), "23h 59m left");
  assert.equal(badgeTimeText(86400), "1d 00h left");
  // The plan's other named example: 3 days, 4 hours.
  assert.equal(badgeTimeText(3 * 86400 + 4 * 3600), "3d 04h left");
  assert.equal(badgeTimeText(99 * 86400 + 23 * 3600), "99d 23h left", "no upper bound assumed");
});

/* ======================= renderBadgeSvg ======================= */

test("renderBadgeSvg produces well-formed, self-contained SVG with no external references", () => {
  const svg = renderBadgeSvg({ label: "Launch", style: "board", timeText: "3d 04h left" });
  assert.ok(svg.startsWith("<svg "));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  assert.equal((svg.match(/<svg/g) || []).length, 1);
  // No script, no external resource load — this renders inside GitHub's
  // camo proxy and similar, which strip or refuse exactly these.
  assert.ok(!/<script|href=|xlink:href=|<image /.test(svg), svg);
  assert.match(svg, /Launch/);
  assert.match(svg, /3d 04h left/);
  assert.match(svg, /countlink\.app/, "self-identifies even if detached from its wrapping link");
});

test("no label collapses to one line instead of a blank gap", () => {
  const svg = renderBadgeSvg({ label: "", style: "board", timeText: "47m left" });
  assert.equal((svg.match(/<text/g) || []).length, 2, "just the time and the countlink.app mark");
});

test("every declared style renders, and an unknown style falls back to board", () => {
  for (const style of ["board", "minimal", "light", "neon", undefined]) {
    const svg = renderBadgeSvg({ label: "X", style, timeText: "1m left" });
    assert.ok(svg.startsWith("<svg"), style);
  }
});

test("minimal has no background rect, so it blends into any page", () => {
  const svg = renderBadgeSvg({ label: "X", style: "minimal", timeText: "1m left" });
  assert.ok(!svg.includes("<rect"), svg);
});

test("a label with XML-significant characters cannot break out of markup", () => {
  const hostile = '"><script>alert(1)</script>';
  const svg = renderBadgeSvg({ label: hostile, style: "board", timeText: "1m left" });
  assert.ok(!svg.includes("<script>"), svg);
  assert.match(svg, /&quot;&gt;&lt;script&gt;/);
});

/* ======================= invalidBadgeSvg ======================= */

test("invalidBadgeSvg is still a well-formed, renderable image", () => {
  const svg = invalidBadgeSvg("Invalid badge link — missing t=");
  assert.ok(svg.startsWith("<svg "));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  assert.match(svg, /Invalid badge link/);
});

/* ======================= onRequest (HTTP) ======================= */

test("GET with a valid t= returns 200, image/svg+xml, and a 60s public cache", async () => {
  const res = await get("?t=" + (Date.now() + 90000));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/svg+xml; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "public, max-age=60");
  const body = await res.text();
  assert.ok(body.startsWith("<svg"));
});

test("a missing or unparsable t= is a 400, and is never cached", async () => {
  for (const qs of ["", "?t=", "?t=notanumber", "?l=Focus"]) {
    const res = await get(qs);
    assert.equal(res.status, 400, qs);
    assert.equal(res.headers.get("cache-control"), "no-store", "a cached 400 is a permanently broken badge");
    assert.ok((await res.text()).startsWith("<svg"), "still an image, not a JSON error body");
  }
});

test("an unknown style falls back to board rather than 400ing", async () => {
  const res = await get(`?t=${Date.now() + 90000}&style=neon`);
  assert.equal(res.status, 200);
});

test("a label is carried through into the rendered badge", async () => {
  const res = await get(`?t=${Date.now() + 90000}&l=${encodeURIComponent("Group Study")}`);
  assert.match(await res.text(), /Group Study/);
});

test("an over-long label is capped, matching create_timer's own limit", async () => {
  const res = await get(`?t=${Date.now() + 90000}&l=${encodeURIComponent("x".repeat(200))}`);
  const body = await res.text();
  // Extract the label's own <text> element specifically — the svg's other
  // markup (xmlns, viewBox, and the title/aria-label that repeat the label)
  // all contain unrelated "x" characters, so a raw count over the whole
  // body would never isolate just the rendered label.
  const labelText = body.match(/font-size="15"[^>]*>([^<]*)</)[1];
  assert.equal(labelText.length, 60, labelText);
});

test("only GET and HEAD are accepted", async () => {
  const res = await onRequest({ request: new Request("https://countlink.app/badge.svg?t=1", { method: "POST" }) });
  assert.equal(res.status, 405);
});

test("the coarse time text in a live request matches badgeTimeText for the same remaining time", async () => {
  const end = Date.now() + 47 * 60 * 1000;
  const res = await get(`?t=${end}`);
  const body = await res.text();
  // Allow the request itself to have consumed a second between computing
  // `end` above and the handler reading Date.now() — assert the text is one
  // of the two seconds-adjacent possibilities rather than a single exact one.
  const remaining = Math.round((end - Date.now()) / 1000);
  assert.ok(
    body.includes(badgeTimeText(remaining)) || body.includes(badgeTimeText(remaining - 1)),
    body
  );
});

/* ======================= deploy shape ======================= */

test("badge.svg.js sits where Pages routes /badge.svg — only the trailing .js is stripped", () => {
  // Cloudflare Pages Functions map functions/badge.svg.js → /badge.svg,
  // keeping the .svg — same reasoning as mcp.js's own equivalent test.
  assert.ok(existsSync(join(ROOT, "functions", "badge.svg.js")), "functions/badge.svg.js must exist");
});

test("badge.svg.js is self-contained, same discipline as mcp.js", () => {
  assert.ok(!/^import /m.test(src), "no imports means no build step and no second file to go missing");
});
