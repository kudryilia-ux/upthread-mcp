import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { searchPosts } from "../reddit/api";
import type { RedditClient } from "../reddit/client";
import { formatSearchResults } from "../format/search";
import { errorResult, textResult } from "./result";

export const SEARCH_REDDIT_DESCRIPTION = `Search Reddit posts across all of Reddit. Returns a compact list: post ID, title, subreddit, flair, score with upvote ratio, comment count, date, and a short excerpt. It does not return comments; pass the relevant post IDs to read_threads for those.

Reddit search is keyword-based and matches post titles and bodies, not comments. Tips:
- Write queries the way Redditors title posts: short product or topic names, "X vs Y", common nicknames.
- If a name is ambiguous (for example "XM5" is both headphones and a camera), add a distinguishing word (brand, full model) or OR the variants: XM5 OR "WH-1000XM5".
- Operators work: title:, selftext:, subreddit:, author:, flair:, site:, self:true, AND/OR/NOT, parentheses. Exact-phrase quotes are unreliable; don't depend on them.
- Keep sort=relevance by default. Use sort=top or sort=new with time_range for popular or recent posts.
- FAQ, megathread and "discussion" threads often hold the best answers.
- A subreddit:name search is only ever an addition to a general search, never a replacement.
- If results are thin or off-topic, rephrase and search again, or use your web search with site:reddit.com (it indexes comment text) and pass the thread URLs to read_threads.
Read only threads that are clearly relevant to the question.`;

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
    "search_reddit",
    {
      title: "Search Reddit",
      description: SEARCH_REDDIT_DESCRIPTION,
      inputSchema: searchRedditInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    (args) => runSearchReddit(args, getClient),
  );
}
