# Battle plan: CountLink vs sharemytimer.live

*Written 2026-07-07, based on a live teardown of their site, pricing page, robots/sitemap, and the surrounding SERPs.*

## Verdict first (you asked for honesty)

**Go — but with a corrected target.** Beating sharemytimer.live is achievable: it's a low-authority indie site (~3 indexable pages, no content strategy, keyword-stuffed meta tags Google ignores, Gmail support address). What is **not** achievable is the README's implied goal of taking vClock-style head terms. "Online timer", "5 minute timer", "countdown timer" are owned by vClock, timeanddate.com, online-stopwatch.com and Google's own SERP timer widget — decade-old domains with massive link profiles. A new domain will not displace them in any timeframe worth funding.

The winnable battlefield is the **shared/synchronized timer mid-tail**: "shared timer", "shared countdown timer", "synchronized timer", "timer for zoom meeting", "group study timer", "obs countdown timer". Current occupants of those SERPs are sharemytimer.live, countdownshare.com, thorsenlabs.com/timer, and stagetimer.io blog posts — all beatable except stagetimer, whose "speaker timer / stage timer" fortress we should not assault head-on.

**Can it only if:** you need head-term traffic to justify the project economics. Mid-tail shared-timer volume is meaningfully smaller than "online timer" volume. If ~10–50K monthly visits at maturity (not vClock's 5.4M) doesn't clear your bar, stop now. If it does — and at $0/month hosting it should — proceed.

One caveat: SEO results cannot be *proven* before launch by anyone, ever. What this plan does instead is define **90-day kill criteria** (§8) so you're never running on faith.

---

## 1. Their teardown

**What they are:** Next.js app, server-backed real-time sync. Controller/viewer model: one person controls, viewers join via link/QR/join-code. Countdown + count-up, audio alerts, viewer messaging, multiple timers, themes, OBS/Zoom integration, iOS app. Testimonials from small X accounts; founder markets on LinkedIn.

**Pricing:** Free = 3 devices, 3 timers, **no sound alerts**. Pro $6/mo = 90 devices, 20 timers, sound. Single Event $9 = 150 devices, 15 days.

**SEO weaknesses (our openings):**

1. **~3 indexable pages.** `/`, `/controller`, `/payment`. Nav links for "Features" and "Use Cases" literally point to `/`. Zero programmatic pages, zero blog, zero use-case landing pages. Their entire organic surface is one URL.
2. **Amateur signals.** A 60-term `meta keywords` stuff (Google has ignored this tag since 2009), heavy client-rendered JS, `.live` TLD, `sharemytimer0@gmail.com` support address. Also a confusingly separate `sharemytimer.com` diluting their own brand.
3. **Weak links.** Their visible backlinks are their own LinkedIn posts and small X mentions. Nothing that a few good directory/community placements can't match within weeks.
4. **Paywalled basics.** Sound alerts behind $6/mo, 3-device free cap. This is the single easiest thing to undercut.

**Their real strengths (don't pretend otherwise):**

- Live control genuinely syncs: pause, +1m, messages propagate to every viewer. Our URL-hash timer cannot do that — once the link is sent, the deadline is fixed.
- iOS app, OBS integration, social proof. These take time to copy.

## 2. Where we win — Undercut, Copy, Improve

**Undercut (pricing):** Everything on their $6/mo tier is free for us, forever, unlimited viewers. Our sync is client-side, so a viewer costs us nothing — their per-device caps exist because their servers cost money. Publish the comparison:

| | ShareMyTimer Free | ShareMyTimer Pro $6/mo | CountLink Free |
|---|---|---|---|
| Viewers | 3 devices | 90 devices | **Unlimited** |
| Timers | 3 | 20 | **Unlimited** |
| Sound alerts | ✗ | ✓ | **✓** |
| Signup | none | account + card | **none, ever** |
| Can the server go down? | yes | yes | **no server exists** |

Our Pro ($5/mo, undercutting by $1) sells *ad removal + branding*, not withheld basics.

**Copy (without infringement) — close these feature gaps, all cheap client-side work:**

- Count-up mode (they have it; it's a sign flip in `app.js`)
- QR code on the share box (one tiny JS lib, or generate at build time)
- Fullscreen "display mode" polish + multiple themes (we have 3 style toggles; name them, market them)
- A `/use/obs` page with a chroma-key-friendly, transparent-background timer URL param — OBS users are a loud, linking audience
- Their comparison-table format ("Basic timer 1/8 vs us 8/8") — do our own honest version

Do **not** copy their copy, screenshots, testimonial format verbatim, or the name. "ShareMyTimer" as a phrase never appears on our site except possibly a factual comparison page.

**Improve (our angles they can't follow):**

- **"The link is the sync."** No server = works when their websocket hiccups, no 42ms-sync claims needed, no uptime page needed. Lean into it: "This timer cannot go down."
- Instant load: our static page vs their Next.js bundle. Target <1s LCP, 100/100 mobile PageSpeed — a real ranking input they'll struggle to match.
- Privacy: nothing leaves the browser. One-line privacy policy vs their account system.

**Roadmap (only after SEO traction, §8):** live control (pause/extend propagating to viewers) via a minimal free-tier channel (Cloudflare Durable Objects / KV polling). This erases their last product advantage while keeping viewers-cost-nothing economics. Not v1 — v1 wins on simplicity and price.

## 3. SEO battle plan

### 3.1 Keyword tiers

**Tier 1 — take these (low competition, high intent):** shared timer, share a timer, shared countdown timer, synchronized timer, sync timer online, timer link, send a timer link, group timer.

**Tier 2 — use-case mid-tail (their nav *pretends* to cover these with anchor links; we build real pages):** classroom timer shared screen, exam timer for projector, timer for zoom meeting, timer for google meet, obs countdown timer free, twitch stream timer, workshop timer, standup timer, group study timer / study with me timer, game night timer, auction countdown.

**Tier 3 — head terms (5 minute timer, online timer): do not target; do keep.** The existing `/timers/` pages stay because they're free and funnel internal links, but every title re-angles to the shared variant: "5 Minute Timer You Can Share — synced on every screen" not "5 Minute Timer online free". We are not going to outrank vClock for the generic phrase; we *can* own "shareable 5 minute timer".

### 3.2 On-page (this repo, this week)

1. **Buy the domain and fix canonicals.** `countlink.example` placeholder in canonical/og:url is live in `index.html` — shipping that would be self-sabotage. Buy countlink.app, run the rename script, rebuild.
2. Retitle homepage around Tier 1: current title targets "shared countdown timer" weakly; make H1/title hit "Shared Timer" + "synced by link" explicitly.
3. Add `FAQPage` + `WebApplication` (free, price 0) schema.org JSON-LD to every page. They have none — cheap rich-result edge.
4. Build the Tier 2 pages via `build-timer-pages.mjs` (12 exist; target ~30 within a month, every one with unique copy — the script's README warning about duplicate content is correct).
5. Add a comparison page: "CountLink vs ShareMyTimer vs Stagetimer" — factual, table-based. Comparison pages rank for "X alternative" queries and *their* brand growth feeds *our* page.
6. Performance pass: inline critical CSS, self-host the three fonts (currently 3 Google Fonts families — cut to one), keep total page <100KB.

### 3.3 Off-page (60 days)

- IndexNow + Search Console on day one (scripts already in repo).
- Directories that actually pass link equity: AlternativeTo (list as vClock + ShareMyTimer + Stagetimer alternative), Product Hunt, free-for.dev-style tool lists, teacher-tool roundups (huge for classroom timer intent).
- Show HN — the "no-server, the-link-is-the-sync" mechanic is exactly HN bait; their launch got small X traction only.
- Answer-the-actual-question posts in r/Teachers, r/obs, r/Twitch when timers come up (manual, per the existing outreach plan — don't automate this).
- Pitch the OBS transparent-timer page to streaming-tools roundup authors; those articles link tools generously.

## 4. Proof — 90-day kill criteria

You asked the plan to "prove SEO results". Pre-launch proof doesn't exist; the honest substitute is cheap, fast falsification:

- **Day 14:** all pages indexed in Search Console (crawled + indexed, not "discovered"). If Google refuses to index a clean static site, something is broken — fix before spending on outreach.
- **Day 45:** impressions for any Tier 1/2 phrase, any position. No impressions = the pages target phrases nobody searches → re-keyword, don't quit yet.
- **Day 90:** ≥1 Tier 1/2 keyword in top 20, ≥300 organic clicks/month trending up, ≥5 referring domains. **Hit none of these → can the project.** Total sunk cost at that point: one domain (~$15) and your build time.
- **Day 180 (success bar):** top 5 for "shared timer" or "shared countdown timer", 3–5K organic visits/month. That's when AdSense + Pro become worth wiring and the live-control roadmap unlocks.

## 5. What we will not win — say it plainly

Their brand-name SERP (pointless to chase), head terms like "online timer" (vClock/timeanddate own them), and "stage timer / speaker timer" (stagetimer.io's fortress). Anyone promising otherwise for a new domain is selling you something. The prize is being the default answer for *shared* timers — a smaller pond, but their pond, and they've left it undefended.
