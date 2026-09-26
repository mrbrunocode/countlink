# WebMCP — tools for AI agents in the browser (shipped 2026-09-26)

## What it is

Chrome's **WebMCP** (`document.modelContext`) lets a page register typed tools
for an AI agent running inside the visitor's browser. The agent calls a tool
instead of screenshotting the page and guessing where to click. It's modelled
on MCP. Chrome announced it on 2026-05-19, and it's an **origin trial from
Chrome 149 through 156** (and behind `chrome://flags/#enable-webmcp-testing`
before that).

CountLink's whole job is one agent-shaped action ("start a shared 10-minute
countdown called Quiz"), so every page with a board registers four tools
(`registerAgentTools()` in `assets/app.js`):

| Tool | Does | Annotations |
|---|---|---|
| `start_shared_countdown` | `{duration, label?, phone_control?}` → starts it, returns share link, join code (and control link if asked) | not read-only |
| `prepare_countdown` | sets the board without starting; returns a `#for=` setup link. Refuses while a countdown is live (sealed board) | not read-only |
| `get_countdown_status` | what's on the board: state, time left, share link, join code | read-only |
| `stop_countdown` | stops this screen (every screen only if this tab holds the phone-control key) | not read-only |

They call the page's own functions (`start()`, `renderReady()`, `stopTimer()`),
so an agent can do nothing a visitor couldn't. There is deliberately no tool
that edits a running countdown. `/mcp` (functions/mcp.js) is the server-side
twin for assistants that aren't in a browser, and the two share the duration
grammar.

Pages without a board (`/timers/agenda-timer`, `/timers/multiple-timers-at-once`,
guides, `/vs/`) register nothing. `/embed/` registers them, but a cross-origin
iframe's tools aren't visible to the embedding page unless it opts in with
`allow="tools"`, which the embed snippet doesn't set.

## Turning it on for real visitors — Bruno's step

It's feature-detected, so today it only works for people with the flag on. To
enable it for every Chrome 149–156 visitor:

1. Register at [developer.chrome.com/origintrials](https://developer.chrome.com/origintrials)
   → **WebMCP** → origin `https://countlink.app` (tick "match all subdomains"
   is unnecessary). Accepting the trial terms is a Google-account click, which
   is why it's yours.
2. Paste the token into `WEBMCP_ORIGIN_TRIAL_TOKEN` in `assets/app.js`, run
   `node scripts/bump-asset-version.mjs`, commit, push. The page injects it as
   `<meta http-equiv="origin-trial">` at load.
3. The trial ends with Chrome 156. When it ships for real, delete the token
   and the constant. The tools keep working with no change.

## Testing

`e2e/webmcp.spec.mjs` stands in a minimal `document.modelContext`, captures
the registrations, and calls each tool the way an agent would. It checks the
schemas, that a started countdown's link opens the same countdown in a
separate browser, that nonsense durations and sealed boards are refused, and
that a page without the API registers nothing and throws nothing.

## Why bother, at ~0% adoption

The AI-assistant channel is this site's biggest (492 of 494 AI sessions are
ChatGPT, 2026-09). Agents that act in the browser are where that channel is
heading, and a site that hands them a typed "start a shared timer" tool gets
used correctly rather than fumbled. It costs one function, and does nothing
where it isn't supported.
