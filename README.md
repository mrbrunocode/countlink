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

## The URL contract: `#t=` vs `#for=`

There are two shapes of link, and the difference is the product:

| Shape | Means | Written by |
|---|---|---|
| `#t=<epoch ms>` | a **running** countdown, one fixed instant every screen agrees on | `makeLink()`, when someone presses start |
| `#for=<duration>` | a **setup** link — the board opens preloaded at that duration, ready but not started | anyone, in advance, by hand |

`#for=` exists because until it did, **only a human in a browser who had
already pressed start could produce a working CountLink URL** — the share link
carries an absolute timestamp, so nothing that doesn't know the current epoch
time could write one. That ruled out every context that wants to write a timer
down in advance: an AI assistant answering "give me a 25 minute shared timer"
(the largest traffic channel this site has), a bookmark, a calendar invite, a
lesson plan, a saved OBS scene.

It accepts the same grammar the board accepts on paste — `25m`, `1h30m`,
`90s`, `5:00`, `1:30:00`, `45` — by calling the very same
`parsePastedDuration()`, so there is only one duration syntax on the whole
site. Add a label with `&l=`. Works on any timer page.

**A setup link deliberately does not start itself.** If it did, three people
opening the same `#for=25m` would each get their own countdown from whenever
they clicked — the per-visitor "evergreen countdown" deliberately rejected in
`docs/` and the exact opposite of "one fixed instant, identical on every
screen". `e2e/setup-link.spec.mjs` fails if that ever changes.

The one exception is **`&go=1`**, which starts on load. It is opt-in precisely
so "a shared link never auto-starts" stays a visible rule rather than a hidden
per-page exception, and it exists for the OBS overlay — a Browser Source is one
scene on one machine with every control stripped out and no link to copy from
it, so there is no second viewer to fall out of sync with. The full overlay URL
is `/embed/?overlay=1#for=10m&go=1`; **both halves matter** — `/embed/` is the
ad-and-analytics-free build, `?overlay=1` is what actually makes it
transparent. Never hand out `/?overlay=1` (see `docs/overlay-ads.md`: it
redirects to `/embed/` too late to stop the preload scanner queueing the ad
scripts, and ads on a content-free screen is a live AdSense violation).

## The MCP server (`/mcp`)

`functions/mcp.js` is a Cloudflare Pages Function exposing CountLink over the
Model Context Protocol, so an assistant can *hand someone a working link*
rather than telling them to go and make one. Two tools, both genuinely
read-only (there is no backend — a timer is string arithmetic over a
duration): `create_timer` and `describe_timer_link`.

Deliberately one self-contained file with no imports: Pages routes
`functions/mcp.js` → `/mcp`, and keeping the logic in the same module means
`test/mcp-server.test.mjs` exercises the exact bytes that deploy, with no
build step and no second copy to drift. It re-implements
`parsePastedDuration()` because a Worker can't import a browser script that
touches the DOM — a drift risk that is covered by a test running a shared
corpus through both implementations.

`.github/workflows/deploy.yml` builds `dist/` with a **deny-list** rsync, so
`functions/` ships by default; a test asserts it is never added to that list,
because doing so would take `/mcp` off the internet with nothing failing.

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

## Ads, and where they are not

One ad unit per page, and it sits **below** the setup panel — never between the
board and its own controls, which is where it used to sit and what put the
duration controls 282px below the fold. `test/ad-placement.test.mjs` fails if it
moves back up, if a second unit appears, or if any ad code returns to `404.html`.

`?overlay=1` screens carry no ad code at all. That took three attempts and is
worth reading before touching any of it: see `docs/overlay-ads.md`, and note
that removing the `<ins>` and skipping the `push()` is **not** sufficient on its
own — the AdSense library injects its own auto-ad `<ins>` afterwards.

## Stopwatch laps

A count-up board grows a **Lap** button and a split list. Laps are recorded on
the screen that pressed the button and stay there — the link carries one
instant, and a lap happens after that instant, so there is nothing to encode.
The page says so rather than implying laps are shared; every other promise this
site makes about the link is literally true and this one could not be.

Splits are derived from the marks on every read rather than stored, so the list
cannot disagree with itself. Pure functions (`lapRows`, `fmtLap`,
`lapExtremes`) are exported and covered by `test/laps.test.mjs`; the click flow
is covered cross-browser in `e2e/overlay-and-laps.spec.mjs`.

## "Your time"

