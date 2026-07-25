# CountLink — competitive SEO strategy

Researched 2026-07-24 against live SERPs. Read the "Honest assessment"
section before the roadmap; the roadmap only makes sense given it.

## Why CountLink was picked over Diffhero/Textbench

- **Audience monetises better.** This is an AdSense business. Diffhero targets
  developers, the demographic with the highest ad-block rate — a structural
  revenue headwind that better rankings don't fix. Teachers, meeting hosts and
  streamers block far less.
- **The category is proven to pay.** vClock and online-stopwatch.com are
  AdSense-funded timer sites at large scale (they're the model named in the
  family CLAUDE.md).
- **Most headroom.** 64.7% unique content vs Textbench's 83.9%.

A reason that did **not** survive research: "the shareable-sync product is
uniquely differentiated." It isn't — see below.

## Honest assessment (read this first)

Every vertical CountLink targets is a red ocean of *free* competitors:

| Vertical | Competitors found on the live SERP |
|---|---|
| Shared / synced timer | countdownshare.com, timerlink.app, sharemytimer.live, stagetimer.io |
| Classroom | classroomscreen.com, leaderboarded.com, toytheater.com, visualtimer.com, lekktura.com, analog-clock.org |
| OBS / streaming | gotimer.org, thefacilitainer.com, easytimer.app, timerbox.app, own3d.pro |
| Generic head terms | vclock.com, online-stopwatch.com |

Three findings that should change expectations:

1. **"One link, everyone in sync, no signup" is not a differentiator.**
   CountdownShare, TimerLink and Leaderboarded all market that exact sentence.
2. **Leaderboarded beats CountLink on features and CountLink structurally
   cannot catch up.** Their lead feature is *control the display from your
   phone* — pause, reset, add time while the countdown stays full-screen on the
   board. That needs a server pushing state. CountLink's whole design (end time
   encoded in the URL, no server) makes this impossible without abandoning the
   architecture. They also show 174k registered users, testimonials, and a 4.7
   rating as trust signals.
3. **The head terms are unwinnable.** vClock/online-stopwatch have a decade-plus
   of authority. Chasing "online timer" or "countdown timer" is wasted effort.

**The binding constraint is not SEO.** AdSense is not approved, so perfect
rankings currently earn £0; and the site has roughly one live backlink. Content
work has hit diminishing returns relative to those two.

## The one defensible wedge

Not a feature — a constraint turned into a promise:

> **No server means nothing to cap, nothing to meter, and nothing to shut down.**

Verified competitor limits, July 2026:
- Stagetimer free: **3 live connections** and 3 timers per room.
- Leaderboarded free: **2 saved boards**; $19/month for colours and branding.
- CountLink: no viewer cap, no device cap, no timer cap, no account — because
  there is no server to ration. The link keeps working offline, and would keep
  working even if the site went down.

This matters exactly where rivals' free tiers break: a school assembly, a
conference room, a large stream, a whole year group. That's the position to
own — **"the free timer that doesn't break when the room is big."**

Honest counterweight to state on-page: no server also means no live
pause/resume push to people who already opened the link. `/compare` already
says this; keep it that way.

## Priorities

### P0 — Unblock revenue (not SEO work)
Nothing below earns anything until these land.
1. **AdSense re-review.** Requires Bruno's click, and only after Google
   re-crawls the enrichment already shipped. Verify with Search Console
   URL-inspection "Live test" first.
2. **Backlinks.** One merged so far. The remaining agent-doable surface is
   close to exhausted (see `boring-app-factory/docs/backlink-log.md`); the real
   upside is AlternativeTo + a human-posted Show HN / Product Hunt.

### P1 — Reposition on the wedge
3. **Rewrite the homepage H1/intro around unlimited-free**, not around
   "synced by link" (which competitors say identically). Lead with what breaks
   on their free tiers.
4. **Extend `/compare`** from 2 competitors to 5 (add CountdownShare, TimerLink,
   Leaderboarded) with a verified free-tier limits table — same evidence-based,
   concedes-where-they-win format as Diffhero's `/diffchecker-alternative`,
   which is the strongest page on any of the three sites.
5. **Add trust signals.** Competitors show user counts, ratings, testimonials;
   CountLink shows none. It has no users to count yet, so use what's true: the
   maker byline (shipped), a public repo, and a "how the no-server design works"
   proof (the Network tab test).

### P2 — Win the genuine long tail
The head is gone; the specific tail is not. Low-competition pages CountLink
already has and should deepen: `google-meet-timer`, `agenda-timer`,
`multiple-timers-at-once`, `auction-countdown`, `game-night-timer`,
`webinar-countdown`. These have real, unmet intent and no dominant incumbent.

6. **Deepen the 6 tail pages above** to guide-page depth (they're currently the
   thinnest of the 29).
7. **Add the missing "How do I put a timer on the board?" content type.**
   Leaderboarded's FAQ answers device-specific setup (smart TV, Chromebook,
   projector, iPad). CountLink has none of this and it's exactly what a teacher
   searches.

### P3 — Deferred deliberately
- **Pages → Worker migration.** No functional gap remains; don't touch hosting
  during the AdSense re-crawl window.
- **Chasing head terms.** Don't.
- **Matching Leaderboarded's phone remote.** Would require a server and would
  destroy the only defensible wedge. Explicitly not a goal.

## What success looks like

Given ~1 backlink and no approval yet, honest 6-month targets:

| Metric | Now | 6 months |
|---|---|---|
| AdSense | Not approved | Approved and serving |
| Referring domains | ~1 | 5–10 (quality, not volume) |
| Indexed pages | 36 | 36 (no new thin pages) |
| Ranking long-tail terms | ~0 | 5–10 in top 20 |
| Unique content ratio | 64.7% | 70%+ |

Page count is deliberately flat. The failure mode for this family is adding
pages instead of authority.
