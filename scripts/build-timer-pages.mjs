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
import { createHash } from "node:crypto";
import { NAME, SITE_URL, CONTACT_EMAIL, CONTENT_DATE, GROW_SITE_ID, AFFILIATE_NAME, AFFILIATE_URL, AFFILIATE_BLURB } from "./site-config.mjs";
import { ARTICLES, AUTHOR_NAME, AUTHOR_URL, AUTHOR_BIO } from "./articles.mjs";
import { COMPARISONS } from "./comparisons.mjs";
import { makeDateTracker } from "./content-dates.mjs";

// Inline QR icon for the "Show QR code" board button (design review,
// 2026-07-25: it was a bare underlined text link with no visual affordance
// for what it actually opens — the one feature on this whole site built
// exactly for in-room sharing). Three finder-pattern corners + a scatter of
// data squares, drawn with hard-cornered <rect>s in currentColor so it
// inherits the button's ink/hover colour in every board style (dark/minimal/
// light) without a second copy. Shared here so index.html's hand-written
// copy and every generated /timers/ page render byte-identical markup.
export const QR_ICON = `<svg class="qr-ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><rect x="0.5" y="0.5" width="5" height="5" fill="none" stroke="currentColor"/><rect x="2" y="2" width="2" height="2" fill="currentColor"/><rect x="10.5" y="0.5" width="5" height="5" fill="none" stroke="currentColor"/><rect x="12" y="2" width="2" height="2" fill="currentColor"/><rect x="0.5" y="10.5" width="5" height="5" fill="none" stroke="currentColor"/><rect x="2" y="12" width="2" height="2" fill="currentColor"/><rect x="9" y="9" width="2" height="2" fill="currentColor"/><rect x="12" y="9" width="2" height="2" fill="currentColor"/><rect x="9" y="12" width="2" height="2" fill="currentColor"/><rect x="12" y="12" width="2" height="2" fill="currentColor"/></svg>`;

// A single, clearly-labeled affiliate recommendation card. Renders nothing
// until AFFILIATE_NAME/URL/BLURB are set in site-config.mjs (same
// off-by-default pattern as the ad slot) and only on pages tagged
// `affiliate: true` in PAGES — the work/productivity timers, not the party
// or countdown ones, so it reads as genuinely relevant rather than bolted on.
// Sits after the FAQ, below the ad slot, so it never competes with either.
// cfg defaults to the real site-config values; tests pass an explicit cfg so
// both the "off" and "configured" branches are checkable without mocking a
// module of `const` bindings.
export const affiliateCard = (p, cfg = { name: AFFILIATE_NAME, url: AFFILIATE_URL, blurb: AFFILIATE_BLURB }) => {
  if (!p.affiliate || !cfg.name || !cfg.url || !cfg.blurb) return "";
  return `
  <div class="panel affiliate-card">
    <p class="affiliate-label">Sponsored</p>
    <p class="hint">${cfg.blurb}</p>
    <a class="pro-link" href="${cfg.url}" rel="sponsored noopener" target="_blank">Try ${cfg.name} →</a>
  </div>`;
};

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, "timers");

// dateModified per page, changing only when that page's content changes.
// See scripts/content-dates.mjs for why this is not just the build date.
const dates = makeDateTracker(join(ROOT, "content-dates.json"), new Date().toISOString().slice(0, 10));

// Each row is one indexed landing page. slug -> filename (timers/<slug>.html).
// minutes: preset duration the tool boots into.
// title / h1 / meta: unique per page — never copy these verbatim between rows,
// duplicate title/meta tags are the #1 reason programmatic pages get filtered
// out of Google's index instead of ranked.
const OBS_OVERLAY_EXTRA = `
        <div class="obs-extra">
          <h3>Add it to OBS in 3 steps</h3>
          <ol>
            <li>In OBS, go to <b>Sources → + → Browser</b>.</li>
            <li>Paste the <b>overlay link</b> below (not the regular sync link) and set the size — 400×160 is a good starting point.</li>
            <li>Check <b>"Shutdown source when not visible"</b> to save CPU between uses.</li>
          </ol>
          <button class="pro-link" id="overlayBtn" style="margin-top:6px">Copy OBS overlay link →</button>
          <div class="hint" style="margin-top:6px">The overlay link is the same countdown with the background made transparent and every button/menu stripped out — just the digits, ready to sit on top of your scene.</div>

          <h3>Or write the URL yourself</h3>
          <p>The button above copies a link to the countdown currently on the board. You don't have to use it — an overlay URL can be typed from scratch, which is handy for a scene you set up once and reuse, or a duration you'd rather not set by hand first:</p>
          <p><code class="obs-url">https://countlink.app/embed/?overlay=1#for=10m&amp;go=1</code></p>
          <p>Change <code>10m</code> to whatever you need — <code>5m</code>, <code>1h30m</code>, <code>90s</code>, <code>25m</code>. The <code>go=1</code> on the end is what makes it start counting the moment the scene loads, which is what you want for a "starting soon" screen: because OBS keeps the URL you gave it, every reload starts the countdown fresh rather than resuming one that already ran out. Add <code>&amp;l=Starting+soon</code> to put a label under the digits.</p>
          <p><b>Only use <code>go=1</code> for your own overlay, never for a link you send to people.</b> A link that starts itself starts <i>per person</i> — everyone opening it would begin their own countdown from whenever they clicked. For a mod or co-streamer who needs to watch the same clock as you, share the regular sync link instead: it carries one fixed end instant, so their screen and yours land on zero together.</p>
        </div>`;

const ZOOM_EXTRA = `
        <div class="obs-extra">
          <h3>How this compares to Zoom's built-in timer</h3>
          <p>Zoom has its own meeting timer (Settings → Meetings → Show meeting timer), but it's visible only to the host, and disappears from view the moment you share your screen. CountLink's link works for everyone — each attendee opens it on their own device or a second monitor, no settings change, no screen-share required.</p>
          <p><b>How to use it:</b> start the countdown here, copy the link, and paste it into the meeting chat right when the segment begins. You control it from your own tab; anyone who opens the link just watches — nobody else can accidentally pause or reset it.</p>
        </div>`;

const EXAM_EXTRA = `
        <div class="obs-extra">
          <h3>For exam halls: use the Light board style</h3>
          <p>Exam halls are often brightly lit, and a dark screen can wash out on a projector under fluorescent lights. Use the <b>Light</b> style toggle above (next to Board and Minimal) for a high-contrast, dark-on-white display built specifically for that. It's the same countdown, just easier to read from the back row.</p>
        </div>`;

const CLASSROOM_EXTRA = `
        <div class="obs-extra">
          <h3>What to time, by age</h3>
          <p>The right countdown length changes a lot by age — a timer that's motivating for a six-year-old reads as either patronizing or impossibly long for a seventeen-year-old.</p>
          <div class="data-table-wrap">
            <table class="data-table">
              <caption>Countdown lengths that hold attention, by age</caption>
              <thead>
                <tr><th scope="col">Age</th><th scope="col">Transition</th><th scope="col">Task or group work</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">Younger (roughly 5–10)</th><td class="num">60s</td><td class="num">2–5 min</td></tr>
                <tr><th scope="row">Early teens (roughly 11–13)</th><td class="num">2–3 min</td><td class="num">10–15 min</td></tr>
                <tr><th scope="row">Older teens (roughly 14–18)</th><td class="num">3–5 min</td><td class="num">20–50 min</td></tr>
              </tbody>
            </table>
          </div>
          <p>Whatever the length, the mechanism is the same: project the board at the front, and if students have devices, share the same link — everyone counts down to the identical second, so "how much time is left" stops being a question anyone needs to ask you.</p>
        </div>`;

// Interval/Tabata mode is a genuinely different flow from the single-
// deadline countdown/stopwatch: repeating work/rest phases derived from one
// cycle-start instant. Its own panel + defaults per page (a boxing round
// timer defaults to 3min/1min/12; a Tabata timer to 20s/10s/8), wired to
// assets/app.js's startInterval() via ivStartBtn/ivWorkSec/ivRestSec/ivRounds.
const ivExtra = (workSec, restSec, rounds) => `
        <div class="obs-extra">
          <h3>Set your rounds</h3>
          <div class="stack2">
            <div>
              <label for="ivWorkSec">Work (seconds)</label>
              <input id="ivWorkSec" type="number" min="1" value="${workSec}">
            </div>
            <div>
              <label for="ivRestSec">Rest (seconds)</label>
              <input id="ivRestSec" type="number" min="0" value="${restSec}">
            </div>
          </div>
          <div>
            <label for="ivRounds">Rounds</label>
            <input id="ivRounds" type="number" min="1" value="${rounds}">
          </div>
          <button class="btn primary" id="ivStartBtn" style="margin-top:12px">Start interval timer</button>
          <div class="hint" style="margin-top:6px" id="ivPhase"></div>
        </div>`;

// The focus/break auto-cycle panel, shared by every page that offers it as
// an OPTION alongside its plain single-block board — Pomodoro first, Group
// Study second. Minutes instead of seconds (nobody thinks of a focus block
// as "1500 seconds"), plus the two long-break fields that turn on the
// every-Nth-round long rest (see intervalPhase's longRestSec/longEvery in
// assets/app.js). Always the same field ids (ivWorkMin/ivRestMin/…) so one
// click handler in app.js drives every page that uses it — safe because no
// page mixes this with the seconds-based ivExtra() above.
const focusBreakCycleExtra = ({
  heading, intro, buttonLabel, footer,
  workMin = 25, restMin = 5, longRestMin = 20, longEvery = 4, rounds = 8,
}) => `
        <div class="obs-extra">
          <h3>${heading}</h3>
          <p>${intro}</p>
          <div class="stack2">
            <div>
              <label for="ivWorkMin">Focus (minutes)</label>
              <input id="ivWorkMin" type="number" min="1" value="${workMin}">
            </div>
            <div>
              <label for="ivRestMin">Short break (minutes)</label>
              <input id="ivRestMin" type="number" min="0" value="${restMin}">
            </div>
          </div>
          <div class="stack2">
            <div>
              <label for="ivLongRestMin">Long break (minutes)</label>
              <input id="ivLongRestMin" type="number" min="0" value="${longRestMin}">
            </div>
            <div>
              <label for="ivLongEvery">Long break every</label>
              <input id="ivLongEvery" type="number" min="0" value="${longEvery}">
            </div>
          </div>
          <div>
            <label for="ivRounds">Total focus rounds</label>
            <input id="ivRounds" type="number" min="1" value="${rounds}">
          </div>
          <button class="btn primary" id="ivStartBtn" style="margin-top:12px">${buttonLabel}</button>
          <div class="hint" style="margin-top:6px" id="ivPhase"></div>
          <p class="hint" style="margin-top:10px">${footer}</p>
        </div>`;

const AUTO_CYCLE_MECHANIC_NOTE = 'Same mechanic as the <a href="/timers/interval-timer">interval timer</a> and <a href="/timers/agenda-timer">agenda timer</a>: the cycle\'s start instant is the only thing the link carries, so every device works out which round and phase is "now" from elapsed time — no server, no viewer limit, and it\'s still correct if someone opens the link an hour into round six.';

const POMODORO_EXTRA = focusBreakCycleExtra({
  heading: "Auto-cycling focus and break, on every screen",
  intro: "This runs the classic rhythm on its own: a focus block, then a break, repeated — with a longer break every fourth round, the way Francesco Cirillo's original technique does it. Share the link once, at the start, and everyone's screen advances through the same rounds together; nobody has to restart a countdown between blocks.",
  buttonLabel: "Start auto-cycling pomodoro",
  footer: AUTO_CYCLE_MECHANIC_NOTE,
});

const GROUP_STUDY_EXTRA = focusBreakCycleExtra({
  heading: "Optional: auto-cycle through the whole session",
  intro: "The board above still works as a single focus-then-manually-restart block if that's all you want. This panel is the alternative when a study group or \"study with me\" stream wants the whole rhythm handled for it: set your focus and break lengths once, and it advances through every round on its own — nobody has to notice zero and restart the next block.",
  buttonLabel: "Start auto-cycling session",
  footer: AUTO_CYCLE_MECHANIC_NOTE,
});

