# Upthread for Reddit: design spec

**Date:** 2026-09-25
**Status:** Draft, awaiting review
**Working name:** Upthread for Reddit (repo `upthread-mcp`). The name can change before the repo goes public.

## 1. Goal

Make Reddit another general-purpose source that Claude can use alongside web search. It should help with any question where people's experiences, opinions, explanations or niche knowledge would be useful: products, movies and scene explanations, travel, careers, obscure errors, and so on.

The main client is claude.ai chat, using an authless custom connector. The server stays **neutral**. It returns what is on Reddit, along with the signals needed to weigh it (score, comment count, date, subreddit, reply structure), and Claude decides whether the answer is one good reply, a range of views, a rough majority, or "nobody knows".

### Success criteria

- In claude.ai, asking about a product, a movie or scene, or a general-advice topic leads Claude to find relevant threads and read their comments. It can then report what people say, including disagreement and engagement ("a 1.2k-upvoted comment says…").
- Reddit links found by Claude's web search can be read in full through the server.
- Anyone who doesn't know the secret URL gets 404s on every path.
- No secret ever appears in the repo. The repo can be made public safely.

### Non-goals (v1)

- A subreddit filter parameter, a community-discovery tool, or subreddit browsing. Search always covers all of Reddit, and nothing assumes where an answer lives. These can be added later as extra tools without changing the two in v1.
- Comment search. The Data API has no endpoint for it.
- Semantic or AI search. Reddit Answers has no API.
- Writing to Reddit (posting, voting, messaging), user-context OAuth, or user-history lookups.
- Caching or storing Reddit content.
- Multi-user hosting. Each deployment serves its owner and uses its owner's credentials.

## 2. Context and constraints

- **Base:** Vercel's `mcp-for-next.js` template: Next.js App Router, `mcp-handler` 2.2.0 (MCP TypeScript SDK v2), zod 4. It is deployed at `https://reddit-mcp-six.vercel.app`, and claude.ai already connects to it.
- **Deploys:** manual `vercel --prod`. The Vercel plugin stays disabled.
- **claude.ai connectors can't send custom headers.** OAuth discovery paths (`/.well-known/*`) must return **404, never 401**. A 401 makes claude.ai attempt OAuth, which fails.
- **Credentials:**
  - They live in 1Password. `~/.config/reddit-mcp/.env.op` holds `op://` references for `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` and `MCP_PATH_SECRET`.
  - Local commands that need them run through `op run --env-file ~/.config/reddit-mcp/.env.op -- …`, and the owner runs those commands.
  - Production values are set in Vercel's environment settings by the owner.
- **The repo will be public.** A gitleaks pre-commit hook is installed. If it blocks a commit, stop and report it; never bypass it.
- **Reddit API facts** (researched 2026-09-25 and confirmed by a live probe the same day):
  - App-only OAuth works: `client_credentials` returns a token with a 24h lifetime and scope `*`.
  - The rate limit is 1,000 requests per 10-minute window, reported in the `X-Ratelimit-Used`, `X-Ratelimit-Remaining` and `X-Ratelimit-Reset` headers.
  - Search matches post bodies as well as titles. Quoted-phrase matching is unreliable.
  - Short product names can be ambiguous: "XM5" returns both Sony headphones and the Fujifilm X-M5 camera. Default relevance ranking is noisy.
  - On `/comments/{id}`, `limit` counts all comments including replies. `sort=controversial` returned no replies.
  - Raw thread JSON is 50–73 KB, but 20 comments hold only about 5–7k characters of text (roughly 250–350 per comment). Post bodies vary widely; one was 8,162 characters.
  - Starting 2026-09-28, comment IDs get longer (up to 13 base36 characters) and are no longer sequential.
- **Reddit policy:**
  - Use is personal and non-commercial, with no model training.
  - Don't store content. Reddit recommends deleting within 48h and removing anything deleted on Reddit; storing nothing satisfies both.
  - Send an honest User-Agent.
  - Don't re-identify users.
  - The name must use "Reddit" only in the form "[name] for Reddit".
  - The owner submitted registration for the existing app at developers.reddit.com/app-registration on 2026-09-25.

