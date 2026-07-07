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
| 1 | **The real domain** (e.g. `countlink.io`) | Buy it — see domain shortlist in `README.md` | Run `node scripts/rename-brand.mjs "CountLink" yourdomain.tld` — updates `scripts/site-config.mjs` and every hand-written file, then regenerates everything built from it |
| 2 | **GA4 Measurement ID** — looks like `G-XXXXXXXXXX` | [analytics.google.com](https://analytics.google.com) → Admin → Create Property → Web data stream | Uncomment + paste into the analytics `<script>` block in `index.html`'s `<head>` (and privacy.html, and the timer-page template) |
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
exactly — one ad slot in the same position, plus 12 starter landing pages.
The rest of this document is about switching the pieces on for real and
growing the landing-page count.

## Step 0 — buy a domain

See the shortlist in `README.md`. Recommendation: **countlink.io** or
**countlink.link**. Do this first — AdSense review and Search Console both
key off a live domain, so the sooner it's registered the sooner the clock on
approval starts.

Once you have it:
1. Point DNS at your host (see README "Deployment").
2. Update `SITE_URL` in `scripts/build-timer-pages.mjs`.
3. Update the `canonical` and `og:*` URLs in `index.html` and `privacy.html`
   from `countlink.example` to the real domain.
4. Re-run `node scripts/build-timer-pages.mjs` and redeploy.

## Step 1 — Google Analytics (GA4)

Free, and useful before you have any ad revenue to see if the programmatic
pages are actually getting indexed/visited.

1. Go to [analytics.google.com](https://analytics.google.com) → Admin →
   Create Property → enter your domain.
2. Create a **Web** data stream for your domain; copy the Measurement ID
   (looks like `G-XXXXXXXXXX`).
3. In `index.html`, uncomment the analytics block in `<head>` and replace
   both `G-XXXXXXXXXX` placeholders with your real ID.
4. Repeat for `scripts/build-timer-pages.mjs`'s `PAGE_TEMPLATE` head comment
   (or, simpler, extract the snippet into its own small file later — for now,
   pasting the same two lines into the template's head comment and
   re-running the generator is enough).
5. Also add it to `privacy.html`'s `<head>`.
6. Deploy, then check GA4's Realtime report to confirm it's firing.

## Step 2 — Google AdSense

This is the actual revenue mechanism, and it has real approval requirements —
plan for **1–4 weeks** of review, sometimes longer.

1. Apply at [adsense.google.com](https://www.google.com/adsense/).
2. AdSense wants to see: a live domain, original content, a visible privacy
   policy (`privacy.html` is already built for this — make sure it's linked
   from every page's footer, which it is), and no broken navigation. Having
   the 12 `/timers/` pages live and indexable before you apply gives Google
   more than just a single-page site to review.
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

- Duration pages: 1 minute, 2 minute, 3 minute, 90 seconds, 40 minutes,
  50 minutes, 90 minutes, 2 hour.
- Use-case pages: "quiz timer", "presentation timer", "meeting timer",
  "cooking timer" (careful — high competition, big incumbents already rank),
  "study timer", "break timer", "sports timer", "auction countdown".
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
  traffic base while `/timers/` is only 12 pages deep: expect low, possibly
  $0, revenue for the first few months while pages get indexed. Growth is
  driven almost entirely by adding more `/timers/` pages and by any organic
  sharing of the sync-link feature itself (which vClock doesn't have).
- This is a slow-build, low-maintenance asset, not a launch-week payoff —
  consistent with every "boring cash cow" case study researched for this
  project.
