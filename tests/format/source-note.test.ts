import { describe, expect, it, vi } from "vitest";
import { formatSearchResults } from "@/lib/format/search";
import { SOURCE_NOTE } from "@/lib/format/common";
import { readThreadsInput, runReadThreads } from "@/lib/tools/read-threads";
import type { PostSummary } from "@/lib/reddit/types";
import { listing, rawComment, rawPost } from "../fixtures/reddit";

const post = (o: Partial<PostSummary> = {}): PostSummary => ({
  id: "1abc2de", title: "t", subreddit: "s", flair: null, score: 1, upvoteRatio: 1, numComments: 1, createdUtc: 1741910400,
  isSelf: true, selftext: "x", url: "", domain: "self.s", over18: false, permalink: "https://reddit.com/comments/1abc2de", ...o,
});

describe("source note (how to weigh Reddit as evidence)", () => {
  it("describes the evidence without giving orders", () => {
    expect(SOURCE_NOTE).toMatch(/^About this source:/);
    expect(SOURCE_NOTE).toMatch(/first-hand experience/);
    expect(SOURCE_NOTE).toMatch(/editorial or official sources/);
    expect(SOURCE_NOTE).toMatch(/other sources are thin/);
    expect(SOURCE_NOTE).not.toMatch(/web search|you should|you must|always|never/i);
  });

  it("appears once at the top of search results, but not on empty results", () => {
    const out = formatSearchResults("q", { sort: "relevance", timeRange: "all" }, [post(), post({ id: "b" }), post({ id: "c" })]);
    expect(out.startsWith(SOURCE_NOTE)).toBe(true);
    expect(out.split(SOURCE_NOTE)).toHaveLength(2);
    expect(formatSearchResults("q", { sort: "relevance", timeRange: "all" }, [])).not.toContain(SOURCE_NOTE);
  });

  it("appears once at the top of read_threads output, however many threads, and not when all fail", async () => {
    const get = vi.fn(async (path: string) => [listing([rawPost({ id: path.split("/").pop() })]), listing([rawComment()])]);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await runReadThreads(readThreadsInput.parse({ threads: ["aaa", "bbb"] }), () => ({ get, resolveShareLink: vi.fn() }));
    const text = (ok.content[0] as { text: string }).text;
    expect(text.startsWith(SOURCE_NOTE)).toBe(true);
    expect(text.split(SOURCE_NOTE)).toHaveLength(2);
    const bad = await runReadThreads(readThreadsInput.parse({ threads: ["not a thread"] }), () => ({ get, resolveShareLink: vi.fn() }));
    expect((bad.content[0] as { text: string }).text).not.toContain(SOURCE_NOTE);
    vi.restoreAllMocks();
  });
});