// Per-page supporting content, keyed by slug. Every page that doesn't already
// carry an inline `extra` gets one of these injected in the render (see the
// `${p.extra || EXTRA_BY_SLUG[p.slug] || ""}` line in the page template). Each
// block is unique, written for its specific duration or use case — the point
// is that no two pages share this section, so each URL stands on its own as a
// genuinely useful page rather than a thin duration swap. Keep them specific
// (real examples, real numbers, real trade-offs), not generic filler.
const EXTRA_BY_SLUG = {
  "5-minute-timer": `
        <div class="obs-extra">
          <h3>What five minutes is actually good for</h3>
          <p>Five minutes is the "reset" length: short enough that everyone in the room will genuinely watch it end, long enough to do one small thing properly. It's the classic slot for a between-session comfort break, a single Pomodoro-style short break, letting a pot come to the boil, steeping tea, a plank-and-stretch reset at your desk, or a hard stop on "any other business" at the end of a meeting.</p>
          <p>It's also the standard length for a <b>lightning talk</b> and for most <b>speed-networking</b> rotations. When you share the link, every speaker and every table is watching the same five minutes rather than eight different phone clocks, so the round changes over cleanly with no "wait, whose timer?" Set it, copy the link, and drop it into the chat or put it on the projector before the first speaker starts.</p>
        </div>`,
  "10-minute-timer": `
        <div class="obs-extra">
          <h3>Ten minutes, and how to make it hold</h3>
          <p>Ten minutes is the workhorse timebox. It's the default length for a daily standup, a "ten-minute tidy," a warm-up writing sprint, a short quiz round, or the "we'll take ten" break that always drifts to fifteen unless something visible is counting down.</p>
          <p>The trick to keeping ten to ten is making the deadline shared, not personal. If the countdown lives only on the organiser's phone, everyone else quietly assumes there's slack. Put this on the projector, or paste the link into the group chat, and the number becomes a fact everyone can see — people wrap up on their own as it approaches zero, without anyone having to play timekeeper. For a standup specifically, glance at it between updates: if you're at five minutes with half the team still to go, that's your cue to move the deep-dives to a follow-up.</p>
        </div>`,
  "15-minute-timer": `
        <div class="obs-extra">
          <h3>Fifteen minutes: the "one proper thing" block</h3>
          <p>Fifteen minutes is long enough to finish a real task but short enough to start without dread — which is exactly why it shows up everywhere: a quiz or trivia round, a workshop breakout, a "fifteen minutes on inbox" focus block, a coffee break with a hard end, or the reading-and-annotating slot in a class.</p>
          <p>Because it sits right on the edge of "I could get lost in this," a visible shared countdown earns its keep here more than at shorter lengths. Share the link so every breakout group or quiz team sees the identical time remaining, and the cutoff stops being something you have to announce and defend — the screen announces it for you. If a segment routinely overruns, that's useful data: shorten it to twelve next time, or split it into two.</p>
        </div>`,
  "20-minute-timer": `
        <div class="obs-extra">
          <h3>Twenty minutes for workshops, naps and drills</h3>
          <p>Twenty minutes is the sweet spot for a workshop exercise — enough to make progress, tight enough to keep energy up — and it's the length most sleep advice gives for a "power nap" that refreshes without leaving you groggy. It's also a common circuit or mobility-drill block, and a good single sitting for focused study before a stretch.</p>
          <p>For anything run with a group, the shared link does the coordinating for you: one facilitator sets twenty minutes, everyone opens the same countdown, and every table or station finishes together instead of one group drifting five minutes past because they were watching a different clock. Put it fullscreen on the room screen for a glanceable board, and share the link to phones for people who are heads-down and want the time in front of them.</p>
        </div>`,
  "25-minute-timer": `
        <div class="obs-extra">
          <h3>The 25-minute focus block, shared</h3>
          <p>Twenty-five minutes is the focus half of the Pomodoro technique: one unbroken block of work, then a short break, repeated. The length is deliberate — long enough to get properly into something, short enough that starting doesn't feel like a commitment, which is what makes it so effective at beating the "I'll begin in a minute" stall.</p>
          <p>Done solo, any timer works. Done with company — a study group, a co-working room, a body-doubling call — the shared link is the upgrade: everyone starts the same 25 minutes and, crucially, everyone's break lands at the same moment, so the room stays in phase instead of one person breaking while another is mid-flow. At zero, hit the 5-minute quick button for the break and share that link, then restart for the next block. Every fourth round, take a longer 15–30 minute break — that's the classic rhythm.</p>
        </div>`,
  "30-minute-timer": `
        <div class="obs-extra">
          <h3>Half an hour, kept honest</h3>
          <p>Thirty minutes is the default meeting length that most often runs over, the standard slot for a workout or a home-cooking step, and a common section length for a timed test. It's long enough that people stop watching the clock — which is exactly when a visible shared countdown pays off, because it quietly reminds the room without anyone having to interrupt.</p>
          <p>For a half-hour meeting, share the link at the start and leave it on screen: the last five minutes become obvious to everyone, so you land the decisions and actions instead of discovering you're out of time. For a workout or a bake, put it fullscreen where you'll pass it. And if the room is bright — a gym, a sunlit kitchen, a projector under fluorescent lights — switch to the Light board style so the digits stay readable from across the room.</p>
        </div>`,
  "45-minute-timer": `
        <div class="obs-extra">
          <h3>The class-period length</h3>
          <p>Forty-five minutes is one of the most common school class-period lengths, and it doubles as a solid single block of deep work, a lecture slot, or a long workshop segment. It's long enough that "how much time is left?" becomes a recurring interruption — the exact thing a projected, shared countdown removes.</p>
          <p>Put it on the front screen fullscreen so the whole room can glance at it, and, if devices are allowed, share the link so students or attendees can keep the same countdown on their own screen while they work heads-down. Because each device calculates the time from the deadline encoded in the link rather than from a live connection, the countdown keeps running even if the classroom Wi-Fi hiccups mid-session — every screen that already loaded the page stays correct to the second.</p>
        </div>`,
  "60-minute-timer": `
        <div class="obs-extra">
          <h3>An hour that ends when it should</h3>
          <p>An hour covers a full class, a standard exam block, a one-hour meeting, a slow-cooker step, or a dedicated deep-work session. Once a countdown crosses the hour mark the board switches to HH:MM:SS and holds that format the whole way down, so the display never jumps or reflows partway through — useful when it's projected and people are glancing at it from across a room.</p>
          <p>For meetings, the honest version of "let's keep this to an hour" is a countdown everyone can see: share the link at the start and the final ten minutes become visible to the whole room, which is usually all it takes to move from discussion to decisions. For an exam or timed block, display it on the front screen and — if your rules allow devices — share the link so every candidate sees the identical time remaining, with no ambiguity about whose clock is right.</p>
        </div>`,
  "webinar-countdown": `
        <div class="obs-extra">
          <h3>Running a clean pre-webinar countdown</h3>
          <p>The few minutes before a webinar are where attendance leaks: people join, see a blank "waiting" screen, and tab away. A live countdown to your exact start time fixes that — it signals the session is really happening and gives people a reason to stay put.</p>
          <ol>
            <li>Start the countdown to your go-live moment and copy the link.</li>
            <li>Paste it into your registration confirmation email and any reminder emails, and put it on your waiting-room slide.</li>
            <li>At zero, switch attendees to the actual session — this page is the countdown, not the meeting room.</li>
          </ol>
          <p>Because the link encodes one exact instant rather than a wall-clock time, attendees in every timezone see a correct countdown to the same real moment automatically — there's nothing for anyone to convert, and no chance of the classic "wait, was that your 3pm or mine?" mix-up.</p>
        </div>
          <h3>The "starting soon" screen, and why it earns its keep</h3>
          <p>The five minutes before a webinar starts are the ones that lose people. Attendees arrive early, see a static slide or a frozen frame, can't tell whether they're in the right session or whether it's already running late, and quietly go and do something else. A live countdown answers all three questions without anyone speaking: yes, this is the right place; no, it hasn't started; here's exactly how long you have.</p>
          <p>Practically, put it up as soon as the room opens rather than at the scheduled minute. Set it to end at the real start time and leave it running as your holding screen — the transparent overlay mode works as a browser source in OBS or StreamYard if you want it over a title card, and the plain link works if you're simply sharing a tab.</p>
          <p>For an audience across time zones, sharing the link is more reliable than announcing a time. The countdown resolves to the same instant everywhere, so nobody has to work out what 3pm GMT means where they are — a surprisingly common reason people miss the first ten minutes.</p>`,
  "standup-timer": `
        <div class="obs-extra">
          <h3>How to actually keep a standup short</h3>
          <p>Standups overrun for one reason: nobody can see the time, so nobody self-regulates. Making the countdown visible to the whole team — projected on the call, or pasted into the channel — shifts that. People wrap their update as the number drops, because the pressure is coming from a shared fact rather than from someone playing timekeeper.</p>
          <p>A simple rule of thumb: for a team of six aiming at ten minutes, that's roughly a minute each with a little slack for the shared stuff. If you're halfway down the clock with more than half the team still to go, that's the signal to park the deep-dives — "let's take that offline" — and keep the round moving. The blockers are what standup is for; the debugging session it uncovers belongs in a smaller follow-up, not in front of everyone.</p>
        </div>`,
  "google-meet-timer": `
        <div class="obs-extra">
          <h3>Using it inside a Google Meet call</h3>
          <p>Meet has no shared timer that every participant can see, and screen-sharing a countdown means giving up your screen for everything else. The lighter approach is to keep the timer separate from the call:</p>
          <ol>
            <li>Start your countdown here and copy the link.</li>
            <li>Paste it into the Meet in-call chat the moment the segment begins — anyone can open it in a new tab.</li>
            <li>Or keep it open yourself on a second monitor or your phone, so you can pace the meeting without it being on the shared screen.</li>
          </ol>
          <p>There's no extension to install and nothing specific to Google about it — it's just a link that happens to work well pasted into Meet's chat, so everyone who opens it counts down to the same second on their own device.</p>
        </div>
          <h3>Why Meet has no timer of its own</h3>
          <p>Google Meet deliberately doesn't ship a shared countdown. The closest built-in options are a Q&amp;A queue or breakout-room auto-close, neither of which shows the room how long is left on the current item. So the usual workaround is one person watching their phone and announcing the time — which is exactly the thing that makes a meeting feel policed rather than paced.</p>
          <p>The practical fix in Meet is a second tab. Start the countdown here, then share that tab (Present a tab, not your whole screen) so the timer appears as its own presented source, or simply paste the link into the Meet chat so everyone opens it on their own device. The second option scales better for hybrid calls: the people in the room watch the projector, the remote attendees watch their own screen, and both are counting to the same instant rather than to two different phones.</p>
          <p>One habit worth adopting: paste the link at the <em>start</em> of the call, before the discussion warms up. Dropping a countdown into chat twenty minutes in reads as a rebuke; having it there from the beginning reads as the agenda.</p>`,
  "workshop-timer": `
        <div class="obs-extra">
          <h3>Timing breakouts without herding</h3>
          <p>The recurring headache when you're facilitating is uneven groups: one table finishes early and goes quiet, another runs long, because each is glancing at a different phone. Share one link and every table counts down from the same number, so segments actually end together and you're not shouting "two more minutes" across a noisy room.</p>
          <p>A practical pattern for planning a session: give each activity slightly less time than feels comfortable — groups expand to fill whatever they're given, and a tight clock keeps the energy up. Between segments, start the next duration and share the fresh link (each countdown is its own link). Put the current timer fullscreen on the room's main screen as the source of truth, and let anyone who wants it pull the same countdown up on their own device.</p>
        </div>`,
  "group-study-timer": `
        <div class="obs-extra">
          <h3>Studying together, actually in sync</h3>
          <p>Group study and "study with me" sessions work best when the focus blocks and breaks line up — otherwise someone's always mid-break while someone else is deep in a problem, and the shared momentum you came for never materialises. A single shared countdown fixes that: everyone starts the same block and everyone breaks at the same moment.</p>
          <p>For a study-with-me stream, drop the link in your chat or description so viewers studying along see the identical time remaining down to the second. For a study group in a library or on a call, one person runs the clock: start a focus block (25 or 50 minutes are the usual choices), share the link, and at zero start the break and share that one. The rhythm — focus, short break, repeat, with a longer break every few rounds — is what keeps a long session sustainable.</p>
        </div>`,
  "game-night-timer": `
        <div class="obs-extra">
          <h3>Turn timing by game type</h3>
          <p>A shared turn timer quietly settles the two arguments every game night eventually has: how long a turn is, and whether someone's gone over. Put it where everyone can see it and the countdown becomes the referee.</p>
          <ul>
            <li><b>Party / word games</b> (charades, Taboo, Pictionary): 60–90 seconds a turn keeps the pace frantic and funny.</li>
            <li><b>Drafting / deck-building</b> phases: 30–60 seconds a pick stops the table stalling on one agonising decision.</li>
            <li><b>Strategy / worker-placement</b> turns: 2–3 minutes is usually enough to plan a move without derailing into full analysis paralysis.</li>
          </ul>
          <p>Put it fullscreen on a central phone or tablet the whole table can see, or share the link so each player can watch it on their own screen — then just tap the same quick-timer button to reset it for the next player.</p>
        </div>
          <h3>Turn timers, and the etiquette of using one</h3>
          <p>The reason a turn timer improves a game night has little to do with speed and everything to do with fairness. Analysis paralysis is uneven — one player takes four minutes deciding while everyone else took forty seconds, and the resentment builds quietly rather than being raised. A visible clock moves that from a social problem to a rule, which is far easier for a group to accept.</p>
          <p>Pick the duration from the game, not from impatience. Thirty to sixty seconds suits a party or word game where hesitation is the whole tension. Two to three minutes fits a mid-weight strategy game where a turn genuinely involves planning. Anything heavier is usually better with a soft timer — start it, but treat the alarm as a nudge to decide rather than a hard forfeit.</p>
          <p>Introduce it at the start of the game, agreed by everyone, not mid-session aimed at whoever is currently slow. A shared link on the table works better than one person holding a phone, for the obvious reason: nobody is the timekeeper, so nobody is the villain.</p>`,
  "auction-countdown": `
        <div class="obs-extra">
          <h3>A closing time nobody can dispute</h3>
          <p>Whether it's a charity auction, a fundraiser paddle-raise, or a limited online drop, the whole thing hinges on everyone agreeing on when bidding closes. If people are watching their own clocks, the final seconds turn into an argument. Share this link and every bidder's screen counts down to the identical instant, because the closing time is encoded in the link itself, not read off each device's own clock.</p>
          <p>Share it before bidding opens so nobody can claim they didn't know the deadline, and put it fullscreen on the room screen at a live event so the last minute is visible to everyone at once. Treat the moment every screen hits zero as your hard cutoff — anyone can reopen the link and confirm they were seeing the same countdown, which is exactly the kind of transparency a bidding deadline needs.</p>
        </div>
          <h3>Why a shared clock matters when money is involved</h3>
          <p>Bidding disputes almost always come down to whose clock was authoritative. If the auctioneer's phone said eight seconds and a bidder's said two, there is no way to settle it afterwards — and in a charity auction or a club sale, that argument sours the whole evening. Putting one countdown on a screen everyone can see removes the ambiguity before it happens rather than adjudicating it after.</p>
          <p>Share the link rather than just projecting it if remote or phone bidders are involved: they then count to the identical instant instead of to whatever their connection lag suggests. Announce the rule out loud at the start — "the screen is the clock" — so it's understood as the agreed reference and not just decoration.</p>
          <p>One honest caveat for anything with real money attached: accuracy depends on each device's own clock, typically within a second. That's ample for a room auction or a raffle, but this is not a certified timing system and shouldn't be treated as one where a legally binding cutoff is at stake.</p>`,
  "stopwatch": `
        <div class="obs-extra">
          <h3>A stopwatch several people can watch at once</h3>
          <p>The stopwatch on your phone lives on your phone. This one is shareable: the instant you press start is recorded in the link, so anyone who opens it sees the same elapsed time ticking up — useful whenever a group needs to agree on how long something has been running.</p>
          <p>That covers timing a live event from a shared "clock" everyone can see, tracking elapsed focus time in a co-working room, timing a cook or a process where several people care about the number, or running a "study with me" session where viewers want to see the same elapsed count you do. Because nothing is actually running on a server, closing and reopening the link is fine — it re-reads the start instant and shows the correct elapsed time, as if it had been running the whole time. It's deliberately simple: one shared elapsed time on many screens, no laps or splits.</p>
        </div>`,
  "multiple-timers-at-once": `
        <div class="obs-extra">
          <h3>When one countdown isn't enough</h3>
          <p>Some situations need several clocks at once, each independent: a multi-dish meal where the potatoes, the roast and the sauce all finish at different times; an event with parallel stations each on its own schedule; exam sections with different lengths; or a kitchen, workshop or lab running a few processes side by side.</p>
          <p>Add a named timer for each — they're shown together on one board and each counts down on its own, so finishing or removing one never disturbs the others. Then copy the link: whoever opens it sees the identical set of timers, each picking up from wherever it currently is, so a co-host or the rest of the kitchen can watch the same dashboard without you calling out times. There's no hard limit on how many you add, though a handful stays far easier to scan at a glance than a wall of twenty.</p>
        </div>
          <h3>Naming and scanning several clocks at once</h3>
          <p>The limit on running many timers isn't technical, it's visual. Four or five countdowns can be read at a glance; a dozen becomes a wall of numbers that nobody parses under pressure, which defeats the point. If you find yourself past about six, it's usually a sign that some of them are really one sequence — a set of stages that happen in order — and would be clearer as a single chained agenda than as parallel clocks.</p>
          <p>Names matter more here than anywhere else on this site. "Timer 3" tells you nothing when three things are about to finish; "Sauce", "Roast" and "Potatoes" can be read from across a kitchen. Put the thing you'll act on in the label, not the duration — you can already see the duration.</p>
          <p>Because each timer's end time is encoded in the shared link along with the others, a co-host opening that link sees the same set at the same offsets. They don't need to be told what's already running, which is what makes this useful for a handover mid-session.</p>`,
  "agenda-timer": `
        <div class="obs-extra">
          <h3>Build the running order once, let it drive itself</h3>
          <p>A single countdown times one thing. An agenda times a <i>sequence</i> — intro, then a talk, then a break, then Q&A — and advances from one segment to the next on its own, so you're facilitating instead of fumbling for the next timer. Add your segments in order, reorder them with the arrows if you change your mind, then start.</p>
          <p>The useful part is what the shared link carries: only the start instant and the list of segment lengths. Every device works out which segment is "now" from the time that's elapsed since the start, so once you've shared the link there's nothing left to synchronise — no server tells anyone to advance, and every screen reaches the end together. Once an agenda is running its order is locked in; to change it, start a fresh one. That constraint is deliberate — it means one link is always one unambiguous running order that everyone can trust.</p>
        </div>
          <h3>Building an agenda that survives contact with the meeting</h3>
          <p>The mistake most agendas make is budgeting to the total rather than to the items. Six items in an hour becomes "about ten minutes each", which in practice means the first two take thirty-five minutes and the last two get cut. Assigning each item its own countdown up front forces the harder conversation — which of these is actually worth fifteen minutes? — while it's still cheap to have.</p>
          <p>Two things make chained timers work better than one long one. First, name each segment: a countdown labelled "Budget review" tells a room what's ending, where a bare number just applies pressure. Second, leave a deliberate gap — a five-minute buffer near the end absorbs the one item that always overruns without stealing from whatever is last on the list, which is usually the thing nobody wanted to discuss.</p>
          <p>If an item genuinely needs more time, the honest move is to stop and re-share a fresh countdown rather than quietly letting it run. That keeps the shared clock truthful, which is the only reason anyone pays attention to it.</p>`,
  "new-year-countdown": `
        <div class="obs-extra">
          <h3>Setting it up for the party</h3>
          <p>The board is already counting down to the next midnight on January 1st in your own timezone — you don't have to set anything to use it as-is. For a party, press start, open the link on the TV or projector, and switch to Fullscreen so the final minute is unmissable from anywhere in the room. If the space is bright, the Light board style keeps the big digits crisp.</p>
          <p>One thing worth knowing if you share the link: it locks in <i>your</i> midnight as one exact instant, so friends in other timezones counting down with you will hit zero at that same moment — the instant your clock strikes twelve — rather than their own local midnight. That's what keeps every screen in sync. If someone elsewhere wants a countdown to their own midnight, they just start their own timer and share that link instead.</p>
        </div>`,
  "christmas-countdown": `
        <div class="obs-extra">
          <h3>An advent countdown the kids can check themselves</h3>
          <p>The board counts down to midnight on the next December 25th in your timezone, shown as days plus hours, minutes and seconds — and it always recomputes the <i>next</i> Christmas when it loads, so it never gets stuck on a date that's already passed. Start it, share the link, and the kids can pull up the identical countdown on any device instead of asking "how many more sleeps?" for the tenth time.</p>
          <p>Want to count to Christmas Eve, the start of the school holidays, or the moment presents get opened instead? Use the date-and-time field to pick any moment, then start and share that link. And if you send the link to relatives in another timezone, they'll count down to the same instant you're counting to (your midnight), which keeps everyone's screens agreeing — rather than each showing a separate local midnight.</p>
        </div>`,
};

/**
 * The instrument index — every timer filed under a panel heading, in the order
 * a user would scan for one. The index rail renders from this, so a slug that
 * isn't filed here would simply not exist in site navigation. Keep it in sync
 * with PAGES below (build-timer-pages.mjs checks this on every run and refuses
 * to write a site with an unfiled or phantom slug).
 */
export const GROUPS = [
  ["Durations", ["index"]],
  ["Classroom & exams", ["exam-timer", "classroom-timer", "group-study-timer"]],
  ["Meetings", [
    "meeting-timer",
    "webinar-countdown", "standup-timer", "zoom-meeting-timer",
    "google-meet-timer", "workshop-timer",
  ]],
  ["Streaming", ["obs-countdown-timer"]],
  ["Focus & intervals", ["pomodoro-timer", "interval-timer"]],
  ["Multi-stage", ["multiple-timers-at-once", "agenda-timer"]],
  ["Play & events", ["game-night-timer", "auction-countdown"]],
  ["Seasonal", ["new-year-countdown", "christmas-countdown"]],
];

/*
 * `/timers/` is the durations hub — the consolidation target for the eight
 * fixed-duration pages and the stopwatch page, all removed 2026-07-29.
 *
 * Why they went: Search Console showed 42 of 45 URLs sitting in "Discovered –
 * currently not indexed", and the eight duration pages had *zero* impressions
 * between them — they weren't ranking badly, they were absent. That SERP
 * ("5 minute timer") belongs to vclock and online-stopwatch.com, who have
 * years of authority on it. Meanwhile the queries countlink actually surfaces
 * for are all one cluster: "shared timer", "synced timer", "sync timer",
 * "count sync", plus the competitor brand "sharemytimer". So the eight pages
 * were spending crawl budget competing for terms we cannot win, on a domain
 * whose whole budget is roughly two pages.
 *
 * Note this was NOT a thin-content cull — those pages measured ~63% unique
 * prose, mid-pack for the site. They were consolidated because the intent was
 * identical eight times over and the target queries were unwinnable, and their
 * prose is preserved here rather than deleted.
 *
 * Special-cased slug: "index" writes timers/index.html so the URL is a clean
 * `/timers/` directory index rather than `/timers/index`. Everything that
 * builds a timer href goes through hrefFor() for that reason — don't
 * interpolate `/timers/${slug}` directly or the hub gets a broken link.
 */
export const hrefFor = (slug) => (slug === "index" ? "/timers/" : `/timers/${slug}`);
const fileFor = (slug) => `${slug}.html`; // slug "index" → index.html, which is what we want

/*
 * /embed/index.html is a copy of the root index.html, served from a path that
 * _headers exempts from X-Frame-Options: DENY so third-party sites can frame
 * the overlay. Two things have to change on the way in, and both were missed
 * when this was a bare `rootHtml.replace("<head>", ...)`:
 *
 * 1. RELATIVE PATHS. index.html links its assets relatively ("assets/app.js",
 *    "manifest.json") because it sits at the root, where that resolves. Copied
 *    verbatim into /embed/, every one of them resolves to /embed/assets/… and
 *    404s — so the widget rendered as unstyled, script-less full-site chrome
 *    with a dead board. Shipped broken from the day the embed button landed
 *    until 2026-08-10; nothing caught it because the deploy guard only checks
 *    that a file exists for each *page* path, and the build only ever
 *    string-replaced <head>. Rewritten to root-absolute here, and asserted in
 *    test/embed.test.mjs.
 * 2. ADSENSE + GA. An ad slot inside a 400x160 third-party iframe has
 *    availableWidth=0 and throws TagError on every load; beyond the noise,
 *    serving ads from inside a frame on sites we don't control is exactly the
 *    kind of placement that puts a pending AdSense review at risk. Analytics
 *    goes with it — sessions from an embed aren't site sessions, and counting
 *    them inflates the numbers that AdSense and we both read.
 *
 * Pure and exported so both rules are unit-testable without running a build.
 */
