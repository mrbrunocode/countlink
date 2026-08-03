# Submission checklist (generated — do not hand-edit)

This file is a rendering of `docs/outreach-ledger.json` (actual state) plus
`docs/submission-kit.json` (copy + target definitions). To change status,
run `node scripts/outreach-status.mjs set <id> <status> "notes"` — editing
this file directly will be overwritten on the next run.

## Copy to paste (source of truth: docs/submission-kit.json)

**Name:** CountLink
**Tagline:** One countdown. Every screen. Exactly in sync.
**One-liner:** A free shared countdown timer — set it once, share the link, everyone sees the same countdown in sync.
**Short description:** CountLink is a free, zero-signup countdown timer for classrooms, exams, webinars, workshops and standups. Set a duration, copy the link, and everyone who opens it sees the identical countdown — because the deadline is a timestamp inside the link itself, not stored on a server.
**Tags:** Productivity, Education, Web App, Time Management, Free Tools, Utilities
**Pricing:** Free — no paid tier

<details><summary>Long description (for sites that want more)</summary>

CountLink solves a specific, small problem well: getting a room (or a remote team, or a class taking an exam) to agree on exactly how much time is left, without everyone starting their own timer slightly out of sync. Set a duration or a target time, copy the generated link, and send it anywhere — Slack, email, a projector screen, a webinar waiting room. Every device that opens the link counts down to the same instant, computed from a timestamp embedded in the URL, so there's no account, no backend, and no drift between devices. It includes a fullscreen "projector" mode and three display styles (a mechanical split-flap board, a minimal flat-digit view, and a light theme for projecting in bright rooms). Completely free, no paid tier — the zero-backend architecture means one more viewer costs nothing, so there's no usage limit to charge for.

</details>

## Targets

| Target | Execution | Notes | Status |
|---|---|---|---|
| IndexNow (Bing/Yandex/Seznam/Naver) | `script` | Run after every deploy that adds/changes pages, not just once. | done |
| Google Search Console — ownership verification | `human-required` | One-time DNS TXT record or HTML file upload — only the domain owner can do this. Unlocks the item below. | done |
| Google Search Console — scripted sitemap resubmission | `script` | Needs a Cloud project + service account added to the verified property (one-time, human). After that it's a script, same shape as submit-indexnow.mjs. | blocked — Stale reason corrected 2026-08-03: search-console-verify is DONE, so that is no longer the blocker. Remaining work is a Cloud project + service account added to the verified property. Low value now — sitemaps for all three sites are submitted and being read; the constraint is crawl budget, not submission. |
| Bing Webmaster Tools API | `human-required` | Low priority — IndexNow already reaches Bing. Mainly useful later for pulling crawl-stats back, not for getting indexed. | done |
| AlternativeTo | `agent-browser` | List as an alternative to vClock/online-stopwatch/Google Timer. Needs a screenshot — assets/og-image.svg or a fresh capture. | skipped |
| SaaSHub | `agent-browser` | Submit as a free tool; category Productivity/Education. | done |
| Slant | `agent-browser` | Best added as an answer/option on an existing relevant question (e.g. 'best online timers') rather than a blind submission — agent should find the right question first. | blocked — slant.co site search is broken right now (returns 0 results for every query incl. generic terms like "timer"/"countdown", and the query-string URL form threw a 500). Could not find a relevant question to answer. Retry later once their search is working again. |
| StackShare | `agent-browser` | Developer-tool leaning audience; frame around the zero-backend/URL-state mechanic. | blocked — Google OAuth sign-in worked, but their own submission system auto-rejected: 'This tool does not fit into any of our supported categories. We currently focus on developer tools, SaaS products, and technology platforms.' Scope mismatch, not a technical blocker — not worth retrying. |
| BetaList | `agent-browser` | Aimed at pre-launch/early products — best used once, near actual launch, not after the fact. | blocked — Submission requires an account (sign in with X, or email+password signup) — no anonymous submission path. Needs Bruno to sign up himself. |
| SourceForge | `agent-browser` | Business/web-app software directory; free vendor listing available. | blocked — Form (sourceforge.net/software/vendors/new) filled in fully (no login required) but is protected by reCAPTCHA — repeated Submit clicks produced no network request and no visible confirmation, consistent with invisible reCAPTCHA silently blocking automated submission. Per plan, did not attempt to work around it. Bruno can complete it manually in ~2 min: Name=Bruno, Email=hello@countlink.app, Company=CountLink, Website=https://countlink.app, Founded=2026, Software Title=CountLink, category=Productivity, Starting Price=Free, Free Version checked, Support=Online, Platform=SaaS/Web. |
| Product Hunt — listing draft | `agent-browser` | Draft/save the listing here. The actual launch-day posting + comment replies is a separate human-required item below — do not publish this draft without Bruno picking the day. | done |
| GitHub awesome-lists (education) | `agent-browser` | Opening the PR is a legitimate gh CLI/API call. Pick 1-2 lists where a free browser timer genuinely fits the stated theme — one well-written PR each, not a mass campaign across every result. | done |
| GitHub awesome-lists (free software / self-hosted-adjacent) | `agent-browser` | Same approach as the education list — quality over count. | skipped |
| GitHub awesome-lists (remote work / digital events) | `agent-browser` | Same approach as the other awesome-list PRs — quality over count. Fits the 'Tools to set-up digital events' section (webinar/stream countdown use case), right next to OBS/Twitch. | done |
| Show HN (Hacker News) | `human-required` | Agent may draft the title/body for review. Bruno must post from a real account and be present to reply to comments — this is not a technical limitation, the entire value of the post depends on it. | not started |
| Product Hunt — launch day | `human-required` | The draft above can be prepped by an agent; the 24-hour launch window's value comes from real-time comment replies, which can't be delegated. | not started |
| r/SideProject | `human-required` | Reddit's site-wide rules prohibit automated posting; a flagged/shadow-banned account loses the ability to post anywhere, not just here. | not started |
| r/InternetIsBeautiful | `human-required` | Strict about self-promotion — read community rules before posting; may need someone else to post it. | not started |
| r/Teachers / r/Professors | `human-required` | Frame as a free classroom/exam tool, not a launch announcement — different norms than r/SideProject. | not started |
| Teacher/workshop-tool blog roundup outreach | `human-required` | Agent can find candidate 'best free online timers' posts and draft a personalized email per author. Bruno sends each one individually — mail-merged bulk outreach reads as spam and risks the sending domain's deliverability. | not started |
