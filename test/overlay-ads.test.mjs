// No ad may ever be requested on an overlay screen.
//
// ?overlay=1 strips the page to a transparent board with no header, no footer,
// no nav and no prose — it exists to be dropped into an OBS Browser Source or
// an <iframe> on someone else's site. That is, by AdSense's own definition, a
// screen with no publisher content, and serving an ad on one is a policy
// violation independent of anything to do with content quality.
//
// It shipped that way for weeks: the CSS hid .ad-slot in overlay mode
// (style.css, "body.overlay-mode .ad-slot{display:none}") while the loader
// still ran and the inline push() beside every <ins> still fired. Hiding an ad
// unit with CSS is itself the second half of the same violation. textbench.app
// was flagged on 15 Aug 2026 for exactly this shape ("Google-served ads on
// screens with replicated content"), which is what prompted looking here.
//
// Neutering the ad code in place was tried first and does not hold: with the
// <ins> removed and the push() skipped, the AdSense library still injected its
// own auto-ad <ins> a moment later (confirmed in a browser — one adsbygoogle
// <ins> in the DOM and show_ads_impl loaded on an overlay screen), and
// pauseAdRequests did not survive the library loading over the top of it.
//
// So an overlay request is redirected in <head>, before the loader tag is
// parsed, to /embed/ — the copy built with every ad and analytics tag stripped
// out, already covered by embed-page.test.mjs. Four things have to hold, and
// this file fails if any one of them is removed:
//   1. the redirect fires for ?overlay=1 on any page that is not /embed/;
//   2. it happens in <head>, BEFORE the AdSense loader tag;
//   3. every inline push() is still guarded by window.__CL_OVERLAY, so an
//      overlay screen that somehow renders anyway asks for nothing;
//   4. app.js removes .ad-slot from the DOM in overlay mode rather than
//      leaving CSS to hide it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readStable, allBoardPages, timerPageCount } from "./helpers/generated.mjs";

const read = readStable;

// Every page that can be put into overlay mode is a page that loads app.js.
const overlayCapablePages = () => allBoardPages().filter(([, html]) => /assets\/app\.js/.test(html));

test("every overlay-capable page guards its ad push behind __CL_OVERLAY", () => {
  const pages = overlayCapablePages();
  assert.equal(pages.length, timerPageCount() + 1, "index.html plus every timer page should load app.js");
  for (const [p, html] of pages) {
    const unguarded = html.match(/<script>\(adsbygoogle\s*=\s*window\.adsbygoogle/g);
    assert.equal(unguarded, null, `${p.join("/")} pushes an ad slot without the overlay guard`);
    if (/class="adsbygoogle"/.test(html)) {
      assert.match(
        html,
        /<script>if\(!window\.__CL_OVERLAY\)\(adsbygoogle/,
        `${p.join("/")} has an <ins> slot but no guarded push`,
      );
    }
  }
});

test("an overlay request is redirected to /embed/, from <head>, before the loader", () => {
  for (const [p, html] of overlayCapablePages()) {
    const guardAt = html.indexOf("window.__CL_OVERLAY=");
    const loaderAt = html.indexOf("pagead2.googlesyndication.com");
    const headEnd = html.indexOf("</head>");
    assert.notEqual(guardAt, -1, `${p.join("/")} never sets __CL_OVERLAY`);
    assert.notEqual(loaderAt, -1, `${p.join("/")} lost its AdSense loader`);
    assert.ok(guardAt < loaderAt, `${p.join("/")} runs the guard after the loader — too late`);
    assert.ok(guardAt < headEnd, `${p.join("/")} runs the guard outside <head>`);
    assert.match(
      html,
      /if\(window\.__CL_OVERLAY&&location\.pathname\.indexOf\("\/embed\/"\)!==0\)\{\s*location\.replace\("\/embed\/"\+location\.search\+location\.hash\);/,
      `${p.join("/")} does not send an overlay request to the ad-free /embed/ copy`,
    );
  }
});

test("the redirect cannot loop: /embed/ carries no guard, and the guard skips /embed/", () => {
  // Two independent reasons, because a loop here would be an infinite
  // navigation in someone's OBS scene rather than a visible error.
  const embed = readStable("embed", "index.html");
  assert.doesNotMatch(embed, /__CL_OVERLAY/, "/embed/ kept the redirect guard and would bounce forever");
  assert.match(
    readStable("index.html"),
    /location\.pathname\.indexOf\("\/embed\/"\)!==0/,
    "the guard no longer exempts /embed/ itself",
  );
});

test("app.js removes the ad container in overlay mode rather than hiding it", () => {
  const js = read("assets", "app.js");
  const at = js.indexOf('classList.add("overlay-mode")');
  assert.notEqual(at, -1, "overlay mode is no longer applied at all");
  assert.match(
    js.slice(at, at + 900),
    /querySelectorAll\("\.ad-slot"\)\.forEach\(n=>n\.remove\(\)\)/,
    "overlay mode no longer strips .ad-slot from the DOM",
  );
});

test("the OBS overlay button points at /embed/, which carries no ad code", () => {
  const js = read("assets", "app.js");
  const at = js.indexOf('$("overlayBtn")');
  assert.notEqual(at, -1, "the OBS overlay button handler is gone");
  assert.match(
    js.slice(at, at + 1200),
    /u\.pathname\s*=\s*"\/embed\/"/,
    "the OBS overlay link no longer targets the ad-free /embed/ copy",
  );
});
