# Phone control — status: LIVE (since 2026-07-26; permissions reworked 2026-09-26)

Closes the sharpest gap `/compare` names against Leaderboarded: "you display
the countdown on the class board and drive it from your phone." Bruno created
the Ably account and a scoped API key himself (account creation isn't
something the assistant does).

## What it is

- A "Let me pause, adjust, or stop this from my phone" checkbox in the setup
  panel (homepage and `/embed/`), shown when `assets/realtime-config.js` sets
  `COUNTLINK_PHONE_CONTROL = true`.
- With it ticked, Start gives the countdown a **session id** (`&c=` in the
  share link) and this tab a secret **control key**. A "Copy control link" /
  QR action appears, pointing at `/control.html#t=…&k=<key>`.
- `/control.html`: Pause/Resume, −1 min, +1 min, Stop, and a short flash
  message. Every change reaches the host board **and every viewer** live.
- A viewer (anyone with the share link) sees every change as it happens and
  **can't make any**.

## Who can do what — and why it changed (2026-09-26)

**The bug:** v1 put one id in every link and signed every connection with a
single Ably key shipped in public page source. Anyone sent the share link
could open `/control.html` with the same hash, or just keep the page open,
since every viewer tab rebroadcast state, and pause, stop or flash text onto
the room's projector. "Sealed when live" held for the board's own buttons and
nothing else.

**The model now:**

| Value | Where it lives | What it grants |
|---|---|---|
| **key** — 16 random bytes, base64url | the host tab's `localStorage` (`countlink_control_keys`, pruned after 2 days) and the control link. **Never the address bar.** | publish + subscribe |
| **sid** — first 12 bytes of `SHA-256("countlink-control-v1:" + key)`, base64url | the share link (`&c=`) | subscribe only |

- **Auth:** `functions/api/realtime-token.js` holds the only Ably key (Pages
  secret `ABLY_API_KEY`) and returns signed, one-channel, one-hour
  TokenRequests. `{sid}` gets subscribe on `countlink:<sid>`. `{key}` gets
  publish + subscribe on `countlink:<sha256(key)>`: the server derives the
  channel itself, so a caller can't name one. There is no storage: the key is
  its own proof.
- **Hashing:** the browser uses a small synchronous SHA-256 in
  `assets/realtime.js`, because `crypto.subtle` is async and missing on plain
  `http://` LAN origins. The server uses `crypto.subtle`.
  `test/realtime.test.mjs` cross-checks both against `node:crypto`.
- **Who publishes:** the host board (heartbeat every 4s, plus after each
  command) and the controller. Viewers apply commands they receive, so they
  react instantly, but never publish. A viewer pressing Stop stops only their
  own screen.
- **Host closed:** the laptop that started it goes away. The controller,
  which is the only other key-holder, takes over the 4s heartbeat once it has
  heard at least one real state message and then nothing for 6s. A late joiner
  still catches up to a pause. The controller never broadcasts an
  *unconfirmed* guess, which could un-pause every screen.
- **Address bar is safe to share:** the host's own URL only ever shows the
  sid, and a reload recovers the key from `localStorage`.
- **QR codes are drawn locally** (`assets/vendor/qrcode-2.0.4.js`). The
  control link's QR used to be sent to goqr.me. Once that link carried a key,
  sending it there would have leaked it.

**Old links:** a control link from before 2026-09-26 carries `c=` and no key.
`/control.html` says it's from an older version and to start again with
phone control ticked. A current *share* link pasted into `/control.html`
says it can watch but not control. Countdowns themselves keep working either
way. Only phone control on a session started before the deploy stops.

## Key rotation — DONE 2026-09-26

The key that used to sit in `assets/realtime-config.js` (`countlink-control`,
`FxZdIQ.RZbDhg`) is in this public repo's git history, so it was rotated the
same day as the fix:

