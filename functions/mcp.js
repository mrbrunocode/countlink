/**
 * CountLink MCP server — Cloudflare Pages Function, served at /mcp.
 *
 * WHY THIS EXISTS
 * ---------------
 * CountLink's whole mechanic is that the deadline lives in the URL. The
 * consequence, until #for= and this endpoint existed, was that only a human
 * in a browser who had already pressed start could produce a working link:
 * the share URL carries an absolute end timestamp, so nothing that doesn't
 * know the current epoch time could write one in advance.
 *
 * That mattered because the measured traffic is overwhelmingly AI-assistant
 * referral (see docs/ and the GA4 channel split — AI Assistant is the largest
 * single channel), and an assistant recommending CountLink could only say
 * "go to countlink.app and set one up". This endpoint closes that gap: an
 * assistant can hand the user a real link, already carrying the duration.
 *
 * SHAPE
 * -----
 * Deliberately one self-contained file with no imports. Pages Functions
 * routes `functions/mcp.js` to /mcp; keeping the pure logic in the same
 * module (exported alongside onRequest) means the unit tests exercise the
 * exact code that ships, with no build step and no second copy to drift.
 *
 * There is no state, no storage and no auth here — every tool is pure string
 * arithmetic over a duration, which is why they are all annotated
 * readOnlyHint. Nothing this endpoint does can affect another user, so
 * there is nothing to rate-limit beyond what Cloudflare already does.
 *
 * Spec: MCP 2025-06-18, streamable HTTP transport (JSON-RPC 2.0 over POST).
 */

const SITE_URL = "https://countlink.app";
const SERVER_NAME = "countlink";
const SERVER_VERSION = "1.0.0";

/* Newest first — negotiation echoes the client's version when we support it,
   otherwise answers with SUPPORTED[0], which is what the spec asks for. */
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const MAX_SECONDS = 99 * 3600 + 59 * 60 + 59; // what six split-flap tiles can show

/* ---------------------------------------------------------------------------
 * Duration grammar.
 *
 * This is a second implementation of assets/app.js's parsePastedDuration():
 * app.js is a classic browser script that touches the DOM, so a Worker cannot
 * import it. A second copy is a drift risk, so test/mcp-server.test.mjs runs a
 * shared corpus through BOTH and fails if they ever disagree. Change one, and
 * that test tells you to change the other.
 * ------------------------------------------------------------------------- */
export function parseDuration(txt) {
  const t = String(txt == null ? "" : txt).trim().toLowerCase();
  if (!t) return null;

  const colon = t.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colon) {
    return clampSeconds(
      colon[3] !== undefined
        ? +colon[1] * 3600 + +colon[2] * 60 + +colon[3]
        : +colon[1] * 60 + +colon[2]
    );
  }
  // (?!s) keeps "90ms" from parsing as 90 minutes.
  const units = t.match(/^(?:(\d{1,3})\s*h)?\s*(?:(\d{1,3})\s*m(?!s))?\s*(?:(\d{1,3})\s*s)?$/);
  if (units && (units[1] || units[2] || units[3])) {
    return clampSeconds((+units[1] || 0) * 3600 + (+units[2] || 0) * 60 + (+units[3] || 0));
  }
  if (/^\d{1,3}$/.test(t)) return clampSeconds(+t * 60);
  return null;
}

export function clampSeconds(t) {
  t = Math.floor(Number(t));
  if (!isFinite(t)) return 0;
  return Math.max(0, Math.min(MAX_SECONDS, t));
}

