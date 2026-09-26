---
name: upthread
description: Check what real people say on Reddit using the Upthread connector. Use for any question where people's experiences, opinions, reviews, recommendations or explanations would help, such as how a product holds up, whether something is worth buying, comparisons, what a movie scene or ending means, travel tips, career or life advice, fitness routines, or fixing a problem. Use alongside web search even when the user doesn't mention Reddit.
---

# Upthread: Reddit as a source

Use this whenever the answer would be better with real people's experiences, opinions or explanations, not only official or editorial sources.

## Steps

1. If the Upthread tools aren't loaded yet, find them with tool search (search for "reddit"). The tools are `search_reddit_opinions_reviews` and `read_reddit_threads`.
2. Call `search_reddit_opinions_reviews` with 2–4 key words (for example `walking shoes Europe`, not a full sentence). If a name is ambiguous, add a brand or full model, or OR the variants.
3. If the best threads cluster in a few communities, also search within one or two of them with `subreddit:name` added to the query, in addition to the general search.
4. Pick the 2–5 most relevant threads and read them with `read_reddit_threads`. The comments hold most of the substance.
5. If web search is available, use it too, and combine both: Reddit for real-world experiences and opinions, the web for facts, specs and expert reviews. Report faithfully, including disagreement, and use scores, dates and subreddits to weigh what you found.

Your web search usually can't see Reddit pages, so use the Upthread tools for Reddit content. If the Upthread tools aren't available at all, say so briefly and answer from web search.
