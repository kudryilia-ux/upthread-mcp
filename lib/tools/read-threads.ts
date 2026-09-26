import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { getThread } from "../reddit/api";
import type { RedditClient } from "../reddit/client";
import { RedditError } from "../reddit/errors";
import { resolveThreadRef } from "../reddit/refs";
import { SOURCE_NOTE } from "../format/common";
import { formatThread } from "../format/thread";
import { errorName, errorResult, logToolCall, textResult } from "./result";

const TOOL = "read_reddit_threads";

export const READ_THREADS_DESCRIPTION = `Read up to 5 Reddit threads: the post plus its top comments and replies, with scores, dates and (OP) markers. Use it on post IDs from search_reddit_opinions_reviews and on Reddit links the user shares. The comments hold most of the experiences and answers.

comment_sort: best (default), top, controversial (range of views; top-level only), new, qa.`;

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
  const started = Date.now();
  let client: Pick<RedditClient, "get" | "resolveShareLink">;
  try {
    client = getClient();
  } catch (err) {
    logToolCall(TOOL, { outcome: "error", error: errorName(err) }, started);
    return errorResult(err);
  }
  const results = await Promise.all(
    args.threads.map(async (input) => {
      try {
        const id = await resolveThreadRef(input, client);
        const thread = await getThread(client, id, { commentSort: args.comment_sort });
        return { ok: true as const, text: formatThread(thread, args.comment_sort) };
      } catch (err) {
        const message = err instanceof RedditError ? err.message : errorText(err);
        return { ok: false as const, error: errorName(err), text: `=== [${input}] unavailable: ${message}` };
      }
    }),
  );
  const failed = results.filter((r) => !r.ok);
  const outcome = failed.length === 0 ? "ok" : failed.length === results.length ? "error" : "partial";
  const errors = [...new Set(failed.map((r) => ("error" in r ? r.error : "")))].join(",");
  logToolCall(
    TOOL,
    { outcome, threads_ok: results.length - failed.length, threads_failed: failed.length, ...(errors ? { errors } : {}) },
    started,
  );
  const body = results.map((r) => r.text).join("\n\n");
  if (outcome === "error") return { isError: true, content: [{ type: "text" as const, text: body }] };
  return textResult(`${SOURCE_NOTE}\n\n${body}`);
}

function errorText(err: unknown): string {
  const r = errorResult(err);
  return (r.content[0] as { text: string }).text;
}

export function registerReadThreads(server: McpServer, getClient: () => RedditClient) {
  server.registerTool(
    TOOL,
    {
      title: "Read Reddit threads and comments",
      description: READ_THREADS_DESCRIPTION,
      inputSchema: readThreadsInput,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    (args) => runReadThreads(args, getClient),
  );
}
