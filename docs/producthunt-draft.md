# Product Hunt launch — draft is complete, just needs a date

**Status as of 2026-09-27: the listing itself is done.** A real Product Hunt
product page for CountLink already exists as a **Draft** (not scheduled, not
public beyond the direct link) — created 2026-08-03, kept current since. Every
field that can be filled in before launch day is filled in. All that's left is
picking a day and showing up to reply to comments.

- **Public page:** https://www.producthunt.com/products/countlink?launch=countlink
- **Edit page:** https://www.producthunt.com/posts/countlink/edit (you're the
  Owner/Admin — Bruno X, 1 follower)

Earlier versions of this doc said Product Hunt "requires signing in even to
save a draft, so this couldn't be created directly." That was wrong, or at
least incomplete — a draft product page evidently *can* be created and edited
ahead of time; only the account sign-in and the actual **Schedule launch**
click are the parts that must be Bruno, and only the second of those is
genuinely launch-day-only. Correcting the record here so the next read of
this file doesn't repeat the wrong premise.

## What's already filled in (verified live, 2026-09-27)

| Field | Value |
|---|---|
| Name | CountLink |
| Tagline | One countdown. Every screen. Exactly in sync. |
| Link | https://countlink.app |
| Description (500/500 chars, PH's hard limit) | See exact text below — do not exceed 500 chars if you edit it |
| Launch tags | Productivity, Education, Meetings |
| Pricing | Free |
| Gallery | 4 images (social-preview card + 3 screenshots) |
| Hunter | Bruno X (you) |
| Thumbnail | Auto-set from gallery image 1 |

**Live description (exactly what's in the field — 500/500 chars, don't add to it without cutting something):**

> A free, no-signup shared countdown timer. Set a duration or a target time,
> copy the link, and send it anywhere — Slack, email, a projector, a webinar
> waiting room. Every device that opens the link counts down to the same
> instant, because the deadline is a timestamp inside the URL rather than
> state on a server. That means no account, no backend, and no viewer limit —
> one more viewer costs nothing to serve. Includes a fullscreen projector mode
> and three display styles for bright rooms and streams.

(This is a tightened, 500-char version of the longer "Description (long
form)" copy further down this file — PH's field has a hard limit the long
form exceeds. If the site changes materially before launch, edit *this*
version, since it's the one that's actually live.)

**Gallery, in order (all 4 uploaded 2026-09-27):**
1. `producthunt-gallery/01-hero.png` — homepage hero (also the social-preview
   image PH uses when the link is shared)
2. `producthunt-gallery/02-running-board.png` — a live countdown
3. `producthunt-gallery/03-compare.png` — the comparison table
4. `producthunt-gallery/04-features.png` — the `/features` page

Left empty by choice, both optional and both fine to skip: **Video/Loom**
(no demo video exists) and **Interactive demo** (no Arcade/Storylane build
exists). Neither blocks scheduling. **Makers** field is also empty — add
nobody else there unless someone else genuinely worked on it; a solo Hunter
is normal.