/** "1h 30m", "25m", "90s" — for prose back to the model and the user. */
export function humanDuration(seconds) {
  const s = clampSeconds(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const parts = [];
  if (h) parts.push(h + "h");
  if (m) parts.push(m + "m");
  if (sec || !parts.length) parts.push(sec + "s");
  return parts.join(" ");
}

/* A second implementation of functions/badge.svg.js's badgeTimeText(), used
   only to preview what a fresh badge will show in create_badge's prose —
   that file can't be imported here any more than mcp.js's own logic could
   be imported there (see badge.svg.js's header comment on why it stays
   self-contained too). Cross-checked in test/mcp-server.test.mjs so the two
   can't quietly drift apart. */
export function badgeTimeTextPreview(remainingSeconds) {
  if (remainingSeconds <= 0) return "Ended";
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  if (days >= 1) return `${days}d ${String(hours).padStart(2, "0")}h left`;
  if (hours >= 1) return `${hours}h ${String(minutes).padStart(2, "0")}m left`;
  if (minutes >= 1) return `${minutes}m left`;
  return "<1m left";
}

/* ---------------------------------------------------------------------------
 * URL construction — the two shapes of link, and why the default is "setup".
 *
 * A setup link (#for=) opens the board ready at a duration; the human presses
 * start, and that mints the share link everyone else opens. A share link
 * (#t=) carries one absolute instant so every screen agrees to the second.
 *
 * start_now defaults to FALSE on purpose. A #t= link minted here starts
 * counting the moment the tool is called, which is only right when the user
 * genuinely means "start it now"; used as the default it would hand people
 * links that had already been running for however long the conversation took.
 * ------------------------------------------------------------------------- */
export function setupUrl(seconds, label, opts) {
  const overlay = !!(opts && opts.overlay);
  /* Overlays point at /embed/, NOT at /?overlay=1.
     Both render the same transparent board — ?overlay=1 redirects to /embed/
     from the first script in <head> — but that redirect happens too late to
     stop the browser's preload scanner from having already queued the AdSense
     and gtag <script src>es on the way past. /embed/ is built with those tags
     stripped out entirely (verified: zero ad or analytics tags in the file, vs
     seven in index.html), so a link handed out here can never load ad code
     onto a screen with no publisher content on it.
     That matters: serving ads on a content-free overlay is the exact AdSense
     violation this site was already fixed for. See docs/overlay-ads.md. */
  /* Both halves are load-bearing and neither is optional:
       /embed/    — the ad-free, analytics-free build (and the path _headers
                    exempts from X-Frame-Options, so it can be iframed).
       ?overlay=1 — what actually strips the chrome and makes the background
                    transparent; app.js reads it from the QUERY, not the hash.
     /embed/ without ?overlay=1 renders the whole page, header and all, which
     is useless on a scene. /?overlay=1 without /embed/ is transparent but
     redirects in from a page that has already queued the ad scripts. */
  const base = overlay ? `${SITE_URL}/embed/?overlay=1` : `${SITE_URL}/`;
  let u = `${base}#for=${encodeURIComponent(compactDuration(seconds))}`;
  if (label) u += `&l=${encodeURIComponent(label)}`;
  // An overlay that has to be started by hand is useless as a Browser Source
  // — there is no button on it to press. This is the only place &go=1 is
  // emitted, and it is why it exists.
  if (overlay) u += "&go=1";
  return u;
}

export function shareUrl(seconds, label, now) {
  const end = (typeof now === "number" ? now : Date.now()) + clampSeconds(seconds) * 1000;
  const u = `${SITE_URL}/#t=${end}`;
  return label ? `${u}&l=${encodeURIComponent(label)}` : u;
}

/* ---------------------------------------------------------------------------
 * Website embed (create_timer's embed_on_website: true branch).
 *
 * The one feature on this whole site whose entire point is off-site: it
 * plants an attribution link on a page CountLink doesn't own. Backlinks are
 * the single metric that has never moved for this domain (one referring
 * domain, per docs/monetization.md and the SEO memory), and this is the only
 * mechanism found so far that earns one without per-instance outreach — the
 * same shape as the OBS-overlay embed builder on the homepage
 * (renderEmbedCode() in assets/app.js), reimplemented here so an assistant
 * can produce the same result without a human ever clicking the button.
 *
 * Deliberately NOT the same URL shape as for_obs_overlay:
 *   - for_obs_overlay uses setupUrl(...,{overlay:true}) — a #for= link with
 *     &go=1, because OBS is exactly one viewer with no Start button to press,
 *     so the countdown has to begin itself whenever the scene loads. Fine for
 *     a single machine; wrong for a website, where every visitor loading the
 *     page would each get their OWN countdown starting from whenever they
 *     happened to arrive — the "evergreen per-visitor countdown" this whole
 *     product exists specifically not to be (see docs/monetization.md's
 *     ShareMyTimer/CountdownShare comparison).
 *   - A website embed needs the opposite: ONE fixed instant every visitor
 *     agrees on, same as a normal shared link — so this reuses shareUrl()'s
 *     #t= math, then points it at /embed/ (the ad-free, X-Frame-Options-
 *     exempt build) with ?overlay=1 for the transparent chrome-free render.
 *     No &go=1: a #t= link is already a fixed instant and needs no
 *     self-start flag (that flag only exists for the #for= setup shape).
 * ------------------------------------------------------------------------- */
export function embedTargetUrl(seconds, label, now, style) {
  const end = (typeof now === "number" ? now : Date.now()) + clampSeconds(seconds) * 1000;
  let u = `${SITE_URL}/embed/?overlay=1#t=${end}`;
  if (label) u += `&l=${encodeURIComponent(label)}`;
  // "board" is the default the client omits too — see embedSrc() in
  // assets/app.js's own comment for why a snippet with no ?style= should
  // keep working if the default board style ever changes.
  if (style && style !== "board") u += `&style=${encodeURIComponent(style)}`;
  return u;
}

const EMBED_STYLES = new Set(["board", "minimal", "light"]);
const EMBED_W_MIN = 160, EMBED_W_MAX = 1600, EMBED_W_DEFAULT = 400;
const EMBED_H_MIN = 80, EMBED_H_MAX = 900, EMBED_H_DEFAULT = 160;

function clampEmbedDim(n, min, max, dflt) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v <= 0) return dflt;
  return Math.min(max, Math.max(min, v));
}

/* The snippet is pasted verbatim onto someone else's page as raw HTML, so a
   label carrying a literal " or < must not be able to break out of the title
   attribute or open a tag — the one place in this file untrusted text
   (a.label, caller-supplied) ends up inside markup rather than inside a URL
   (which encodeURIComponent already makes safe on its own). */
function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* create_badge's Markdown snippet is pasted verbatim into a real README, so
   a label carrying a literal ] must not be able to close the image's alt
   text early and splice in a second link — CommonMark backslash-escaping
   for the three characters that are structural inside ![...](...): \, [, ]. */
function escapeMarkdownAlt(s) {
  return String(s == null ? "" : s).replace(/[\\[\]]/g, "\\$&");
}

/* Mirrors renderEmbedCode() in assets/app.js: an <iframe> at a fixed pixel
   size, followed by a plain-text attribution paragraph whose link sits
   OUTSIDE the <iframe> tag. That positioning is not cosmetic — a link inside
   a frame is attributed to the frame's own document (countlink.app), so it
   earns the embedding page nothing; only a link in the HOST page's own DOM
   passes real link equity back to it. Guarded by test/mcp-server.test.mjs. */
export function embedSnippet(src, label, width, height) {
  const w = clampEmbedDim(width, EMBED_W_MIN, EMBED_W_MAX, EMBED_W_DEFAULT);
  const h = clampEmbedDim(height, EMBED_H_MIN, EMBED_H_MAX, EMBED_H_DEFAULT);
  const title = escapeHtmlAttr(`${label || "Countdown"} — CountLink`);
  const iframe =
    `<iframe src="${src}" width="${w}" height="${h}" title="${title}" loading="lazy" style="border:0"></iframe>`;
  const attribution = `<p style="font-size:13px"><a href="${SITE_URL}/">Shared countdown by CountLink</a></p>`;
  return { html: `${iframe}\n${attribution}`, width: w, height: h };
}

/* ---------------------------------------------------------------------------
 * .ics calendar export.
 *
 * This is parity, not differentiation — several competitors already offer
 * calendar export (see docs/monetization.md's fallback section). Kept
 * deliberately small: hand-built RFC 5545, no library. This is a SECOND
 * implementation of assets/app.js's buildIcs()/icsUid()/etc — a Worker
 * cannot import a browser script that touches the DOM, the same reason
 * parseDuration() is duplicated above — so test/mcp-server.test.mjs runs a
 * shared corpus through BOTH and fails if they ever disagree.
 *
 * Only produced for a real, fixed end instant: create_timer's start_now and
 * embed_on_website both mint one (#t=); the plain setup-link default does
 * not, and for_obs_overlay's per-viewer restart has no single end either —
 * see callTool()'s create_timer branch for where each is (or isn't) attached.
 * ------------------------------------------------------------------------- */
