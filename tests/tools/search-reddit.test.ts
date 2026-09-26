import { describe, expect, it, vi } from "vitest";
import { runSearchReddit, searchRedditInput, SEARCH_REDDIT_DESCRIPTION } from "@/lib/tools/search-reddit";
import { CredentialsError, RateLimitedError } from "@/lib/reddit/errors";
import { listing, rawPost } from "../fixtures/reddit";

describe("search_reddit", () => {
  it("applies defaults: relevance, all, 15", () => {
    expect(searchRedditInput.parse({ query: "XM5" })).toEqual({ query: "XM5", sort: "relevance", time_range: "all", limit: 15 });
  });

  it("offers only relevance and new as sorts (top and comments return junk for topics)", () => {
    expect(searchRedditInput.parse({ query: "x", sort: "new" }).sort).toBe("new");
    expect(() => searchRedditInput.parse({ query: "x", sort: "top" })).toThrow();
    expect(() => searchRedditInput.parse({ query: "x", sort: "comments" })).toThrow();
  });

  it("tells Claude to use 2–4 key words in the query parameter itself", () => {
    expect(searchRedditInput.shape.query.description).toMatch(/2–4 key words/);
    expect(SEARCH_REDDIT_DESCRIPTION).toMatch(/2–4 key words/);
  });

  it("rejects empty or overlong queries and out-of-range limits", () => {
    expect(() => searchRedditInput.parse({ query: "" })).toThrow();
    expect(() => searchRedditInput.parse({ query: "x".repeat(513) })).toThrow();
    expect(() => searchRedditInput.parse({ query: "x", limit: 26 })).toThrow();
  });

  it("returns formatted text on success", async () => {
    const get = vi.fn(async () => listing([rawPost()]));
    const res = await runSearchReddit(searchRedditInput.parse({ query: "XM5" }), () => ({ get }));
    expect(res.isError).toBeFalsy();
    expect(res.content[0]).toMatchObject({ type: "text" });
    expect((res.content[0] as { text: string }).text).toContain("[1abc2de]");
  });

  it("returns isError with the RedditError message", async () => {
    const res = await runSearchReddit(searchRedditInput.parse({ query: "XM5" }), () => {
      throw new CredentialsError();
    });
    expect(res).toEqual({ isError: true, content: [{ type: "text", text: new CredentialsError().message }] });
    const rl = await runSearchReddit(searchRedditInput.parse({ query: "XM5" }), () => ({
      get: async () => { throw new RateLimitedError(9); },
    }));
    expect((rl.content[0] as { text: string }).text).toContain("~9s");
  });

  it("hides unexpected error details and logs only the error name", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runSearchReddit(searchRedditInput.parse({ query: "XM5" }), () => ({
      get: async () => { throw new Error("secret-ish internal detail"); },
    }));
    expect(res.isError).toBe(true);
    expect(JSON.stringify(res)).not.toContain("secret-ish");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-ish");
    log.mockRestore();
  });

  it("description fits claude.ai's ~500-character limit, names the next tool, and stays neutral", () => {
    expect(SEARCH_REDDIT_DESCRIPTION.length).toBeLessThanOrEqual(500);
    expect(SEARCH_REDDIT_DESCRIPTION).toMatch(/read_reddit_threads/);
    expect(SEARCH_REDDIT_DESCRIPTION).not.toMatch(/consensus/i);
  });
});
