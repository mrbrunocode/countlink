// Phone-control permissions: who may watch a controlled countdown and who may
// drive it.
//
// Until 2026-09-26 the share link carried the one id phone control used and
// every connection was signed with the same public Ably key, so anyone who
// had been sent the link could open /control.html with it and pause, stop or
// flash a message onto the room's projector. The fix splits the id in two:
// a secret KEY that grants control, and a SID derived from it that names the
// channel. These tests pin the three things that fix rests on:
//
//   1. the browser (assets/realtime.js, a hand-written synchronous SHA-256)
//      and the server (functions/api/realtime-token.js, crypto.subtle) derive
//      the same sid from a key — if they ever disagree, every host's token is
//      for a channel nobody else is on;
//   2. the endpoint grants publish ONLY to a key, and only on the channel the
//      key derives to — a sid, however well-formed, gets subscribe;
//   3. the TokenRequest is signed exactly as Ably's spec says (verified here
//      against an independent HMAC; it was also verified against Ably's live
//      REST API when written — a tampered capability is rejected with 40101).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, createHmac, randomBytes, randomFillSync } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadRealtime() {
  const src = readFileSync(join(ROOT, "assets", "realtime.js"), "utf8");
  const mod = { exports: {} };
  new Function("module", "exports", src)(mod, mod.exports);
  return mod.exports;
}
const R = loadRealtime();
const fnSrc = readFileSync(join(ROOT, "functions", "api", "realtime-token.js"), "utf8");
const server = await import("data:text/javascript," + encodeURIComponent(fnSrc));

const TEST_API_KEY = "appId.keyId:c2VjcmV0LXRoYXQtaXMtbm90LXJlYWw";
const call = (body, { method = "POST", env = { ABLY_API_KEY: TEST_API_KEY } } = {}) =>
  server.onRequest({
    request: new Request("https://countlink.app/api/realtime-token", {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    }),
    env,
  });

// ── 1. the browser's hashing is real SHA-256 ─────────────────────────────

test("realtime.js's SHA-256 matches node:crypto across block boundaries", () => {
  for (const len of [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000]) {
    const bytes = randomBytes(len);
    assert.equal(
      Buffer.from(R.sha256(bytes)).toString("hex"),
      createHash("sha256").update(bytes).digest("hex"),
      `length ${len}`,
    );
  }
});

test("realtime.js's base64url matches node's, with no padding", () => {
  for (let len = 0; len < 40; len++) {
    const bytes = randomBytes(len);
    assert.equal(R.base64url(bytes), bytes.toString("base64url"));
  }
});

test("a new key is 16 random bytes in base64url, and the sid derived from it has the expected shape", () => {
  const key = R.newKey((arr) => randomFillSync(arr));
  assert.ok(R.isKey(key), key);
  const sid = R.deriveSid(key);
  assert.ok(R.isSid(sid), sid);
  assert.notEqual(sid, key.slice(0, 16), "the sid must not be a prefix of the key");
  assert.notEqual(R.newKey((a) => randomFillSync(a)), key);
});

test("the browser and the server derive the same sid from the same key", async () => {
  for (let i = 0; i < 25; i++) {
    const key = R.newKey((arr) => randomFillSync(arr));
    assert.equal(R.deriveSid(key), await server.deriveSid(key), key);
  }
});

test("deriveSid refuses anything that isn't a well-formed key, on both sides", async () => {
  for (const bad of ["", null, undefined, "short", "x".repeat(23), "has spaces in it at all!", "AAAAAAAAAAAAAAAAAAAA+/"]) {
    assert.equal(R.deriveSid(bad), "", String(bad));
    assert.equal(await server.deriveSid(bad), "", String(bad));
  }
});

// ── 2. who gets which permission ─────────────────────────────────────────

test("a sid gets a subscribe-only token for exactly its own channel", async () => {
  const res = await call({ sid: "AbCdEfGhIjKlMnOp" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const tr = await res.json();
  assert.deepEqual(JSON.parse(tr.capability), { "countlink:AbCdEfGhIjKlMnOp": ["subscribe"] });
});

test("a key gets publish + subscribe, on the channel the KEY derives to — not one the caller names", async () => {
  const key = R.newKey((arr) => randomFillSync(arr));
  const res = await call({ key, sid: "SomeoneElsesSid0" });
  assert.equal(res.status, 200);
  const tr = await res.json();
  assert.deepEqual(JSON.parse(tr.capability), { ["countlink:" + R.deriveSid(key)]: ["publish", "subscribe"] });
});

test("malformed input is refused rather than coerced into some channel", async () => {
  for (const body of [{}, { sid: "short" }, { sid: "countlink:*wildcard" }, { key: "nope" }, { sid: 42 }, "not json", "null"]) {
    const res = await call(body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test("only POST is accepted", async () => {
  assert.equal((await call(null, { method: "GET" })).status, 405);
});

test("with no ABLY_API_KEY configured the endpoint says so (503) rather than minting anything", async () => {
  assert.equal((await call({ sid: "AbCdEfGhIjKlMnOp" }, { env: {} })).status, 503);
});

test("a key that isn't keyName:secret is a server fault (500), and the response doesn't echo it", async () => {
  const res = await call({ sid: "AbCdEfGhIjKlMnOp" }, { env: { ABLY_API_KEY: "no-colon-here" } });
  assert.equal(res.status, 500);
  assert.doesNotMatch(await res.text(), /no-colon-here/);
});

// ── 3. the signature ──────────────────────────────────────────────────────

test("the TokenRequest MAC is HMAC-SHA-256 over the spec's newline-terminated fields", async () => {
  const cap = server.capabilityFor("AbCdEfGhIjKlMnOp", true);
  const tr = await server.signTokenRequest(TEST_API_KEY, cap, { now: 1790000000000, nonce: "fixed-nonce" });
  const [keyName, secret] = TEST_API_KEY.split(":");
  const expected = createHmac("sha256", secret)
    .update(`${keyName}\n3600000\n${cap}\n\n1790000000000\nfixed-nonce\n`)
    .digest("base64");
  assert.deepEqual(tr, { keyName, ttl: 3600000, capability: cap, timestamp: 1790000000000, nonce: "fixed-nonce", mac: expected });
});

test("the capability JSON is canonical: operations sorted, no whitespace", () => {
  assert.equal(server.capabilityFor("AbCdEfGhIjKlMnOp", true), '{"countlink:AbCdEfGhIjKlMnOp":["publish","subscribe"]}');
  assert.equal(server.capabilityFor("AbCdEfGhIjKlMnOp", false), '{"countlink:AbCdEfGhIjKlMnOp":["subscribe"]}');
});

test("the response never contains the API key's secret", async () => {
  const res = await call({ key: R.newKey((a) => randomFillSync(a)) });
  const text = await res.text();
  assert.doesNotMatch(text, new RegExp(TEST_API_KEY.split(":")[1]));
});

// ── the key never ships in page source again ─────────────────────────────

test("no asset or page contains an Ably API key (keyName.keyId:secret)", () => {
  const files = ["assets/realtime-config.js", "assets/realtime.js", "assets/app.js", "assets/control.js", "index.html", "control.html", "embed/index.html"];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), "utf8");
    assert.doesNotMatch(src, /["'][A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}:[A-Za-z0-9_-]{20,}["']/, `${f} looks like it carries an Ably key`);
  }
});
