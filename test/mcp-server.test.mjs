// The MCP server (functions/mcp.js), served at /mcp.
//
// This endpoint exists so an AI assistant can hand someone a working CountLink
// link instead of telling them to go and make one. That makes it, in practice,
// a machine-facing API whose only client is a language model — so the failure
// modes worth testing are protocol-shaped (does a real MCP client's handshake
// succeed?) and grammar-shaped (does "25m" mean the same thing here as it does
// on the board?), not visual.
//
// functions/mcp.js is an ES module that ships to Cloudflare Pages as-is. Node
// won't `import` a .js file as ESM without "type":"module" in package.json —
// which this project deliberately doesn't set — so it's loaded through a
// data: URL instead. That runs the exact bytes that deploy, with no shim, no
// build step and no second copy to drift.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDuration } from "./helpers/load-app.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "functions", "mcp.js"), "utf8");
const mcp = await import("data:text/javascript," + encodeURIComponent(src));

const {
  handleRpc, callTool, parseDuration, setupUrl, shareUrl,
  compactDuration, describeUrl, humanDuration, labelOf, TOOLS,
  embedTargetUrl, embedSnippet,
  agendaUrl, agendaRunSheet, normaliseAgendaSegments,
  buildIcs, icsUid, badgeTimeTextPreview,
} = mcp;

const rpc = (method, params, id = 1) => handleRpc({ jsonrpc: "2.0", id, method, params });
const FIXED_NOW = 1757000000000; // any fixed instant; keeps time out of the assertions

/* ======================= protocol ======================= */

test("initialize echoes a protocol version the client asked for", () => {
  // Version negotiation is the one part of the handshake that silently breaks
  // a real client: answer with a version it doesn't speak and it disconnects.
  const r = rpc("initialize", { protocolVersion: "2025-06-18" });
  assert.equal(r.result.protocolVersion, "2025-06-18");
  assert.equal(r.jsonrpc, "2.0");
  assert.equal(r.id, 1);
});

test("initialize falls back to our newest version for one we don't know", () => {
  assert.equal(rpc("initialize", { protocolVersion: "1999-01-01" }).result.protocolVersion, "2025-06-18");
  assert.equal(rpc("initialize", {}).result.protocolVersion, "2025-06-18");
  assert.equal(rpc("initialize").result.protocolVersion, "2025-06-18");
});

test("initialize still supports the older protocol versions it advertises", () => {
  for (const v of ["2025-03-26", "2024-11-05"]) {
    assert.equal(rpc("initialize", { protocolVersion: v }).result.protocolVersion, v, v);
  }
});

test("initialize declares tools and identifies the server", () => {
  const { capabilities, serverInfo, instructions } = rpc("initialize", {}).result;
  assert.ok(capabilities.tools, "must declare the tools capability or no tool is ever listed");
  assert.equal(capabilities.tools.listChanged, false,
    "the tool list is a constant — promising notifications we never send would be a lie");
  assert.equal(serverInfo.name, "countlink");
  assert.ok(serverInfo.version);
  assert.match(instructions, /shared countdown/i);
});

