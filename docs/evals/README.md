# Upthread evals: plan

**Status:** planned, not built (tabled 2026-09-26). This is the plan for measuring and improving every part of Upthread we control, so changes are judged by numbers instead of single chats (Claude's behavior varies from chat to chat).

## What we control, and what measures it

| Part | Examples of changes | Measured by |
|---|---|---|
| Search strategy | query shortening, community expansion, sort defaults, optional web-search discovery | E1 |
| Tool names, descriptions, result notes | wording, length, when-to-use text | E2 |
| Output format and limits | 4,000-char posts, 20 comments, reply depth, excerpt length | E3 |
| Real claude.ai behavior | default vs "Tools already loaded", web search on/off, skill | E4 (manual) |

## E1: Retrieval (does our search surface the best threads?)

- **Question set:** 30–50 real questions across products, travel, media (incl. "what does this scene mean"), advice, fitness, troubleshooting and niche hobbies. Stored in `docs/evals/questions.json` with categories.
- **Gold threads:** for each question, the top Reddit threads Google finds, pulled once through a SERP API (Serper's free tier) and saved, then pooled with threads our own strategies return and judged relevant/not (LLM judge with spot checks by a person). Google favors popular, older threads, so gold is "known good", not "complete".
- **Strategies compared:**
  1. Claude-style long query, as-is (baseline)
  2. short 2–4 key-word query
  3. short query + searches within the top 2 communities from the results
  4. short query + communities from `/subreddits/search`
  5. (optional) web-search discovery via a SERP or Brave API
- **Metrics per strategy:** gold recall@10 and @25, precision@10, age and score of the best relevant thread, Reddit calls used.
- **Cost:** free (Reddit API + one saved SERP pull). Runs locally via `op run`.
- **First case already collected:** "best walking shoes for Europe" (probe on 2026-09-26): long query 2/10 relevant, 3-word query 9/10, community searches 6–10/10.

## E2: Tool use (given the tools, does Claude call them well?)

- **Harness:** Claude API with Upthread attached as a remote MCP server and the web search tool enabled. Also run with web search off (the desktop stall case), and, if the API's tool-search feature can defer tools like claude.ai's default mode, with Upthread deferred.
- **Questions:** E1's set plus ~10 where Reddit is the wrong source ("capital of Peru", "convert 5 miles to km").
- **Runs:** 5 per question per configuration (behavior varies).
- **Metrics:** Upthread use rate on positive questions, false-use rate on negative ones, rate of also using web search, query length and operator use, calls per answer, errors, turns that end without an answer.
- **Cost:** a few dollars per full run (API billing, separate from any Claude subscription).

## E3: Answer quality (are answers better with Upthread?)

- Same questions, answered with and without Upthread, compared pairwise by an LLM judge against a rubric: grounded in the threads actually read, shows the range of views, uses upvotes/dates/subreddits sensibly, combines with web facts when available, no invented Reddit claims.
- Then ablations on output limits (e.g. 3 vs 5 threads, 600 vs 400 char comments) to find the best quality per token.
- **Source weighting.** Rubric item: does the answer weigh Reddit appropriately, using it for first-hand experience, ideas and corroboration, deferring to editorial or official sources on facts, specs, safety and medical questions, and leaning on it more when other sources are thin? Compare versions of the source note at the top of results (added 2026-09-26): none, the current wording, and shorter or stronger variants. Watch for side effects: unnecessary "Reddit is anecdotal" disclaimers in answers, or Claude using Upthread less.
- **Cost:** a few dollars per run.

## E4: claude.ai checklist (manual)

See [`claude-ai-checklist.md`](claude-ai-checklist.md). About 10 minutes; run after every release.

## Changes waiting on evals

These are only shipped if the eval shows a clear gain:

| Change | Gate |
|---|---|
| Automatic query shortening (server simplifies long queries and searches both) | E1: recall@10 up clearly vs strategy 1 without hurting strategy 2 |
| Automatic searches within the top communities | E1: recall up enough to justify ~2 extra calls per search |
| Optional web-search discovery (one optional `SEARCH_API_KEY`, provider swappable: Serper / Brave / Tavily) | E1: meaningful recall gain over strategies 2–4 |
| Output limit changes | E3 |
| Description/notes wording changes | E2 |
| Source note wording (how to weigh Reddit vs other sources) | E3 source-weighting rubric, plus E2 use rate |

## Rules

- Commit only questions, gold thread IDs and aggregate scores. Never commit Reddit content.
- Eval outputs with Reddit content stay local (git-ignored) and are deleted within 48 hours (Reddit's guidance).
- Anything using credentials is run by the owner via `op run`.
- Space runs out: Reddit allows ~100 requests per minute per app.

## Build order (when un-tabled)

1. E1 runner (`scripts/eval/retrieval.mjs`), question set, gold pull (owner creates a free Serper account).
2. Decide the gated search changes from E1.
3. E2 harness (needs an Anthropic API key and a small budget).
4. E3 on top of E2's harness.
