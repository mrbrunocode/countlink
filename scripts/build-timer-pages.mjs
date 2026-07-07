#!/usr/bin/env node
/**
 * Generates the /timers/*.html programmatic landing pages.
 *
 * Why this exists: vClock's ~$500K/yr in AdSense revenue does not come from its
 * homepage — it comes from hundreds of indexed pages like /set-timer-for-5-minutes/,
 * each targeting one long-tail search query and funnelling into the same tool.
 * This script is our version of that: add a row to PAGES below, re-run this
 * script, commit the new files. See docs/monetization.md for the full strategy.
 *
 * Usage:
 *     node scripts/build-timer-pages.mjs
 *
 * Regenerates every file in /timers/ from the single template below, so editing
 * the shared header/footer/copy in one place updates every page consistently.
 */
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { NAME, SITE_URL } from "./site-config.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, "timers");

// Each row is one indexed landing page. slug -> filename (timers/<slug>.html).
// minutes: preset duration the tool boots into.
// title / h1 / meta: unique per page — never copy these verbatim between rows,
// duplicate title/meta tags are the #1 reason programmatic pages get filtered
// out of Google's index instead of ranked.
const PAGES = [
  { slug: "5-minute-timer", minutes: 5, label: "Time's up", eyebrow: "5 Minute Timer",
    h1: "5 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 5 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
    intro: "Five minutes is long enough for a quick break, a lightning talk, or the last leg of a board game turn — and short enough that everyone actually watches it end. Press start, then send the link to anyone else who needs to see the same five minutes tick down." },
  { slug: "10-minute-timer", minutes: 10, label: "Time's up", eyebrow: "10 Minute Timer",
    h1: "10 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 10 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
    intro: "Ten minutes covers a coffee break, a standup, or a timed writing sprint. Start the countdown here and share the link — no app to install, no account for anyone else to make." },
  { slug: "15-minute-timer", minutes: 15, label: "Time's up", eyebrow: "15 Minute Timer",
    h1: "15 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 15 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
    intro: "Fifteen minutes is a classic break length and a common quiz-round or lightning-talk limit. Set it once, share the link, and every screen in the room counts down together." },
  { slug: "20-minute-timer", minutes: 20, label: "Time's up", eyebrow: "20 Minute Timer",
    h1: "20 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 20 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
    intro: "Twenty minutes works well for a workshop segment or a timed exercise. Start it here, copy the sync link, and hand it to the room." },
  { slug: "25-minute-timer", minutes: 25, label: "Pomodoro break", eyebrow: "25 Minute Timer",
    h1: "25 Minute Timer — The Pomodoro Length, Shareable",
    meta: "A free 25 minute Pomodoro-length timer you can share with a study group or coworking room — everyone's screen counts down in sync.",
    intro: "Twenty-five minutes is the classic Pomodoro focus block. Start it solo, or share the link with a study group or co-working session so everyone's break lands at the same moment." },
  { slug: "30-minute-timer", minutes: 30, label: "Time's up", eyebrow: "30 Minute Timer",
    h1: "30 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 30 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
    intro: "Half an hour is enough for a workshop exercise, a half-length meeting, or a timed test section. Start the countdown and share the link with anyone who needs to see the same clock." },
  { slug: "45-minute-timer", minutes: 45, label: "Time's up", eyebrow: "45 Minute Timer",
    h1: "45 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 45 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
    intro: "Forty-five minutes is a common class period and workshop-session length. Start it here and put it on the projector — every phone in the room can pull up the same link." },
  { slug: "60-minute-timer", minutes: 60, label: "Time's up", eyebrow: "1 Hour Timer",
    h1: "1 Hour Timer — Free, Shareable, In Sync",
    meta: "A free 1 hour timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
    intro: "One hour covers a full class, a standard exam block, or a meeting you'd like to actually end on time. Start the countdown and share the link so nobody has to ask how long is left." },
  { slug: "exam-timer", minutes: 60, label: "Time is up — pens down", eyebrow: "Exam Timer",
    h1: "Exam Timer — One Countdown For The Whole Room",
    meta: "A shareable exam timer for classrooms and test centres. Every invigilator's screen and every student device shows the identical countdown to the second.",
    intro: "Put the countdown on the front screen and, if students have devices, on theirs too — everyone sees the identical time remaining, which is the whole point of a fair exam clock. Set it to your exam length and share the link before the paper starts." },
  { slug: "classroom-timer", minutes: 10, label: "Back to it", eyebrow: "Classroom Timer",
    h1: "Classroom Timer — For Group Work, Quizzes And Transitions",
    meta: "A free classroom timer built for transitions, group work and quiz rounds — project it or share the link so every student sees the same countdown.",
    intro: "Group work, quiz rounds, silent reading, transition time between activities — a visible shared countdown ends the “how much longer” questions on its own. Project it fullscreen or share the link to student devices." },
  { slug: "webinar-countdown", minutes: 5, label: "We're starting", eyebrow: "Webinar Countdown",
    h1: "Webinar Countdown — Show Attendees Exactly When You Start",
    meta: "A shareable pre-webinar countdown. Put the link in your registration email or waiting room so every attendee's screen counts down to the same start time.",
    intro: "Drop this link in your registration confirmation or waiting-room slide. Every attendee who opens it — on any device, in any timezone — sees a countdown to the exact same start moment, because the deadline travels inside the link itself." },
  { slug: "standup-timer", minutes: 10, label: "Standup over", eyebrow: "Standup Timer",
    h1: "Standup Timer — Keep Daily Standups Short",
    meta: "A free shareable standup timer for teams. Set the length once, drop the link in Slack, and everyone sees the same countdown to keep standup on time.",
    intro: "The easiest way to keep a daily standup to ten minutes is a countdown everyone can see. Set the length, drop the link in your team channel, and project it during the call." },
  { slug: "zoom-meeting-timer", minutes: 10, label: "Time's up", eyebrow: "Zoom Meeting Timer",
    h1: "Zoom Meeting Timer — Keep Every Call On Time",
    meta: "A free shared timer for Zoom calls. Start it, copy the link, and drop it in the chat or a second screen so everyone sees the same time remaining.",
    intro: "Screen-sharing a timer inside Zoom works, but it takes over your whole screen. Open this on a second monitor or phone instead, or drop the link in the meeting chat — everyone gets their own synced countdown without you sharing anything." },
  { slug: "google-meet-timer", minutes: 10, label: "Time's up", eyebrow: "Google Meet Timer",
    h1: "Google Meet Timer — A Shared Countdown For Video Calls",
    meta: "A free shared timer for Google Meet. Copy the link into the meeting chat and everyone's own screen counts down in sync — no extension, no screen share.",
    intro: "Paste the link into the in-call chat the moment the meeting starts. Nobody needs to install an extension or watch your shared screen — everyone's own tab counts down to the exact same second." },
  { slug: "obs-countdown-timer", minutes: 5, label: "Starting soon", eyebrow: "OBS Countdown Timer",
    h1: "OBS Countdown Timer — Free Browser Source For Streamers",
    meta: "A free countdown timer built to drop straight into OBS as a browser source — transparent background, no signup, no watermark.",
    intro: "Add the overlay version of this page as an OBS Browser Source and it drops onto your scene with a transparent background — no green screen, no chroma key setup. Set your stream-start countdown, copy the link into OBS, and it's live." },
  { slug: "twitch-stream-timer", minutes: 5, label: "Starting soon", eyebrow: "Twitch Stream Timer",
    h1: "Twitch Stream Timer — Countdown Overlay For Stream Starts",
    meta: "A free stream-starting countdown for Twitch. Use it as a transparent browser-source overlay, or just share the link with mods and co-streamers so everyone's in sync.",
    intro: "Streamers use this the same way as a \"starting soon\" screen — set the countdown, add the overlay version as a transparent browser source, and it counts down on stream. Share the same link with mods or co-streamers and their screens match exactly." },
  { slug: "workshop-timer", minutes: 15, label: "Segment over", eyebrow: "Workshop Timer",
    h1: "Workshop Timer — One Countdown For Every Table",
    meta: "A free shared timer for workshop facilitators. Set the segment length, share the link, and every table or breakout group sees the identical countdown.",
    intro: "Facilitators running breakout groups or table exercises know the problem: one group finishes early, another runs long, because everyone's eyeballing their own phone clock. Share this link instead and every table counts down from the same number." },
  { slug: "group-study-timer", minutes: 25, label: "Break time", eyebrow: "Group Study Timer",
    h1: "Group Study Timer — Study With Me, In Sync",
    meta: "A free shared study timer for study groups and study-with-me sessions. Set a focus block, share the link, and everyone's break lands at the same moment.",
    intro: "Studying with friends or running a study-with-me stream works best when breaks actually line up. Set a focus block here, share the link with your group, and everyone's countdown — and everyone's break — happens at the exact same moment." },
  { slug: "game-night-timer", minutes: 3, label: "Time's up", eyebrow: "Game Night Timer",
    h1: "Game Night Timer — For Turns, Rounds And House Rules",
    meta: "A free shareable timer for board games, party games and game night house rules. Set the turn limit, share the link, and nobody argues about how much time is left.",
    intro: "Every game night needs a turn timer eventually — charades rounds, drafting phases, \"you have sixty seconds to decide.\" Set it once, share the link to everyone's phone, and the countdown settles the argument before it starts." },
  { slug: "auction-countdown", minutes: 5, label: "Bidding closed", eyebrow: "Auction Countdown",
    h1: "Auction Countdown — Synced Bidding Deadline For Every Bidder",
    meta: "A free countdown for live and online auctions. Share the link so every bidder sees the exact same time remaining before bidding closes.",
    intro: "A live auction or limited drop lives or dies on everyone seeing the same deadline. Share this link before bidding opens and every bidder's screen counts down to the identical closing second — no one can claim their clock ran differently." },
];