The board's `ends at` / `started at` line names the reader's own zone, and adds
a day when the instant is not on their today. The end of a countdown was always
an absolute instant rendered per-device — this just says so, which is the
sentence that matters for the webinar, Zoom and study-group pages.
`localEndLabel` is pure and takes `now` explicitly, so `test/local-time.test.mjs`
can pin both sides of a midnight boundary without touching the clock.

## The embed builder

The one feature here whose point is off-site. Width, height, board style and
fixed-vs-fluid, producing a live-updating `<iframe>` snippet — now on the
homepage too, which previously had no embed feature at all despite being 66% of
pageviews.

Two things must not drift, both covered by `test/embed-builder.test.mjs`:

- the frame is served from **`/embed/`**, the only path `_headers` exempts from
  `X-Frame-Options: DENY` (the widget silently failed to load on every
  third-party site until that was found) and the only copy with no ad or
  analytics tags;
- the attribution `<a>` sits **outside** the iframe. A link inside a frame is
  attributed to the frame's own document, so an iframe alone earns no link
  back — and referring domains are the single metric that has never moved for
  this domain.

`?style=` on `/embed/` applies a board style without writing to localStorage:
the host page picked it, not the reader, and an embedded board must never change
the style of the full site in the same browser.

## The agenda run of show

`/timers/agenda-timer` renders a printable table of the running order — segment,
length, and the wall-clock window each one occupies, in the reader's own
timezone. Derived from the same segment list and the same `boundaries()` the
timer itself uses, so the sheet and the clock cannot disagree;
`test/run-sheet.test.mjs` asserts that property directly rather than just
checking the numbers match. `@media print` drops the builder, nav and ad and
leaves the table.

## Icons

`assets/icons/*.png` are generated by `scripts/build-icons.mjs` from the same
geometry as `assets/favicon.svg`, so the raster set cannot drift away from the
vector mark. It is **not** part of the content build — run it by hand when the
mark changes:

```bash
node scripts/build-icons.mjs
```

No dependencies: the rasteriser and the PNG encoder are both in that file, and
`node:zlib` does the compression.

Two things it fixes, neither of which is visible on the site itself:

- **Safari ignores an SVG `apple-touch-icon`**, and every page pointed at the
  SVG — so "Add to Home Screen" on iOS put a screenshot of the page on the
  home screen. It is a 180px PNG now.
- **`manifest.json` declared one SVG icon.** Android's install flow wants a 192
  and a 512 PNG, plus a `maskable` variant so the launcher can crop to its own
  shape. The maskable one is the same mark scaled to fit inside the guaranteed
  40%-radius safe circle — `test/icons.test.mjs` samples the artwork and fails
  if anything but flat background falls outside it.

The six hand-written static pages (`/about`, `/compare`, …) carried neither the
manifest nor a touch icon, so installing from them did nothing. They do now.

## Tests

Two layers, run separately:

```bash
npm test          # node --test — pure logic, ~1s, zero dependencies
npm run test:e2e  # Playwright — 5 browser projects against the real dev server
npm run test:all  # both
```

`node --test` covers the duration model, hash parsing, phone-control maths and
the page/URL invariants. It stays dependency-free and fast, and it is what the
build guard leans on.

The Playwright suite (`e2e/`) covers what pure tests structurally cannot:
whether the settable board's *interaction* survives a different engine. It runs
Chromium, Firefox, WebKit, and real device emulation for iPhone (WebKit) and
Pixel (Chromium) — the last two matter because touch has no hover at all, so
tap-to-reveal is the only way to reach the chevrons there.

Two real bugs were invisible to Chromium alone and only surfaced once the
suite ran cross-browser:
- the clipboard handler was bound to `#tiles`, which is the only place Chromium
  delivers a paste made over a non-editable element — Firefox and WebKit
  dispatch it at the document, so paste silently did nothing in both;
- `.rig` set `align-items:start` for the desktop grid, which carried into the
  mobile flex column and stopped `.rig-main` stretching, so the AdSense `ins`
  tag's negative margin pushed it ~36px wider than the viewport and clipped the
  board's right edge on phone widths. `html{overflow-x:hidden}` had been hiding
  the symptom.

Writing the suite also exposed that <kbd>Esc</kbd> did nothing: it re-read
`#customMin`, which the board itself writes to on every edit, so "undo my
rolling" restored exactly what you had just rolled. It now restores the last
duration that came from outside the board.

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
