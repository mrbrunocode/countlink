# The www → apex redirect (and why it can't live in this repo)

## The bug

`https://www.countlink.app/` serves the **entire site** at HTTP 200. Every
one of the 34 URLs in `sitemap.xml` therefore exists twice, on two hostnames.
Search Console files `https://www.countlink.app/` under *Alternative page with
proper canonical tag* — meaning the `<link rel="canonical">` on the page is
doing its job and Google is not indexing the duplicate, but Googlebot is still
spending crawl budget fetching it, on a site whose dominant problem is that
Google won't spend crawl budget here at all (42 of 45 URLs sit in *Discovered
– currently not indexed*).

## Why the previous fix didn't work

`_redirects` carried this line from ~2026-07-16 to 2026-08-06:

```
https://www.countlink.app/* https://countlink.app/:splat 301!
```

Cloudflare Pages' `_redirects` **does not support domain-level redirects.**
Its own documentation lists that capability as unsupported: the `from` column
is matched as a *path*, so a source containing a hostname matches no request.
The rule was not rejected at deploy time and produced no warning — it was
simply inert. Everything looked correct in the repo and in the deploy log.

This is why the site's own `_redirects` comment claimed the problem was fixed
while `curl -sI https://www.countlink.app/` returned `HTTP/2 200` for three
straight weeks. **Always verify a redirect against production, not against
the config that is supposed to produce it.**

Note that the path-only rules in `_redirects` (the 2026-07-29 page
consolidation) *do* work — `/timers/5-minute-timer` correctly 301s to
`/timers/`. The file is fine; only the domain-level rule was impossible.

## The actual fix

A zone-level **Single Redirect** rule, which runs at the edge before the
Pages project sees the request.

Cloudflare dashboard → select the `countlink.app` zone → **Rules** →
**Redirect Rules** → **Create rule**:

- **Name:** `www → apex`
- **If** — *Custom filter expression*: `http.host eq "www.countlink.app"`
- **Then** — *Type*: Dynamic
  - **Expression:** `concat("https://countlink.app", http.request.uri.path)`
  - **Status code:** `301`
  - **Preserve query string:** on

Single Redirect rules are available on the free plan (Bulk Redirects, which
Cloudflare's docs also suggest for this, are a paid feature — use Single
Redirects).

## How to verify it actually took

Do not trust the dashboard saying "Active". Run:

```bash
curl -sI https://www.countlink.app/ | head -1
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' https://www.countlink.app/timers/exam-timer
```

Expected:

```
HTTP/2 301
301 -> https://countlink.app/timers/exam-timer
```

If the first line is `HTTP/2 200`, the rule is not in effect — regardless of
what the dashboard shows.

## Afterwards

Once www 301s, the Search Console *Alternative page with proper canonical
tag* entry for `https://www.countlink.app/` will clear on its own at the next
crawl. It will likely reappear briefly under *Page with redirect*, which is
the correct and desired end state for a non-canonical hostname — that bucket
is not an error.

## What is NOT a bug

Search Console's *Page with redirect* bucket currently holds:

- `http://countlink.app/`
- `http://www.countlink.app/`

These are the plain-HTTP variants 301ing to HTTPS. That is correct behaviour
and every HTTPS site has it. There is nothing to fix, and no way to remove
them short of serving insecure HTTP. Don't spend time here.