const BRAND = NAME; // imported from ./site-config.mjs — the one place these values live

const timerLinks = PAGES.map(p => `<a href="${p.slug}.html">${p.eyebrow}</a>`).join("\n          ");
// Same links, but rooted for index.html (one directory up from /timers/).
const rootTimerLinks = PAGES.map(p => `<a href="timers/${p.slug}.html">${p.eyebrow}</a>`).join("\n      ");

const page = (p) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${p.h1} | ${BRAND}</title>
<meta name="description" content="${p.meta}">
<link rel="canonical" href="${SITE_URL}/timers/${p.slug}.html">
<meta property="og:title" content="${p.h1}">
<meta property="og:description" content="${p.meta}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#1c1c1a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&family=Bebas+Neue&family=Martian+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/style.css">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: BRAND,
  url: `${SITE_URL}/timers/${p.slug}.html`,
  description: p.meta,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any (web browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
})}</script>
<!-- ANALYTICS / ADSENSE placeholders — see index.html head and docs/monetization.md -->
</head>
<body>

<header>
  <a class="logo" href="../index.html">${BRAND}</a>
  <div class="head-meta">NO SIGNUP · NO SERVER<br><b>THE LINK IS THE SYNC</b></div>
</header>

<div class="wrap">
  <section class="hero">
    <div class="hero-inner">
      <span class="eyebrow">${p.eyebrow}</span>
      <h1>${p.h1}</h1>
      <p class="lede">${p.intro}</p>
    </div>
    <div class="hero-fact">
      <span class="n">00</span>servers to run this
    </div>
  </section>

  <section class="stage-section">
    <div class="board" id="boardEl">
      <span class="bolt-br"></span><span class="bolt-bl"></span>
      <div class="style-toggle">
        <button type="button" data-style="board">Board</button>
        <button type="button" data-style="minimal">Minimal</button>
        <button type="button" data-style="light">Light</button>
      </div>
      <div class="evt" id="evtLabel"></div>
      <div class="tiles" id="tiles"></div>
      <div class="sub" id="subLine"></div>
      <div class="bar"><i id="barFill"></i></div>
      <div class="stage-btns">
        <button class="btn primary" id="shareBtn">Copy sync link</button>
        <button class="btn" id="fsBtn">Fullscreen</button>
        <button class="btn" id="soundBtn">Sound: on</button>
      </div>
      <div class="sync-note"><span class="dot"></span><span id="syncMsg">Anyone opening your link right now sees exactly this.</span></div>
    </div>
  </section>

  <div class="ad-slot">
    <div class="ad-frame" id="adFrame">Advertisement — 728×90 responsive slot (AdSense unit goes here)</div>
  </div>

  <section class="setup-section">
    <div class="panel">
      <h2>Change the countdown</h2>
      <div class="hint">Already running at ${p.minutes} minutes above — adjust it here if you need something else.</div>
      <label>Direction</label>
      <div class="quick dir-toggle">
        <button class="q active" data-dir="down">Count down</button>
        <button class="q" data-dir="up">Count up (stopwatch)</button>
      </div>
      <div id="durationFields">
        <label>Quick timer</label>
        <div class="quick">
          <button class="q" data-min="1">1 min</button>
          <button class="q" data-min="5">5 min</button>
          <button class="q" data-min="10">10 min</button>
          <button class="q" data-min="15">15 min</button>
          <button class="q" data-min="30">30 min</button>
          <button class="q" data-min="60">1 hour</button>
        </div>
        <div class="stack2">
          <div>
            <label for="customMin">Custom minutes</label>
            <input id="customMin" type="number" min="1" value="${p.minutes}">
          </div>
          <div>
            <label for="untilTime">…or until a date &amp; time</label>
            <input id="untilTime" type="datetime-local">
          </div>
        </div>
      </div>
      <div id="countUpHint" class="hint" style="display:none">Count-up starts from zero the moment you press start — like a shared stopwatch. No duration to set.</div>
      <label for="evtName">What's it for? (shown on every screen)</label>
      <input id="evtName" placeholder="Break ends · Quiz round 2 · Doors open" value="${p.label}">
      <div class="stage-btns" style="margin-top:20px">
        <button class="btn primary" id="startBtn">Start countdown</button>
      </div>
      <div class="share-box" id="shareUrl"></div>
      <button class="pro-link" id="qrBtn" style="margin-top:10px">Show QR code →</button>
      <div id="qrWrap" style="display:none;margin-top:10px">
        <img id="qrImg" width="160" height="160" alt="QR code for the sync link" style="background:#fff;padding:8px;border-radius:6px">
        <div class="hint" style="margin-top:6px">Generated on demand by a third-party QR API (goqr.me) — the only feature on this site that makes an external request. See <a href="../privacy.html" style="text-decoration:underline">Privacy</a>.</div>
      </div>
    </div>
    <div class="pro-banner">
      <span>Running this for clients? <b>Pro</b> removes ads and adds your branding.</span>
      <button class="pro-link" id="proBtn">$5/mo — Unlock Pro →</button>
    </div>
  </section>
