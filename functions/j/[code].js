/**
 * CountLink join codes — Cloudflare Pages Function, served at /j/<code>.
 *
 * WHY THIS EXISTS
 * ---------------
 * A share link is unreadable out loud. "countlink.app slash hash tee equals
 * one seven eight eight six three four…" is not something a teacher says to a
 * room, a facilitator says to a workshop, or a streamer says on camera — so in
 * exactly the situations this site is built for, the link has to be typed into
 * a chat or scanned from a QR code, and if neither is available the timer
 * simply doesn't get shared. ShareMyTimer solved this with a join code and it
 * is the one feature of theirs CountLink genuinely lacked.
 *
 * WHY IT NEEDS NO DATABASE
 * ------------------------
 * The code is not a key into a table of timers — it IS the deadline, written
 * in a base whose alphabet a person can say aloud. So there is nothing to
 * store, nothing to expire, nothing to run out of, and nothing that can go
 * down: the same property that makes the #t= link work makes the join code
 * work, and for the same reason. All this endpoint does is change the spelling
 * back and redirect to the ordinary link.
 *
 * SHAPE
 * -----
 * Self-contained with no imports, matching functions/mcp.js — Pages routes
 * this file to /j/:code, and keeping the codec in the shipped module means the
 * unit tests exercise the exact code that runs. `decodeJoinCode` is a second
 * implementation of the one in assets/app.js, which is deliberate and is
 * cross-checked against it over a shared corpus in test/join-code.test.mjs —
 * the same discipline the duration grammar uses. If you change one, that test
 * fails until you change the other.
 */

const JOIN_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford: no I, L, O, U
const JOIN_EPOCH_MS = Date.UTC(2026, 0, 1);
const JOIN_MAX_CHARS = 7;

/**
 * Code → deadline in epoch milliseconds, or null if the string isn't a code.
 *
 * Deliberately forgiving about the ways a code gets garbled between one
 * person's mouth and another person's keyboard: case, spaces, hyphens, and
 * the I/L/O confusions Crockford's alphabet exists to make harmless. Anything
 * else — a U, punctuation, an over-long string — is rejected outright rather
 * than coerced, because silently decoding junk into a plausible instant would
 * send someone to a countdown that is not the one they were told about.
 */
export function decodeJoinCode(code) {
  const raw = String(code == null ? "" : code)
    .trim()
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (!raw || raw.length > JOIN_MAX_CHARS) return null;
  let v = 0;
  for (const ch of raw) {
    const i = JOIN_ALPHABET.indexOf(ch);
    if (i < 0) return null;
    v = v * 32 + i;
  }
  return JOIN_EPOCH_MS + v * 1000;
}

/** Deadline (epoch ms) → code, or "" when it can't be expressed as one. */
export function encodeJoinCode(endMs) {
  const n = Number(endMs);
  if (!Number.isFinite(n)) return "";
  const secs = Math.round((n - JOIN_EPOCH_MS) / 1000);
  if (secs < 0 || secs >= Math.pow(32, JOIN_MAX_CHARS)) return "";
  let s = "", v = secs;
  do { s = JOIN_ALPHABET[v % 32] + s; v = Math.floor(v / 32); } while (v > 0);
  return s;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = decodeURIComponent(url.pathname.replace(/^\/j\//, "").replace(/\/$/, ""));
  const end = decodeJoinCode(code);

  if (end === null) {
    /* A mistyped code is a wrong URL, not a broken timer, so it gets the
       site's real 404 page — with a 404 status, so it is never indexed and
       never mistaken for a working link. env.ASSETS is the static-asset
       binding Pages provides; the fallback keeps this from throwing if the
       function is ever exercised outside that runtime (the tests). */
    if (env && env.ASSETS) {
      const res = await env.ASSETS.fetch(new URL("/404.html", url));
      return new Response(res.body, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  /* 302, not 301: the target carries an absolute instant, so a permanently
     cached redirect would be fine for this code but the browser would also
     keep it for a code that hasn't been minted yet. Cheap to re-resolve, and
     no-store keeps an intermediary from holding one either. A fragment on a
     Location header survives the redirect in every browser — it is the
     mechanism the rest of the site's links already rely on. */
  return new Response(null, {
    status: 302,
    headers: { Location: `/#t=${end}`, "Cache-Control": "no-store" },
  });
}
