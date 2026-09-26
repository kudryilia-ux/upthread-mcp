import { describe, expect, it } from "vitest";
import { formatThread, selectComments, THREAD_LIMITS } from "@/lib/format/thread";
import type { Comment, PostSummary } from "@/lib/reddit/types";

const post = (o: Partial<PostSummary> = {}): PostSummary => ({
  id: "1abc2de", title: "What does the opening scene mean?", subreddit: "movies", flair: null,
  score: 4500, upvoteRatio: 0.94, numComments: 1203, createdUtc: 1741910400, isSelf: true,
  selftext: "I watched it twice and still don't get it.", url: "", domain: "self.movies",
  over18: false, permalink: "https://reddit.com/comments/1abc2de", ...o,
});
let n = 0;
const c = (o: Partial<Comment> = {}, replies: Comment[] = []): Comment => ({
  id: `c${n++}`, author: "someone", body: "A comment.", score: 10, scoreHidden: false, createdUtc: 1741914000,
  isOp: false, isMod: false, stickied: false, replies, ...o,
});

describe("selectComments", () => {
  it("drops deleted, removed, AutoModerator and stickied comments (with their replies)", () => {
    const kept = selectComments([
      c({ body: "[deleted]" }, [c({ body: "orphan" })]),
      c({ body: "[removed]" }),
      c({ author: "AutoModerator" }),
      c({ stickied: true }),
      c({ body: "keep me" }),
    ]);
    expect(kept.map((k) => k.body)).toEqual(["keep me"]);
  });

  it("caps top-level at 20, depth-2 at 3 and depth-3 at 2, and cuts deeper levels", () => {
    const deep = c({}, [c({}, [c(), c(), c()]), c(), c(), c()]);
    const top = [deep, ...Array.from({ length: 30 }, () => c())];
    const kept = selectComments(top);
    expect(kept).toHaveLength(THREAD_LIMITS.topLevel);
    expect(kept[0].replies).toHaveLength(3);
    expect(kept[0].replies[0].replies).toHaveLength(2);
    expect(kept[0].replies[0].replies[0].replies).toHaveLength(0);
  });
});

describe("formatThread", () => {
  it("renders header, post, and threaded comments with markers but no usernames", () => {
    const out = formatThread(
      {
        post: post(),
        comments: [
          c({ score: 2300, body: "It's a\n\nflash-forward." }, [c({ isOp: true, score: 812, body: "Oh, that helps." }, [c({ isMod: true, score: 95, body: "Mod note." })])]),
          c({ scoreHidden: true, body: "New take." }),
        ],
      },
      "best",
    );
    expect(out).toContain("=== [1abc2de] What does the opening scene mean?");
    expect(out).toContain("r/movies · 4.5k points (94%) · 1203 comments · 2025-03-14 · https://reddit.com/comments/1abc2de");
    expect(out).toContain("Post (OP): I watched it twice and still don't get it.");
    expect(out).toContain("Comments (best · 4 shown of 1203):");
    expect(out).toContain("[▲2.3k] It's a flash-forward. [2025-03-14]");
    expect(out).toContain("  ↳ [▲812] (OP) Oh, that helps.");
    expect(out).toContain("    ↳ [▲95] (mod) Mod note.");
    expect(out).toContain("[score hidden] New take.");
    expect(out).not.toContain("someone");
  });

  it("handles empty self posts and link posts (Review Focus 3)", () => {
    expect(formatThread({ post: post({ selftext: "" }), comments: [] }, "top")).toContain("Post (OP): (no text)");
    const link = formatThread({ post: post({ isSelf: false, selftext: "", url: "https://i.example.com/pic.jpg", domain: "i.example.com" }), comments: [] }, "top");
    expect(link).toContain("Link: https://i.example.com/pic.jpg");
    expect(link).not.toContain("undefined");
    expect(link).toContain("Comments: none shown.");
  });

  it("trims post bodies at 4000 and comments at 600 chars (Review Focus 4)", () => {
    const longUrl = "https://example.com/" + "a".repeat(900);
    const out = formatThread({ post: post({ selftext: "p".repeat(5000) }), comments: [c({ body: `see ${longUrl}` })] }, "best");
    expect(out).toContain("p".repeat(THREAD_LIMITS.postChars) + "…[trimmed]");
    const commentLine = out.split("\n").find((l) => l.includes("see https://"))!;
    expect(commentLine.length).toBeLessThan(THREAD_LIMITS.commentChars + 60);
    expect(commentLine).toContain("…[trimmed]");
  });

  it("marks NSFW posts", () => {
    expect(formatThread({ post: post({ over18: true }), comments: [] }, "best")).toContain("=== [1abc2de] [NSFW] ");
  });
});

describe("formatThread final-review fixes", () => {
  it("shows both the link and the OP's text for image posts with a body", () => {
    const out = formatThread(
      { post: post({ isSelf: false, url: "https://i.example.com/pic.jpg", selftext: "Is this mold on my wall?" }), comments: [] },
      "best",
    );
    expect(out).toContain("Link: https://i.example.com/pic.jpg");
    expect(out).toContain("Post (OP): Is this mold on my wall?");
  });
});

describe("formatThread hides usernames mentioned in text (v1.1)", () => {
  it("redacts u/ mentions in post bodies and comments", () => {
    const out = formatThread({ post: post({ selftext: "Credit to u/helper_one." }), comments: [c({ body: "u/Fjurious is right" })] }, "best");
    expect(out).not.toMatch(/helper_one|Fjurious/);
    expect(out).toContain("u/[user]");
  });
});
