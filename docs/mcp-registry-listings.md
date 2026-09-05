# `/mcp` on the official MCP Registry and community directories

Separate from `docs/mcp-submission.md` (OpenAI's own ChatGPT app directory,
which needs Bruno's login and is blocked on Business/Individual verification).
This file is everything else that makes `/mcp` findable to AI clients and
models generally — most of it needed no human gate at all.

## Official MCP Registry — DONE, 2026-09-05

[`registry.modelcontextprotocol.io`](https://registry.modelcontextprotocol.io)
is the standardized, cross-vendor feed backed by Anthropic, GitHub,
Microsoft and PulseMCP — many MCP-aware clients read it directly, and
several of the community directories below auto-index from it. Unlike
OpenAI's directory, publishing here needs **no identity verification** —
just proof of domain ownership.

**Published as `app.countlink/countdown`** (the reverse-DNS namespace for
`countlink.app`), a remote-only entry (`streamable-http` → `https://countlink.
app/mcp`, no npm package — the registry supports pure-remote servers natively
via the `remotes` field). Verify anytime:

```bash
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=app.countlink"
```

**How it was authenticated — DNS, not OAuth, deliberately:** the registry
offers two paths (see its own `authentication.mdx`): a GitHub OAuth
device-flow (`io.github.<username>/*` namespace, ties the listing to a
personal GitHub identity and grants an OAuth app access) or a DNS TXT
record proving domain ownership (`<reverse-dns-of-domain>/*` namespace, no
account grant of any kind). Chose DNS specifically because it needed
nothing from Bruno beyond a domain he already owns — the same reasoning
that made the OpenAI Business-verification ask a bad trade at CountLink's
current traffic.

**What's on the DNS record** — `countlink.app` apex, type TXT:
```
v=MCPv1; k=ed25519; p=gja196i5kq4K7SimCJeqfIRJwFbaNo2jRCUwgsI8IRI=
```
The matching Ed25519 private key lives locally only, in
`.mcp-registry/key.pem` (gitignored, never committed) — it's what signs
future `mcp-publisher login dns` calls when the listing needs an update
(e.g. bumping `version` in `server.json` after a real change to the tools).
**Don't rotate this key without first removing the old TXT record** — the
registry's own docs warn a stale record left at the apex is tried first and
breaks re-authentication.

To update the listing later (new tools, description change): edit
`.mcp-registry/server.json`, bump `version`, then from that directory:
```bash
mcp-publisher login dns --domain countlink.app --private-key "$(cat .mcp-registry/private_key_hex.txt)"
mcp-publisher publish
```
(`mcp-publisher` itself isn't committed to the repo — reinstall per the
[quickstart](https://modelcontextprotocol.io/registry/quickstart) if it's not
on the machine doing the update.)

## Community directories — checked 2026-09-05, three of four need an account decision

Checked each one's actual submission mechanism rather than assuming; the
picture is more mixed than "just paste a URL":

| Directory | Scale (2026) | What it actually needs | Status |
|---|---|---|---|
| [PulseMCP](https://www.pulsemcp.com) | ~11,840 servers, hand-reviewed | **Nothing** — submissions are paused as of Sept 3, and their own submit page says: publish to the official MCP Registry and they'll "pick it up automatically once we are back." | **Done, by proxy** — already covered by the official-registry listing above. |
| [mcp.so](https://mcp.so) | ~19,700 servers | **$39 one-time fee** — there is no free submission path on their form, for either the "MCP Server" or "Remote Server" tabs. | Not submitted — a real purchase, Bruno's call, not something to do speculatively. |
| [Smithery](https://smithery.ai) | ~7,000 servers, real app-store UI | An account (`authk.smithery.ai` — email, Google, or GitHub signup) before you can add a server. | Not submitted — needs Bruno to create the account (light signup, not ID verification, but still a new identity/OAuth decision). |
| [Glama](https://glama.ai/mcp/servers) | ~82,491 servers, largest by volume | Same shape: an account (Google/GitHub/email) before "Add Server" works. Glama does auto-index some open-source repos, but countlink's `/mcp` is one file inside a whole website repo, not a standalone MCP-server package — unlikely to get picked up passively. | Not submitted — same as Smithery. |

**Net effect: the official registry listing was the actual high-leverage
move.** It's live, it needed no account of any kind, and it already
satisfies PulseMCP's own stated bar for inclusion. The other three are each
a real, separate decision (a $39 purchase, or a new account) rather than
one more copy-paste — flagged for Bruno rather than done speculatively.
