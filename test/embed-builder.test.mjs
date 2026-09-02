// The embed builder.
//
// This is the one feature on the site whose value is off-site. Every embed
// plants an attribution link on a page we do not own, and referring domains
// are the single metric that has never moved for this domain. Two things
// therefore have to stay true, and both have been broken before:
//
//   1. the frame is served from /embed/, which is the only path _headers
//      exempts from X-Frame-Options: DENY (the widget silently failed to load
//      on every third-party site until that was found) and the only copy built
//      with the ad and analytics tags stripped out;
//   2. the attribution <a> sits OUTSIDE the iframe. A link inside a frame is
//      attributed to the frame's own document, so an iframe on its own earns
//      no link back — which would make the whole feature pointless.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readStable, allBoardPages } from "./helpers/generated.mjs";

const app = readStable("assets", "app.js");

// The multi-timer and agenda pages have no split-flap board, so no embed.
const boardPages = () => allBoardPages().filter(([, html]) => /id="boardEl"/.test(html));

test("the snippet frames /embed/, never the page it was copied from", () => {
  const fn = app.slice(app.indexOf("function embedSrc()"), app.indexOf("function clampNum("));
  assert.match(fn, /u\.pathname\s*=\s*"\/embed\/"/, "embedSrc no longer rewrites the path");
  assert.match(fn, /searchParams\.set\("overlay","1"\)/, "embedSrc no longer requests overlay mode");
});

test("the attribution link is outside the iframe, in both fixed and fluid snippets", () => {
  const fn = app.slice(app.indexOf("function renderEmbedCode()"), app.indexOf('if($("embedBtn"))'));
  // The <a> is appended to the frame string, never interpolated into it.
  assert.match(fn, /\$\("embedCode"\)\.value=`\$\{frame\}\\n<p[^`]*<a href="https:\/\/countlink\.app\/">/,
    "the attribution link is no longer appended outside the frame markup");
  assert.doesNotMatch(fn, /<iframe[^`]*<a href/, "an attribution link ended up inside the iframe markup");
});

test("the default board style is left out of the URL rather than pinned", () => {
  const fn = app.slice(app.indexOf("function embedSrc()"), app.indexOf("function clampNum("));
  assert.match(fn, /if\(st&&st!=="board"\)u\.searchParams\.set\("style",st\)/);
});

test("?style= applies the chosen style without overwriting the viewer's own preference", () => {
  // An embedded board must never change the style of the full site in the same
  // browser — the host page picked that style, not the reader.
  const at = app.indexOf("const urlStyle=");
  assert.notEqual(at, -1, "the ?style= override is gone");
  assert.match(app.slice(at, at + 300), /applyStyleNoSave\(urlStyle\)/);
  const noSave = app.slice(app.indexOf("function applyStyleNoSave"), app.indexOf("function applyStyleNoSave") + 300);
  assert.doesNotMatch(noSave, /localStorage\.setItem/, "the no-save variant writes to localStorage after all");
});

test("the snippet refuses to hand out a link with no countdown in it", () => {
  const fn = app.slice(app.indexOf("function renderEmbedCode()"), app.indexOf('if($("embedBtn"))'));
  assert.match(fn, /if\(!end\)\{/, "an unstarted board would emit '#t=null' into someone else's page");
});

test("every page with a board offers the builder, with all four controls", () => {
  const pages = boardPages();
  assert.ok(pages.length >= 16, `expected the board pages, found ${pages.length}`);
  for (const [p, html] of pages) {
    for (const id of ["embedBtn", "embedCode", "embedW", "embedH", "embedStyle", "embedResponsive"]) {
      assert.match(html, new RegExp(`id="${id}"`), `${p.join("/")} is missing #${id}`);
    }
  }
});