export function buildEmbedHtml(rootHtml) {
  const NOINDEX = '<meta name="robots" content="noindex,follow">';
  return rootHtml
    // Guarded so the transform is idempotent: /embed/ is rewritten from
    // index.html on every build, and an unguarded replace stacks a second
    // robots meta each time it's applied to its own output.
    .replace("<head>", rootHtml.includes(NOINDEX) ? "<head>" : `<head>\n${NOINDEX}`)
    // Root-relative asset refs → absolute. Anchored on the quote so it can only
    // ever match a full attribute value, never a substring of a longer path
    // that happens to contain "assets/" (e.g. an already-absolute "/assets/…").
    .replace(/(href|src)="(assets\/|manifest\.json)/g, '$1="/$2')
    // The GA loader, the inline gtag bootstrap, the AdSense loader, the <ins>
    // slot, and the push() that fills it.
    .replace(/<script async src="https:\/\/www\.googletagmanager\.com[^"]*"><\/script>\s*/g, "")
    .replace(/<script>window\.dataLayer[\s\S]*?<\/script>\s*/g, "")
    .replace(/<script async src="https:\/\/pagead2\.googlesyndication\.com[^"]*"[^>]*><\/script>\s*/g, "")
    .replace(/<ins class="adsbygoogle"[\s\S]*?<\/ins>\s*/g, "")
    .replace(/<script>if\(!window\.__CL_OVERLAY\)\(adsbygoogle[\s\S]*?<\/script>\s*/g, "")
    // The overlay ad-suppression guard that sits just above the loader tag.
    // /embed/ carries no ad code at all, so the guard has nothing to guard.
    .replace(/<script>\/\* \?overlay=1 renders[\s\S]*?<\/script>\s*/g, "")
    /* Grow (faves.grow.me). Caught only by loading the deployed /embed/ in a
       real browser and listing document.scripts — it injects its own floating
       share button and a "you might also like" recommendation card, both of
       which rendered ON TOP of the countdown inside the 400x160 frame. An
       embed is someone else's page furniture; it has no business growing a
       third-party share widget and an ad-adjacent content recommender there. */
    .replace(/<script data-grow-initializer="">[\s\S]*?<\/script>\s*/g, "");
}

export const PAGES = [
  { slug: "index", minutes: 10, label: "Time's up", eyebrow: "Timer Durations",
    h1: "Shared Timer — Pick A Duration, Share The Link",
    meta: "Free shared timers from 1 minute to an hour, plus a shared stopwatch. Set a duration, copy the link, and every screen counts down to the same second — no account, no viewer limit.",
    intro: "Every duration below runs the same board you see here, and every one of them is shareable: set the length, copy the link, and anyone who opens it counts down to the identical second. Pick a quick timer in the panel below, or type any custom length.",
    setupHint: "The board above is ready at 10 minutes, and you can set it right there — click the digits and roll them with the arrows, or just type the time. These controls do the same job, plus counting down to a date.",
    extra: `
        <div class="obs-extra">
          <h3>Common durations, and what people use them for</h3>
          <p>All of these are the same shared board at a different length — the quick buttons below set them in one click.</p>
          <ul>
            <li><b>1–5 minutes</b> — a quick break, a lightning talk, a board-game turn, or the last leg of someone's turn. Short enough that everyone actually watches it end.</li>
            <li><b>10 minutes</b> — a coffee break, a daily standup, or a timed writing sprint. Drop the link in your team chat and nobody installs anything.</li>
            <li><b>15 minutes</b> — a classic break length, and a common quiz-round or lightning-talk limit. Share it once and every team's device shows the identical time remaining, so nobody can dispute the cutoff.</li>
            <li><b>20–30 minutes</b> — a workshop segment, a timed exercise, a half-length meeting, or a timed test section.</li>
            <li><b>25 minutes</b> — the classic Pomodoro focus block. There's a <a href="/timers/pomodoro-timer">dedicated Pomodoro page</a> if you want the full work/break rhythm written out.</li>
            <li><b>45 minutes</b> — one of the most common school class-period lengths, and a typical workshop session. Put it on the projector; every phone in the room can pull up the same link.</li>
            <li><b>1 hour</b> — a full class, a standard exam block, or a meeting you'd like to actually end on time. Once a countdown includes hours the board switches to HH:MM:SS, and that format stays fixed for the whole hour so the display never jumps partway through.</li>
          </ul>
          <h3>Counting up instead: the shared stopwatch</h3>
          <p>Most online stopwatches live and die on one screen. Switch <b>Direction</b> to “Count up” below and this one becomes shareable: press start, send the link, and everyone who opens it sees the same elapsed time ticking up, because the start instant travels inside the link itself.</p>
          <p>Nothing is actually “running” anywhere, which is why closing the tab doesn't lose it — the link records when the stopwatch started, so reopening it later shows the correct elapsed time as if it had been running the whole while. There's deliberately no lap or split function; for lap timing you want a single-device sports stopwatch. This tool's job is showing one agreed elapsed time on many screens.</p>
        </div>`,
    faq: [
      { q: "How accurate is a shared timer across devices?", a: "Accurate to about a second. Each device counts down independently against the same shared deadline using its own clock, so there's no server lag to introduce drift between screens." },
      { q: "Is there a limit to how many people can open the link?", a: "No limit. Since there's no server tracking viewers, showing the countdown to one person or a thousand costs exactly the same — nothing. Each device just does its own math against the timestamp in the URL." },
      { q: "Does it still work if I close the tab and reopen it?", a: "Yes. Reopening the link re-reads the same deadline from the URL and picks up exactly where the countdown should be — nothing resets." },
      { q: "Does the timer keep going if the Wi-Fi drops?", a: "Yes, on any device that already has the page open. The countdown is calculated locally against a timestamp in the URL, so it doesn't need an ongoing connection to keep counting." },
      { q: "Can I use a duration that isn't one of the presets?", a: "Yes. Set it on the board itself: click a pair of digits and roll them with the up and down arrows, or just type the time in — typing 7 0 0 gives you 7:00, the same way a microwave works. Rolling the minutes past 59 adds an hours pair automatically, and you can add or remove hours with the small +hr control to the left of the digits. The custom-minutes field and the date & time field below the board still work the same way." },
      { q: "How do I set the timer without using the buttons below?", a: "The board is the control. Hover or tap a pair of digits and small up and down arrows appear over them; click those, use the arrow keys, scroll over the digits, or drag them up and down on a touchscreen. You can also paste a duration like 1:30:00 or 90m straight onto the board. Once a countdown is running the board locks, so nobody watching your shared link can change what the room sees." },
      { q: "What happens when a shared countdown runs out?", a: "Every open screen hits zero at the same instant and plays a short chime if sound is on. Nothing else happens automatically, so it's safe to leave running in the background." },
    ] },
  { slug: "exam-timer", minutes: 60, label: "Time is up — pens down", eyebrow: "Exam Timer", affiliate: true,
    h1: "Exam Timer — One Countdown For The Whole Room",
    meta: "A shareable exam timer for classrooms and test centres. Every invigilator's screen and every student device shows the identical countdown to the second.",
    intro: "Put the countdown on the front screen and, if students have devices, on theirs too — everyone sees the identical time remaining, which is the whole point of a fair exam clock. Set it to your exam length and share the link before the paper starts.",
    extra: EXAM_EXTRA,
    howto: [
      "Set the exam length straight on the board — click the minutes and use the arrows, or just type it (type 90 00 for an hour and a half). You can also count down to a fixed finish time using \"…or until a date & time\".",
      "Put the board on the room's front screen and press Fullscreen so the countdown is readable from the back.",
      "If your exam rules permit candidate devices, press Show QR code so students can open the identical countdown on their own screens.",
      "Press Start countdown as you begin the paper — every screen hits zero at the same instant and plays the chime.",
    ],
    faq: [
      { q: "Can students see the same countdown on their own devices during a test?", a: "Yes, if your exam rules permit devices — every device that opens the link shows the identical time remaining. Many exam contexts restrict student devices entirely, in which case display it on the room's front screen only." },
      { q: "What happens if a student's device clock is wrong?", a: "It doesn't matter — the countdown is calculated from the shared deadline in the link, not from the device's own clock, so display accuracy only depends on the device's clock being roughly correct (typically accurate to within a second), not on it being manually set right." },
      { q: "Is this accurate enough for a formal, timed exam?", a: "It's accurate to about a second across every device, since each one counts down independently against the same shared timestamp — the same underlying approach used by any client-side countdown. For extremely high-stakes timing, follow your institution's official exam-clock policy." },
    ] },
  { slug: "classroom-timer", minutes: 10, label: "Back to it", eyebrow: "Classroom Timer", affiliate: true,
    h1: "Classroom Timer — For Group Work & Transitions",
    meta: "A free classroom timer built for transitions, group work and quiz rounds — project it or share the link so every student sees the same countdown.",
    intro: "Group work, quiz rounds, silent reading, transition time between activities — a visible shared countdown ends the “how much longer” questions on its own. Project it fullscreen or share the link to student devices.",
    extra: CLASSROOM_EXTRA,
    howto: [
      "Set the length on the board itself — click a pair of digits and roll them with the arrows, or type the time in. Quick timer presets are there too if one of them already fits.",
      "Type the activity under \"What's it for?\" so the screen answers \"what are we doing?\" as well as \"how long left?\".",
      "Press Fullscreen to project it, or Show QR code so students can pull the same countdown up on their own devices.",
      "Press Start countdown, and set a fresh timer for each activity so every one gets its own clean clock.",
    ],
    faq: [
      { q: "Is this better than just projecting a phone timer app?", a: "The advantage is sharing: instead of only the front-screen clock, students can pull up the identical countdown on their own device too, so a quick glance answers \"how much longer\" without asking." },
      { q: "Can I reuse the same setup for different activities during one lesson?", a: "Yes — set a new quick-timer duration for each activity and share the fresh link; each activity gets its own clean countdown." },
      { q: "Does this need a school Wi-Fi login or account?", a: "No signup for you or your students. The page itself needs to load once (standard classroom Wi-Fi/projector network is enough), and after that each device counts down locally." },
    ] },
  { slug: "webinar-countdown", minutes: 5, label: "We're starting", eyebrow: "Webinar Countdown", affiliate: true,
    h1: "Webinar Countdown — For Attendee Start Times",
    meta: "A shareable pre-webinar countdown. Put the link in your registration email or waiting room so every attendee's screen counts down to the same start time.",
    intro: "Drop this link in your registration confirmation or waiting-room slide. Every attendee who opens it — on any device, in any timezone — sees a countdown to the exact same start moment, because the deadline travels inside the link itself.",
    faq: [
      { q: "Does this handle attendees in different timezones correctly?", a: "Yes — the link encodes one exact instant, not a wall-clock time, so every attendee's device converts it to their own local time automatically and everyone counts down to the same real moment." },
      { q: "Can I put this in an email before the webinar starts?", a: "Yes — that's a common use: paste the link into your registration confirmation or reminder email so attendees can see exactly how long until you go live." },
      { q: "What should attendees see after the countdown ends?", a: "The board shows the countdown has reached zero; from there, switch attendees to your actual webinar link/room, since this page is the countdown itself, not the meeting." },
    ] },
  /* The head of the Meetings cluster, added 2026-09-06.
   *
   * Why one page and not seven: the roundup SERPs that AI assistants draw
   * from ("best shared timer for meetings") are occupied by competitors whose
   * matching URL is literally /use-cases/meeting-timer — stagetimer,
   * countdownshare, timerlink, remotetimer — and CountLink had zoom/meet/
   * standup/workshop pages but nothing at the generic head those queries use.
   * The obvious response was a batch of new use-case pages, and it was the
   * wrong one: 42 of 45 URLs here sit in "Discovered – currently not indexed"
   * with 1 referring domain, which is exactly why eight duration pages were
   * culled on 2026-07-29. So this is a HUB, not a doorway — it links the four
   * pages that already cover the specific cases rather than competing with
   * them, which is the page shape (/timers/, /guides/) that does get indexed
   * on this domain. Do not use it as precedent for adding six more.
   */
  { slug: "meeting-timer", minutes: 30, label: "Meeting over", eyebrow: "Meeting Timer", affiliate: true,
    h1: "Meeting Timer — One Countdown Everyone In The Room Can See",
    meta: "A free shared meeting timer. Set the length, send one link, and every attendee — in the room and remote — sees the identical countdown. No account, no viewer limit, no screen share.",
    intro: "Meetings overrun because time is invisible to everyone except whoever is watching the clock. Set the length here, share the one link, and the countdown is on every attendee's own screen at once — remote and in-room, to the same second, without anyone screen-sharing or installing anything.",
    setupHint: "Thirty minutes is loaded on the board. Roll or type a different length, or count down to the hard stop you actually have.",
    extra: `
    <h2>Pick the meeting you're actually running</h2>
    <p>The board above works for any of these — these pages just start at the
    right length and answer the questions specific to each:</p>
    <ul class="use-list">
      <li><a href="/timers/standup-timer">Standup timer</a> — the daily one, for keeping it to ten minutes.</li>
      <li><a href="/timers/zoom-meeting-timer">Zoom meeting timer</a> — paste into the call chat; no screen share needed.</li>
      <li><a href="/timers/google-meet-timer">Google Meet timer</a> — same, without an extension.</li>
      <li><a href="/timers/workshop-timer">Workshop timer</a> — longer sessions and breakout groups that need to finish together.</li>
      <li><a href="/timers/agenda-timer">Agenda timer</a> — several named segments in order, advancing themselves on every screen.</li>
      <li><a href="/timers/webinar-countdown">Webinar countdown</a> — the wait before it starts, not the meeting itself.</li>
    </ul>
    <h2>Timeboxing the whole agenda, not just the meeting</h2>
    <p>A single countdown keeps a meeting inside its slot; it does not stop
    the first item eating the third item's time. For that, build the agenda as
    named segments — intro, demo, decision, AOB — and let it advance itself on
    every screen. There is a longer piece on doing this well in
    <a href="/guides/timeboxing-meetings">the guide to meetings that end on time</a>.</p>
    <h2>If the meeting changes shape mid-way</h2>
    <p>Tick <b>phone control</b> before you start and you get a second link
    that pauses the countdown, adds or removes a minute, and stops it — live,
    on every screen that has it open — from your phone, without touching the
    shared screen. And if nobody can copy a link off the room display, read
    out the join code instead: every running countdown gets a five-character
    one.</p>`,
    faq: [
      { q: "Does everyone need an account or an app?", a: "No. It's a web page — anyone with the link opens it in whatever browser they already have. There's no signup, no extension and no install, for you or for them." },
      { q: "How many people can watch the same meeting timer?", a: "As many as you like. Nothing is held open per viewer, so a two-person one-to-one and a 400-person all-hands cost the same to serve — which is why there's no device cap here and no paid tier to lift one." },
      { q: "Can I use it for a hybrid meeting?", a: "That's the case it's best at. The countdown is a fixed instant rather than a stream from a server, so the room's projector and a remote attendee's laptop are doing the same subtraction and agree to the second — no screen share, and nothing to fall behind." },
      { q: "Can I keep a meeting timer running across several agenda items?", a: "Use the agenda timer for that: give each item a name and a length and it moves through them itself, on every screen at once, rather than needing someone to restart a countdown between items." },
    ] },
  { slug: "standup-timer", minutes: 10, label: "Standup over", eyebrow: "Standup Timer", affiliate: true,
    h1: "Standup Timer — Keep Daily Standups Short",
    meta: "A free shareable standup timer for teams. Set the length once, drop the link in Slack, and everyone sees the same countdown to keep standup on time.",
    intro: "The easiest way to keep a daily standup to ten minutes is a countdown everyone can see. Set the length, drop the link in your team channel, and project it during the call.",
    faq: [
      { q: "Can I pin this link in Slack for the team to reuse?", a: "You can pin it, but remember each link is tied to a specific end time — for a genuinely reusable daily habit, it's quickest to hit the same quick-timer button each morning and share that day's fresh link." },
      { q: "Does everyone need to join a call to see it?", a: "No — anyone with the link can open it on their own device, whether they're in a video call, in the office, or just watching from a browser tab." },
      { q: "Will remote and in-office teammates see the same countdown?", a: "Yes — the deadline is one shared instant regardless of device or location, so remote and in-office teammates see identical time remaining." },
    ] },
  { slug: "zoom-meeting-timer", minutes: 10, label: "Time's up", eyebrow: "Zoom Meeting Timer", affiliate: true,
    h1: "Zoom Meeting Timer — Keep Every Call On Time",
    meta: "A free shared timer for Zoom calls that doesn't need screen-sharing — copy the link into the chat and everyone's own screen counts down together.",
    intro: "Screen-sharing a timer inside Zoom works, but it takes over your whole screen. Open this on a second monitor or phone instead, or drop the link in the meeting chat — everyone gets their own synced countdown without you sharing anything.",
    extra: ZOOM_EXTRA,
    faq: [
      { q: "Do attendees need to install anything?", a: "No — opening the link in any browser is enough. There's no Zoom app, add-on, or extension involved." },
      { q: "Can I use this instead of Zoom's built-in meeting timer?", a: "Yes — CountLink's link is visible to every attendee on their own device, while Zoom's built-in timer is host-only and disappears once you share your screen." },
      { q: "Does it still work if I'm also sharing my screen?", a: "Yes — since attendees open the link on their own device or a second monitor, it works whether or not you're sharing your screen for something else." },
    ] },
  { slug: "google-meet-timer", minutes: 10, label: "Time's up", eyebrow: "Google Meet Timer", affiliate: true,
    h1: "Google Meet Timer — Shared Countdown For Calls",
    meta: "A free shared timer for Google Meet. Copy the link into the meeting chat and everyone's own screen counts down in sync — no extension, no screen share.",
    intro: "Paste the link into the in-call chat the moment the meeting starts. Nobody needs to install an extension or watch your shared screen — everyone's own tab counts down to the exact same second.",
    faq: [
      { q: "Is there a Google Meet extension I need to install?", a: "No — this is a plain web page. Paste the link into the in-call chat and anyone can open it in a new tab, no extension required." },
      { q: "Can I run this on a second screen while presenting?", a: "Yes — that's a common setup: keep the timer open on a second monitor or phone while your main screen is shared, so you can glance at the time without interrupting your presentation." },
      { q: "Will it work the same in Google Meet as it does elsewhere?", a: "Yes — the timer isn't specific to any video platform; it's just a link that happens to work well pasted into Meet's chat." },
    ] },
  // Absorbed twitch-stream-timer 2026-07-29. The two pages measured 51% unique
  // prose each — the most duplicative pair on the site — because they described
  // the same OBS browser-source workflow twice, once with the word "Twitch" in
  // it. Twitch-specific answers are kept below rather than dropped.
  { slug: "obs-countdown-timer", minutes: 5, label: "Starting soon", eyebrow: "Stream Countdown (OBS)",
    h1: "OBS & Twitch Countdown Timer — Free Browser Source",
    meta: "A free stream-starting countdown for OBS, Twitch and YouTube — a transparent browser-source overlay with no watermark, plus a link to share with mods and co-streamers.",
    intro: "Add the overlay version of this page as an OBS Browser Source and it drops onto your scene with a transparent background — no green screen, no chroma key setup. Set your stream-start countdown, copy the link into OBS, and it's live. Share the regular link with mods or co-streamers and their screens match yours exactly.",
    extra: OBS_OVERLAY_EXTRA,
    faq: [
      { q: "Will the background really be transparent in OBS?", a: "Yes — the overlay link removes the page background entirely (not just visually dark, genuinely transparent), so only the countdown digits appear on your scene, with no chroma key or green screen needed." },
      { q: "Does the countdown keep running if I switch OBS scenes?", a: "Yes, as long as the Browser Source stays loaded — if you enable \"Shutdown source when not visible,\" OBS will reload it when the scene becomes active again and it will recalculate against the same shared deadline correctly." },
      { q: "Can I resize the overlay without it looking blurry?", a: "Yes — the digits are rendered as live text (not an image), so resizing the Browser Source in OBS stays sharp at any size." },
      { q: "Will viewers on Twitch see the same countdown as my screen?", a: "Yes — whatever is on your OBS scene is what viewers see, and the overlay's countdown is calculated from the same shared deadline, so there's nothing separate to keep in sync." },
      { q: "Can my co-streamer or mod use the same countdown on their own screen?", a: "Yes — share the regular (non-overlay) link with them and their device shows the identical time remaining, useful for coordinating a multi-person stream start." },
      { q: "Does this cost anything or add a watermark to my stream?", a: "No — it's free with no watermark. The one exception is if you use the QR-code button, which calls a third-party API only when clicked; the overlay/timer itself never does." },
    ] },
  { slug: "workshop-timer", minutes: 15, label: "Segment over", eyebrow: "Workshop Timer", affiliate: true,
    h1: "Workshop Timer — One Countdown For Every Table",
    meta: "A free shared timer for workshop facilitators. Set the segment length, share the link, and every table or breakout group sees the identical countdown.",
    intro: "Facilitators running breakout groups or table exercises know the problem: one group finishes early, another runs long, because everyone's eyeballing their own phone clock. Share this link instead and every table counts down from the same number.",
    faq: [
      { q: "Can each table or breakout group open the link on their own device?", a: "Yes — that's the intended use. Share one link and every table's device shows the identical time remaining, so there's no ambiguity about when a segment ends." },
      { q: "Can I set up several segments in a row (talk, break, Q&A)?", a: "Yes — use the agenda timer at countlink.app/timers/agenda-timer. Add each segment in order (talk, break, Q&A), press Start agenda, and share the one link it gives you: every device works out which segment is live from the shared start instant and advances together, with no server involved. Once running, the order is locked in for that run." },
      { q: "Is this suitable for a large room with many tables?", a: "Yes — there's no limit on how many devices can open the same link, so it scales to as many tables or groups as you have." },
    ] },
  { slug: "group-study-timer", minutes: 25, label: "Break time", eyebrow: "Group Study Timer", affiliate: true,
    h1: "Group Study Timer — Study With Me, In Sync",
    meta: "A free shared study timer for study groups and study-with-me sessions. Set a single focus block, or turn on the optional panel to auto-cycle the whole focus/break rhythm.",
    intro: "Studying with friends or running a study-with-me stream works best when breaks actually line up. Set a single focus block here and share the link, or use the auto-cycling panel further down as an option to run the whole rhythm — breaks included — without restarting anything between rounds.",
    setupHint: "The board above is set to a single 25-minute focus block, and you can change it right there. For the full auto-cycling rhythm instead, use the panel below the board.",
    extra: GROUP_STUDY_EXTRA,
    faq: [
      { q: "Is this good for a \"study with me\" livestream?", a: "Yes — set your focus-block length, share the link in chat or your stream description, and viewers studying along with you see the identical countdown to the second." },
      { q: "Can my study group use this even if we're not all together?", a: "Yes — everyone opens the same link from wherever they are, and each device counts down to the same shared moment regardless of location." },
      { q: "Does it support a work/break cycle automatically?", a: "It's optional — the board above the auto-cycling panel is a plain single block if that's all you want. Turn the panel on and it alternates focus and break on its own, round after round, with a longer break every fourth by default, all in sync on every screen from one link." },
    ] },
  { slug: "game-night-timer", minutes: 3, label: "Time's up", eyebrow: "Game Night Timer",
    h1: "Game Night Timer — For Turns And Rounds",
    meta: "A free shareable timer for board games and game night house rules. Set the turn limit, share the link, and nobody argues about how much time is left.",
    intro: "Every game night needs a turn timer eventually — charades rounds, drafting phases, \"you have sixty seconds to decide.\" Set it once, share the link to everyone's phone, and the countdown settles the argument before it starts.",
    faq: [
      { q: "Can everyone at the table see the countdown on their own phone?", a: "Yes — share the link once and each phone at the table shows the identical time remaining, so there's no dispute about who saw what." },
      { q: "Is this good for party games with strict time limits, like charades?", a: "Yes — set the turn length, share the link, and use Fullscreen mode on a central phone or tablet so the whole table can see it at a glance." },
      { q: "Can I quickly restart it for the next player's turn?", a: "Yes — hit the same quick-timer button again for a fresh countdown each turn; it takes one tap." },
    ] },
  { slug: "auction-countdown", minutes: 5, label: "Bidding closed", eyebrow: "Auction Countdown",
    h1: "Auction Countdown — Synced Bidding Deadline",
    meta: "A free countdown for live and online auctions. Share the link so every bidder sees the exact same time remaining before bidding closes.",
    intro: "A live auction or limited drop lives or dies on everyone seeing the same deadline. Share this link before bidding opens and every bidder's screen counts down to the identical closing second — no one can claim their clock ran differently.",
    faq: [
      { q: "Can every bidder trust they're seeing the same closing time?", a: "Yes — every device counts down to the exact same shared deadline encoded in the link, so no bidder's clock can legitimately run ahead of or behind anyone else's." },
      { q: "Is there a limit on how many bidders can watch the countdown?", a: "No — any number of people can open the same link at once, since each device just does its own math rather than connecting to a server." },
      { q: "What happens the instant bidding closes?", a: "Every open screen reaches zero at the same instant and shows the countdown has ended — treat that as your hard cutoff for accepting further bids." },
    ] },
  // stopwatch consolidated into the /timers/ hub 2026-07-29 — "online stopwatch"
  // is online-stopwatch.com's own brand term and was never a winnable SERP for a
  // three-month-old domain. Count-up is a Direction toggle on every page anyway,
  // so the page was a preset with an unwinnable title. Prose lives in the hub's
  // "Counting up instead" section.
  { slug: "pomodoro-timer", minutes: 25, label: "Pomodoro — focus", eyebrow: "Pomodoro Timer", affiliate: true,
    h1: "Pomodoro Timer — 25 Minutes, Shareable",
    meta: "A free pomodoro timer you can share: auto-cycling focus and break rounds with a long break every fourth, or a single 25-minute block — the whole study group or team stays on the same clock.",
    intro: "The pomodoro technique is 25 minutes of focus, then a 5-minute break, repeated, with a longer break every fourth round. Start a single 25-minute block below, or use the auto-cycling panel further down to run the whole rhythm — breaks included — without touching anything between rounds. Share the link either way and your study group or team stays on the same clock.",
    setupHint: "The board above is set to the classic 25-minute pomodoro for a single block, and you can change it on the board itself. For the full auto-cycling rhythm, use the panel below the board instead.",
    extra: POMODORO_EXTRA,
    howto: [
      "For one focus block: set 25 minutes — type 25 00 straight onto the board, or tap the 25 min preset — then press Start countdown.",
      "For the full rhythm: scroll to \"Auto-cycling focus and break\" below, check the focus/break/long-break lengths and round count, and press Start auto-cycling pomodoro.",
      "Either way, press Copy sync link on the board and send it to whoever is working along with you; every device shows the identical round and phase.",
      "The auto-cycling version advances itself — focus, break, focus, break, with a long break every fourth round — so there's nothing to restart between blocks.",
    ],
    faq: [
      { q: "Why 25 minutes?", a: "That's the classic pomodoro length from Francesco Cirillo's original technique — long enough to get real work done, short enough that starting doesn't feel heavy. The auto-cycling panel's Focus field takes any length if your group prefers 50/10." },
      { q: "Can my study group all follow the same pomodoro?", a: "Yes — that's the point of the shared link. Everyone opens it and sees the identical round and phase, so the whole group starts focusing and breaks at the same moments." },
      { q: "Does it auto-advance from focus to break on its own?", a: "The auto-cycling panel does, all the way through your set number of rounds, with a long break every fourth by default — the same start-instant-in-the-link mechanic as the interval and agenda timers, so there's still no server and no viewer limit. The single board above the panel stays a plain one-block countdown if that's all you want." },
      { q: "Can I change how often the long break happens?", a: "Yes — the \"Long break every\" field takes any round count, not just four. Set it to 0 to disable the long break entirely and just alternate focus and short break." },
    ] },
  // Absorbed tabata-timer and boxing-round-timer 2026-07-29. All three were the
  // same work/rest engine with a different preset and a different sport's name
  // on it (59–61% unique prose each). The protocols themselves are the useful
  // part, so they survive as a table of presets plus their own FAQ answers.
  { slug: "interval-timer", minutes: 10, label: "Rounds complete", eyebrow: "Interval Timer",
    h1: "Interval Timer — Tabata, Boxing Rounds & Custom Work/Rest",
    meta: "A free shareable interval timer — Tabata 20/10, boxing 3-minute rounds, or any custom work/rest split and round count, with every screen on the identical round.",
    intro: "Set a work length, a rest length, and how many rounds — press start, and share the link so everyone doing the same workout, drill, or exercise sees the identical round and phase on their own device. The classic protocols are one click below.",
    setupHint: "Defaults to a general 30s work / 15s rest / 10 rounds split — set any work/rest lengths and round count you need.",
    extra: ivExtra(30, 15, 10) + `
        <div class="obs-extra">
          <h3>Standard protocols</h3>
          <p>Set any of these in the work/rest/rounds fields above — the shared-link mechanic is identical whichever you pick. The numbers are the whole difference between them, so here they are as numbers.</p>
          <div class="data-table-wrap">
            <table class="data-table">
              <caption>Work / rest / rounds for the common protocols</caption>
              <thead>
                <tr><th scope="col">Protocol</th><th scope="col">Work</th><th scope="col">Rest</th><th scope="col">Rounds</th><th scope="col">Total</th><th scope="col">Notes</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">Tabata</th><td class="num">20s</td><td class="num">10s</td><td class="num">8</td><td class="num">4:00</td><td>Dr. Izumi Tabata's original protocol from a 1996 study on high-intensity interval training — short enough to sustain near-maximal effort, with just enough rest to repeat it eight times. Change the 20/10 ratio and it stops being strictly Tabata, but it still works.</td></tr>
                <tr><th scope="row">Boxing (professional)</th><td class="num">3 min</td><td class="num">1 min</td><td class="num">12</td><td class="num">48:00</td><td>The standard professional format.</td></tr>
                <tr><th scope="row">Boxing (amateur)</th><td class="num">2 min</td><td class="num">1 min</td><td class="num">3–4</td><td class="num">8:00–12:00</td><td>Amateur bouts and several other combat sports use the shorter round.</td></tr>
                <tr><th scope="row">Muay Thai</th><td class="num">3 min</td><td class="num">2 min</td><td class="num">3–5</td><td class="num">14:00–24:00</td><td>Longer rests than boxing; set the round count to however many the bout runs.</td></tr>
                <tr><th scope="row">Back-to-back sets</th><td class="num">any</td><td class="num">0s</td><td class="num">any</td><td class="num">—</td><td>Each round runs straight into the next work phase with no pause, for a fixed number of consecutive timed sets.</td></tr>
              </tbody>
            </table>
          </div>
        </div>`,
    faq: [
      { q: "Can I run a classic Tabata on this?", a: "Yes — set work to 20 seconds, rest to 10, and rounds to 8. That's Dr. Izumi Tabata's original protocol from a 1996 study on high-intensity interval training, and it comes to about four minutes total." },
      { q: "Does this match standard boxing round timing?", a: "Set 3 minutes work, 1 minute rest, 12 rounds and yes — that's the standard professional format. Muay Thai commonly uses 3-minute rounds with 2-minute rests; both are just numbers in the fields above." },
      { q: "Can rest be zero seconds, for back-to-back rounds?", a: "Yes — set rest to 0 and each round runs straight into the next work phase with no pause, useful for a fixed number of consecutive timed sets." },
      { q: "Does everyone see the same round at the same time?", a: "Yes — the cycle's start instant is encoded in the link itself, so every device computes the current round and phase independently from the same starting point, with no server keeping them in sync. A coach's phone and every fighter's screen stay on the identical round." },
      { q: "What happens when all rounds finish?", a: "Every screen shows \"Done\" together and chimes if sound is on. Press Restart for the identical work/rest/rounds setup again, or adjust the numbers and start fresh." },
      { q: "Is there a ten-second warning before a round ends?", a: "Not a distinct warning sound, but the screen-reader announcement and the visible countdown both update every second in the final stretch, so it's easy to see (or hear, with assistive tech) a round winding down." },
    ] },
  { slug: "multiple-timers-at-once", minutes: 5, label: "", eyebrow: "Multiple Timers",
    multiTimer: true,
    h1: "Multiple Timers at Once — Shareable Dashboard",
    meta: "Run several named countdowns on one screen — cooking, multi-station events, parallel exam sections — all synced by one shareable link.",
    intro: "Add as many named timers as you need — each one is its own independent countdown, all shown together on one dashboard. Share the link and everyone sees the identical set of timers, all counting down together.",
    howto: [
      "Press Add timer for each clock you need, naming each one so they can be told apart at a glance.",
      "Give each timer its own duration — they run independently rather than sharing a single countdown.",
      "Press \"Copy link to this set\" to share every timer at once; the whole set travels in the one link.",
      "Use Clear all to reset the board between rounds, sessions or groups.",
    ],
    faq: [
      { q: "Do all the timers share one countdown, or run independently?", a: "Independently — each timer you add has its own name and its own end time. Adding, removing, or finishing one has no effect on the others." },
      { q: "How is the set of timers kept in sync across devices?", a: "The same mechanic as every other page here: each timer's end instant is encoded in the page's link. Copy the link after adding your timers, and anyone who opens it sees the identical set, each counting down from wherever it currently is." },
      { q: "Is there a limit to how many timers I can add?", a: "No hard limit, but a screen full of dozens of cards gets hard to scan — for most uses (cooking a multi-dish meal, running parallel breakout timers) a handful at once is the practical ceiling." },
      { q: "Can I remove just one timer without resetting the others?", a: "Yes — each card has its own remove button; removing one leaves the rest of the set (and the shareable link) intact." },
    ] },
  { slug: "agenda-timer", minutes: 5, label: "", eyebrow: "Agenda Timer",
    agendaTimer: true,
    h1: "Agenda Timer — Auto-Advancing Segments, Synced",
    meta: "Build an ordered agenda of named segments — intro, break, Q&A — and it auto-advances through them for everyone who opens the link, no server involved.",
    intro: "Add segments in order — Intro, Break, Q&A, whatever your session needs — then start. Unlike a single countdown, this one auto-advances from one segment to the next on its own, and everyone who opens the link sees the identical segment and time remaining, in sync.",
    howto: [
      "Press Add segment for each item in the running order, giving every one a name and a length.",
      "Check the order top to bottom before you begin — segments run in sequence and each one auto-advances into the next.",
      "Press Copy sync link and share it, so every participant's screen follows the same agenda.",
      "Press Start agenda when the meeting begins; use New agenda to build a fresh running order without disturbing the shared link.",
    ],
    faq: [
      { q: "Does this really auto-advance without a server?", a: "Yes — the trick is the same one the Interval/Tabata timer uses: only the start instant and the list of segment lengths are in the link. Every device computes which segment is \"now\" from elapsed time since that instant, so there's nothing to synchronize after the link is shared — no server ever tells anyone to advance." },
      { q: "Can I reorder segments before starting?", a: "Yes — use the up/down arrows next to each segment in the builder to reorder, or the × to remove one, before pressing Start agenda. Once started, the order is locked in for that run." },
      { q: "What happens when the whole agenda finishes?", a: "Every open screen shows \"Agenda complete\" together and chimes if sound is on — the same shared-instant mechanic means everyone's screen reaches the end at the same moment." },
      { q: "Can I edit the agenda after starting?", a: "Not the running one — press \"New agenda\" to build and start a fresh sequence. This keeps the sync guarantee simple: one link is always one fixed, unambiguous sequence." },
    ] },
  { slug: "new-year-countdown", theme: "newyear", minutes: 10, untilMonthDay: [1, 1], label: "Happy New Year!", eyebrow: "New Year Countdown",
    h1: "New Year Countdown — Live, Shareable",
    meta: "A live countdown to New Year you can share: days, hours, minutes and seconds to midnight January 1st, identical on every screen that opens the link.",
    intro: "The board above is already counting down to midnight, January 1st in your own time zone — days, hours, minutes and seconds. Share the link and everyone counts down to that exact same instant together, wherever they are.",
    setupHint: "Already set to the next January 1st at midnight, local time — change the date here for a different moment.",
    faq: [
      { q: "Which New Year does this count down to?", a: "Always the next one: the page computes the coming January 1st at midnight in your device's own time zone when you open it, so it never shows a stale or past date." },
      { q: "If I share the link with friends in another time zone, do they see their own local midnight?", a: "No — the link locks in one exact instant (YOUR midnight), and everyone who opens it counts down to that same moment on their own clock. That's what keeps every screen in sync. If a friend elsewhere wants a countdown to their own midnight, they'd start their own timer and share that link instead." },
      { q: "Can I put this on a screen at a party?", a: "Yes — press start, open the link on the TV or projector, and use Fullscreen. The Light board style keeps it readable if the room is bright." },
    ] },
  { slug: "christmas-countdown", theme: "christmas", minutes: 10, untilMonthDay: [12, 25], label: "Merry Christmas!", eyebrow: "Christmas Countdown",
    h1: "Christmas Countdown — Days Until December 25",
    meta: "A live Christmas countdown you can share: days, hours, minutes and seconds until December 25th, the same on every screen that opens the link.",
    intro: "The board above is counting down to midnight, December 25th in your own time zone — days, hours, minutes, seconds. Start it, share the link, and the kids can check the identical countdown on any device without asking you again.",
    setupHint: "Already set to the next December 25th at midnight, local time — change the date here to count to Christmas Eve or any other moment instead.",
    faq: [
      { q: "Does this show days as well as hours and minutes?", a: "Yes — countdowns longer than a day display as days plus hours:minutes:seconds, and the format stays fixed for the whole countdown." },
      { q: "Will it still be right if I open it next year?", a: "Yes — the page always computes the NEXT December 25th when it loads, so it never counts to a Christmas that already happened. (A link you've already started and shared is pinned to its specific year, as every shared link is.)" },
      { q: "If I send this link to relatives in another time zone, does it count to their own midnight?", a: "No — the link locks in one exact instant (midnight where YOU started it), so relatives elsewhere count down to that same moment on their own clock, not a separate midnight for their zone. If they want their own local countdown, they can start their own timer and share that link." },
      { q: "Can I count down to Christmas Eve instead?", a: "Yes — use the date & time field below to pick December 24th (or any moment), then start and share that link." },
    ] },
];

// Mediavine Grow loader — renders nothing until GROW_SITE_ID is set, matching
// the same off-by-default contract as the GA/AdSense tags. Reproduces Grow's
// documented non-WordPress loader; the Publisher Portal is the source of truth.
const growScript = () => GROW_SITE_ID ? `<script data-grow-initializer="">
!(function(){window.growMe||((window.growMe=function(e){window.growMe._.push(e);}),(window.growMe._=[]));var e=document.createElement("script");(e.type="text/javascript"),(e.src="https://faves.grow.me/main.js"),(e.defer=!0),e.setAttribute("data-grow-faves-site-id","${GROW_SITE_ID}");var t=document.getElementsByTagName("script")[0];t.parentNode.insertBefore(e,t);})();
</script>` : "";

const BRAND = NAME; // imported from ./site-config.mjs — the one place these values live

// How many sibling timers a single timer page links to. Dumping all 29 on
// every page made each page ~45% boilerplate and is the doorway-page pattern
// Google calls out explicitly; a rotating window keeps every timer reachable
// (each page links to 12 others, so the whole set stays crawlable) while
// leaving the page's own content the dominant part of it.
const RELATED_WINDOW = 12;

// currentSlug === null → every timer (used by the homepage, where a full
// index is the point). Otherwise a wrapping window centred on the current
// page, so neighbouring timers differ from page to page.
function timerLinks(currentSlug, indent = "          ") {
  let chosen;
  if (currentSlug == null) {
    chosen = PAGES;
  } else {
    const i = PAGES.findIndex(p => p.slug === currentSlug);
    chosen = [];
    for (let off = 1; chosen.length < RELATED_WINDOW && off < PAGES.length; off++) {
      const after = PAGES[(i + off) % PAGES.length];
      const before = PAGES[(i - off + PAGES.length) % PAGES.length];
      if (after.slug !== currentSlug && !chosen.includes(after)) chosen.push(after);
      if (chosen.length < RELATED_WINDOW && before.slug !== currentSlug && !chosen.includes(before)) chosen.push(before);
    }
  }
  const links = chosen
    .filter(p => p.slug !== currentSlug)
    .map(p => `<a href="${hrefFor(p.slug)}">${p.eyebrow}</a>`);
  if (currentSlug != null) links.push(`<a href="/">Browse all ${PAGES.length} timers →</a>`);
  return links.join(`\n${indent}`);
}

// Same links, but rooted for index.html (one directory up from /timers/).
const rootTimerLinks = timerLinks(null, "      ");

// FAQPage JSON-LD generated from each page's own `faq` array — never shared
// verbatim between pages, per docs findings that repeated FAQ text across
// URLs reads as low-diversity to AI answer engines.
const faqSchema = (faq) => faq ? `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map(f => ({
    "@type": "Question", name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
})}</script>` : "";

// Optional "How to" block: visible ordered steps plus HowTo JSON-LD, both
// generated from the same `howto` array so the structured data can never drift
// from what's on screen — same discipline as the FAQ pair above, and the same
// mechanism diffhero uses. HowTo is well consumed by AI answer engines, and
// AI-assistant referral is the only channel here that delivers engaged humans
// (29% of sessions at 38s avg engagement vs 3s for direct), so it earns its
// place. Pages without a `howto` array render nothing extra.
const howToSchema = (howto, name) => howto && howto.length ? `<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: `How to use the ${name}`,
  step: howto.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: s })),
})}</script>` : "";

// Steps are hand-authored trusted content and may carry inline markup, exactly
// like the `faq` strings below — so they're interpolated as-is rather than
// escaped. The JSON-LD above takes the same strings; JSON.stringify handles
// its own quoting, so any markup stays literal text there.
const howToHtml = (howto, name) => howto && howto.length ? `
  <section class="howto">
    <h2>How to use the ${name}</h2>
    <ol>
      ${howto.map(s => `<li>${s}</li>`).join("\n      ")}
    </ol>
  </section>` : "";

// Visible FAQ HTML, matching the schema above verbatim (mismatched visible
// vs. structured-data FAQ content is a spam signal, so these must stay in sync
// — they're generated from the same array, so they can't drift).
const faqHtml = (faq) => faq ? `
  <section class="faq">
    <h2>Common questions</h2>
    <dl class="faq-grid">
      ${faq.map(f => `<div class="faq-item"><h3>${f.q}</h3><dd>${f.a}</dd></div>`).join("\n      ")}
    </dl>
  </section>` : "";

// Seasonal page themes — body class drives a CSS-variable palette swap in
// assets/style.css (search "SEASONAL PAGE THEMES"). THEME_COLORS keeps the
// browser-chrome theme-color meta in step with each palette's chassis tone.
const THEME_COLORS = { christmas: "#182219", newyear: "#141826" };

// Multi-timer dashboard: a genuinely different UI (several independent
// countdown cards, not one split-flap board), so it swaps out the whole
// stage/setup/recent-timers block below rather than reusing it.
const multiDashboardSection = `
  <section class="stage-section">
    <div class="multi-dashboard" id="multiDashboard">
      <div class="multi-add-row">
        <input id="multiLabel" placeholder="Timer name (e.g. Pasta, Round 1)">
        <input id="multiMinutes" type="number" min="1" value="5" aria-label="Minutes">
        <button type="button" class="btn primary" id="multiAddBtn">Add timer</button>
      </div>
      <div class="multi-cards" id="multiCards"></div>
      <div class="stage-btns" style="margin-top:16px">
        <button type="button" class="btn" id="multiShareBtn">Copy link to this set</button>
        <button type="button" class="btn" id="multiClearBtn">Clear all</button>
      </div>
      <div class="sync-note"><span id="syncMsg">Anyone opening this exact link sees the identical set of timers, counting down together.</span></div>
    </div>
  </section>

  <div class="ad-slot">
    <ins class="adsbygoogle" style="display:block;min-height:90px"
         data-ad-client="ca-pub-2653891546345771" data-ad-slot="9745719960"
         data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>if(!window.__CL_OVERLAY)(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>`;

// Agenda timer: an ORDERED sequence of named segments that auto-advances —
// unlike the multi-timer dashboard above (independent, parallel timers),
// this is one continuous run. It reuses the exact "the link is the timer"
// mechanic as the interval/Tabata timer (one start instant, every viewer's
// device derives the current phase from elapsed time — see startInterval()
// in assets/app.js), just with a list of different-length segments instead
// of one repeating work/rest pair, so it genuinely auto-advances with no
// server involved.
const agendaDashboardSection = `
  <section class="stage-section">
    <div class="agenda-dashboard" id="agendaDashboard">
      <div class="agenda-builder" id="agendaBuilder">
        <div class="multi-add-row">
          <input id="agendaLabel" placeholder="Segment name (e.g. Intro, Break, Q&amp;A)">
          <input id="agendaMinutes" type="number" min="1" value="5" aria-label="Minutes">
          <button type="button" class="btn primary" id="agendaAddBtn">Add segment</button>
        </div>
        <ol class="agenda-list" id="agendaList"></ol>
        <div class="stage-btns" style="margin-top:16px">
          <button type="button" class="btn primary" id="agendaStartBtn">Start agenda</button>
          <button type="button" class="btn" id="agendaClearBtn">Clear all</button>
        </div>
      </div>
      <div class="agenda-running" id="agendaRunning" hidden>
        <div class="agenda-now">
          <div class="agenda-now-label" id="agendaNowLabel"></div>
          <div class="agenda-now-time" id="agendaNowTime"></div>
          <div class="agenda-now-sub" id="agendaNowSub"></div>
        </div>
        <ol class="agenda-list agenda-list--running" id="agendaRunningList"></ol>
        <div class="stage-btns" style="margin-top:16px">
          <button type="button" class="btn" id="agendaShareBtn">Copy sync link</button>
          <button type="button" class="btn" id="agendaRestartBtn">New agenda</button>
        </div>
        <div class="sync-note"><span class="dot" id="agendaSyncDot"></span><span id="agendaSyncMsg">Anyone opening this link sees the identical agenda, in sync.</span></div>
      </div>
      <!-- The run of show. Rendered from the same segment list that drives the
           timer, so the sheet and the clock can never disagree. Printing is
           the point: @media print in style.css drops the builder, the nav and
           the ad and leaves this table on the page. -->
      <div class="runsheet" id="runSheet" style="display:none">
        <div class="lap-head">
          <h2>Run of show</h2>
          <button type="button" class="pro-link" id="runSheetPrint">Print this sheet</button>
        </div>
        <table>
          <caption id="runSheetTotal"></caption>
          <thead>
            <tr><th scope="col">#</th><th scope="col">Segment</th><th scope="col">Length</th><th scope="col">Starts</th><th scope="col">Ends</th></tr>
          </thead>
          <tbody id="runSheetBody"></tbody>
        </table>
        <div class="hint">Times are shown in your own timezone, worked out from the agenda's start instant — send the link and each person reads the sheet in their own local time.</div>
      </div>
    </div>
  </section>

  <div class="ad-slot">
    <ins class="adsbygoogle" style="display:block;min-height:90px"
         data-ad-client="ca-pub-2653891546345771" data-ad-slot="9745719960"
         data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>if(!window.__CL_OVERLAY)(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>`;

const page = (p) => { const stageBlock = p.multiTimer ? multiDashboardSection : p.agendaTimer ? agendaDashboardSection : `
  <section class="stage-section">
    <div class="board" id="boardEl">
      <span class="bolt-br"></span><span class="bolt-bl"></span>
      <div class="style-toggle" role="group" aria-label="Board style">
        <button type="button" data-style="board" aria-pressed="true">Board</button>
        <button type="button" data-style="minimal" aria-pressed="false">Minimal</button>
        <button type="button" data-style="light" aria-pressed="false">Light</button>
      </div>
      <div class="evt" id="evtLabel"></div>
      <div class="tiles" id="tiles" aria-hidden="true"></div>
      <div id="a11yStatus" class="sr-only" role="status" aria-live="polite"></div>
      <div class="sub" id="subLine"></div>
      <div class="bar"><i id="barFill"></i></div>
      <div class="stage-btns">
        <button class="btn primary" id="boardStartBtn">Start countdown</button>
        <button class="btn primary" id="shareBtn" style="display:none">Copy sync link</button>
        <button class="btn" id="stopBtn" style="display:none">Stop</button>
        <button class="btn" id="lapBtn" style="display:none">Lap</button>
        <button class="btn" id="fsBtn" aria-pressed="false">Fullscreen</button>
        <button class="btn" id="soundBtn" aria-pressed="true">Sound: on</button>
        <label class="alarm-tone-picker" for="alarmToneSelect">
          <select id="alarmToneSelect" aria-label="Alarm sound">
            <option value="chime">Chime</option>
            <option value="gentle">Gentle</option>
            <option value="digital">Digital</option>
            <option value="bell">Bell</option>
          </select>
        </label>
      </div>
      <div class="sync-note"><span class="dot" id="syncDot"></span><span id="syncMsg">Anyone opening your link right now sees exactly this.</span></div>
    </div>
  
    <!-- Laps are recorded on THIS screen only — see the "stopwatch laps" block
         in assets/app.js for why they can't be part of the shared link. -->
    <div class="lap-panel" id="lapPanel" style="display:none">
      <div class="lap-head">
        <h2>Laps</h2>
        <button type="button" class="pro-link" id="lapClearBtn">Clear laps</button>
      </div>
      <ol class="lap-list" id="lapList"></ol>
      <div class="hint">Recorded on this screen only. The shared link carries the start instant, so everyone's clock matches — but a lap is pressed after that instant, so there is nothing in the link to carry it.</div>
    </div>
  </section>

  <section class="setup-section">
    <div class="panel">
      <h2>Change the countdown</h2>
      <div class="hint">${p.setupHint || `You can set the time on the board itself — click the digits and roll them with the arrows, or just type it. These controls do the same job, plus counting down to a date.`}</div>
      <label>Direction</label>
      <div class="quick dir-toggle">
        <button class="q active" data-dir="down" aria-pressed="true">Count down</button>
        <button class="q" data-dir="up" aria-pressed="false">Count up (stopwatch)</button>
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
      <div class="join-code" id="joinCodeWrap" style="display:none;margin-top:10px">
        <p class="hint" style="margin:0 0 4px">Or read this out instead of the link:</p>
        <p class="join-code-value"><span class="join-code-host">countlink.app/j/</span><b id="joinCodeText"></b></p>
        <button class="pro-link" id="joinCopyBtn">Copy join-code link</button>
      </div>
      <button class="btn icon-btn" id="qrBtn" style="margin-top:10px">${QR_ICON}<span id="qrBtnLabel">Show QR code</span></button>
      <div id="qrWrap" style="display:none;margin-top:10px">
        <img id="qrImg" width="160" height="160" alt="QR code for the sync link" style="background:#fff;padding:8px;border-radius:6px">
        <div class="hint" style="margin-top:6px">Generated on demand by a third-party QR API (goqr.me) — the only feature on this site that makes an external request. See <a href="/privacy" style="text-decoration:underline">Privacy</a>.</div>
      </div>
      <button class="btn icon-btn" id="icsBtn" style="display:none;margin-top:10px">Add to calendar (.ics)</button>
      <button class="btn icon-btn" id="printPosterBtn" style="display:none;margin-top:10px">Print poster</button>
      <button class="pro-link" id="embedBtn" style="margin-top:10px">Embed on your site →</button>
      <div id="embedWrap" style="display:none;margin-top:10px">
        <div class="embed-builder">
          <div class="stack2">
            <div>
              <label for="embedW">Width (px)</label>
              <input id="embedW" type="number" min="160" max="1600" step="10" value="400">
            </div>
            <div>
              <label for="embedH">Height (px)</label>
              <input id="embedH" type="number" min="80" max="900" step="10" value="160">
            </div>
          </div>
          <label for="embedStyle">Board style</label>
          <select id="embedStyle">
            <option value="board">Board — dark split-flap</option>
            <option value="minimal">Minimal — plain digits</option>
            <option value="light">Light — dark-on-white</option>
          </select>
          <label class="check" style="margin-top:12px">
            <input type="checkbox" id="embedResponsive" checked>
            <span>Scale to fit the column it sits in</span>
          </label>
        </div>
        <textarea id="embedCode" readonly rows="5" aria-label="Embed code for this countdown" style="width:100%;font-family:monospace;font-size:13px;resize:vertical;margin-top:10px"></textarea>
        <button class="pro-link" id="embedCopyBtn" style="margin-top:6px">Copy embed code</button>
        <div class="hint" style="margin-top:6px">A transparent, chrome-free version of this same synced countdown — the same widget streamers use as an OBS overlay works as a plain &lt;iframe&gt; on any page. It loads no ads, no analytics and no third-party scripts onto your site.</div>
      </div>
      <form class="join-entry" id="joinEntry" style="margin-top:16px">
        <label class="lbl" for="joinInput">Been given a join code?</label>
        <div class="join-entry-row">
          <input id="joinInput" name="code" inputmode="latin" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="9" placeholder="K3M7Q" aria-describedby="joinHint">
          <button class="btn" type="submit">Join</button>
        </div>
        <p class="hint" id="joinHint">Opens the same countdown the code was made for.</p>
      </form>
    </div>
  </section>

  <!-- The ad sits BELOW the setup panel, never between the board and its own
       controls. It used to sit directly under the board, which put ~90px of
       ad between the countdown and the "Change the countdown" panel — the one
       thing a visitor reaches for next. That is both a usability problem (it
       is what pushed the duration controls 282px below the fold, the finding
       that drove the settable board) and the placement AdSense treats as
       interfering with content. Guarded by test/ad-placement.test.mjs. -->
  <div class="ad-slot">
    <ins class="adsbygoogle" style="display:block;min-height:90px"
         data-ad-client="ca-pub-2653891546345771" data-ad-slot="9745719960"
         data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>if(!window.__CL_OVERLAY)(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>

  <!-- Rendered from localStorage by app.js; hidden until at least one timer
       has been started or opened in this browser. -->
  <section class="recent-section" id="recentWrap" style="display:none">
    <div class="panel">
      <h2>Your recent timers</h2>
      <div class="hint">Saved only in this browser — reopen a timer you started or a link someone sent you. Each one keeps counting to its own end time.</div>
      <div id="recentList"></div>
      <button class="pro-link" id="recentClear">Clear list</button>
    </div>
  </section>`;
return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>/* ?overlay=1 renders a transparent, chrome-free board for an OBS Browser
   Source or a plain <iframe> — a screen with no publisher content on it at
   all, which is exactly what AdSense's "ads on screens without publisher
   content" rule is about.

   Neutering the ad code in place was tried first and is NOT enough. Removing
   the <ins> from the DOM in app.js and skipping the inline push() both work,
   but the library itself then injects its own auto-ad <ins> afterwards —
   verified in a browser: an overlay screen ended up with one adsbygoogle <ins>
   in the DOM and show_ads_impl loaded. pauseAdRequests did not survive the
   library loading over the top of it either.

   So an overlay screen is sent to /embed/ instead, which is the same board
   built with every ad and analytics tag stripped out (see buildEmbedHtml in
   scripts/build-timer-pages.mjs) and is also the only path _headers exempts
   from X-Frame-Options: DENY. The hash carries the timer, so it survives the
   redirect untouched. This runs in <head>, before the loader tag below is
   parsed, and location.replace() leaves no history entry — an OBS Browser
   Source or an iframe follows it without noticing.

   Overlay links already handed out point at content pages, and this is what
   keeps those working AND ad-free. The loader tag stays static and
   unconditional on every real page so AdSense's site verification still finds
   the code where it belongs. Guarded by test/overlay-ads.test.mjs. */
window.__CL_OVERLAY=new URLSearchParams(location.search).has("overlay");
if(window.__CL_OVERLAY&&location.pathname.indexOf("/embed/")!==0){
  location.replace("/embed/"+location.search+location.hash);
}</script>
<title>${p.h1} | ${BRAND}</title>
<meta name="description" content="${p.meta}">
<link rel="canonical" href="${SITE_URL}${hrefFor(p.slug)}">
<meta property="og:title" content="${p.h1}">
<meta property="og:description" content="${p.meta}">
<meta property="og:type" content="website">
<meta property="og:image" content="${SITE_URL}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}/assets/og-image.png">
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
<link rel="apple-touch-icon" href="../assets/icons/icon-180.png">
<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="${THEME_COLORS[p.theme] || "#1c1c1a"}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&display=swap" as="style">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></noscript>
<link rel="preload" href="../assets/style.css?v=ad5a7b53" as="style">
<link rel="stylesheet" href="../assets/style.css?v=ad5a7b53" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="../assets/style.css?v=ad5a7b53"></noscript>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WM4M28L7Y1"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','G-WM4M28L7Y1');</script>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: BRAND,
  url: `${SITE_URL}${hrefFor(p.slug)}`,
  description: p.meta,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any (web browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  // Named maintainer on every timer page, not just the guide articles.
  // Google's "Who created it?" test is applied per page, and the timer pages
  // are the overwhelming majority of the site — leaving them anonymous made
  // the whole domain read as unattributed.
  author: { "@type": "Person", name: AUTHOR_NAME, url: AUTHOR_URL },
  datePublished: CONTENT_DATE,
  dateModified: dates.dateFor(`timers/${p.slug}`, [
    p.title, p.h1, p.meta, p.intro, p.faq, p.eyebrow,
    p.extra || EXTRA_BY_SLUG[p.slug] || "",
  ]),
})}</script>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: BRAND, item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name: p.eyebrow, item: `${SITE_URL}${hrefFor(p.slug)}` },
  ],
})}</script>
${faqSchema(p.faq)}
${howToSchema(p.howto, p.eyebrow)}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2653891546345771" crossorigin="anonymous"></script>
${growScript()}
</head>
<body${p.theme ? ` class="theme-${p.theme}"` : ""}>
<a class="skip-link" href="#boardEl">Skip to timer</a>

