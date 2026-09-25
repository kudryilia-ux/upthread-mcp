import { createMcpHandler } from "mcp-handler";
import { getRedditClient } from "./reddit";
import type { RedditClient } from "./reddit/client";
import { registerReadThreads } from "./tools/read-threads";
import { registerSearchReddit } from "./tools/search-reddit";

export const SERVER_INSTRUCTIONS = `Upthread for Reddit lets you use Reddit as a source alongside web search, for any question where people's experiences, opinions, explanations or niche knowledge help.

Two routes to threads:
1. search_reddit searches posts across all of Reddit (titles and bodies, not comments). Pick relevant threads from the list, then read them with read_threads.
2. For specific details that may be buried in comments, or when Reddit search misses, use your own web search with site:reddit.com and pass the Reddit thread URLs to read_threads.

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
