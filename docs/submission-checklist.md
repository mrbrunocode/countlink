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
| IndexNow (Bing/Yandex/Seznam/Naver) | `script` | Run after every deploy that adds/changes pages, not just once. | not started |
| Google Search Console — ownership verification | `human-required` | One-time DNS TXT record or HTML file upload — only the domain owner can do this. Unlocks the item below. | not started |
| Google Search Console — scripted sitemap resubmission | `script` | Needs a Cloud project + service account added to the verified property (one-time, human). After that it's a script, same shape as submit-indexnow.mjs. | not started |
| Bing Webmaster Tools API | `human-required` | Low priority — IndexNow already reaches Bing. Mainly useful later for pulling crawl-stats back, not for getting indexed. | not started |
| AlternativeTo | `agent-browser` | List as an alternative to vClock/online-stopwatch/Google Timer. Needs a screenshot — assets/og-image.svg or a fresh capture. | not started |
| SaaSHub | `agent-browser` | Submit as a free tool; category Productivity/Education. | not started |
| Slant | `agent-browser` | Best added as an answer/option on an existing relevant question (e.g. 'best online timers') rather than a blind submission — agent should find the right question first. | not started |
| StackShare | `agent-browser` | Developer-tool leaning audience; frame around the zero-backend/URL-state mechanic. | not started |
| BetaList | `agent-browser` | Aimed at pre-launch/early products — best used once, near actual launch, not after the fact. | not started |
| SourceForge | `agent-browser` | Business/web-app software directory; free vendor listing available. | not started |
| Product Hunt — listing draft | `agent-browser` | Draft/save the listing here. The actual launch-day posting + comment replies is a separate human-required item below — do not publish this draft without Bruno picking the day. | not started |
| GitHub awesome-lists (education) | `agent-browser` | Opening the PR is a legitimate gh CLI/API call. Pick 1-2 lists where a free browser timer genuinely fits the stated theme — one well-written PR each, not a mass campaign across every result. | not started |
| GitHub awesome-lists (free software / self-hosted-adjacent) | `agent-browser` | Same approach as the education list — quality over count. | not started |
| Show HN (Hacker News) | `human-required` | Agent may draft the title/body for review. Bruno must post from a real account and be present to reply to comments — this is not a technical limitation, the entire value of the post depends on it. | not started |
| Product Hunt — launch day | `human-required` | The draft above can be prepped by an agent; the 24-hour launch window's value comes from real-time comment replies, which can't be delegated. | not started |
| r/SideProject | `human-required` | Reddit's site-wide rules prohibit automated posting; a flagged/shadow-banned account loses the ability to post anywhere, not just here. | not started |
| r/InternetIsBeautiful | `human-required` | Strict about self-promotion — read community rules before posting; may need someone else to post it. | not started |
| r/Teachers / r/Professors | `human-required` | Frame as a free classroom/exam tool, not a launch announcement — different norms than r/SideProject. | not started |
| Teacher/workshop-tool blog roundup outreach | `human-required` | Agent can find candidate 'best free online timers' posts and draft a personalized email per author. Bruno sends each one individually — mail-merged bulk outreach reads as spam and risks the sending domain's deliverability. | not started |