${chassis(null)}
<div class="rig">
${instrumentIndex(p.slug)}
<main class="rig-main" id="main">
  <header class="plate">
    <p class="plate-ref">Timer / ${p.eyebrow}</p>
    <h1>${p.h1}</h1>
    <p class="lede">${p.intro}</p>
  </header>

  ${stageBlock}
  <div class="measure">
    ${p.extra || EXTRA_BY_SLUG[p.slug] || ""}
    ${howToHtml(p.howto, p.eyebrow)}
    ${faqHtml(p.faq)}
    ${relatedGuides(p.slug)}
    ${affiliateCard(p)}
  </div>
</main>
</div>

<footer>
  <div class="wrap">
    <div class="foot-links">
      ${timerLinks(p.slug)}
    </div>
    <div class="foot-in">
      <div><div class="fb">${BRAND}</div>A timer you can hand to a room. · <a href="/how-it-works">How It Works</a> · <a href="/about">About</a> · <a href="/compare">Vs. ShareMyTimer &amp; Stagetimer</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a> · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
      <div>Sync accuracy depends on each device's clock — typically within a second.<br>No data leaves your browser; the timer lives entirely in the link.<br>
      Built and maintained by <a href="${AUTHOR_URL}" rel="author noopener" target="_blank">${AUTHOR_NAME}</a>.</div>
    </div>
  </div>