test("notifications get no response at all", () => {
  // notifications/initialized is sent by every client right after the
  // handshake. Answering it (or throwing on it) breaks the session.
  assert.equal(handleRpc({ jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.equal(handleRpc({ jsonrpc: "2.0", method: "notifications/cancelled", params: {} }), null);
});

test("ping answers, because clients use it as a liveness check", () => {
  assert.deepEqual(rpc("ping").result, {});
});

test("unknown methods return -32601 rather than throwing", () => {
  assert.equal(rpc("does/not/exist").error.code, -32601);
});

test("malformed messages return -32600 instead of crashing the worker", () => {
  for (const bad of [null, undefined, "hello", 42, []]) {
    assert.equal(handleRpc(bad).error.code, -32600, JSON.stringify(bad));
  }
});

test("resources/list and prompts/list answer empty instead of erroring", () => {
  // Clients probe for these during discovery; a -32601 here reads as a broken
  // server in some UIs even though tools work fine.
  assert.deepEqual(rpc("resources/list").result, { resources: [] });
  assert.deepEqual(rpc("prompts/list").result, { prompts: [] });
});

/* ======================= tools/list ======================= */

test("every tool is shaped the way the MCP spec requires", () => {
  const tools = rpc("tools/list").result.tools;
  assert.ok(tools.length >= 1);
  for (const t of tools) {
    assert.equal(typeof t.name, "string", "name");
    assert.ok(t.name.length, `${t.name}: non-empty name`);
    assert.ok(t.description && t.description.length > 40,
      `${t.name}: a model picks tools off this description — it has to actually describe`);
    assert.equal(t.inputSchema.type, "object", `${t.name}: inputSchema must be an object schema`);
    assert.ok(t.inputSchema.properties, `${t.name}: properties`);
    for (const req of t.inputSchema.required || []) {
      assert.ok(t.inputSchema.properties[req],
        `${t.name}: requires "${req}" but never declares it — the model cannot supply it`);
    }
    for (const [k, v] of Object.entries(t.inputSchema.properties)) {
      assert.ok(v.description, `${t.name}.${k}: every argument needs a description`);
    }
  }
});

test("tools are annotated read-only, which is the honest answer", () => {
  // CountLink has no backend: creating a timer is string arithmetic over a
  // duration. If a tool ever does gain a side effect, this test should fail
  // and force the annotation to be revisited rather than left stale.
  for (const t of TOOLS) {
    assert.equal(t.annotations.readOnlyHint, true, t.name);
    assert.equal(t.annotations.destructiveHint, false, t.name);
  }
});

/* ======================= create_timer ======================= */

test("create_timer returns a setup link by default", () => {
  // The default must not be a running countdown: a #t= link minted here starts
  // ticking the moment the tool runs, so as a default it would hand people
  // timers that had already been running for however long the reply took.
  const r = rpc("tools/call", { name: "create_timer", arguments: { duration: "25m" } });
  const { url, started, durationSeconds } = r.result.structuredContent;
  assert.equal(url, "https://countlink.app/#for=25m");
  assert.equal(started, false);
  assert.equal(durationSeconds, 1500);
  assert.ok(!r.result.isError);
});

test("create_timer with start_now mints a fixed-instant share link", () => {
  const r = callTool("create_timer", { duration: "10m", start_now: true }, FIXED_NOW);
  assert.equal(r.structuredContent.url, `https://countlink.app/#t=${FIXED_NOW + 600000}`);
  assert.equal(r.structuredContent.started, true);
});

test("a label rides along, on both link shapes", () => {
  assert.equal(
    callTool("create_timer", { duration: "5m", label: "Break" }).structuredContent.url,
    "https://countlink.app/#for=5m&l=Break"
  );
  assert.equal(
    callTool("create_timer", { duration: "5m", label: "Break", start_now: true }, FIXED_NOW)
      .structuredContent.url,
    `https://countlink.app/#t=${FIXED_NOW + 300000}&l=Break`
  );
});

test("labels are encoded so a link with punctuation still parses", () => {
  // "50% done" is the exact shape that used to crash the board on open (see
  // test/setup-link.test.mjs) — a link this server emits must survive it.
  const url = callTool("create_timer", { duration: "5m", label: "50% done" }).structuredContent.url;
  assert.ok(url.includes("50%25%20done"), url);
  assert.equal(describeUrl(url).label, "50% done", "round-trips back out");
});

test("an OBS overlay link points at /embed/ and starts itself", () => {
  const r = callTool("create_timer", { duration: "10m", for_obs_overlay: true });
  assert.equal(r.structuredContent.url, "https://countlink.app/embed/?overlay=1#for=10m&go=1");
  assert.equal(r.structuredContent.overlay, true);
  assert.match(r.content[0].text, /Browser/, "the OBS recipe is the point of this flag");
});

test("an overlay link never points at a page that loads ad code", () => {
  // THE ADSENSE INVARIANT. /?overlay=1 renders the same board, but it gets
  // there by redirecting from a page whose preload scanner has already queued
  // the AdSense and gtag scripts — and Google-served ads on a screen with no
  // publisher content is the exact violation this site was fixed for once
  // already (docs/overlay-ads.md). /embed/ is built with those tags stripped.
  // Handing out the wrong one of these two URLs at AI scale would reintroduce
  // that violation on every stream that used it.
  for (const args of [
    { duration: "10m", for_obs_overlay: true },
    { duration: "1h", for_obs_overlay: true, label: "Starting soon" },
    { duration: "90s", for_obs_overlay: true, start_now: true },
  ]) {
    const url = callTool("create_timer", args).structuredContent.url;
    assert.ok(url.startsWith("https://countlink.app/embed/?overlay=1"), url);
    assert.ok(!url.startsWith(`${'https://countlink.app'}/?overlay=1`), `must not use the redirecting form: ${url}`);
  }
});

test("for_obs_overlay wins over start_now instead of minting a doomed deadline", () => {
  // A #t= in an OBS source expires the first time the scene is reloaded after
  // it runs out; the overlay's own &go=1 restart is the behaviour that works.
  const r = callTool("create_timer", { duration: "10m", for_obs_overlay: true, start_now: true });
  assert.ok(r.structuredContent.url.includes("#for="), r.structuredContent.url);
  assert.equal(r.structuredContent.started, false);
});

test("a plain timer link is never the overlay one", () => {
  for (const args of [{ duration: "10m" }, { duration: "10m", start_now: true }]) {
    const url = callTool("create_timer", args).structuredContent.url;
    assert.ok(!url.includes("/embed/"), url);
    assert.ok(!url.includes("go=1"), `a shared link must never auto-start: ${url}`);
  }
});

test("an over-long label is trimmed rather than rejected", () => {
  const r = callTool("create_timer", { duration: "5m", label: "x".repeat(200) });
  assert.equal(r.structuredContent.label.length, 60);
});

test("an unreadable duration is a tool error the model can recover from", () => {
  // isError, not a JSON-RPC error: a protocol error surfaces to the user as a
  // broken app, where this should read as "I need a duration" and be retried.
  for (const bad of ["", "soon", "abc", "0m", "later today", undefined, null, {}, []]) {
    const r = callTool("create_timer", { duration: bad });
    assert.equal(r.isError, true, JSON.stringify(bad));
    assert.match(r.content[0].text, /duration/i);
  }
});

test("a bare number is accepted as minutes even when sent as a number", () => {
  // The schema says string, but models do send `duration: 5`. "5" already
  // means five minutes in this grammar, so coercing is strictly more useful
  // than erroring — this leniency is deliberate, not an accident.
  assert.equal(callTool("create_timer", { duration: 5 }).structuredContent.durationSeconds, 300);
});

test("create_timer's prose tells the user what to actually do next", () => {
  const setup = callTool("create_timer", { duration: "25m" }).content[0].text;
  assert.match(setup, /press start/i, "a setup link is useless if nobody knows to start it");
  assert.match(setup, /countlink\.app/);
  const started = callTool("create_timer", { duration: "25m", start_now: true }).content[0].text;
  assert.match(started, /share/i);
});

test("unknown tool names are a protocol error", () => {
  assert.equal(rpc("tools/call", { name: "nope", arguments: {} }).error.code, -32602);
});

test("tools/call survives missing or malformed arguments", () => {
  assert.equal(rpc("tools/call", { name: "create_timer" }).result.isError, true);
  assert.equal(callTool("create_timer", null).isError, true);
  assert.equal(callTool("create_timer", "nonsense").isError, true);
});

/* ======================= describe_timer_link ======================= */

test("describe_timer_link reads back both link shapes", () => {
  const setup = describeUrl("https://countlink.app/#for=25m&l=Focus", FIXED_NOW);
  assert.equal(setup.kind, "setup");
  assert.equal(setup.durationSeconds, 1500);
  assert.equal(setup.label, "Focus");

  const share = describeUrl(`https://countlink.app/#t=${FIXED_NOW + 600000}`, FIXED_NOW);
  assert.equal(share.kind, "share");
  assert.equal(share.remainingSeconds, 600);
  assert.equal(share.expired, false);
});

test("a finished countdown reports as expired, not as negative time left", () => {
  const past = describeUrl(`https://countlink.app/#t=${FIXED_NOW - 60000}`, FIXED_NOW);
  assert.equal(past.expired, true);
  assert.equal(past.remainingSeconds, 0, "never negative");
});

test("describe_timer_link rejects things that aren't timer links", () => {
  for (const bad of ["https://countlink.app/", "https://example.com/#t=1", "not a url", "", null]) {
    assert.equal(describeUrl(bad, FIXED_NOW), null, JSON.stringify(bad));
  }
  assert.equal(callTool("describe_timer_link", { url: "https://countlink.app/" }).isError, true);
});

test("what create_timer emits, describe_timer_link can always read back", () => {
  // The two tools are the two directions of one contract; a round-trip failure
  // means a link this server hands out is one it cannot itself explain.
  for (const d of ["25m", "1h30m", "90s", "5:00", "45"]) {
    for (const variant of [{}, { start_now: true }, { for_obs_overlay: true }, { embed_on_website: true }]) {
      const url = callTool("create_timer", { duration: d, label: "T", ...variant }, FIXED_NOW)
        .structuredContent.url;
      const back = describeUrl(url, FIXED_NOW);
      const what = `${d} ${JSON.stringify(variant)}`;
      assert.ok(back, `${what}: ${url}`);
      assert.equal(back.label, "T", what);
      // Both start_now and embed_on_website mint a fixed-instant #t= link —
      // describe_timer_link reports those as remaining time, not a duration.
      const seconds = (variant.start_now || variant.embed_on_website) ? back.remainingSeconds : back.durationSeconds;
      assert.equal(seconds, parseDuration(d), what);
    }
  }
});

/* ======================= embed_on_website ======================= */

test("embed_on_website returns an iframe pointed at the ad-free /embed/ build", () => {
  const r = callTool("create_timer", { duration: "10m", embed_on_website: true }, FIXED_NOW);
  assert.equal(r.structuredContent.embed, true);
  assert.ok(r.structuredContent.url.startsWith("https://countlink.app/embed/?overlay=1#t="), r.structuredContent.url);
  assert.ok(r.structuredContent.iframeHtml.includes(r.structuredContent.url));
});

test("an embed link is a fixed instant, never a setup or auto-starting link", () => {
  // The whole reason this differs from for_obs_overlay: many visitors will
  // load this page, and they must all see the SAME remaining time, not each
  // get their own countdown from whenever they arrived.
  const r = callTool("create_timer", { duration: "10m", embed_on_website: true }, FIXED_NOW);
  assert.ok(r.structuredContent.url.includes("#t="), r.structuredContent.url);
  assert.ok(!r.structuredContent.url.includes("#for="), r.structuredContent.url);
  assert.ok(!r.structuredContent.url.includes("go=1"), "no self-start flag on a fixed-instant link");
});

test("embed_on_website and for_obs_overlay are mutually exclusive", () => {
  const r = callTool("create_timer", { duration: "10m", embed_on_website: true, for_obs_overlay: true });
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /mutually exclusive/i);
});

test("the attribution link sits outside the iframe tag, never inside it", () => {
  // This is the entire point of the feature (see functions/mcp.js's own
  // comment on embedSnippet): a link inside a frame is attributed to the
  // frame's own document, not the host page, and earns nothing back.
  const { iframeHtml: html } = callTool("create_timer", { duration: "10m", embed_on_website: true }).structuredContent;
  const iframeEnd = html.indexOf("</iframe>");
  const linkStart = html.indexOf("<a href=");
  assert.ok(iframeEnd > -1 && linkStart > iframeEnd, html);
  assert.match(html, /<a href="https:\/\/countlink\.app\/">Shared countdown by CountLink<\/a>/);
});

test("embed width/height are honoured within bounds, and clamped outside them", () => {
  const inRange = callTool("create_timer", { duration: "10m", embed_on_website: true, embed_width: 600, embed_height: 300 }).structuredContent;
  assert.equal(inRange.width, 600);
  assert.equal(inRange.height, 300);
  assert.match(inRange.iframeHtml, /width="600" height="300"/);

  const tooSmall = callTool("create_timer", { duration: "10m", embed_on_website: true, embed_width: 1, embed_height: 1 }).structuredContent;
  assert.equal(tooSmall.width, 160, "clamped to the minimum, not left at an unusable size");
  assert.equal(tooSmall.height, 80);

  const tooBig = callTool("create_timer", { duration: "10m", embed_on_website: true, embed_width: 99999, embed_height: 99999 }).structuredContent;
  assert.equal(tooBig.width, 1600);
  assert.equal(tooBig.height, 900);

  const missing = callTool("create_timer", { duration: "10m", embed_on_website: true }).structuredContent;
  assert.equal(missing.width, 400, "the default the client-side embed builder also uses");
  assert.equal(missing.height, 160);
});

test("an invalid embed_style falls back to board rather than erroring", () => {
  const r = callTool("create_timer", { duration: "10m", embed_on_website: true, embed_style: "neon" }).structuredContent;
  assert.equal(r.style, "board");
  assert.ok(!r.url.includes("style="), "board is the default the URL omits, same as the client builder");
});

test("a non-default embed_style is carried onto the /embed/ URL", () => {
  const r = callTool("create_timer", { duration: "10m", embed_on_website: true, embed_style: "minimal" }).structuredContent;
  assert.equal(r.style, "minimal");
  assert.ok(r.url.includes("style=minimal"), r.url);
});

test("a label on an embed is carried onto the link and safely escaped in the iframe title", () => {
  const plain = callTool("create_timer", { duration: "10m", embed_on_website: true, label: "Launch" }).structuredContent;
  assert.ok(plain.url.includes("l=Launch"), plain.url);
  assert.match(plain.iframeHtml, /title="Launch — CountLink"/);
});

test("a label with HTML-significant characters cannot break out of the title attribute", () => {
  // This snippet is pasted verbatim as raw HTML onto someone else's page —
  // unlike a URL (already made safe by encodeURIComponent), the label lands
  // inside markup here, so a literal " or < must not escape the attribute or
  // open a tag.
  const hostile = '"><script>alert(1)</script>';
  const r = callTool("create_timer", { duration: "10m", embed_on_website: true, label: hostile }).structuredContent;
  assert.ok(!r.iframeHtml.includes("<script>"), r.iframeHtml);
  assert.match(r.iframeHtml, /title="[^"]*&quot;&gt;&lt;script&gt;[^"]*"/);
});

test("embed_on_website's prose explains the attribution requirement, not just the HTML", () => {
  const text = callTool("create_timer", { duration: "10m", embed_on_website: true }).content[0].text;
  assert.match(text, /iframe/i);
  assert.match(text, /every visitor/i);
  assert.match(text, /attribution|shared countdown by countlink/i);
});

test("describe_timer_link can read back an embed URL, style and all", () => {
  const created = callTool("create_timer", { duration: "10m", embed_on_website: true, label: "Focus", embed_style: "light" }, FIXED_NOW);
  const back = describeUrl(created.structuredContent.url, FIXED_NOW);
  assert.equal(back.kind, "share");
  assert.equal(back.label, "Focus");
  assert.equal(back.remainingSeconds, 600);
});

test("embedTargetUrl and embedSnippet are exported and independently testable", () => {
  // Exercising the pure helpers directly, not just through callTool, so a
  // regression in either one fails at the smallest possible unit.
  const url = embedTargetUrl(300, "Break", FIXED_NOW, "board");
  assert.equal(url, `https://countlink.app/embed/?overlay=1#t=${FIXED_NOW + 300000}&l=Break`);
  const { html, width, height } = embedSnippet(url, "Break", 500, 250);
  assert.equal(width, 500);
  assert.equal(height, 250);
  assert.match(html, /<iframe src="https:\/\/countlink\.app\/embed\/\?overlay=1#t=/);
});

/* ======================= create_agenda ======================= */

test("create_agenda links to the agenda page, starting now", () => {
  // The agenda page's boot is DOM-gated — its builder/running elements only
  // exist on /timers/agenda-timer — so a link anywhere else would silently
  // show a blank homepage instead of an agenda.
  const r = callTool("create_agenda", {
    segments: [{ duration: "10m", label: "Intro" }, { duration: "20m", label: "Talk" }],
  }, FIXED_NOW);
  assert.ok(r.structuredContent.url.startsWith("https://countlink.app/timers/agenda-timer#ag="), r.structuredContent.url);
  assert.ok(r.structuredContent.url.endsWith(`&s=${FIXED_NOW}`), "an agenda is running from the moment it is created");
  assert.equal(r.structuredContent.start, FIXED_NOW);
  assert.equal(r.structuredContent.totalSeconds, 1800);
});

test("an agenda link is never a setup or self-starting shape", () => {
  const url = callTool("create_agenda", { segments: [{ duration: "5m" }] }, FIXED_NOW).structuredContent.url;
  assert.ok(!url.includes("#for="), url);
  assert.ok(!url.includes("go=1"), url);
});

test("what create_agenda emits, the agenda page's own parser reads back identically", () => {
  // THE contract: functions/mcp.js writes the hash, app.js's parseAgendaHash
  // reads it. Fractional minutes (90s → 1.5) and an empty label (must be ""
  // — parseAgendaHash drops a segment whose label isn't a string) are the
  // two encodings most likely to drift.
  const { parseAgendaHash } = loadDuration();
  const r = callTool("create_agenda", { segments: [
    { duration: "10m", label: "Intro" }, { duration: "90s" }, { duration: "1h", label: "  Deep dive  " },
  ] }, FIXED_NOW);
  const back = parseAgendaHash(new URL(r.structuredContent.url).hash.slice(1));
  assert.ok(back, "app.js could not parse the link this server built");
  assert.equal(back.start, FIXED_NOW);
  assert.deepEqual(back.segments, [
    { label: "Intro", minutes: 10 }, { label: "", minutes: 1.5 }, { label: "Deep dive", minutes: 60 },
  ]);
});

test("a segment label containing % survives the round trip", () => {
  // parseAgendaHash used to decodeURIComponent a value URLSearchParams had
  // already decoded — the same double-decode that crashed the board on a
  // "50% done" label (see labelFromHash). "% d" is not a valid escape, so
  // the whole agenda link came back null. This fails without the app.js fix.
  const { parseAgendaHash } = loadDuration();
  const r = callTool("create_agenda", { segments: [{ duration: "5m", label: "50% done" }] }, FIXED_NOW);
  const back = parseAgendaHash(new URL(r.structuredContent.url).hash.slice(1));
  assert.ok(back, "a % in a label must not break the link");
  assert.equal(back.segments[0].label, "50% done");
});

test("the run sheet matches app.js's runSheetRows row for row", () => {
  const { runSheetRows } = loadDuration();
  const segs = [{ label: "A", minutes: 10 }, { label: "", minutes: 1.5 }, { label: "C", minutes: 60 }];
  assert.deepEqual(agendaRunSheet(segs, FIXED_NOW), runSheetRows(segs, FIXED_NOW));
});

test("create_agenda refuses what the page cannot show, naming the segment", () => {
  const cases = [
    [{ segments: [] }, /non-empty/],
    [{ segments: "10m" }, /non-empty/],
    [{}, /non-empty/],
    [{ segments: [{ duration: "10m" }, { duration: "soon" }] }, /Segment 2/],
    [{ segments: Array.from({ length: 25 }, () => ({ duration: "1m" })) }, /Too many/],
    [{ segments: [{ duration: "50h" }, { duration: "50h" }] }, /whole agenda/],
  ];
  for (const [args, re] of cases) {
    const r = callTool("create_agenda", args, FIXED_NOW);
    assert.equal(r.isError, true, JSON.stringify(args).slice(0, 80));
    assert.match(r.content[0].text, re);
  }
});

test("a single over-long segment clamps to the board's maximum, exactly like create_timer", () => {
  // parseDuration() caps one value at 99h59m59s rather than refusing it, and
  // create_timer's own tests pin that behaviour — an agenda must not quietly
  // disagree with it. Only the SUM of segments can be refused.
  const r = callTool("create_agenda", { segments: [{ duration: "100h" }] }, FIXED_NOW);
  assert.equal(r.isError, undefined, r.content[0].text);
  assert.equal(r.structuredContent.totalSeconds, 99 * 3600 + 59 * 60 + 59);
  assert.equal(callTool("create_timer", { duration: "100h" }).structuredContent.durationSeconds, r.structuredContent.totalSeconds,
    "agenda and single-timer clamping must agree");
});

test("agenda labels are trimmed and capped like timer labels", () => {
  const r = callTool("create_agenda", { segments: [{ duration: "5m", label: "  " + "x".repeat(200) }] }, FIXED_NOW);
  assert.equal(r.structuredContent.segments[0].label.length, 60);
});

test("create_agenda's prose carries the link and every segment", () => {
  const text = callTool("create_agenda", {
    segments: [{ duration: "10m", label: "Intro" }, { duration: "20m", label: "Q&A" }],
  }, FIXED_NOW).content[0].text;
  assert.match(text, /countlink\.app\/timers\/agenda-timer#ag=/);
  assert.match(text, /1\. Intro — 10m \(from 00:00 to 10:00\)/);
  assert.match(text, /2\. Q&A — 20m \(from 10:00 to 30:00\)/);
});

test("describe_timer_link reads an agenda link and knows where it is", () => {
  const url = callTool("create_agenda", {
    segments: [{ duration: "10m", label: "Intro" }, { duration: "20m", label: "Talk" }],
  }, FIXED_NOW).structuredContent.url;
  const atStart = describeUrl(url, FIXED_NOW);
  assert.equal(atStart.kind, "agenda");
  assert.equal(atStart.currentIndex, 0);
  assert.equal(atStart.remainingSeconds, 1800);
  const inTalk = describeUrl(url, FIXED_NOW + 15 * 60000);
  assert.equal(inTalk.currentIndex, 1, "15 minutes in, the 10-minute intro is over");
  assert.equal(inTalk.remainingSeconds, 900);
  const done = describeUrl(url, FIXED_NOW + 31 * 60000);
  assert.equal(done.finished, true);
  assert.equal(done.currentIndex, -1);
  assert.equal(done.remainingSeconds, 0, "never negative");
  const prose = callTool("describe_timer_link", { url }, FIXED_NOW + 15 * 60000).content[0].text;
  assert.match(prose, /segment 2/i);
  assert.match(prose, /Talk/);
});

test("describe_timer_link's agenda reading agrees with app.js's computeAgendaState", () => {
  const { computeAgendaState } = loadDuration();
  const segs = [{ label: "A", minutes: 10 }, { label: "B", minutes: 20 }];
  const url = agendaUrl(segs, FIXED_NOW);
  for (const offsetMin of [0, 5, 10, 25, 30, 40]) {
    const at = FIXED_NOW + offsetMin * 60000;
    assert.equal(describeUrl(url, at).currentIndex, computeAgendaState(segs, FIXED_NOW, at).idx, `${offsetMin} min in`);
  }
});

test("an agenda link with no valid segments is not a timer link", () => {
  const page = "https://countlink.app/timers/agenda-timer";
  assert.equal(describeUrl(`${page}#ag=${encodeURIComponent("[]")}&s=${FIXED_NOW}`, FIXED_NOW), null);
  assert.equal(describeUrl(`${page}#ag=notjson&s=${FIXED_NOW}`, FIXED_NOW), null);
  assert.equal(describeUrl(`${page}#ag=${encodeURIComponent('[{"label":"A","minutes":5}]')}`, FIXED_NOW), null, "no start instant");
});

test("create_agenda is listed alongside the other tools", () => {
  const names = rpc("tools/list").result.tools.map((t) => t.name);
  assert.ok(names.includes("create_agenda"), names.join(", "));
});

/* ======================= .ics calendar export ======================= */

test("create_timer's plain setup link and overlay link carry no .ics", () => {
  // Neither has a real fixed end instant yet: a setup link has nothing
  // pressed, and an overlay's whole point is restarting per viewer.
  assert.equal(callTool("create_timer", { duration: "10m" }).structuredContent.ics, undefined);
  assert.equal(callTool("create_timer", { duration: "10m", for_obs_overlay: true }).structuredContent.ics, undefined);
});

test("create_timer's start_now and embed_on_website both carry a matching .ics", () => {
  for (const variant of [{ start_now: true }, { embed_on_website: true }]) {
    const r = callTool("create_timer", { duration: "25m", label: "Focus", ...variant }, FIXED_NOW);
    assert.ok(r.structuredContent.ics, JSON.stringify(variant));
    assert.match(r.structuredContent.ics, /SUMMARY:Focus\r\n/);
    assert.match(r.structuredContent.ics, /DTSTART:20250904T155820Z\r\n/, "the exact fixed instant for FIXED_NOW + 25m");
    assert.equal(r.structuredContent.ics.match(/DTSTART:/g).length, 1);
    assert.equal(r.structuredContent.ics.match(/^DTSTART:(.*)\r$/m)[1], r.structuredContent.ics.match(/^DTEND:(.*)\r$/m)[1],
      "a countdown's calendar entry marks the single instant it ends, start===end");
  }
});

test("create_timer's .ics mentions the link back to the countdown", () => {
  const r = callTool("create_timer", { duration: "10m", embed_on_website: true }, FIXED_NOW);
  assert.match(r.structuredContent.ics, new RegExp(`URL:${r.structuredContent.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\r\\n`));
});

test("create_agenda's .ics has one VEVENT per segment, matching the run sheet", () => {
  const r = callTool("create_agenda", {
    segments: [{ duration: "10m", label: "Intro" }, { duration: "20m", label: "Talk" }],
  }, FIXED_NOW);
  const ics = r.structuredContent.ics;
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /SUMMARY:Intro\r\n/);
  assert.match(ics, /SUMMARY:Talk\r\n/);
  assert.ok(ics.indexOf("SUMMARY:Intro") < ics.indexOf("SUMMARY:Talk"), "segments stay in order");
  for (const r2 of r.structuredContent.runSheet) {
    const start = r2.startsAt.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    assert.ok(ics.includes(`DTSTART:${start}`), `${r2.label}: ${start} not found in ${ics}`);
  }
});

test("app.js's buildIcs and functions/mcp.js's buildIcs agree, byte for byte", () => {
  // A SECOND implementation of the same RFC 5545 writer, same discipline as
  // the duration grammar and the agenda hash codec above: run one corpus
  // through both and fail if they ever drift.
  const { buildIcs: appBuildIcs, icsUid: appIcsUid } = loadDuration();
  const now = FIXED_NOW;
  const corpus = [
    [{ uid: "a@countlink.app", summary: "Focus", startMs: now, endMs: now, url: "https://countlink.app/#t=" + now }],
    [{ uid: "b@countlink.app", summary: "Q&A; break, review\\notes", startMs: now, endMs: now }],
    [
      { uid: "c@countlink.app", summary: "Intro", startMs: now, endMs: now + 600000 },
      { uid: "d@countlink.app", summary: "", startMs: now + 600000, endMs: now + 3000000 },
    ],
  ];
  for (const events of corpus) {
    assert.equal(buildIcs(events, now), appBuildIcs(events, now), JSON.stringify(events));
  }
  for (const [ms, label] of [[now, "Focus"], [now, ""], [now + 1, "Focus"], [now, "Q&A; special"]]) {
    assert.equal(icsUid(ms, label), appIcsUid(ms, label), `${ms} ${label}`);
  }
});

/* ======================= create_badge ======================= */

test("create_badge points at /badge.svg with a fixed-instant #t= page link, never #for= or go=1", () => {
  const r = callTool("create_badge", { duration: "10m", label: "Launch" }, FIXED_NOW);
  const sc = r.structuredContent;
  assert.ok(sc.badgeUrl.startsWith("https://countlink.app/badge.svg?t="), sc.badgeUrl);
  assert.ok(sc.pageUrl.startsWith("https://countlink.app/#t="), sc.pageUrl);
  assert.ok(!sc.badgeUrl.includes("#for="));
  assert.ok(!sc.pageUrl.includes("go=1"));
  assert.equal(sc.style, "board");
  assert.equal(sc.duration, "10m");
});

test("create_badge never emits a bare image — the image is always wrapped in the page link", () => {
  // The whole point of the feature: an unlinked badge earns nothing back.
  const r = callTool("create_badge", { duration: "10m", label: "Launch" }, FIXED_NOW);
  assert.match(r.structuredContent.markdown, /^\[!\[.*\]\(.*\)\]\(.*\)$/, r.structuredContent.markdown);
  assert.match(r.structuredContent.html, /^<a href="[^"]+"><img src="[^"]+"[^>]*><\/a>$/, r.structuredContent.html);
  // And specifically: the outer link goes to the live page, the inner image
  // to the badge — not the same URL twice, which would defeat the purpose.
  assert.notEqual(r.structuredContent.badgeUrl, r.structuredContent.pageUrl);
  assert.ok(r.structuredContent.markdown.includes(r.structuredContent.pageUrl));
  assert.ok(r.structuredContent.markdown.includes(r.structuredContent.badgeUrl));
});

test("a badge_style is carried onto the badge URL, board being the omitted default", () => {
  const light = callTool("create_badge", { duration: "10m", badge_style: "light" }).structuredContent;
  assert.ok(light.badgeUrl.includes("style=light"), light.badgeUrl);
  const board = callTool("create_badge", { duration: "10m", badge_style: "board" }).structuredContent;
  assert.ok(!board.badgeUrl.includes("style="), board.badgeUrl);
  const invalid = callTool("create_badge", { duration: "10m", badge_style: "neon" }).structuredContent;
  assert.equal(invalid.style, "board");
});

test("a label with a literal ] cannot break out of the Markdown image syntax", () => {
  // ![alt](url) — an unescaped ] in alt closes the bracket early and splices
  // whatever follows into a second, attacker-chosen link when this is pasted
  // into a real README.
  const hostile = "x](https://evil.example/)[y";
  const r = callTool("create_badge", { duration: "10m", label: hostile }).structuredContent;
  assert.ok(!r.markdown.includes("](https://evil.example/)["), r.markdown);
  assert.match(r.markdown, /^\[!\[x\\\]\(https:\/\/evil\.example\/\)\\\[y\]/);
});

test("a label with HTML-significant characters cannot break out of the HTML alt attribute", () => {
  const hostile = '"><script>alert(1)</script>';
  const r = callTool("create_badge", { duration: "10m", label: hostile }).structuredContent;
  assert.ok(!r.html.includes("<script>"), r.html);
  assert.match(r.html, /alt="[^"]*&quot;&gt;&lt;script&gt;[^"]*"/);
});

test("create_badge's prose previews the same coarse text the image will actually show", () => {
  const text = callTool("create_badge", { duration: "47m" }, FIXED_NOW).content[0].text;
  assert.match(text, /47m left/);
});

test("badgeTimeTextPreview agrees with functions/badge.svg.js's own badgeTimeText", async () => {
  const badgeSrc = readFileSync(join(ROOT, "functions", "badge.svg.js"), "utf8");
  const badgeMod = await import("data:text/javascript," + encodeURIComponent(badgeSrc));
  for (const s of [0, 1, 30, 59, 60, 61, 3599, 3600, 3661, 86399, 86400, 86400 * 3 + 3600 * 4, -10]) {
    assert.equal(badgeTimeTextPreview(s), badgeMod.badgeTimeText(s), s);
  }
});

/* ======================= the drift guard ======================= */

test("the MCP duration grammar matches the board's, value for value", () => {
  // functions/mcp.js re-implements assets/app.js's parsePastedDuration()
  // because a Worker cannot import a browser script that touches the DOM.
  // Two copies of a grammar drift; this is the test that stops it silently.
  // If it fails, the fix is to change BOTH, not to loosen this assertion.
  const { parsePastedDuration } = loadDuration();
  const corpus = [
    "25m", "1h30m", "90s", "5:00", "1:30:00", "45", "1", "0", "0m", "0:00",
    "2h", "2h5m", "2h5m30s", "10:30", "00:30", "99:59:59", "200h", "1000m",
    "", " ", "abc", "10x", "--", "1h30", "NaN", "1e3", "90ms", "  10m  ",
    "10M", "1H30M", "5 m", "1 h 30 m", "999", "9999",
  ];
  for (const raw of corpus) {
    assert.equal(parseDuration(raw), parsePastedDuration(raw),
      `disagreement on ${JSON.stringify(raw)} — app.js and functions/mcp.js must parse alike`);
  }
});

test("compactDuration emits a string the board's own grammar accepts", () => {
  // The value in #for= is round-tripped through the board's parser on open,
  // so anything this emits must parse back to the identical number of seconds.
  const { parsePastedDuration } = loadDuration();
  for (const seconds of [1, 59, 60, 90, 300, 1500, 3600, 5400, 5430, 86399, 359999]) {
    const compact = compactDuration(seconds);
    assert.equal(parsePastedDuration(compact), seconds,
      `${seconds}s → "${compact}" → ${parsePastedDuration(compact)}`);
  }
});

test("a setup URL this server builds is one the board will actually boot", () => {
  // The end-to-end invariant across both halves of the feature: the server
  // writes the link, app.js's parseSetupHash reads it.
  const { parseSetupHash } = loadDuration();
  for (const d of ["25m", "1h30m", "90s", "5:00", "45"]) {
    const url = setupUrl(parseDuration(d), "Standup");
    const hash = new URL(url).hash;
    const parsed = parseSetupHash(hash);
    assert.ok(parsed, `${d}: board refused ${hash}`);
    assert.equal(parsed.seconds, parseDuration(d), d);
    assert.equal(parsed.label, "Standup", d);
  }
});

/* ======================= helpers ======================= */

test("humanDuration reads naturally at every scale", () => {
  assert.equal(humanDuration(0), "0s");
  assert.equal(humanDuration(30), "30s");
  assert.equal(humanDuration(60), "1m");
  assert.equal(humanDuration(90), "1m 30s");
  assert.equal(humanDuration(1500), "25m");
  assert.equal(humanDuration(3600), "1h");
  assert.equal(humanDuration(5430), "1h 30m 30s");
});

test("durations are clamped to what the board can display", () => {
  const MAX = 99 * 3600 + 59 * 60 + 59;
  assert.equal(parseDuration("200h"), MAX);
  assert.equal(shareUrl(1e9, "", FIXED_NOW), `https://countlink.app/#t=${FIXED_NOW + MAX * 1000}`);
});

/* ======================= it has to actually deploy ======================= */
//
// The endpoint is worthless if it doesn't ship, and the way it would fail to
// ship is silent: .github/workflows/deploy.yml builds dist/ with a DENY-LIST
// rsync, so anyone adding "functions" to that list — it sits right next to
// "scripts", "test" and "docs", which all genuinely are private — would take
// /mcp off the internet with nothing failing anywhere. This project has been
// bitten by exactly this shape of bug twice (guides/ served index.html at 200
// for weeks; /embed/ served 200 with 404'd assets), so it gets a guard.

test("the deploy does not exclude functions/ from dist", () => {
  const workflow = readFileSync(join(ROOT, ".github", "workflows", "deploy.yml"), "utf8");
  assert.ok(
    !/--exclude\s+'functions'/.test(workflow),
    "deploy.yml excludes functions/ — Pages Functions only run from dist/functions, " +
      "so /mcp would 404 in production while every test here still passed"
  );
});

test("mcp.js sits where Pages routes /mcp, with a .js extension", () => {
  // Pages Functions maps functions/mcp.js → /mcp. The extension matters: the
  // docs do not commit to .mjs being routed, so this file deliberately uses
  // .js and is loaded here through a data: URL instead of being imported.
  assert.ok(existsSync(join(ROOT, "functions", "mcp.js")), "functions/mcp.js must exist");
});

test("the server module is self-contained, so the bundler has nothing to resolve", () => {
  // No imports means no build step, no path that can break between here and
  // Cloudflare, and no second file that could be left out of dist/.
  assert.ok(!/^\s*import\s/m.test(src), "functions/mcp.js must not import anything");
});

/* ======================= the HTTP shell ======================= */
//
// handleRpc above is the logic; onRequest is what Cloudflare actually calls.
// Node has had Request/Response as globals since 18, so the deployed handler
// runs here unmodified — worth doing, because every bug in this layer (a
// missing CORS header, a 200 where a 202 belongs) presents to a client as
// "the server is broken" with nothing in the body to explain it.

const post = (body, headers) =>
  mcp.onRequest({
    request: new Request("https://countlink.app/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  });

test("POST returns JSON-RPC and is never cached", () => {
  return post({ jsonrpc: "2.0", id: 1, method: "tools/list" }).then(async (res) => {
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/json");
    assert.match(res.headers.get("Cache-Control"), /no-store/,
      "a cached MCP response would pin a stale tool list");
    const body = await res.json();
    assert.ok(body.result.tools.length);
  });
});

test("a notification gets 202 and an empty body, not a JSON-RPC reply", async () => {
  const res = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), "");
});

test("a batch answers only the messages that have ids", async () => {
  const res = await post([
    { jsonrpc: "2.0", id: 1, method: "ping" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ]);
  const body = await res.json();
  assert.equal(body.length, 2, "the notification must not produce an entry");
  assert.deepEqual(body.map((m) => m.id), [1, 2]);
});

test("a batch of nothing but notifications is 202 with no body", async () => {
  const res = await post([{ jsonrpc: "2.0", method: "notifications/initialized" }]);
  assert.equal(res.status, 202);
  assert.equal(await res.text(), "");
});

test("malformed JSON is a parse error, not a 500", async () => {
  const res = await post("{not json");
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, -32700);
});

test("the CORS preflight advertises the headers MCP clients actually send", async () => {
  const res = await mcp.onRequest({
    request: new Request("https://countlink.app/mcp", { method: "OPTIONS" }),
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
  const allowed = res.headers.get("Access-Control-Allow-Headers");
  // Spec-compliant clients send MCP-Protocol-Version on every post-handshake
  // request; leaving it out of the preflight fails the whole session in a
  // browser, and does so invisibly from the server's side.
  assert.match(allowed, /MCP-Protocol-Version/i);
  assert.match(allowed, /Content-Type/i);
});

test("every response carries CORS, not just the preflight", async () => {
  const res = await post({ jsonrpc: "2.0", id: 1, method: "ping" });
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "*");
});

test("GET returns something a human can read instead of a dead SSE stream", async () => {
  // This server has nothing unprompted to say, so it never opens the
  // transport's optional server-initiated stream. Someone (or a health check)
  // pasting /mcp into a browser should still get a useful answer.
  const res = await mcp.onRequest({
    request: new Request("https://countlink.app/mcp", { method: "GET" }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, "countlink");
  assert.ok(body.tools.includes("create_timer"));
  assert.ok(body.protocolVersions.includes("2025-06-18"));
});

test("other verbs are refused with a readable reason", async () => {
  const res = await mcp.onRequest({
    request: new Request("https://countlink.app/mcp", { method: "DELETE" }),
  });
  assert.equal(res.status, 405);
});

test("labelOf decodes exactly once and tolerates a broken escape", () => {
  assert.equal(labelOf("t=1&l=" + encodeURIComponent("C++ review")), "C++ review");
  assert.equal(labelOf("t=1&l=100%"), "100%");
  assert.equal(labelOf("t=1&intl=Nope"), "", "a key ending in 'l' is not the label");
});
