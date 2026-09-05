# Submitting `/mcp` to OpenAI's plugin directory

Everything here is prepared and copy-pasteable. **The submission itself needs
Bruno** — it starts behind a login at platform.openai.com, and signing in (or
signing up) on someone's behalf is not something the assistant does. Nothing
below requires code changes; the endpoint is live and passing.

## Prerequisites

1. **Sign in / create an OpenAI account** at
   [platform.openai.com](https://platform.openai.com) with `mrbruno@gmail.com`.
   The submission portal is under the developer platform, not chatgpt.com.
2. There may be an org-verification step before submissions are enabled — if
   the portal asks for it, that's expected, not a sign anything is wrong.

## The endpoint (already live, already verified)

| Field | Value |
|---|---|
| MCP server URL | `https://countlink.app/mcp` |
| Transport | Streamable HTTP (JSON-RPC 2.0 over POST) |
| Protocol versions | `2025-06-18`, `2025-03-26`, `2024-11-05` |
| Authentication | **None.** No account, no API key, no OAuth. |
| Tools | `create_timer` (share links, OBS overlays, website `<iframe>` embeds via `embed_on_website: true`, and an `.ics` calendar file for any fixed-instant result), `create_agenda` (an ordered, auto-advancing sequence of timed segments — one link, an optional `start_at` for a scheduled start, plus a per-segment `.ics`), `create_badge` (a linked image badge for READMEs/forums, for where an iframe can't go), `describe_timer_link` (reads timers and agendas alike, scheduled-but-not-started included) |

No test credentials are needed — the "fully-featured demo account" requirement
only applies to authenticated servers, and this one has no auth at all. That
also clears the most common auto-rejection (requiring an extra login or new
signup).

## Directory metadata — paste these

**Name:** `CountLink`

*(A brand name, not a generic dictionary word — which is what the naming rule
asks for. Don't submit it as "Timer" or "Shared Timer".)*

**Short description:**

> Create a shared countdown timer that stays in sync on every screen — no
> account, no sign-up, any number of viewers.

**Longer description:**

> CountLink makes countdown timers that several people can watch at once.
> Ask for a timer and you get a link: everyone who opens it sees the identical
> countdown, ending on the same second, because the deadline is encoded in the
> link itself rather than kept on a server. There is no account, no sign-up and
> no limit on how many people can open it.
>
> It is built for the cases where a timer has to be shared rather than
> personal — a classroom or exam, a standup or workshop, a webinar countdown,
> a stream "starting soon" overlay. It can also return a transparent overlay
> URL to drop straight into OBS as a Browser Source.

**Category:** Productivity / Utilities *(pick whichever of these the form
offers; it is a utility, not a content or shopping app)*

**Support contact:** `hello@countlink.app`

**Privacy policy:** `https://countlink.app/privacy`
*(Updated 2026-09-05 with a section describing exactly what `/mcp` receives
and that it stores nothing — reviewers do check that the policy matches the
actual data flow.)*

**Terms:** `https://countlink.app/terms`

**Country availability:** all countries. Nothing here is region-specific.

**Screenshots: do not attach any.** Submitting screenshots for a plugin with
no UI component is listed as an automatic rejection.

## Testing guidelines — paste these as the test cases

Each is a prompt a reviewer can type, with what should happen.

1. **"Give me a 25 minute shared timer."**
   → calls `create_timer` with `duration: "25m"`; returns
   `https://countlink.app/#for=25m`. Opening it shows a board preloaded at
   25:00, ready to start.

2. **"I need a 90 second timer called Break."**
   → `create_timer` with `duration: "90s"`, `label: "Break"`; returns
   `https://countlink.app/#for=1m30s&l=Break`.

3. **"Start a 10 minute countdown now and give me the link to share."**
   → `create_timer` with `start_now: true`; returns a
   `https://countlink.app/#t=<epoch-ms>` link already counting down, fixed to
   one instant so every viewer agrees.

4. **"I want a countdown overlay for my OBS stream, 5 minutes."**
   → `create_timer` with `for_obs_overlay: true`; returns
   `https://countlink.app/embed/?overlay=1#for=5m&go=1`, a transparent
   Browser Source that starts when the scene loads.

5. **"Give me a countdown to embed on my landing page, 10 hours until launch."**
   → `create_timer` with `embed_on_website: true`; returns a ready-to-paste
   `<iframe>` snippet pointed at a fixed-instant `#t=` link (not the OBS
   `#for=…&go=1` shape — that would restart for every visitor), plus a small
   attribution paragraph outside the iframe.

5b. **"Set up my workshop: 10 min intro, 40 min exercise, 10 min debrief."**
   → `create_agenda` with three segments; returns one link on
   `https://countlink.app/timers/agenda-timer#ag=…&s=…` that starts now and
   advances through every segment on every screen, plus a run sheet listing
   each segment's start and end. Asking "what's this link?" on it afterwards
   → `describe_timer_link` reports which segment is live and how long is
   left overall.

5b2. **"Same workshop, but it starts at 9:15 tomorrow, not right now."**
   → `create_agenda` with `start_at` set; the link works immediately, showing
   a live "Starts soon" countdown to 9:15 tomorrow on every screen that opens
   it, then switches over to the agenda itself at that instant with no reload
   needed. Asking "what's this link?" before it starts → `describe_timer_link`
   reports it's scheduled, not running, and how long until it begins.

5c. **"Give me a badge for my GitHub README counting down to launch, 76 hours."**
   → `create_badge`; returns a Markdown snippet
   `[![Launch](https://countlink.app/badge.svg?t=…)](https://countlink.app/#t=…)`
   — the image always wrapped in a link to the live countdown — showing
   coarse time like "3d 04h left", never a live tick.

6. **"What is this link? https://countlink.app/#for=25m&l=Pomodoro"**
   → calls `describe_timer_link`; explains it is a not-yet-started setup link
   for 25 minutes, labelled Pomodoro.

6. **Error case — "make me a timer for ages."**
   → `create_timer` returns a tool error (not a crash) asking for a duration
   it can read, and suggests the accepted formats.

## Why this should qualify

Worth having to hand if the review comes back with questions:

- **It does something the model cannot do in the conversation.** ChatGPT can
  count, but it cannot put a live, ticking, identical countdown on a
  classroom projector and fifteen phones at once. That "not natively
  supported" test is the one countlink passes most clearly — and it is the
  same structural reason this site gets AI referral traffic when the other two
  apps in the family get none.
- **No login, no signup, no paywall, no trial.** Each of those is an explicit
  auto-rejection; the app has none of them.
- **Correct annotations.** Both tools are `readOnlyHint: true`,
  `destructiveHint: false`, `openWorldHint: false` — and that is honest, not
  defensive: there is no backend, so a call is pure string arithmetic over a
  duration and creates no state anywhere.
- **Owned IP**, no third-party service is being wrapped or impersonated.
- **Nothing in the prohibited categories.**

Honest risk, so it isn't a surprise: the most likely objection is *scope* —
two tools over a single small utility is a modest app, and directories often
favour richer integrations. That is a judgement call by the reviewer, not
something to pre-emptively pad the app for.

## After it is submitted

- Approval status is tracked in the same portal; publishing is a separate
  click once approved, so nothing goes live without Bruno.
- If it is rejected, the reason usually names a specific guideline — bring it
  back here and it can be addressed against `functions/mcp.js` directly.
- The endpoint works **now** as a custom MCP connector regardless of directory
  status: any MCP client (ChatGPT developer mode, Claude, an SDK) can point at
  `https://countlink.app/mcp` today. Directory listing is distribution, not
  function.
