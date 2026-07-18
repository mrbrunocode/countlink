/* CountLink service worker — caches the static app shell (CSS/JS/icon) so the
 * board itself works offline once a page has loaded. Deliberately does NOT
 * cache HTML pages: they're what actually change (new timer pages, content
 * edits), and a stale cached page here could show old prose or a broken
 * "Restart" state — network-first for those, cache is only the shell.
 *
 * Network-first for the shell too (fixed from an earlier cache-first/stale-
 * while-revalidate version): app.js/style.css are requested with a static
 * ?v= cache-busting query that only changes when someone remembers to run
 * scripts/bump-asset-version.mjs, which isn't guaranteed on every deploy.
 * Cache-first means a returning visitor's first-ever cached copy could
 * silently outlive several real deploys. Network-first still gets the
 * "works offline" goal (cache is the fallback when the network fails) with
 * none of the staleness risk online.
 */
const CACHE_NAME = "countlink-shell-v2";
const SHELL_ASSETS = ["/assets/style.css", "/assets/app.js", "/assets/favicon.svg", "/manifest.json"];

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
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // never intercept Google Fonts/AdSense/QR API calls
  const isShellAsset = SHELL_ASSETS.some((p) => url.pathname === p || url.pathname.startsWith(p.split("?")[0]));
  if (!isShellAsset) return; // let HTML pages hit the network normally

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
