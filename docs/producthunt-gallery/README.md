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

| File | Shows |
|---|---|
| `01-hero.png` | Headline, value proposition, "00 servers to run this", idle board at 10:00 |
| `02-running-board.png` | Live countdown at 04:59, "synced on every screen with this link" |
| `03-compare.png` | The honest comparison table (clips the Leaderboarded column — the table is wider than the viewport) |

Product Hunt auto-pulled the site's own OG card as the lead gallery image, which
is a stronger lead than any of these; these are the supporting slots.
