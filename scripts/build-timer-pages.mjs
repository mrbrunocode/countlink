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
          <h3>What to time, by grade band</h3>
          <p>The right countdown length changes a lot between a first-grader and a senior — a timer that's motivating at one age reads as either patronizing or impossibly long at another.</p>
          <ol>
            <li><b>Elementary (K–5):</b> short bursts — 2–5 minutes for a transition between activities, 60 seconds for "clean up your table." Long countdowns lose younger students; several short ones hold attention better than one 20-minute block.</li>
            <li><b>Middle school (6–8):</b> 10–15 minutes for group work or a worksheet, with the board visible the whole time so students self-pace instead of asking "how much longer" every few minutes.</li>
            <li><b>High school (9–12):</b> 20–50 minutes for sustained work or a full quiz — the Light board style (below) reads clearly from the back of a large room, and a projected countdown removes the need to interrupt the class with a verbal time check.</li>
          </ol>
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
  ["Fixed durations", [
    "5-minute-timer", "10-minute-timer", "15-minute-timer", "20-minute-timer",
    "25-minute-timer", "30-minute-timer", "45-minute-timer", "60-minute-timer",
  ]],
  ["Classroom & exams", ["exam-timer", "classroom-timer", "group-study-timer"]],
  ["Meetings", [
    "webinar-countdown", "standup-timer", "zoom-meeting-timer",
    "google-meet-timer", "workshop-timer",
  ]],
  ["Streaming", ["obs-countdown-timer", "twitch-stream-timer"]],
  ["Focus & intervals", [
    "pomodoro-timer", "tabata-timer", "interval-timer", "boxing-round-timer",
  ]],
  ["Multi-stage", ["multiple-timers-at-once", "agenda-timer"]],
  ["Play & events", ["game-night-timer", "auction-countdown"]],
  ["Count up", ["stopwatch"]],
  ["Seasonal", ["new-year-countdown", "christmas-countdown"]],
];