## 3. Architecture

```
claude.ai ──HTTPS──▶ /mcp/<secret>          access gate: 404 unless the secret matches
                          │
                          ▼
                  MCP tools                  search_reddit, read_threads: shape Reddit data into text
                          │
                          ▼
                  Reddit client              token, rate limit, HTTP; the only code that talks to Reddit
                          │
                          ▼
                     oauth.reddit.com
```

There are three units, each with one job and a narrow interface:

| Unit | Location (proposed) | Knows about | Doesn't know about |
|---|---|---|---|
| Access gate + MCP route | `app/mcp/[secret]/route.ts`, `lib/gate.ts` | request path, `MCP_PATH_SECRET` | Reddit |
| Tools + formatting | `lib/tools/*.ts`, `lib/format.ts` | MCP tool schemas, the text layout | HTTP, tokens |
| Reddit client | `lib/reddit/*.ts` | Reddit's HTTP API, OAuth, rate limits | MCP |

The Reddit client is the part most likely to change. Reddit has said third-party apps will eventually have to move to its Developer Platform, so replacing the client must not affect the other units.

## 4. Access gate

- The MCP endpoint is `app/mcp/[secret]/route.ts`, which exports the handler as GET and POST, the same as the template.
  - `mcp-handler` 2.2.0 answers every request it receives and leaves routing to Next.js, so it needs no path configuration.
- The route compares the `secret` path segment with `MCP_PATH_SECRET` using a **constant-time comparison**: `crypto.timingSafeEqual` on SHA-256 digests of both values, which avoids leaking the length.
  - If they match, the request goes to the MCP handler.
  - If they don't, the route returns a plain `404 Not Found`, identical to Next.js's normal 404 for an unknown path.
- **It fails closed.** If `MCP_PATH_SECRET` is unset or shorter than 32 characters, every request returns 404, and a single warning is logged per instance.
- The template's `app/mcp/route.ts` is deleted, so `/mcp` returns 404. No route exists under `/.well-known/`, so those paths return Next.js's 404. **The server never returns 401 or sends `WWW-Authenticate` on any path.**
- **The secret:** at least 32 random bytes, base64url-encoded, generated by the owner (`openssl rand -base64 32 | tr '+/' '-_' | tr -d '='`). It's stored in 1Password and in Vercel's environment settings.
- **Rotation:** change the environment variable, redeploy, and update the connector URL in claude.ai.
- **Accepted trade-off:** a secret in the URL can show up in Vercel's request logs and claude.ai's connector settings, both private to the owner. The worst case if it leaks is someone using up the owner's Reddit rate limit, and the fix is to rotate the secret.

## 5. Reddit client

- **No new runtime dependencies.** It uses the global `fetch` (Node ≥ 20).
- **Authentication:**
  - `POST https://www.reddit.com/api/v1/access_token` with `grant_type=client_credentials`, HTTP Basic auth (client ID and secret) and the User-Agent header.
  - The token is cached **in module memory only** and refreshed 5 minutes before the `expires_in` Reddit reports.
  - Concurrent refreshes are collapsed into one (single-flight).
  - A 401 from an API call clears the cached token, refreshes it and retries once.
- **Every request:**
  - `GET https://oauth.reddit.com…` with `Authorization: Bearer …` and `User-Agent: $REDDIT_USER_AGENT`.
  - Adds `raw_json=1` so text comes back unescaped.
  - Times out after 10 seconds (`AbortSignal.timeout`).
- **Rate limits and retries:**
  - After each response it records `X-Ratelimit-Remaining` and `X-Ratelimit-Reset`.
  - If the remaining count is ≤ 2 before a call, or Reddit returns 429, it fails fast with a `RateLimited(resetSeconds)` error rather than sleeping.
  - A 5xx gets one retry after about 500 ms.