</footer>

<!-- Invisible on screen (see .poster + body.print-poster in style.css);
     shown ONLY under print, toggled by "Print poster"'s click handler right
     before window.print(). A DIRECT CHILD OF <body> — not nested with the
     rest of the page's content — so the print rule can hide every other
     top-level element with one :not(.poster) selector, and so doing so
     (via display:none, which collapses layout height to zero — the reason
     an earlier version of this printed 4 blank pages instead of 1) can
     never take the poster down with it. -->
<div class="poster" id="posterBlock" aria-hidden="true">
  <img id="posterQr" width="320" height="320" alt="QR code for the sync link">
  <h2 id="posterLabel"></h2>
  <p>Scan to open the live countdown</p>
  <p id="posterEndsAt"></p>
</div>

<script>window.COUNTLINK_DEFAULT=${JSON.stringify({ minutes: p.minutes, label: p.label, ...(p.direction ? { direction: p.direction } : {}), ...(p.untilMonthDay ? { untilMonthDay: p.untilMonthDay } : {}) })};</script>
<script src="../assets/app.js?v=fc5ea69f" defer></script>
</body>
</html>
`; };

// ── Editorial articles (/guides) ───────────────────────────────────────────
// The "proof" layer a tool site needs for AdSense / E-E-A-T: standalone,
// long-form, genuinely useful pieces separate from the timer pages, each with
// an author byline. Content lives in scripts/articles.mjs.
const fmtDate = (iso) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

// Shared shell for the guide index and article pages. `rel` is the asset path
// prefix ("" for the root-level /guides index, "../" for /guides/<slug>).
/* noAds omits the AdSense loader. Only the 404 page passes it: an error page
   carries no publisher content, so there is nothing for an ad to sit beside,
   and leaving the library loaded there just invites auto ads onto an empty
   screen. Guarded by test/ad-placement.test.mjs.

   It deliberately does NOT drop the overlay guard, which lives at the top of
   <head> for every page. That guard is a redirect, not ad code, and an
   ?overlay=1 request that lands on a 404 should still end up at /embed/. */
const guideShell = ({ rel, title, description, canonicalPath, headJsonLd = "", main, footLinks, noAds = false, navPath = "/guides/" }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>/* ?overlay=1 renders a transparent, chrome-free board for an OBS Browser
   Source or a plain <iframe> — a screen with no publisher content on it at
   all, which is exactly what AdSense's "ads on screens without publisher
   content" rule is about.

   Neutering the ad code in place was tried first and is NOT enough. Removing
   the <ins> from the DOM in app.js and skipping the inline push() both work,
   but the library itself then injects its own auto-ad <ins> afterwards —
   verified in a browser: an overlay screen ended up with one adsbygoogle <ins>
   in the DOM and show_ads_impl loaded. pauseAdRequests did not survive the
   library loading over the top of it either.

   So an overlay screen is sent to /embed/ instead, which is the same board
   built with every ad and analytics tag stripped out (see buildEmbedHtml in
   scripts/build-timer-pages.mjs) and is also the only path _headers exempts
   from X-Frame-Options: DENY. The hash carries the timer, so it survives the
   redirect untouched. This runs in <head>, before the loader tag below is
   parsed, and location.replace() leaves no history entry — an OBS Browser
   Source or an iframe follows it without noticing.

   Overlay links already handed out point at content pages, and this is what
   keeps those working AND ad-free. The loader tag stays static and
   unconditional on every real page so AdSense's site verification still finds
   the code where it belongs. Guarded by test/overlay-ads.test.mjs. */
window.__CL_OVERLAY=new URLSearchParams(location.search).has("overlay");
if(window.__CL_OVERLAY&&location.pathname.indexOf("/embed/")!==0){
  location.replace("/embed/"+location.search+location.hash);
}</script>
<title>${title} | ${NAME}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${SITE_URL}${canonicalPath}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="article">
<meta property="og:url" content="${SITE_URL}${canonicalPath}">
<meta property="og:image" content="${SITE_URL}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}/assets/og-image.png">
<link rel="icon" type="image/svg+xml" href="${rel}assets/favicon.svg">
<link rel="apple-touch-icon" href="${rel}assets/icons/icon-180.png">
<link rel="manifest" href="${rel}manifest.json">
<meta name="theme-color" content="#1c1c1a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&display=swap" as="style">
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"></noscript>
<link rel="preload" href="${rel}assets/style.css?v=ad5a7b53" as="style">
<link rel="stylesheet" href="${rel}assets/style.css?v=ad5a7b53" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="${rel}assets/style.css?v=ad5a7b53"></noscript>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WM4M28L7Y1"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','G-WM4M28L7Y1');</script>
${headJsonLd}
${noAds ? "" : `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2653891546345771" crossorigin="anonymous"></script>`}
${growScript()}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${chassis(navPath)}
<div class="rig">
${instrumentIndex(null)}
<main class="rig-main" id="main">
${main}
</main>
</div>
<footer>
  <div class="wrap">
    <div class="foot-links">
      ${footLinks ?? timerLinks(null)}
    </div>
    <div class="foot-in">
      <div><div class="fb">${NAME}</div>A timer you can hand to a room. · <a href="/guides/">Guides</a> · <a href="/how-it-works">How It Works</a> · <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a> · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
      <div>No data leaves your browser; the timer lives entirely in the link.</div>
    </div>
  </div>
