# Product Hunt gallery images

Capture assets for the CountLink launch draft
(https://www.producthunt.com/products/countlink?launch=countlink).

Lives under `docs/` deliberately: `.github/workflows/deploy.yml` excludes that
directory and its guard step fails the build if it ever leaks into `dist/`, so
these never become publicly servable.

## How they were captured

Headless Chrome against the live site, not a local build:

    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      --headless --disable-gpu --hide-scrollbars \
      --host-resolver-rules="MAP faves.grow.me 127.0.0.1" \
      --virtual-time-budget=6000 --window-size=1270,760 \
      --screenshot=out.png "https://countlink.app/"

Two things in that command are load-bearing:

- **`--host-resolver-rules` blackholes faves.grow.me.** The Grow.me floating
  button otherwise renders on top of the timer board. That widget is deliberate
  (wired into the build template via `GROW_SITE_ID`, part of the Mediavine path
  in the factory's monetization doc) — it just has no place in a launch image.
  Blackholing it at capture time avoids touching the site to take a screenshot.

- **The split-flap board animates on every tick.** A screenshot at an arbitrary
  moment can catch a card mid-turn and put a half-flipped digit in the gallery.
  Shoot several frames at staggered `--virtual-time-budget` values and check the
  digits enlarged before using one — `sips -c 200 700 --cropOffset 100 480` over
  the board region makes a mid-flip obvious. Every image here is verified
  fully-turned.

Do not capture the mobile view this way: headless Chrome applies no device
emulation, so `--window-size=390,844` renders the desktop layout in a narrow
window and clips it. That looks like a rendering bug and isn't one — the live
site is clean at a real 375px viewport.

## The set

Recaptured 2026-09-26 after that day's deploy (the running board lost its
"Download offline copy" button to the share panel and gained a labelled
alarm-tone picker; the hero is the compact short-screen layout, since
1270×760 is under the 900px-tall breakpoint; /features now counts 34).
Before that, recaptured 2026-09-17 — the Aug 3 originals had gone stale (hero's "00 servers
to run this" stat was replaced by the three-screens sync illustration on
2026-09-06; the running board was missing the "Download offline copy" button;
nav bar was missing the Features link on all three). Always re-diff against
the live site before an actual launch day if time has passed since capture —
this project's shipped-feature rate means a few weeks is enough to date these.

| File | Shows |
|---|---|
| `01-hero.png` | Headline, value proposition, the one-link/three-screens sync illustration, trust row (no signup · works on any device · share by link, QR or join code) |
| `02-running-board.png` | Live countdown at 04:49 labelled "Break ends", "ends at ... synced on every screen with this link", the running-state row on one line: Copy sync link · Stop · Fullscreen · Sound · Tone |
| `03-compare.png` | The honest comparison table (clips the Leaderboarded column — the table is wider than the viewport) |
| `04-features.png` | The `/features` page — "34 things, all of them free, none of them behind an account". Strong candidate for a 4th gallery slot; scrolling further into it also reaches the MCP-server-for-AI-assistants feature, which is worth a dedicated crop given the SEO data showing AI assistants are CountLink's largest traffic channel. |

To recapture any of these later, the command is unchanged (see above); for
`02-running-board.png` specifically, build a `#t=<epoch-ms 5 min out>&l=Break%20ends`
URL fragment rather than trying to screenshot the idle board mid-click, since
headless Chrome can't drive the start button and wait for the hash-driven
re-render in one pass.

Product Hunt auto-pulled the site's own OG card as the lead gallery image, which
is a stronger lead than any of these; these are the supporting slots.
