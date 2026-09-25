import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { searchPosts } from "../reddit/api";
import type { RedditClient } from "../reddit/client";
import { formatSearchResults } from "../format/search";
import { errorResult, textResult } from "./result";

export const SEARCH_REDDIT_DESCRIPTION = `Use whenever real people's experiences, opinions, reviews, recommendations or explanations would help: products and how they hold up, movies, shows and games (including what a scene means), travel, careers, advice, troubleshooting, or what people think or say about anything. Call it alongside web search, even when the user doesn't mention Reddit.

Returns matching Reddit posts with score, comments, date and excerpt. Then read the relevant ones with read_reddit_threads.`;

export const searchRedditInput = z
  .object({
    query: z.string().min(1).max(512).describe("Search query; Reddit search operators allowed"),
    sort: z.enum(["relevance", "top", "new", "comments"]).default("relevance").describe("Result order"),
    time_range: z.enum(["hour", "day", "week", "month", "year", "all"]).default("all").describe("Only posts from this period"),
    limit: z.number().int().min(1).max(25).default(15).describe("Number of posts to return"),
  })
  .strict();

type Args = z.output<typeof searchRedditInput>;

export async function runSearchReddit(args: Args, getClient: () => Pick<RedditClient, "get">) {
  try {
    const posts = await searchPosts(getClient(), {
      query: args.query, sort: args.sort, timeRange: args.time_range, limit: args.limit,
    });
    return textResult(formatSearchResults(args.query, { sort: args.sort, timeRange: args.time_range }, posts));
  } catch (err) {
    return errorResult(err);
  }
}

export function registerSearchReddit(server: McpServer, getClient: () => RedditClient) {
  server.registerTool(
    "search_reddit_opinions_reviews",
    {
      title: "Search Reddit for opinions, reviews and experiences",
      description: SEARCH_REDDIT_DESCRIPTION,
      inputSchema: searchRedditInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    (args) => runSearchReddit(args, getClient),
  );
}
