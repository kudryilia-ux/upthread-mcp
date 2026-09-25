import { describe, expect, it, vi } from "vitest";
import { getThread, searchPosts } from "@/lib/reddit/api";
import { listing, moreStub, rawComment, rawPost } from "../fixtures/reddit";

describe("searchPosts", () => {
  it("calls /search sitewide for links with the given params and normalizes posts", async () => {
    const get = vi.fn(async () => listing([rawPost(), rawPost({ id: "2x", is_self: false, selftext: "", domain: "youtube.com", url: "https://youtube.com/watch?v=abc", link_flair_text: null, upvote_ratio: undefined })]));
    const posts = await searchPosts({ get }, { query: "XM5", sort: "relevance", timeRange: "all", limit: 15 });
    expect(get).toHaveBeenCalledWith("/search", { q: "XM5", sort: "relevance", t: "all", limit: 15, type: "link" });
    expect(posts[0]).toEqual({
      id: "1abc2de", title: "XM5 vs QC Ultra after six months", subreddit: "headphones", flair: "Review",
      score: 1234, upvoteRatio: 0.96, numComments: 340, createdUtc: 1741910400, isSelf: true,
      selftext: expect.stringContaining("half a year"), url: expect.any(String), domain: "self.headphones",
      over18: false, permalink: "https://reddit.com/comments/1abc2de",
    });
    expect(posts[1]).toMatchObject({ isSelf: false, domain: "youtube.com", flair: null, upvoteRatio: null });
  });

  it("returns [] for an empty or malformed listing", async () => {
    await expect(searchPosts({ get: async () => listing([]) }, { query: "q", sort: "new", timeRange: "day", limit: 5 })).resolves.toEqual([]);
    await expect(searchPosts({ get: async () => ({}) }, { query: "q", sort: "new", timeRange: "day", limit: 5 })).resolves.toEqual([]);
  });
});

describe("getThread", () => {
  it("requests limit=100 depth=3 and maps best -> confidence", async () => {
    const get = vi.fn(async () => [listing([rawPost()]), listing([])]);
    await getThread({ get }, "1abc2de", { commentSort: "best" });
    expect(get).toHaveBeenCalledWith("/comments/1abc2de", { sort: "confidence", limit: 100, depth: 3 });
    await getThread({ get }, "1abc2de", { commentSort: "controversial" });
    expect(get).toHaveBeenLastCalledWith("/comments/1abc2de", { sort: "controversial", limit: 100, depth: 3 });
  });

  it("normalizes the comment tree, dropping 'more' stubs", async () => {
    const tree = [
      rawComment({ id: "c1", is_submitter: false }, [
        rawComment({ id: "c2", is_submitter: true, body: "OP reply" }, [rawComment({ id: "c3", distinguished: "moderator" })]),
        moreStub(),
      ]),
      moreStub(),
    ];
    const get = vi.fn(async () => [listing([rawPost()]), listing(tree)]);
    const { post, comments } = await getThread({ get }, "1abc2de", { commentSort: "top" });
    expect(post.id).toBe("1abc2de");
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ id: "c1", isOp: false, isMod: false, scoreHidden: false, stickied: false });
    expect(comments[0].replies).toHaveLength(1);
    expect(comments[0].replies[0]).toMatchObject({ id: "c2", isOp: true, body: "OP reply" });
    expect(comments[0].replies[0].replies[0]).toMatchObject({ id: "c3", isMod: true, replies: [] });
  });
});

describe("getThread final-review fixes", () => {
  it("throws ThreadUnavailableError when the post listing is empty", async () => {
    const get = vi.fn(async () => [listing([]), listing([])]);
    await expect(getThread({ get }, "1abc2de", { commentSort: "best" })).rejects.toThrow("Thread 1abc2de is unavailable");
  });
});
