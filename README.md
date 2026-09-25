# Upthread for Reddit

**Let Claude read Reddit for you.** Ask Claude something like *"How do Sony XM5 headphones hold up after a year?"* or *"What does the ending of Tenet mean?"* and it can search Reddit, read the threads, and tell you what real people say, alongside its normal web search.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) ![MCP](https://img.shields.io/badge/MCP-server-6b4fbb)

- **Read-only.** It never posts, votes or messages, and it stores nothing.
- **Private to you.** You run your own copy, and only you have its address.
- **Free to run** on a free Vercel account, for personal use.

## What you need

- **A Claude account** that can add custom connectors (claude.ai → *Settings → Connectors*).
- **A Reddit API app** with its *client ID* and *secret*. If you've made one before, find it at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps). If you haven't, you'll need to [request access from Reddit](https://support.reddithelp.com/hc/en-us/articles/42728983564564). Since November 2025 new apps need Reddit's approval, and that can take a while. Existing apps should be registered at [developers.reddit.com/app-registration](https://developers.reddit.com/app-registration).
- **A free [GitHub](https://github.com/signup) account and a free [Vercel](https://vercel.com/signup) account.** Vercel is the service that runs your copy; you can sign up for it with GitHub.

Setup takes about 10 minutes and needs no coding.

## Setup

### 1. Collect your Reddit details
Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) and find your app. Copy these into a note:
- **Client ID**: the short code under the app's name
- **Secret**: next to the word "secret"
- **Your Reddit username**

### 2. Make a private password for your connector
This becomes part of your connector's address, so only you can use it. Use a password generator (for example in 1Password, Bitwarden or your browser) and create a password that is:
- **at least 32 characters long**
- **letters and numbers only**, with no symbols

Save it somewhere safe. You'll need it in steps 3 and 5.

### 3. Create your copy on Vercel
Click this button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkudryilia-ux%2Fupthread-mcp&env=MCP_PATH_SECRET,REDDIT_CLIENT_ID,REDDIT_CLIENT_SECRET,REDDIT_USER_AGENT&envDescription=Your%20connector%20password%20and%20Reddit%20app%20details&envLink=https%3A%2F%2Fgithub.com%2Fkudryilia-ux%2Fupthread-mcp%23setup&project-name=upthread-mcp&repository-name=upthread-mcp)

Sign in with GitHub when asked. Vercel will ask for four values:

| Box | What to enter |
|---|---|
| `MCP_PATH_SECRET` | The password from step 2 |
| `REDDIT_CLIENT_ID` | Your Reddit client ID |
| `REDDIT_CLIENT_SECRET` | Your Reddit secret |
| `REDDIT_USER_AGENT` | `web:upthread:1.0 (by /u/YOUR_REDDIT_USERNAME)`, with your username in place of `YOUR_REDDIT_USERNAME` |

Click **Deploy** and wait about a minute. When it's done, Vercel shows your app's address, something like `https://upthread-mcp-abc123.vercel.app`. Copy it.

### 4. Build your connector address
Join your app's address, then `/mcp/`, then your password from step 2:

```
https://upthread-mcp-abc123.vercel.app/mcp/YOUR_PASSWORD
```

There's no slash at the end. Keep this address private; anyone who has it can use your connector.

### 5. Add it to Claude
1. In [claude.ai](https://claude.ai), click your name (bottom left) → **Settings** → **Connectors** → **Add custom connector**.
2. **Name:** `Upthread - Reddit opinions & reviews`
3. **URL:** your connector address from step 4
4. Click **Add**. You should see two tools listed: `search_reddit_opinions_reviews` and `read_reddit_threads`.

### 6. Try it
Start a new chat and ask: *"Search Reddit for how Sony XM5 headphones hold up after a year."* Claude should show Reddit search steps and then answer using what people said.

## Getting Claude to use Reddit on its own

Mentioning "Reddit" in your question always works. Without it, Claude decides for itself whether to check Reddit, and by default it often doesn't, because it keeps connectors on standby until a question clearly calls for them. Any of these makes it more automatic (most reliable first):

1. **Load tools at the start of a chat.** Click **+** (next to the message box) → **Connectors** → **Tool access** → **Tools already loaded**. Claude then knows about Upthread from your first message. Turn off connectors you don't need in that chat to keep it fast.
2. **Install the Upthread skill** (one-time). Download [`upthread-skill.zip`](https://github.com/kudryilia-ux/upthread-mcp/raw/main/skill/upthread-skill.zip), then in claude.ai go to *Settings → Capabilities*, turn on **Code execution**, and under **Skills** click **Upload skill** and choose the file.
3. **Add a personal preference** (one-time). In *Settings → Profile*, under personal preferences, paste:
   > For questions about how people experience or view something (products, media, places, advice, troubleshooting), also check Reddit with the Upthread tools and combine it with web search.

Even with these, Claude sometimes skips Reddit when web search seems enough. If you want Reddit for sure, say so.

## If something isn't working

- **Claude says it can't connect, or shows no tools:** check the connector address. It must be your Vercel address + `/mcp/` + your exact password, with no slash at the end. If you changed the password in Vercel, redeploy (Vercel → your project → **Deployments** → **⋯** → **Redeploy**) and update the address in Claude.
- **"Reddit rejected the app credentials":** re-check your client ID, secret and user agent in Vercel (*your project → Settings → Environment Variables*), then redeploy. Also make sure your Reddit app is still active and registered.
- **"Reddit rate limit reached":** Reddit allows about 100 requests a minute. Wait a minute and try again.
- **"Couldn't resolve share link":** open the link in your browser and give Claude the full `reddit.com/r/…/comments/…` address instead.
- **Claude answered without checking Reddit:** see [Getting Claude to use Reddit on its own](#getting-claude-to-use-reddit-on-its-own), or add "check Reddit" to your question.

## Privacy and safety

- Your copy runs in your own Vercel account. It only answers at your private address, and every other address returns "not found".
- It reads public Reddit posts and comments when Claude asks. It keeps nothing, and it never sees your Claude conversations beyond the searches Claude sends it.
- If you think your address leaked, change `MCP_PATH_SECRET` in Vercel, redeploy, and update the address in Claude. The old address stops working immediately.

## Reddit's rules

Upthread for Reddit is not affiliated with or endorsed by Reddit, Inc. It uses Reddit's official API with your own app, so Reddit's [Data API Terms](https://www.redditinc.com/policies/data-api-terms) apply to you: **personal, non-commercial use only**, no training AI models on Reddit content, and no storing content.

<details>
<summary><strong>For developers</strong></summary>

### Tools

**`search_reddit_opinions_reviews`**: `query` (Reddit operators allowed: `title:`, `subreddit:`, `OR`, …), `sort` (`relevance` · `top` · `new` · `comments`), `time_range` (`hour` … `all`), `limit` (1–25, default 15). Returns posts with score, upvote ratio, comment count, date, subreddit and excerpt, plus a per-subreddit summary and search tips.

**`read_reddit_threads`**: `threads` (1–5 post IDs or Reddit URLs, including share links and comment permalinks), `comment_sort` (`best` · `top` · `controversial` · `new` · `qa`). Returns each post and up to 20 top-level comments with replies three levels deep, trimmed, with `(OP)`/`(mod)` markers and no usernames.

### How the access gate works

The MCP endpoint lives only at `/mcp/<MCP_PATH_SECRET>`, compared in constant time. Every other path, including `/mcp` and `/.well-known/*`, returns a plain 404 and never a 401, because claude.ai custom connectors can't send auth headers and a 401 makes claude.ai attempt OAuth. If the secret is missing or shorter than 32 characters, the server answers nothing. Logs record error types only, never secrets, paths or Reddit content.

### Other clients

Any client that supports remote MCP over Streamable HTTP works with the same URL, e.g. Claude Code:

```sh
claude mcp add --transport http upthread "https://<your-app>.vercel.app/mcp/<MCP_PATH_SECRET>"
```

### Local development

```sh
pnpm install
cp .env.example .env.local   # fill in values; never commit them
pnpm dev                     # http://localhost:3000/mcp/<MCP_PATH_SECRET>
pnpm test                    # unit tests (no network)
MCP_PATH_SECRET=... node scripts/test-client.mjs http://localhost:3000            # live smoke test
MCP_PATH_SECRET=... node scripts/check-deploy.mjs https://<your-app>.vercel.app  # gate check
```

Generate a secret from the command line with `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`. Design notes are in [`docs/superpowers/specs`](docs/superpowers/specs).

</details>

## License

[MIT](LICENSE)
