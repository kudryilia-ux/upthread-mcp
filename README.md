# Upthread for Reddit

**Let Claude search Reddit and read the threads, alongside its web search.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) ![Node](https://img.shields.io/badge/node-%E2%89%A520-339933) ![MCP](https://img.shields.io/badge/MCP-server-6b4fbb)

Upthread is a small, self-hosted [MCP](https://modelcontextprotocol.io) server. Add it to Claude as a connector and Claude can:

- **search Reddit posts** across all of Reddit, with scores, comment counts, dates and subreddits
- **read threads**: the post plus its top comments and replies, from IDs or any Reddit link (including links Claude finds with web search)
- **weigh what people say**, including disagreement, using upvotes, dates and where it was said

It is read-only, stores nothing, and uses Reddit's official Data API.

> **Before you start: you need your own Reddit API app.** Reddit closed self-service API keys in November 2025; new keys require Reddit's approval ([Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564)). If you already have an app, register it at [developers.reddit.com/app-registration](https://developers.reddit.com/app-registration). Use is personal and non-commercial, and Reddit content must not be used to train models.

## Quick start (about 10 minutes)

1. **Deploy.** Click the button and fill in the four variables (see [Configuration](#configuration)):

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkudryilia-ux%2Fupthread-mcp&env=MCP_PATH_SECRET,REDDIT_CLIENT_ID,REDDIT_CLIENT_SECRET,REDDIT_USER_AGENT&envDescription=Secret%20URL%20path%20plus%20your%20Reddit%20app%20credentials&envLink=https%3A%2F%2Fgithub.com%2Fkudryilia-ux%2Fupthread-mcp%23configuration&project-name=upthread-mcp&repository-name=upthread-mcp)

2. **Generate the URL secret** for `MCP_PATH_SECRET`:

   ```sh
   openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
   ```

3. **Connect Claude.** In claude.ai: *Settings → Connectors → Add custom connector*, and paste:

   ```
   https://<your-app>.vercel.app/mcp/<MCP_PATH_SECRET>
   ```

4. **Ask something**, e.g. *"What do people on Reddit say about how the Sony XM5 holds up after a year?"*

## Configuration

| Variable | What it is | Where to get it |
|---|---|---|
| `MCP_PATH_SECRET` | Random secret (32+ characters) that forms your private URL | Generate with the command above |
| `REDDIT_CLIENT_ID` | Your Reddit app's client ID | [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps), under the app name |
| `REDDIT_CLIENT_SECRET` | Your Reddit app's secret | Same page, "secret" |
| `REDDIT_USER_AGENT` | Identifies your app to Reddit, required by Reddit's rules | Format: `<platform>:<app id>:<version> (by /u/<your username>)`, e.g. `web:upthread:0.1.0 (by /u/example)` |

## Using it well

- Ask naturally. Claude decides when Reddit helps and combines it with web search.
- Reddit search matches **posts, not comments**. For details buried in comments, Claude uses its web search with `site:reddit.com` and reads the threads it finds with `read_threads`.
- Ask for the range of opinions ("what are the different views…") and Claude can sort comments by *controversial*.

## Tools

**`search_reddit`**: `query` (Reddit operators allowed: `title:`, `subreddit:`, `OR`, …), `sort` (`relevance` · `top` · `new` · `comments`), `time_range` (`hour` … `all`), `limit` (1–25, default 15).

```
Search "XM5 OR "WH-1000XM5"" · relevance · all time · 15 results
By subreddit: r/SonyHeadphones 8 · r/headphones 2 · r/sony 1 · other 4

1. [1abc2de] XM5 vs QC Ultra after six months
   r/headphones · Review · 1.2k points (96%) · 340 comments · 2025-03-14
   "I have used both daily for half a year. Comfort goes to the QC, but…"
```

**`read_threads`**: `threads` (1–5 post IDs or Reddit URLs), `comment_sort` (`best` · `top` · `controversial` · `new` · `qa`).

```
=== [1abc2de] XM5 vs QC Ultra after six months
r/headphones · 1.2k points (96%) · 340 comments · 2025-03-14 · https://reddit.com/comments/1abc2de
Post (OP): I have used both daily for half a year…

Comments (best · 20 shown of 340):
[▲2.3k] The ANC gap closed after the spring firmware update. [2025-03-14]
  ↳ [▲812] (OP) Fair, I'm on the latest firmware and still notice it.
```

*(Examples use invented content.)*

## Security model

- The MCP endpoint lives only at `/mcp/<MCP_PATH_SECRET>`. Every other path, including `/mcp` and `/.well-known/*`, returns a plain **404**, so the server is invisible to anyone without the URL. (claude.ai custom connectors can't send auth headers, and a 401 would make claude.ai attempt OAuth.)
- The secret is compared in constant time. If it's missing or shorter than 32 characters, the server answers nothing.
- **If the URL leaks**, the worst case is someone using up your Reddit rate limit. To rotate, change `MCP_PATH_SECRET` in Vercel, redeploy, and update the connector URL.
- Nothing is stored. Logs record error types and status codes only, never secrets, paths or Reddit content.

## Other clients

The same URL works in any client that supports remote MCP servers over Streamable HTTP.

**Claude Code:**

```sh
claude mcp add --transport http upthread "https://<your-app>.vercel.app/mcp/<MCP_PATH_SECRET>"
```

**Claude Desktop:** *Settings → Connectors → Add custom connector*, using the same URL.

## Local development

```sh
pnpm install
cp .env.example .env.local   # fill in values; never commit them
pnpm dev                     # http://localhost:3000/mcp/<MCP_PATH_SECRET>
pnpm test                    # unit tests (no network)
MCP_PATH_SECRET=... node scripts/test-client.mjs http://localhost:3000     # live smoke test
MCP_PATH_SECRET=... node scripts/check-deploy.mjs https://<your-app>.vercel.app  # gate check
```

Tip: to keep secrets out of files and shell history, store them in a password manager and inject them at run time, e.g. 1Password's `op run --env-file <refs-file> -- pnpm dev`.

## Troubleshooting

- **Connector shows no tools / fails to connect:** check the URL ends in `/mcp/<your secret>` and that `MCP_PATH_SECRET` in Vercel matches (redeploy after changing env vars).
- **"Reddit rejected the app credentials":** check the client ID, secret and user agent, and that your app is still registered and approved.
- **"Reddit rate limit reached":** the limit is about 100 requests per minute per app. Wait for the reset shown.
- **"Couldn't resolve share link":** open the link in a browser and paste the full `reddit.com/r/…/comments/…` URL instead.

## Compliance

Upthread for Reddit is not affiliated with or endorsed by Reddit, Inc. You're responsible for following Reddit's [Data API Terms](https://www.redditinc.com/policies/data-api-terms) and [Developer Terms](https://www.redditinc.com/policies/developer-terms): personal, non-commercial use; no model training; no storing content.

## License

[MIT](LICENSE)