function icsEscapeText(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}
function icsTimestamp(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}
// FNV-1a — not cryptographic, just enough entropy that different labels
// produce different UIDs so re-exporting the SAME countdown updates rather
// than duplicates in most calendar apps. Must match assets/app.js's icsHash
// bit for bit; the cross-check test is what actually enforces that.
function icsHash(str) {
  let h = 0x811c9dc5;
  const s = String(str == null ? "" : str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}
export function icsUid(endMs, label) {
  return `${endMs}-${icsHash(label)}@countlink.app`;
}
function icsFold(line) {
  if (line.length <= 75) return line;
  const out = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) { out.push(" " + rest.slice(0, 74)); rest = rest.slice(74); }
  if (rest.length) out.push(" " + rest);
  return out.join("\r\n");
}
export function buildIcs(events, now) {
  // Same guard every *Url builder in this file already has (shareUrl,
  // embedTargetUrl, setupUrl) — `now` is `undefined` on every real
  // production call (only the tests pass a fixed one for determinism), and
  // without this DTSTAMP silently rendered as DTSTAMP:NaNNaNNaNTNaNNaNNaNZ
  // in production for a day before being caught. Every callTool() call site
  // now resolves this itself before calling buildIcs too, but this is the
  // backstop for the next one that doesn't.
  const stamp = icsTimestamp(typeof now === "number" ? now : Date.now());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CountLink//countlink.app//EN", "METHOD:PUBLISH"];
  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(icsFold(`UID:${ev.uid}`));
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${icsTimestamp(ev.startMs)}`);
    lines.push(`DTEND:${icsTimestamp(ev.endMs)}`);
    lines.push(icsFold(`SUMMARY:${icsEscapeText(ev.summary)}`));
    if (ev.url) lines.push(icsFold(`URL:${ev.url}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/* ---------------------------------------------------------------------------
 * Chained agenda (create_agenda).
 *
 * The agenda page (/timers/agenda-timer) already does ordered, auto-advancing
 * segments, but only via its own builder UI. An assistant asked "split my
 * hour into four topics" can do that arithmetic trivially and, until this
 * tool, had nowhere to put the answer. This is exactly the shape of task an
 * LLM is good at handing off — and none of the competitors audited in
 * docs/ai-surface-expansion-plan.md can receive it at all.
 *
 * URL shape mirrors encodeAgendaHash() in assets/app.js byte for byte:
 *   /timers/agenda-timer#ag=<encodeURIComponent(JSON [{label, minutes}])>&s=<start ms>
 * The agenda page's boot is DOM-gated (its builder/running elements only
 * exist on that page), so the link MUST target that path — the homepage
 * would silently ignore an #ag= hash. test/mcp-server.test.mjs round-trips
 * every link this emits through app.js's own parseAgendaHash().
 *
 * Start-now only, deliberately. computeAgendaState() with a future start is
 * mathematically fine (elapsed goes negative, idx lands on 0, the boundary
 * is still crossed at the right instant), but the page has no "starts in"
 * state — it would show segment 1 with the lead time folded into its
 * remaining time, which reads as a wrong duration. Supporting a planned
 * start properly is an app.js UI change, not an MCP-side one; recorded as
 * a follow-up in docs/ai-surface-expansion-plan.md rather than shipped
 * half-right here.
 *
 * `minutes` may be fractional: the page multiplies by 60000, so 90s → 1.5
 * is exact and renders as 01:30. parseAgendaHash() requires `label` to be a
 * string (it filters the segment out otherwise), so an empty label is
 * emitted as "" — never omitted — and the page falls back to "Segment N".
 * ------------------------------------------------------------------------- */
const AGENDA_PAGE = `${SITE_URL}/timers/agenda-timer`;
const AGENDA_MAX_SEGMENTS = 24;

export function agendaUrl(segments, start) {
  return `${AGENDA_PAGE}#ag=${encodeURIComponent(JSON.stringify(segments))}&s=${start}`;
}

/* Same rows runSheetRows() produces in app.js — {n, label, minutes,
   startsAt, endsAt} — so an assistant can relay the running order with
   wall-clock times without the user opening the page. Cross-checked against
   app.js's implementation in the tests. */
export function agendaRunSheet(segments, start) {
  let acc = 0;
  return segments.map((seg, i) => {
    const startsAt = start + acc;
    acc += seg.minutes * 60000;
    return { n: i + 1, label: seg.label || `Segment ${i + 1}`, minutes: seg.minutes, startsAt, endsAt: start + acc };
  });
}

/* Turn the model's segment list into what the page expects, or explain why
   not. Returns { segments } or { error }. */
export function normaliseAgendaSegments(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    return { error: "segments must be a non-empty list of { duration, label? } objects, in running order." };
  }
  if (raw.length > AGENDA_MAX_SEGMENTS) {
    return { error: `Too many segments (${raw.length}); the agenda page is a readable run sheet, not a spreadsheet — keep it to ${AGENDA_MAX_SEGMENTS} or fewer.` };
  }
  const segments = [];
  let total = 0;
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] && typeof raw[i] === "object" ? raw[i] : {};
    const seconds = parseDuration(s.duration);
    if (seconds === null || seconds <= 0) {
      return { error: `Segment ${i + 1}: could not read ${JSON.stringify(String(s.duration ?? ""))} as a duration. Try "10m", "1h", "90s" or a plain number of minutes.` };
    }
    // parseDuration() already clamps a single value to MAX_SECONDS, the same
    // way create_timer does — so one over-long segment is capped, not refused.
    // Only the SUM can exceed what the board shows, hence the total check below.
    total += seconds;
    const label = typeof s.label === "string" ? s.label.trim().slice(0, 60) : "";
    // Round away float noise (100s → 1.6666…7) so the JSON in the URL stays
    // short and two identical agendas produce identical links.
    const minutes = Math.round((seconds / 60) * 1000) / 1000;
    segments.push({ label, minutes });
  }
  if (total > MAX_SECONDS) {
    return { error: `The whole agenda runs ${humanDuration(total)}, longer than the board can show (max ${humanDuration(MAX_SECONDS)}).` };
  }
  return { segments, totalSeconds: total };
}

