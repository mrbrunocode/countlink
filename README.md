# CountLink

A free, zero-backend countdown timer. Set a duration, copy the link, send it to
a room — everyone who opens that link sees the identical countdown, perfectly
in sync, because the deadline is a timestamp encoded in the URL itself. No
account, no server, no database.

Live at [countlink.app](https://countlink.app). For local dev, open `index.html`
directly or serve the folder — see below.

**License:** source-available, not open source. No LICENSE file means all
rights reserved by default — this repo is public so the "nothing you paste is
uploaded" claim is checkable, not an invitation to redistribute or relaunch it
as your own product.

## Why this exists

Full research and reasoning is in the project memory (see `/Users/bruno/.claude/projects/-Users-bruno-Code-boring-apps/memory/`),
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
control.html            phone-control remote (opt-in, off by default — see docs/phone-control-setup.md)
assets/
  style.css             all styling, shared by index.html and every /timers/ page
  app.js                all timer logic, shared the same way
  control.js             control.html's logic — separate file, different DOM shape
  realtime.js            thin Ably pub/sub wrapper for phone control, inert with no key configured
  realtime-config.js     the on/off switch — window.COUNTLINK_ABLY_KEY, empty by default
timers/                 programmatic SEO landing pages (see docs/monetization.md)
  5-minute-timer.html
  ...
scripts/
  build-timer-pages.mjs  regenerates everything in /timers/ + sitemap.xml from one data list
docs/
  monetization.md        step-by-step: analytics, AdSense, Pro/Stripe, growing /timers/
  phone-control-setup.md how to turn on pause/adjust/stop from a phone (currently dark — needs an Ably key)
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

## Phone control (opt-in, currently dark)

`assets/realtime.js` + `control.html` add an optional layer on top of the
sync mechanic above: pause, ±1 min, and stop, pushed from a phone to
whatever screen has the countdown open. It's entirely separate from (and
never a dependency of) the link-is-the-timer mechanic — with no Ably key
configured, `window.COUNTLINK_ABLY_KEY` is empty, the checkbox that turns
it on never appears, and every code path in `realtime.js` no-ops. See
`docs/phone-control-setup.md` for what it does and the one manual signup
step needed to turn it on.

## Adding a new programmatic landing page

The real growth engine (per vClock's model — see `docs/monetization.md`) is
having many indexed pages, each targeting one specific search query, all
funnelling into the same tool.

1. Open `scripts/build-timer-pages.mjs`.
2. Add a new entry to the `PAGES` list at the top — every field must be
   **unique** (title, meta description, intro paragraph). Duplicate content
   across pages is the most common reason these get filtered out of Google's
   index instead of ranked.
   **Also file the slug in `GROUPS`**, just above `PAGES`. The index rail
   renders from `GROUPS`, so an unfiled page would never appear in site
   navigation — the build refuses to run rather than let that ship silently.
3. Run:
   ```bash
   node scripts/build-timer-pages.mjs
   ```
   This regenerates every file in `/timers/` plus `sitemap.xml` from the
   template, so editing shared structure only ever happens in one place.
4. Commit the new `/timers/<slug>.html` file and the updated `sitemap.xml`.

## Layout

Redesigned July 2026. Until then every page was `main.wrap` at 1000px centred,
with the board stacked under a hero — one skeleton across all 38 pages, which
is what made the site read as templated.

The page is now an **instrument panel**: a `.chassis` spec strip across the
top, then a `.rig` grid of two tracks — a fixed index rail listing all 29
timers under their `GROUPS` headings, and the working area. Nothing is centred;
the grid places things. Hard corners throughout, hairline rules between cells,
micro-labels in mono, and exactly **one signal colour** which means *live* —
if the red is on the page, something is counting.

The one thing deliberately **not** flattened is the split-flap board. A
departure board is dark with light flaps, and it is the most distinctive asset
across all three of these sites, so it keeps its dark chassis while the page
around it turns light. That inversion is the whole idea: the panel is quiet,
the instrument mounted on it is the only thing competing for your eye. In CSS
this is done by token scoping — `:root` aliases the old dark-surface names
(`--paper-text`, `--panel`, `--board-deep`…) to panel values, and `.board`
re-declares them dark for its own subtree.

## The board is the input

As of August 2026 the split-flap board is not just a readout — on a board that
isn't running, you set the countdown **on the flaps themselves**. This came out
of watching a first-time visitor try to touch the digits and find nothing: the
tiles are the largest, most button-like objects on the page (92x130px on
desktop) and were completely inert, while the real duration controls sat 282px
below the fold behind the ad slot. vClock and online-stopwatch.com both use
read-only displays too, so this is a genuine differentiator rather than
catch-up.

**One rule governs it: settable when idle, sealed when live.** `setState()`
toggles `.board.settable`, and that is the only place the rule lives. A running
or shared board has the controls removed from the DOM entirely — not hidden in
CSS — because the product promise is that everyone opening a link sees the
identical countdown, so a viewer must have nothing to press. Three independent
guards enforce it (`buildTiles()` only builds controls when settable,
`setState()` strips them on the way into a live state, and every CSS rule that
reveals a control is gated behind `.board.settable`); `test/settable-board.test.mjs`
fails if any of the three is removed.

**The value model is one duration, held as total seconds** — never three
independent digit wheels. That is what gives carry and borrow: rolling seconds
up from 59 adds a minute rather than wrapping and silently shortening the
countdown by 59 seconds. It also means the hours pair can grow and retract on
its own, so there is no "mode" for anyone to manage. The pure functions
(`clampTotalSeconds`, `fieldsFromTotal`, `parseKeypadDigits`, `bumpTotal`,
`parsePastedDuration`, `needsHours`) live in one block in `app.js` above the
announcements section and are exported for the test runner.

Input paths: chevrons on hover/focus, arrow keys (shift = 10), typing like a
microwave keypad (digits fill from the right; `9000` normalises to 1:30:00),
scroll wheel, vertical drag on touch, and paste (`1:30:00`, `90m`, bare `45` =
minutes). A slim `+hr` ghost sits where the hours pair will appear; a zeroed
hours field swaps its own down-chevron for `− Hrs`.

Two things that look like details and are not:
- **Chevrons are absolutely positioned overlays** so they never enter layout
  flow. `.board` reserves the tile row's height via `--th` before JS runs (a
  measured CLS fix); anything that pushed the row around on hover would hand
  that back. Measured CLS after the change is 0.
