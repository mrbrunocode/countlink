/**
 * /api/now — the current time, for assets/clock.js.
 *
 * The one thing a countdown shared as a timestamp can't know on its own is
 * whether the device reading it has the right time. This answers "what time
 * is it?" and nothing else: no timer, no id, no state, nothing about the
 * caller. See assets/clock.js for how the answer is used.
 *
 * Never cached — a cached "now" is a wrong "now". Cloudflare's edge clocks
 * are NTP-disciplined, which is the whole value of asking.
 */
export function onRequest(context) {
  const { request } = context;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
  }
  return new Response(JSON.stringify({ now: Date.now() }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
