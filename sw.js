/* CountLink service worker — makes the installed app (and any page you have
 * visited) open and run with no connection.
 *
 * NETWORK-FIRST, ALWAYS. Online, every request goes to the network exactly
 * as if this file didn't exist, and the response is copied into the cache on
 * the way past. The cache is only ever read when the network fails. So a
 * deploy is never hidden behind a stale copy — the failure mode an earlier
 * cache-first version of this file had, and the reason pages used to be left
 * out of the cache entirely.
 *
 * Leaving pages out made the "works offline" claim untrue in the one case it
 * was made for: the installed app launched with no connection got the
 * browser's offline error, because its start page was never cached — only
 * the CSS and JS it would have loaded. (Reported 2026-09-26.) Now:
 *
 *   - navigations (pages) are cached as they're visited, and "/" is primed at
 *     install, so the installed app's start page is always there;
 *   - the shell (stylesheet, scripts, icon, manifest, QR library) is primed
 *     at install and refreshed whenever it's fetched;
 *   - an offline navigation to a page never visited falls back to the cached
 *     home page, which is a working timer — better than a browser error;
 *   - the server endpoints (/api/*, /mcp, /j/*, /badge.svg) are never cached:
 *     a cached "now" or a cached token is a wrong one.
 *
 * Offline, a countdown runs on the device clock (assets/clock.js can't reach
 * /api/now), which is exactly how every countdown ran before clock
 * correction existed.
 */
const CACHE_NAME = "countlink-v3";
/* Scripts and the stylesheet are requested with a ?v=<hash> cache-buster
 * (scripts/bump-asset-version.mjs), so their runtime URLs never equal these
 * bare paths. addAll() still primes them (same bytes), and the offline
 * fallback below matches with {ignoreSearch:true} for exactly that reason. */
const SHELL_ASSETS = [
  "/",
  "/assets/style.css",
  "/assets/app.js",
  "/assets/clock.js",
  "/assets/realtime-config.js",
  "/assets/realtime.js",
  "/assets/vendor/qrcode-2.0.4.js",
  "/assets/favicon.svg",
  "/manifest.json",
];
const NEVER_CACHE = /^\/(api\/|mcp$|j\/|badge\.svg$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never intercept Google Fonts/AdSense/Ably/analytics
  if (NEVER_CACHE.test(url.pathname)) return;

  const isPage = req.mode === "navigate";
  const isShell = url.pathname.startsWith("/assets/") || url.pathname === "/manifest.json";
  if (!isPage && !isShell) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        // Only a complete, successful, same-origin response is worth keeping —
        // never a redirect or an error page standing in for the real thing.
        if (response.ok && response.type === "basic" && !response.redirected) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(req, { ignoreSearch: !isPage })
          .then((hit) => hit || caches.match(req, { ignoreSearch: true }))
          // Redirect rather than serve "/" in place: the home page links its
          // assets relatively, so served at /timers/x it would ask for
          // /timers/assets/… and come up unstyled and dead.
          .then((hit) => hit || (isPage ? caches.match("/").then((home) => (home ? Response.redirect("/", 302) : undefined)) : undefined))
          .then((hit) => hit || Response.error())
      )
  );
});