- **`touch-action` is `pan-y` until a field is focused**, then `none`. Claiming
  the vertical axis unconditionally means a swipe starting on the board — which
  fills most of a phone screen — doesn't scroll the page. Tap to engage, then
  drag.

Opted out entirely: days-mode boards (date targets like Christmas render one
plain string, and a date picker is the right control for a date), count-up,
interval and agenda boards, and any page with no `#tiles`.

**Chrome sync.** CountLink pre-dates the template engine, so `index.html`,
`about`, `how-it-works`, `compare` and the three legal pages are real files
rather than generated ones. Rather than retrofit them to a generator, the two
blocks that must be identical everywhere — the chassis and the timer index —
are generated in `build-timer-pages.mjs` and written into those files between
`CHROME_START`/`CHROME_END` and `INDEX_START`/`INDEX_END` markers on every
build. Don't hand-edit between the markers; a test compares each hand-written
page's chassis against a generated one and fails if they drift.

Below 900px the index rail moves *below* the working area via flex `order`, so
the board is still the first thing on the page on a phone. That is this site's
one hard layout rule — you open it to hand a room a clock.

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
   values in `index.html` from `countlink.app` to the real domain, then
   re-run the build script and redeploy.

## Domain name research

Availability confirmed via direct registry RDAP on 2026-07-07 (Verisign for
`.com`, Google Registry for `.app`, Identity Digital for `.io`, GoDaddy WHOIS
for the rest); pricing confirmed via a live Porkbun quote the same day:

| Domain | Status | 1st year | Renews at |
|---|---|---|---|
| countlink.com | **Taken** — registered, parked/unresolvable, unrelated holder (not a live brand, just unavailable to buy without approaching them) | — | — |
| countlink.app | Available | $8.75 | $14.93/yr |
| countlink.io | Available | $28.12 (sale) | $51.80/yr |
| countlink.dev | Available | $8.75 | $12.87/yr |
| countlink.co | Available (not in Porkbun's default results — search `.co` directly) | — | ~$25–30/yr typical |
| countlink.link | Available (confirmed via WHOIS; also not in Porkbun's default TLD set — search `.link` directly) | — | — |
| countl.ink | Available — domain-hack split ("count" + Iceland-style `.ink` gTLD) | $2.06 | $26.26/yr |
| count.link | Available but **premium-priced** — a short dictionary word on `.link` | $382.61/yr flat | $382.61/yr |

Recommendation: **countlink.app** over countlink.io. Both are equally modern
and trustworthy-feeling for a web tool, `.app` enforces HTTPS by default (a
small built-in security/trust signal), and at $14.93/yr renewal vs $51.80/yr
for `.io` it's roughly $185 cheaper over 5 years for no real downside. Only
reason to pick `.io` instead: if you specifically don't want to explain a
newer TLD to a less tech-savvy audience — `.io` reads as slightly more
conventional to some users, `.app` less universally recognized (yet). Skip
`countl.ink`/`count.link` — cute wordplay, but harder to say aloud correctly
and the premium pricing on `count.link` isn't worth it for the novelty.

## Git / version control

This folder is a plain directory today; see the setup steps run as part of
this task (git init, `.gitignore`, initial commit) so it's ready to push to
GitHub whenever you want.

## Monetization

See `docs/monetization.md` for the full, ordered checklist (analytics →
AdSense application → ads.txt → growing `/timers/`). Pro/Stripe is
deliberately deferred, not part of the launch checklist — see that doc's
Step 4 for why and when to revisit it.

## SEO / backlink outreach

See `docs/seo-outreach-plan.md` for the full plan — designed to run
agent-first with minimal check-ins, not as a manual checklist. Day to day,
one command tells you everything:

```bash
node scripts/outreach-status.mjs             # what's done, what an agent can act on, what needs Bruno
```

After changing the pitch copy or target list in
`scripts/generate-submission-kit.mjs`, re-sync the ledger (this never
touches existing progress, only adds new targets):

```bash
node scripts/generate-submission-kit.mjs
node scripts/outreach-status.mjs sync
```
