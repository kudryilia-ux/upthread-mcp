import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getThread } from "../reddit/api";
import type { RedditClient } from "../reddit/client";
import { RedditError } from "../reddit/errors";
import { resolveThreadRef } from "../reddit/refs";
import { formatThread } from "../format/thread";
import { errorResult, textResult } from "./result";

export const READ_THREADS_DESCRIPTION = `Read up to 5 Reddit threads: each post plus a bounded set of its comments and replies (20 top-level comments, up to 3 levels deep, long text trimmed), with scores, dates and (OP)/(mod) markers. Use it on post IDs from search_reddit, and on any Reddit links your web search finds, since Reddit pages usually can't be opened directly. The comments are where most of the experiences and answers are.

Accepts post IDs from search_reddit, or Reddit URLs in any common form (reddit.com, old/new/np/m.reddit.com, redd.it, share links, comment permalinks), including Reddit links found with your web search.
comment_sort: best (default) for the most useful comments; top for the highest scored; controversial when the range of views matters (returns top-level comments only); new for recent replies; qa for Q&A-style threads.
If one thread fails, the others are still returned.`;

export const readThreadsInput = z
  .object({
    threads: z.array(z.string().min(1).max(500)).min(1).max(5).describe("Post IDs or Reddit URLs"),
    comment_sort: z.enum(["best", "top", "controversial", "new", "qa"]).default("best").describe("Comment order"),
  })
  .strict();

type Args = z.output<typeof readThreadsInput>;

export async function runReadThreads(
  args: Args,
  getClient: () => Pick<RedditClient, "get" | "resolveShareLink">,
) {
  let client: Pick<RedditClient, "get" | "resolveShareLink">;
  try {
    client = getClient();
  } catch (err) {
    return errorResult(err);
  }
  const results = await Promise.all(
    args.threads.map(async (input) => {
      try {
        const id = await resolveThreadRef(input, client);
        const thread = await getThread(client, id, { commentSort: args.comment_sort });
        return { ok: true as const, text: formatThread(thread, args.comment_sort) };
      } catch (err) {
        if (!(err instanceof RedditError)) return { ok: false as const, text: `=== [${input}] unavailable: ${errorText(err)}` };
        console.error(`[upthread] ${err.name}`);
        return { ok: false as const, text: `=== [${input}] unavailable: ${err.message}` };
      }
    }),
  );
  const body = results.map((r) => r.text).join("\n\n");
  if (results.every((r) => !r.ok)) return { isError: true, content: [{ type: "text" as const, text: body }] };
  return textResult(body);
}

function errorText(err: unknown): string {
  const r = errorResult(err);
  return (r.content[0] as { text: string }).text;
}

export function registerReadThreads(server: McpServer, getClient: () => RedditClient) {
  server.registerTool(
    "read_threads",
    {
      title: "Read Reddit threads",
      description: READ_THREADS_DESCRIPTION,
      inputSchema: readThreadsInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    (args) => runReadThreads(args, getClient),
  );
}