/* The value that goes in #for=. Emitted in the same grammar the board accepts
   on paste so a human reading the URL sees a duration, not a second count. */
export function compactDuration(seconds) {
  const s = clampSeconds(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  let out = "";
  if (h) out += h + "h";
  if (m) out += m + "m";
  if (sec) out += sec + "s";
  return out || "0s";
}

/** Read either shape back. Returns null when it isn't a CountLink timer link. */
/* Only countlink.app links. Without this the tool cheerfully "explained"
   https://example.com/#t=1 as a CountLink countdown — a model handed any URL
   with a #t= in it would have been told, with total confidence, that it was
   one of ours. */
const TIMER_HOSTS = new Set(["countlink.app", "www.countlink.app"]);

export function describeUrl(raw, now) {
  const at = typeof now === "number" ? now : Date.now();
  let hash = "";
  try {
    const u = new URL(String(raw));
    if (!TIMER_HOSTS.has(u.hostname.toLowerCase())) return null;
    hash = u.hash.replace(/^#/, "");
  } catch (e) {
    return null;
  }
  const p = new URLSearchParams(hash);
  const label = labelOf(hash);

  // Agenda links — from create_agenda or the agenda page's own builder.
  // Mirrors parseAgendaHash() in app.js: both fields required, malformed
  // segments dropped, null if nothing valid remains. p.get() has already
  // percent-decoded once; decoding again would be the double-decode that
  // labelOf() exists to avoid (and that broke "50% done" labels).
  const ag = p.get("ag"), s = p.get("s");
  if (ag !== null && s !== null && s !== "" && Number.isFinite(+s)) {
    let segments = null;
    try { segments = JSON.parse(ag); } catch (e) { /* not an agenda after all */ }
    if (Array.isArray(segments)) {
      const clean = segments.filter(
        (seg) => seg && typeof seg.label === "string" && typeof seg.minutes === "number" && seg.minutes > 0
      );
      if (clean.length) {
        const start = +s;
        let acc = 0;
        const bounds = clean.map((seg) => (acc += seg.minutes * 60000));
        const total = bounds[bounds.length - 1];
        const elapsed = at - start;
        // -2: not started yet (a create_agenda start_at still ahead of us).
        // Mirrors app.js's computeAgendaState() exactly — see that
        // function's own comment for why every bound being positive would
        // otherwise make a negative elapsed resolve to idx 0 (mid-segment-1)
        // instead of a distinct "hasn't begun" state.
        const idx = elapsed < 0 ? -2 : bounds.findIndex((b) => elapsed < b);
        return {
          kind: "agenda",
          segments: clean,
          start,
          startsAt: new Date(start).toISOString(),
          // Unchanged formula, still correct for elapsed < 0: total - elapsed
          // then reads as "time from now until the run finishes", which
          // includes however long is left before it even starts.
          remainingSeconds: Math.max(0, Math.round((total - elapsed) / 1000)),
          totalSeconds: Math.round(total / 1000),
          currentIndex: idx,
          started: elapsed >= 0,
          finished: idx === -1,
          ...(idx === -2 ? { startsInSeconds: Math.round(-elapsed / 1000) } : {}),
        };
      }
    }
    return null;
  }

  const t = p.get("t");
  if (t !== null && t !== "" && Number.isFinite(+t)) {
    const end = +t;
    const remaining = Math.round((end - at) / 1000);
    return {
      kind: "share",
      label,
      endsAt: new Date(end).toISOString(),
      remainingSeconds: Math.max(0, remaining),
      expired: remaining <= 0,
    };
  }
  const forRaw = p.get("for");
  if (forRaw) {
    const seconds = parseDuration(forRaw);
    if (seconds !== null && seconds > 0) {
      return { kind: "setup", label, durationSeconds: seconds };
    }
  }
  return null;
}

/* Mirrors app.js's labelFromHash(): read the raw param and decode exactly
   once. URLSearchParams.get() would decode "+" to a space and mangle labels
   like "C++ review"; decoding a value it had already decoded is what used to
   throw URIError on a label containing a literal %. */
export function labelOf(hashStr) {
  const m = String(hashStr == null ? "" : hashStr).replace(/^#/, "").match(/(?:^|&)l=([^&]*)/);
  if (!m) return "";
  try { return decodeURIComponent(m[1]); } catch (e) { return m[1]; }
}

/* ---------------------------------------------------------------------------
 * Tool definitions
 * ------------------------------------------------------------------------- */

const DURATION_DESC =
  'How long the timer runs. Accepts "25m", "1h30m", "90s", "5:00", "1:30:00", ' +
  'or a plain number read as minutes ("45"). Maximum 99h59m59s.';

export const TOOLS = [
  {
    name: "create_timer",
    title: "Create a shared countdown timer",
    description:
      "Create a CountLink shared countdown timer and return its link. Everyone who opens the " +
      "link sees the identical countdown, to the same second — no account, no sign-up, any " +
      "number of viewers. Use this whenever someone wants a timer several people or several " +
      "screens need to share: a classroom, an exam, a standup, a workshop, a webinar countdown, " +
      "a stream overlay, or a countdown embedded on someone's own website or landing page (e.g. " +
      "\"10 days until launch\"). By default it returns a setup link, which opens the board " +
      "preloaded at the requested duration for the user to start themselves; pass start_now: " +
      "true only if they want the countdown running from this moment. Whenever the result has a " +
      "fixed end instant (start_now or embed_on_website), structuredContent.ics is an .ics " +
      "calendar file for it — offer it if the person might want the deadline on their calendar.",
    inputSchema: {
      type: "object",
      properties: {
        duration: { type: "string", description: DURATION_DESC },
        label: {
          type: "string",
          description:
            "Optional name shown on the board, e.g. \"Exam\" or \"Break\". Keep it short.",
        },
        start_now: {
          type: "boolean",
          description:
            "False (default) returns a setup link the user starts themselves — correct for a " +
            "timer that should begin later, and for anything being written down in advance. " +
            "True returns a link for a countdown already running from now, fixed to one instant " +
            "so every viewer is in sync; only use it when the timer should start immediately.",
          default: false,
        },
        for_obs_overlay: {
          type: "boolean",
          description:
            "True returns a URL to paste into OBS (or any streaming tool) as a Browser Source: " +
            "a transparent background with just the digits, which starts counting as soon as the " +
            "scene loads. Use it when someone wants a countdown on their stream. Do not give an " +
            "overlay URL to several people to open — it starts fresh for whoever loads it; for " +
            "that, call this again without the flag and share that link instead. Mutually " +
            "exclusive with embed_on_website.",
          default: false,
        },
        embed_on_website: {
          type: "boolean",
          description:
            "True returns ready-to-paste <iframe> HTML for embedding a countdown on someone's " +
            "OWN website or landing page — e.g. a launch-day countdown on a marketing page. " +
            "Unlike for_obs_overlay, this is a fixed instant every visitor to that page sees " +
            "identically (not a per-visitor restart), and free with no watermark option — the " +
            "only requirement is a small attribution line under the widget linking back to " +
            "CountLink, which the returned HTML already includes. Use this whenever someone asks " +
            "for a countdown to put ON their own site/page, as opposed to a link to share with " +
            "other people directly. Mutually exclusive with for_obs_overlay.",
          default: false,
        },
        embed_width: {
          type: "number",
          description:
            `Pixel width of the embedded iframe when embed_on_website is true. ${EMBED_W_MIN}–${EMBED_W_MAX}, default ${EMBED_W_DEFAULT}. Ignored otherwise.`,
        },
        embed_height: {
          type: "number",
          description:
            `Pixel height of the embedded iframe when embed_on_website is true. ${EMBED_H_MIN}–${EMBED_H_MAX}, default ${EMBED_H_DEFAULT}. Ignored otherwise.`,
        },
        embed_style: {
          type: "string",
          enum: [...EMBED_STYLES],
          description:
            'Board style for embed_on_website: "board" (default, dark split-flap), "minimal" ' +
            "(plain digits) or \"light\". Ignored otherwise.",
        },
      },
      required: ["duration"],
    },
    // Pure URL construction against a static site: no state is created
    // anywhere, nothing is mutated, and calling it twice is free.
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "create_agenda",
    title: "Create a chained agenda of timed segments",
    description:
      "Create a CountLink agenda: an ordered sequence of named, timed segments (intro, talk, " +
      "break, Q&A) that starts now and advances from one to the next on its own, on every screen " +
      "that opens the link, with no server involved. Use this when someone describes a meeting, " +
      "workshop, lesson or event as a sequence of parts with lengths — including when they give " +
      "you a total and a list of topics and expect you to split it (\"an hour, four topics\"): do " +
      "the split yourself, then pass the resulting segments here. By default it starts immediately; " +
      "pass start_at for something scheduled ahead (\"our workshop starts at 9:15 tomorrow\") — the " +
      "link works right away, showing a live countdown to the start rather than the first segment, " +
      "and switches over on its own at the scheduled instant, in sync on every screen that opened " +
      "it. Returns the shared link plus a run sheet with the wall-clock start and end of each " +
      "segment, and an .ics calendar file (one event per segment) in structuredContent.ics — offer " +
      "it if the person might want the agenda on their calendar. For a single countdown use " +
      "create_timer instead.",
    inputSchema: {
      type: "object",
      properties: {
        segments: {
          type: "array",
          minItems: 1,
          maxItems: AGENDA_MAX_SEGMENTS,
          description:
            "The segments in running order. Each has a duration (same grammar as create_timer: " +
            "\"10m\", \"1h\", \"90s\", \"5:00\", or a plain number of minutes) and an optional short " +
            `label. 1–${AGENDA_MAX_SEGMENTS} segments; the whole agenda must fit in 99h59m59s.`,
          items: {
            type: "object",
            properties: {
              duration: { type: "string", description: DURATION_DESC },
              label: {
                type: "string",
                description: "Optional name for the segment, e.g. \"Intro\" or \"Break\". Keep it short.",
              },
            },
            required: ["duration"],
          },
        },
        start_at: {
          type: "string",
          description:
            "Optional ISO-8601 instant for a scheduled start, e.g. \"2026-09-08T09:15:00Z\" or with a " +
            "local offset like \"2026-09-08T09:15:00+01:00\". Omit to start immediately. A start_at " +
            "already in the past is just treated as already running from that instant.",
        },
      },
      required: ["segments"],
    },
    // Same story as create_timer: the agenda is encoded entirely in the URL,
    // so nothing is created or stored anywhere by calling this.
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "create_badge",
    title: "Create a countdown badge for a README, forum post or similar",
    description:
      "Create a countdown badge — a small image, not an <iframe> — for places embed_on_website's " +
      "iframe cannot go: a GitHub README, a forum signature, a Notion page, anywhere only plain " +
      "Markdown or a bare <img> is allowed. Shows coarse time remaining (e.g. \"3d 04h left\", not " +
      "a live ticking clock — most places that embed images fetch and cache them server-side, so " +
      "a promise of live ticking would be false) and links through to the real, precise, live " +
      "countdown. Returns both a Markdown snippet and an HTML snippet; use whichever the " +
      "destination accepts. Always returns the image wrapped in a link to the live countdown — " +
      "never ask for or produce just the bare image, since the link is what makes this a genuine " +
      "attribution rather than an untethered picture.",
    inputSchema: {
      type: "object",
      properties: {
        duration: { type: "string", description: DURATION_DESC },
        label: {
          type: "string",
          description: "Optional short name shown on the badge, e.g. \"Launch\" or \"CFP closes\".",
        },
        badge_style: {
          type: "string",
          enum: ["board", "minimal", "light"],
          description:
            'Visual style: "board" (default, dark), "minimal" (no background — blends into any ' +
            'page) or "light".',
        },
      },
      required: ["duration"],
    },
    // The image is fetched by whatever renders the README/page, not by
    // calling this tool — this call itself only computes a URL and a
    // fixed instant, same as create_timer and create_agenda.
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "describe_timer_link",
    title: "Explain a CountLink link",
    description:
      "Given a countlink.app URL, say what it encodes: whether it is a running countdown or a " +
      "not-yet-started setup link, its label, and how much time is left. Use it when someone " +
      "pastes a CountLink link and asks what it is or when it ends.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "A countlink.app timer URL." },
      },
      required: ["url"],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
];

/* ---------------------------------------------------------------------------
 * Tool execution
 *
 * Bad input from a model is a TOOL error (isError: true, with a message it can
 * read and retry from), not a JSON-RPC protocol error — per the MCP spec, and
 * because a protocol error tends to surface to the user as a broken app rather
 * than as "I need a duration".
 * ------------------------------------------------------------------------- */
export function callTool(name, args, now) {
  const a = args && typeof args === "object" ? args : {};

  if (name === "create_timer") {
    const seconds = parseDuration(a.duration);
    if (seconds === null || seconds <= 0) {
      return toolError(
        `Could not read ${JSON.stringify(String(a.duration ?? ""))} as a duration. ` +
          'Try "25m", "1h30m", "90s", "5:00" or a plain number of minutes like "45".'
      );
    }
    const label = typeof a.label === "string" ? a.label.trim().slice(0, 60) : "";
    const overlay = a.for_obs_overlay === true;
    const embed = a.embed_on_website === true;
    if (overlay && embed) {
      return toolError(
        "for_obs_overlay and embed_on_website are mutually exclusive — pick one. Use " +
          "for_obs_overlay for a single OBS/streaming Browser Source; use embed_on_website for " +
          "an <iframe> on someone's own web page."
      );
    }

    if (embed) {
      const style = EMBED_STYLES.has(a.embed_style) ? a.embed_style : "board";
      const src = embedTargetUrl(seconds, label, now, style);
      const { html, width, height } = embedSnippet(src, label, a.embed_width, a.embed_height);
      const pretty = humanDuration(seconds);
      // The same fixed instant embedTargetUrl() just minted into the #t= it
      // emitted — recomputed rather than parsed back out of `src`, since the
      // arithmetic (now + clampSeconds(seconds)*1000) is one line either way.
      const nowMs = typeof now === "number" ? now : Date.now();
      const endMs = nowMs + clampSeconds(seconds) * 1000;
      // DTSTAMP must be a real instant, not the raw `now` argument — that is
      // `undefined` on every real production call (only the tests pass a
      // fixed one), and new Date(undefined) is an Invalid Date, which
      // rendered as a live DTSTAMP:NaNNaNNaNTNaNNaNNaNZ before this fix.
      const ics = buildIcs([{ uid: icsUid(endMs, label), summary: label || "CountLink countdown", startMs: endMs, endMs, url: src }], nowMs);
      const text =
        `Here is a ${pretty} countdown${label ? ` called "${label}"` : ""} to embed on a ` +
        `website, as an <iframe>:\n\n${html}\n\n` +
        `Paste that HTML wherever the countdown should appear. It counts down to one fixed ` +
        `instant, so every visitor to that page sees the same time remaining — it does not ` +
        `restart per visitor. It is free with no watermark option; the small "Shared countdown ` +
        `by CountLink" line under it is the only requirement, and it's a genuine link back to ` +
        `CountLink rather than tracking of any kind — please don't ask for it to be removed or ` +
        `hidden with CSS, that would be misrepresenting where the widget came from.`;
      return {
        content: [{ type: "text", text }],
        structuredContent: {
          url: src,
          iframeHtml: html,
          durationSeconds: seconds,
          duration: pretty,
          label,
          width,
          height,
          style,
          embed: true,
          ics,
        },
      };
    }

    // An overlay always starts itself, so start_now is meaningless alongside
    // it — honour the overlay rather than minting a #t= that OBS would reload
    // into an already-expired deadline on the next scene change.
    const startNow = !overlay && a.start_now === true;
    // Computed once here (rather than parsed back out of `url` below) so the
    // .ics branch has the same fixed instant shareUrl() encodes into #t=,
    // without re-deriving it from a string.
    const nowMs = typeof now === "number" ? now : Date.now();
    const endMs = nowMs + clampSeconds(seconds) * 1000;
    const url = overlay
      ? setupUrl(seconds, label, { overlay: true })
      : startNow
        ? shareUrl(seconds, label, now)
        : setupUrl(seconds, label);
    const pretty = humanDuration(seconds);

    const text = overlay
      ? `Here is a ${pretty} countdown overlay for OBS${label ? ` called "${label}"` : ""}:\n\n${url}\n\n` +
        `In OBS: Sources → + → Browser, paste that URL, and set the size (400×160 is a good ` +
        `start). It has a transparent background, so only the digits sit on the scene — no green ` +
        `screen needed — and it starts counting as soon as the scene loads. To let a mod or ` +
        `co-streamer watch the same countdown on their own screen, ask for a regular shared ` +
        `timer instead; an overlay link restarts for whoever opens it.`
      : startNow
        ? `Started a ${pretty} countdown${label ? ` called "${label}"` : ""}. Share this link — ` +
          `every screen that opens it shows the same countdown, ending at the same instant:\n\n${url}`
        : `Here is a ${pretty} shared timer${label ? ` called "${label}"` : ""}:\n\n${url}\n\n` +
          `Opening it shows the board already set to ${pretty}. Press start, then share the link ` +
          `it gives you — everyone who opens that sees the identical countdown, to the second.`;

    // Same rule as the embed branch above: only a real fixed end instant is
    // worth a calendar entry. A plain setup link has no date yet (nothing
    // pressed), and an overlay's whole point is restarting per viewer — the
    // opposite of a single event with a fixed time.
    const ics = startNow
      ? buildIcs([{ uid: icsUid(endMs, label), summary: label || "CountLink countdown", startMs: endMs, endMs, url }], nowMs)
      : null;

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        url,
        durationSeconds: seconds,
        duration: pretty,
        label,
        started: startNow,
        overlay,
        ...(ics ? { ics } : {}),
      },
    };
  }

  if (name === "create_agenda") {
    const norm = normaliseAgendaSegments(a.segments);
    if (norm.error) return toolError(norm.error);
    const nowMs = typeof now === "number" ? now : Date.now();
    let start = nowMs;
    if (a.start_at !== undefined && a.start_at !== null && a.start_at !== "") {
      const parsed = Date.parse(a.start_at);
      if (!Number.isFinite(parsed)) {
        return toolError(
          `Could not read ${JSON.stringify(String(a.start_at))} as a date/time. Use ISO-8601, e.g. ` +
            `"2026-09-08T09:15:00Z" or "2026-09-08T09:15:00+01:00".`
        );
      }
      start = parsed;
    }
    const willStartLater = start > nowMs;
    const url = agendaUrl(norm.segments, start);
    const sheet = agendaRunSheet(norm.segments, start);
    const total = humanDuration(norm.totalSeconds);

    // Offsets from the start rather than wall-clock times in the prose: the
    // assistant relaying this may be talking to people in several time zones,
    // and the page itself renders each viewer's local time. The ISO instants
    // are in structuredContent for anything that wants to localise them.
    const fmtOffset = (ms) => {
      const s = Math.round(ms / 1000);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
      const mm = String(m).padStart(2, "0"), ss = String(sec).padStart(2, "0");
      return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    };
    const lines = sheet.map((r) =>
      `${r.n}. ${r.label} — ${humanDuration(Math.round(r.minutes * 60))} (from ${fmtOffset(r.startsAt - start)} to ${fmtOffset(r.endsAt - start)})`
    );
    // One VEVENT per segment, all sharing the one agenda link — a calendar
    // that lists "Intro 09:00–09:10, Talk 09:10–09:40, Q&A 09:40–09:50" is
    // more useful than one event spanning the whole agenda with no internal
    // structure.
    // DTSTAMP needs the resolved `start`, not the raw `now` argument — that
    // is `undefined` on every real production call (only the tests pass a
    // fixed one), and new Date(undefined) renders as a live, broken
    // DTSTAMP:NaNNaNNaNTNaNNaNNaNZ. Same bug, same fix, as create_timer's
    // two .ics call sites above.
    const ics = buildIcs(sheet.map((r) => ({
      uid: icsUid(r.endsAt, `${start}-${r.n}-${r.label}`),
      summary: r.label,
      startMs: r.startsAt,
      endMs: r.endsAt,
      url,
    })), start);

    const text = willStartLater
      ? `Scheduled a ${total} agenda with ${sheet.length} segment${sheet.length === 1 ? "" : "s"}, ` +
        `starting at ${new Date(start).toISOString()} (in ${humanDuration(Math.round((start - nowMs) / 1000))}). ` +
        `Share this link now — every screen that opens it shows a live countdown to the start, then ` +
        `switches over and advances through every segment together, at the same moment on every ` +
        `screen:\n\n${url}\n\nRunning order (times are from the start):\n${lines.join("\n")}\n\n` +
        `Its order is locked in once scheduled; to change it, create a fresh one.`
      : `Started a ${total} agenda with ${sheet.length} segment${sheet.length === 1 ? "" : "s"}. ` +
        `Share this link — every screen that opens it shows the same segment at the same moment and ` +
        `advances on its own:\n\n${url}\n\nRunning order (times are from the start):\n${lines.join("\n")}\n\n` +
        `The agenda is already running from now; its order is locked in for this run. To change it, ` +
        `create a fresh one.`;

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        url,
        start,
        startsAt: new Date(start).toISOString(),
        started: !willStartLater,
        ...(willStartLater ? { startsInSeconds: Math.round((start - nowMs) / 1000) } : {}),
        totalSeconds: norm.totalSeconds,
        total,
        segments: norm.segments,
        ics,
        runSheet: sheet.map((r) => ({
          n: r.n,
          label: r.label,
          minutes: r.minutes,
          startsAt: new Date(r.startsAt).toISOString(),
          endsAt: new Date(r.endsAt).toISOString(),
        })),
      },
    };
  }

  if (name === "create_badge") {
    const seconds = parseDuration(a.duration);
    if (seconds === null || seconds <= 0) {
      return toolError(
        `Could not read ${JSON.stringify(String(a.duration ?? ""))} as a duration. ` +
          'Try "25m", "1h30m", "90s", "5:00" or a plain number of minutes like "45".'
      );
    }
    const label = typeof a.label === "string" ? a.label.trim().slice(0, 60) : "";
    const style = EMBED_STYLES.has(a.badge_style) ? a.badge_style : "board";
    // Same fixed-instant #t= rule as embed_on_website, and for the same
    // reason: a README or forum post has many readers who must all see the
    // same deadline, never a #for=&go=1 link that would restart per reader.
    const endMs = (typeof now === "number" ? now : Date.now()) + clampSeconds(seconds) * 1000;
    const pageUrl = shareUrl(seconds, label, now);
    let badgeUrl = `${SITE_URL}/badge.svg?t=${endMs}`;
    if (label) badgeUrl += `&l=${encodeURIComponent(label)}`;
    if (style !== "board") badgeUrl += `&style=${style}`;
    const alt = label || "CountLink countdown";
    const markdown = `[![${escapeMarkdownAlt(alt)}](${badgeUrl})](${pageUrl})`;
    const html = `<a href="${pageUrl}"><img src="${badgeUrl}" alt="${escapeHtmlAttr(alt)}"></a>`;
    const pretty = humanDuration(seconds);
    const text =
      `Here is a ${pretty} countdown badge${label ? ` called "${label}"` : ""} for a README, ` +
      `forum post or anywhere only an image is allowed:\n\nMarkdown:\n${markdown}\n\nHTML:\n${html}\n\n` +
      `It shows coarse time remaining (e.g. "${badgeTimeTextPreview(seconds)}") rather than a live ` +
      `tick — most places that embed images fetch and cache them, so a live-ticking promise would ` +
      `be false — and links through to the real, precise, live countdown. Keep the link wrapped ` +
      `around the image; that link is what makes this a genuine attribution rather than a bare picture.`;
    return {
      content: [{ type: "text", text }],
      structuredContent: {
        badgeUrl,
        pageUrl,
        markdown,
        html,
        durationSeconds: seconds,
        duration: pretty,
        label,
        style,
      },
    };
  }

  if (name === "describe_timer_link") {
    const info = describeUrl(a.url, now);
    if (!info) {
      return toolError(
        "That does not look like a CountLink timer link. A timer link carries the countdown in " +
          "its #, e.g. https://countlink.app/#for=25m or https://countlink.app/#t=1757000000000."
      );
    }
    if (info.kind === "agenda") {
      const n = info.segments.length;
      const plural = n === 1 ? "" : "s";
      const cur = info.currentIndex >= 0 ? info.segments[info.currentIndex] : null;
      const text = info.finished
        ? `An agenda of ${n} segment${plural} (${humanDuration(info.totalSeconds)} in total) that has ` +
          `already finished — it started at ${info.startsAt}.`
        : info.currentIndex === -2
          ? `An agenda of ${n} segment${plural} (${humanDuration(info.totalSeconds)} in total) scheduled ` +
            `to start at ${info.startsAt}, in ${humanDuration(info.startsInSeconds)}. Not running yet — ` +
            `every screen with this link is showing a countdown to the start, not a segment.`
          : `A running agenda of ${n} segment${plural}, ${humanDuration(info.totalSeconds)} in total, started ` +
            `at ${info.startsAt}. Currently on segment ${info.currentIndex + 1}` +
            `${cur.label ? ` ("${cur.label}")` : ""}, with ${humanDuration(info.remainingSeconds)} left in the ` +
            `whole agenda. Every screen with this link agrees on where it is.`;
      return { content: [{ type: "text", text }], structuredContent: info };
    }
    const named = info.label ? ` labelled "${info.label}"` : "";
    const text =
      info.kind === "setup"
        ? `A setup link${named}: it opens a board preloaded at ${humanDuration(info.durationSeconds)}, ` +
          `ready but not started. Whoever opens it presses start.`
        : info.expired
          ? `A countdown${named} that has already finished — it ended at ${info.endsAt}.`
          : `A running countdown${named} with ${humanDuration(info.remainingSeconds)} left. ` +
            `It ends at ${info.endsAt}, and every screen with this link agrees on that instant.`;
    return { content: [{ type: "text", text }], structuredContent: info };
  }

  return null; // unknown tool — the caller turns this into a protocol error
}