**Re-verify before scheduling, not before:** gallery screenshots go stale as
CountLink ships features (see `docs/producthunt-gallery/README.md`'s own
recapture history — it's been redone twice already for exactly this reason).
If more than a few weeks pass between now and the launch date, recapture
with the command in that README and re-upload before clicking Schedule, not
after.

## The only two remaining steps — both Bruno, both launch day

### 1. Pick a day and schedule it

1. Open the edit page (link above) → **Schedule launch**.
2. Product Hunt launches run midnight–midnight Pacific time. Pick a day
   you can actually be online and replying to comments for most of it —
   that presence is the entire value of doing this live rather than just
   listing the site (see `docs/seo-outreach-plan.md` § Execution model:
   this step is deliberately kept human-required, not a capability gap).
3. Avoid major US holidays and try not to launch same-day as an
   obviously huge competing launch if you can help it — otherwise any
   weekday is fine; Tuesday–Thursday are the conventionally recommended
   days but this isn't load-bearing for a first-time, no-following launch.

### 2. Post the maker comment immediately after it goes live

Post this as the first comment on the launch, within minutes of it going
live (not before — it should be the top comment when people arrive):

---
Hey everyone 👋

I built CountLink because every "shared countdown" tool I found required an
account, a backend, or both — and the actual problem (a room, a class, or a
remote team agreeing on exactly how much time is left) doesn't need any of
that.

Set a duration or a target time, copy the link, send it anywhere. The
deadline is a timestamp embedded in the URL itself, so every device that
opens the link counts down to the exact same instant — no signup, no timer
server, no drift between devices.

A few things I focused on:
- A fullscreen "projector" mode for classrooms/exams/webinars, plus a
  mechanical split-flap board, a minimal flat-digit view, and a light theme
  for bright rooms
- A five-character join code (`countlink.app/j/K3M7Q`) for reading aloud or
  writing on a whiteboard when nobody can copy a URL off a projector
- Opt-in phone control — a second link that pauses, adds a minute, or
  flashes a message to every screen live, for the one-person-driving case,
  with no viewer cap. Only that link can drive it; the link you share with
  the room can only watch
- Clock correction — every screen checks its clock against a reference time
  and corrects it, so a classroom PC whose clock has drifted still shows the
  same second as everyone's phones
- An MCP server (`countlink.app/mcp`) so an AI assistant can mint a working
  timer, build a whole agenda from a meeting outline, or produce an embed —
  no other shared-timer tool has one, and it's turned out to be a bigger
  traffic source than Google search
- Completely free — the zero-backend architecture means one more viewer
  costs nothing

Would love feedback, especially from anyone who's dealt with the "wait,
whose timer is right?" problem in a classroom or meeting.
---

Then stay reachable through the day: reply to every comment, don't just
post-and-leave. That's the actual mechanism that makes a launch generate
backlinks/discussion rather than sitting unnoticed — see the "why draw the
line there" reasoning in `docs/seo-outreach-plan.md`.

## Why this matters (unchanged from the original reasoning)

Stagetimer — the closest comparable competitor — has 28 referring domains,
the large majority traceable to its own Product Hunt launch. CountLink
currently has ~2 referring domains total. This is the single highest-leverage
action available for the thing every SEO/AdSense analysis in this family
keeps landing on as the actual bottleneck: authority, not content
(`docs/seo-strategy.md` § Current priorities, item 2).

---

## Reference: long-form description (not what's live — PH's field is 500 chars)

Kept here for anywhere else this copy is useful (a blog post, a directory
submission with a longer limit) — this is *not* what's in the PH field
itself, see the 500-char version above for that:

> CountLink is a free, no-signup shared countdown timer. Set a duration or a
> target time, copy the generated link, and send it anywhere — Slack, email,
> a projector screen, a webinar waiting room. Every device that opens the
> link counts down to the same instant, computed from a timestamp embedded in
> the URL (each device's clock checked and corrected first), so there's no
> account, no timer backend, and no drift between devices. Includes a
> fullscreen "projector" mode, three display styles (a mechanical split-flap
> board, a minimal flat-digit view, and a light theme for projecting in
> bright rooms), a sayable five-character join code as an alternative to the
> link, and opt-in phone control for live pause/adjust/message without a
> viewer cap. Also ships an MCP server so AI assistants can create and manage
> timers directly. Completely free, no paid tier.

## Change log

- **2026-09-27** — Discovered the PH draft already existed (created
  2026-08-03) with most fields filled from a past session not otherwise
  recorded here. Verified every field against the live edit page, corrected
  the tags (were undocumented as "Web App", actually "Meetings") and the
  description (live field is a 500-char version, not the long form this doc
  used to present as canonical). Completed the draft: uploaded the 3 missing
  gallery images and set Pricing to Free. Rewrote this file so scheduling is
  the only remaining step.
- **2026-09-26** — Gallery recaptured after that day's deploy; maker comment
  updated for join codes, phone control, MCP server.
- **2026-09-17** — Gallery recaptured (Aug 3 originals had gone stale).
- **2026-08-03** — Original draft written.
