# SEO ranking baseline

A point-in-time snapshot of where CountLink stands on Google for its target
keywords. Re-run this same check periodically (monthly-ish, or after a
meaningful traffic/backlink milestone) and append a new dated section below
— don't overwrite old entries, so this becomes a timeline you can compare
against.

## How to re-check

Manual, not scripted (no paid rank-tracking API is wired up yet — see "What
this doesn't cover" in `docs/seo-outreach-plan.md`). For each keyword below:

1. Search the exact query (web search, not "AI mode"/AI Overview — those
   don't reflect classic ranking position).
2. Note whether `countlink.app` appears in the organic results, and at
   roughly what position if so.
3. Note the domains that *do* rank — that's the competitive set to watch.

---

## 2026-07-08 — Baseline (domain verified same day)

**Status: not indexed, not ranking for any target term.** Expected —
Search Console ownership was verified today and the site has zero backlink
age. This entry exists to be compared against, not to show a problem.

### Indexation check
| Query | Result |
|---|---|
| `site:countlink.app` | No results returned |
| `"countlink.app"` (exact phrase) | No results returned |
| `CountLink shared countdown timer` (brand + category) | No results returned |

### Target keyword rankings
| Keyword | CountLink position | Top-ranking competitors |
|---|---|---|
| shared countdown timer free no signup | Not ranking | countdownshare.com, webcountdown.net, count.live, eventtimer.io, watchisup.com, 101planners.com |
| OBS countdown timer browser source free | Not ranking | thefacilitainer.com, gotimer.org, easytimer.app, hi.own3d.pro, obsproject.com/forum threads |
| classroom timer shared link students | Not ranking | classroomscreen.com, countdownshare.com (has a dedicated `/use-cases/classroom-timer` page), stagetimer.io, sharemytimer.live, time.now |
| pomodoro timer online free | Not ranking | pomodorotimer.online, pomofocus.io, tomatotimers.com, studiestimer.com, pomodoronline.com |

### Competitive landscape notes
- **countdownshare.com** is the closest direct competitor on positioning
  (free, no-signup, shareable link, synced viewers) and already ranks for
  multiple target terms including a dedicated classroom-timer landing page —
  worth studying their page structure.
- **stagetimer.io** and **sharemytimer.live** (tracked in
  `docs/battle-plan-sharemytimer.md`) both show up for classroom/education
  framing specifically, not just generic "countdown timer" queries.
- Pomodoro-specific search is a separate, crowded niche (pomofocus.io,
  tomatotimers.com, etc.) with no overlap in ranking domains vs. the
  shared-timer terms — CountLink's `/timers/pomodoro-timer` page is
  competing in a different SERP than its other pages.
- OBS-countdown search is dominated by streaming-tool sites
  (thefacilitainer.com, gotimer.org, easytimer.app) that are narrower/more
  specialized than CountLink for that one use case.

### What to check next time
- Whether `site:countlink.app` starts returning results (first sign of
  indexation).
- Whether any of the four target keywords above show CountLink anywhere in
  results, even beyond page 1.
- Whether Search Console (now verified) shows impressions for any query —
  that's a more sensitive signal than manual search and will likely show
  movement before manual search does.
