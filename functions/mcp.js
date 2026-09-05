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
      "a stream overlay. By default it returns a setup link, which opens the board preloaded at " +
      "the requested duration for the user to start themselves; pass start_now: true only if " +
      "they want the countdown running from this moment.",
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
            "that, call this again without the flag and share that link instead.",
          default: false,
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
