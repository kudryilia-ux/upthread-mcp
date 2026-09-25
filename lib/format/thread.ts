import type { Comment, CommentSort, Thread } from "../reddit/types";
import { collapse, formatDate, formatRatio, formatScore, trimText } from "./common";

export const THREAD_LIMITS = { postChars: 4000, commentChars: 600, topLevel: 20, depth2: 3, depth3: 2 } as const;
const PER_DEPTH = [THREAD_LIMITS.topLevel, THREAD_LIMITS.depth2, THREAD_LIMITS.depth3];

const isNoise = (c: Comment) =>
  c.body === "[deleted]" || c.body === "[removed]" || c.author === "AutoModerator" || c.stickied;

export function selectComments(comments: Comment[], depth = 0): Comment[] {
  const cap = PER_DEPTH[depth] ?? 0;
  return comments
    .filter((c) => !isNoise(c))
    .slice(0, cap)
    .map((c) => ({ ...c, replies: selectComments(c.replies, depth + 1) }));
}

function count(comments: Comment[]): number {
  return comments.reduce((n, c) => n + 1 + count(c.replies), 0);
}

function renderComments(comments: Comment[], depth: number, out: string[]) {
  for (const c of comments) {
    const indent = "  ".repeat(depth) + (depth > 0 ? "↳ " : "");
    const score = c.scoreHidden ? "[score hidden]" : `[▲${formatScore(c.score)}]`;
    const markers = [c.isOp ? "(OP)" : "", c.isMod ? "(mod)" : ""].filter(Boolean).join(" ");
    const body = trimText(collapse(c.body), THREAD_LIMITS.commentChars);
    const date = depth === 0 ? ` [${formatDate(c.createdUtc)}]` : "";
    out.push(`${indent}${score} ${markers ? markers + " " : ""}${body}${date}`);
    renderComments(c.replies, depth + 1, out);
  }
}

export function formatThread({ post, comments }: Thread, commentSort: CommentSort): string {
  const ratio = formatRatio(post.upvoteRatio);
  const lines = [
    `=== [${post.id}] ${post.over18 ? "[NSFW] " : ""}${post.title}`,
    [
      `r/${post.subreddit}`,
      `${formatScore(post.score)} points${ratio ? ` (${ratio})` : ""}`,
      `${post.numComments} comments`,
      formatDate(post.createdUtc),
      post.permalink,
    ].join(" · "),
  ];
  if (!post.isSelf) lines.push(`Link: ${post.url}`);
  const body = post.selftext.replace(/\n{3,}/g, "\n\n").trim();
  if (post.isSelf || body) {
    lines.push(`Post (OP): ${body ? trimText(body, THREAD_LIMITS.postChars) : "(no text)"}`);
  }
  const kept = selectComments(comments);
  lines.push("");
  if (kept.length === 0) {
    lines.push("Comments: none shown.");
  } else {
    lines.push(`Comments (${commentSort} · ${count(kept)} shown of ${post.numComments}):`);
    renderComments(kept, 0, lines);
  }
  return lines.join("\n");
}
