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

## 2026-07-08 — On-page fixes applied against this baseline

Same day as the baseline above, informed by the competitor snapshot (see
"Competitive landscape notes"). Two concrete, applied changes — not
speculative recommendations:

1. **Truncated title/meta tags fixed.** 7 timer-page titles and 6 meta
   descriptions (including the homepage's, at 237 chars — nearly 80 over
   budget) exceeded Google's practical SERP truncation limits and were
   being cut off with "…". Every page site-wide now fits within ~60 chars
   (title) / ~158 chars (description). Pure CTR fix — doesn't change
   ranking directly, but a truncated snippet loses clicks on impressions
   already earned.
2. **classroom-timer thin-content gap closed.** countdownshare.com's
   classroom-timer page is one of their most developed, and one of the
   pages they rank for education-intent queries; CountLink's equivalent
   page was one of the thinnest on the site (no `extra` content block,
   unlike exam-timer/zoom/OBS pages). Added an original "what to time, by
   grade band" section (K-5 / middle / high school guidance) — closes the
   structural gap without copying competitor content.

Both changes are live on `countlink.app` as of this commit
(`975f561`). IndexNow re-submitted all 31 URLs same-day. Next baseline
re-check should specifically watch whether classroom-timer starts
appearing for education-intent queries where it previously didn't
compete at all on content depth.

## 2026-07-16 — Re-check (8 days post-baseline)

**Status: unchanged — still not indexed, still not ranking.** Not a
regression; 8 days with zero backlink age is well within Google's normal
indexing lag for a brand-new domain (commonly weeks, sometimes longer
without any inbound links). Re-run again at the ~1-month mark, and treat a
still-zero result *then* as the point to actually investigate rather than
wait further.

### Indexation check
| Query | Result |
|---|---|
| `site:countlink.app` | No results returned |
| `"countlink.app"` (exact phrase) | No results returned |

### Target keyword rankings
| Keyword | CountLink position | Notes |
|---|---|---|
| shared countdown timer free no signup | Not ranking | Same competitor set as baseline (countdownshare.com, tickcounter.com, webcountdown.net, eventtimer.io, watchisup.com now also visible) |
| OBS countdown timer browser source free | Not ranking | Same competitor set as baseline |
| classroom timer shared link students | Not ranking | countdownshare.com/use-cases/classroom-timer still ranks; sharemytimer.live and stagetimer.io still present. CountLink's classroom-timer content fix from 2026-07-08 hasn't shown any ranking effect yet — expected, since the page still isn't indexed at all |
| pomodoro timer online free | Not ranking | Crowded niche unchanged |

### A technical finding worth noting (unrelated to indexing lag)
Found and fixed a robots.txt self-contradiction while doing this check:
`robots.txt` had explicit `Allow: /` lines for `GPTBot` and `ClaudeBot`
(the training-purpose crawler tokens), but Cloudflare auto-injects an
edge-level "Managed content" block ahead of the origin's own file that
`Disallow: /`s those same two tokens account-wide. Same user-agent token
appearing in two conflicting groups in one served robots.txt is undefined
behavior across parsers — not reliably honored either way. This has no
bearing on why the site isn't indexed yet (Googlebot itself was never
touched by any of this), but it's a latent correctness issue independent
of indexing lag. Removed the two dead/contradicted lines and aligned the
file with the family-wide AI-crawler policy now documented in
`boring-app-factory/docs/seo-outreach-plan.md` (block training-only
crawlers, explicitly allow every search/citation crawler that can actually
send traffic or cite the site). See that commit for the full reasoning.

### What to check next time (~2026-08-16)
- Same as before: `site:countlink.app`, the four target keywords, and
  Search Console impressions (more sensitive than manual search).
- Whether the September 2026 Cloudflare default-AI-bot-policy change
  (new domains only, per `boring-app-factory/docs/seo-outreach-plan.md`)
  ends up affecting this zone — it shouldn't, since countlink onboarded
  before that date, but worth a one-line sanity check.
