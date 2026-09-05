/**
 * CountLink badge — Cloudflare Pages Function, served at /badge.svg.
 *
 * WHY THIS EXISTS
 * ---------------
 * The website embed (embedTargetUrl/embedSnippet in functions/mcp.js) needs
 * an <iframe>, which most places that would want a countdown — a GitHub
 * README, a forum signature, a Notion page — cannot use at all. This is the
 * same idea in a shape those CAN use: a plain <img>, wrapped in a link, the
 * same "attribution link outside the embeddable thing" mechanism CountLink's
 * website embed already relies on to earn a real backlink (see that file's
 * own comment on why the link has to sit outside, not inside).
 *
 * NOT the same tool for the same job, though — checked against real
 * competitors 2026-09-05 (see docs/ai-surface-expansion-plan.md's 2a
 * section): none of them offer this at all, so there is no existing pattern
 * to copy, only the general shape of a GitHub-README countdown badge, which
 * exists as scattered hobbyist projects, not a polished product.
 *
 * WHY A SECOND FILE, NOT PART OF mcp.js
 * --------------------------------------
 * mcp.js answers JSON-RPC; this answers image/svg+xml on plain GET query
 * parameters — genuinely different request shapes, and Cloudflare Pages
 * routes a file to a URL by its path (functions/badge.svg.js → /badge.svg,
 * keeping the trailing .svg — only the final .js is stripped). Kept
 * self-contained with no imports, the same discipline as mcp.js and for the
 * same reason: the unit tests load and execute the exact bytes that deploy,
 * with no build step and no second copy of this logic to drift. The small
 * overlap (escapeXml here vs escapeHtmlAttr in mcp.js, EMBED_STYLES here vs
 * there) is duplication accepted on purpose, not missed — see mcp.js's own
 * header comment for why a self-contained file wins over sharing a module.
 *
 * WHAT THIS CANNOT DO, AND DOES NOT PRETEND TO
 * ----------------------------------------------
 * GitHub's camo image proxy (and most other embedding contexts) strips
 * scripts and fetches+caches the image server-side — there is no "live,
 * ticking" badge achievable here, and promising one would be dishonest. The
 * badge shows coarse, honest text ("3d 04h left", "47m left", "Ended") and
 * links to the real, live, precise countdown for anyone who wants that.
 *
 * Query parameters (not the hash — a hash never reaches a server):
 *   t       required. The countdown's end instant, epoch milliseconds.
 *   l       optional. A label, shown above the time. Capped at 60 chars.
 *   style   optional. "board" (default, dark), "minimal" (transparent,
 *           embeds into any page background) or "light".
 *
 * Cache-Control: public, max-age=60 — camo/most proxies re-fetch on their
 * own schedule regardless (typically minutes), so this keeps origin cost
 * near zero while staying fresh enough for the day/hour granularity the
 * badge actually shows. Not no-store: that would fight the proxy for
 * nothing, re-rendering a value nobody downstream would even display yet.
 */

const BADGE_W = 320, BADGE_H = 110;

/* SVG is XML: the five characters that can break out of an attribute or a
   text node. This is the one place in this file untrusted text (the `l`
   query param) lands in markup rather than inside a URL — encodeURIComponent
   already made the URL half safe on its own. */
function escapeXml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const STYLES = {
  board: { bg: "#1c1c1a", fg: "#ede9e3", dim: "#a8a29a" },
  light: { bg: "#e4e2df", fg: "#2b2825", dim: "#6b665f" },
  // "minimal" has no background rect at all (see renderBadgeSvg) so it
  // embeds cleanly into a page of any color — README markdown especially,
  // where the surrounding background is never under this site's control.
  minimal: { bg: null, fg: "#1c1c1a", dim: "#6b665f" },
};

/* Coarse on purpose (see the file header) — a fixed instant read back a
   minute after the badge was generated must still describe itself
   honestly, so precision would be a lie by the time anyone sees it, not
   just an inconvenience. Exported for the unit tests. */
export function badgeTimeText(remainingSeconds) {
  if (remainingSeconds <= 0) return "Ended";
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  if (days >= 1) return `${days}d ${String(hours).padStart(2, "0")}h left`;
  if (hours >= 1) return `${hours}h ${String(minutes).padStart(2, "0")}m left`;
  if (minutes >= 1) return `${minutes}m left`;
  return "<1m left";
}

/* Pure SVG builder — no DOM, no request object — so the unit tests can
   assert on the exact markup for a given input without spinning up a
   Worker. `style` is assumed already validated to a real key of STYLES. */
export function renderBadgeSvg({ label, style, timeText }) {
  const c = STYLES[style] || STYLES.board;
  const title = escapeXml(`${label ? label + " — " : ""}${timeText} — CountLink`);
  const bgRect = c.bg ? `<rect width="${BADGE_W}" height="${BADGE_H}" rx="10" fill="${c.bg}"/>` : "";
  // Label is optional; when absent the time text moves up to the label's
  // baseline rather than leaving a blank line above it.
  const labelLine = label
    ? `<text x="18" y="34" font-family="monospace,sans-serif" font-size="15" font-weight="700" fill="${c.fg}">${escapeXml(label)}</text>`
    : "";
  const timeY = label ? 68 : 52;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_W}" height="${BADGE_H}" ` +
    `viewBox="0 0 ${BADGE_W} ${BADGE_H}" role="img" aria-label="${title}">` +
    `<title>${title}</title>${bgRect}${labelLine}` +
    `<text x="18" y="${timeY}" font-family="monospace,sans-serif" font-size="26" font-weight="700" fill="${c.fg}">${escapeXml(timeText)}</text>` +
    `<text x="18" y="${BADGE_H - 14}" font-family="sans-serif" font-size="11" fill="${c.dim}">countlink.app</text>` +
    `</svg>`
  );
}

/* A malformed request still gets an image — never a JSON error body or a
   broken-image icon with no explanation, since this is meant to render
   silently inside someone else's page with no console anyone will check. */
export function invalidBadgeSvg(message) {
  const w = 320, h = 60;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ` +
    `role="img" aria-label="${escapeXml(message)}">` +
    `<rect width="${w}" height="${h}" rx="8" fill="#7a1f1f"/>` +
    `<text x="14" y="35" font-family="sans-serif" font-size="13" font-weight="700" fill="#fff">${escapeXml(message)}</text>` +
    `</svg>`
  );
}

const svgResponse = (body, status, cache) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": cache },
  });

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return svgResponse(invalidBadgeSvg("Use GET"), 405, "no-store");
  }

  const url = new URL(request.url);
  const tRaw = url.searchParams.get("t");
  const end = tRaw === null || tRaw === "" ? NaN : +tRaw;
  if (!Number.isFinite(end)) {
    // A cached 400 is a cached broken badge forever on whatever page
    // embedded it — never cache an error response.
    return svgResponse(invalidBadgeSvg("Invalid badge link — missing t="), 400, "no-store");
  }

  const label = (url.searchParams.get("l") || "").slice(0, 60);
  const styleParam = url.searchParams.get("style");
  const style = STYLES[styleParam] ? styleParam : "board";
  const remainingSeconds = Math.round((end - Date.now()) / 1000);
  const timeText = badgeTimeText(remainingSeconds);

  const svg = renderBadgeSvg({ label, style, timeText });
  return svgResponse(svg, 200, "public, max-age=60");
}
