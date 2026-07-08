# Monetization checklist

This is the actual, verified model this site is copying — pulled directly from
vClock.com's live HTML (not a guess), plus the concrete steps to switch each
piece on for CountLink. Follow the steps in order; several of them (analytics,
AdSense) have a real-world waiting period, so start them early even if you're
not ready to launch yet.

## What to send me, exactly, to wire this up for real

Everything below is currently a clearly-labeled placeholder in the code. I
cannot generate any of these values myself — they only exist once you create
the accounts. Once you have them, give me whatever you have (you don't need
all of it at once) and I'll paste them into the right files:

| # | What I need from you | Where you get it | What I do with it |
|---|---|---|---|
| 1 | ~~The real domain~~ **DONE** — `countlink.app` bought, deployed, live with HTTPS (2026-07-08) | — | — |
| 2 | ~~GA4 Measurement ID~~ **DONE** — `G-WM4M28L7Y1` (property "CountLink", account "CountLink", 2026-07-08) | — | Live in every hand-written page's `<head>` (index, about, compare, contact, how-it-works, privacy, terms) and in the timer-page template — all 31 pages fire `page_view` on load, confirmed via GA4 Realtime |
| 3 | **AdSense Publisher ID** — looks like `ca-pub-XXXXXXXXXXXXXXXX` | [adsense.google.com](https://www.google.com/adsense/) after your application is approved | Paste into `ads.txt`, the AdSense `<script>` tag in `<head>`, and every `data-ad-client` attribute |
| 4 | **AdSense Ad Slot ID** — looks like `XXXXXXXXXX` (shorter, numeric) | AdSense dashboard → Ads → By ad unit → create a **Display / Horizontal / Responsive** unit | Paste into `data-ad-slot`, replacing the `.ad-frame` placeholder div in `index.html` and in `scripts/build-timer-pages.mjs`'s template (then re-run the script) |

Two rows that used to be here are done already, not pending: the real contact
email (`CONTACT_EMAIL` in `scripts/site-config.mjs`) is wired in everywhere,
and there is currently no Pro/Stripe row — Pro was deliberately deferred
before launch (see Step 4 below) rather than shipped as a non-functional mock.

Nothing else is needed from you for the code itself — everything else (the ad
slot's position, the sitemap, the programmatic `/timers/` pages, the privacy
policy text) is already built. Steps 2–4 specifically require you to have
already done Step 0 below (bought the domain) since both GA4 and AdSense
verify ownership of a live domain before they'll issue real IDs.

## What vClock actually does (the evidence)

Checked by fetching `https://vclock.com/timer/` and `https://vclock.com/ads.txt`
directly on 2026-07-06:

- **Ad network:** pure Google AdSense, direct relationship. Their `ads.txt`
  contains `google.com, pub-4140552492902680, DIRECT, f08c47fec0942fa0`. No
  Ezoic, Mediavine, or other premium network in between.
- **Ad placement:** exactly **one** ad unit per page — a single horizontal,
  full-width-responsive AdSense slot (`data-ad-format="horizontal"
  data-full-width-responsive="true"`), placed **directly below the timer
  controls**, above a "related tools" links panel. Not a sidebar, not a
  sticky/anchor unit, not multiple stacked ads.
- **Analytics:** Google Analytics via `gtag.js`.
- **The real revenue driver is not the ad, it's the traffic shape:** vClock
  has hundreds of individually-indexed pages —
  `/set-timer-for-5-minutes/`, `/set-timer-for-90-seconds/`, etc. — each
  targeting one long-tail search query, all funnelling into the same tool
  with the same single ad slot. One homepage doesn't get 5.4M visits/month;
  hundreds of duration-specific landing pages do.

Estimated result: ~5.4M monthly visits, ~$500K/yr in AdSense revenue
(BoringCashCow's estimate; not vClock's own disclosed figure).

CountLink's `index.html` + `/timers/*.html` already replicate this structure
exactly — one ad slot in the same position, plus 24 landing pages (durations,
use-cases, a shareable stopwatch, a pomodoro timer, and evergreen
New Year / Christmas date countdowns).
The rest of this document is about switching the pieces on for real and
growing the landing-page count.

## Step 0 — buy a domain — DONE (2026-07-08)

`countlink.app` is bought (Porkbun), on Cloudflare Pages, live with HTTPS.
Deploys happen automatically on push to `main` via
`.github/workflows/deploy.yml`. Search Console + Bing Webmaster submissions
made; verification was pending as of 2026-07-08.

## Step 1 — Google Analytics (GA4) — DONE (2026-07-08)

Property "CountLink" (account "CountLink", both fresh — not reused from any
prior account) → Web data stream for `https://countlink.app` → Measurement
ID `G-WM4M28L7Y1`. Live on all 31 pages (every hand-written page plus the
timer-page template), confirmed firing in GA4 Realtime the same day.

Went further than "index.html + privacy.html" — the snippet is on every
page (about, compare, contact, how-it-works, terms too), since a single-page
subset would undercount the `/timers/` traffic that's the actual point of
the programmatic-SEO strategy in Step 3 below.

## Step 2 — Google AdSense

This is the actual revenue mechanism, and it has real approval requirements —
plan for **1–4 weeks** of review, sometimes longer.

1. Apply at [adsense.google.com](https://www.google.com/adsense/).
2. AdSense wants to see: a live domain, original content, a visible privacy
   policy (`privacy.html` is already built for this — make sure it's linked
   from every page's footer, which it is), and no broken navigation. Having
   the 24 `/timers/` pages live and indexable before you apply gives Google
   more than just a single-page site to review.
   **Readiness as of 2026-07-08:** 24 `/timers/` pages + 7 hand-written
   pages are live, every page has nav + privacy/terms/contact links, the
   site passed a mobile-first redesign and a WCAG contrast/keyboard/
   screen-reader pass, and there are no placeholder ad boxes rendered.
   There is nothing left blocking the application — apply now.
3. Once approved, AdSense gives you:
   - A publisher ID like `ca-pub-XXXXXXXXXXXXXXXX`.
   - An ad unit — create a **Display ad**, format **Horizontal**, responsive.
4. Fill in `ads.txt` at the repo root with the real line AdSense shows you
   (format: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`).
   This file **must** be reachable at `https://yourdomain/ads.txt` — without
   it, AdSense pays out at a fraction of the normal rate even after approval.
5. In `index.html`, uncomment the AdSense `<script>` tag in `<head>` and set
   your real `client=ca-pub-...` value.
6. Replace the placeholder `<div class="ad-frame">...</div>` in `index.html`
   with the real ad unit AdSense gives you:
   ```html
   <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot="XXXXXXXXXX" data-ad-format="horizontal" data-full-width-responsive="true"></ins>
   <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
   ```
7. Do the same in `scripts/build-timer-pages.mjs`'s template (search for
   `ad-frame`), then re-run the generator so every `/timers/` page picks it
   up — **don't** hand-edit the individual files in `/timers/`, they'll be
   overwritten next time the script runs.
8. Keep the ad to this one slot for now. vClock's data shows one well-placed
   unit is the proven pattern; adding more (sidebar, sticky, in-content)
   raises revenue per visit only marginally and measurably hurts return
   visits on a utility tool like this — the whole value proposition is speed.

## Step 3 — grow `/timers/` (this is the actual growth lever)

vClock's traffic is not one page ranking well, it's hundreds of pages each
ranking for one query. Follow `README.md`'s "Adding a new programmatic
landing page" section. Ideas for the next batch, roughly in order of
likely search volume:

Already built (2026-07-08 batch): stopwatch ("online stopwatch"),
pomodoro-timer, new-year-countdown and christmas-countdown (both compute the
NEXT occurrence client-side, so they never go stale).

- Duration pages: 1 minute, 2 minute, 3 minute, 90 seconds, 40 minutes,
  50 minutes, 90 minutes, 2 hour.
- Use-case pages: "quiz timer", "presentation timer", "meeting timer",
  "cooking timer" (careful — high competition, big incumbents already rank),
  "study timer", "break timer", "sports timer".
- More date countdowns via `untilMonthDay` in `PAGES`: Halloween, birthday
  ("birthday countdown" is generic-huge; needs the date field UX), exam
  results day, school holidays.
- Always write the intro paragraph and meta description from scratch per
  page — copy-pasted boilerplate with only the number changed is the single
  most common reason these get excluded from Google's index rather than
  ranked.

Submit `sitemap.xml` in [Google Search Console](https://search.google.com/search-console)
once the domain is verified there, so new `/timers/` pages get crawled faster
than waiting for organic discovery.

## Step 4 — Pro tier (deferred, deliberately not shipped)

The Pro banner/`#proBtn` mock was pulled from the site before launch (see
[[project-countlink]] memory) — a non-functional "$5/mo — Unlock Pro" button
that didn't actually charge anyone or change anything was judged worse than
no button at all: a real visitor who clicked it got a fake "Pro unlocked ✓"
with nothing behind it, a trust problem the moment anyone tried it.

The comparable sites that anchor this project (vClock, online-stopwatch.com)
are pure ad-supported with **no paid tier at all** — that's the proven model
for a simple free utility at this traffic profile. ShareMyTimer/Stagetimer.io
charge because they run real server infrastructure (WebSockets, accounts)
that costs money per user; CountLink's static, zero-backend architecture has
no such cost, so ads-only is not just simpler but structurally the right
default, not a stopgap.

**Don't rebuild Pro speculatively.** Revisit only once there's a real signal
worth acting on — e.g. actual user requests for white-label/no-ads, or
traffic large enough that a small paid segment would be worth the added
complexity. If/when that happens:

1. Create a [Stripe](https://stripe.com) account, add the Pro product, and
   create a **Payment Link** (no code needed for a first version).
2. Add a real button whose click handler is `location.href =
   "https://buy.stripe.com/your-link"` — do not ship a local-only mock again.
3. Decide how "Pro" actually changes the experience once paid — this project
   has no server, so gating a feature needs *some* minimal backend or a
   client-side license-key scheme (e.g., Stripe redirects back with a
   session ID exchanged for a signed token via a small serverless function
   on Cloudflare Workers — the one piece of the product that can't stay
   100% static if you want to actually gate something). Decide this deliberately
   when there's real demand, not blind.

## Rough economics (so expectations are calibrated)

- Hosting: **$0/month** (static site on Cloudflare Pages/Netlify free tier).
- Domain: **~$10–15/year**.
- AdSense, at vClock's realistic per-page-view rate and a much smaller
  traffic base while `/timers/` is only ~24 pages deep: expect low, possibly
  $0, revenue for the first few months while pages get indexed. Growth is
  driven almost entirely by adding more `/timers/` pages and by any organic
  sharing of the sync-link feature itself (which vClock doesn't have).
- This is a slow-build, low-maintenance asset, not a launch-week payoff —
  consistent with every "boring cash cow" case study researched for this
  project.

## Automatable steps (an agent can run these end-to-end)

Everything here needs no credentials beyond what's already on the machine /
repo secrets, and is safe to re-run:

- **Add landing pages:** append a row to `PAGES` in
  `scripts/build-timer-pages.mjs` (unique h1/meta/intro/FAQ per page — never
  boilerplate), then `node scripts/build-timer-pages.mjs`. Regenerates all
  pages + sitemap.xml + llms.txt + index footer links together, so nothing
  drifts. Special page shapes: `direction: "up"` (stopwatch) and
  `untilMonthDay: [m, d]` (evergreen date countdown).
- **Deploy:** `git push` to `main` — GitHub Action stages `dist/` and runs
  `wrangler pages deploy`. Verify with
  `curl -sL https://countlink.app/timers/<new-slug> | grep -c boardStartBtn`
  (note: Pages 308-redirects `.html` to clean URLs; always `curl -L`).
- **Tell search engines about new pages:** `node scripts/submit-indexnow.mjs`
  after any deploy that adds/changes pages (Bing/IndexNow accepts instantly;
  Google reads the sitemap on its own schedule).
- **Outreach status / directory submissions:** `node scripts/outreach-status.mjs`
  prints what an agent can act on now (`agent-browser` targets) and what
  needs Bruno; `sync` merges new targets without touching done ones.
- **Re-rasterize the social image** after editing `assets/og-image.svg`:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless
  --disable-gpu --screenshot=assets/og-image.png --window-size=1200,630
  --hide-scrollbars "file://$PWD/assets/og-image.svg"`
- **Local verification:** `node scripts/dev-server.mjs` (no-cache, resolves
  clean URLs like production).

Still human-only: GA4 property creation, the AdSense application itself, and
Search Console verification (Google account required for all three) — but
once Bruno supplies the IDs, pasting them into the marked placeholders and
redeploying is agent work (see the table at the top).