function toolError(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

/* ---------------------------------------------------------------------------
 * JSON-RPC
 * ------------------------------------------------------------------------- */

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message, data) => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

/**
 * Handle one JSON-RPC message. Returns the response object, or null for a
 * notification (which by spec gets no response body at all).
 */
export function handleRpc(msg, now) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
    return err(null, -32600, "Invalid Request");
  }
  const { method, params, id } = msg;
  const isNotification = id === undefined || id === null;

  // Notifications are fire-and-forget; notifications/initialized is the one
  // that actually arrives in practice.
  if (isNotification) return null;

  switch (method) {
    case "initialize": {
      const requested = params && params.protocolVersion;
      const version = SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0];
      return ok(id, {
        protocolVersion: version,
        // listChanged:false — the tool list is a constant in this file, so
        // there is nothing to notify about, and claiming otherwise would
        // promise a notification that never comes.
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, title: "CountLink", version: SERVER_VERSION },
        instructions:
          "CountLink makes shared countdown timers: one link, and every screen that opens it " +
          "shows the identical countdown to the same second, with no account and no viewer " +
          "limit. Call create_timer whenever someone needs a timer other people will watch " +
          "too, and give them the link it returns. Call create_agenda when they describe a " +
          "sequence of timed parts — a meeting agenda, a workshop, a lesson — and it returns one " +
          "link that advances through every segment on every screen; pass start_at for one " +
          "scheduled ahead rather than starting now. Call create_badge instead of " +
          "create_timer's embed_on_website when the destination only accepts an image, not an " +
          "<iframe> — a GitHub README, a forum post, anywhere Markdown-style embeds live.",
      });
    }

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, { tools: TOOLS });

    case "tools/call": {
      const name = params && params.name;
      const result = callTool(name, params && params.arguments, now);
      if (result === null) return err(id, -32602, `Unknown tool: ${name}`);
      return ok(id, result);
    }

    // Declared unsupported rather than silently 404ing, so a client probing
    // for them gets a clean answer instead of a transport-level failure.
    case "resources/list":
      return ok(id, { resources: [] });
    case "prompts/list":
      return ok(id, { prompts: [] });

    default:
      return err(id, -32601, `Method not found: ${method}`);
  }
}