- **Resolving thread references (`resolveThreadRef`):**

  | Input | How it's resolved |
  |---|---|
  | `1abc2de`, `t3_1abc2de` | ID used directly (base36, any length) |
  | `https://{www,old,new,np,m}.reddit.com/r/<sub>/comments/<id>/…`, and `/comments/<id>` with no subreddit | ID taken from the path |
  | `https://redd.it/<id>` | ID taken from the path |
  | `https://www.reddit.com/r/<sub>/s/<code>` (share links) | Fetched with `redirect: "manual"`; the `Location` header is parsed as above. **This must be verified live during implementation.** If app-only auth can't resolve it, it fails with the "unresolved share link, pass the full URL" error below |
  | Anything else | `InvalidThreadRef` error |

  A comment permalink (`…/comments/<id>/<slug>/<commentId>`) resolves to its thread. v1 doesn't treat the specific comment specially. IDs are never checked by length and never sorted.
- **Interface.** It returns plain normalized objects; no raw Reddit JSON escapes the module.
  - `searchPosts({ query, sort, timeRange, limit }) → PostSummary[]`
  - `getThread(id, { commentSort }) → { post: Post, comments: Comment[] }`
    - It requests `limit=100&depth=3`, because `limit` counts all comments (see §2). Choosing which comments to show is left to the formatter.
  - `resolveThreadRef(input) → id`
- **Storage:** none, apart from the in-memory OAuth token.

## 6. Tools and output

Both tools return plain text only: no `outputSchema` and no `structuredContent`, to avoid sending the same data twice. Both are annotated `readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true`. The server's `instructions` field briefly says what Upthread is for, and that Reddit links from web search can be read with `read_threads`.

**Output never includes usernames.** It uses only `(OP)` for the original poster and `(mod)` for moderator-distinguished comments.

### 6.1 `search_reddit`

| Parameter | Type | Default |
|---|---|---|
| `query` | string, 1–512 characters; Reddit operators pass through (`title:`, `selftext:`, `subreddit:`, `author:`, `flair:`, `site:`, `self:`, `AND`/`OR`/`NOT`, parentheses) | required |
| `sort` | `relevance` \| `top` \| `new` \| `comments` | `relevance` |
| `time_range` | `hour` \| `day` \| `week` \| `month` \| `year` \| `all` | `all` |
| `limit` | integer 1–25 | 15 |

It always searches all of Reddit (`/search`, `type=link`). If the user explicitly asks for one subreddit, Claude can put `subreddit:name` in the query.

Output (illustrative; invented content):

```
Search "XM5 OR "WH-1000XM5"" · relevance · all time · 15 results
By subreddit: r/SonyHeadphones 8 · r/headphones 2 · r/sony 1 · other 4

1. [1abc2de] XM5 vs Bose QC Ultra after 6 months
   r/headphones · Review · 1.2k points (96%) · 340 comments · 2025-03-14
   "I've owned both for half a year. Comfort goes to Bose, but the XM5's…"
2. [1def3gh] Long-term XM5 owners, how are yours holding up?
   r/SonyHeadphones · 214 points (98%) · 187 comments · 2026-01-09
3. [1jkl4mn] My XM5 review after a year
   r/sony · 88 points (91%) · 40 comments · 2025-11-02 · link: youtube.com
```

- Each result shows:
  - its ID and title, with an `[NSFW]` marker when flagged
  - subreddit, then flair if present
  - score (formatted as 1.2k) with upvote ratio, and comment count
  - date (`YYYY-MM-DD`, UTC)
  - for self posts, the first ~200 characters of the body, on one line; for link posts, the link's domain
- The "By subreddit" line lists the top 4 subreddits by count and groups the rest as "other N".
- When there are 0–2 results, the output ends with hints: rephrase, add a word to disambiguate or `OR` the variants, widen the time range, or try web search with `site:reddit.com` and pass the links to `read_threads`.

### 6.2 `read_threads`

