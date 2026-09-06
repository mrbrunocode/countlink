// Join codes: the spoken form of a share link.
//
// Why this file exists: /j/<code> is the first URL shape on this site whose
// whole value is that a human can say it out loud and another human can type
// what they heard. That makes the interesting cases the MISHEARINGS, not the
// happy path — "oh" for zero, "ell" for one, a hyphen someone added because
// it looked like a product key — and every one of those has to land on the
// same countdown or the feature is worse than not having it, because the
// person is now confidently watching the wrong timer.
//
// The second job here is pinning the two implementations together.
// assets/app.js (browser, mints the code) and functions/j/[code].js (edge,
// resolves it) each carry their own copy of the codec, deliberately — the
// same "second implementation + cross-check corpus" discipline the duration
// grammar uses, and for the same reason: a shared module would need a build
// step this repo does not have. The cross-check below is what makes the
// duplication safe. If you change one side, it fails until you change both.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDuration } from "./helpers/load-app.mjs";
import { encodeJoinCode as edgeEncode, decodeJoinCode as edgeDecode, onRequest } from "../functions/j/[code].js";

const { encodeJoinCode, decodeJoinCode } = loadDuration();

const EPOCH = Date.UTC(2026, 0, 1);

/* ---------------- the round trip ---------------- */

test("a code round-trips back to the same second", () => {
  for (const end of [EPOCH, EPOCH + 1000, EPOCH + 86_400_000, Date.UTC(2026, 8, 6, 14, 30)]) {
    assert.equal(decodeJoinCode(encodeJoinCode(end)), end, String(end));
  }
});

test("sub-second precision is rounded, not silently truncated", () => {
  // Documented trade: a code carries seconds, so two people holding the same
  // code agree exactly and can be up to half a second from someone holding
  // the #t= link. Rounding (not flooring) keeps that error symmetric.
  assert.equal(decodeJoinCode(encodeJoinCode(EPOCH + 1600)), EPOCH + 2000);
  assert.equal(decodeJoinCode(encodeJoinCode(EPOCH + 1400)), EPOCH + 1000);
});

test("codes stay short enough to say out loud", () => {
  // Five characters through 2027, six well past any timer anyone will set.
  // If this ever fails, the epoch or the alphabet changed and the feature's
  // whole premise — a code you can read to a room — needs re-checking.
  assert.equal(encodeJoinCode(Date.UTC(2026, 8, 6)).length, 5);
  assert.ok(encodeJoinCode(Date.UTC(2030, 0, 1)).length <= 6);
});

/* ---------------- the mishearings ---------------- */

test("the alphabet contains none of the characters people confuse aloud", () => {
  // Crockford's point: I/1, L/1 and O/0 are indistinguishable spoken and
  // near-indistinguishable in most fonts, so they are simply not minted.
  const alphabet = new Set();
  for (let i = 0; i < 40_000; i++) for (const ch of encodeJoinCode(EPOCH + i * 997_000)) alphabet.add(ch);
  for (const banned of ["I", "L", "O", "U"]) {
    assert.ok(!alphabet.has(banned), `${banned} should never appear in a minted code`);
  }
});

test("a misheard code still resolves to the right countdown", () => {
  const end = Date.UTC(2026, 8, 6, 14, 30);
  const code = encodeJoinCode(end); // e.g. "MEXQC"
  const variants = [
    code.toLowerCase(),                                    // typed in lower case
    code.slice(0, 2) + "-" + code.slice(2),                // hyphenated like a product key
    " " + code + " ",                                      // pasted with whitespace
  ];
  for (const v of variants) assert.equal(decodeJoinCode(v), end, v);
});

test("letter-for-digit confusions fold back to the digit", () => {
  // A code containing 1 or 0 heard as "one"/"oh" and typed as a letter.
  const withDigits = decodeJoinCode("10101");
  assert.equal(decodeJoinCode("IOIOI"), withDigits, "I and O fold to 1 and 0");
  assert.equal(decodeJoinCode("LOLOL"), withDigits, "L folds to 1");
});

/* ---------------- what is not a code ---------------- */

test("junk is rejected rather than decoded into a plausible instant", () => {
  // The dangerous failure here is not an error — it is silently sending
  // someone to a real countdown that is not the one they were told about.
  for (const bad of ["", "   ", "!!!", "K3M7Q!", "U", "ZZZZZZZZ", "../secrets", "12345678901"]) {
    assert.equal(decodeJoinCode(bad), null, JSON.stringify(bad));
  }
});

test("a deadline that cannot be a code returns empty, not a wrong code", () => {
  for (const bad of [NaN, Infinity, "nope", EPOCH - 1000, Date.UTC(9999, 0, 1)]) {
    assert.equal(encodeJoinCode(bad), "", String(bad));
  }
});

/* ---------------- the two implementations agree ---------------- */

test("assets/app.js and functions/j/[code].js are the same codec", () => {
  // Deterministic corpus rather than random sampling, so a failure is
  // reproducible and names the instant that broke.
  const corpus = [
    EPOCH, EPOCH + 1, EPOCH + 999, EPOCH + 1000, EPOCH + 31_999,
    Date.UTC(2026, 8, 6, 14, 30), Date.UTC(2027, 0, 20), Date.UTC(2030, 5, 15),
  ];
  for (const end of corpus) {
    assert.equal(encodeJoinCode(end), edgeEncode(end), `encode ${end}`);
    assert.equal(decodeJoinCode(encodeJoinCode(end)), edgeDecode(edgeEncode(end)), `decode ${end}`);
  }
  for (const bad of ["", "U", "!!!", "ZZZZZZZZ"]) {
    assert.equal(decodeJoinCode(bad), edgeDecode(bad), `reject ${JSON.stringify(bad)}`);
  }
});

/* ---------------- the endpoint ---------------- */

const get = (path) => onRequest({ request: new Request("https://countlink.app" + path), env: {} });

test("/j/<code> redirects to the ordinary share link", async () => {
  const end = Date.UTC(2026, 8, 6, 14, 30);
  const res = await get("/j/" + encodeJoinCode(end));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("Location"), `/#t=${end}`);
  // A join code resolves to an absolute instant, so nothing downstream should
  // hold the mapping — the code is cheap to re-resolve and caching it would
  // outlive the countdown it points at.
  assert.match(res.headers.get("Cache-Control"), /no-store/);
});

test("/j/<code> accepts the same garbled input the browser does", async () => {
  const end = Date.UTC(2026, 8, 6, 14, 30);
  const code = encodeJoinCode(end);
  for (const v of [code.toLowerCase(), code.slice(0, 2) + "-" + code.slice(2), code + "/"]) {
    const res = await get("/j/" + encodeURIComponent(v).replace(/%2F/gi, "/"));
    assert.equal(res.headers.get("Location"), `/#t=${end}`, v);
  }
});

test("a mistyped code is a 404, never a redirect to some other timer", async () => {
  for (const bad of ["/j/", "/j/!!!", "/j/UUUU", "/j/ZZZZZZZZ"]) {
    const res = await get(bad);
    assert.equal(res.status, 404, bad);
    assert.equal(res.headers.get("Location"), null, bad);
  }
});
