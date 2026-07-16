# Drafted copy for human-required posts

Everything in this file is a **draft only** — per `docs/seo-outreach-plan.md`,
posting/sending stays with Bruno. An agent may prepare copy but must not
submit it. Nothing here has been posted anywhere.

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

> Free tool for a synced classroom timer — no accounts, no ads for students, works on the projector + every student device at once

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
