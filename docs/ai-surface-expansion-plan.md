# Plan: deepen the agent-facing surface (the moat nobody else has)

Written 2026-09-05, for handoff to whoever implements it. Read
`docs/monetization.md` and `docs/mcp-submission.md` first — this plan is the
direct continuation of both.

## The thesis, in one paragraph

Two independent competitor audits (2026-08-23, 2026-08-26 — see
`countlink-competitor-feature-audit-2026-08-23` and
`countlink-remaining-competitor-research-2026-08-26` in project memory) found
CountLink already matches or beats every real competitor (TickCounter,
CountdownShare, Stagetimer, ShareMyTimer, Leaderboarded, vClock,
online-stopwatch.com) on user-facing features. Chasing further parity there
is a dead end. What's *not* matched: **not one of them has an MCP server or
any AI-assistant integration**, confirmed by search 2026-09-05, even though
Stagetimer (the most feature-rich, paid) has a plain REST API. CountLink's
`/mcp` (shipped 2026-09-05, `create_timer` + `describe_timer_link`, plus
`embed_on_website`) is a genuine, currently-unclaimed lead in this specific
category — and it's aimed at the one channel already proven to send real,
engaged traffic (AI referral is CountLink's single largest real channel; see
`indexation-wall-and-chatgpt-channel` and `bing-ai-performance-and-keyword-
findings`). Every item below either deepens that lead or is a small, cheap,
verified-not-already-done add-on. Nothing here is feature-parity busywork.

## Non-negotiable constraints (read before writing any code)

These are settled decisions, not open questions — don't re-litigate them:

1. **No new timer *types*.** Polls, turn-trackers, quiz buzzers, anything
   that isn't a countdown/stopwatch is explicitly out of scope — it dilutes
   the "one narrow tool" identity `/about` states in its own voice. If
   there's a real idea in that direction, it's a separate app under the
   factory model, not a CountLink feature.
2. **No accounts, no login, no persistent backend, no per-user storage.**
   The zero-cost static architecture (plus the limited Cloudflare Functions
   surface `/mcp` already established as acceptable) is load-bearing for the
   whole economics of this project. A Slack/Discord bot, a hosted reminder
   service, anything needing a database — don't build it here.
3. **Never charge for viewers or timer count**, if a paid angle ever comes up
   from any of this. Unlimited-everything-for-free is the actual competitive
   edge (see `docs/monetization.md`); metering it away sells off the moat.
4. **A setup link never auto-starts** except the single existing `&go=1`
   OBS-overlay exception. Any new tool must not create a second way to mint
   a per-visitor "evergreen countdown" — that's the exact anti-pattern
   CountLink exists not to be (see the CountdownShare comparison).
5. **Match the existing quality bar, not a lighter one.** This codebase has
   279 unit tests + 255 e2e tests as of this plan, a documented convention of
   explaining *why* in comments (not just what), HTML-escaping discipline
   anywhere untrusted text lands in markup rather than a URL, and a habit of
   verifying claims against the live competitor/product rather than assuming
   (see `functions/mcp.js`'s `escapeHtmlAttr`, and the whole of
   `test/mcp-server.test.mjs` for the expected shape of new tests). Whoever
   implements this should read that file's test style before writing the
   first test for a new tool — the bar is "would this test have caught the
   labelFromHash crash bug," not "does the happy path pass."
6. **Verify live, not just in `node --test`.** Every prior ship in this
   project confirms behaviour against the actual deployed URL (curl,
   browser automation, or both) before calling something done. Do the same
   here — a passing unit test suite is necessary, not sufficient.

## Phase 1 — ship first, zero new infrastructure

Both of these are pure extensions of `create_timer`'s existing pattern (a
new boolean flag, a new pure helper function, cross-checked tests) — no new
architecture, same shape as `embed_on_website`.

### 1a. Natural-language agenda splitting

**The gap:** `agenda-timer.html` already exists and does chained/sequential
timers, but only via manual setup on the page. An assistant asked "I have a
1-hour meeting, 4 topics" has to do the arithmetic itself and can't currently
hand back a working agenda link — exactly the shape of task an LLM is good
at and CountLink currently can't receive.

**Design sketch:**
- A new tool, `create_agenda` (or a flag on `create_timer` if the schema
  stays clean enough — decide based on how much the parameter surface would
  bloat one tool vs. two; either is fine, consistency with existing patterns
  matters more than which).