- New key **`countlink-token-signing`** (`FxZdIQ.dS_0KA`): Publish +
  Subscribe only, restricted to channels `countlink:*`. Verified against Ably
  REST: tokens for `countlink:<sid>` are issued with exactly the requested
  capability, and a token for any other channel is refused ("intersection of
  key capabilities … is empty").
- Stored only in the Pages secret `ABLY_API_KEY` (production). It went there
  straight from the dashboard's copy button via the clipboard, so it isn't in
  any file, commit or transcript. The clipboard was cleared after.
- Production redeployed and checked: `/api/realtime-token` signs with
  `dS_0KA`, and a controller → host + viewer pause round trip works over the
  real network.
- The old key was **revoked** in the dashboard. Ably now answers it with
  `40131 Key revoked`.

The other two keys on the app ("Subscribe only" `scK0Xg`, "Root" `Anyucw`)
were left as they were. Neither appears anywhere in the site.

**To rotate again:** Ably dashboard → CountLink → API Keys → *Create key*
(Publish + Subscribe; Resource restrictions → Only channels → `countlink:*`)
→ copy it → `pbpaste | npx wrangler pages secret put ABLY_API_KEY --project-name countlink`
→ re-run the Deploy workflow → confirm `/api/realtime-token` returns the new
`keyName` and a real pause works → then revoke the old key. Revoke last:
revoking first breaks phone control until the deploy lands.

`ABLY_API_KEY` must always be the only copy. `test/realtime.test.mjs` fails
if anything shaped like an Ably key appears in page source again.

## Usage (Ably dashboard, read 2026-09-26)

This month: 6,083 inbound and 9,687 outbound messages (about 0.3% of the free
tier's 6M), peak 16 concurrent connections (limit 200), peak 8 channels.
Traffic is almost all in two one-hour bursts (about 3,800 messages in early
September, 4,549 around 02:00 BST on 2026-09-26), with near-zero between. That's
the shape of a controlled board left open with viewers attached. Before
2026-09-26 every open tab re-broadcast state every 4s. Now only the host
board (or the controller, as a fallback) does, so the same session costs a
fraction of the messages. Re-check monthly beside the other stats. There's
plenty of headroom, and a sudden rise would be the first sign of abuse.

## Local development

`node scripts/dev-server.mjs` runs `functions/` in-process, so
`/api/realtime-token` answers locally. Without `ABLY_API_KEY` in the
environment it returns 503 and phone control fails quietly, exactly as
production does if the secret is missing. For a real end-to-end check:
`ABLY_API_KEY=<a key> node scripts/dev-server.mjs 4175`. The e2e suite
(`e2e/phone-control.spec.mjs`) uses a stand-in Ably that enforces token
capabilities, plus a dummy key to sign with (`playwright.config.mjs`).

## Why Ably, and why this doesn't quietly become "yet another server-dependent timer"

The countdown itself is still link-is-the-timer. Phone control is an optional
layer on top: a pub/sub relay carries small control messages and nothing
else. If the relay or the token endpoint is down, misconfigured or blocked,
the countdown keeps counting. Every method in `assets/realtime.js` fails
silently rather than throwing.

Ably's free tier is plenty: 6M messages/month, 200 concurrent connections. A
classroom session uses a few dozen messages.

## Copy to keep in sync

`index.html` (FAQ and its JSON-LD twin), `about.html`, `compare.html`,
`how-it-works.html`, the `/features` inventory (`FEATURES` in
`scripts/build-timer-pages.mjs`) and `privacy.html` (what goes to Ably, and
the key in `localStorage`) all describe phone control. If it changes shape,
update them together. This site's voice rests on not overclaiming.

## Known limitations

- **Down-mode countdowns only.** Stopwatch and interval timers have no single
  "remaining" value to pause on.
- **No presence indicator.** The controller says "waiting to hear from the
  board" if no state arrives within 8s, but can't list connected screens.
  Ably presence could add that later.
- **Host and controller both closed** means no key-holder is left to
  heartbeat. Screens already open still got every change live, but one that
  opens the link later shows the link's original deadline until a key-holder
  returns.
