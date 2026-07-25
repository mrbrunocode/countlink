/**
 * Editorial articles — the "proof" layer a tool site needs for AdSense /
 * E-E-A-T: standalone, long-form, genuinely useful pieces separate from the
 * timer pages. Rendered at /guides/<slug> with an author byline, and listed on
 * /guides (see scripts/build-timer-pages.mjs). Written to be genuinely helpful
 * and original, and to link naturally into the timers.
 *
 * Fields: slug, title, description (meta), date (ISO), read (min), excerpt,
 * bodyHtml (use <h2>/<h3>, <p>, lists; links to /timers/<slug> where relevant).
 */

// Author identity (E-E-A-T). The byline links to the developer's own site.
export const AUTHOR_NAME = "Bruno FK";
export const AUTHOR_URL = "https://brunofk.dev";
export const AUTHOR_BIO =
  "Bruno FK is an Edinburgh-based software developer who builds small, fast, privacy-respecting web tools. He built CountLink after watching too many meetings, classes and calls run over because nobody in the room could see the same clock.";

export const ARTICLES = [
  {
    slug: "put-a-timer-on-your-classroom-screen",
    title: "How to put a timer on your classroom screen",
    description:
      "Getting a countdown onto the interactive whiteboard, a smart TV, a projector, a Chromebook or an iPad — what actually works on each, and what to do when the screen keeps sleeping.",
    date: "2026-07-25",
    read: 7,
    excerpt:
      "The practical, device-by-device version: whiteboard, smart TV, projector, Chromebook, iPad — plus why the screen goes to sleep mid-lesson and how to stop it.",
    bodyHtml: `
    <p>Most advice about classroom timers assumes the hard part is choosing one. In practice the hard part is the ten minutes before the lesson, standing in front of a screen that won't cast, or an interactive whiteboard running a browser three versions out of date, or an iPad that dims to black the moment you stop touching it. This is the device-by-device version.</p>
    <p>The general principle first, because it makes every specific case easier: a countdown that lives entirely in a web link has nothing to install, nothing to log into, and nothing to pair. If a device has a browser and can open a URL, it can show the timer. That rules out almost none of the hardware in a school.</p>

    <h2>An interactive whiteboard or smart display</h2>
    <p>These usually run an embedded browser that's older than you'd like. Open the timer's link directly in it and use fullscreen — avoid anything that depends on newer browser features. If typing a long URL on a whiteboard is painful (it usually is), open the timer on your own laptop or phone first, then use the QR code: the board's browser won't help you there, but a pupil's device or your phone camera will, and you can email or AirDrop the link to yourself in a second.</p>
    <p>If the board's browser struggles, the fallback that always works is to display it from the teaching laptop that's already connected to the board, rather than from the board itself.</p>

    <h2>A smart TV</h2>
    <p>Two routes. If the TV has a usable browser (most Samsung and LG sets do), open the link and go fullscreen — this is the most reliable option because nothing depends on the network staying up afterwards. If the browser is unusable, cast or mirror from a laptop instead.</p>
    <p>Casting has one gotcha worth knowing: mirroring a tab shares whatever the laptop renders, so if the laptop sleeps or you switch tabs, the room loses the timer. Opening the link on the TV itself avoids that entirely.</p>

    <h2>A projector</h2>
    <p>A projector is showing whatever the connected computer shows, so the real question is what's driving it. Open the timer in a browser on that machine, press fullscreen, and — this is the part people skip — check the contrast from the back of the room. Projectors wash out pale colours badly. The board and minimal styles are both high-contrast for exactly this reason; the light style is the one to avoid on a dim projector.</p>

    <h2>Chromebooks</h2>
    <p>The easiest case. Open the link, press the fullscreen key. If you want every pupil to see their own copy — useful for individual tasks or exam conditions at separate desks — share the link through Classroom or your usual channel and they each open it. Because the end time is carried in the link itself, thirty Chromebooks opening it show the same countdown without any of them talking to each other or to a server.</p>

    <h2>iPads and tablets</h2>
    <p>Open in Safari and use the timer fullscreen. On iPads the thing that bites is auto-lock: the screen dims and sleeps partway through a task, which is maddening when it's the class clock. Two fixes — either add the timer to the home screen so it runs as an installed app, or set Auto-Lock to Never in Display &amp; Brightness for lessons where a tablet is acting as the display. The site also requests a screen wake lock where the browser supports it, which handles this automatically on most modern devices.</p>

    <h2>When the screen keeps going to sleep</h2>
    <p>This is the single most common complaint about any web-based classroom timer, and it isn't the timer's fault: operating systems dim and sleep displays to save power, and a page that isn't being touched looks idle to them. Modern browsers expose a wake lock that a page can request to prevent exactly this, which is what this timer does while a countdown is running. Where that isn't supported — older whiteboard browsers, mostly — set the device's own sleep timeout longer for the lesson, or keep the display awake by other means.</p>
    <p>Worth knowing: even if a screen does sleep, nothing is lost. The countdown's end time is fixed in the link rather than tracked by a running process, so waking the screen shows the correct remaining time immediately. It cannot drift or lose its place while the display is off.</p>

    <h2>Getting the same countdown onto several screens</h2>
    <p>This is where the shared link earns its keep. Whether it's the board plus every pupil's Chromebook, two classrooms doing the same assessment, or a hall where three displays face different directions, opening the same link on each shows the same countdown reaching zero at the same moment. There's no pairing step, no host device that everything else depends on, and no limit on how many screens can join — a fixed end time is just a fact that every device can read for itself.</p>
    <p>The trade-off is worth stating plainly: because there's no live connection, you can't push a pause or add two minutes to screens that already have the link open. For a lesson or an exam where the length is known in advance that rarely matters. If you need live mid-session control from your phone, a server-based timer does something this design deliberately doesn't — <a href="/compare">the comparison page</a> covers where each one fits.</p>

    <h2>A short pre-lesson checklist</h2>
    <ul>
      <li>Open the link on the display itself where possible, rather than casting.</li>
      <li>Go fullscreen, then check legibility from the back row.</li>
      <li>On a projector, avoid the light style.</li>
      <li>On an iPad acting as the display, install it to the home screen or disable auto-lock.</li>
      <li>If several screens need it, send the link — don't try to mirror one device to many.</li>
    </ul>`,
  },

  {
    slug: "timeboxing-meetings",
    title: "Timeboxing: how to run meetings that actually end on time",
    description:
      "Meetings overrun because time is invisible. Timeboxing — giving each part of a meeting a fixed, visible limit — is the simple fix. Here's how to do it well.",
    date: "2026-07-23",
    read: 6,
    excerpt:
      "Meetings overrun because time is invisible to the room. Timeboxing makes it visible — here's how to structure one so it ends when it should.",
    bodyHtml: `
    <p>Almost every meeting that overruns does so for the same reason: the passage of time is invisible to the people in the room. The clock is on someone's laptop, or nowhere, and the discussion expands to fill whatever space it's given — a phenomenon so reliable it has a name, Parkinson's law. Timeboxing is the antidote, and it's less about discipline than about design: you give each part of the meeting a fixed amount of time, make that limit visible to everyone, and let the visible clock do the enforcing that a person otherwise has to.</p>

    <h2>What timeboxing actually is</h2>
    <p>A timebox is a fixed, agreed period assigned to an activity. Instead of "let's discuss the budget" (open-ended, and therefore infinite), you say "we have fifteen minutes on the budget", and you hold to it. When the box is up, the topic ends — either resolved, or explicitly parked for later with an owner. The key shift is that the deadline is decided <em>before</em> the discussion starts, not discovered when you notice you're out of time.</p>

    <h2>Why a visible, shared clock changes behaviour</h2>
    <p>Here's the part people underestimate. A timebox that lives only in the organiser's head, or on their screen, does almost nothing — everyone else assumes there's slack, because they can't see otherwise. The moment the countdown is visible to the whole room, behaviour changes on its own. People wrap up their point as the number drops. Tangents get self-policed. Nobody has to be the villain who says "we need to move on", because the clock said it, neutrally, to everyone at once.</p>
    <p>That's the difference between a timer app on one laptop and a countdown the whole room can see. Put a <a href="/timers/30-minute-timer">shared countdown</a> on the projector, or share the link so every attendee has it on their own screen, and the timebox becomes a fact everyone is looking at rather than a rule one person is enforcing.</p>

    <h2>A simple structure that works</h2>
    <p>You don't need a rigid framework. A workable timeboxed meeting looks like this:</p>
    <ol>
      <li><strong>Set the total up front.</strong> "This is a 45-minute meeting" — and mean it. Ending on time is a promise, not an aspiration.</li>
      <li><strong>Break it into boxes with an agenda.</strong> Each item gets minutes, not just a name: "Updates — 10 min. Budget decision — 15 min. Risks — 10 min. Actions — 10 min." The numbers force you to be realistic about what actually fits.</li>
      <li><strong>Make the current box visible.</strong> Start the countdown for each item and put it where everyone can see it. When it runs low, that's the cue to land the decision.</li>
      <li><strong>Protect the last box for actions.</strong> The most common failure is running out of time before deciding who does what. Ring-fence the final few minutes for "who owns what, by when" and defend it.</li>
    </ol>

    <h2>What to do when a box runs out mid-discussion</h2>
    <p>The timebox ending doesn't mean the topic is finished — it means the <em>time you allocated</em> is finished, which is different and useful information. You have three honest choices: extend deliberately (agree to take five more minutes, knowingly, from somewhere else), park it (assign an owner and a follow-up, and move on), or make the call now with the information you have. What you must not do is let it silently overrun, because that's how the last three agenda items get compressed into "we're out of time, let's just email about it."</p>

    <h2>The habit, not the tool</h2>
    <p>Timeboxing works because it converts a vague social pressure ("we should wrap up") into a concrete, visible fact (a countdown at zero). The tool is trivial — any shared timer will do — but the habit is what pays off: decide the time before the discussion, make it visible to everyone, and treat the limit as real. Do that consistently and "this meeting could have been an email" stops being a complaint about your meetings, because the ones you do hold will start and, more importantly, actually end.</p>`,
  },
  {
    slug: "how-to-run-a-timed-exam",
    title: "How to run a fair timed exam or test",
    description:
      "Timing an exam sounds simple until you're doing it for a room. A practical guide to running a fair, unambiguous timed test — the clock, the announcements, the edge cases.",
    date: "2026-07-23",
    read: 6,
    excerpt:
      "A timed exam is only fair if everyone sees the same clock. Here's how to run one so no candidate can reasonably dispute how much time they had.",
    bodyHtml: `
    <p>Timing an exam seems trivial until you're responsible for a room full of people whose results depend on it. Then the details matter: everyone must have had the same time, everyone must have been able to see how much was left, and there can be no reasonable dispute afterward about when "pens down" actually was. A fair timed exam is less about a stopwatch and more about making the passage of time unambiguous and equal for every candidate.</p>

    <h2>The core principle: one clock, visible to all</h2>
    <p>The foundation of a fair timed test is that every candidate is working against the <em>same</em> clock, and can see it. A single official countdown displayed at the front of the room — ideally large and high-contrast — removes the two things that cause disputes: candidates who lose track of time because they can't see a clock, and any suggestion that different people had different amounts of time. If your setting allows candidate devices, sharing a link to the <a href="/timers/exam-timer">same countdown</a> so each person can also see it on their own screen removes even the "I couldn't see the front" objection.</p>

    <h2>Set it up before anyone starts</h2>
    <ul>
      <li><strong>Decide the exact duration</strong> and any reading time separately. If there's a 10-minute reading period before writing, that's its own box — don't fold it into the main clock.</li>
      <li><strong>Display the clock large and legible.</strong> In a bright hall, a dark-on-light display reads far better from the back than light-on-dark; a high-contrast board style is worth choosing deliberately.</li>
      <li><strong>Start it at the announced moment, not before.</strong> The countdown should begin exactly when you say "you may begin", so the visible clock and the official time are the same thing.</li>
    </ul>

    <h2>Announce the milestones</h2>
    <p>Even with a visible clock, verbal time checks at the conventional points reduce anxiety and remove excuses: typically at the halfway mark, then at "30 minutes remaining", "10 minutes remaining", and "5 minutes remaining", and finally a clear "pens down" or "stop writing now". These announcements are a courtesy and a fairness measure — a candidate who was deep in a question and lost track still gets fair warning. The visible countdown and your announcements should always agree, which is another reason to run one authoritative clock rather than glancing at your watch.</p>

    <h2>Plan for the edge cases</h2>
    <p>Timed exams have predictable failure modes; decide your policy before they happen, not during:</p>
    <ul>
      <li><strong>A late start.</strong> If the exam starts late for reasons outside candidates' control, decide up front whether the finish time shifts to preserve the full duration. A countdown makes this clean — you started it when they actually began, so it already reflects the real time remaining.</li>
      <li><strong>Extra-time arrangements.</strong> Candidates with approved extra time need their own clock ending at their own time. A separate shared countdown per group handles this without mental arithmetic.</li>
      <li><strong>A technical wobble.</strong> Because a link-based countdown calculates the remaining time from a fixed end moment rather than a live connection, a brief Wi-Fi drop or a projector blink doesn't lose the count — any screen that already loaded the page keeps showing the correct time.</li>
    </ul>

    <h2>Why "everyone saw the same clock" is the whole game</h2>
    <p>Every complaint about a timed exam ultimately reduces to a disagreement about time: I didn't know how long was left, I had less time than someone else, the clock at the front was wrong. Running one authoritative countdown that every candidate can see — and, where allowed, open on their own device — closes off all three. It's a small operational choice that turns "how much time did I have?" from a question anyone needs to ask into something everyone could already see for themselves.</p>`,
  },
  {
    slug: "the-pomodoro-technique",
    title: "The Pomodoro Technique, explained — and how to do it as a group",
    description:
      "The Pomodoro Technique in practice: why 25-minute focus blocks work, how to run them, common mistakes, and how to keep a whole study group or team in sync.",
    date: "2026-07-23",
    read: 6,
    excerpt:
      "25 minutes of focus, then a short break, repeated. Simple — but the details matter, and doing it as a group needs everyone on the same clock.",
    bodyHtml: `
    <p>The Pomodoro Technique is one of those productivity methods that's genuinely useful precisely because it's simple: work in focused blocks of about 25 minutes, take a short break, repeat. It was devised by Francesco Cirillo in the late 1980s (named after the tomato-shaped kitchen timer he used — <em>pomodoro</em> is Italian for tomato), and its staying power comes from the psychology underneath it. Here's how it works, why, and how to run it with other people.</p>

    <h2>The basic rhythm</h2>
    <p>One "pomodoro" is a single unbroken 25-minute block of focus on one task, followed by a 5-minute break. After four pomodoros, you take a longer break — 15 to 30 minutes. That's the whole method:</p>
    <ol>
      <li>Pick one task.</li>
      <li>Set a timer for 25 minutes and work on only that until it rings.</li>
      <li>Take a 5-minute break — properly away from the work.</li>
      <li>Every fourth cycle, take a longer break.</li>
    </ol>

    <h2>Why 25 minutes works</h2>
    <p>The length isn't arbitrary. Twenty-five minutes is long enough to make real progress but short enough that starting doesn't feel like a commitment — which is the whole battle, because the hardest part of focused work is usually beginning. "I'll work for 25 minutes" is a much easier promise to make yourself than "I'll work on this until it's done." The fixed end also creates a mild, useful urgency: a deadline you can see tends to pull attention forward and keep it from wandering. And the enforced breaks matter as much as the focus blocks — they're what make the method sustainable across a whole day instead of burning you out by lunch.</p>

    <h2>The common mistakes</h2>
    <ul>
      <li><strong>Skipping the break because you're "in flow."</strong> Tempting, but the breaks are load-bearing — they're what let you do the next block, and the one after. If you're genuinely deep in flow, finishing the thought is fine; making a habit of skipping breaks is how the method stops working by mid-afternoon.</li>
      <li><strong>Letting the block be interrupted.</strong> A pomodoro is meant to be unbroken. If something urgent genuinely can't wait, the honest move is to end the pomodoro and start fresh later, not to pause halfway and pretend it counted.</li>
      <li><strong>Multitasking within a block.</strong> One task per pomodoro. Checking messages "quickly" mid-block defeats the entire point.</li>
      <li><strong>Treating 25 as sacred.</strong> It's a starting point. Some people work better on 50/10. Use what fits — the rhythm matters more than the exact number.</li>
    </ul>

    <h2>Doing it as a group</h2>
    <p>Pomodoro is effective solo and even better with company — a study group, a co-working room, a "study with me" stream, or a team doing focused work together. The catch is that the benefit depends on everyone being on the <em>same</em> block: the point is that you all focus together and, crucially, break together, so the room stays in phase instead of one person breaking while another is mid-flow.</p>
    <p>That only works if everyone sees the same clock. Rather than each person running their own timer (which drift apart within minutes), one person runs a <a href="/timers/pomodoro-timer">shared 25-minute countdown</a> and shares the link — everyone opens it and sees the identical time remaining down to the second. At zero, start the break timer and share that. It turns a solo discipline into a shared rhythm, which for a lot of people is exactly what makes it stick.</p>

    <h2>The takeaway</h2>
    <p>The Pomodoro Technique works because it makes starting easy, makes focus finite and visible, and builds in the recovery that keeps you going. Do it solo when you need to grind through your own list; do it as a group, on one shared clock, when you want the accountability and rhythm of focusing alongside other people. Either way, the tomato timer is doing something subtle: turning "I should focus" into a concrete 25-minute box you can actually see close.</p>`,
  },
  {
    slug: "running-short-standups",
    title: "How to run a daily standup that stays short",
    description:
      "Daily standups balloon into status meetings when nobody watches the clock. A practical guide to keeping them short, focused and actually useful.",
    date: "2026-07-23",
    read: 5,
    excerpt:
      "Standups balloon into status meetings the moment nobody's watching the clock. Here's how to keep the daily short, focused, and worth showing up to.",
    bodyHtml: `
    <p>The daily standup has a simple promise — a short, daily sync to surface blockers and keep a team aligned — and a reliable failure mode: it swells into a rambling status meeting that everyone quietly resents. The name itself was the original fix (you stand up so it stays short), but remote work removed the physical discomfort that kept things moving. Keeping a standup genuinely short takes a little structure and, more than anything, a visible clock.</p>

    <h2>What a standup is for (and isn't)</h2>
    <p>A standup is for alignment and unblocking, not for solving problems. The classic three prompts — what did I do, what will I do, what's in my way — exist to surface information quickly, not to work through it. The single biggest cause of overrun is treating standup as the place to <em>solve</em> the problem someone just raised, dragging the whole team into a debugging session two of them care about. The discipline is to name the blocker and take the solution offline.</p>

    <h2>Make the clock visible</h2>
    <p>Standups overrun for the same reason all meetings do: nobody can see the time, so nobody self-regulates. Put a <a href="/timers/standup-timer">shared countdown</a> where the whole team can see it — on the call, or pasted into the channel — and the dynamic shifts. People wrap their update as the number drops, because the pressure comes from a shared fact rather than from someone having to play timekeeper. A rough target: for a team of six aiming at ten minutes, that's about a minute each with a little slack. If you're halfway down the clock with more than half the team still to go, that's your signal to tighten up.</p>

    <h2>A few habits that keep it tight</h2>
    <ul>
      <li><strong>Same time, every day.</strong> Predictability is what makes a daily sustainable. A standup that moves around gets skipped.</li>
      <li><strong>Have an order.</strong> Going round in a known sequence (or letting people "pass the ball") removes the awkward "who's next?" dead air that eats minutes.</li>
      <li><strong>"Let's take that offline" is a feature.</strong> The most valuable phrase in a standup. When a topic clearly concerns two people, park it for a follow-up and keep the round moving. Nobody else should be held hostage to it.</li>
      <li><strong>Blockers first.</strong> If time is tight, the "what's in my way" part is the bit that actually matters — it's why the meeting exists. Protect it.</li>
      <li><strong>Skip it when there's nothing to sync.</strong> A standup held out of ritual when the team already knows where everything stands is just tax. It's fine to cancel one.</li>
    </ul>

    <h2>Remote standups need the clock even more</h2>
    <p>In person, body language regulates a standup — people shift, glance at the door, and the speaker feels it. On a video call none of that transmits, so a rambling update meets total silence and keeps going. That makes a visible shared timer more important remotely, not less: it restores the ambient "we're running long" signal that the room used to provide for free. Share the link so every remote and in-office teammate sees the identical countdown, and the meeting keeps its shape regardless of where people are sitting.</p>

    <h2>The point of keeping it short</h2>
    <p>A tight standup isn't about saving ten minutes — it's about the meeting staying worth attending. The moment it becomes a bloated status recital, people mentally check out, stop listening to each other, and the alignment it was supposed to create evaporates. Short and focused is what keeps it a genuine sync rather than a daily obligation everyone endures. A visible clock, a bias toward blockers, and a healthy habit of taking things offline are most of what it takes.</p>`,
  },
  {
    slug: "using-timers-in-the-classroom",
    title: "Using timers in the classroom: a practical guide for teachers",
    description:
      "A visible countdown is one of the simplest classroom-management tools there is. How to use timers well for transitions, group work, tests and focus — by age group.",
    date: "2026-07-23",
    read: 6,
    excerpt:
      "A visible countdown quietly ends the “how much longer?” questions and smooths transitions. Here's how to use classroom timers well, by age group.",
    bodyHtml: `
    <p>A visible timer is one of the highest-value, lowest-effort tools in a teacher's kit. It does something a teacher's voice can't do sustainably: it holds the time for the whole room, continuously and neutrally, so "how much longer?" stops being a question anyone needs to ask. Used well, a countdown smooths transitions, keeps group work on track, makes expectations concrete, and quietly removes a whole category of low-level friction. Here's how to get the most out of it.</p>

    <h2>Why a visible countdown works</h2>
    <p>Children (and adults) manage their effort better when they can see how much time is left. A visible countdown turns an abstract instruction ("you have a few minutes") into something concrete everyone can pace themselves against. It also depersonalises time pressure: the class isn't being hurried by the teacher, they're responding to a clock everyone can see, which lands very differently and reduces the "but you didn't warn us" friction. Projecting a <a href="/timers/classroom-timer">shared countdown</a> at the front — or, if students have devices, sharing the link so they see the identical time on their own screens — makes the time a shared fact rather than something only you're tracking.</p>

    <h2>Match the length to the age group</h2>
    <p>The right countdown length changes dramatically with age — a timer that motivates one group patronises or overwhelms another.</p>
    <ul>
      <li><strong>Early years / lower primary (roughly ages 5–8):</strong> short and frequent. 60 seconds for "tidy your table", 2–5 minutes for a transition or a focused burst. Long countdowns lose younger children; several short ones hold attention far better than one long block.</li>
      <li><strong>Upper primary / middle (ages 9–13):</strong> 10–15 minutes for group work or a worksheet, with the timer visible the whole time so students self-pace instead of asking how long is left every few minutes.</li>
      <li><strong>Secondary (14+):</strong> 20–50 minutes for sustained work, quizzes or exam practice. Here legibility from the back of the room matters, and a high-contrast display earns its keep.</li>
    </ul>

    <h2>Where timers help most</h2>
    <ul>
      <li><strong>Transitions.</strong> The gaps between activities are where time leaks. A short visible countdown ("two minutes to pack up and be ready") makes the transition a game against the clock rather than a slow drift.</li>
      <li><strong>Group and station work.</strong> When several groups work in parallel, one shared timer keeps them finishing together instead of one table drifting five minutes past because they were watching a different clock.</li>
      <li><strong>Silent / focused work.</strong> A countdown gives a definite, visible endpoint, which helps students settle in knowing exactly how long the effort lasts.</li>
      <li><strong>Tests and timed practice.</strong> A single authoritative clock everyone can see is the fairest way to run a timed assessment.</li>
    </ul>

    <h2>Practical tips</h2>
    <p>A few things that make classroom timers work better in practice. In a brightly-lit room a dark-on-light display reads far more clearly from the back than light-on-dark — choose the high-contrast style deliberately. Use the timer <em>with</em> a verbal cue at the start ("when this reaches zero, we move on") so the expectation is set, not sprung. And keep it low-stakes: the countdown is a pacing aid, not a punishment. For younger classes especially, a timer running out should feel like a friendly "time's up!", not a penalty — the goal is to build the habit of watching the clock, not anxiety about it.</p>

    <h2>The quiet win</h2>
    <p>None of this is dramatic, which is the point. A visible classroom timer removes dozens of tiny interruptions a day — the time checks, the "how long left?", the groups finishing at different moments — and hands that management to a clock everyone can see. It frees you to teach instead of timekeep, and it gives students a bit of agency over their own pace. Small tool, outsized effect.</p>`,
  },
  {
    slug: "facilitating-workshops-to-time",
    title: "Facilitating a workshop to time without herding people",
    description:
      "Keeping a workshop on schedule is a facilitator's hardest job. How to plan realistic timings, run breakout groups that finish together, and stay on track.",
    date: "2026-07-23",
    read: 5,
    excerpt:
      "The hardest part of facilitating isn't the content — it's the clock. How to plan timings that hold and keep breakout groups finishing together.",
    bodyHtml: `
    <p>Ask any experienced facilitator what's hardest about running a workshop and it usually isn't the content — it's the time. Sessions overrun, breakout groups finish at wildly different moments, one exercise eats the slot meant for three, and you arrive at the important closing discussion with four minutes left. Facilitating to time is a real skill, and most of it is preparation plus a couple of habits that stop time from getting away from you in the room.</p>

    <h2>Plan timings that are actually realistic</h2>
    <p>Most overruns are baked in before the workshop starts, because the plan was optimistic. Two rules help. First, everything takes longer than you think — instructions, questions, the slow group, the tech hiccup. Add buffer, and be ruthless about what actually fits; a workshop that tries to do too much does all of it badly. Second, give each segment a specific number of minutes, not just a name. Writing "Ideation — 20 min, Clustering — 15 min, Prioritisation — 15 min" forces the realism that "Ideation, then clustering, then prioritise" lets you dodge.</p>

    <h2>The breakout-group problem</h2>
    <p>The single most common time failure in workshops is uneven breakout groups: you send everyone off for "fifteen minutes", and one group is done in eight while another is still going at twenty, because each is glancing at a different phone or nobody's watching at all. The result is dead time for some and a rushed cut-off for others.</p>
    <p>The fix is a single shared clock. Rather than announcing "you've got fifteen minutes" and hoping, run one <a href="/timers/workshop-timer">countdown that every group can see</a> — projected on the main screen, and shared as a link so each table has it on a device too. Now every group counts down from the same number and lands together, and you're not shouting "two more minutes!" across a noisy room. A useful trick: give breakouts slightly less time than feels comfortable — groups expand to fill whatever they're given, and a tight, visible clock keeps the energy up.</p>

    <h2>Habits that keep you on track in the room</h2>
    <ul>
      <li><strong>Show the clock, don't police it.</strong> A visible countdown does the time-keeping so you don't have to be the person constantly saying "we should move on" — the clock says it, neutrally, and you stay the facilitator rather than the timekeeper.</li>
      <li><strong>Timebox discussions explicitly.</strong> "We've got ten minutes on this" before a discussion starts is far more effective than trying to wind one down after it's sprawled.</li>
      <li><strong>Know your flex points.</strong> Decide in advance which segments are essential and which can be trimmed if you fall behind, so you're cutting deliberately rather than panicking.</li>
      <li><strong>Protect the close.</strong> The synthesis, the decisions, the next steps — the part that makes the workshop worth having — belongs at the end and is the first thing sacrificed when you overrun. Ring-fence it.</li>
    </ul>

    <h2>Between segments</h2>
    <p>Transitions and breaks are where workshop time quietly leaks — a "ten-minute break" becomes twenty, and the afternoon compresses. A visible countdown for breaks helps as much as it does for exercises: put the return time on screen so people can see it, and start the next segment when it hits zero. It's a small thing that keeps a full-day session from sliding by mid-afternoon.</p>

    <h2>The facilitator's real job</h2>
    <p>Running to time isn't about rigidity — a good facilitator flexes constantly. It's about staying in control of the time rather than being surprised by it: realistic plans, explicit timeboxes, a shared clock everyone can see, and a protected close. Get those right and you spend the workshop facilitating the actual work, instead of anxiously watching the schedule slip away from you.</p>`,
  },
  {
    slug: "interval-training-timing",
    title: "Interval training timing explained: Tabata, HIIT and boxing rounds",
    description:
      "Work, rest, repeat — but the exact numbers define the workout. A guide to interval training timing, from Tabata to boxing rounds, and why a shared clock helps.",
    date: "2026-07-23",
    read: 6,
    excerpt:
      "Work hard, rest, repeat — but the exact work/rest numbers define the whole session. A guide to interval timing, from Tabata to boxing rounds.",
    bodyHtml: `
    <p>Interval training — alternating hard effort with rest — is one of the most time-efficient ways to train, and the entire method lives or dies on its timing. The work length, the rest length, and the number of rounds aren't details; they <em>are</em> the workout. Get them right and you get the intended stimulus; get them wrong and you're doing a different session than you think. Here's how the common interval formats are timed, and why a clear, shared clock matters more here than almost anywhere else.</p>

    <h2>Why the numbers matter so much</h2>
    <p>In steady exercise you can be vague about time. In intervals you can't, because the ratio of work to rest determines what system you're training and how hard it actually is. Shorten the rest and the same "work" becomes far more demanding; lengthen it and the intensity drops. That's why interval protocols are described so precisely — "20 seconds on, 10 seconds off, 8 rounds" is a specific, repeatable prescription, and changing any number changes the workout.</p>

    <h2>The classic formats</h2>
    <ul>
      <li><strong>Tabata.</strong> The famous one: <strong>20 seconds of maximum effort, 10 seconds of rest, 8 rounds</strong> — about 4 minutes total. It comes from Dr. Izumi Tabata's 1996 research, and the short, brutal ratio is the whole point; the near-2:1 work-to-rest is what makes those four minutes so hard. A <a href="/timers/tabata-timer">Tabata timer</a> defaults to exactly this protocol.</li>
      <li><strong>General HIIT.</strong> "High-intensity interval training" is a broad family, not one protocol — common splits include 30/30, 40/20, or 1 minute on / 1 minute off, for anywhere from 10 to 30 minutes. A flexible <a href="/timers/interval-timer">interval timer</a> where you set your own work, rest and round count fits this, since there's no fixed formula.</li>
      <li><strong>Boxing / combat rounds.</strong> Standard boxing is <strong>3-minute rounds with 1-minute rests</strong>, typically 12 rounds for a full session; other combat sports and amateur bouts use shorter rounds. A <a href="/timers/boxing-round-timer">round timer</a> handles the longer work periods and the between-round rest.</li>
      <li><strong>EMOM ("every minute on the minute").</strong> A different structure: at the top of each minute you do a set amount of work, and whatever time is left is your rest, so working faster earns more recovery.</li>
    </ul>

    <h2>The problem with everyone timing themselves</h2>
    <p>Interval training in a group — a class, a gym floor, partners doing rounds — falls apart if everyone runs their own timer. They drift within a couple of rounds, and suddenly half the room is working while the other half is resting, which defeats the shared intensity and makes coaching impossible. The person leading can't cue "last ten seconds!" if nobody's on the same ten seconds.</p>
    <p>The fix is one clock everyone follows. A coach's screen and every participant's own device showing the identical round and phase keeps the whole group moving together — you all hit "work" at the same instant and "rest" at the same instant. Because a link-based timer calculates the current round from a fixed start moment rather than a live connection, every device that opened the link stays in sync on its own, with no server keeping them aligned and no drift to accumulate.</p>

    <h2>Getting your intervals right</h2>
    <p>A few practical notes. Start conservative on the rest — beginners almost always underestimate how much the intensity climbs as fatigue builds across rounds, and too little rest turns "high intensity" into "moderate intensity done badly". Match the format to the goal: very short, maximal intervals (Tabata) train one thing; longer work periods with fuller rest train another. And whatever numbers you choose, make them visible — trying to track "was that the fifth or sixth round?" in your head mid-effort is exactly when people lose count. A clear countdown showing the current phase and round takes that cognitive load off, so you can put everything into the work instead of the timekeeping.</p>`,
  },
];
