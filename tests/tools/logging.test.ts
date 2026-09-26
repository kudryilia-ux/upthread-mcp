import { afterEach, describe, expect, it, vi } from "vitest";
import { runSearchReddit, searchRedditInput } from "@/lib/tools/search-reddit";
import { readThreadsInput, runReadThreads } from "@/lib/tools/read-threads";
import { CredentialsError, ThreadUnavailableError } from "@/lib/reddit/errors";
import { listing, rawComment, rawPost } from "../fixtures/reddit";

// One line per tool call, so problems can be diagnosed from Vercel logs.
// Never the query, thread inputs, URLs, secrets or Reddit content.
const lines = () =>
  [...vi.mocked(console.info).mock.calls, ...vi.mocked(console.error).mock.calls].map((c) => c.map(String).join(" "));

afterEach(() => vi.restoreAllMocks());

describe("tool call logging (v1.1)", () => {
  it("logs one line for a successful search with count and duration, without the query", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await runSearchReddit(searchRedditInput.parse({ query: "private walking query" }), () => ({ get: async () => listing([rawPost()]) }));
    const l = lines();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatch(/\[upthread\] tool=search_reddit_opinions_reviews outcome=ok results=1 ms=\d+/);
    expect(l[0]).not.toContain("private walking query");
  });

  it("logs a failed search with the error type", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    await runSearchReddit(searchRedditInput.parse({ query: "x" }), () => { throw new CredentialsError(); });
    const l = lines();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatch(/tool=search_reddit_opinions_reviews outcome=error error=CredentialsError ms=\d+/);
  });

  it("logs one line for read_threads with ok/failed counts and error types, without inputs", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const get = vi.fn(async (path: string) => {
      if (path.endsWith("bad")) throw new ThreadUnavailableError("bad");
      return [listing([rawPost({ id: "ok" })]), listing([rawComment()])];
    });
    await runReadThreads(readThreadsInput.parse({ threads: ["ok", "https://redd.it/bad"] }), () => ({ get, resolveShareLink: vi.fn() }));
    const l = lines();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatch(/tool=read_reddit_threads outcome=partial threads_ok=1 threads_failed=1 errors=ThreadUnavailableError ms=\d+/);
    expect(l[0]).not.toContain("redd.it");
  });
});