</div>

<footer>
  <div class="wrap">
    <div class="foot-links">
      ${timerLinks}
    </div>
    <div class="foot-in">
      <div><div class="fb">${BRAND}</div>A timer you can hand to a room. · <a href="../privacy.html">Privacy</a> · <a href="../compare.html">Vs. ShareMyTimer &amp; Stagetimer</a></div>
      <div>Sync accuracy depends on each device's clock — typically within a second.<br>No data leaves your browser; the timer lives entirely in the link.</div>
    </div>
  </div>
</footer>

<script>window.COUNTLINK_DEFAULT={minutes:${p.minutes},label:${JSON.stringify(p.label)}};</script>
<script src="../assets/app.js"></script>
</body>
</html>
`;

const STATIC_PAGES = ["privacy.html", "compare.html"];

const sitemap = () => {
  const urls = PAGES.map(p => `  <url><loc>${SITE_URL}/timers/${p.slug}.html</loc></url>`).join("\n");
  const staticUrls = STATIC_PAGES.map(f => `  <url><loc>${SITE_URL}/${f}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc></url>
${staticUrls}
${urls}
</urlset>
`;
};

async function syncIndexFootLinks() {
  const indexPath = join(ROOT, "index.html");
  const html = await readFile(indexPath, "utf-8");
  const start = "<!-- FOOT_LINKS_START — auto-synced from PAGES by scripts/build-timer-pages.mjs, do not hand-edit -->";
  const end = "<!-- FOOT_LINKS_END -->";
  const startIdx = html.indexOf(start);
  const endIdx = html.indexOf(end);
  if (startIdx === -1 || endIdx === -1) {
    console.warn("Could not find FOOT_LINKS_START/END markers in index.html — skipped syncing footer links.");
    return;
  }
  const before = html.slice(0, startIdx + start.length);
  const after = html.slice(endIdx);
  const updated = `${before}\n      ${rootTimerLinks}\n      ${after}`;
  if (updated !== html) {
    await writeFile(indexPath, updated, "utf-8");
    console.log("Synced index.html footer links to match PAGES.");
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const written = [];
  for (const p of PAGES) {
    const path = join(OUT_DIR, `${p.slug}.html`);
    await writeFile(path, page(p), "utf-8");
    written.push(path);
  }
  console.log(`Wrote ${written.length} pages to ${relative(ROOT, OUT_DIR)}/`);
  for (const w of written) console.log(" -", relative(ROOT, w));

  const sitemapPath = join(ROOT, "sitemap.xml");
  await writeFile(sitemapPath, sitemap(), "utf-8");
  console.log(`Wrote ${relative(ROOT, sitemapPath)} (${PAGES.length + STATIC_PAGES.length + 1} URLs)`);

  await syncIndexFootLinks();
  console.log("\nTo rename or update the domain, run scripts/rename-brand.mjs (don't edit site-config.mjs by hand).");
}

main();