export const PAGES = [
  { slug: "5-minute-timer", minutes: 5, label: "Time's up", eyebrow: "5 Minute Timer",
    h1: "5 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 5 minute timer for quick breaks, lightning talks and board-game turns — share the link and everyone's countdown ends together.",
    intro: "Five minutes is long enough for a quick break, a lightning talk, or the last leg of a board game turn — and short enough that everyone actually watches it end. Press start, then send the link to anyone else who needs to see the same five minutes tick down.",
    faq: [
      { q: "How accurate is a 5 minute shared timer?", a: "Accurate to about a second. Each device counts down independently against the same shared deadline using its own clock, so there's no server lag to introduce drift between screens." },
      { q: "Can more than one person use the link at once?", a: "Yes — any number of people can open the same link at the same time. There's no viewer limit, because nothing is streamed to them; each device just does its own math against the timestamp in the URL." },
      { q: "Does it still work if I close the tab and reopen it?", a: "Yes. Reopening the link re-reads the same deadline from the URL and picks up exactly where the countdown should be — nothing resets." },
    ] },
  { slug: "10-minute-timer", minutes: 10, label: "Time's up", eyebrow: "10 Minute Timer",
    h1: "10 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 10 minute timer built for coffee breaks, standups and timed writing sprints — no app, no signup, just a link everyone can open.",
    intro: "Ten minutes covers a coffee break, a standup, or a timed writing sprint. Start the countdown here and share the link — no app to install, no account for anyone else to make.",
    faq: [
      { q: "Can I use this for a daily standup instead of a dedicated app?", a: "Yes — set 10 minutes, drop the link in your team chat, and everyone's own screen counts down without installing anything or creating an account." },
      { q: "What happens when the 10 minutes run out?", a: "Every open screen hits zero at the same instant and plays a short chime if sound is on. Nothing else happens automatically, so it's safe to leave running in the background." },
      { q: "Can I change 10 minutes to a different length later?", a: "Yes — set a new duration and copy the new link. The mechanic is identical; only the timestamp inside the URL changes." },
    ] },
  { slug: "15-minute-timer", minutes: 15, label: "Time's up", eyebrow: "15 Minute Timer",
    h1: "15 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 15 minute timer for quiz rounds and lightning-talk slots — share the link and the whole room counts down together.",
    intro: "Fifteen minutes is a classic break length and a common quiz-round or lightning-talk limit. Set it once, share the link, and every screen in the room counts down together.",
    faq: [
      { q: "Is this good for timing quiz rounds?", a: "Yes — set 15 minutes per round, share the link once, and every team's device shows the identical time remaining, so nobody can dispute the cutoff." },
      { q: "Can I project this on a screen instead of sharing the link?", a: "Yes — use Fullscreen mode for a clean, large display, or share the link too so people can check it on their own phones as well." },
      { q: "Will everyone's countdown reach zero at exactly the same moment?", a: "Yes, within about a second — every device counts down against the same shared timestamp using its own clock, with no server round-trip to introduce lag." },
    ] },
  { slug: "20-minute-timer", minutes: 20, label: "Time's up", eyebrow: "20 Minute Timer",
    h1: "20 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 20 minute timer for workshop segments and timed exercises — start it here and hand the link to the room.",
    intro: "Twenty minutes works well for a workshop segment or a timed exercise. Start it here, copy the sync link, and hand it to the room.",
    faq: [
      { q: "Can I reuse this link for a recurring 20-minute segment?", a: "Each link is tied to one specific end time, so for a repeating segment it's easiest to hit a quick-timer button again each time and share the fresh link — it takes one click." },
      { q: "Does everyone need to be in the same room?", a: "No — the link works the same whether people are sitting together or joining remotely; each device just counts down to the same shared deadline." },
      { q: "Is there a limit to how many people can open the link?", a: "No limit. Since there's no server tracking viewers, showing the countdown to one person or a thousand costs exactly the same — nothing." },
    ] },
  { slug: "25-minute-timer", minutes: 25, label: "Pomodoro break", eyebrow: "25 Minute Timer",
    h1: "25 Minute Timer — The Pomodoro Length, Shareable",
    meta: "A free 25 minute Pomodoro timer you can share with a study group or coworking room — everyone's screen counts down in sync.",
    intro: "Twenty-five minutes is the classic Pomodoro focus block. Start it solo, or share the link with a study group or co-working session so everyone's break lands at the same moment.",
    faq: [
      { q: "Is this a real Pomodoro timer with work/break cycles?", a: "It's a single 25-minute countdown, not an automated cycling timer — start it again for your next Pomodoro, or use the count-up/stopwatch mode if you'd rather track elapsed focus time instead." },
      { q: "Can my whole study group use the same 25-minute block?", a: "Yes — share the link once and everyone's focus block, and everyone's break, starts and ends at the exact same moment, since it's all counting down to one shared timestamp." },
      { q: "Does the timer make a sound at the end?", a: "Yes, a short chime plays when it hits zero (toggle it off with the Sound button if you'd rather work in silence)." },
    ] },
  { slug: "30-minute-timer", minutes: 30, label: "Time's up", eyebrow: "30 Minute Timer",
    h1: "30 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 30 minute timer for workshop exercises, half-length meetings and timed test sections — share the link with anyone who needs the same clock.",
    intro: "Half an hour is enough for a workshop exercise, a half-length meeting, or a timed test section. Start the countdown and share the link with anyone who needs to see the same clock.",
    faq: [
      { q: "Can I use this for a timed test or quiz section?", a: "Yes — set 30 minutes, share the link, and every device shows the identical time remaining, which is the whole point of a fair shared clock." },
      { q: "What if I need to stop early?", a: "There's no live pause pushed to other viewers yet — if plans change, the simplest fix is to start a new countdown and re-share the fresh link." },
      { q: "Does this work on a projector as well as phones?", a: "Yes — use Fullscreen mode for a large, high-contrast display, or the Light style specifically if the room is brightly lit." },
    ] },
  { slug: "45-minute-timer", minutes: 45, label: "Time's up", eyebrow: "45 Minute Timer",
    h1: "45 Minute Timer — Free, Shareable, In Sync",
    meta: "A free 45 minute timer for class periods and workshop sessions — put it on the projector and every phone in the room can follow along.",
    intro: "Forty-five minutes is a common class period and workshop-session length. Start it here and put it on the projector — every phone in the room can pull up the same link.",
    faq: [
      { q: "Is 45 minutes a common class-period length this suits?", a: "Yes — it's one of the most common school class-period lengths, which is why it's offered as a quick-timer preset alongside custom durations." },
      { q: "Can students follow the countdown on their own phones too?", a: "Yes — share the link and any device can open it; the projector and every phone will show the identical time remaining." },
      { q: "Does the timer keep going if the projector or Wi-Fi drops?", a: "Yes, on any device that already has the page open — since the countdown is calculated locally against a timestamp in the URL, it doesn't need an ongoing connection to keep counting." },
    ] },
  { slug: "60-minute-timer", minutes: 60, label: "Time's up", eyebrow: "1 Hour Timer",
    h1: "1 Hour Timer — Free, Shareable, In Sync",
    meta: "A free 1 hour timer for full classes, exam blocks and meetings you'd like to actually end on time — share the link so nobody has to ask how long is left.",
    intro: "One hour covers a full class, a standard exam block, or a meeting you'd like to actually end on time. Start the countdown and share the link so nobody has to ask how long is left.",
    faq: [
      { q: "Is an hour timer displayed differently from a shorter one?", a: "Yes — once a countdown includes hours, the board shows HH:MM:SS instead of just MM:SS, and that format is fixed for the whole hour so the display never jumps or changes shape partway through." },
      { q: "Can I use this for a one-hour meeting to help it end on time?", a: "Yes — share the link at the start and leave it visible on a shared screen or everyone's own device; watching the same clock count down is a simple, effective way to keep a meeting on schedule." },
      { q: "What happens after the hour runs out?", a: "The board reads zero and every screen with the link chimes together (if sound is on) — it doesn't restart or do anything else automatically." },
    ] },
  { slug: "exam-timer", minutes: 60, label: "Time is up — pens down", eyebrow: "Exam Timer", affiliate: true,
    h1: "Exam Timer — One Countdown For The Whole Room",
    meta: "A shareable exam timer for classrooms and test centres. Every invigilator's screen and every student device shows the identical countdown to the second.",
    intro: "Put the countdown on the front screen and, if students have devices, on theirs too — everyone sees the identical time remaining, which is the whole point of a fair exam clock. Set it to your exam length and share the link before the paper starts.",
    extra: EXAM_EXTRA,
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
  { slug: "obs-countdown-timer", minutes: 5, label: "Starting soon", eyebrow: "OBS Countdown Timer",
    h1: "OBS Countdown Timer — Free Browser Source",
    meta: "A free countdown timer built to drop straight into OBS as a browser source — transparent background, no signup, no watermark.",
    intro: "Add the overlay version of this page as an OBS Browser Source and it drops onto your scene with a transparent background — no green screen, no chroma key setup. Set your stream-start countdown, copy the link into OBS, and it's live.",
    extra: OBS_OVERLAY_EXTRA,
    faq: [
      { q: "Will the background really be transparent in OBS?", a: "Yes — the overlay link removes the page background entirely (not just visually dark, genuinely transparent), so only the countdown digits appear on your scene, with no chroma key or green screen needed." },
      { q: "Does the countdown keep running if I switch OBS scenes?", a: "Yes, as long as the Browser Source stays loaded — if you enable \"Shutdown source when not visible,\" OBS will reload it when the scene becomes active again and it will recalculate against the same shared deadline correctly." },
      { q: "Can I resize the overlay without it looking blurry?", a: "Yes — the digits are rendered as live text (not an image), so resizing the Browser Source in OBS stays sharp at any size." },
    ] },
  { slug: "twitch-stream-timer", minutes: 5, label: "Starting soon", eyebrow: "Twitch Stream Timer",
    h1: "Twitch Stream Timer — Countdown Overlay",
    meta: "A free stream-starting countdown for Twitch — a transparent browser-source overlay, or a link to share with mods and co-streamers so everyone's in sync.",
    intro: "Streamers use this the same way as a \"starting soon\" screen — set the countdown, add the overlay version as a transparent browser source, and it counts down on stream. Share the same link with mods or co-streamers and their screens match exactly.",
    extra: OBS_OVERLAY_EXTRA,
    faq: [
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
      { q: "Can I set up several segments in a row (talk, break, Q&A)?", a: "Right now each link is one countdown at a time — start the next segment's timer and share its link when the previous one ends. Chained agenda sequences are on the roadmap." },
      { q: "Is this suitable for a large room with many tables?", a: "Yes — there's no limit on how many devices can open the same link, so it scales to as many tables or groups as you have." },
    ] },
  { slug: "group-study-timer", minutes: 25, label: "Break time", eyebrow: "Group Study Timer", affiliate: true,
    h1: "Group Study Timer — Study With Me, In Sync",
    meta: "A free shared study timer for study groups and study-with-me sessions. Set a focus block, share the link, and everyone's break lands at the same moment.",
    intro: "Studying with friends or running a study-with-me stream works best when breaks actually line up. Set a focus block here, share the link with your group, and everyone's countdown — and everyone's break — happens at the exact same moment.",
    faq: [
      { q: "Is this good for a \"study with me\" livestream?", a: "Yes — set your focus-block length, share the link in chat or your stream description, and viewers studying along with you see the identical countdown to the second." },
      { q: "Can my study group use this even if we're not all together?", a: "Yes — everyone opens the same link from wherever they are, and each device counts down to the same shared moment regardless of location." },
      { q: "Does it support a work/break cycle automatically?", a: "Not automatically yet — start a new countdown for each focus block and each break. Chained agenda sequences are on the roadmap." },
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
  { slug: "stopwatch", minutes: 10, direction: "up", label: "", eyebrow: "Online Stopwatch",
    h1: "Online Stopwatch — Shared, Synced by Link",
    meta: "A free online stopwatch you can share: press start, send the link, and every screen shows the identical elapsed time. No app, no signup.",
    intro: "Most online stopwatches live and die on one screen. This one is shareable: press start, send the link, and everyone who opens it sees the same elapsed time ticking up — the start instant travels inside the link itself.",
    setupHint: "The board above is in stopwatch (count-up) mode — switch direction here if you wanted a countdown instead.",
    faq: [
      { q: "How is a shared stopwatch different from the one on my phone?", a: "Your phone's stopwatch exists only on your phone. This one encodes its start instant in a link, so any device that opens the link shows the identical elapsed time — useful for timing anything a group is watching together." },
      { q: "Does the stopwatch keep running if I close the tab?", a: "Effectively yes — nothing is actually \"running\" anywhere. The link records when the stopwatch started, so reopening it later shows the correct elapsed time, as if it had been running the whole time." },
      { q: "Is there a lap or split function?", a: "No — this is deliberately a simple shared stopwatch. For lap timing you'd want a single-device sports stopwatch; this tool's job is showing one agreed elapsed time on many screens." },
    ] },
  { slug: "pomodoro-timer", minutes: 25, label: "Pomodoro — focus", eyebrow: "Pomodoro Timer", affiliate: true,
    h1: "Pomodoro Timer — 25 Minutes, Shareable",
    meta: "A free 25-minute pomodoro timer you can share: the whole study group or team focuses to the same clock, then breaks together.",
    intro: "The pomodoro technique is 25 minutes of focus, then a 5-minute break, repeated. Solo, any kitchen timer works — but a pomodoro is better with company. Start the 25 minutes here, share the link, and your study group or team focuses to the same clock and breaks at the same moment.",
    setupHint: "The board above is set to the classic 25-minute pomodoro — set 5 minutes here for the break, then Restart for the next round.",
    extra: `
        <div class="obs-extra">
          <h3>Running full pomodoro cycles</h3>
          <ol>
            <li>Start the <b>25-minute</b> countdown and share the link with everyone working with you.</li>
            <li>At zero, hit the <b>5 min</b> quick button and start the break — share the fresh link (each timer is its own link).</li>
            <li>After the break, press <b>Restart — same duration</b> to begin the next 25 minutes in one click.</li>
            <li>Every fourth break, set <b>15–30 minutes</b> instead — that's the classic long-break rhythm.</li>
          </ol>
          <p>Why doesn't it auto-advance from focus to break? Because the link is the timer: each countdown is one fixed end time that every screen agrees on. An auto-advancing cycle would need every viewer's browser to agree on state changes over time — that's a server, and no server is the reason this tool has no viewer limits.</p>
        </div>`,
    faq: [
      { q: "Why 25 minutes?", a: "That's the classic pomodoro length from Francesco Cirillo's original technique — long enough to get real work done, short enough that starting doesn't feel heavy. The custom-minutes field takes any length if your group prefers 50/10." },
      { q: "Can my study group all follow the same pomodoro?", a: "Yes — that's the point of the shared link. Everyone opens it and sees the identical countdown, so the whole group starts focusing and breaks at the same moments." },
      { q: "Does it auto-start the break when the 25 minutes end?", a: "No — at zero every screen chimes together, then whoever runs the session starts the 5-minute break and shares that link. The one-click Restart button makes the next focus round instant." },
    ] },
  { slug: "tabata-timer", minutes: 4, label: "Tabata complete", eyebrow: "Tabata Timer",
    h1: "Tabata Timer — 20s Work / 10s Rest, Shareable",
    meta: "A free Tabata timer — 20 seconds work, 10 seconds rest, 8 rounds by default, and every screen with the link stays on the identical round.",
    intro: "Classic Tabata is 20 seconds of maximum effort, 10 seconds of rest, repeated 8 times — about 4 minutes total. Set your rounds below, press start, and share the link so a whole class or gym floor follows the identical work/rest cycle from the same board.",
    setupHint: "Defaults to the classic Tabata protocol (20s work, 10s rest, 8 rounds) — change any of the three below before you start.",
    extra: ivExtra(20, 10, 8),
    faq: [
      { q: "Why 20 seconds work and 10 seconds rest?", a: "That's Dr. Izumi Tabata's original protocol from a 1996 study on high-intensity interval training — short enough to sustain near-maximal effort, with just enough rest to repeat it eight times." },
      { q: "Can I change the work/rest lengths or round count?", a: "Yes — all three (work seconds, rest seconds, rounds) are editable before you start. It stops being strictly \"Tabata\" once you change the classic 20/10 ratio, but the same shared-link mechanic works for any interval ratio." },
      { q: "Does everyone see the same round at the same time?", a: "Yes — like every timer here, the cycle's start instant is encoded in the link itself, so every device computes the current round and phase independently from the same starting point, with no server keeping them in sync." },
    ] },
  { slug: "interval-timer", minutes: 10, label: "Rounds complete", eyebrow: "Interval Timer",
    h1: "Interval Timer — Work/Rest Rounds, Shareable",
    meta: "A free interval timer — set your own work and rest lengths and round count, and share the link so a whole group follows the identical cycle.",
    intro: "Set a work length, a rest length, and how many rounds — press start, and share the link so everyone doing the same workout, drill, or exercise sees the identical round and phase, on their own device.",
    setupHint: "Set any work/rest split and round count below — there's no fixed protocol here, unlike the Tabata-specific timer.",
    extra: ivExtra(30, 15, 10),
    faq: [
      { q: "How is this different from the Tabata timer?", a: "Tabata is this same mechanic locked to its classic 20-seconds-work/10-seconds-rest protocol. This page defaults to a more general 30/15 split, but both pages let you set any work length, rest length, and round count you want." },
      { q: "Can rest be zero seconds, for back-to-back rounds?", a: "Yes — set rest to 0 and each round runs straight into the next work phase with no pause, useful for a fixed number of consecutive timed sets." },
      { q: "What happens when all rounds finish?", a: "Every screen shows \"Done\" together and chimes if sound is on. Press Restart for the identical work/rest/rounds setup again, or adjust the numbers below and start fresh." },
    ] },
  { slug: "boxing-round-timer", minutes: 3, label: "Fight's over", eyebrow: "Boxing Round Timer",
    h1: "Boxing Round Timer — 3 Min Rounds, 1 Min Rest",
    meta: "A free boxing/kickboxing round timer — 3-minute rounds, 1-minute rest, 12 rounds by default, shareable so the whole gym stays on the same clock.",
    intro: "Standard boxing rounds are 3 minutes with a 1-minute rest between them. Set your round count below, press start, and share the link so a coach's phone and every fighter's own screen stay on the identical round and rest period.",
    setupHint: "Defaults to standard boxing rounds (3 min work, 1 min rest, 12 rounds) — change any of the three for kickboxing, Muay Thai, or a custom sparring format.",
    extra: ivExtra(180, 60, 12),
    faq: [
      { q: "Does this match standard boxing round timing?", a: "Yes — 3 minutes per round with a 1-minute rest is the standard professional format. Amateur bouts and other combat sports often use shorter rounds; change the work-seconds field to match (e.g. 120 for 2-minute rounds)." },
      { q: "Can I use this for Muay Thai or kickboxing instead?", a: "Yes — set the work/rest lengths to match whichever format you need (Muay Thai commonly uses 3-minute rounds with 2-minute rests, for instance) and the round count for however many rounds the bout runs." },
      { q: "Is there a ten-second warning before the round ends?", a: "Not a distinct warning sound, but the screen-reader announcement and the visible countdown both update every second in the final stretch, so it's easy to see (or hear, with assistive tech) a round winding down." },
    ] },
  { slug: "multiple-timers-at-once", minutes: 5, label: "", eyebrow: "Multiple Timers",
    multiTimer: true,
    h1: "Multiple Timers at Once — Shareable Dashboard",
    meta: "Run several named countdowns on one screen — cooking, multi-station events, parallel exam sections — all synced by one shareable link.",
    intro: "Add as many named timers as you need — each one is its own independent countdown, all shown together on one dashboard. Share the link and everyone sees the identical set of timers, all counting down together.",
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
    .map(p => `<a href="/timers/${p.slug}">${p.eyebrow}</a>`);
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
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
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
    </div>
  </section>

  <div class="ad-slot">
    <ins class="adsbygoogle" style="display:block;min-height:90px"
         data-ad-client="ca-pub-2653891546345771" data-ad-slot="9745719960"
         data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
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
  </section>

  <div class="ad-slot">
    <ins class="adsbygoogle" style="display:block;min-height:90px"
         data-ad-client="ca-pub-2653891546345771" data-ad-slot="9745719960"
         data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </div>

  <section class="setup-section">
    <div class="panel">
      <h2>Change the countdown</h2>
      <div class="hint">${p.setupHint || `The board above is set to ${p.minutes} minutes, ready when you are — adjust it here if you need something else.`}</div>
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
      <button class="btn icon-btn" id="qrBtn" style="margin-top:10px">${QR_ICON}<span id="qrBtnLabel">Show QR code</span></button>
      <div id="qrWrap" style="display:none;margin-top:10px">
        <img id="qrImg" width="160" height="160" alt="QR code for the sync link" style="background:#fff;padding:8px;border-radius:6px">
        <div class="hint" style="margin-top:6px">Generated on demand by a third-party QR API (goqr.me) — the only feature on this site that makes an external request. See <a href="/privacy" style="text-decoration:underline">Privacy</a>.</div>
      </div>
      <button class="pro-link" id="embedBtn" style="margin-top:10px">Embed on your site →</button>
      <div id="embedWrap" style="display:none;margin-top:10px">
        <textarea id="embedCode" readonly rows="3" style="width:100%;font-family:monospace;font-size:13px;resize:vertical"></textarea>
        <button class="pro-link" id="embedCopyBtn" style="margin-top:6px">Copy embed code</button>
        <div class="hint" style="margin-top:6px">A transparent, chrome-free version of this same synced countdown — the same code streamers use for an OBS overlay works as a plain &lt;iframe&gt; on any page.</div>
      </div>
    </div>
  </section>

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
<title>${p.h1} | ${BRAND}</title>
<meta name="description" content="${p.meta}">
<link rel="canonical" href="${SITE_URL}/timers/${p.slug}">
<meta property="og:title" content="${p.h1}">
<meta property="og:description" content="${p.meta}">
<meta property="og:type" content="website">
<meta property="og:image" content="${SITE_URL}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE_URL}/assets/og-image.png">
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
<link rel="apple-touch-icon" href="../assets/favicon.svg">
<link rel="manifest" href="../manifest.json">
<meta name="theme-color" content="${THEME_COLORS[p.theme] || "#1c1c1a"}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/style.css?v=9b539a86">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WM4M28L7Y1"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','G-WM4M28L7Y1');</script>
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: BRAND,
  url: `${SITE_URL}/timers/${p.slug}`,
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
    { "@type": "ListItem", position: 2, name: p.eyebrow, item: `${SITE_URL}/timers/${p.slug}` },
  ],
})}</script>
${faqSchema(p.faq)}
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
      Built and maintained by <a href="${AUTHOR_URL}" rel="author noopener" target="_blank">${AUTHOR_NAME}</a>, an independent developer in Edinburgh.</div>
    </div>
  </div>
</footer>

<script>window.COUNTLINK_DEFAULT=${JSON.stringify({ minutes: p.minutes, label: p.label, ...(p.direction ? { direction: p.direction } : {}), ...(p.untilMonthDay ? { untilMonthDay: p.untilMonthDay } : {}) })};</script>
<script src="../assets/app.js?v=f5578446" defer></script>
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
const guideShell = ({ rel, title, description, canonicalPath, headJsonLd = "", main, footLinks }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
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
<link rel="apple-touch-icon" href="${rel}assets/favicon.svg">
<link rel="manifest" href="${rel}manifest.json">
<meta name="theme-color" content="#1c1c1a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;500;700&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${rel}assets/style.css?v=79ba9849">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-WM4M28L7Y1"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','G-WM4M28L7Y1');</script>
${headJsonLd}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2653891546345771" crossorigin="anonymous"></script>
${growScript()}
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
${chassis("/guides")}
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
      <div><div class="fb">${NAME}</div>A timer you can hand to a room. · <a href="/guides">Guides</a> · <a href="/how-it-works">How It Works</a> · <a href="/about">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a> · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
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
  "using-timers-in-the-classroom": ["classroom-timer", "exam-timer", "group-study-timer", "10-minute-timer"],
  "put-a-timer-on-your-classroom-screen": ["classroom-timer", "exam-timer", "workshop-timer", "group-study-timer"],
  "how-to-run-a-timed-exam": ["exam-timer", "classroom-timer", "60-minute-timer", "30-minute-timer"],
  "the-pomodoro-technique": ["pomodoro-timer", "25-minute-timer", "5-minute-timer", "group-study-timer"],
  "running-short-standups": ["standup-timer", "10-minute-timer", "15-minute-timer", "agenda-timer"],
  "timeboxing-meetings": ["zoom-meeting-timer", "google-meet-timer", "agenda-timer", "30-minute-timer", "45-minute-timer"],
  "facilitating-workshops-to-time": ["workshop-timer", "agenda-timer", "multiple-timers-at-once", "15-minute-timer"],
  "interval-training-timing": ["tabata-timer", "interval-timer", "boxing-round-timer", "5-minute-timer"],
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
const relatedGuides = (timerSlug) => {
  const slugs = (GUIDES_FOR_TIMER[timerSlug] || []).slice(0, 2);
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
    .map((p) => `<a href="/timers/${p.slug}">${p.eyebrow}</a>`)
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
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
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
    <p class="article-back"><a href="/guides">← All guides</a></p>
  </article>
  <div class="ad-slot">
    <ins class="adsbygoogle" style="display:block;min-height:90px"
         data-ad-client="ca-pub-2653891546345771" data-ad-slot="9745719960"
         data-ad-format="auto" data-full-width-responsive="true"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
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
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
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
  return guideShell({ rel: "../", title: "Timing & Productivity Guides", description: "Practical guides on running meetings, exams, classes, workshops, standups and workouts to time — timeboxing, the Pomodoro technique, interval training and more.", canonicalPath: "/guides", headJsonLd: jsonLd, main });
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
  main: `
<article class="article">
  <h1>Page not found</h1>
  <p>There's nothing at that address — it may have been renamed, or the link
  that brought you here may have a typo in it.</p>
  <p>If you were opening a shared countdown, ask whoever sent it for a fresh
  link: the timer lives entirely in the URL, so a truncated or edited link
  can't be recovered from this end.</p>
  <p><a href="/">Start a countdown</a> · <a href="/guides">Read the guides</a> · <a href="/contact">Report a broken link</a></p>
</article>`,
});

// Sitemap lastmod reflects when the pages were actually (re)generated, not
// the hand-bumped CONTENT_DATE used for JSON-LD datePublished/dateModified —
// derive it from the current date at build time so every rebuild keeps the
// sitemap fresh automatically instead of freezing on whatever date someone
// last remembered to type in.
const BUILD_DATE = new Date().toISOString().split("T")[0];

const sitemap = () => {
  const urls = PAGES.map(p => `  <url><loc>${SITE_URL}/timers/${p.slug}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join("\n");
  const staticUrls = STATIC_PAGES.map(f => `  <url><loc>${SITE_URL}/${f.replace(/\.html$/, "")}</loc><lastmod>${BUILD_DATE}</lastmod></url>`).join("\n");
  const guideUrls = [`  <url><loc>${SITE_URL}/guides</loc><lastmod>${BUILD_DATE}</lastmod></url>`]
    .concat(ARTICLES.map(a => `  <url><loc>${SITE_URL}/guides/${a.slug}</loc><lastmod>${BUILD_DATE}</lastmod></url>`))
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${BUILD_DATE}</lastmod></url>
${staticUrls}
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
  const durationSlugs = new Set(["5-minute-timer","10-minute-timer","15-minute-timer","20-minute-timer","25-minute-timer","30-minute-timer","45-minute-timer","60-minute-timer"]);
  const durationLines = PAGES.filter(p => durationSlugs.has(p.slug)).map(p => `- [${p.eyebrow}](${SITE_URL}/timers/${p.slug})`).join("\n");
  const useCaseLines = PAGES.filter(p => !durationSlugs.has(p.slug)).map(p => `- [${p.eyebrow}](${SITE_URL}/timers/${p.slug})`).join("\n");
  return `# ${BRAND}

> Free shared countdown timer. Set a duration, copy the link, and everyone who opens it sees the identical countdown — synced by encoding the end timestamp in the URL itself, with no account and no server round-trip.

${BRAND} is a static web app: no signup, no backend, no per-viewer cost. The sync mechanic (timestamp embedded in the shared link) is the core differentiator versus real-time-server competitors like ShareMyTimer and Stagetimer.io — see the comparison page below for specifics.

## Primary pages
- [Home / timer tool](${SITE_URL}/): create and share a countdown, FAQ on how sync works, why the free tier has no viewer limit
- [How It Works](${SITE_URL}/how-it-works): the link-timestamp sync mechanic explained in depth
- [Comparison: ${BRAND} vs ShareMyTimer vs Stagetimer](${SITE_URL}/compare): pricing, limits, and architecture differences, verified against each competitor's own pricing page
- [About](${SITE_URL}/about): who builds this and why
- [Privacy policy](${SITE_URL}/privacy): what data is (and isn't) collected
- [Terms of Service](${SITE_URL}/terms)
- [Contact](${SITE_URL}/contact)

## Guides
${ARTICLES.map(a => `- [${a.title}](${SITE_URL}/guides/${a.slug}): ${a.description}`).join("\n")}

## Duration timers
${durationLines}

## Use-case timers
${useCaseLines}
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
  ["/guides", "Guides"],
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
      return `<li><a href="/timers/${slug}"${here ? ' aria-current="page"' : ""}>${bySlug[slug].eyebrow}</a></li>`;
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

  // /embed/ serves the same document as the root, but from a path that
  // _headers exempts from X-Frame-Options: DENY. Without it, every embed of
  // the overlay silently failed on third-party sites (the header applies to
  // the whole origin and can't be scoped to ?overlay=1).
  const embedDir = join(ROOT, "embed");
  await mkdir(embedDir, { recursive: true });
  const rootHtml = await readFile(join(ROOT, "index.html"), "utf-8");
  await writeFile(join(embedDir, "index.html"),
    rootHtml.replace("<head>", '<head>\n<meta name="robots" content="noindex,follow">'), "utf-8");
  console.log("Wrote embed/index.html (framable overlay host, noindex)");

  const notFoundPath = join(ROOT, "404.html");
  await writeFile(notFoundPath, notFoundPage(), "utf-8");
  console.log(`Wrote ${relative(ROOT, notFoundPath)}`);

  const sitemapPath = join(ROOT, "sitemap.xml");
  await writeFile(sitemapPath, sitemap(), "utf-8");
  console.log(`Wrote ${relative(ROOT, sitemapPath)} (${PAGES.length + STATIC_PAGES.length + 1} URLs)`);

  const llmsPath = join(ROOT, "llms.txt");
  await writeFile(llmsPath, llmsTxt(), "utf-8");
  console.log(`Wrote ${relative(ROOT, llmsPath)}`);

  const d = dates.save();
  console.log(`dateModified: ${d.total} pages tracked, ${d.changed.length} changed this build.`);

  await syncChrome();
  await syncIndexFootLinks();
  console.log("\nTo rename or update the domain, run scripts/rename-brand.mjs (don't edit site-config.mjs by hand).");
}

main();
