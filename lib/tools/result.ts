import type { CallToolResult } from "@modelcontextprotocol/server";
import { RedditError } from "../reddit/errors";

export const textResult = (text: string): CallToolResult => ({ content: [{ type: "text", text }] });

/** Known errors pass their message through; anything else is logged by name only. */
export function errorResult(err: unknown): CallToolResult {
  if (err instanceof RedditError) {
    console.error(`[upthread] ${err.name}`);
    return { isError: true, content: [{ type: "text", text: err.message }] };
  }
  console.error(`[upthread] unexpected ${err instanceof Error ? err.name : typeof err}`);
  return {
    isError: true,
    content: [{ type: "text", text: "Unexpected server error. Try again; if it keeps happening, the server owner should check the logs." }],
  };
}
