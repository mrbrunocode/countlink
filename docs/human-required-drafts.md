# Drafted copy for human-required posts

Everything in this file is a **draft only** — per `docs/seo-outreach-plan.md`,
posting/sending stays with Bruno. An agent may prepare copy but must not
submit it. Nothing here has been posted anywhere.

---

## Answering existing threads — prefer this to launch posts (added 2026-09-26)

**Why:** ChatGPT sends 492 of 494 AI-assistant sessions, and published
analyses of ChatGPT's citations in 2026 agree it leans heavily on Reddit (and
Wikipedia, review sites) for "what tool should I use" questions — more than on
any one site's own pages. A handful of genuinely useful, disclosed answers in
threads where people are *already asking* is the most durable mention there
is: it's the kind of text assistants quote, and unlike a launch post it keeps
getting found. Bing's AI Performance report (checked 2026-09-26) shows where
the demand already is — Copilot's grounding queries for this site are
"shared timer" (40 citations, 26% share), "group timer" (16, 29%) and a
Twitch cluster: "twitch timer countdown" (18, 19%), "countdown timer for
twitch" (10, 14%), "timer link for stream" (6, 19%).

**How, so it helps rather than gets removed:**
- Search the sub for the question first (r/Twitch, r/obs, r/streaming,
  r/Teachers, r/remotework): "countdown overlay", "starting soon timer",
  "shared timer", "timer everyone can see". Answer threads under ~6 months
  old that are still open.
- **Always disclose** — "I made this" in the first line. Undisclosed
  self-promotion gets removed and the account flagged; disclosed and useful
  is usually welcome. Follow each sub's self-promo rule (many use roughly
  "no more than 1 in 10 of your posts").
- Answer the question they asked first. Mention CountLink only where it
  genuinely fits, alongside the other good options (Stream Elements, OBS's
  own text source, ShareMyTimer) — a one-tool answer reads as an ad.
- One reply per thread; never paste the same text twice.

**Draft — OBS/Twitch "how do I add a starting soon countdown?"**

> The simplest no-plugin way is a Browser Source pointed at a countdown page
> with a transparent background. Disclosure: I made one — countlink.app —
> but the method works with any of them.
>
> 1. Sources → + → Browser.
> 2. URL: `https://countlink.app/embed/?overlay=1#for=10m&go=1` (change `10m`
>    to your length; it starts when the scene loads).
> 3. Size about 400×160, and style it with the source's own CSS box if you
>    want a different font colour.
>
> No account, no watermark, and nothing to install. If you'd rather have mods
> see the same countdown on their own screens, start one on the site and send
> them the link instead — every screen shows the same second. StreamElements'
> countdown widget is the other good option if you already use their overlays.

**Draft — "timer everyone on the call / in the room can see"**

> If the problem is everyone seeing the *same* time (not a screen-share that
> drops when you switch windows), a shared-link timer works well: you start it
> once and paste the link in the chat, and every device counts to the same
> instant. Disclosure: I built countlink.app for exactly this — free, no
> accounts, no viewer cap. ShareMyTimer does something similar with a live
> server and a free-tier device limit; Stagetimer is the pro option for
> events with a producer.

---

## Show HN (news.ycombinator.com/submit)

**Title** (HN strips "Show HN:" formatting oddities, keep it plain and factual —
no hype words, no emoji, this audience punishes marketing tone):

> Show HN: CountLink – a shared countdown timer with no backend

**URL:** https://countlink.app

**First comment** (post immediately after submitting, from your own account):

> I built this because every "shared countdown timer" I found needed an
> account, a server, or both — and the actual problem doesn't need either.
>
> The deadline is a timestamp encoded directly in the share URL. Anyone who
> opens the link computes the same countdown locally — no polling, no
> websocket, no backend keeping timers in sync. It's a static site.
>
> Built it originally for a workshop where "wait, is your timer thirty
> seconds ahead of mine?" kept derailing things. Now it's also getting used
> for classroom exams, webinars, and OBS stream overlays (there's a
> transparent-background fullscreen mode for that).
>
> Curious what people think of the URL-as-state approach vs. the more common
> "spin up a Firebase/Supabase realtime channel" way of doing shared state —
> felt like massive overkill for something this simple, but happy to be told
> I'm missing a case where it breaks down.

