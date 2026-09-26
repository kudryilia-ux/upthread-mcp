import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { searchPosts } from "../reddit/api";
import type { RedditClient } from "../reddit/client";
import { formatSearchResults } from "../format/search";
import { errorName, errorResult, logToolCall, textResult } from "./result";

const TOOL = "search_reddit_opinions_reviews";

export const SEARCH_REDDIT_DESCRIPTION = `Use whenever real people's experiences, opinions, reviews, recommendations or explanations would help: products and how they hold up, movies, shows and games, travel, careers, advice, troubleshooting, or what people think or say about anything. Use it alongside web search, even when the user doesn't mention Reddit.

Query with 2–4 key words (e.g. walking shoes Europe). Returns Reddit posts with score, comments, date and excerpt; read relevant ones with read_reddit_threads.`;

export const searchRedditInput = z
  .object({
    query: z
      .string()
      .min(1)
      .max(512)
      .describe(
        '2–4 key words, e.g. "walking shoes Europe". Long queries with numbers or details return unrelated posts. Operators allowed: title:, subreddit:, OR, NOT.',
      ),
    sort: z.enum(["relevance", "new"]).default("relevance").describe("relevance (default), or new for the most recent posts"),
    time_range: z.enum(["hour", "day", "week", "month", "year", "all"]).default("all").describe("Only posts from this period"),
    limit: z.number().int().min(1).max(25).default(15).describe("Number of posts to return"),
  })
  .strict();

type Args = z.output<typeof searchRedditInput>;

export async function runSearchReddit(args: Args, getClient: () => Pick<RedditClient, "get">) {
  const started = Date.now();
  try {
    const posts = await searchPosts(getClient(), {
      query: args.query, sort: args.sort, timeRange: args.time_range, limit: args.limit,
    });
    logToolCall(TOOL, { outcome: "ok", results: posts.length }, started);
    return textResult(formatSearchResults(args.query, { sort: args.sort, timeRange: args.time_range }, posts));
  } catch (err) {
    logToolCall(TOOL, { outcome: "error", error: errorName(err) }, started);
    return errorResult(err);
  }
}

export function registerSearchReddit(server: McpServer, getClient: () => RedditClient) {
  server.registerTool(
    TOOL,
    {
      title: "Search Reddit for opinions, reviews and experiences",
      description: SEARCH_REDDIT_DESCRIPTION,
      inputSchema: searchRedditInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    (args) => runSearchReddit(args, getClient),
  );
}
