# SEO & backlink outreach plan

How this project gets indexed, linked to, and discovered — designed to be
run by an agent with minimal check-ins from Bruno, not a manual checklist he
works through himself. Read this once for the model; day to day, the only
command that matters is:

```bash
node scripts/outreach-status.mjs
```

That prints exactly what's done, what an agent can go do right now, and a
single consolidated list of anything that genuinely needs Bruno — nothing
here should ever interrupt him one item at a time.

## The three files that make this work, and why there are three

- **`scripts/generate-submission-kit.mjs`** — static reference data: the
  pitch copy (name/tagline/description/tags) and the list of target sites,
  each tagged with *how* it can be actioned. Safe to re-run anytime; it has
  no memory of progress, so it can never accidentally undo anything.
- **`docs/outreach-ledger.json`** — the only file that remembers progress
  (status, when, notes). Never hand-edited and never blindly overwritten —
  `scripts/outreach-status.mjs sync` merges new targets into it without
  touching existing entries. This is what makes the whole thing resumable:
  a future session (this one, a smarter one, or Bruno himself) reads the
  ledger first and never re-attempts or duplicates something already marked
  `done` or already known to be `blocked`.
- **`docs/submission-checklist.md`** — a human-readable render of the other
  two, regenerated every time `outreach-status.mjs` runs. Never hand-edit
  this file; it will be overwritten.

## Execution model — what an agent should actually do

For every target in the ledger with status `pending`:

1. If `execution: "script"` — just run the script. These are real,
   documented APIs meant to be called unattended (IndexNow today; Search
   Console API once credentials exist).
2. If `execution: "agent-browser"` — attempt it directly using browser
   automation tools, using the copy from `docs/submission-kit.json`. This is
   the core of "let the agent do it, not just prep it for a human" — a
   single, real, honestly-labeled submission on a normal form is not
   materially different from Bruno clicking through it himself.
   - **Stop and mark `blocked` (do not improvise around) if:** the form
     requires solving a CAPTCHA, requires creating an account with email
     verification Bruno hasn't set up, or asks for payment/identity info.
     Record *why* in the ledger notes so the next run doesn't retry the same
     wall — it either needs a one-time human setup step or it stays blocked.
   - **Never:** create throwaway/fake accounts to get past a signup wall,
     attempt to defeat a CAPTCHA programmatically, or submit the same
     listing more than once "to be safe."
3. If `execution: "human-required"` — do not attempt to post/submit it. An
   agent may *draft* copy for these (a Show HN title, a blog-outreach email)
   but the actual posting stays with Bruno. This isn't a capability gap,
   it's deliberate: these platforms' entire value (Reddit, Hacker News,
   Product Hunt launch day) comes from a genuine, present human replying in
   real time, and a one-time domain-ownership proof (Search Console) can
   only legitimately come from the owner. Automating the mechanics wouldn't
   just risk a ban — it would defeat the actual point of doing it.

After working through everything actionable, run `node
scripts/outreach-status.mjs` once more and report **one** consolidated
summary: what got done, what's blocked and why, and the short list of
human-required items — not a running commentary per item.

## Why the line is drawn there, not somewhere looser

Automating the wrong parts of this doesn't just risk this one submission —
several of these platforms penalize a domain's *other* attempts too once
something is flagged (Reddit shadow-bans an account across every subreddit,
Google spam actions can affect the whole domain, directory accounts get
banned outright). The boundary above isn't caution for its own sake; it's
the actual place where "an agent did this competently on my behalf" stops
being true and "this reads as fake/spam" starts.

**Explicitly do not, regardless of how capable the tooling gets:**
- Create multiple accounts on any directory/forum to simulate organic interest.
- Use CAPTCHA-solving services or scripted CAPTCHA bypass.
- Buy backlinks, join link-exchange networks, or place links on unrelated
  sites purely for SEO weight (a manual-action-eligible Google Search
  Console violation that can suppress the *whole* domain, not just fail to help).
- Post to Reddit/Hacker News/forums programmatically, even to "save time" —
  one flagged post can burn the account for every future genuine post too.
- Publish the Product Hunt draft or post to Reddit/HN without Bruno
  explicitly choosing the day and being available to reply.

## Everything is currently gated on one thing: buying the domain

Check `docs/outreach-ledger.json` and nearly every target reads `blocked —
waiting on real domain purchase + deploy`. That's not overcaution — a
directory listing pointing at `countlink.app` is a dead link, and
IndexNow/Search Console literally require a resolving domain to mean
anything. The moment the domain is bought and the site is deployed:

1. Run `node scripts/rename-brand.mjs "CountLink" yourdomain.tld` (updates
   `site-config.mjs` + regenerates every generated file).
2. Run `node scripts/outreach-status.mjs sync` — this re-evaluates every
   `gated_on_domain` target now that `SITE_URL` no longer contains
   `.example`, flipping them from `blocked` to `pending` automatically.
3. From there, an agent works the `pending` list per the execution model
   above with no further prompting needed.

## Maintenance cadence (recurring, not one-time)

- **Every deploy that adds/changes pages:** re-run `node
  scripts/build-timer-pages.mjs` then `node scripts/submit-indexnow.mjs`.
  IndexNow's ledger entry is `recurring: true` for exactly this reason —
  "done once" isn't the right model for it.
- **Whenever `/timers/` grows meaningfully (e.g. +20 pages):** run `node
  scripts/outreach-status.mjs` and see if anything newly makes sense (e.g. a
  different awesome-list now fits given a broader tool scope).
- **Quarterly-ish:** check Search Console/Bing Webmaster for pages failing
  to index, and prioritize fixing those specifically over adding more.

## What this plan deliberately does not include

A full backlink-monitoring dashboard (checking whether submitted listings
are still live, tracking referring-domain growth over time) needs a paid
data source (Ahrefs/Semrush/Moz API) to do properly — free-tier options give
inconsistent, delayed data. Worth adding to the ledger as a new target once
there's actual revenue to justify a ~$99+/mo subscription; not before.
