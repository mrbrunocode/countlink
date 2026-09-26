/* CountLink clock correction — "now", as agreed by every screen.

   WHY THIS EXISTS
   ---------------
   A shared link carries one absolute instant, and every device counts down
   to it with its own clock. That is the whole trick, and its one weak spot:
   a device whose clock is wrong shows the wrong time left. Phones sync their
   clocks constantly, but the machines this site is most often projected
   from — classroom PCs, venue laptops, a streaming rig that has been up for
   months — are exactly the ones that drift, sometimes by minutes. The FAQ
   used to have to say "accuracy depends on each device's own clock".

   So each page asks /api/now (functions/api/now.js) what time it is, the way
   NTP does: note the local time before and after the request, assume the
   answer was produced halfway between, and the difference is this device's
   error. The countdown then runs on corrected time. There is still no timer
   on any server — /api/now knows nothing about any countdown — so a link
   keeps working with the network gone; it just falls back to the device's
   own clock, exactly as it always did.

   Only corrected when the measured error is clearly bigger than the
   measurement's own uncertainty (half the round trip, plus a margin). A
   well-synced device, which is most of them, is left entirely alone rather
   than nudged by network jitter.

   Loaded before app.js and control.js; both read CountlinkClock.now(). */
(function () {

  const APPLY_MARGIN_MS = 250;     // below uncertainty + this, the error is noise
  const MAX_USABLE_RTT_MS = 3000;  // a slower round trip can't place "now" usefully

  /* samples: [{t0, server, t1}] — local ms before the request, the server's
     ms, local ms after. Uses the fastest round trip, which has the smallest
     window for the answer to have been produced in. Returns null when no
     sample is usable. */
  function estimateOffset(samples) {
    let best = null;
    for (const s of samples || []) {
      if (!s || !Number.isFinite(s.t0) || !Number.isFinite(s.t1) || !Number.isFinite(s.server)) continue;
      const rtt = s.t1 - s.t0;
      if (rtt < 0 || rtt > MAX_USABLE_RTT_MS) continue;
      if (!best || rtt < best.rtt) best = { rtt, offset: s.server - (s.t0 + s.t1) / 2 };
    }
    if (!best) return null;
    return { offset: Math.round(best.offset), uncertainty: Math.ceil(best.rtt / 2), rtt: best.rtt };
  }

  /* The correction to actually apply: the estimate, or 0 when it's within
     the noise. */
  function appliedOffset(est) {
    if (!est) return 0;
    return Math.abs(est.offset) > est.uncertainty + APPLY_MARGIN_MS ? est.offset : 0;
  }

  /* "2 min 14 s fast" — how far off this device is, for the one-line note the
     board shows when the correction is big enough to be worth mentioning. A
     positive offset means the server is AHEAD, i.e. the device is slow. */
  function describeOffset(offsetMs) {
    const abs = Math.round(Math.abs(offsetMs) / 1000);
    if (abs < 1) return "";
    const h = Math.floor(abs / 3600), m = Math.floor((abs % 3600) / 60), s = abs % 60;
    const parts = [];
    if (h) parts.push(h + " h");
    if (m) parts.push(m + " min");
    if (s && !h) parts.push(s + " s");
    return parts.join(" ") + (offsetMs > 0 ? " slow" : " fast");
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { estimateOffset, appliedOffset, describeOffset, APPLY_MARGIN_MS, MAX_USABLE_RTT_MS };
    return;
  }

  /* ---------- browser wiring ---------- */

  const ENDPOINT = "/api/now";
  const CACHE_KEY = "countlink_clock";
  const CACHE_MS = 10 * 60 * 1000; // a clock doesn't drift measurably in 10 minutes

  let offset = 0;
  const listeners = [];

  function set(o) {
    if (o === offset) return;
    offset = o;
    for (const fn of listeners) { try { fn(offset); } catch (e) { /* one listener can't break the rest */ } }
  }

  // Reuse a recent measurement across page views in this tab: navigating
  // between timer pages shouldn't cost two requests each time.
  let cached = false;
  try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
    if (c && Number.isFinite(c.o) && Date.now() - c.at < CACHE_MS && Date.now() >= c.at) { offset = c.o; cached = true; }
  } catch (e) { /* storage blocked: measure fresh */ }

  function sample() {
    const t0 = Date.now();
    return fetch(ENDPOINT, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("status " + r.status))))
      .then((j) => ({ t0, server: +j.now, t1: Date.now() }));
  }

  function measure() {
    // Two sequential samples: the first also pays for DNS/TLS/connection
    // setup, so the second is usually the tight one. estimateOffset keeps
    // whichever round trip was faster.
    const samples = [];
    return sample().then((s) => { samples.push(s); return sample(); })
      .then((s) => { samples.push(s); }, () => {})
      .then(() => {
        const est = estimateOffset(samples);
        if (!est) return;
        const o = appliedOffset(est);
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ o, at: Date.now() })); } catch (e) { /* fine */ }
        set(o);
      });
  }

  let ready = Promise.resolve();
  if (!cached && typeof fetch === "function") {
    ready = measure().catch(() => { /* offline: the device clock is all there is */ });
  }

  window.CountlinkClock = {
    now() { return Date.now() + offset; },
    offset() { return offset; },
    describe() { return describeOffset(offset); },
    onChange(fn) { if (typeof fn === "function") listeners.push(fn); },
    ready,
  };
})();
