/**
 * Head-to-head comparison pages, rendered at /vs/<slug>.
 *
 * WHY THESE EXIST
 * ---------------
 * "X alternative" and "X vs Y" are the queries where a small site can beat a
 * bigger one, because the bigger one will not write the page: nobody publishes
 * an honest comparison in which they sometimes lose. CountdownShare runs this
 * play against Stagetimer and it ranks. It is also the one form of SEO where a
 * competitor's own marketing spend feeds our page — every person they teach to
 * search their brand is a person who can find this.
 *
 * WHY THIS IS FOUR PAGES AND NOT MORE, given the indexation wall
 * -------------------------------------------------------------
 * 42 of 45 URLs sit in "Discovered – currently not indexed" with 1 referring
 * domain, which is why eight duration pages were culled on 2026-07-29 and why
 * the meeting-timer work was cut from seven pages to one hub. The difference
 * here is intent, not volume: a `/vs/` page answers a question no other page
 * on this site answers, for a searcher who already has a specific product in
 * mind. /compare stays the multi-way hub and links to all four, so this is a
 * cluster with a root rather than four orphans. Do not add a /vs/ index — that
 * would be a fifth URL doing /compare's job.
 *
 * THE RULES FOR WRITING ONE — these are what make the page worth reading, and
 * they are not negotiable for SEO reasons:
 *
 * 1. **Every number is verified against the vendor's own pricing page, and
 *    dated.** `verified` below is the date someone actually looked. Prices
 *    move; a stale claim about a competitor's price is both a credibility
 *    problem and unfair to them. Re-check before editing any of these.
 * 2. **`theyWin` is mandatory and must be specific.** A comparison page where
 *    the author wins every row is an advert, and reads as one. Each of these
 *    names real things the competitor does better, including cases where the
 *    honest recommendation is to use them instead — see the Stagetimer and
 *    CountdownShare pages, which both end by telling a whole category of
 *    reader to go elsewhere.
 * 3. **No adjectives about the competitor.** State what their product does and
 *    what it costs. "Their free tier stops at three viewers" is a fact;
 *    "crippled free tier" is a slur. This site's whole credibility with an AI
 *    summariser rests on being quotable, and hostile copy is not quotable.
 * 4. **Never their copy, screenshots, or branding.** Facts only, in our words.
 */

