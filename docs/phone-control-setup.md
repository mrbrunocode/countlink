# Phone control — turning it on

Closes the sharpest gap `/compare` names against Leaderboarded: "you display
the countdown on the class board and drive it from your phone." Built
2026-07-26, **off by default and not yet live** — the code ships inert
until you do the one manual step below, because there's no server to hide
an API key behind and this can't be provisioned by an assistant (creating
third-party accounts is outside what it will do on its own).

## What it is

- A "Let me pause, adjust, or stop this from my phone" checkbox in the
  setup panel. Off (and hidden) by default.
- When checked and a countdown is started, the board gets a session id
  (`&c=...` in the link) and a second "Copy control link" / QR action
  appears, pointing at `/control.html`.
- `/control.html` is a bare page — Pause/Resume, −1 min, +1 min, Stop.
  Whatever it does updates the classroom board **and every other viewer
  who has the same link open**, live.
- No key configured → the checkbox and control-link UI never appear at
  all. Nothing to half-ship, nothing for a visitor to notice.

## Why Ably, and why this doesn't quietly become "yet another server-dependent timer"

The countdown itself is still 100% link-is-the-timer — no account, no
backend, works if Cloudflare Pages disappeared tomorrow. Phone control is
a genuinely separate, optional layer on top: a pub/sub relay carries
tiny control messages (pause/adjust/stop), nothing else. If the relay is
down, misconfigured, or blocked by an ad blocker, the countdown keeps
counting exactly as it always has — see `assets/realtime.js`, every method
fails silently rather than throwing.

Ably's free tier (no card required at signup) is generous enough for this:
6M messages/month, 200 concurrent connections. A single classroom session
uses maybe a few dozen messages total.

## Setup (5 minutes, one-time)

1. Go to ably.com and create a free account.
2. In the dashboard, create a new API key scoped to **only** "Publish",
   "Subscribe", and "Presence" capability, restricted to channels matching
   `countlink:*`. Don't use the default root key — this key ships in
   public page source (there's no server to hide it behind), so scoping
   it tightly means a copy of it is only ever good for this site's
   countdown pub/sub, never account administration.
3. Paste the key into `assets/realtime-config.js`:
   ```js
   window.COUNTLINK_ABLY_KEY = "your-key-here";
   ```
4. Run `node scripts/bump-asset-version.mjs` (realtime-config.js itself
   isn't version-stamped like style.css/app.js, but you're likely touching
   other things around the same time — cheap to run regardless) and
   deploy as normal.
5. Verify with two devices (or two tabs): start a countdown with the
   checkbox on, open the control link on the second device, confirm
   Pause/Resume/±1 min/Stop all show up on the first.

## Once it's actually live

Update the marketing copy to match reality — it deliberately hasn't been
touched yet:
- `compare.html`: the "Control display from your phone" row currently
  says CountLink can't do this (`No`) — flip it once the key is live, and
  reconsider the surrounding paragraph that explains this as the one thing
  Leaderboarded does that CountLink doesn't.
- `about.html`: the "Beyond the link" paragraph lists what runs on the
  no-server mechanism (OBS overlay, QR, install-as-app) — phone control
  belongs there too once it's real.
- `index.html`'s "Beyond the link" FAQ section, similarly.

Don't update any of the above before the key is configured — this app's
entire voice is built on not overclaiming, and a described-but-dark
feature is exactly the kind of thing it calls out competitors for
elsewhere on this site.

## Known limitations (v1, worth stating plainly rather than fixing)

- **Down-mode countdowns only.** Stopwatch (count-up) and interval/Tabata
  timers don't support phone control — no clean single "remaining" value
  to pause on a moving reference point. The checkbox and control link only
  ever appear for a plain countdown.
- **A hard refresh mid-pause loses the pause** on a tab that wasn't
  connected when it happened, until the next ~4s heartbeat state broadcast
  catches it up (see `app.js` `realtimeHeartbeat`).
- **No "is anyone actually connected" indicator.** The controller can send
  Pause into the void if the board tab was closed; Ably's presence API
  could add a "display connected" status later (see the header comment
  in `assets/realtime.js`) — deliberately left out of v1 to keep scope
  bounded.
- **Symmetric, not server-authoritative.** Every tab with the same link
  applies commands and rebroadcasts state itself (see `app.js`
  `connectRealtimeIfNeeded()`) — there's no single "board" role. Fine for
  the realistic case (one board, one controller), but two people both
  mashing Pause/Resume at once could very briefly flicker before
  converging. Not worth solving for a feature this low-stakes.