</footer>
</body>
</html>
`;

// ---- Topical clusters (hub-and-spoke) ----------------------------------
//
// One source of truth pairing each guide with the timers it's actually about.
// Before this, every guide footer linked to all 29 timers and every timer
// page linked to no guide at all — so the site had 29 flat siblings and 7
// orphaned articles, with no signal about which belonged together.
//
// Deliberately NOT solved by adding /timers/for-teachers-style hub pages:
// the guides already are those hubs (750–950 words each, on exactly these
// topics), so a hub page would have duplicated an existing article and added
// a thin page for no gain. Wiring the existing content is the same structure
// without the new URLs.
//
// Keys are guide slugs; values are timer slugs, most relevant first.
const TOPIC_LINKS = {
  "using-timers-in-the-classroom": ["classroom-timer", "exam-timer", "group-study-timer", "index"],
  "put-a-timer-on-your-classroom-screen": ["classroom-timer", "exam-timer", "workshop-timer", "group-study-timer"],
  // Duration slugs here were replaced with "index" (the /timers/ hub) on
  // 2026-07-29 when the eight fixed-duration pages were consolidated. Note
  // timersForGuide() does `.map(pageBySlug).filter(Boolean)`, which silently
  // drops a slug that no longer exists — so a stale entry here degrades a
  // guide's link block without failing the build. assertTopicLinksResolve()
  // below closes that hole.
  "how-to-run-a-timed-exam": ["exam-timer", "classroom-timer", "index"],
  "the-pomodoro-technique": ["pomodoro-timer", "group-study-timer", "index"],
  "running-short-standups": ["standup-timer", "agenda-timer", "index"],
  "timeboxing-meetings": ["zoom-meeting-timer", "google-meet-timer", "agenda-timer", "index"],
  "facilitating-workshops-to-time": ["workshop-timer", "agenda-timer", "multiple-timers-at-once", "index"],
  "interval-training-timing": ["interval-timer", "group-study-timer", "index"],
};

// Reverse index: timer slug -> guide slugs that reference it. Built rather
// than hand-maintained so the two directions can't drift apart.
const GUIDES_FOR_TIMER = (() => {
  const m = {};
  for (const [guideSlug, timerSlugs] of Object.entries(TOPIC_LINKS)) {
    for (const t of timerSlugs) (m[t] ||= []).push(guideSlug);
  }
  return m;
})();

const pageBySlug = (slug) => PAGES.find((p) => p.slug === slug);
const articleBySlug = (slug) => ARTICLES.find((a) => a.slug === slug);

// Rendered on a timer page: the guide(s) that cover using this timer well.
// Cap raised from 2 to 3 on 2026-08-15: at 2, "how-to-run-a-timed-exam" (3rd
// in GUIDES_FOR_TIMER for both exam-timer and classroom-timer) never got an
// incoming link from any indexed timer page, and "facilitating-workshops-to-
// time" only got one (from multiple-timers-at-once). Both are in Search
// Console's "Discovered – currently not indexed" bucket; concentrating a
// little more internal-link weight from the indexed timer pages onto them is
// a cheap, targeted nudge for crawl discovery.
const RELATED_GUIDES_CAP = 3;
const relatedGuides = (timerSlug) => {
  const slugs = (GUIDES_FOR_TIMER[timerSlug] || []).slice(0, RELATED_GUIDES_CAP);
  const items = slugs.map(articleBySlug).filter(Boolean);
  if (!items.length) return "";
  return `
  <nav class="related-guides" aria-label="Further reading">
    <h2>Further reading</h2>
    <ul>
      ${items.map((a) => `<li><a href="/guides/${a.slug}">${a.title}</a> — ${a.excerpt}</li>`).join("\n      ")}
    </ul>
  </nav>`;
};

// Rendered on a guide page: the timers that guide is actually about, instead
// of the previous undifferentiated dump of all 29.
const timersForGuide = (guideSlug) => {
  const items = (TOPIC_LINKS[guideSlug] || []).map(pageBySlug).filter(Boolean);
  if (!items.length) return timerLinks(null);
  return items
    .map((p) => `<a href="${hrefFor(p.slug)}">${p.eyebrow}</a>`)
    .concat(`<a href="/">Browse all ${PAGES.length} timers →</a>`)
    .join("\n      ");
};

const byline = (a) => `<p class="byline">By <a href="${AUTHOR_URL}" rel="author noopener" target="_blank">${AUTHOR_NAME}</a> · <time datetime="${a.date}">${fmtDate(a.date)}</time> · ${a.read} min read</p>`;

const authorBox = () => `
  <aside class="author-box">
    <p class="author-box-name">${AUTHOR_NAME}</p>
    <p>${AUTHOR_BIO} <a href="${AUTHOR_URL}" rel="author noopener" target="_blank">${AUTHOR_NAME.replace(/ FK$/, "")}'s site →</a></p>
  </aside>`;

const guidePage = (a) => {
  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    author: { "@type": "Person", name: AUTHOR_NAME, url: AUTHOR_URL },
    publisher: { "@type": "Organization", name: NAME },
    datePublished: a.date,
    dateModified: a.date,
    mainEntityOfPage: `${SITE_URL}/guides/${a.slug}`,
  })}</script>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: NAME, item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides/` },
      { "@type": "ListItem", position: 3, name: a.title, item: `${SITE_URL}/guides/${a.slug}` },
    ],
  })}</script>`;
  const main = `
  <article class="article seo-intro">
    <span class="eyebrow">Guide</span>
    <h1 style="font-size:clamp(1.8rem,3.4vw,2.6rem);margin:6px 0 4px">${a.title}</h1>
    ${byline(a)}
    ${a.bodyHtml}
    ${authorBox()}
    <p class="article-back"><a href="/guides/">← All guides</a></p>
  </article>
  <div class="ad-slot">
    <ins class="adsbygoogle" style="display:block;min-height:90px"
         data-ad-client="ca-pub-2653891546345771" data-ad-slot="9745719960"
         data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>if(!window.__CL_OVERLAY)(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>`;
  return guideShell({ rel: "../", title: a.title, description: a.description, canonicalPath: `/guides/${a.slug}`, headJsonLd: jsonLd, main, footLinks: timersForGuide(a.slug) });
};

const guidesIndexPage = () => {
  const cards = ARTICLES.map((a) => `
    <a class="guide-card" href="/guides/${a.slug}">
      <h2>${a.title}</h2>
      <p>${a.excerpt}</p>
      <span class="guide-card-meta">${a.read} min read</span>
    </a>`).join("\n");
  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: NAME, item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides/` },
    ],
  })}</script>`;
  const main = `
  <section class="hero" style="border-bottom:none;display:block">
    <div class="hero-inner">
      <span class="eyebrow">Guides</span>
      <h1 style="font-size:clamp(1.8rem,3.4vw,2.6rem)">Timing &amp; productivity guides</h1>
      <p class="lede">Practical writing on running meetings, classes, workouts and study to time — the ideas behind a shared countdown, and how to use one well.</p>
    </div>
  </section>
  <div class="guide-list">${cards}
  </div>`;
  return guideShell({ rel: "../", title: "Timing & Productivity Guides", description: "Practical guides on running meetings, exams, classes, workshops, standups and workouts to time — timeboxing, the Pomodoro technique, interval training and more.", canonicalPath: "/guides/", headJsonLd: jsonLd, main });
};

/* ================= the feature inventory =================
 * ONE list, rendered into three places: /features, the block on the homepage
 * that replaced "Beyond the link", and llms.txt's "## Features" section.
 *
 * WHY IT EXISTS AT ALL (docs/perception-gap-2026-09-06.md):
 * CountLink was being described by AI assistants — its single largest real
 * traffic channel — as "minimalist", while ShareMyTimer, which has four
 * indexable URLs and fewer features, was described richly and praised. The
 * cause was not capability. It was that this site had no enumerated feature
 * list anywhere: the homepage led with three ABSENCES ("no viewer limit, no
 * account, no paid tier"), and everything it could actually do was buried in
 * one prose paragraph headed "Beyond the link" whose first sentence called
 * those features "a few things that don't get much billing up top". A
 * summariser can only enumerate what a page enumerates. They wrote a list; we
 * wrote an essay, and got summarised accordingly.
 *
 * So the rule for editing this: every entry is a NAMED capability with a verb.
 * "Phone control", not "the trade-off we made about servers". Keep the
 * reasoning — it is good, and it is why anyone trusts this site — on /about
 * and /how-it-works, where it belongs.
 *
 * Generated rather than hand-written in three files because this repo has hit
 * the hand-maintained-list-goes-stale bug four times now (the README domain
 * table, the footer links, llms.txt, and /embed/ being one build behind). A
 * feature list is the single most likely thing to drift, because it changes
 * every time anything ships.
 */
export const FEATURES = [
  ["Sharing", [
    ["One link, unlimited viewers", "Copy the link and send it to as many people as you like. There is no device cap, no seat count and no paid tier, because nothing is held open per viewer."],
    ["Join code you can say out loud", "Every running countdown also gets a five-character code — countlink.app/j/K3M7Q — for reading to a room or writing on a whiteboard when nobody can copy a URL off a projector."],
    ["QR code", "Show a QR for the share link so a room can scan it off the screen instead of typing anything."],
    ["Share sheet on mobile", "On a phone the share button opens the native sheet, so the link goes straight into whatever messaging app is already open."],
    ["Recent timers", "The last few countdowns you started are kept in your own browser, so a link you closed by accident is one click back."],
  ]],
  ["The timer itself", [
    ["Countdown to a duration", "Any length from a second to days, set on the board or typed like a microwave keypad — 700 is seven minutes, 9000 is an hour and a half."],
    ["Countdown to a date and time", "Point it at an exact instant instead of a length: a launch, a deadline, midnight on New Year's Eve."],
    ["Count up — a shared stopwatch", "The same one-timestamp mechanic read the other way, so a whole group's stopwatch starts from the same instant."],
    ["Laps", "Take splits on a count-up without stopping it."],
    ["Agenda timer", "An ordered list of named segments — intro, demo, break, Q&A — that advances itself on every screen that has the link open."],
    ["Interval timer", "Work/rest cycles with a round count: Tabata 20/10, boxing rounds, HIIT, or any split you set."],
    ["Several timers on one screen", "Named countdowns running side by side for cooking, stations, or parallel exam sections."],
    ["Sound alerts, free", "A choice of end-of-timer tones, on by default. Competitors charge for this; it is the single most common thing a timer needs to do."],
    ["Wrap-up warning", "A countdown visibly changes state as it runs low, so the room gets a warning before zero rather than a surprise at it."],
    ["Event labels", "Name the countdown — \"Break ends\", \"Quiz round 2\" — and the label travels with the link."],
  ]],
  ["Control", [
    ["Phone control", "Turn it on before you start and you get a second link that pauses, adds or removes a minute, and stops the countdown live on every screen that has it open. Free, with no viewer cap on the screens it reaches."],
    ["Flash a message to every screen", "Send a short line of text from the controller — \"five more minutes\", \"wrap up\" — and it appears over the countdown everywhere."],
    ["The board is the input", "Roll the digits with a click, the arrow keys, the scroll wheel or a drag; or type the time; or paste 1h30m, 5:00 or 90s onto it."],
    ["Sealed once running", "The controls are removed from the page entirely the moment a countdown starts, so nobody opening a shared link can change what the room sees."],
  ]],
  ["Display", [
    ["Three board styles", "Board (mechanical split-flap), Minimal (plain digits), and Light (dark digits on white, for a projector in a bright room)."],
    ["Fullscreen", "One button to fill a projector, a smart TV or an interactive whiteboard."],
    ["Printable poster", "A print-ready sheet with the countdown's QR code and end time, for a door or a wall."],
    ["Installable app", "Add it to a home screen or dock from the browser's own install prompt. It opens fullscreen and the board keeps working offline."],
    ["Offline copy", "Download a running countdown as a single self-contained HTML file that keeps counting with no network at all, forever."],
  ]],
  ["Embedding and integrations", [
    ["Stream overlay for OBS", "A transparent, chrome-free browser source with no watermark and no green screen — just the digits over your scene."],
    ["Website embed", "An iframe builder with size, style and responsive options, producing a countdown for a landing page that shows every visitor the same remaining time."],
    ["README badge", "A Markdown or HTML snippet for a GitHub README, a forum post, or anywhere only an image is allowed."],
    ["Add to calendar (.ics)", "Export a countdown's end time as a calendar event."],
    ["Zoom, Google Meet, Teams", "No extension and no screen share — paste the link into the call chat and everyone's own screen counts down together."],
    ["MCP server for AI assistants", "countlink.app/mcp lets an assistant mint a working timer, build a whole agenda from a meeting outline, produce an embed or a badge, and read back what any CountLink link means. No other shared-timer tool has one."],
    ["Setup links anyone can write", "countlink.app/#for=25m opens the board ready at that duration — writable by hand, in advance, from a lesson plan, a bookmark or a calendar invite."],
    ["Link inspector", "Ask any CountLink link what it is: running or ready, its label, and how long is left."],
  ]],
];

/* The absences still matter — they are the reason most of the above is free —
 * but they belong AFTER the capabilities, not instead of them. */
const FEATURE_NEVERS = [
  "No account, ever — there is nothing to sign up for and nothing to log into.",
  "No viewer limit and no timer limit, on any page, at any time.",
  "No paid tier, so no feature on this site is being withheld from you.",
  "No watermark on the stream overlay or the website embed.",
  "No analytics, ads or third-party scripts inside an embed you put on your own site.",
];

const featureGrid = () => FEATURES.map(([heading, items]) => `
      <section class="feat-group">
        <h3 class="feat-head">${heading}</h3>
        <dl class="feat-list">
