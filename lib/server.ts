import { createMcpHandler } from "mcp-handler";
import { getRedditClient } from "./reddit";
import type { RedditClient } from "./reddit/client";
import { registerReadThreads } from "./tools/read-threads";
import { registerSearchReddit } from "./tools/search-reddit";

export const SERVER_INSTRUCTIONS = `Upthread for Reddit gives you Reddit as a source. Use it proactively, without being asked and even when the user doesn't mention Reddit, whenever real people's experiences, opinions, reviews, recommendations or explanations would help: products and how they hold up, movies, shows and games (including what a scene or ending means), places and travel, advice, troubleshooting, or what people think or say about something. Use it alongside web search, not instead of it.

How to use it: search with search_reddit_opinions_reviews using 2–4 key words (Reddit search matches posts, not comments), then read the relevant threads with read_reddit_threads; the comments hold most of the substance. Reddit links the user shares can be read directly. Your web search usually can't see Reddit pages, so use these tools for Reddit content.

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
