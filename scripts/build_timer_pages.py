#!/usr/bin/env python3
"""
Generates the /timers/*.html programmatic landing pages.

Why this exists: vClock's ~$500K/yr in AdSense revenue does not come from its
homepage — it comes from hundreds of indexed pages like /set-timer-for-5-minutes/,
each targeting one long-tail search query and funnelling into the same tool.
This script is samesecond's version of that: add a row to PAGES below, re-run
this script, commit the new file. See docs/monetization.md for the full strategy.

Usage:
    python3 scripts/build_timer_pages.py

Regenerates every file in /timers/ from the single template below, so editing
the shared header/footer/copy in one place updates every page consistently.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "timers")

# Each row is one indexed landing page. slug -> filename (timers/<slug>.html).
# minutes: preset duration the tool boots into.
# title / h1 / meta: unique per page — never copy these verbatim between rows,
# duplicate title/meta tags are the #1 reason programmatic pages get filtered
# out of Google's index instead of ranked.
PAGES = [
    {"slug":"5-minute-timer","minutes":5,"label":"Time's up","eyebrow":"5 Minute Timer",
     "h1":"5 Minute Timer — Free, Shareable, In Sync",
     "meta":"A free 5 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
     "intro":"Five minutes is long enough for a quick break, a lightning talk, or the last leg of a board game turn — and short enough that everyone actually watches it end. Press start, then send the link to anyone else who needs to see the same five minutes tick down."},
    {"slug":"10-minute-timer","minutes":10,"label":"Time's up","eyebrow":"10 Minute Timer",
     "h1":"10 Minute Timer — Free, Shareable, In Sync",
     "meta":"A free 10 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
     "intro":"Ten minutes covers a coffee break, a standup, or a timed writing sprint. Start the countdown here and share the link — no app to install, no account for anyone else to make."},
    {"slug":"15-minute-timer","minutes":15,"label":"Time's up","eyebrow":"15 Minute Timer",
     "h1":"15 Minute Timer — Free, Shareable, In Sync",
     "meta":"A free 15 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
     "intro":"Fifteen minutes is a classic break length and a common quiz-round or lightning-talk limit. Set it once, share the link, and every screen in the room counts down together."},
    {"slug":"20-minute-timer","minutes":20,"label":"Time's up","eyebrow":"20 Minute Timer",
     "h1":"20 Minute Timer — Free, Shareable, In Sync",
     "meta":"A free 20 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
     "intro":"Twenty minutes works well for a workshop segment or a timed exercise. Start it here, copy the sync link, and hand it to the room."},
    {"slug":"25-minute-timer","minutes":25,"label":"Pomodoro break","eyebrow":"25 Minute Timer",
     "h1":"25 Minute Timer — The Pomodoro Length, Shareable",
     "meta":"A free 25 minute Pomodoro-length timer you can share with a study group or coworking room — everyone's screen counts down in sync.",
     "intro":"Twenty-five minutes is the classic Pomodoro focus block. Start it solo, or share the link with a study group or co-working session so everyone's break lands at the same moment."},
    {"slug":"30-minute-timer","minutes":30,"label":"Time's up","eyebrow":"30 Minute Timer",
     "h1":"30 Minute Timer — Free, Shareable, In Sync",
     "meta":"A free 30 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
     "intro":"Half an hour is enough for a workshop exercise, a half-length meeting, or a timed test section. Start the countdown and share the link with anyone who needs to see the same clock."},
    {"slug":"45-minute-timer","minutes":45,"label":"Time's up","eyebrow":"45 Minute Timer",
     "h1":"45 Minute Timer — Free, Shareable, In Sync",
     "meta":"A free 45 minute timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
     "intro":"Forty-five minutes is a common class period and workshop-session length. Start it here and put it on the projector — every phone in the room can pull up the same link."},
    {"slug":"60-minute-timer","minutes":60,"label":"Time's up","eyebrow":"1 Hour Timer",
     "h1":"1 Hour Timer — Free, Shareable, In Sync",
     "meta":"A free 1 hour timer that stays in sync across every device. Copy the link and everyone watching sees the same countdown, to the second.",
     "intro":"One hour covers a full class, a standard exam block, or a meeting you'd like to actually end on time. Start the countdown and share the link so nobody has to ask how long is left."},
    {"slug":"exam-timer","minutes":60,"label":"Time is up — pens down","eyebrow":"Exam Timer",
     "h1":"Exam Timer — One Countdown For The Whole Room",
     "meta":"A shareable exam timer for classrooms and test centres. Every invigilator's screen and every student device shows the identical countdown to the second.",
     "intro":"Put the countdown on the front screen and, if students have devices, on theirs too — everyone sees the identical time remaining, which is the whole point of a fair exam clock. Set it to your exam length and share the link before the paper starts."},
    {"slug":"classroom-timer","minutes":10,"label":"Back to it","eyebrow":"Classroom Timer",
     "h1":"Classroom Timer — For Group Work, Quizzes And Transitions",
     "meta":"A free classroom timer built for transitions, group work and quiz rounds — project it or share the link so every student sees the same countdown.",
     "intro":"Group work, quiz rounds, silent reading, transition time between activities — a visible shared countdown ends the “how much longer” questions on its own. Project it fullscreen or share the link to student devices."},
    {"slug":"webinar-countdown","minutes":5,"label":"We're starting","eyebrow":"Webinar Countdown",
     "h1":"Webinar Countdown — Show Attendees Exactly When You Start",
     "meta":"A shareable pre-webinar countdown. Put the link in your registration email or waiting room so every attendee's screen counts down to the same start time.",
     "intro":"Drop this link in your registration confirmation or waiting-room slide. Every attendee who opens it — on any device, in any timezone — sees a countdown to the exact same start moment, because the deadline travels inside the link itself."},
    {"slug":"standup-timer","minutes":10,"label":"Standup over","eyebrow":"Standup Timer",
     "h1":"Standup Timer — Keep Daily Standups Short",
     "meta":"A free shareable standup timer for teams. Set the length once, drop the link in Slack, and everyone sees the same countdown to keep standup on time.",
     "intro":"The easiest way to keep a daily standup to ten minutes is a countdown everyone can see. Set the length, drop the link in your team channel, and project it during the call."},
]

PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{h1} | samesecond</title>
<meta name="description" content="{meta}">
<link rel="canonical" href="https://samesecond.example/timers/{slug}.html">
<meta property="og:title" content="{h1}">
<meta property="og:description" content="{meta}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600&family=Work+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/style.css">
<!-- ANALYTICS / ADSENSE placeholders — see index.html head and docs/monetization.md -->
</head>
<body>

<header>
  <a class="logo" href="../index.html">samesecond</a>
  <div class="head-meta">no signup · no server · <b>the link is the sync</b></div>
</header>

<div class="wrap">
  <section class="hero">
    <div class="hero-grid">
      <div>
        <span class="eyebrow">{eyebrow}</span>
        <h1>{h1}</h1>
        <p class="lede">{intro}</p>
      </div>
      <div class="hero-fact">
        <span class="n">0</span>servers to run this
      </div>
    </div>
  </section>

  <section class="stage-section">
    <div class="stage">
      <div class="evt" id="evtLabel"></div>
      <div class="digits" id="digits"></div>
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
    <div class="setup">
      <div class="panel">
        <h2>Change the countdown</h2>
        <div class="hint">Already running at {minutes} minutes above — adjust it here if you need something else.</div>
        <label>Quick timer</label>
        <div class="quick">
          <button class="q" data-min="1">1 min</button>
          <button class="q" data-min="5">5 min</button>
          <button class="q" data-min="10">10 min</button>
          <button class="q" data-min="15">15 min</button>
          <button class="q" data-min="30">30 min</button>
          <button class="q" data-min="60">1 hour</button>
        </div>
        <div class="grid2">
          <div>
            <label for="customMin">Custom minutes</label>
            <input id="customMin" type="number" min="1" value="{minutes}">
          </div>
          <div>
            <label for="untilTime">…or until a date &amp; time</label>
            <input id="untilTime" type="datetime-local">
          </div>
        </div>
        <label for="evtName">What's it for? (shown on every screen)</label>
        <input id="evtName" placeholder="Break ends · Quiz round 2 · Doors open" value="{label}">
        <div class="stage-btns" style="justify-content:flex-start;margin-top:20px">
          <button class="btn primary" id="startBtn">Start countdown</button>
        </div>
        <div class="share-box" id="shareUrl"></div>
      </div>

      <div class="panel pro-panel">
        <h2>Pro <span class="pro-tag">for facilitators</span></h2>
        <div class="hint">For people who run rooms for a living.</div>
        <ul>
          <li>Your logo and colors on every countdown you share</li>
          <li>No ads on your links — clean screens in front of clients</li>
          <li>Agenda sequences: talk → break → Q&amp;A, one link</li>
          <li>Custom end sound and on-zero message</li>
        </ul>
        <div class="pro-price">$5<small> / month, per organizer</small></div>
        <button class="pro-link" id="proBtn">Unlock Pro →</button>
        <div class="proto-note">Prototype — button simulates checkout</div>
      </div>
    </div>
  </section>

  <section class="links-section">
    <div class="links-grid">
      <div class="links-col">
        <h4>Set a timer for</h4>
        <ul>
          <li><a href="5-minute-timer.html">5 Minute Timer</a></li>
          <li><a href="10-minute-timer.html">10 Minute Timer</a></li>
          <li><a href="15-minute-timer.html">15 Minute Timer</a></li>
          <li><a href="20-minute-timer.html">20 Minute Timer</a></li>
          <li><a href="25-minute-timer.html">25 Minute Timer (Pomodoro)</a></li>
          <li><a href="30-minute-timer.html">30 Minute Timer</a></li>
          <li><a href="45-minute-timer.html">45 Minute Timer</a></li>
          <li><a href="60-minute-timer.html">1 Hour Timer</a></li>
        </ul>
      </div>
      <div class="links-col">
        <h4>Built for</h4>
        <ul>
          <li><a href="exam-timer.html">Exam Timer</a></li>
          <li><a href="classroom-timer.html">Classroom Timer</a></li>
          <li><a href="webinar-countdown.html">Webinar Countdown</a></li>
          <li><a href="standup-timer.html">Standup Timer</a></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="why">
    <div class="why-grid">
      <div class="why-item">
        <span class="num">01</span>
        <h3>Why links sync themselves</h3>
        <p>Your link carries the end-moment as a timestamp. Every device counts down to that same instant using its own clock — no server, no lag, no account to create.</p>
      </div>
      <div class="why-item">
        <span class="num">02</span>
        <h3>Built to be projected</h3>
        <p>Fullscreen turns any screen into a wall clock, readable from the back row, with a progress line the whole room can track without asking "how much longer?"</p>
      </div>
      <div class="why-item">
        <span class="num">03</span>
        <h3>Free stays free</h3>
        <p>A timer costs nothing to run, so it costs you nothing to use. Pro exists only for the people who need their own name on the screen.</p>
      </div>
    </div>
  </section>
</div>

<footer>
  <div class="wrap foot-in">
    <div><div class="fb">samesecond</div>A timer you can hand to a room. · <a href="../privacy.html" style="text-decoration:underline">Privacy</a></div>
    <div>Sync accuracy depends on each device's clock — typically within a second.<br>No data leaves your browser; the timer lives entirely in the link.</div>
  </div>
</footer>

<script>window.SAMESECOND_DEFAULT={{minutes:{minutes},label:{label_js}}};</script>
<script src="../assets/app.js"></script>
</body>
</html>
"""

