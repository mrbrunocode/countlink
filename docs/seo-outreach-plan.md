# SEO & backlink outreach plan

A plan for getting this site indexed, linked to, and discovered — split
into what is genuinely, safely automatable versus what should stay a
deliberate human step, and why. The line between those two isn't arbitrary:
it's ToS compliance and spam-flagging risk, not laziness. Automating the
wrong parts of this doesn't just risk this site — several of these
platforms penalize a domain's *other* attempts too once flagged (Reddit
shadow-bans, Google spam actions, directory account bans).

Three tiers:

- **Tier 1 — fully automated.** Real, documented APIs meant to be called by
  scripts. No ToS ambiguity, no CAPTCHA, no human review step to route
  around.
- **Tier 2 — semi-automated.** A generator script prepares the exact copy
  (name, tagline, descriptions, tags) once from a single source of truth,
  so filling in each site's form is a 2-minute paste job instead of writing
  fresh copy 15 times inconsistently. The actual submission click stays
  human, because these sites expect a real person behind a listing and
  some (Product Hunt, GitHub PRs) have a human-judgment or human-approval
  step baked in regardless.
- **Tier 3 — manual/social only, deliberately not scripted.** Explained
  per-item below — mostly "the platform explicitly prohibits automated
  posting" or "the value depends entirely on the post reading like a real
  person, at the right time, present to reply."

## Tier 1 — fully automated

### IndexNow (Bing, Yandex, Seznam, Naver)

`scripts/submit-indexnow.mjs` — run it after every deploy that adds or
changes pages. It:
1. Generates an IndexNow API key on first run (writes `<key>.txt` to the
   repo root — deploy that file as-is, it's how IndexNow verifies domain
   ownership).
2. Reads every URL out of `sitemap.xml`.
3. POSTs them all to `https://api.indexnow.org/indexnow` in one request,
   which fans out to every participating engine.

This is genuinely a "push" model — search engines get told the moment a
page changes, rather than waiting to discover it on their own crawl
schedule. It doesn't guarantee indexing, only that the engine is aware
something changed and can prioritize it.

**Google does not participate in IndexNow** (publicly declined). Google's
path is separate — see below.

```bash
node scripts/submit-indexnow.mjs --dry-run   # see what would be sent
node scripts/submit-indexnow.mjs             # actually send it
```

### Google Search Console (sitemap + coverage)

Google requires verified site ownership through Search Console — that
one-time verification step is unavoidably manual (add a DNS TXT record or
HTML file, done once at launch). After that, the **Search Console API**
supports scripted sitemap resubmission:

1. One-time setup: create a Google Cloud project, enable the Search
   Console API, create a service account, add it as a user on the Search
   Console property.
2. From then on, a script can call `sitemaps.submit` whenever the sitemap
   changes (e.g. after adding new `/timers/` pages) instead of clicking
   "resubmit" in the UI by hand.

Not built yet — this needs real Search Console credentials that don't
exist until the domain is live and verified. Once it is, this is a small
follow-up script (same shape as the IndexNow one).

**Do not** use Google's Indexing API for this. It is contractually
restricted to pages with `JobPosting` or `BroadcastEvent` structured data
only — Google has explicitly said (May 2025) that using it for ordinary
pages "may stop... without notice," and doing so risks the whole project
losing API access. None of this site's pages qualify.

### Bing Webmaster Tools API

Similar shape to Search Console: one-time site verification in Bing
Webmaster Tools, then the API key it issues can be used to submit the
sitemap/URLs on a schedule. Lower priority than the above two since
IndexNow already reaches Bing directly — this is mainly useful for pulling
Bing's own crawl-stats/indexation reports back into a dashboard later, not
for get-it-indexed purposes.

## Tier 2 — semi-automated (submission-kit generator)

`scripts/generate-submission-kit.mjs` — the single source of truth for
every piece of copy this project needs to describe itself externally
(name, tagline, one-liner, short/long description, category tags,
pricing). Run it, then work through `docs/submission-checklist.md`, which
lists every target site with the method and a status checkbox.

```bash
node scripts/generate-submission-kit.mjs
```

Current Tier 2 targets (see the checklist for live status): AlternativeTo,
SaaSHub, Slant, StackShare, BetaList, SourceForge, Product Hunt (copy
prep only — see Tier 3 for the actual launch), and two GitHub
awesome-list PRs.

**Why GitHub awesome-list PRs are half-automatable:** opening the pull
request itself is a legitimate API call (`gh pr create` or the GitHub API)
— no ToS issue, PRs are exactly how these lists expect additions. What
isn't automatable is picking which lists it genuinely belongs on and
writing the one-line description well enough that a volunteer maintainer
merges it. Do this a few times, by hand, well — not as a bulk campaign
across fifty lists, which reads as spam and gets PRs closed unmerged.

**Why the rest stay a human click:** most of these directories expect (and
some explicitly require, in their ToS) that a real person is submitting on
behalf of the product — automated form-filling at scale is exactly the
pattern their anti-spam heuristics are built to catch, and a flagged
listing is worse than no listing.

## Tier 3 — manual/social only, not scripted

| Where | Why it isn't automated |
|---|---|
| Show HN | Hacker News guidelines and community norms require a genuine account and presence to answer comments; anything that reads as automated gets flagged and can taint the account for future posts. |
| r/SideProject, r/InternetIsBeautiful, r/Teachers | Reddit's site-wide rules explicitly prohibit automated posting; its spam filters are specifically tuned to catch bot-like posting patterns, and a shadow-banned account loses the ability to post anywhere, not just here. |
| Product Hunt launch day | The listing/copy can be prepped in advance (Tier 2), but a PH launch's actual value comes from real-time comment replies during the 24-hour window — there's no legitimate way to script "being present and responsive." |
| Teacher/workshop-tool blog roundup outreach | These are cold emails to individual bloggers asking to be added to an existing "best free timers" post. Personalized, one at a time. Mail-merged bulk outreach reads as spam to both the recipient and to email providers' spam classifiers — and would risk the sending domain's own deliverability. |

**Explicitly do not:**
- Create multiple accounts on any directory/forum to simulate organic interest.
- Use CAPTCHA-solving services to push through anti-bot measures.
- Buy backlinks, join link-exchange networks, or place links on unrelated
  sites purely for SEO weight (Google's spam policies treat this as a
  manual-action-eligible violation, and it can take the *whole* domain's
  ranking down, not just fail to help).
- Post to Reddit/Hacker News/forums programmatically, even "just to save
  time" — one flagged post can burn the account for every future genuine
  post too.

## Maintenance cadence

- **Every deploy that adds/changes pages:** re-run
  `node scripts/build-timer-pages.mjs` (regenerates sitemap.xml) then
  `node scripts/submit-indexnow.mjs`.
- **Whenever the `/timers/` page list grows meaningfully (e.g. +20 pages):**
  worth a fresh look at `docs/submission-checklist.md` for anything still
  unchecked, and worth re-visiting the awesome-list PRs if the tool's scope
  has grown enough to justify a different list.
- **Quarterly-ish:** re-check whether Search Console/Bing Webmaster show
  any of the `/timers/` pages failing to get indexed, and prioritize
  content fixes on those specifically rather than adding more pages.

## What this plan deliberately does not include

A full backlink-monitoring dashboard (checking whether submitted listings
are still live, tracking referring-domain growth over time) needs a paid
data source (Ahrefs/Semrush/Moz API) to do properly — free-tier options
give inconsistent, delayed data. Worth adding once there's actual revenue
to justify a ~$99+/mo subscription; not before.
