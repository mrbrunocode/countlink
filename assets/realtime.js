/* Phone-control pub/sub — thin wrapper around Ably's client SDK.
   See realtime-config.js for the on/off switch and docs/phone-control-setup.md
   for the design. The Ably script itself is fetched lazily, only the first
   time something here actually needs a connection (a board with a session id
   in its link, or the control page) — a plain shared link with no phone
   control never touches the network through this file at all.

   ROLES, AND WHY THERE ARE TWO (2026-09-26)
   -----------------------------------------
   The first version put one id in every link and signed every connection
   with the same public Ably key, so anyone holding the ordinary share link
   could open /control.html with it and pause, stop, or flash a message onto
   the room's screen. "Settable when idle, sealed when live" held for the
   board's own buttons and nothing else.

   Now a controlled countdown has two values:

     key — 16 random bytes, known only to the tab that pressed Start (kept in
           localStorage, never put in the address bar) and to the control
           link. It is the permission to control.
     sid — derived from the key by SHA-256 and truncated. It is the channel
           name, it IS in the share link, and it cannot be turned back into
           the key.

   Connections authenticate through /api/realtime-token (functions/api/
   realtime-token.js), which holds the only Ably key. Present a sid and you
   get a token that can SUBSCRIBE to that one channel; present a key and the
   server derives the sid itself and grants PUBLISH on it as well. So a viewer
   still sees every pause and adjustment live, and has no way to cause one.

   Channel protocol, on channel "countlink:<sid>":
     - "command": controller -> boards. {type:"pause"|"resume"|"stop"},
       {type:"adjust", deltaMs} or {type:"flash", text}.
     - "state": host board (or, as a fallback, the controller) -> everyone.
       {end, label, state, pausedRemaining}. Every board applies commands it
       receives; only key-holders ever publish. See app.js
       applyRemoteCommand() and control.js.

   The hashing below is a plain synchronous SHA-256 rather than
   crypto.subtle, which is async and missing outside secure contexts (a
   projector opened over http://192.168.x.x). start() has to put the sid in
   the link synchronously. The server derives the same value with
   crypto.subtle; test/realtime.test.mjs cross-checks the two against
   node:crypto so they can never disagree. */