SITE_URL = "https://samesecond.example"  # update once the real domain is live

SITEMAP_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{site}/</loc></url>
{timer_urls}</urlset>
"""

def build_sitemap():
    urls = "\n".join(f"  <url><loc>{SITE_URL}/timers/{p['slug']}.html</loc></url>" for p in PAGES)
    xml = SITEMAP_TEMPLATE.format(site=SITE_URL, timer_urls=urls + "\n")
    path = os.path.join(ROOT, "sitemap.xml")
    with open(path, "w", encoding="utf-8") as f:
        f.write(xml)
    return path

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    written = []
    for p in PAGES:
        html = PAGE_TEMPLATE.format(
            slug=p["slug"], minutes=p["minutes"], label=p["label"],
            eyebrow=p["eyebrow"], h1=p["h1"], meta=p["meta"], intro=p["intro"],
            label_js='"' + p["label"].replace('"', '\\"') + '"',
        )
        path = os.path.join(OUT_DIR, p["slug"] + ".html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)
        written.append(path)
    print(f"Wrote {len(written)} pages to {OUT_DIR}/")
    for w in written:
        print(" -", os.path.relpath(w, ROOT))
    sitemap_path = build_sitemap()
    print(f"Wrote {os.path.relpath(sitemap_path, ROOT)} ({len(PAGES)+1} URLs)")
    print("\nReminder: update SITE_URL in this script and canonical/og URLs once the domain is live, then re-run.")

if __name__ == "__main__":
    main()