export const COMPARISONS = [
  {
    slug: "sharemytimer",
    name: "ShareMyTimer",
    site: "https://www.sharemytimer.live/",
    pricingUrl: "https://www.sharemytimer.live/payment",
    verified: "2026-09-12",
    title: "CountLink vs ShareMyTimer — Free Shared Timer Comparison",
    meta: "CountLink vs ShareMyTimer, compared on price, viewer limits and features. ShareMyTimer's free tier stops at 3 viewers and charges $6/mo for sound alerts; CountLink is unlimited and free. Verified against their pricing page.",
    h1: "CountLink vs ShareMyTimer",
    lede: "The closest comparison there is — both do one shared countdown on every screen. The difference is architectural, and it decides everything about the pricing.",
    /* The one-paragraph answer, first, because most people reading a
       comparison page want the verdict and not the table. */
    verdict: `<p>If you want a countdown that a group watches together and you would rather not pay or sign up, CountLink does everything ShareMyTimer's $6/month Pro tier does, for nothing, with no cap on how many people watch. If you want live pause-and-adjust control pushed to viewers with no setup step at all, and you want it from a native iOS app, ShareMyTimer is the more finished product in that specific respect.</p>`,
    rows: [
      ["Price", "Free, permanently. No paid tier exists.", "Free tier; Pro $6/month; Single Event $9 one-time (15 days)"],
      ["Account required", "No — there is nothing to sign up for", "No signup for the free tier"],
      ["Viewers", "Unlimited", "3 free · 90 on Pro · 150 on Single Event"],
      ["Timers", "Unlimited", "3 free · 20 on Pro · 100 on Single Event"],
      ["Sound alerts", "Free", "Pro and Single Event only"],
      ["Live pause / adjust pushed to viewers", "Free, unlimited screens — opt in before starting", "Yes, on every tier"],
      ["Message to every viewer", "Free (flash message, via phone control)", "Yes, including on the free tier"],
      ["Join code", "Free — five characters, e.g. /j/K3M7Q", "Yes"],
      ["QR code", "Free", "Yes"],
      ["Count up / stopwatch", "Free", "Yes"],
      ["OBS / stream overlay", "Free, transparent, no watermark", "Yes, including on the free tier"],
      ["Website embed (iframe)", "Free, no watermark", "Not offered"],
      ["Agenda of named segments", "Free", "Not offered"],
      ["Interval / round timer", "Free", "Not offered"],
      ["Calendar (.ics) export", "Free", "Not offered"],
      ["MCP server for AI assistants", "Yes — countlink.app/mcp", "Not offered"],
      ["Native iOS app", "No — installable web app instead", "Yes"],
      ["Can the service go down mid-countdown?", "There is no server to go down", "Sync runs through their servers"],
    ],
    theyWinHtml: `
    <p><b>Live control with no setup step.</b> ShareMyTimer is built around a
    controller/viewer split, so pause, resume and adjust reach every viewer by
    default. CountLink can do the same thing — and does not charge for it or
    cap the screens it reaches — but you have to tick <b>phone control</b>
    <i>before</i> you start the countdown. Forget to tick it and the countdown
    is fixed, because there is no connection to send a command down. If you
    routinely need to change a timer mid-run, theirs is the less error-prone
    model.</p>
    <p><b>A native iOS app.</b> CountLink installs from the browser as a web
    app, which covers the same ground for most people, but it is not the same
    as an App Store download and there is no point pretending otherwise.</p>
    <p><b>Viewer messaging is on their free tier and is a first-class feature.</b>
    CountLink's equivalent rides on phone control, so it is one more thing to
    have switched on in advance.</p>`,
    weWinHtml: `
    <p><b>Nothing is metered.</b> The reason ShareMyTimer counts your viewers is
    that each one holds a connection open on their servers, and connections
    cost money — three free, ninety for $6. CountLink writes the countdown's end
    time into the link itself, so every device does its own arithmetic against
    its own clock and nothing is held open for anyone. A viewer costs us
    nothing, so there is no cap and nothing to sell you.</p>
    <p><b>Sound is free.</b> A timer that cannot make a noise at zero is doing
    half its job, and it sits behind their $6/month tier.</p>
    <p><b>There is more of it.</b> Agendas that advance themselves, interval and
    round timers, website embeds, README badges, calendar export, printable
    posters, an offline copy you can download, and an MCP server so an AI
    assistant can build you a timer directly — none of which ShareMyTimer
    offers. The full list is on <a href="/features">the features page</a>.</p>
    <p><b>Nothing can go down.</b> There is no server in the path after the link
    is sent, so there is no outage that can interrupt a countdown people are
    already watching.</p>`,
    whichHtml: `
    <p><b>Pick ShareMyTimer if</b> you need to pause and adjust a running timer
    often and would rather that be the default behaviour than an option you
    remember to enable, or you specifically want a native iOS app.</p>
    <p><b>Pick CountLink if</b> more than three people need to watch, or you
    want sound at zero, or you would rather not create an account or a
    subscription for a countdown.</p>`,
    faq: [
      { q: "Is CountLink actually free, or free-for-now?", a: "Free permanently, and there is no paid tier to upgrade to. That is a consequence of the architecture rather than a promotion: viewers cost nothing to serve because nothing is held open per viewer, so there is no per-user cost that would eventually need covering." },
      { q: "Can CountLink pause a countdown for everyone, like ShareMyTimer does?", a: "Yes, if you tick phone control before starting. That opens a live channel for that one countdown and gives you a second link that pauses, adds or removes a minute, and stops it on every screen at once — free, with no cap on the number of screens. The difference is that it is opt-in rather than always on." },
      { q: "Why does ShareMyTimer limit free viewers to three?", a: "Their sync runs through a server that holds a connection open for each viewer, so each additional viewer has a real cost. That is a reasonable engineering choice, and the viewer caps follow from it directly." },
      { q: "Do I need to move my existing timers?", a: "There is nothing to migrate. A CountLink countdown is just a link — set the duration, press start, and send the link you get." },
    ],
  },

  {
    slug: "stagetimer",
    name: "Stagetimer.io",
    site: "https://stagetimer.io/",
    pricingUrl: "https://stagetimer.io/pricing/",
    verified: "2026-09-12",
    title: "CountLink vs Stagetimer.io — When To Use Each",
    meta: "CountLink vs Stagetimer.io, compared honestly. Stagetimer is professional event-production software from $210/year; CountLink is a free shared countdown. Which one you need depends on whether there's an AV desk involved.",
    h1: "CountLink vs Stagetimer.io",
    lede: "These are not really the same kind of product, and the comparison is more useful once that is said out loud.",
    verdict: `<p>Stagetimer is production software for live events: rooms, speakers, moderators, audience questions, an API, a desktop app that runs offline. CountLink is a shared countdown you send as a link. If you are running a conference stage with an AV desk, Stagetimer is the right tool and this page will not try to talk you out of it. If you are running a meeting, a class, a workshop or a stream and you have been looking at Stagetimer because it was the first result, you are probably about to pay $210 a year for a fraction of what it does.</p>`,
    rows: [
      ["Price", "Free, permanently. No paid tier exists.", "Free tier; Pro $210/yr; Premium $420/yr; Enterprise from $630; desktop lifetime licence $980"],
      ["Account required", "No", "Yes"],
      ["Viewers / live connections", "Unlimited", "3 per room free · 5 on Pro · 50 on Premium · up to 500 on Enterprise"],
      ["Timers", "Unlimited", "3 per room free · 50 on Pro · unlimited on Premium"],
      ["Rooms / events", "Not a concept — every countdown is a link", "3 free"],
      ["Sound alerts", "Free", "Free (audio chimes)"],
      ["Live control pushed to viewers", "Free, unlimited screens — opt in before starting", "Yes, core to the product"],
      ["Speaker / moderator roles", "No", "Yes"],
      ["Audience questions", "No", "Yes"],
      ["REST API", "No — but an MCP server for AI assistants", "Yes"],
      ["Desktop app / offline operation", "Downloadable single-file offline copy of one countdown", "Full offline desktop app ($980 lifetime)"],
      ["Custom branding on outputs", "No", "Yes, from the free tier (custom logo)"],
      ["Agenda of named segments", "Free", "Yes"],
      ["Website embed (iframe)", "Free, no watermark", "Yes"],
      ["Setup time before first use", "None — open the page, press start", "Create an account, create a room"],
    ],
    theyWinHtml: `
    <p><b>It is a genuinely more capable product, and it should be.</b>
    Stagetimer does speaker and moderator roles, audience questions, multiple
    rooms, CSV import and export, a REST API, custom-branded outputs, and a
    desktop application that runs with no internet at all. If your event has a
    run of show, a stage manager and a comms channel, those are not luxuries.</p>
    <p><b>Offline operation is a real differentiator.</b> Their desktop app runs
    a whole event with no network. CountLink can download a single countdown as
    a self-contained file that keeps running offline, which is a much smaller
    claim.</p>
    <p><b>Branding.</b> Custom logos on outputs start on their free tier.
    CountLink has no white-labelling at all.</p>`,
    weWinHtml: `
    <p><b>The free tiers are not comparable.</b> Stagetimer's free tier allows
    three live connections per room; CountLink has no connection limit at any
    price, because it has no connections. For the very common case — one
    countdown that a room full of people can see — the free version of
    CountLink does more than the free version of Stagetimer.</p>
    <p><b>Even their $210/year Pro tier allows five live connections per room.</b>
    That is the number to check against your actual audience before subscribing,
    and it surprises people.</p>
    <p><b>No account, no room, no setup.</b> Open the page, set a duration, press
    start, send the link. For anything short of a produced event, the setup is
    the cost.</p>`,
    whichHtml: `
    <p><b>Pick Stagetimer if</b> you are running a produced event — a conference
    stage, a broadcast, anything with a stage manager, multiple speakers on a
    schedule, or a need to brand what the audience sees. Also pick it if you
    need an API or guaranteed offline operation.</p>
    <p><b>Pick CountLink if</b> you want a countdown a group can watch together
    — meetings, classes, exams, workshops, streams, study groups — without an
    account, a room, a connection limit or a subscription.</p>`,
    faq: [
      { q: "Is CountLink trying to replace Stagetimer?", a: "No. They are built for different jobs. Stagetimer is event-production software with roles, rooms and an API; CountLink is a shared countdown in a link. The overlap is the countdown itself, and that is the only part this comparison is about." },
      { q: "What does Stagetimer's free tier actually allow?", a: "Three live connections per room and three timers per room, across three rooms, plus audio chimes, CSV import/export, API access and a custom logo. Verified against their pricing page on 12 September 2026." },
      { q: "Does CountLink have an API?", a: "Not a REST API. It has an MCP server at countlink.app/mcp, which lets an AI assistant create timers, build agendas, generate embeds and badges, and read back what a link means. For scripting from your own code, Stagetimer's REST API is the better fit." },
      { q: "Can CountLink work offline?", a: "A running countdown can be downloaded as a single self-contained HTML file that keeps counting with no network. That covers one timer, not a whole event — Stagetimer's desktop app is the serious offline option." },
    ],
  },

  {
    slug: "countdownshare",
    name: "CountdownShare",
    site: "https://countdownshare.com/",
    pricingUrl: "https://countdownshare.com/",
    verified: "2026-09-12",
    title: "CountLink vs CountdownShare — Shared Timer or Marketing Countdown",
    meta: "CountLink vs CountdownShare. CountdownShare is a marketing countdown tool — email GIFs, evergreen per-visitor timers, analytics, from $9/month. CountLink is a free shared timer for groups. They solve different problems.",
    h1: "CountLink vs CountdownShare",
    lede: "Both put a countdown in a link, and then they diverge completely: one is aimed at a marketing campaign, the other at a room full of people.",
    verdict: `<p>CountdownShare is built for marketing — countdown images that survive an email client, per-visitor "evergreen" urgency timers, campaign analytics, branded landing pages. CountLink is built for a group watching the same clock. If you are running a sales campaign, CountdownShare does things CountLink deliberately refuses to do. If you are timing a meeting, a class or a stream, you are paying $9/month for a feature set aimed at somebody else.</p>`,
    rows: [
      ["Price", "Free, permanently. No paid tier exists.", "Free tier; Pro $9/month or $199 one-time lifetime"],
      ["Account required", "No", "Yes"],
      ["Active timers", "Unlimited", "3 free · unlimited on Pro"],
      ["Viewers", "Unlimited", "Unlimited views on website embeds is a Pro feature"],
      ["Watermark / branding on free tier", "None", "Branding on the free tier; removed on Pro"],
      ["Website embed (iframe)", "Free, no watermark", "Yes — core to the product"],
      ["Countdown image or GIF for email", "No", "Yes (Pro)"],
      ["Evergreen per-visitor countdown", "Deliberately not offered — see below", "Yes (Pro)"],
      ["Campaign analytics", "No", "Yes (Pro)"],
      ["Custom design — fonts, colours, layouts", "Three board styles, no custom colours", "Yes"],
      ["Everyone sees the identical time remaining", "Always — it is the whole mechanic", "Yes for fixed-date timers; no for evergreen ones, by design"],
      ["Live pause / adjust pushed to viewers", "Free, unlimited screens", "Not offered"],
      ["Join code to read out", "Free", "Not offered"],
      ["Agenda, intervals, laps, stopwatch", "Free", "Not offered"],
      ["OBS / stream overlay", "Free, transparent, no watermark", "Not offered"],
    ],
    theyWinHtml: `
    <p><b>Email countdowns.</b> An email client will not run JavaScript, so a
    countdown in an email has to be a server-rendered image or animated GIF
    regenerated on every open. CountdownShare does this; CountLink does not.
    Its README badge is an image, but it shows coarse time remaining and is
    built for a GitHub README, not a Klaviyo campaign.</p>
    <p><b>Evergreen per-visitor countdowns.</b> Each visitor gets their own
    countdown starting when they arrive. This is a real marketing technique and
    it works. CountLink will not do it, and that is a deliberate refusal rather
    than a missing feature — the entire premise here is that everyone sees the
    same instant, and a per-visitor timer is the exact opposite. If you want
    one, you want their tool, not ours.</p>
    <p><b>Design control and analytics.</b> Fonts, colours, layouts, branded
    landing pages and campaign reporting. CountLink offers three board styles
    and no analytics at all.</p>`,
    weWinHtml: `
    <p><b>The free tier is not a trial.</b> Theirs allows three active timers
    and puts branding on them. CountLink has no timer limit, no watermark, and
    no upgrade.</p>
    <p><b>Everything for a live group.</b> Live pause and adjust pushed to every
    screen, a join code to read to a room, agendas that advance themselves,
    interval timers, laps, a stream overlay, a printable poster. CountdownShare
    does none of this, because none of it is what a marketing countdown needs.</p>
    <p><b>No account.</b> Theirs needs one before you can make anything.</p>`,
    whichHtml: `
    <p><b>Pick CountdownShare if</b> the countdown is part of a campaign — a
    launch page, a sale, an email sequence, anything where you want branding,
    analytics, or per-visitor urgency.</p>
    <p><b>Pick CountLink if</b> the countdown is for people in a room, a call or
    a stream, all of whom should see the same number at the same moment.</p>`,
    faq: [
      { q: "Can CountLink put a countdown in an email?", a: "No. Email clients don't run JavaScript, so an email countdown has to be a server-rendered image regenerated on each open — that is a genuinely different product and CountdownShare builds it. CountLink's badge image is for READMEs and forum posts and shows coarse time remaining, not a live tick." },
      { q: "Why won't CountLink do evergreen per-visitor countdowns?", a: "Because they contradict the premise. CountLink exists so that everyone opening a link sees the identical instant; a per-visitor countdown gives three people opening the same link three different timers. It is a legitimate marketing technique and a legitimate product — just not this one." },
      { q: "Can I put a CountLink countdown on my own website?", a: "Yes, free and without a watermark. The embed builder produces an iframe with size and style options, and every visitor sees the same remaining time because the end instant is fixed in the link." },
      { q: "Does CountLink track who opens a countdown?", a: "No. There is no per-timer analytics of any kind, which is the flip side of there being no server holding the countdown." },
    ],
  },

  {
    slug: "timerlink",
    name: "TimerLink",
    site: "https://timerlink.app/",
    pricingUrl: "https://timerlink.app/pricing",
    verified: "2026-09-12",
    title: "CountLink vs TimerLink — Free Shared Countdown Comparison",
    meta: "CountLink vs TimerLink. TimerLink's free tier allows one active timer with branding and needs an account; Pro is $9/month. CountLink is unlimited and free with no signup. Verified against their pricing page.",
    h1: "CountLink vs TimerLink",
    lede: "Similar names, similar pitch — a live timer you share by link. The free tiers are where they part company.",
    verdict: `<p>TimerLink's free tier allows one active timer, carries their branding, and requires an account; unlocking more is $9/month. CountLink has no timer limit, no branding, no account and no paid tier. The one thing TimerLink offers that CountLink genuinely does not is password-protected timer links.</p>`,
    rows: [
      ["Price", "Free, permanently. No paid tier exists.", "Free tier; Pro $9/month; custom enterprise pricing"],
      ["Account required", "No", "Yes — sign-in is part of the flow"],
      ["Active timers", "Unlimited", "1 free · multiple on Pro · unlimited on Enterprise"],
      ["Branding / watermark", "None", "TimerLink branding on the free tier; removed on Pro"],
      ["Timer duration", "Unlimited", "Extended duration is a Pro feature"],
      ["Password-protected links", "Not offered", "Pro"],
      ["Custom link URLs", "Not offered", "Pro"],
      ["Custom sounds", "A choice of built-in tones, free", "Pro"],
      ["Viewers", "Unlimited", "“Standard limits” on free; not published as a number"],
      ["Live pause / adjust pushed to viewers", "Free, unlimited screens — opt in before starting", "“Advanced controls” on Pro"],
      ["Join code to read out", "Free", "Not offered"],
      ["Agenda of named segments", "Free", "Not offered"],
      ["Interval / round timer", "Free", "Not offered"],
      ["OBS / stream overlay", "Free, transparent, no watermark", "Not published"],
      ["Website embed (iframe)", "Free, no watermark", "Not published"],
      ["MCP server for AI assistants", "Yes — countlink.app/mcp", "Not offered"],
      ["Analytics & API", "No", "Enterprise tier"],
    ],
    theyWinHtml: `
    <p><b>Password-protected timer links.</b> A real feature and a real gap —
    CountLink has nothing equivalent. A CountLink link is unguessable in
    practice but not secret: anyone who has it can open the countdown. If a
    timer genuinely must be restricted to an authorised audience, TimerLink's
    Pro tier does that and CountLink does not.</p>
    <p><b>Custom link URLs and custom sounds</b>, both on Pro. CountLink offers a
    fixed set of built-in tones and no vanity URLs.</p>
    <p><b>Analytics and an API</b> on their enterprise tier, if you need to
    script timer creation from your own systems.</p>`,
    weWinHtml: `
    <p><b>One timer versus no limit.</b> Their free tier allows a single active
    timer and puts their branding on it. CountLink has no cap and no watermark,
    on any page, at any time.</p>
    <p><b>No account.</b> TimerLink's flow starts with signing in. CountLink has
    nothing to sign into — the countdown lives in the URL, so there is no user
    record for it to belong to.</p>
    <p><b>Free things they charge for.</b> Longer durations, removing the
    watermark, and the controls needed to adjust a running timer are all Pro
    features there and all free here.</p>
    <p><b>Considerably more of it.</b> Agendas, interval timers, laps, join
    codes, stream overlays, embeds, calendar export, printable posters, an
    offline copy, and an MCP server. <a href="/features">The full list.</a></p>`,
    whichHtml: `
    <p><b>Pick TimerLink if</b> you need a timer link that is password-protected,
    or a custom URL, or you want analytics and an API around timer creation.</p>
    <p><b>Pick CountLink if</b> you want more than one timer, no watermark, no
    account, and no monthly bill.</p>`,
    faq: [
      { q: "Can I password-protect a CountLink timer?", a: "No — that is a genuine gap. A CountLink link is long and unguessable, but anyone holding it can open the countdown, and there is no way to require a password. If restricting the audience matters, TimerLink's Pro tier offers it." },
      { q: "How many timers can I run at once on CountLink?", a: "As many as you like — there is no cap, and the multiple-timers page runs several named countdowns on one screen from a single link. TimerLink's free tier allows one active timer." },
      { q: "Does CountLink put a watermark on shared timers?", a: "No. There is no branding on the board, the fullscreen view, the stream overlay or the website embed, on any tier — there is only one tier." },
      { q: "Is CountLink going to add a paid plan later?", a: "There is no paid tier and no plan for one, because the costs the other tools are recovering — a server connection held open per viewer — do not exist here. Nothing about viewers or timer count will ever be metered." },
    ],
  },
];