(function () {

  /* ---------- pure helpers (exported to the Node tests below) ---------- */

  const SID_DOMAIN = "countlink-control-v1:";
  const KEY_RE = /^[A-Za-z0-9_-]{22}$/; // 16 bytes, base64url, no padding
  const SID_RE = /^[A-Za-z0-9_-]{16}$/; // first 12 bytes of the digest, base64url

  function utf8Bytes(str) { return new TextEncoder().encode(String(str)); }

  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  /* SHA-256 over a byte array, returning the 32-byte digest. FIPS 180-4,
     straight from the spec; only ever fed a few dozen bytes. */
  function sha256(bytes) {
    const len = bytes.length;
    const bitLenHi = Math.floor(len / 0x20000000), bitLenLo = (len << 3) >>> 0;
    const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    padded.set(bytes);
    padded[len] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, bitLenHi);
    dv.setUint32(padded.length - 4, bitLenLo);
    const H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const W = new Uint32Array(64);
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
        const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i]);
    return out;
  }

  function base64url(bytes) {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let out = "", i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += A[n >> 18] + A[(n >> 12) & 63] + A[(n >> 6) & 63] + A[n & 63];
    }
    if (i < bytes.length) {
      const n = (bytes[i] << 16) | ((i + 1 < bytes.length ? bytes[i + 1] : 0) << 8);
      out += A[n >> 18] + A[(n >> 12) & 63];
      if (i + 1 < bytes.length) out += A[(n >> 6) & 63];
    }
    return out;
  }

  /* key -> sid. Returns "" for anything that isn't a well-formed key, so a
     garbled control link can never derive some other session's channel. */
  function deriveSid(key) {
    if (!KEY_RE.test(String(key == null ? "" : key))) return "";
    return base64url(sha256(utf8Bytes(SID_DOMAIN + key)).subarray(0, 12));
  }

  function isSid(s) { return SID_RE.test(String(s == null ? "" : s)); }
  function isKey(k) { return KEY_RE.test(String(k == null ? "" : k)); }

  /* randomBytes is injectable so the tests are deterministic; the browser
     path uses crypto.getRandomValues, which (unlike crypto.subtle) exists in
     insecure contexts too. */
  function newKey(randomBytes) {
    const b = new Uint8Array(16);
    (randomBytes || ((arr) => crypto.getRandomValues(arr)))(b);
    return base64url(b);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { sha256, base64url, utf8Bytes, deriveSid, isSid, isKey, newKey, SID_DOMAIN };
    return;
  }

  /* ---------- browser wiring ---------- */

  const ENABLED = !!window.COUNTLINK_PHONE_CONTROL;
  const CDN_URL = "https://cdn.ably.com/lib/ably.min-2.js";
  const TOKEN_URL = "/api/realtime-token";
  /* Where a host tab remembers the keys it minted, so a reload of its own
     board (whose address bar only ever shows the sid) is still the host.
     Pruned after two days: nothing a phone can control runs that long in a
     room, and an unbounded list would grow forever. */
  const KEYS_STORE = "countlink_control_keys";
  const KEY_TTL_MS = 2 * 86400e3;

  function readKeys() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS_STORE) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (e) { return {}; }
  }
  function writeKeys(map) {
    try { localStorage.setItem(KEYS_STORE, JSON.stringify(map)); } catch (e) { /* private mode: host role lasts this page only */ }
  }
  const memoryKeys = {}; // survives a blocked localStorage for this page's lifetime

  function rememberKey(sid, key) {
    memoryKeys[sid] = key;
    const now = Date.now();
    const map = readKeys();
    for (const s of Object.keys(map)) {
      if (!map[s] || !(now - map[s].at < KEY_TTL_MS)) delete map[s];
    }
    map[sid] = { k: key, at: now };
    writeKeys(map);
  }

  function hostKeyFor(sid) {
    if (!isSid(sid)) return null;
    const hit = memoryKeys[sid] || (readKeys()[sid] && readKeys()[sid].k);
    // Re-derive rather than trust storage: a key that doesn't hash to this
    // sid is not this session's key, however it got there.
    return hit && deriveSid(hit) === sid ? hit : null;
  }

  let ablyPromise = null;
  function loadAblyScript() {
    if (ablyPromise) return ablyPromise;
    ablyPromise = new Promise((resolve, reject) => {
      if (window.Ably) { resolve(window.Ably); return; }
      const s = document.createElement("script");
      s.src = CDN_URL;
      s.onload = () => resolve(window.Ably);
      s.onerror = () => { ablyPromise = null; reject(new Error("Ably script failed to load")); };
      document.head.appendChild(s);
    });
    return ablyPromise;
  }

  /* One connection per credential. A page moves between sessions (stop, then
     start another controlled countdown), and a token is scoped to exactly one
     channel, so a new session means a new connection — the old one is closed
     rather than left holding a token for a channel nobody is using. */
  let current = null; // { id, promise }
  function credId(cred) { return cred.key ? "k:" + cred.key : "s:" + cred.sid; }

  function clientFor(cred) {
    const id = credId(cred);
    if (current && current.id === id) return current.promise;
    if (current) {
      const old = current.promise;
      old.then((rt) => { try { rt.close(); } catch (e) { /* already gone */ } }).catch(() => {});
    }
    const body = JSON.stringify(cred.key ? { key: cred.key } : { sid: cred.sid });
    const promise = loadAblyScript().then((Ably) => new Ably.Realtime({
      authCallback: (params, cb) => {
        fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body, cache: "no-store" })
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("token endpoint returned " + r.status))))
          .then((tokenRequest) => cb(null, tokenRequest), (err) => cb(String((err && err.message) || err), null));
      },
      // Every board applies the commands it receives and a host rebroadcasts
      // the result, so without this a tab would re-receive its own messages.
      echoMessages: false,
    }));
    current = { id, promise };
    promise.catch(() => { if (current && current.id === id) current = null; });
    return promise;
  }

  /* A normalised credential for a session, or null if there's nothing valid
     to connect with. Accepts a key (host/controller) or a sid (viewer). */
  function credFor(sid, key) {
    if (isKey(key) && deriveSid(key) === sid) return { sid, key };
    if (isSid(sid)) return { sid };
    return null;
  }

  function channelFor(sid) { return "countlink:" + sid; }

  function subscribe(cred, event, onData) {
    if (!ENABLED || !cred) return () => {};
    let closed = false, ch = null;
    const handler = (msg) => { if (!closed) onData(msg.data); };
    clientFor(cred).then((rt) => {
      if (closed) return;
      ch = rt.channels.get(channelFor(cred.sid));
      ch.subscribe(event, handler);
    }).catch(() => {});
    // Unsubscribe by (event, listener): "state" and "command" share one
    // channel object, and a bare unsubscribe() would detach both.
    return () => { closed = true; if (ch) ch.unsubscribe(event, handler); };
  }

  function publish(cred, event, data) {
    // A viewer's token can't publish, so it doesn't try — a rejected publish
    // is a wasted round trip and a console error on every heartbeat.
    if (!ENABLED || !cred || !cred.key) return;
    clientFor(cred).then((rt) => rt.channels.get(channelFor(cred.sid)).publish(event, data)).catch(() => {});
  }

  // Every method fails silently (network hiccup, ad-blocker, Ably outage):
  // phone control is an enhancement on top of the link-is-the-timer
  // mechanic, never something whose failure can break the countdown itself.
  window.CountlinkRealtime = {
    enabled: ENABLED,
    deriveSid,
    isSid,
    isKey,
    credFor,
    hostKeyFor,
    /* A fresh session for a countdown this tab is starting. */
    newSession() {
      const key = newKey();
      const sid = deriveSid(key);
      rememberKey(sid, key);
      return { sid, key };
    },
    subscribeState(cred, onState) { return subscribe(cred, "state", onState); },
    publishState(cred, state) { publish(cred, "state", state); },
    subscribeCommands(cred, onCommand) { return subscribe(cred, "command", onCommand); },
    publishCommand(cred, cmd) { publish(cred, "command", cmd); },
  };
})();
