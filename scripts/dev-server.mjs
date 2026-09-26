#!/usr/bin/env node
/**
 * Minimal static file server for local preview, no dependencies.
 *
 * Why this exists instead of `python3 -m http.server`: that server sends no
 * Cache-Control header, so browsers apply heuristic caching and silently
 * keep serving stale CSS/JS after an edit — confusing during active
 * development. This server always sends `Cache-Control: no-store` so every
 * reload reflects the current files on disk. Not meant for production
 * (Cloudflare Pages handles real caching/deploys) — local preview only.
 *
 * Usage:
 *     node scripts/dev-server.mjs [port]   (default port 4173)
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.argv[2]) || 4173;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/* Pages Functions, run in-process so local preview and the e2e suite exercise
   the exact modules that deploy (functions/ is self-contained on purpose, see
   each file's header). Mirrors Pages' file-based routing for the routes this
   site has: an exact file (/mcp -> functions/mcp.js, /api/now ->
   functions/api/now.js, /badge.svg -> functions/badge.svg.js) or a one-level
   [param] file (/j/<code> -> functions/j/[code].js). `env` comes from this
   process's environment, so e.g. ABLY_API_KEY=… node scripts/dev-server.mjs
   gives local phone control a real key; without it /api/realtime-token
   answers 503, exactly as production does when the secret is missing. */
async function functionFor(path) {
  const fnRoot = join(ROOT, "functions");
  const exact = join(fnRoot, path.replace(/\/$/, "") + ".js");
  try { await stat(exact); return exact; } catch { /* try a [param] route */ }
  const m = path.match(/^\/([^/]+)\/[^/]+\/?$/);
  if (m) {
    const dyn = join(fnRoot, m[1], "[code].js");
    try { await stat(dyn); return dyn; } catch { /* no function */ }
  }
  return null;
}

async function runFunction(file, req, res) {
  const mod = await import(pathToFileURL(file).href + "?t=" + (await stat(file)).mtimeMs);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const request = new Request(new URL(req.url, `http://localhost:${PORT}`), {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
  });
  const env = {
    ...process.env,
    // Pages' static-asset binding, which j/[code].js uses to serve the real 404 page.
    ASSETS: { fetch: async (u) => new Response(await readFile(join(ROOT, new URL(u).pathname))) },
  };
  const out = await mod.onRequest({ request, env });
  const headers = Object.fromEntries(out.headers);
  res.writeHead(out.status, headers);
  res.end(Buffer.from(await out.arrayBuffer()));
}

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const fn = await functionFor(path);
    if (fn) { await runFunction(fn, req, res); return; }
    if (path.endsWith("/")) path += "index.html";
    let filePath = join(ROOT, path);

    let st;
    try {
      st = await stat(filePath);
      if (st.isDirectory()) { filePath = join(filePath, "index.html"); st = await stat(filePath); }
    } catch {
      // Clean-URL resolution, matching Cloudflare Pages: /about serves
      // about.html (Pages actually 308s .html → extensionless; locally we
      // just serve the file so extensionless internal links work in dev).
      if (!extname(filePath)) {
        try {
          st = await stat(filePath + ".html");
          filePath += ".html";
        } catch { /* fall through to 404 */ }
      }
      if (!st) {
        res.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
        res.end("404 Not Found: " + path);
        return;
      }
    }

    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
    res.end("500 Internal Server Error: " + err.message);
  }
});

server.listen(PORT, () => console.log(`Dev server (no-cache) running at http://localhost:${PORT}/`));
