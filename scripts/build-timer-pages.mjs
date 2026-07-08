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
import { NAME, SITE_URL, CONTACT_EMAIL, CONTENT_DATE } from "./site-config.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = join(ROOT, "timers");

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

const PAGES = [
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
  { slug: "exam-timer", minutes: 60, label: "Time is up — pens down", eyebrow: "Exam Timer",
    h1: "Exam Timer — One Countdown For The Whole Room",
    meta: "A shareable exam timer for classrooms and test centres. Every invigilator's screen and every student device shows the identical countdown to the second.",
    intro: "Put the countdown on the front screen and, if students have devices, on theirs too — everyone sees the identical time remaining, which is the whole point of a fair exam clock. Set it to your exam length and share the link before the paper starts.",
    extra: EXAM_EXTRA,
    faq: [
      { q: "Can students see the same countdown on their own devices during a test?", a: "Yes, if your exam rules permit devices — every device that opens the link shows the identical time remaining. Many exam contexts restrict student devices entirely, in which case display it on the room's front screen only." },
      { q: "What happens if a student's device clock is wrong?", a: "It doesn't matter — the countdown is calculated from the shared deadline in the link, not from the device's own clock, so display accuracy only depends on the device's clock being roughly correct (typically accurate to within a second), not on it being manually set right." },
      { q: "Is this accurate enough for a formal, timed exam?", a: "It's accurate to about a second across every device, since each one counts down independently against the same shared timestamp — the same underlying approach used by any client-side countdown. For extremely high-stakes timing, follow your institution's official exam-clock policy." },
    ] },
  { slug: "classroom-timer", minutes: 10, label: "Back to it", eyebrow: "Classroom Timer",
    h1: "Classroom Timer — For Group Work, Quizzes And Transitions",
    meta: "A free classroom timer built for transitions, group work and quiz rounds — project it or share the link so every student sees the same countdown.",
    intro: "Group work, quiz rounds, silent reading, transition time between activities — a visible shared countdown ends the “how much longer” questions on its own. Project it fullscreen or share the link to student devices.",
    faq: [
      { q: "Is this better than just projecting a phone timer app?", a: "The advantage is sharing: instead of only the front-screen clock, students can pull up the identical countdown on their own device too, so a quick glance answers \"how much longer\" without asking." },
      { q: "Can I reuse the same setup for different activities during one lesson?", a: "Yes — set a new quick-timer duration for each activity and share the fresh link; each activity gets its own clean countdown." },
      { q: "Does this need a school Wi-Fi login or account?", a: "No signup for you or your students. The page itself needs to load once (standard classroom Wi-Fi/projector network is enough), and after that each device counts down locally." },
    ] },
  { slug: "webinar-countdown", minutes: 5, label: "We're starting", eyebrow: "Webinar Countdown",
    h1: "Webinar Countdown — Show Attendees Exactly When You Start",
    meta: "A shareable pre-webinar countdown. Put the link in your registration email or waiting room so every attendee's screen counts down to the same start time.",
    intro: "Drop this link in your registration confirmation or waiting-room slide. Every attendee who opens it — on any device, in any timezone — sees a countdown to the exact same start moment, because the deadline travels inside the link itself.",
    faq: [
      { q: "Does this handle attendees in different timezones correctly?", a: "Yes — the link encodes one exact instant, not a wall-clock time, so every attendee's device converts it to their own local time automatically and everyone counts down to the same real moment." },
      { q: "Can I put this in an email before the webinar starts?", a: "Yes — that's a common use: paste the link into your registration confirmation or reminder email so attendees can see exactly how long until you go live." },
      { q: "What should attendees see after the countdown ends?", a: "The board shows the countdown has reached zero; from there, switch attendees to your actual webinar link/room, since this page is the countdown itself, not the meeting." },
    ] },
  { slug: "standup-timer", minutes: 10, label: "Standup over", eyebrow: "Standup Timer",
    h1: "Standup Timer — Keep Daily Standups Short",
    meta: "A free shareable standup timer for teams. Set the length once, drop the link in Slack, and everyone sees the same countdown to keep standup on time.",
    intro: "The easiest way to keep a daily standup to ten minutes is a countdown everyone can see. Set the length, drop the link in your team channel, and project it during the call.",
    faq: [
      { q: "Can I pin this link in Slack for the team to reuse?", a: "You can pin it, but remember each link is tied to a specific end time — for a genuinely reusable daily habit, it's quickest to hit the same quick-timer button each morning and share that day's fresh link." },
      { q: "Does everyone need to join a call to see it?", a: "No — anyone with the link can open it on their own device, whether they're in a video call, in the office, or just watching from a browser tab." },
      { q: "Will remote and in-office teammates see the same countdown?", a: "Yes — the deadline is one shared instant regardless of device or location, so remote and in-office teammates see identical time remaining." },
    ] },
  { slug: "zoom-meeting-timer", minutes: 10, label: "Time's up", eyebrow: "Zoom Meeting Timer",
    h1: "Zoom Meeting Timer — Keep Every Call On Time",
    meta: "A free shared timer for Zoom calls that doesn't need screen-sharing — copy the link into the chat and everyone's own screen counts down together.",
    intro: "Screen-sharing a timer inside Zoom works, but it takes over your whole screen. Open this on a second monitor or phone instead, or drop the link in the meeting chat — everyone gets their own synced countdown without you sharing anything.",
    extra: ZOOM_EXTRA,
    faq: [
      { q: "Do attendees need to install anything?", a: "No — opening the link in any browser is enough. There's no Zoom app, add-on, or extension involved." },
      { q: "Can I use this instead of Zoom's built-in meeting timer?", a: "Yes — CountLink's link is visible to every attendee on their own device, while Zoom's built-in timer is host-only and disappears once you share your screen." },
      { q: "Does it still work if I'm also sharing my screen?", a: "Yes — since attendees open the link on their own device or a second monitor, it works whether or not you're sharing your screen for something else." },
    ] },
  { slug: "google-meet-timer", minutes: 10, label: "Time's up", eyebrow: "Google Meet Timer",
    h1: "Google Meet Timer — A Shared Countdown For Video Calls",
    meta: "A free shared timer for Google Meet. Copy the link into the meeting chat and everyone's own screen counts down in sync — no extension, no screen share.",
    intro: "Paste the link into the in-call chat the moment the meeting starts. Nobody needs to install an extension or watch your shared screen — everyone's own tab counts down to the exact same second.",
    faq: [
      { q: "Is there a Google Meet extension I need to install?", a: "No — this is a plain web page. Paste the link into the in-call chat and anyone can open it in a new tab, no extension required." },
      { q: "Can I run this on a second screen while presenting?", a: "Yes — that's a common setup: keep the timer open on a second monitor or phone while your main screen is shared, so you can glance at the time without interrupting your presentation." },
      { q: "Will it work the same in Google Meet as it does elsewhere?", a: "Yes — the timer isn't specific to any video platform; it's just a link that happens to work well pasted into Meet's chat." },
    ] },
  { slug: "obs-countdown-timer", minutes: 5, label: "Starting soon", eyebrow: "OBS Countdown Timer",
    h1: "OBS Countdown Timer — Free Browser Source For Streamers",
    meta: "A free countdown timer built to drop straight into OBS as a browser source — transparent background, no signup, no watermark.",
    intro: "Add the overlay version of this page as an OBS Browser Source and it drops onto your scene with a transparent background — no green screen, no chroma key setup. Set your stream-start countdown, copy the link into OBS, and it's live.",
    extra: OBS_OVERLAY_EXTRA,
    faq: [
      { q: "Will the background really be transparent in OBS?", a: "Yes — the overlay link removes the page background entirely (not just visually dark, genuinely transparent), so only the countdown digits appear on your scene, with no chroma key or green screen needed." },
      { q: "Does the countdown keep running if I switch OBS scenes?", a: "Yes, as long as the Browser Source stays loaded — if you enable \"Shutdown source when not visible,\" OBS will reload it when the scene becomes active again and it will recalculate against the same shared deadline correctly." },
      { q: "Can I resize the overlay without it looking blurry?", a: "Yes — the digits are rendered as live text (not an image), so resizing the Browser Source in OBS stays sharp at any size." },
    ] },
  { slug: "twitch-stream-timer", minutes: 5, label: "Starting soon", eyebrow: "Twitch Stream Timer",
    h1: "Twitch Stream Timer — Countdown Overlay For Stream Starts",
    meta: "A free stream-starting countdown for Twitch. Use it as a transparent browser-source overlay, or just share the link with mods and co-streamers so everyone's in sync.",
    intro: "Streamers use this the same way as a \"starting soon\" screen — set the countdown, add the overlay version as a transparent browser source, and it counts down on stream. Share the same link with mods or co-streamers and their screens match exactly.",
    extra: OBS_OVERLAY_EXTRA,
    faq: [
      { q: "Will viewers on Twitch see the same countdown as my screen?", a: "Yes — whatever is on your OBS scene is what viewers see, and the overlay's countdown is calculated from the same shared deadline, so there's nothing separate to keep in sync." },
      { q: "Can my co-streamer or mod use the same countdown on their own screen?", a: "Yes — share the regular (non-overlay) link with them and their device shows the identical time remaining, useful for coordinating a multi-person stream start." },
      { q: "Does this cost anything or add a watermark to my stream?", a: "No — it's free with no watermark. The one exception is if you use the QR-code button, which calls a third-party API only when clicked; the overlay/timer itself never does." },
    ] },
  { slug: "workshop-timer", minutes: 15, label: "Segment over", eyebrow: "Workshop Timer",
    h1: "Workshop Timer — One Countdown For Every Table",
    meta: "A free shared timer for workshop facilitators. Set the segment length, share the link, and every table or breakout group sees the identical countdown.",
    intro: "Facilitators running breakout groups or table exercises know the problem: one group finishes early, another runs long, because everyone's eyeballing their own phone clock. Share this link instead and every table counts down from the same number.",
    faq: [
      { q: "Can each table or breakout group open the link on their own device?", a: "Yes — that's the intended use. Share one link and every table's device shows the identical time remaining, so there's no ambiguity about when a segment ends." },
      { q: "Can I set up several segments in a row (talk, break, Q&A)?", a: "Right now each link is one countdown at a time — start the next segment's timer and share its link when the previous one ends. Chained agenda sequences are on the roadmap." },
      { q: "Is this suitable for a large room with many tables?", a: "Yes — there's no limit on how many devices can open the same link, so it scales to as many tables or groups as you have." },
    ] },
  { slug: "group-study-timer", minutes: 25, label: "Break time", eyebrow: "Group Study Timer",
    h1: "Group Study Timer — Study With Me, In Sync",
    meta: "A free shared study timer for study groups and study-with-me sessions. Set a focus block, share the link, and everyone's break lands at the same moment.",
    intro: "Studying with friends or running a study-with-me stream works best when breaks actually line up. Set a focus block here, share the link with your group, and everyone's countdown — and everyone's break — happens at the exact same moment.",
    faq: [
      { q: "Is this good for a \"study with me\" livestream?", a: "Yes — set your focus-block length, share the link in chat or your stream description, and viewers studying along with you see the identical countdown to the second." },
      { q: "Can my study group use this even if we're not all together?", a: "Yes — everyone opens the same link from wherever they are, and each device counts down to the same shared moment regardless of location." },
      { q: "Does it support a work/break cycle automatically?", a: "Not automatically yet — start a new countdown for each focus block and each break. Chained agenda sequences are on the roadmap." },
    ] },
  { slug: "game-night-timer", minutes: 3, label: "Time's up", eyebrow: "Game Night Timer",
    h1: "Game Night Timer — For Turns, Rounds And House Rules",
    meta: "A free shareable timer for board games, party games and game night house rules. Set the turn limit, share the link, and nobody argues about how much time is left.",
    intro: "Every game night needs a turn timer eventually — charades rounds, drafting phases, \"you have sixty seconds to decide.\" Set it once, share the link to everyone's phone, and the countdown settles the argument before it starts.",
    faq: [
      { q: "Can everyone at the table see the countdown on their own phone?", a: "Yes — share the link once and each phone at the table shows the identical time remaining, so there's no dispute about who saw what." },
      { q: "Is this good for party games with strict time limits, like charades?", a: "Yes — set the turn length, share the link, and use Fullscreen mode on a central phone or tablet so the whole table can see it at a glance." },
      { q: "Can I quickly restart it for the next player's turn?", a: "Yes — hit the same quick-timer button again for a fresh countdown each turn; it takes one tap." },
    ] },
  { slug: "auction-countdown", minutes: 5, label: "Bidding closed", eyebrow: "Auction Countdown",
    h1: "Auction Countdown — Synced Bidding Deadline For Every Bidder",
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
  { slug: "pomodoro-timer", minutes: 25, label: "Pomodoro — focus", eyebrow: "Pomodoro Timer",
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

const BRAND = NAME; // imported from ./site-config.mjs — the one place these values live

const timerLinks = PAGES.map(p => `<a href="/timers/${p.slug}">${p.eyebrow}</a>`).join("\n          ");
// Same links, but rooted for index.html (one directory up from /timers/).
const rootTimerLinks = PAGES.map(p => `<a href="/timers/${p.slug}">${p.eyebrow}</a>`).join("\n      ");

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

const page = (p) => `<!DOCTYPE html>
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
<meta name="theme-color" content="${THEME_COLORS[p.theme] || "#1c1c1a"}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600&family=Bebas+Neue&family=Martian+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/style.css">
<script type="application/ld+json">${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: BRAND,
  url: `${SITE_URL}/timers/${p.slug}`,
  description: p.meta,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any (web browser)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  datePublished: CONTENT_DATE,
  dateModified: CONTENT_DATE,
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
<!-- ANALYTICS / ADSENSE placeholders — see index.html head and docs/monetization.md -->
</head>
<body${p.theme ? ` class="theme-${p.theme}"` : ""}>
<a class="skip-link" href="#boardEl">Skip to timer</a>

<header>
  <a class="logo" href="/">${BRAND}</a>
  <div class="head-meta">NO SIGNUP · NO SERVER<br><b>THE LINK IS THE SYNC</b></div>
</header>
<nav class="main-nav" aria-label="Site">
  <a href="/how-it-works">How It Works</a>
  <a href="/compare">Compare</a>
  <a href="/about">About</a>
  <a href="/privacy">Privacy</a>
  <a href="/terms">Terms</a>
  <a href="/contact">Contact</a>
</nav>

<main class="wrap">
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
      </div>
      <div class="sync-note"><span class="dot"></span><span id="syncMsg">Anyone opening your link right now sees exactly this.</span></div>
    </div>
  </section>

  <!-- Ad slot deliberately not rendered until a real AdSense unit exists — see index.html for why. -->
  <!--
  <div class="ad-slot">
    <div class="ad-frame" id="adFrame">Advertisement — 728×90 responsive slot (AdSense unit goes here)</div>
  </div>
  -->

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
      <button class="pro-link" id="qrBtn" style="margin-top:10px">Show QR code →</button>
      <div id="qrWrap" style="display:none;margin-top:10px">
        <img id="qrImg" width="160" height="160" alt="QR code for the sync link" style="background:#fff;padding:8px;border-radius:6px">
        <div class="hint" style="margin-top:6px">Generated on demand by a third-party QR API (goqr.me) — the only feature on this site that makes an external request. See <a href="/privacy" style="text-decoration:underline">Privacy</a>.</div>
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
  </section>
  ${p.extra || ""}
  ${faqHtml(p.faq)}
</main>

<footer>
  <div class="wrap">
    <div class="foot-links">
      ${timerLinks}
    </div>
    <div class="foot-in">
      <div><div class="fb">${BRAND}</div>A timer you can hand to a room. · <a href="/how-it-works">How It Works</a> · <a href="/about">About</a> · <a href="/compare">Vs. ShareMyTimer &amp; Stagetimer</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/contact">Contact</a> · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></div>
      <div>Sync accuracy depends on each device's clock — typically within a second.<br>No data leaves your browser; the timer lives entirely in the link.</div>
    </div>
  </div>
</footer>

<script>window.COUNTLINK_DEFAULT=${JSON.stringify({ minutes: p.minutes, label: p.label, ...(p.direction ? { direction: p.direction } : {}), ...(p.untilMonthDay ? { untilMonthDay: p.untilMonthDay } : {}) })};</script>
<script src="../assets/app.js" defer></script>
</body>
</html>
`;

const STATIC_PAGES = ["privacy.html", "compare.html", "about.html", "how-it-works.html", "terms.html", "contact.html"];

const sitemap = () => {
  const urls = PAGES.map(p => `  <url><loc>${SITE_URL}/timers/${p.slug}</loc><lastmod>${CONTENT_DATE}</lastmod></url>`).join("\n");
  const staticUrls = STATIC_PAGES.map(f => `  <url><loc>${SITE_URL}/${f.replace(/\.html$/, "")}</loc><lastmod>${CONTENT_DATE}</lastmod></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${CONTENT_DATE}</lastmod></url>
${staticUrls}
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

## Duration timers
${durationLines}

## Use-case timers
${useCaseLines}
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

  const llmsPath = join(ROOT, "llms.txt");
  await writeFile(llmsPath, llmsTxt(), "utf-8");
  console.log(`Wrote ${relative(ROOT, llmsPath)}`);

  await syncIndexFootLinks();
  console.log("\nTo rename or update the domain, run scripts/rename-brand.mjs (don't edit site-config.mjs by hand).");
}

main();
