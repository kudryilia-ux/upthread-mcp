import type { CallToolResult } from "@modelcontextprotocol/server";
import { RedditError } from "../reddit/errors";

export const textResult = (text: string): CallToolResult => ({ content: [{ type: "text", text }] });

/** Known errors pass their message through; anything else gets a generic message. */
export function errorResult(err: unknown): CallToolResult {
  if (err instanceof RedditError) return { isError: true, content: [{ type: "text", text: err.message }] };
  return {
    isError: true,
    content: [{ type: "text", text: "Unexpected server error. Try again; if it keeps happening, the server owner should check the logs." }],
  };
}

/** Error type for logs: our error class name, or a generic label. Never the message. */
export const errorName = (err: unknown) =>
  err instanceof RedditError ? err.name : `unexpected:${err instanceof Error ? err.name : typeof err}`;

/**
 * One log line per tool call, e.g. `[upthread] tool=read_reddit_threads outcome=partial threads_ok=1 ms=412`.
 * Callers must only pass counts and error types: never queries, inputs, URLs, secrets or Reddit content.
 */
export function logToolCall(tool: string, fields: Record<string, string | number>, startedAt: number) {
  const line = [`[upthread] tool=${tool}`, ...Object.entries(fields).map(([k, v]) => `${k}=${v}`), `ms=${Date.now() - startedAt}`].join(" ");
  if (fields.outcome === "ok") console.info(line);
  else console.error(line);
}
