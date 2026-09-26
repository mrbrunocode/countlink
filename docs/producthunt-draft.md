# Product Hunt launch draft (not yet posted)

Product Hunt requires signing in (LinkedIn/GitHub/X/Google/Facebook/Apple) even to save
a draft, so this couldn't be created directly in their system — paste this in once
you're signed in. Do not publish/launch without picking the day and being available to
reply to comments (see docs/seo-outreach-plan.md).

## Name
CountLink

## Tagline (60 char max)
One countdown. Every screen. Exactly in sync.

## Topics/categories
Productivity, Education, Web App

## Links
- Website: https://countlink.app
- Twitter/X: (none yet)

## First comment (maker comment, post immediately after launch)
_Updated 2026-09-26 — the original draft (Aug 3) predated join codes, phone control and
the MCP server; 2026-09-26 added clock correction, the offline app, local QR codes and
in-browser agent tools. Revise again if more time passes before the actual launch day._

Hey everyone 👋

I built CountLink because every "shared countdown" tool I found required an account,
a backend, or both — and the actual problem (a room, a class, or a remote team agreeing
on exactly how much time is left) doesn't need any of that.

Set a duration or a target time, copy the link, send it anywhere. The deadline is a
timestamp embedded in the URL itself, so every device that opens the link counts down
to the exact same instant — no signup, no timer server, no drift between devices.

A few things I focused on:
- A fullscreen "projector" mode for classrooms/exams/webinars, plus a mechanical
  split-flap board, a minimal flat-digit view, and a light theme for bright rooms
- A five-character join code (`countlink.app/j/K3M7Q`) for reading aloud or writing on
  a whiteboard when nobody can copy a URL off a projector
- Opt-in phone control — a second link that pauses, adds a minute, or flashes a message
  to every screen live, for the one-person-driving case, with no viewer cap. Only that
  link can drive it; the link you share with the room can only watch
- Clock correction — every screen checks its clock against a reference time and corrects
  it, so a classroom PC whose clock has drifted still shows the same second as
  everyone's phones
- An MCP server (`countlink.app/mcp`) so an AI assistant can mint a working timer, build
  a whole agenda from a meeting outline, or produce an embed — no other shared-timer
  tool has one, and it's turned out to be a bigger traffic source than Google search
- Completely free — the zero-backend architecture means one more viewer costs nothing

Would love feedback, especially from anyone who's dealt with the "wait, whose timer is
right?" problem in a classroom or meeting.

## Gallery / screenshots
Recaptured live 2026-09-26 in `docs/producthunt-gallery/` (see its README for the
exact capture method), and refreshed in `~/Desktop/countlink-producthunt/` for drag-and-drop upload — the upload
tool only accepts files shared into the session, not repo paths:
- [x] Homepage hero (`01-hero.png`) — headline, trust row, three-screens sync illustration
- [x] Running countdown (`02-running-board.png`) — the running row on one line, with the
      labelled alarm-tone picker
- [x] Comparison table (`03-compare.png`)
- [x] Features page (`04-features.png`) — 34 named features

## Description (long form)
CountLink is a free, no-signup shared countdown timer. Set a duration or a target time,
copy the generated link, and send it anywhere — Slack, email, a projector screen, a
webinar waiting room. Every device that opens the link counts down to the same instant,
computed from a timestamp embedded in the URL (each device's clock checked and corrected
first), so there's no account, no timer backend, and no drift between devices. Includes a fullscreen "projector" mode, three display styles (a
mechanical split-flap board, a minimal flat-digit view, and a light theme for projecting
in bright rooms), a sayable five-character join code as an alternative to the link, and
opt-in phone control for live pause/adjust/message without a viewer cap. Also ships an
MCP server so AI assistants can create and manage timers directly. Completely free, no
paid tier.
