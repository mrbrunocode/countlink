# Why assistants call CountLink "minimalist" and praise ShareMyTimer

*Written 2026-09-06, after a live re-teardown of sharemytimer.live, three new
entrants, and CountLink's own homepage copy. Continuation of
`battle-plan-sharemytimer.md` (2026-07-07), which is now partly out of date.*

## Verdict first

**The premise is half right, and the half that's wrong matters.** CountLink is
not less featured than ShareMyTimer — it is measurably *more* featured and has
~9x their indexable surface. Building more features will not change what
assistants say about it, because the thing generating "minimalist" is
CountLink's own copy structure and a total absence of third-party corroboration.

So: yes, hard-tackle them — but the work is **surfacing, naming and proof**,
not new capability. There are exactly two real feature gaps (§3), and they're
small.

## 1. The head-to-head, verified live 2026-09-06

ShareMyTimer's sitemap still lists **4 URLs** (`/`, `/controller`, `/viewer`,
`/payment`), `lastmod 2026-06-09` — unchanged in three months. Their nav links
to `/features` and `/use-cases` still **404**. CountLink's sitemap: **35 URLs**,
including 8 long-form guides they have no equivalent of.

| | CountLink | ShareMyTimer |
|---|---|---|
| Share link / QR | ✓ / ✓ | ✓ / ✓ |
| Short join code | **✗** | ✓ |
| Count-up / stopwatch | ✓ | ✓ |
| Sound alerts | ✓ free | **Pro $6/mo** |
| Viewer limit | none | 3 free / 90 Pro |
| Multiple timers | ✓ unlimited | 3 free / 20 Pro |
| Live pause/±/stop push to viewers | ✓ (phone control) | ✓ |
| Broadcast message to viewers | ✓ (flash message) | ✓ |
| Fullscreen / themes | ✓ 3 styles + seasonal | ✓ |
| OBS transparent overlay | ✓ no watermark | ✓ |
| Zoom / Meet / YouTube | ✓ | ✓ |
| Native iOS app | **✗** | ✓ |
| Agenda (auto-advancing segments) | ✓ | ✗ |
| Interval / Tabata / rounds | ✓ | ✗ |
| Laps | ✓ | ✗ |
| Website embed `<iframe>` | ✓ | ✗ |
| README badge | ✓ | ✗ |
| `.ics` calendar export | ✓ | ✗ |
| Printable poster | ✓ | ✗ |
| Offline export / PWA install | ✓ | ✗ |
| **MCP server for AI assistants** | ✓ | ✗ |
| Guides / blog | 8 | 0 |
| Indexable pages | 35 | 4 |
| Price | free, forever | $6/mo, $9/event |
| Testimonials on site | **0** | **5, named, with photos** |

Two gaps. Twelve wins. This is not a feature problem.

## 2. What is actually generating "minimalist"

### 2a. The site describes itself in negations

The homepage's leading claims are *"A shared timer with nothing to run out
of"* and *"no viewer limit, no account, no paid tier, because there's no server
to pay for."* Three of four are absences. A summarizer has nothing to
enumerate, so it writes one line — and that line is what we saw a live AI
search return today: *"share one link with as many people as you like — no
viewer limit, no account, no paid tier."* Accurate. Also indistinguishable
from a weekend project.

ShareMyTimer's homepage, by contrast, names features in a scannable grid:
real-time sync, countdown & count-up, link/QR/join-code, audio alerts, viewer
messaging, multiple timers, flash alerts. Same summarizer returns a verb list.
**They get described richly because they wrote a list. We wrote an essay.**

### 2b. The feature list is buried under an apology

Everything CountLink has beyond the core is in one prose paragraph headed
**"Beyond the link"**, which opens: *"…runs a few things that don't get much
billing up top."* OBS overlay, QR, PWA install and phone control — four real
features — are inside that sentence. The page tells the reader (and the
crawler) that its own capabilities are minor. There is no `/features` page and
no `<h2>Features</h2>` anywhere on the site.

`llms.txt` has the same shape: excellent, deep, narrative — and no enumerated
feature block. It teaches an assistant the sync mechanic beautifully and never
hands it a list to quote.

### 2c. Zero social proof, against their five testimonials

`grep -ic 'testimonial\|review'` across `index.html` and `about.html`: **0**.
ShareMyTimer carries five named testimonials. That is most of where "sang its
praises" comes from — an assistant reading a page with five people vouching
for it reports enthusiasm, because the page contains enthusiasm. No third-party
review, directory listing, or roundup currently names CountLink either; every
AI answer about it today is sourced from countlink.app itself.

### 2d. Absent from the roundup SERP entirely

Live search, "best shared countdown timer for meetings synced link 2026",
2026-09-06 — top results: stagetimer.io, countdownshare.com
(`/use-cases/meeting-timer`), **timerlink.app**, ultimatetimer.online,
sharemytimer.live, **remotetimer.app**. CountLink: **not present**.

Note three of those are new since the July battle plan. Also note what they all
have that we don't: a page whose URL and `<h1>` are literally *"meeting
timer"*. CountLink has zoom-meeting-timer, standup-timer and workshop-timer —
but nothing at the generic head of that cluster, which is the phrase the
roundup queries actually use.

## 2e. Status — what shipped, 2026-09-06

