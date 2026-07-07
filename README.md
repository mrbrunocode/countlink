# CountLink

A free, zero-backend countdown timer. Set a duration, copy the link, send it to
a room — everyone who opens that link sees the identical countdown, perfectly
in sync, because the deadline is a timestamp encoded in the URL itself. No
account, no server, no database.

Live prototype: `index.html` (open directly, or serve the folder — see below).

## Why this exists

Full research and reasoning is in the project memory (see `/Users/bruno/.claude/projects/-Users-bruno-onepage/memory/`),
but the short version: single-purpose "boring" utility sites (vClock, Wheel of
Names, word counters) generate real, verifiable ad revenue at near-zero
operating cost. vClock specifically — a free online timer — earns an
estimated ~$500K/yr from Google AdSense on ~5.4M monthly visits. CountLink
copies that proven *business model* (free tool, one ad slot, programmatic SEO
pages) while adding a genuine feature vClock doesn't have: shareable,
synced-by-link countdowns.

## Project structure

```
index.html              the tool — home page, canonical version of the UI
assets/
  style.css             all styling, shared by index.html and every /timers/ page
  app.js                all timer logic, shared the same way
timers/                 programmatic SEO landing pages (see docs/monetization.md)
  5-minute-timer.html
  ...
scripts/
  build-timer-pages.mjs  regenerates everything in /timers/ + sitemap.xml from one data list
docs/
  monetization.md        step-by-step: analytics, AdSense, Pro/Stripe, growing /timers/
ads.txt                 AdSense seller-verification file (fill in once approved)
robots.txt              allows crawling, points to sitemap.xml
sitemap.xml             generated — do not hand-edit, re-run the build script instead
archive/                earlier prototype ideas explored before CountLink (kept for reference)
```

## Running it locally

No build step, no dependencies. Any static file server works, but use the
included one during development — it sends `Cache-Control: no-store` so
edits always show up on reload (a plain file server can leave your browser
serving stale CSS/JS after a change):

```bash
cd /Users/bruno/onepage
node scripts/dev-server.mjs 4173
# open http://localhost:4173
```

(This is also what `.claude/launch.json` runs when using the Claude Code preview.)

## How the sync mechanic works

`assets/app.js` writes the countdown's end-timestamp and label into the URL
hash on start, e.g. `#t=1783378107213&l=Workshop%20resumes`. Opening that same
URL on any other device reads the same timestamp and counts down to it using
the device's own clock — so there's nothing to host, nothing to keep running,
and no possibility of the "server" going down.

## Adding a new programmatic landing page

The real growth engine (per vClock's model — see `docs/monetization.md`) is
having many indexed pages, each targeting one specific search query, all
funnelling into the same tool.

1. Open `scripts/build-timer-pages.mjs`.
2. Add a new entry to the `PAGES` list at the top — every field must be
   **unique** (title, meta description, intro paragraph). Duplicate content
   across pages is the most common reason these get filtered out of Google's
   index instead of ranked.
3. Run:
   ```bash
   node scripts/build-timer-pages.mjs
   ```
   This regenerates every file in `/timers/` plus `sitemap.xml` from the
   template, so editing shared structure only ever happens in one place.
4. Commit the new `/timers/<slug>.html` file and the updated `sitemap.xml`.

## Deployment (once you have a domain — see domain shortlist below)

Any static host works since there's no backend. Cheapest/simplest options:

- **Cloudflare Pages** (recommended) — free, connect a GitHub repo, auto-deploys
  on push, free SSL, effectively $0/month at this traffic scale.
- **Netlify** or **GitHub Pages** — same idea, also free for a static site.

Steps (Cloudflare Pages):
1. Push this repo to GitHub (see "Git / version control" below).
2. In Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo.
3. Build command: none. Output directory: `/` (repo root).
4. Add your domain under Custom Domains once purchased.
5. Update `SITE_URL` in `scripts/build-timer-pages.mjs` and the `canonical`/`og:url`
   values in `index.html` from `countlink.example` to the real domain, then
   re-run the build script and redeploy.

## Domain name research

Checked via WHOIS/RDAP on 2026-07-06:

| Domain | Status |
|---|---|
| countlink.com | **Taken** (registered 2025-07-01, Namecheap — unrelated registrant) |
| countlink.app | **Taken** |
| countlink.io | Available |
| countlink.co | Available |
| countlink.link | Available |
| countlink.live | Available |
| countlink.tools | Available |
| getcountlink.com | Available |
| thecountlink.com | Available |
| countlink.net | Available |
| countlink.org | Available |

Recommendation: **countlink.io** or **countlink.link** — `.link` is on-brand
for a product whose entire pitch is "the link is the sync," is memorable, and
is inexpensive. `.io` is the more conventional/trusted-feeling choice if you'd
rather not explain the TLD. Avoid `.app` workarounds like `getcountlink.com`
unless price is the deciding factor — the extra word costs you the clean
"type it from memory" quality that makes a share-link tool spread.

## Git / version control

This folder is a plain directory today; see the setup steps run as part of
this task (git init, `.gitignore`, initial commit) so it's ready to push to
GitHub whenever you want.

## Monetization

See `docs/monetization.md` for the full, ordered checklist (analytics →
AdSense application → ads.txt → Pro/Stripe wiring → growing `/timers/`).

## SEO / backlink outreach

See `docs/seo-outreach-plan.md` for the full plan — what's genuinely
automatable (IndexNow, Search Console API) versus what deliberately stays
a manual step (directory submissions, Show HN, Reddit) and why.

```bash
node scripts/submit-indexnow.mjs             # after every deploy with new/changed pages
node scripts/generate-submission-kit.mjs     # regenerate docs/submission-checklist.md
```
