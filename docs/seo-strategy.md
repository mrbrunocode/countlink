# CountLink — competitive SEO strategy

## Status as of 2026-09-24 — read this before anything below

The July research below still has value (the competitor map, the wedge, "don't
chase head terms"), but several of its premises have since been **disproved or
overtaken**. Where it conflicts with this section, this section wins. Corrected
claims are also marked inline.

**Where the traffic actually comes from (GA4, 28 days to 2026-09-23):**

| Channel | Sessions | Notes |
|---|---|---|
| AI Assistant | 494 | **492 of them chatgpt.com.** Claude/Copilot/Perplexity ~2 combined |
| Direct | 498 | includes people opening shared links |
| Organic Search | 111 | Google + Bing |
| Referral | 31 | **27 from Microsoft Teams**, avg ~10 min — links shared into meetings |

Top AI landing pages: `/` (196), **`/timers/obs-countdown-timer` (181)**, `/timers` (53).

**Search, per engine:**

- **Google** — structurally stuck on authority. 40/47 indexed, nothing left to
  submit, but non-branded clicks are ~0–2 per *month*. The only non-branded
  page-one cluster is the competitor brand **"sharemytimer"** (~187 impr at
  pos 7–8, split across five of our URLs because every page links "vs
  ShareMyTimer" in the shared chrome) — navigational intent for a live site
  (sharemytimer.live), so low CTR is expected, not fixable on-page. Target
  queries ("obs countdown timer", "google meet timer", "timed agenda") sit at
  pos 30–50. **No on-page change moves this; referring domains do.**
- **Bing** — growing weekly (impr 99 → 202 → 283; non-brand clicks 6 → 6 → 11
  across the three weeks to 2026-09-18). Also the grounding index for Copilot
  (452 citations; top grounding queries "shared timer", "group timer", and a
  Twitch-countdown cluster).
- **Referring domains: 2** (nologin.tools, saashub.com). Stagetimer: 209.

**The OBS/Twitch page is the single most strategic page on the site.** It is #1
non-home AI landing page, #2 Google click page, holds Bing's largest non-brand
cluster (pos 8–10: "twitch countdown", "obs timer", "obs countdown timer"), and
Copilot grounds Twitch queries on it. Rewritten 2026-09-20 (a2c3625, count-up
added); measure before touching it again (~mid-Oct).

**Zero-click Bing queries are mostly SERP layout, not snippets.** Checked live
2026-09-24: "group study timer" (128 impr/4 wk, pos 5.7) sits below a video
carousel and an exact-match domain (groupstudytimer.com), in a SERP whose intent
is study *trackers* (hours, streaks, leaderboards) — a product CountLink isn't.
"timer link" shows our result as a bare URL with no title or description. The
2026-09-08 snippet rewrite of group-study-timer got 110 impressions and 0 clicks
in its first full week. **Look at the SERP before any title/meta work.**

### Current priorities (replaces the P0–P3 list further down)

1. **Referral clicks from where the audience already is — human-posted.** The
   only channel with no authority ceiling. Streamers are the proven audience
   (ChatGPT, Copilot and Bing all converge on the OBS page). Candidate venues
   are in `docs/seo-outreach-plan.md` § 2026-09-24. Bruno posts; agents draft.
2. **Product Hunt launch** (draft in progress, `docs/producthunt-draft.md`).
   Gave Stagetimer 28 referring domains — still the highest-value single item.
3. **Microsoft Teams page — a decision for Bruno, not yet built.** 27 Teams
   referral sessions/28d at ~10 min each is real usage with no page behind it;
   zoom-meeting-timer and google-meet-timer are the precedent. It is a *new
   page*, so it goes after the AdSense re-review (preflight gate 2026-10-16),
   not before — don't change what Google is about to judge.
4. **AdSense re-review** after 2026-10-16 (`scripts/adsense-preflight.py`).
5. **Measure the 2026-09-20 OBS rewrite** before any further on-page change.
   If Twitch queries are still pos 8–10 in mid-October, the next change is a
   Streamlabs/Twitch-setup section on that page, not a new Twitch page.

### Tooling that answers "is it improving?"

- `scripts/trend.py` — weekly GA4 by channel + GSC branded/non-branded. Use
  this, not GA4's period-over-period %, which a single spike can invert.
- `scripts/bing.py` — now windowed to the last 4 weekly buckets. **Before
  2026-09-24 its query table summed all-time data**, so "non-branded queries
  in the Bing top 10: 210 → 266 → 322" was a cumulative count that could only
  rise. The honest 4-week figure on 2026-09-24 was 212.
- `scripts/indexing-queue.py`, `scripts/adsense-preflight.py` — unchanged.

---

*Original strategy, 2026-07-24 — historical; corrections marked inline.*

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
   **[WRONG — corrected 2026-09-24]** Phone control shipped 2026-07-26 via a
   thin Ably pub/sub layer (`control.html`, `assets/realtime.js`) without
   giving up the no-server timing model, and flash messages followed on
   2026-08-26. `/compare`, `/about` and the homepage FAQ all say so, and
   `test/faq-claims.test.mjs` fails if any page denies it again.
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

~~Honest counterweight to state on-page: no server also means no live
pause/resume push to people who already opened the link. `/compare` already
says this; keep it that way.~~ **[Obsolete 2026-09-24]** — live pause/resume
push exists (phone control). Saying otherwise on-page is exactly the stale
denial `test/faq-claims.test.mjs` was written to catch.

## Priorities

### P0 — Unblock revenue (not SEO work)
Nothing below earns anything until these land.
1. **AdSense re-review.** Requires Bruno's click, and only after Google
   re-crawls the enrichment already shipped. Verify with Search Console
   URL-inspection "Live test" first.
2. **Backlinks.** One merged so far. The remaining agent-doable surface is
   close to exhausted (see `boring-app-factory/docs/backlink-log.md`); the real
   upside is AlternativeTo + a human-posted Show HN / Product Hunt.
   **[2026-09-24]** AlternativeTo rejected all three apps on 2026-07-28 as a
   categorical policy exclusion — don't retry it. Product Hunt stands.

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
   thinnest of the 29). **[2026-09-24: don't]** — "add more words per page"
   was tried twice across the family and did not move AdSense or rankings
   (`docs/adsense-approval-2026-09-06.md` §3). The constraint is authority,
   not depth.
7. **Add the missing "How do I put a timer on the board?" content type.**
   Leaderboarded's FAQ answers device-specific setup (smart TV, Chromebook,
   projector, iPad). CountLink has none of this and it's exactly what a teacher
   searches.

### P3 — Deferred deliberately
- **Pages → Worker migration.** No functional gap remains; don't touch hosting
  during the AdSense re-crawl window.
- **Chasing head terms.** Don't.
- ~~**Matching Leaderboarded's phone remote.** Would require a server and would
  destroy the only defensible wedge. Explicitly not a goal.~~ **[Shipped
  2026-07-26]** — done without a timing server; the wedge survived.

## What success looks like

Given ~1 backlink and no approval yet, honest 6-month targets (set 2026-07-24;
the "2026-09-24" column is the checkpoint two months in):

| Metric | 2026-07-24 | 2026-09-24 | Target ~2027-01 |
|---|---|---|---|
| AdSense | Not approved | Not approved; re-review gated to 2026-10-16 | Approved and serving |
| Referring domains | ~1 | **2** | 5–10 (quality, not volume) |
| Indexed pages (Google) | 36 | **40** (nothing left to submit) | no new thin pages |
| Google non-branded top-20 terms | ~0 | ~0 (competitor-brand only) | 5–10 in top 20 |
| Bing non-brand clicks / week | — | **11** | — (new metric) |
| ChatGPT sessions / 28d | — | **492** | — (new metric) |
| Unique content ratio | 64.7% | not re-measured | 70%+ |

The two rows marked "new metric" are the channels that turned out to work;
the original table had no row for either.

Page count is deliberately flat. The failure mode for this family is adding
pages instead of authority.
