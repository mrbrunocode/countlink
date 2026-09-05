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
      "true only if they want the countdown running from this moment.",
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
        },
      };
    }

    // An overlay always starts itself, so start_now is meaningless alongside
    // it — honour the overlay rather than minting a #t= that OBS would reload
    // into an already-expired deadline on the next scene change.
    const startNow = !overlay && a.start_now === true;
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

    return {
      content: [{ type: "text", text }],
      structuredContent: {
        url,
        durationSeconds: seconds,
        duration: pretty,
        label,
        started: startNow,
        overlay,
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
          "too, and give them the link it returns.",
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
