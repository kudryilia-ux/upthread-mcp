import type { RedditClient } from "./client";
import type { Comment, CommentSort, PostSummary, SearchSort, Thread, TimeRange } from "./types";

type Getter = Pick<RedditClient, "get">;
type Raw = Record<string, unknown>;
type Child = { kind?: string; data?: Raw };

const children = (listingJson: unknown): Child[] => {
  const c = (listingJson as { data?: { children?: unknown } } | undefined)?.data?.children;
  return Array.isArray(c) ? (c as Child[]) : [];
};
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function toPost(d: Raw): PostSummary {
  const id = str(d.id);
  return {
    id,
    title: str(d.title),
    subreddit: str(d.subreddit),
    flair: str(d.link_flair_text) || null,
    score: num(d.score),
    upvoteRatio: typeof d.upvote_ratio === "number" ? d.upvote_ratio : null,
    numComments: num(d.num_comments),
    createdUtc: num(d.created_utc),
    isSelf: d.is_self === true,
    selftext: str(d.selftext),
    url: str(d.url),
    domain: str(d.domain),
    over18: d.over_18 === true,
    permalink: `https://reddit.com/comments/${id}`,
  };
}

function toComments(list: unknown): Comment[] {
  return children(list)
    .filter((c) => c.kind === "t1" && c.data)
    .map(({ data: d }) => ({
      id: str(d!.id),
      author: str(d!.author),
      body: str(d!.body),
      score: num(d!.score),
      scoreHidden: d!.score_hidden === true,
      createdUtc: num(d!.created_utc),
      isOp: d!.is_submitter === true,
      isMod: d!.distinguished === "moderator",
      stickied: d!.stickied === true,
      replies: toComments(d!.replies),
    }));
}

export async function searchPosts(
  client: Getter,
  q: { query: string; sort: SearchSort; timeRange: TimeRange; limit: number },
): Promise<PostSummary[]> {
  const json = await client.get("/search", { q: q.query, sort: q.sort, t: q.timeRange, limit: q.limit, type: "link" });
  return children(json).filter((c) => c.kind === "t3" && c.data).map((c) => toPost(c.data!));
}

export async function getThread(client: Getter, id: string, o: { commentSort: CommentSort }): Promise<Thread> {
  const sort = o.commentSort === "best" ? "confidence" : o.commentSort;
  const json = (await client.get(`/comments/${id}`, { sort, limit: 100, depth: 3 })) as unknown[];
  const postData = children(json?.[0])[0]?.data ?? {};
  return { post: toPost(postData), comments: toComments(json?.[1]) };
}