**Before posting:** pick a day/time you can actually watch and reply for the
first 1–2 hours (that's most of HN's value — a maker who engages beats a
maker who doesn't, regardless of the product). Don't cross-post to Reddit the
same day; if both pop at once it reads as a coordinated launch, not organic.

---

## r/SideProject

**Title:**

> Built a shared countdown timer that needs no account or server — the link *is* the sync

**Body:**

> Every "shared countdown" tool I tried wanted a signup or ran a backend to
> keep clients in sync. CountLink encodes the target time in the URL itself,
> so every device that opens the link computes the identical countdown
> client-side — no server round-trips after the page loads.
>
> Free, no signup, no ads on the timer itself (there's one small ad below it
> to keep the lights on). Built it for a workshop, people have started using
> it for classroom exams and OBS stream overlays too.
>
> https://countlink.app
>
> Would love feedback — especially if anyone can think of a use case where
> the "no backend, no accounts" approach actually falls short vs. the usual
> realtime-database way of doing this.

*r/SideProject is generally tolerant of "I built X" posts — keep the founder
voice, that's expected here.*

---

## r/InternetIsBeautiful

**Note before drafting further:** this sub is genuinely strict about
self-promotion — many "I made this" posts get removed on sight regardless of
quality, and some subs like this require messaging the mods for pre-approval
before a maker posts their own creation. **Check the current sidebar/rules
and consider messaging mods first** rather than posting cold; if their rules
require someone *other than the maker* to submit it, that changes who should
post this, not just what it says.

**Title** (if posting directly is allowed):

> A shared countdown timer where the link itself is the sync — no account, no server

**Body:** keep it minimal for this sub — the title + link is often enough;
long promotional text tends to get removed here regardless of tone.

> https://countlink.app — set a countdown, get a link, everyone who opens it
> sees the exact same countdown. No signup. The sync works because the
> target time is embedded in the URL, not stored server-side.

---

## r/Teachers / r/Professors

**Different framing per the ledger note** — lead with the classroom problem,
not the launch. Don't call it "my project" as the headline.

**Title:**

> Free tool for a synced classroom timer — no accounts for you or students, works on the projector + every student device at once

**Body:**

> Sharing this in case it's useful — a free countdown timer where you get one
> link, and every screen that opens it (projector, Chromebooks, phones) shows
> the *exact same* countdown, synced automatically. No login for you or your
> students, no per-student account, nothing to install.
>
> There's a fullscreen "board" display style that's readable from the back of
> a room, and a light theme if you're projecting in a bright classroom.
>
> https://countlink.app/timers/classroom-timer has grade-band suggestions
> (K-5 / middle / high school) for what to actually time if that's useful.
>
> Not trying to sell anything — genuinely free, one small ad below the timer
> is how it stays free with no accounts. Happy to answer questions if anyone
> tries it and hits a snag.

*Read the current subreddit rules before posting — some teacher subs want
tools framed as a question/discussion ("has anyone used X for Y") rather than
a direct share. Adjust the opener if so, keep the tool description as-is.*

---

## Blog roundup outreach — candidate posts found (2026-07-16)

Real, currently-live "best free classroom/countdown timer" roundups that
don't yet feature CountLink. Personalized email template below; **fill in
the actual author name + contact email from each site's own about/contact
page before sending** — didn't scrape those, and a genuinely personalized
opener needs the real name, not a placeholder that stays a placeholder.

1. **https://www.toolsjam.co/blog/best-timers-for-classrooms** — "Best Online
   Timers for Classrooms in 2026," published March 2026, closest exact-fit
   competitor list, actively maintained (recent date).
2. **https://www.teachersresourceforce.com/blog/awesome-countdown-timers-for-the-classroom**
   — individual teacher-blogger, personal site, plausible personal reply.
3. **https://lauracandler.com/fun-countdown-timers/** — well-known,
   long-running teacher-resources blog; high-trust placement if they add it.
4. **https://blog.tcea.org/countdown-timers/** and
   **https://blog.tcea.org/online-timers/** — Texas Computer Education
   Association's blog, two separate existing posts on this exact topic.
   Higher-authority target (org blog, not individual) — worth a slightly
   more formal tone if reaching out here vs. the individual bloggers above.

**Email template** (customize the bracketed parts per recipient — send each
individually, do not mail-merge/bulk-send, per the ledger's own note on why
that risks the sending domain's deliverability):

> Subject: A no-signup shared timer for your [classroom timer / countdown
> timer] roundup
>
> Hi [Name],
>
> I came across your post on [exact post title] — [one genuine, specific
> sentence about something in their post, not generic flattery].
>
> I built a free countdown timer that might be a fit for the list:
> countlink.app. The angle that's different from the others: the countdown
> target is encoded in the share link itself, so opening the link on a
> projector and every student's device shows the exact same synced
> countdown — no account for you, nothing for students to sign into. There's
> also a classroom-specific page with grade-band suggestions:
> countlink.app/timers/classroom-timer.
>
> No pressure either way — just thought it might genuinely fit given what
> you're already covering. Thanks for the post, it's a good list.
>
> [Your name]

**Before sending any of these:** re-read the source post to confirm it's
still actively maintained (some "2026" dates are just annual title bumps on
stale content) and that adding a link is even something they do (some
roundups are closed lists, not accepting submissions) — a quick skim of the
post itself usually makes this obvious.
