// Figures and tables have to survive a rebuild.
//
// Until now the entire site — 34 pages, eight long-form guides — contained not
// one content image, diagram, figure or table. The only <img> anywhere was the
// runtime-generated QR code. That is the visual signature of generated filler,
// and it is the one quality axis the July 2026 enrichment pass never touched
// (that pass added words, and words alone did not move the AdSense verdict).
//
// The specific risk being guarded is the one this repo has already been bitten
// by twice: a fix hand-edited into a generated .html file, wiped by the next
// `npm run build`. Every assertion here reads the BUILT page, so anything that
// only exists in a hand-edit fails on the next build rather than silently
// disappearing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readStable } from "./helpers/generated.mjs";

test("the sync mechanic is drawn, not only described", () => {
  // /how-it-works exists to explain one idea. It explained it in prose alone.
  const html = readStable("how-it-works.html");
  assert.match(html, /<figure class="fig">/, "the sync diagram is gone from /how-it-works");
  assert.match(html, /<svg viewBox="0 0 640 214"/, "the diagram is no longer an inline SVG");
  // Inline SVG, not an <img>: it inherits the page's ink and the one signal
  // colour, so it stays correct in the seasonal palettes and needs no request.
  assert.match(html, /var\(--signal\)/, "the diagram no longer uses the page's signal colour");
  assert.match(html, /<title id="figSyncTitle">/, "the diagram lost its accessible name");
  assert.match(html, /<desc id="figSyncDesc">/, "the diagram lost its long description");
  assert.match(html, /role="img" aria-labelledby="figSyncTitle figSyncDesc"/, "the SVG is not exposed as an image");
  assert.match(html, /<figcaption>/, "the diagram lost its caption");
});

// Each entry is a page and the comparison it should be presenting as a table
// rather than as a paragraph or a bullet list.
const TABLE_PAGES = [
  ["timers/interval-timer.html", /Work \/ rest \/ rounds for the common protocols/, "Tabata"],
  ["timers/classroom-timer.html", /Countdown lengths that hold attention, by age/, "Older teens"],
  ["guides/the-pomodoro-technique.html", /One full pomodoro set, start to finish/, "Long break"],
  ["guides/put-a-timer-on-your-classroom-screen.html", /What actually works on each screen/, "Chromebook"],
];

test("pages whose content is really a comparison present it as a table", () => {
  for (const [page, caption, sample] of TABLE_PAGES) {
    const html = readStable(...page.split("/"));
    assert.match(html, /<table class="data-table">/, `${page} lost its data table`);
    assert.match(html, caption, `${page} lost its table caption`);
    assert.match(html, new RegExp(sample), `${page}'s table lost its content`);
    // A table that forces the page body to scroll sideways on a phone is worse
    // than the prose it replaced.
    assert.match(html, /<div class="data-table-wrap">/, `${page}'s table is not in a scroll container`);
  }
});

test("every data table has a caption and real header cells", () => {
  for (const [page] of TABLE_PAGES) {
    const html = readStable(...page.split("/"));
    for (const tbl of html.match(/<table class="data-table">[\s\S]*?<\/table>/g) || []) {
      assert.match(tbl, /<caption>/, `a table on ${page} has no caption`);
      assert.match(tbl, /<th scope="col">/, `a table on ${page} has no column headers`);
    }
  }
});
