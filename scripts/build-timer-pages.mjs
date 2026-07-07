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
import { mkdir, writeFile } from "node:fs/promises";

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
];

const SITE_URL = "https://samesecond.example"; // update once the real domain is live
const BRAND = "samesecond"; // update alongside SITE_URL once the name is finalized

const timerLinks = PAGES.map(p => `<a href="${p.slug}.html">${p.eyebrow}</a>`).join("\n          ");

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
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Bebas+Neue&family=Martian+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/style.css">
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
    <div class="board">
      <span class="bolt-br"></span><span class="bolt-bl"></span>
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
      <label for="evtName">What's it for? (shown on every screen)</label>
      <input id="evtName" placeholder="Break ends · Quiz round 2 · Doors open" value="${p.label}">
      <div class="stage-btns" style="margin-top:20px">
        <button class="btn primary" id="startBtn">Start countdown</button>
      </div>
      <div class="share-box" id="shareUrl"></div>
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
      <div><div class="fb">${BRAND}</div>A timer you can hand to a room. · <a href="../privacy.html">Privacy</a></div>
      <div>Sync accuracy depends on each device's clock — typically within a second.<br>No data leaves your browser; the timer lives entirely in the link.</div>
    </div>
  </div>
</footer>

<script>window.SAMESECOND_DEFAULT={minutes:${p.minutes},label:${JSON.stringify(p.label)}};</script>
<script src="../assets/app.js"></script>
</body>
</html>
`;

const sitemap = () => {
  const urls = PAGES.map(p => `  <url><loc>${SITE_URL}/timers/${p.slug}.html</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc></url>
${urls}
</urlset>
`;
};

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
  console.log(`Wrote ${relative(ROOT, sitemapPath)} (${PAGES.length + 1} URLs)`);
  console.log("\nReminder: update SITE_URL and BRAND in this script once the domain/name are final, then re-run.");
}

main();