/* ---------------------------------------------------------------------------
 * HTTP shell
 * ------------------------------------------------------------------------- */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  // MCP-Protocol-Version is sent by spec-compliant clients on every request
  // after initialize; omitting it here makes the browser preflight fail.
  "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Authorization",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // A plain GET is what a person (or a health check) does with the URL. The
  // streamable HTTP transport uses GET for a server-initiated SSE stream,
  // which this server never needs — it has nothing unprompted to say — so
  // answer with something a human can read rather than opening a dead stream.
  if (request.method === "GET") {
    return json({
      name: SERVER_NAME,
      description:
        "CountLink MCP server. POST JSON-RPC 2.0 to this URL to create shared countdown timers.",
      protocolVersions: SUPPORTED_PROTOCOLS,
      tools: TOOLS.map((t) => t.name),
      docs: `${SITE_URL}/how-it-works`,
      // The machine-readable contract: URL grammar, every tool, and the
      // OBS-vs-website rule. An agent probing this endpoint should land
      // there, not only on a page written for people.
      llms: `${SITE_URL}/llms.txt`,
    });
  }

  if (request.method !== "POST") {
    return json(err(null, -32600, "Use POST for JSON-RPC, or GET for server info."), 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json(err(null, -32700, "Parse error"), 400);
  }

  // A batch is a JSON array. Notifications inside it produce no response, and
  // a batch of nothing but notifications gets 202 with no body.
  if (Array.isArray(payload)) {
    const out = payload.map((m) => handleRpc(m)).filter((r) => r !== null);
    if (!out.length) return new Response(null, { status: 202, headers: CORS });
    return json(out);
  }

  const res = handleRpc(payload);
  if (res === null) return new Response(null, { status: 202, headers: CORS });
  return json(res);
}
