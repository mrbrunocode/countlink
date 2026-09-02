# Overlay screens and AdSense

## The problem

`?overlay=1` renders the board with the page chrome stripped away: no header,
no nav, no footer, no prose, transparent background. It exists so a streamer
can drop the countdown into an OBS Browser Source, and so anyone can put it in
an `<iframe>`.

That is, by AdSense's own definition, **a screen with no publisher content on
it**, and Google-served ads are not allowed on one. This is the same policy
textbench.app was flagged under on 15 Aug 2026 ("Google-served ads on screens
with replicated content") — the first time that reason appeared anywhere in
this family.

It shipped broken for weeks. `style.css` had:

```css
body.overlay-mode .ad-slot{display:none}
```

…while the loader still ran and the inline `push()` beside every `<ins>` still
fired. That is two violations, not one: an ad on a content-free screen, and an
ad unit hidden with CSS.

## What was tried first, and why it was not enough

The obvious fix was to neuter the ad code in place: skip the `push()` behind a
`window.__CL_OVERLAY` flag set in `<head>`, and have `app.js` remove `.ad-slot`
from the DOM rather than hide it.

**Both work, and both are still in place, but together they are not sufficient.**
Verified in a real browser on an overlay screen:

```
insCount: 1
adRelated: [ adsbygoogle.js, abg_config, show_ads_impl_fy2021.js ]
```

The AdSense library injects **its own** auto-ad `<ins>` after `app.js` has
finished cleaning up. `pauseAdRequests` did not help either — setting it in
Google's documented form still did not survive the library loading over the
top of it.

## What is in place now

An overlay request is redirected, from the first script in `<head>`, to
`/embed/`:

```js
window.__CL_OVERLAY = new URLSearchParams(location.search).has("overlay");
if (window.__CL_OVERLAY && location.pathname.indexOf("/embed/") !== 0) {
  location.replace("/embed/" + location.search + location.hash);
}
```

`/embed/` is the same board built with every ad and analytics tag stripped out
(`buildEmbedHtml` in `scripts/build-timer-pages.mjs`, guarded by
`test/embed-page.test.mjs`), and it is the only path `_headers` exempts from
`X-Frame-Options: DENY`. The timer lives in the hash, so it survives the
redirect untouched.

Alongside that:

- the **OBS overlay button** now produces an `/embed/` link directly, so new
  links never take this path at all;
- the **inline `push()`** stays guarded, and **`app.js` still strips
  `.ad-slot`** — defence in depth for anything that renders anyway;
- the loader tag itself stays **static and unconditional on every real page**,
  so AdSense's site verification still finds the code where it belongs.

Verified end to end in `e2e/overlay-and-laps.spec.mjs`: the rendered overlay
document has zero `ins.adsbygoogle`, zero `.ad-slot`, and makes zero requests
to any Google ad or analytics host.

## The one gap left, and how to close it

The **content page that performs the redirect** still starts two requests
before the redirect fires:

```
https://www.googletagmanager.com/gtag/js?id=G-WM4M28L7Y1
https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-...
```

This is not fixable from inside the document. The browser's **preload scanner**
queues an `async <script src>` as soon as it sees the bytes, ahead of executing
any inline script — so moving the guard to the very first line of `<head>`
(which it now is) does not stop it. Confirmed in Chromium and mobile Chrome;
Firefox and WebKit did not exhibit it.

No ad is ever rendered from those requests and the document is torn down
immediately, so the substantive policy question is answered. But to remove them
entirely, the redirect has to happen **at the edge, before the HTML is ever
served**.

`_redirects` cannot do it — that file matches paths only, and has no query
string support (the same limitation that made the www rule silently inert for
three weeks; see `docs/www-redirect.md`).

The fix is a **zone-level Single Redirect rule**, which is a dashboard change:

> Cloudflare → countlink.app → Rules → Redirect Rules → Create rule
>
> - **If** — Custom filter expression:
>   `http.request.uri.query contains "overlay" and not starts_with(http.request.uri.path, "/embed/")`
> - **Then** — Dynamic redirect, status **301**, preserve query string:
>   `concat("https://countlink.app/embed/?", http.request.uri.query)`

Note that a server-side redirect cannot carry the fragment, but it does not
need to: the browser reattaches the original `#…` to the redirect target
itself, so the timer still arrives. Verify with `curl -sI` against production
after adding it — never against the config meant to produce it.

Until that rule exists, the JS redirect is what is protecting these screens,
and it is sufficient for the thing that is actually prohibited: an ad being
displayed.