${items.map(([name, blurb]) => `          <div class="feat"><dt>${name}</dt><dd>${blurb}</dd></div>`).join("\n")}
        </dl>
      </section>`).join("");

const featuresPage = () => {
  /* ItemList rather than a bare WebApplication featureList: the same names
     the page shows, in the same order, so an assistant reading the structured
     data and an assistant reading the prose cannot come away with different
     lists. featureList is emitted too, since that is the property most tools
     actually look for on software. */
  const flat = FEATURES.flatMap(([, items]) => items.map(([name]) => name));
  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: NAME,
    url: `${SITE_URL}/`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: flat,
  })}</script>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${NAME} features`,
    itemListElement: flat.map((name, i) => ({ "@type": "ListItem", position: i + 1, name })),
  })}</script>`;
  const main = `
  <section class="hero" style="border-bottom:none;display:block">
    <div class="hero-inner">
      <span class="eyebrow">Features</span>
      <h1 style="font-size:clamp(1.8rem,3.4vw,2.6rem)">Everything ${NAME} does</h1>
      <p class="lede">${flat.length} things, all of them free, none of them behind an account. The countdown is the same one-timestamp-in-a-link mechanic throughout — <a href="/how-it-works">here is how that works</a>.</p>
    </div>
  </section>
  <div class="features">${featureGrid()}
      <section class="feat-group">
        <h3 class="feat-head">And what it never does</h3>
        <ul class="feat-nevers">
${FEATURE_NEVERS.map((n) => `          <li>${n}</li>`).join("\n")}
        </ul>
        <p class="feat-cta"><a href="/">Start a countdown</a> · <a href="/compare">Compare with ShareMyTimer and Stagetimer</a></p>
      </section>
  </div>`;
  return guideShell({
    rel: "",
    title: `${NAME} Features — Shared Timer, Join Codes, Overlays, Agendas`,
    description: `Every feature of ${NAME}'s free shared timer: unlimited viewers, join codes, phone control, OBS overlays, website embeds, agendas, intervals, calendar export and an MCP server — with no account and no paid tier.`,
    canonicalPath: "/features",
    navPath: "/features",
    headJsonLd: jsonLd,
    main,
  });
};

/* The homepage's feature block. Deliberately NOT the whole grid: the homepage
 * is a tool first, and 30 rows above the footer would bury the board it exists
 * to serve. What it must do is NAME things — the paragraph it replaced hid
 * four real features inside prose that opened by calling them "a few things
 * that don't get much billing up top", which is how a summariser came away
 * with "minimalist". Two named features per group and a count is enough for a
 * crawler, a summariser and a skimming human to all see there is a product
 * here; /features carries the rest.
 *
 * Synced between markers into index.html on every build, same mechanism as the
 * footer links — the hand-written version of this list is exactly what went
 * stale before. */
const HOME_FEATURES_START = "<!-- HOME_FEATURES_START — auto-synced from FEATURES by scripts/build-timer-pages.mjs, do not hand-edit -->";
const HOME_FEATURES_END = "<!-- HOME_FEATURES_END -->";

const homeFeatureBlock = () => {
  const total = FEATURES.reduce((n, [, items]) => n + items.length, 0);
  const cols = FEATURES.map(([heading, items]) => `
        <div class="hf-group">
          <h3>${heading}</h3>
          <ul>
${items.slice(0, 2).map(([name]) => `            <li>${name}</li>`).join("\n")}
            <li class="hf-more">+ ${items.length - 2} more</li>
          </ul>
        </div>`).join("");
  return `    <h2>What ${BRAND} does</h2>
    <p class="seo-intro" style="max-width:75ch">${total} features, all free, none behind an account — <a href="/features">the full list is here</a>.</p>
    <div class="home-features">${cols}
    </div>`;
};

/* ================= /vs/<slug> comparison pages =================
 * Data and the rules for writing one live in scripts/comparisons.mjs. This is
 * only the rendering.
 *
 * The page order is deliberate and is the order a reader wants: the verdict
 * first (most people came for an answer, not a table), then the table, then
 * what the competitor is genuinely better at, then what we are, then who
 * should pick which, then the FAQ. Putting "what they do better" ABOVE "what
 * we do better" is not modesty — it is the thing that makes the rest of the
 * page believable, and it is the section a summariser quotes when someone asks
 * an assistant to compare the two.
 */
const vsHref = (slug) => `/vs/${slug}`;

const vsTable = (c) => `
    <div class="vs-table-wrap">
      <table class="vs-table">
        <caption class="sr-only">${NAME} compared with ${c.name}, feature by feature</caption>
        <thead>
          <tr><th scope="col">&nbsp;</th><th scope="col" class="vs-us">${NAME}</th><th scope="col">${c.name}</th></tr>
        </thead>
        <tbody>
${c.rows.map(([label, ours, theirs]) => `          <tr><th scope="row">${label}</th><td class="vs-us">${ours}</td><td>${theirs}</td></tr>`).join("\n")}
        </tbody>
      </table>
    </div>
    <p class="vs-verified">${c.name} figures verified against <a href="${c.pricingUrl}" rel="nofollow noopener" target="_blank">their own pricing page</a> on ${fmtDate(c.verified)}. Prices and limits change — check theirs before deciding.</p>`;

const vsPage = (c) => {
  const jsonLd = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faq.map((f) => ({
      "@type": "Question", name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  })}</script>
<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    description: c.meta,
    url: `${SITE_URL}${vsHref(c.slug)}`,
    author: { "@type": "Organization", name: NAME },
    publisher: { "@type": "Organization", name: NAME },
    datePublished: c.verified,
    dateModified: c.verified,
    /* `about` names both products so an assistant answering "CountLink vs X"
       can see the page is genuinely about that pair, rather than inferring it
       from the title string. */
    about: [
      { "@type": "SoftwareApplication", name: NAME, url: `${SITE_URL}/` },
      { "@type": "SoftwareApplication", name: c.name, url: c.site },
    ],
  })}</script>`;

  const others = COMPARISONS.filter((o) => o.slug !== c.slug);
  const main = `
  <section class="hero" style="border-bottom:none;display:block">
    <div class="hero-inner">
      <span class="eyebrow">Comparison</span>
      <h1 style="font-size:clamp(1.8rem,3.4vw,2.6rem)">${c.h1}</h1>
      <p class="lede">${c.lede}</p>
    </div>
  </section>
  <article class="vs">
    <h2>The short answer</h2>
    ${c.verdict}
    <h2>Side by side</h2>
${vsTable(c)}
    <h2>What ${c.name} does better</h2>
${c.theyWinHtml}
    <h2>What ${NAME} does better</h2>
${c.weWinHtml}
    <h2>Which one should you use?</h2>
${c.whichHtml}
    <h2>Common questions</h2>
    <dl class="faq-list">
${c.faq.map((f) => `      <div class="faq-item"><dt><h3>${f.q}</h3></dt><dd>${f.a}</dd></div>`).join("\n")}
    </dl>
    <h2>Other comparisons</h2>
    <ul class="use-list">
${others.map((o) => `      <li><a href="${vsHref(o.slug)}">${NAME} vs ${o.name}</a></li>`).join("\n")}
      <li><a href="/compare">All of them side by side, in one table</a></li>
    </ul>
    <p class="feat-cta"><a href="/">Start a countdown</a> · <a href="/features">Everything ${NAME} does</a></p>
  </article>`;

  return guideShell({
    rel: "../",
    title: c.title,
    description: c.meta,
    canonicalPath: vsHref(c.slug),
    navPath: "/compare",
    headJsonLd: jsonLd,
    main,
  });
};

const STATIC_PAGES = ["privacy.html", "compare.html", "about.html", "how-it-works.html", "terms.html", "contact.html"];

// Cloudflare Pages serves a root 404.html with a real 404 status for any
// unmatched path. Without one it fell back to index.html at HTTP 200, so every
// typo'd or stale URL returned a full page — a soft 404, which inflates the
// index with near-duplicates and reads as auto-generated content to a reviewer.
// noindex is belt-and-braces: the 404 status alone keeps it out of the index.
const notFoundPage = () => guideShell({
  rel: "",
  title: `Page not found — ${NAME}`,
  description: "That page doesn't exist. Browse the timers or start a new countdown.",
  canonicalPath: "/404",
  headJsonLd: `<meta name="robots" content="noindex">`,
  noAds: true,
  main: `
<article class="article">
  <h1>Page not found</h1>
  <p>There's nothing at that address — it may have been renamed, or the link
  that brought you here may have a typo in it.</p>
  <p>If you were opening a shared countdown, ask whoever sent it for a fresh
  link: the timer lives entirely in the URL, so a truncated or edited link
  can't be recovered from this end.</p>
  <p><a href="/">Start a countdown</a> · <a href="/guides/">Read the guides</a> · <a href="/contact">Report a broken link</a></p>
</article>`,
});

// Sitemap lastmod reflects when the pages were actually (re)generated, not
// the hand-bumped CONTENT_DATE used for JSON-LD datePublished/dateModified —
// derive it from the current date at build time so every rebuild keeps the
// sitemap fresh automatically instead of freezing on whatever date someone
// last remembered to type in.
const BUILD_DATE = new Date().toISOString().split("T")[0];

const sitemap = () => {
  const urls = PAGES.map(p => `  <url><loc>${SITE_URL}${hrefFor(p.slug)}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join("\n");
  const staticUrls = STATIC_PAGES.map(f => `  <url><loc>${SITE_URL}/${f.replace(/\.html$/, "")}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join("\n");
  const featuresUrl = `  <url><loc>${SITE_URL}/features</loc><lastmod>${BUILD_DATE}</lastmod></url>`;
  const vsUrls = COMPARISONS
    .map((c) => `  <url><loc>${SITE_URL}${vsHref(c.slug)}</loc><lastmod>${BUILD_DATE}</lastmod></url>`)
    .join("\n");
  const guideUrls = [`  <url><loc>${SITE_URL}/guides/</loc><lastmod>${BUILD_DATE}</lastmod></url>`]
    .concat(ARTICLES.map(a => `  <url><loc>${SITE_URL}/guides/${a.slug}</loc><lastmod>${BUILD_DATE}</lastmod></url>`))
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${BUILD_DATE}</lastmod></url>
${staticUrls}
${featuresUrl}
${vsUrls}
${guideUrls}
${urls}
</urlset>
`;
};

