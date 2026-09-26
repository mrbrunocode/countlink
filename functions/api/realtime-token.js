/**
 * Phone-control auth — Cloudflare Pages Function, served at /api/realtime-token.
 *
 * WHY THIS EXISTS
 * ---------------
 * Phone control used to sign every connection with one Ably key shipped in
 * public page source, and the channel id rode along in the ordinary share
 * link. Anyone holding the link could therefore publish commands — pause,
 * stop, or flash a message onto a projector — which broke the site's
 * "sealed when live" promise for every phone-controlled countdown.
 *
 * Now the Ably key lives only here (Pages secret ABLY_API_KEY), and this
 * endpoint hands out short-lived, single-channel tokens:
 *
 *   {"sid": "<16 chars>"}  -> may SUBSCRIBE to countlink:<sid>   (a viewer)
 *   {"key": "<22 chars>"}  -> may PUBLISH and SUBSCRIBE to
 *                             countlink:<sha256-derived sid>      (host/controller)
 *
 * The sid is derived from the key by the same function as assets/realtime.js
 * (cross-checked in test/realtime.test.mjs), so holding the share link —
 * which only ever carries the sid — gets you a read-only token and nothing
 * more. There is still nothing stored anywhere: the key is its own proof.
 *
 * WHAT IT RETURNS
 * ---------------
 * A signed Ably TokenRequest (https://ably.com/docs/api/token-request-spec),
 * which the browser's Ably client exchanges with Ably directly. Signing is a
 * local HMAC, so this function makes no outbound request and can't be slowed
 * by Ably being slow. Self-contained with no imports, like the other
 * functions here, so the tests execute the exact bytes that deploy.
 */

const SID_DOMAIN = "countlink-control-v1:";
const KEY_RE = /^[A-Za-z0-9_-]{22}$/;
const SID_RE = /^[A-Za-z0-9_-]{16}$/;
const TOKEN_TTL_MS = 60 * 60 * 1000; // the client re-requests on expiry by itself

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64 = (bytes) => btoa(String.fromCharCode(...bytes));

export async function deriveSid(key) {
  if (!KEY_RE.test(String(key == null ? "" : key))) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SID_DOMAIN + key));
  return b64url(new Uint8Array(digest).subarray(0, 12));
}

/* Canonical capability JSON: channels and operations sorted, no whitespace —
   the form the MAC is computed over (spec: "canonicalized representation"). */
export function capabilityFor(sid, canPublish) {
  const ops = canPublish ? ["publish", "subscribe"] : ["subscribe"];
  return JSON.stringify({ ["countlink:" + sid]: ops });
}

/* Signs a TokenRequest per the Ably spec: keyName, ttl, capability, clientId,
   timestamp, nonce — each followed by "\n", including the empty clientId —
   HMAC-SHA-256 with the key secret, base64. `now` and `nonce` are injectable
   so the tests can pin the exact MAC. */
export async function signTokenRequest(apiKey, capability, { now = Date.now(), nonce, ttl = TOKEN_TTL_MS } = {}) {
  const sep = String(apiKey).indexOf(":");
  if (sep < 1) throw new Error("ABLY_API_KEY is not in keyName:secret form");
  const keyName = apiKey.slice(0, sep);
  const secret = apiKey.slice(sep + 1);
  const n = nonce || b64url(crypto.getRandomValues(new Uint8Array(16)));
  const timestamp = Math.floor(now);
  const signText = [keyName, String(ttl), capability, "", String(timestamp), n].map((f) => f + "\n").join("");
  const hmacKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = b64(new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(signText))));
  return { keyName, ttl, capability, timestamp, nonce: n, mac };
}

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
  }
  const apiKey = env && env.ABLY_API_KEY;
  if (!apiKey) return json({ error: "phone control is not configured" }, 503);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: "expected a JSON body" }, 400); }
  if (!body || typeof body !== "object") return json({ error: "expected a JSON body" }, 400);

  let sid, canPublish;
  if (body.key != null) {
    sid = await deriveSid(body.key);
    if (!sid) return json({ error: "malformed control key" }, 400);
    canPublish = true;
  } else if (body.sid != null) {
    if (!SID_RE.test(String(body.sid))) return json({ error: "malformed session id" }, 400);
    sid = String(body.sid);
    canPublish = false;
  } else {
    return json({ error: "send {sid} to watch or {key} to control" }, 400);
  }

  try {
    return json(await signTokenRequest(apiKey, capabilityFor(sid, canPublish)), 200);
  } catch (e) {
    return json({ error: "phone control is misconfigured" }, 500);
  }
}
