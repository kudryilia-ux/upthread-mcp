---
name: upthread
description: Check what real people say on Reddit using the Upthread connector. Use for any question where people's experiences, opinions, reviews, recommendations or explanations would help, such as how a product holds up, whether something is worth buying, comparisons, what a movie scene or ending means, travel tips, career or life advice, fitness routines, or fixing a problem. Use alongside web search even when the user doesn't mention Reddit.
---

# Upthread: Reddit as a source

Use this whenever the answer would be better with real people's experiences, opinions or explanations, not only official or editorial sources.

## Steps

1. If the Upthread tools aren't loaded yet, find them with tool search (search for "reddit"). The tools are `search_reddit_opinions_reviews` and `read_reddit_threads`.
2. Call `search_reddit_opinions_reviews` with a short query written the way people title Reddit posts (product short names, "X vs Y", nicknames). If a name is ambiguous, add a brand or full model, or OR the variants.
3. Pick the 2–5 most relevant threads from the results and read them with `read_reddit_threads`. The comments hold most of the substance.
4. If Reddit search comes back thin, also run a web search with `site:reddit.com` and pass the Reddit links you find to `read_reddit_threads`.
5. Combine what you found with your web search results. Report faithfully, including disagreement, and use scores, dates and subreddits to weigh it (for example "a highly upvoted comment says…", "older threads report…, recent ones…").

If the Upthread tools aren't available at all, say so briefly and answer from web search.
