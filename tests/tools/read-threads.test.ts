import { describe, expect, it, vi } from "vitest";
import { readThreadsInput, runReadThreads, READ_THREADS_DESCRIPTION } from "@/lib/tools/read-threads";
import { RateLimitedError, ThreadUnavailableError } from "@/lib/reddit/errors";
import { listing, rawComment, rawPost } from "../fixtures/reddit";

const threadJson = (id: string) => [listing([rawPost({ id, title: `Thread ${id}` })]), listing([rawComment()])];
const text = (r: { content: unknown[] }) => (r.content[0] as { text: string }).text;

describe("read_threads", () => {
  it("validates 1–5 threads and defaults comment_sort to best", () => {
    expect(readThreadsInput.parse({ threads: ["a"] })).toEqual({ threads: ["a"], comment_sort: "best" });
    expect(() => readThreadsInput.parse({ threads: [] })).toThrow();
    expect(() => readThreadsInput.parse({ threads: ["a", "b", "c", "d", "e", "f"] })).toThrow();
  });

  it("fetches in parallel and returns threads in input order", async () => {
    const get = vi.fn(async (path: string) => threadJson(path.split("/").pop()!));
    const res = await runReadThreads(
      readThreadsInput.parse({ threads: ["t3_aaa", "https://redd.it/bbb"], comment_sort: "top" }),
      () => ({ get, resolveShareLink: vi.fn() }),
    );
    expect(res.isError).toBeFalsy();
    const out = text(res);
    expect(out.indexOf("[aaa] Thread aaa")).toBeLessThan(out.indexOf("[bbb] Thread bbb"));
    expect(out).toContain("Comments (top ·");
  });

  it("keeps successful threads when one fails, with an error line for the failure", async () => {
    const get = vi.fn(async (path: string) => {
      if (path.endsWith("bad")) throw new ThreadUnavailableError("bad");
      return threadJson("ok");
    });
    const res = await runReadThreads(readThreadsInput.parse({ threads: ["ok", "bad", "not a thread"] }), () => ({ get, resolveShareLink: vi.fn() }));
    expect(res.isError).toBeFalsy();
    const out = text(res);
    expect(out).toContain("[ok] Thread ok");
    expect(out).toContain("=== [bad] unavailable: Thread bad is unavailable");
    expect(out).toContain('=== [not a thread] unavailable: Couldn\'t read "not a thread"');
  });

  it("returns isError when every thread fails (Review Focus 2)", async () => {
    const get = vi.fn(async () => { throw new RateLimitedError(30); });
    const res = await runReadThreads(readThreadsInput.parse({ threads: ["a", "b"] }), () => ({ get, resolveShareLink: vi.fn() }));
    expect(res.isError).toBe(true);
    expect(text(res)).toContain("rate limit");
  });

  it("returns isError when the client cannot be built", async () => {
    const res = await runReadThreads(readThreadsInput.parse({ threads: ["a"] }), () => { throw new ThreadUnavailableError("x"); });
    expect(res.isError).toBe(true);
  });

  it("description mentions user-shared links and controversial sort, and stays neutral", () => {
    expect(READ_THREADS_DESCRIPTION).toMatch(/links the user shares/i);
    expect(READ_THREADS_DESCRIPTION).toMatch(/controversial/);
    expect(READ_THREADS_DESCRIPTION).not.toMatch(/consensus/i);
    expect(READ_THREADS_DESCRIPTION.length).toBeLessThanOrEqual(500);
    expect(READ_THREADS_DESCRIPTION).toMatch(/search_reddit_opinions_reviews/);
  });
});