// llms.txt — a Markdown index for agentic/LLM crawlers. Generated from the
// same PAGES array as sitemap.xml so it can never drift stale the way the
// hand-maintained footer-links list once did (see README/memory notes on
// that incident) — add a PAGES row, both files update together.
const llmsTxt = () => {
  // Grouped by the same GROUPS taxonomy the on-page index rail uses, rather
  // than a hand-kept duration/use-case split. The old version hardcoded eight
  // duration slugs that no longer exist (consolidated into /timers/ on
  // 2026-07-29) and would have silently emitted an empty section.
  const bySlug = Object.fromEntries(PAGES.map((p) => [p.slug, p]));
  const timerSections = GROUPS.map(([heading, slugs]) => {
    const lines = slugs
      .map((slug) => `- [${bySlug[slug].eyebrow}](${SITE_URL}${hrefFor(slug)}): ${bySlug[slug].meta}`)
      .join("\n");
    return `### ${heading}\n${lines}`;
  }).join("\n\n");
  return `# ${BRAND}

> Free shared countdown timer. Set a duration, copy the link, and everyone who opens it sees the identical countdown — synced by encoding the end timestamp in the URL itself, with no account and no server round-trip.

${BRAND} is a static web app: no signup, no backend, no per-viewer cost. The sync mechanic (timestamp embedded in the shared link) is the core differentiator versus real-time-server competitors like ShareMyTimer and Stagetimer.io — see the comparison page below for specifics.

## Setting a timer

The split-flap board on every timer page is the input, not just a readout — unlike vClock and online-stopwatch.com, whose displays are read-only. On a board that is not yet running you can:

- Click or tap a pair of digits to reveal up/down arrows over them, then click the arrows to roll that unit.
- Use the keyboard: arrow up/down rolls the focused unit, shift+arrow moves by ten, left/right moves between hours, minutes and seconds.
- Type the time like a microwave keypad — digits fill from the right, so typing 700 sets 7:00 and typing 9000 sets 1:30:00 (90 minutes normalises to an hour and a half).
- Scroll the mouse wheel over a unit, or drag it up and down on a touchscreen.
- Paste a duration: 1:30:00, 5:00, 90m, 1h30m, or a bare number like 45 (read as minutes).

Rolling minutes past 59 carries into hours and the hours pair appears automatically; rolling back under an hour retracts it. A small "+hr" control to the left of the digits adds or removes the hours pair explicitly. The board holds one duration, so rolling seconds up from 59 adds a minute rather than wrapping.

Once a countdown starts the board is sealed: the controls are removed from the page entirely, so nobody opening a shared link can alter what the room sees. It becomes settable again when the countdown finishes.

## Linking straight to a duration

There are two shapes of ${BRAND} link, and the difference matters:

- \`${SITE_URL}/#for=25m\` — a **setup link**. It opens the board preloaded at that duration, ready but not started. Anyone can write one of these by hand, in advance, without knowing the current time. Add a label with \`&l=\`, e.g. \`${SITE_URL}/#for=25m&l=Pomodoro\`.
- \`${SITE_URL}/#t=<unix-ms>\` — a **share link** for a countdown that is already running. It carries one fixed end instant, so every screen that opens it agrees to the second. It is produced by pressing start; it is not meant to be written by hand.

If you are recommending ${BRAND} to someone who wants a timer of a particular length, give them a setup link — \`${SITE_URL}/#for=10m\` for ten minutes. They press start, and that is what mints the share link for everyone else.

Setup links accept the same duration grammar the board accepts on paste: \`25m\`, \`1h30m\`, \`90s\`, \`5:00\`, \`1:30:00\`, or a bare number read as minutes (\`45\`). They work on any timer page, not just the homepage, and combine with \`?overlay=1\` and \`?style=\` for streaming overlays.

A setup link deliberately does not start on its own. Starting it per-viewer would give three people opening the same link three different countdowns, which is the opposite of what ${BRAND} is for.

### The one exception: stream overlays

Add \`&go=1\` and the countdown starts as soon as the page loads. Use it **only** for a single-screen OBS/streaming overlay, never for a link you send to people — each person opening it would start their own countdown from whenever they clicked.

A complete, ready-to-paste OBS Browser Source URL looks like this:

\`${SITE_URL}/embed/?overlay=1#for=10m&go=1\`

\`/embed/?overlay=1\` is the transparent, chrome-free version of the board — just the digits, no header, no buttons, no green screen needed — and \`&go=1\` makes it start counting the moment OBS loads the scene. In OBS: Sources → + → Browser, paste that URL, set the size (400×160 is a good start). Because OBS keeps the URL it was given, every scene reload starts a fresh countdown, which is what a "starting soon" screen wants. To let a mod or co-streamer follow the same countdown on their own screen, share the regular (non-overlay) link instead, which carries a fixed \`#t=\` deadline.

### Embedding on a website — not the same URL shape as the OBS one

\`/embed/?overlay=1\` is also the right path for an \`<iframe>\` on someone's own web page, but with the **opposite** hash: use a fixed-instant \`#t=<epoch-ms>\` link, never a \`#for=…&go=1\` setup link. A \`#for=…&go=1\` iframe restarts for every single visitor from whenever they happened to load the page — fine for OBS, which has exactly one viewer, but wrong for a website, where every visitor should see the *same* remaining time. Use \`create_timer\` with \`embed_on_website: true\` (see below) to get this right without doing the hash arithmetic by hand.

Whichever URL is used, the resulting page loads no ads, no analytics and no third-party scripts at all — \`/embed/\` is a separate, stripped build from the rest of the site.

## The \`/mcp\` server — for producing links and snippets, not just describing them

\`${SITE_URL}/mcp\` is a Model Context Protocol server (JSON-RPC 2.0 over POST, no auth, no account). It exists because a link like \`#t=…\` can only be written by something that knows the current epoch time and has already pressed start — an assistant can't do either from inside a conversation. Four tools:

- **\`create_timer\`** — given a duration (and optionally a label), returns a working \`${SITE_URL}\` link. \`start_now: true\` returns a countdown already running; \`for_obs_overlay: true\` returns the OBS Browser Source URL described above; **\`embed_on_website: true\` returns ready-to-paste \`<iframe>\` HTML** for a website or landing page (e.g. "10 hours until launch"), including the required attribution line, sized with optional \`embed_width\`/\`embed_height\`/\`embed_style\`. Use this instead of hand-building any of these links — it already encodes the OBS-vs-website distinction above. Whenever the result has a fixed end instant (\`start_now\` or \`embed_on_website\`), \`structuredContent.ics\` is a ready-to-use \`.ics\` calendar file for it.
- **\`create_agenda\`** — given an ordered list of \`{ duration, label? }\` segments, returns a link on \`${SITE_URL}/timers/agenda-timer\` that starts now (or at an optional \`start_at\` ISO-8601 instant, for something scheduled ahead) and advances through every segment on every screen, plus a run sheet with each segment's start and end, and \`structuredContent.ics\` (one calendar event per segment). A scheduled agenda shows a live "starts in" countdown until the instant arrives, then switches over on its own. If someone gives a total and a list of topics ("an hour, four topics"), split it yourself and pass the segments.
- **\`create_badge\`** — for places \`embed_on_website\`'s \`<iframe>\` cannot go: a GitHub README, a forum post, anywhere only Markdown or a bare \`<img>\` is allowed. Returns a Markdown snippet and an HTML snippet, image always wrapped in a link to the live countdown (never a bare image — the link is what makes it a real attribution). Shows coarse time remaining ("3d 04h left"), not a live tick — most embedding contexts fetch and cache images server-side, so a ticking promise would be false.
- **\`describe_timer_link\`** — given any \`${SITE_URL}\` URL (single timer or agenda), explains what it is (setup or running, label, time left, which segment is live).

Full submission/testing detail: \`docs/mcp-submission.md\`.

## Features

Every one of these is free, with no account and no paid tier. Full page: ${SITE_URL}/features

${FEATURES.map(([heading, items]) => `**${heading}** — ` + items.map(([name]) => name).join("; ")).join("\n\n")}

What ${BRAND} deliberately does not do:

${FEATURE_NEVERS.map((n) => `- ${n}`).join("\n")}

## Primary pages
- [Features](${SITE_URL}/features): every capability, named and grouped
- [Home / timer tool](${SITE_URL}/): create and share a countdown, FAQ on how sync works, why the free tier has no viewer limit
- [How It Works](${SITE_URL}/how-it-works): the link-timestamp sync mechanic explained in depth
- [Comparison hub: ${BRAND} vs ShareMyTimer vs Stagetimer vs CountdownShare vs Leaderboarded](${SITE_URL}/compare): pricing, limits, and architecture differences, verified against each competitor's own pricing page

## Head-to-head comparisons

One page per competitor, each with a verdict, a full feature table, an honest
section on what the competitor does better, and the case for picking either.
Every price and limit is verified against that vendor's own pricing page on the
date stated on the page.

${COMPARISONS.map((c) => `- [${BRAND} vs ${c.name}](${SITE_URL}${vsHref(c.slug)}): ${c.meta}`).join("\n")}
- [About](${SITE_URL}/about): who builds this and why
- [Privacy policy](${SITE_URL}/privacy): what data is (and isn't) collected
- [Terms of Service](${SITE_URL}/terms)
- [Contact](${SITE_URL}/contact)

## Guides
${ARTICLES.map(a => `- [${a.title}](${SITE_URL}/guides/${a.slug}): ${a.description}`).join("\n")}

## Timers
${timerSections}
`;
};

/* ── Swiss chassis ─────────────────────────────────────────────────────────
   The page is an instrument panel: a spec strip across the top, a fixed index
   rail, and the board as the one object on it. Everything is set on a grid of
   ruled cells — nothing centred, nothing floating, no soft corners. Both of
   these blocks are generated here and synced into the hand-written root pages
   (see syncChrome), so all 38 pages carry identical chrome from one source.
   ─────────────────────────────────────────────────────────────────────── */
const CHROME_START = "<!-- CHROME_START — auto-synced from scripts/build-timer-pages.mjs, do not hand-edit -->";
const CHROME_END = "<!-- CHROME_END -->";
const INDEX_START = "<!-- INDEX_START — auto-synced from scripts/build-timer-pages.mjs, do not hand-edit -->";
const INDEX_END = "<!-- INDEX_END -->";

const CHASSIS_NAV = [
  ["/features", "Features"],
  ["/guides/", "Guides"],
  ["/how-it-works", "How it works"],
  ["/compare", "Compare"],
  ["/about", "About"],
];

function chassis(currentPath) {
  const links = CHASSIS_NAV.map(([href, label]) =>
    `<a href="${href}"${href === currentPath ? ' aria-current="page"' : ""}>${label}</a>`).join("\n    ");
  return `<header class="chassis">
  <a class="chassis-id" href="/"><span class="pip" aria-hidden="true"></span>${BRAND}</a>
  <nav class="chassis-nav" aria-label="Site">
    ${links}
  </nav>
  <p class="chassis-spec">No server · No account · Unlimited viewers</p>
</header>`;
}

const idFor = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function instrumentIndex(currentSlug) {
  const bySlug = Object.fromEntries(PAGES.map((p) => [p.slug, p]));
  const groups = GROUPS.map(([heading, slugs]) => {
    const items = slugs.map((slug) => {
      const here = slug === currentSlug;
      return `<li><a href="${hrefFor(slug)}"${here ? ' aria-current="page"' : ""}>${bySlug[slug].eyebrow}</a></li>`;
    }).join("\n        ");
    return `
    <section class="idx-group">
      <p class="idx-head" id="idx-${idFor(heading)}">${heading}</p>
      <ul class="idx-list" aria-labelledby="idx-${idFor(heading)}">
        ${items}
      </ul>
    </section>`;
  }).join("");
  return `<nav class="rig-index" aria-label="All timers">
  <div class="idx-in">
    <p class="idx-title"><a href="/">${PAGES.length} timers</a></p>${groups}
  </div>
</nav>`;
}

/**
 * Refuse to build with a stale ?v= on the assets.
 *
 * This bit us on 2026-07-25: the whole site was restyled and pushed, but
 * scripts/bump-asset-version.mjs was never run, so every page still pointed at
 * the previous style.css hash. Origin and edge were correct; returning
 * visitors would have got the OLD stylesheet out of their disk cache against
 * the NEW markup for up to the _headers cache window — which is not "slightly
 * stale styling", it is a page with no rules for any of its classes. The
 * failure is completely invisible locally, because a fresh browser has nothing
 * cached and requests whatever the query string says.
 *
 * bump-asset-version.mjs patches the files and *then* runs this build, so by
 * the time this check runs under it the hashes always agree. Throwing here
 * only ever catches the case where someone edited an asset and ran the build
 * directly.
 */
async function assertAssetVersionsAreCurrent() {
  const stamped = (await readFile(join(ROOT, "index.html"), "utf8"));
  // Filename kept in two pieces on purpose: bump-asset-version.mjs rewrites the
  // literal "assets/<name>" wherever it appears, and a plain string here would
  // be rewritten into a path that does not exist. The regexes below are safe
  // because their slashes are escaped, so they don't contain that literal.
  for (const [name, re] of [
    ["style.css", /assets\/style\.css\?v=([0-9a-f]{8})/],
    ["app.js", /assets\/app\.js\?v=([0-9a-f]{8})/],
  ]) {
    const referenced = stamped.match(re)?.[1];
    if (!referenced) continue;
    const actual = createHash("sha256").update(await readFile(join(ROOT, "assets", name))).digest("hex").slice(0, 8);
    if (referenced !== actual) {
      throw new Error(
        `assets/${name} has changed (${referenced} -> ${actual}) but the ?v= stamp was not updated.\n` +
        `Run:  node scripts/bump-asset-version.mjs\n` +
        `That patches every page and re-runs this build. Shipping without it serves ` +
        `returning visitors a cached stylesheet against new markup.`,
      );
    }
  }
}

/** Every slug filed exactly once, checked before anything is written. */
function assertIndexCoversEveryPage() {
  const filed = GROUPS.flatMap(([, slugs]) => slugs);
  const dupes = filed.filter((s, i) => filed.indexOf(s) !== i);
  if (dupes.length) throw new Error(`GROUPS lists these slugs more than once: ${dupes.join(", ")}`);
  const slugs = PAGES.map((p) => p.slug);
  const unfiled = slugs.filter((s) => !filed.includes(s));
  if (unfiled.length) {
    throw new Error(`These PAGES slugs are not filed in GROUPS and would vanish from site navigation: ${unfiled.join(", ")}`);
  }
  const phantom = filed.filter((s) => !slugs.includes(s));
  if (phantom.length) throw new Error(`GROUPS lists slugs with no matching page: ${phantom.join(", ")}`);
}

/**
 * Every TOPIC_LINKS target resolves to a real page, and every guide slug is a
 * real article.
 *
 * Added 2026-07-29 after the page consolidation: timersForGuide() ends in
 * `.filter(Boolean)`, so a TOPIC_LINKS entry pointing at a deleted slug just
 * quietly disappears from that guide's link block. The build stayed green
 * while six guides lost internal links — exactly the kind of silent decay that
 * hub-and-spoke linking is supposed to prevent. Fail loudly instead.
 */
function assertTopicLinksResolve() {
  const slugs = new Set(PAGES.map((p) => p.slug));
  const guides = new Set(ARTICLES.map((a) => a.slug));
  const problems = [];
  for (const [guideSlug, timerSlugs] of Object.entries(TOPIC_LINKS)) {
    if (!guides.has(guideSlug)) problems.push(`TOPIC_LINKS key "${guideSlug}" is not an article slug`);
    for (const t of timerSlugs) {
      if (!slugs.has(t)) problems.push(`TOPIC_LINKS["${guideSlug}"] points at "${t}", which is not a page`);
    }
  }
  if (problems.length) throw new Error(`Broken topical cluster links:\n  - ${problems.join("\n  - ")}`);
}

/**
 * Push the generated chrome into the hand-written root pages. CountLink
 * pre-dates the template engine and index/about/how-it-works/compare and the
 * legal pages are real files rather than generated ones — so rather than
 * retrofit them to a generator, the two blocks that MUST be identical
 * everywhere are synced into them between markers. Same approach as
 * syncIndexFootLinks() below, which has worked here for a while.
 */
const CHROME_TARGETS = [
  ["index.html", "/"],
  ["about.html", "/about"],
  ["how-it-works.html", "/how-it-works"],
  ["compare.html", "/compare"],
  ["privacy.html", "/privacy"],
  ["terms.html", "/terms"],
  ["contact.html", "/contact"],
];

function replaceBetween(html, start, end, replacement, file, what) {
  const s = html.indexOf(start);
  const e = html.indexOf(end);
  if (s === -1 || e === -1) {
    console.warn(`  ! ${file}: no ${what} markers — skipped (page will drift from the others)`);
    return html;
  }
  return `${html.slice(0, s + start.length)}\n${replacement}\n${html.slice(e)}`;
}

async function syncChrome() {
  let changed = 0;
  for (const [file, path] of CHROME_TARGETS) {
    const full = join(ROOT, file);
    const html = await readFile(full, "utf-8");
    let out = replaceBetween(html, CHROME_START, CHROME_END, chassis(path), file, "chrome");
    out = replaceBetween(out, INDEX_START, INDEX_END, instrumentIndex(null), file, "index");
    if (out !== html) {
      await writeFile(full, out, "utf-8");
      changed++;
    }
  }
  console.log(`Synced chassis + timer index into ${changed} hand-written page(s).`);
}

async function syncHomeFeatures() {
  const indexPath = join(ROOT, "index.html");
  const html = await readFile(indexPath, "utf-8");
  const out = replaceBetween(html, HOME_FEATURES_START, HOME_FEATURES_END, homeFeatureBlock(), "index.html", "home features");
  if (out !== html) {
    await writeFile(indexPath, out, "utf-8");
    console.log("Synced index.html feature block to match FEATURES.");
  }
}

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
  assertIndexCoversEveryPage();
  assertTopicLinksResolve();
  await assertAssetVersionsAreCurrent();
  await mkdir(OUT_DIR, { recursive: true });
  const written = [];
  for (const p of PAGES) {
    const path = join(OUT_DIR, `${p.slug}.html`);
    await writeFile(path, page(p), "utf-8");
    written.push(path);
  }
  console.log(`Wrote ${written.length} pages to ${relative(ROOT, OUT_DIR)}/`);
  for (const w of written) console.log(" -", relative(ROOT, w));

  // Editorial articles: /guides index + /guides/<slug> pages.
  // A guides/ directory holds the articles, so /guides must resolve to
  // guides/index.html (directory index) — not a sibling guides.html, which the
  // directory would shadow both locally and on Cloudflare Pages.
  const guidesDir = join(ROOT, "guides");
  await mkdir(guidesDir, { recursive: true });
  await writeFile(join(guidesDir, "index.html"), guidesIndexPage(), "utf-8");
  for (const a of ARTICLES) {
    await writeFile(join(guidesDir, `${a.slug}.html`), guidePage(a), "utf-8");
  }
  console.log(`Wrote guides.html + ${ARTICLES.length} article(s) to guides/`);

  const vsDir = join(ROOT, "vs");
  await mkdir(vsDir, { recursive: true });
  for (const c of COMPARISONS) {
    await writeFile(join(vsDir, `${c.slug}.html`), vsPage(c), "utf-8");
  }
  console.log(`Wrote ${COMPARISONS.length} comparison page(s) to vs/`);

  const featuresPath = join(ROOT, "features.html");
  await writeFile(featuresPath, featuresPage(), "utf-8");
  console.log(`Wrote ${relative(ROOT, featuresPath)}`);

  const notFoundPath = join(ROOT, "404.html");
  await writeFile(notFoundPath, notFoundPage(), "utf-8");
  console.log(`Wrote ${relative(ROOT, notFoundPath)}`);

  const sitemapPath = join(ROOT, "sitemap.xml");
  await writeFile(sitemapPath, sitemap(), "utf-8");
  // Count the emitted <loc>s rather than recomputing the arithmetic — the old
  // expression (PAGES + STATIC_PAGES + 1) silently omitted the guides index and
  // the 8 articles, so it under-reported by 9 for as long as guides have existed.
  const locCount = (sitemap().match(/<loc>/g) || []).length;
  console.log(`Wrote ${relative(ROOT, sitemapPath)} (${locCount} URLs)`);

  const llmsPath = join(ROOT, "llms.txt");
  await writeFile(llmsPath, llmsTxt(), "utf-8");
  console.log(`Wrote ${relative(ROOT, llmsPath)}`);

  const d = dates.save();
  console.log(`dateModified: ${d.total} pages tracked, ${d.changed.length} changed this build.`);

  await syncChrome();
  await syncHomeFeatures();
  await syncIndexFootLinks();

  /*
   * /embed/ serves the same document as the root, but from a path that
   * _headers exempts from X-Frame-Options: DENY. Without it, every embed of
   * the overlay silently failed on third-party sites (the header applies to
   * the whole origin and can't be scoped to ?overlay=1).
   *
   * This MUST run after syncChrome() and syncIndexFootLinks(), because both of
   * those rewrite index.html in place. It used to run before them, so
   * embed/index.html was copied from the *previous* build's index.html and was
   * permanently one build stale — caught 2026-07-29 when it was the only file
   * still linking to the twelve consolidated timer pages.
   */
  const embedDir = join(ROOT, "embed");
  await mkdir(embedDir, { recursive: true });
  const rootHtml = await readFile(join(ROOT, "index.html"), "utf-8");
  await writeFile(join(embedDir, "index.html"), buildEmbedHtml(rootHtml), "utf-8");
  console.log("Wrote embed/index.html (framable overlay host, noindex)");

  console.log("\nTo rename or update the domain, run scripts/rename-brand.mjs (don't edit site-config.mjs by hand).");
}

main();