- Input: a list of `{label, duration}` segments (the model does the "split
  1 hour into 4 topics" reasoning; this tool just encodes the result), plus
  optional `start_now`.
- Reuse the agenda page's existing hash encoding — check
  `encodeAgendaHash`/`parseAgendaHash` in `assets/app.js` (search that name;
  it's referenced in `test/agenda.test.mjs`) and mirror it in `functions/
  mcp.js` the same way `embedTargetUrl` mirrors `shareUrl`, with the same
  "second implementation + cross-check corpus" test discipline already used
  for the duration grammar.
- Validate: segment count and total duration have real limits (check what
  the board can actually render — see `MAX_SECONDS` in `functions/mcp.js`
  and whatever the agenda page's own practical limit is) and return a tool
  error, not a broken link, past them.

**Acceptance bar:** a full JSON-RPC round trip against the real dev server
producing a link that `app.js`'s own agenda parser boots correctly — same
proof-of-life standard as the `/mcp` ship (curl the endpoint, then open the
resulting URL in a browser and confirm the segments actually render and
advance).

### 1b. Calendar (.ics) export alongside a link

**The gap, honestly stated:** this is **parity, not differentiation** —
101Planners and others already offer calendar export. Still worth doing:
cheap (pure string generation, no new infra), and directly useful on the
webinar/standup/exam pages this site already targets.

**Design sketch:**
- A pure function building a minimal RFC 5545 `.ics` string from
  `{summary, startISO, endISO}` — no external service, no library needed for
  something this small.
- Client-side: an "Add to calendar" link/button next to the existing "Show
  QR code" button, generating a `data:text/calendar` URI or a downloadable
  blob — check what actually works cross-browser/cross-calendar-app before
  committing to one mechanism (a naive `data:` URI is known to fail silently
  on some mobile calendar apps; verify on at least Google Calendar web +
  iOS Calendar before calling it done).
- MCP-side: fold it into `create_timer`'s response — when a countdown has a
  real end instant (`start_now: true` or `embed_on_website: true`), include
  an `.ics` string in `structuredContent` alongside the URL, so an assistant
  can offer both in one call without a second round-trip.

**Acceptance bar:** the generated `.ics` actually imports cleanly into at
least Google Calendar and Apple Calendar — test this by hand, not just by
eyeballing the RFC 5545 string.

## Phase 2 — bigger lever, needs an architecture discussion first

### 2a. A countdown badge (static/live image, not an iframe)

**The gap, checked 2026-09-05:** none of CountLink's real competitors offer
this — they're all iframe/website-widget shaped. It exists as a scattered
hobbyist niche elsewhere (GitHub README countdown badges), not as a polished
product anyone in this space ships. It would let a countdown live somewhere
an iframe structurally cannot: a GitHub README, a forum signature, a Notion
page, an email (with real caveats on that last one).

**Why this is Phase 2, not Phase 1:** it's the first feature that isn't
static-file-serving or pure string arithmetic — it needs a Cloudflare
Function that renders an image (SVG is the obvious choice: no raster
encoding needed, scales cleanly, can be built as a template string same as
the HTML in `embedSnippet`). `/mcp` already established Functions as
acceptable infrastructure, so this isn't a new *category* of cost, but it is
a bigger one, and it introduces a genuinely new failure mode (an image that
must re-render correctly on every request, cached appropriately, without
ever serving a stale countdown) — **don't start building without deciding
the caching strategy first** (an SVG with the client-side JS approach vs. a
server-computed static badge that only updates on refresh — these have very
different correctness and cost profiles, and the choice should be made
deliberately, not discovered mid-implementation).

**Scope for a first version:** a single new route (e.g. `/badge.svg`) taking
the same `#t=`/`#for=`-style parameters as a query string, returning an SVG
with the remaining time baked in at request time. No animation in v1 — a
GitHub README image refreshes on page load, not continuously, so a ticking
countdown is not achievable without JS (which most badge-hosting contexts
strip) and shouldn't be promised.

**A new MCP tool, `create_badge`**, mirroring `embed_on_website`'s shape:
takes a duration/label, returns the `<img src="...">` markdown/HTML plus the
same attribution requirement — this is the same backlink-compounding
mechanism as the website embed, reaching a different set of pages (READMEs,
forums) that an iframe can't.

**Acceptance bar:** verify the actual rendered SVG in multiple real contexts
before calling this done, not just that the endpoint returns 200 — at
minimum, embed it in a real GitHub README (a scratch repo is fine) and
confirm GitHub's own image proxy/caching doesn't break it, since GitHub
famously proxies and caches external images aggressively.

## Phase 3 — trivial, ship whenever, no infrastructure

### 3a. A printable QR poster mode

**The gap:** CountLink already has QR generation and already targets
physical classroom/exam spaces (`classroom-timer.html`, `exam-timer.html`).
No competitor found offers a dedicated print layout. This is pure CSS
(`@media print`) plus reusing the existing QR generation call — no new
architecture, no new tool needed on the MCP side (an assistant handing
someone a link already serves this; the poster mode is a human-facing
convenience, not an agent capability).

**Design sketch:** a "Print poster" action next to the existing QR button
that opens (or switches the current page into) a print-styled view: a large
QR code, the "starts at HH:MM" text, minimal chrome — check
`window.print()` plus a print stylesheet rather than a new page/route.

**Acceptance bar:** actually print it (to PDF is fine) and look at the
result — a print stylesheet that's never been printed is not verified.

## What this plan deliberately does not include

Re-litigating anything on the "deliberately skipped" list in
`countlink-competitor-feature-audit-2026-08-23` (themes, per-visitor
evergreen countdowns, CSV import/API/Stream Deck integrations, a paid Q&A
widget) or the architecture calls above (no accounts, no bot, no new timer
types). If a future session proposes one of these again, the answer is
already recorded — point back here and to that memory file rather than
re-deriving it.

## Suggested order

1a → 1b → 3a → 2a, roughly in that order: cheapest and most-differentiated
first (1a), cheapest-but-parity-only next (1b), a free trivial win whenever
(3a), and the one requiring a real architecture decision last (2a) — don't
let 2a block shipping the other three.
