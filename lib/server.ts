import { createMcpHandler } from "mcp-handler";
import { getRedditClient } from "./reddit";
import type { RedditClient } from "./reddit/client";
import { registerReadThreads } from "./tools/read-threads";
import { registerSearchReddit } from "./tools/search-reddit";

export const SERVER_INSTRUCTIONS = `Upthread for Reddit gives you Reddit as a source. Use it proactively, without being asked and even when the user doesn't mention Reddit, whenever real people's experiences, opinions, reviews, recommendations or explanations would help: products and how they hold up, movies, shows and games (including what a scene or ending means), places and travel, advice, troubleshooting, or what people think or say about something. Use it alongside web search, not instead of it.

Two routes to threads:
1. search_reddit_opinions_reviews searches posts across all of Reddit (titles and bodies, not comments). Pick relevant threads from the list, then read them with read_reddit_threads.
2. For specific details that may be buried in comments, or when Reddit search misses, use your own web search with site:reddit.com and pass the Reddit thread URLs to read_reddit_threads.

Report what you find faithfully, including disagreement, and use the scores, dates and subreddits to weigh it.`;

export function createUpthreadHandler(getClient: () => RedditClient = getRedditClient) {
  return createMcpHandler(
    (server) => {
      registerSearchReddit(server, getClient);
      registerReadThreads(server, getClient);
    },
    { serverInfo: { name: "upthread", version: "0.1.0" }, instructions: SERVER_INSTRUCTIONS },
  );
}