| Parameter | Type | Default |
|---|---|---|
| `threads` | array of 1–5 strings (IDs or URLs, per §5) | required |
| `comment_sort` | `best` \| `top` \| `controversial` \| `new` \| `qa` (`best` maps to Reddit's `confidence`) | `best` |

Threads are fetched in parallel. If one fails, it gets an error line and the others are still returned.

Output, per thread (illustrative; invented content):

```
=== [1abc2de] XM5 vs Bose QC Ultra after 6 months
r/headphones · 1.2k points (96%) · 340 comments · 2025-03-14 · https://reddit.com/comments/1abc2de
Post (OP): I've owned both for half a year. Comfort goes to Bose…

Comments (best · 20 shown of 340):
[▲2.3k] The ANC comparison everyone makes is outdated since the firmware… [2025-03-14]
  ↳ [▲812] (OP) Fair, I'm on the latest firmware and still notice…
    ↳ [▲95] Same here. Wind noise is where Bose still wins.
[score hidden] Just bought mine yesterday…
```

Limits:

| Item | Limit |
|---|---|
| Post body | 4,000 characters, then `…[trimmed]` |
| Each comment | 600 characters, then `…[trimmed]` |
| Top-level comments | 20 |
| Replies at depth 2 | 3 per parent |
| Replies at depth 3 | 2 per parent |
| Deeper replies | not shown |

- **Filtered out:**
  - comments whose body is `[deleted]` or `[removed]` (their replies go too)
  - `AutoModerator` comments
  - stickied (pinned) comments
  - `more` placeholders
- Link posts show the linked URL in place of a body.
- Each top-level comment shows its date.
- The expected size is about 3k tokens per thread, and about 15k for 5 threads.

### 6.3 Tool description guidance

Descriptions are neutral: they say what the tool returns and never mention consensus. They include these tips, all grounded in the probe:

- Search the way Redditors title posts: short product names, comparisons ("X vs Y"), nicknames.
- **When a name is ambiguous, add a distinguishing word (brand or full model) or `OR` the variants.**
- Don't rely on exact-phrase searches in quotes.
- Keep `relevance` as the default sort. Use `top` or `new` with a `time_range` for popular or recent posts.
- Look for FAQ, megathread and "discussion" threads, which often hold the best answers.
- Read only threads clearly relevant to the question, and rephrase rather than read marginal ones.
- Use `comment_sort: controversial` when the range of views matters. It returns top-level comments only.
- Reddit links from web search can go straight into `read_threads`.

## 7. Errors

Tool failures come back as MCP tool results with `isError: true` and a short, plain message that says what to do next. There are no stack traces.

| Situation | Message (paraphrased) |
|---|---|
| Schema validation failure | Names the parameter and the problem |
| `InvalidThreadRef` | "Couldn't read `<input>` as a Reddit thread. Pass a post ID or a reddit.com/redd.it URL." Other threads still load |
| Unresolved share link | "Couldn't resolve share link `<input>`. Pass the full reddit.com URL." |
| Thread 403/404 | "Thread `<id>` is unavailable (removed, private or quarantined)." Other threads still load |
| No search results | "No results for `<query>`", plus the hints from §6.1 |
| Credentials rejected (token request or API 401 after the retry) | "Reddit rejected the app credentials; the server owner needs to check them." |
| Missing `REDDIT_*` environment variables | Same credentials message |
| Rate limited | "Reddit rate limit reached; resets in ~Ns." |
| 5xx after retry, or timeout | "Reddit is not responding right now (HTTP <code> / timeout). Try again shortly." |

**Logging** (`console.error`, visible in Vercel logs):

- It records the error category, the HTTP status and the duration.
- It **never** logs secrets, tokens, the request path or URL (the path contains `MCP_PATH_SECRET`), or Reddit content.

## 8. Testing

The work is test-driven. **Vitest** is added as a dev dependency, and `pnpm test` runs the suite.

**Unit tests** (no network):

- **`resolveThreadRef`:**
  - every URL form in §5
  - bare and `t3_` IDs
  - 13-character IDs
  - invalid inputs
  - share-link handling, using a fake fetch
- **Formatting:**
  - scores (`999`, `1.2k`, `12k`)
  - trimming at the limits
  - reply limits per depth
  - filtering of deleted, removed, AutoModerator, stickied and `more` entries
  - `(OP)` and `(mod)` markers
  - `[NSFW]`, `[score hidden]`
  - the link-post domain
  - the "By subreddit" line
  - hints on thin results
- **Reddit client,** with a fake `fetch`:
  - token caching and refresh timing
  - single-flight refresh
  - 401 → refresh → retry, and 401 twice → credentials error
  - 429 and a low remaining count → `RateLimited`
  - a single 5xx retry
  - timeouts
  - `raw_json=1` and the User-Agent header present
- **Access gate / route:**
  - wrong secret, missing environment variable or short secret → 404
  - a request to `/.well-known/oauth-protected-resource` is never a 401
  - the right secret → MCP `initialize` succeeds and `tools/list` returns exactly `search_reddit` and `read_threads`

**Fixtures are synthetic.** They copy the structure of real API responses but use invented text and usernames. No real Reddit content is committed.

**Live checks,** run by the owner through `op run`:

1. **Local smoke test:** run `pnpm dev`, then run `scripts/test-client.mjs <url>` (updated to list the tools, run one search and read one thread).
2. **Production check:** `scripts/check-deploy.mjs <base-url> <secret>` confirms:
   - `/mcp`, `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server` and a wrong-secret path return 404
   - the right secret completes `initialize`
3. **Share links:** a live test with a share link from the Reddit app decides whether the redirect path in §5 works.
4. **claude.ai:** with the connector updated to `/mcp/<secret>`, ask three kinds of question:
   - a product ("how do XM5s hold up long-term")
   - a movie ("what does the Tenet opera scene mean")
   - general advice

   The results decide how to tune the output limits and description tips.

## 9. Repo and housekeeping

- Remove the template's `echo` tool and `app/mcp/route.ts`.
- Remove `package-lock.json`; the project uses pnpm (`packageManager` field).
- Add `.env.example` with variable names only: `MCP_PATH_SECRET=`, `REDDIT_CLIENT_ID=`, `REDDIT_CLIENT_SECRET=`, `REDDIT_USER_AGENT=`. It is committed despite the `.env*` ignore rule via `!.env.example`, and gitleaks still scans it.
- Package name `upthread-mcp`; MCP `serverInfo.name` `upthread`.
- **README** (rewritten), covering:
  - what it is
  - personal and non-commercial use per Reddit's terms, and no training
  - bringing your own approved Reddit app (new keys need Reddit's approval)
  - registering the app at developers.reddit.com
  - the environment variables and how to generate the secret
  - deploying and connecting in claude.ai
  - the User-Agent format `<platform>:<app id>:<version> (by /u/<username>)`
- Renaming the GitHub repo and the Vercel project is up to the owner and outside this plan.

## 10. Rollout

1. Implement and pass the unit tests locally.
2. The owner runs the local smoke test through `op run`.
3. The owner adds `MCP_PATH_SECRET`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` and `REDDIT_USER_AGENT` to Vercel's production environment, then runs `vercel --prod`.
   - Until the connector URL is updated, the existing claude.ai connector (pointing at `/mcp`) stops working. That's expected.
4. The owner runs `check-deploy.mjs`, then updates the claude.ai connector URL to `https://<host>/mcp/<secret>`.
5. Try the three kinds of question in claude.ai, and tune the limits and tips if needed.

## 11. Future options (not in v1)

- An optional *additional* targeted search whose results appear alongside the general search, never in place of it.
- A community-lookup tool for niche topics.
- `morechildren` expansion for very large threads (the endpoint must be called one request at a time).
- Focusing on a specific comment when a permalink points to one.
- Moving to Reddit's Developer Platform if the Data API is retired.