Items 1, 2, 3, 5, 6 and 8 below are **done and live**, verified in production
(see the commits "Name what CountLink does" and "Show the thing the words only
claimed"). Concretely: `/features` with 32 named capabilities and matching
JSON-LD; a `## Features` block at the top of `llms.txt`; `/timers/meeting-timer`
as a **single hub page** rather than the seven use-case pages this plan
originally called for; join codes at `/j/<code>`; flash messages named as
viewer messaging; and a hero illustration showing one link on three screens.

Two changes to the plan as written, both made after reading the repo:

* **Item 3 was cut from seven pages to one.** 42 of 45 URLs sit in "Discovered
  – currently not indexed" with 1 referring domain, which is exactly why eight
  duration pages were culled on 2026-07-29. Six more thin use-case pages would
  have repeated a mistake already corrected. `/timers/meeting-timer` links the
  existing zoom/meet/standup/workshop pages instead of competing with them.
* **A cause this teardown missed:** `/how-it-works` was actively *denying* a
  shipped feature — it said, in prose and inside its FAQPage JSON-LD, that a
  pause could not be pushed to viewers. True when written in July, false since
  phone control shipped in August. So the site was telling assistants it lacked
  the exact feature ShareMyTimer is praised for, in its own words. Fixed, and
  `test/faq-claims.test.mjs` now fails on any page that denies live control
  without naming phone control.

**Item 6 (the `/vs/` pages) shipped 2026-09-06 too** — four head-to-head pages
against ShareMyTimer, Stagetimer, CountdownShare and TimerLink, every figure
re-verified against the vendor's own pricing page that day (several had moved
since July: ShareMyTimer's Single Event tier is now 100 timers, not 15). Rules
and enforcement in `scripts/comparisons.mjs` and `test/comparisons.test.mjs`.
All 40 URLs resubmitted via IndexNow, 200 Accepted.

**Still open: items 4 and 7** — testimonials (collected, never written),
`/vs/` pages, and directory placements. These are the ones that need something
no on-site change can manufacture: third-party corroboration, against a
1-referring-domain profile.

## 3. Ranked plan

Scored on impact against the actual failure mode (how CountLink gets described
and whether it appears at all), over effort. Everything here respects the
standing constraints in `ai-surface-expansion-plan.md` §"Non-negotiable" — no
accounts, no paid tier, no viewer caps, no new timer types.

| # | Work | Impact | Effort | Why this rank |
|---|---|---|---|---|
| **1** | **`/features` page + a named feature grid on the homepage**, replacing "Beyond the link". Every capability gets a name, an icon-free row, and a one-line description. | ★★★★★ | S | Directly fixes 2a+2b. This is the single change most likely to alter what an assistant says next week. |
| **2** | **`## Features` enumeration in `llms.txt`** — a flat, quotable list of all 20+ capabilities, above the narrative sections. | ★★★★★ | XS | The AI channel is already CountLink's largest real referral source. Hand it a list to quote. |
| **3** | **`/timers/meeting-timer`** (+ `presentation-timer`, `speech-timer`, `break-timer`, `quiz-timer`, `debate-timer`, `cooking-timer`). Generated via `build-timer-pages.mjs` as usual. | ★★★★☆ | S | Fixes 2d. "Meeting timer" is the head of the cluster every roundup draws from and we have no page at it. |
| **4** | **Real testimonials**, collected — not written. Product Hunt comments, the contact inbox, a one-line ask on the finished screen. Attributed, or not shipped. | ★★★★☆ | M | Fixes 2c, the "praise" half of the complaint. Slow because it depends on real humans; start the collection now so it can ship later. |
| **5** | **Short join code** — `countlink.app/j/<base36>` decoding the epoch client-side, no lookup table, no database. Closes the one ShareMyTimer feature named in every description of them, and does it without a backend. | ★★★☆☆ | M | The only genuine capability gap worth closing. Read aloud in a classroom, which a hash URL cannot be. |
| **6** | **`/vs/` comparison pages** — vs ShareMyTimer, vs Stagetimer, vs CountdownShare, vs TimerLink. CountdownShare runs exactly this play and it ranks. | ★★★☆☆ | M | Captures "X alternative" queries; their brand growth feeds our pages. Extends the existing `/compare`. |
| **7** | **Directory + roundup placements** — AlternativeTo/SaaSHub/Product Hunt under each competitor's alternatives list. Resume `outreach-ledger.json`. | ★★★☆☆ | M | The only route to third-party corroboration, which no on-site change can manufacture. |
| **8** | **Name "flash message" as viewer messaging** on the features page. | ★★☆☆☆ | XS | We have the feature; they get credit for it because they named it. |

### Explicitly not doing

- **A native iOS app.** Their remaining real advantage, and the PWA already
  covers the actual need (home-screen install, fullscreen). Not worth the
  platform cost for a $0/mo project.
- **More features.** Two prior audits (2026-08-23, 2026-08-26) and this one all
  reach the same conclusion; a third round of parity-chasing would be the
  busywork `ai-surface-expansion-plan.md` warns against.
- Accounts, paid tiers, viewer caps — unchanged, load-bearing.

## 4. Competitors to add to tracking

New since the July plan, all in the roundup SERP, none previously audited:
**timerlink.app** (accounts + password-protected timers + a paid tier),
**remotetimer.app** (free, ~4 pages, no pricing surfaced),
**ultimatetimer.online**. CountdownShare has also grown a `/vs/` page set and a
blog since July. None of them has an MCP server — that lead still holds.
