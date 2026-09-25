import { describe, expect, it } from "vitest";
import { formatSearchResults } from "@/lib/format/search";
import type { PostSummary } from "@/lib/reddit/types";

const post = (o: Partial<PostSummary> = {}): PostSummary => ({
  id: "1abc2de", title: "XM5 vs QC Ultra after six months", subreddit: "headphones", flair: "Review",
  score: 1234, upvoteRatio: 0.96, numComments: 340, createdUtc: 1741910400, isSelf: true,
  selftext: "I have used both daily for half a year.\n\nComfort goes to the QC.", url: "", domain: "self.headphones",
  over18: false, permalink: "https://reddit.com/comments/1abc2de", ...o,
});

describe("formatSearchResults", () => {
  it("renders header, subreddit breakdown and entries", () => {
    const posts = [
      post(),
      post({ id: "2b", subreddit: "SonyHeadphones", flair: null, title: "Long-term XM5 owners?" }),
      post({ id: "3c", subreddit: "SonyHeadphones", isSelf: false, selftext: "", domain: "youtube.com", over18: true, title: "Review video" }),
    ];
    const out = formatSearchResults("XM5", { sort: "relevance", timeRange: "all" }, posts);
    expect(out).toContain('Search "XM5" · relevance · all time · 3 results');
    expect(out).toContain("By subreddit: r/SonyHeadphones 2 · r/headphones 1");
    expect(out).toContain("1. [1abc2de] XM5 vs QC Ultra after six months");
    expect(out).toContain("   r/headphones · Review · 1.2k points (96%) · 340 comments · 2025-03-14");
    expect(out).toContain('   "I have used both daily for half a year. Comfort goes to the QC."');
    expect(out).toContain("3. [3c] [NSFW] Review video");
    expect(out).toContain("· link: youtube.com");
    expect(out).not.toContain("example_user");
  });

  it("groups beyond the top 4 subreddits as other", () => {
    const subs = ["a", "a", "b", "b", "c", "d", "e", "f"];
    const out = formatSearchResults("q", { sort: "top", timeRange: "year" }, subs.map((s, i) => post({ id: `p${i}`, subreddit: s })));
    expect(out).toContain("past year");
    expect(out).toContain("By subreddit: r/a 2 · r/b 2 · r/c 1 · r/d 1 · other 2");
  });

  it("trims excerpts to ~200 chars with an ellipsis", () => {
    const out = formatSearchResults("q", { sort: "relevance", timeRange: "all" }, [post({ selftext: "x".repeat(500) })]);
    expect(out).toContain('"' + "x".repeat(200) + '…"');
  });

  it("adds next-step hints for 0–2 results, and a no-results line for 0", () => {
    const none = formatSearchResults("zzz", { sort: "relevance", timeRange: "all" }, []);
    expect(none).toContain('No results for "zzz".');
    expect(none).toContain("site:reddit.com");
    const few = formatSearchResults("q", { sort: "relevance", timeRange: "all" }, [post()]);
    expect(few).toContain("Few results");
    const many = formatSearchResults("q", { sort: "relevance", timeRange: "all" }, [post(), post({ id: "b" }), post({ id: "c" })]);
    expect(many).not.toContain("Few results");
  });

  it("ends normal results with the search tips (moved out of the tool description)", () => {
    const out = formatSearchResults("q", { sort: "relevance", timeRange: "all" }, [post(), post({ id: "b" }), post({ id: "c" })]);
    const tips = out.slice(out.lastIndexOf("Tips:"));
    expect(tips).toMatch(/read_reddit_threads/);
    expect(tips).toMatch(/ambiguous/i);
    expect(tips).toMatch(/site:reddit\.com/);
    expect(tips).toMatch(/subreddit:/);
    expect(tips.length).toBeLessThan(600);
  });

  it("points thin results at read_reddit_threads by its new name", () => {
    expect(formatSearchResults("zzz", { sort: "relevance", timeRange: "all" }, [])).toContain("read_reddit_threads");
  });
});

describe("formatSearchResults final-review fixes", () => {
  it("shows the excerpt for link posts that have body text", () => {
    const out = formatSearchResults("q", { sort: "relevance", timeRange: "all" }, [
      post({ isSelf: false, domain: "i.redd.it", selftext: "Is this mold on my wall?" }),
    ]);
    expect(out).toContain("link: i.redd.it");
    expect(out).toContain('"Is this mold on my wall?"');
  });
});
