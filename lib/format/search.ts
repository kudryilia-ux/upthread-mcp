import type { PostSummary, SearchSort, TimeRange } from "../reddit/types";
import { collapse, formatDate, formatRatio, formatScore, redactUsernames, SOURCE_NOTE, trimText } from "./common";

const EXCERPT_CHARS = 200;
const TOP_SUBREDDITS = 4;

// Notes are information for Claude, not instructions: Claude is rightly wary of orders inside tool results.
const SHORT_QUERIES =
  "Reddit search works best with 2–4 key words (e.g. walking shoes Europe); long queries with numbers or details " +
  "mostly return unrelated posts. If a name is ambiguous, adding a brand or model, or OR-ing variants, helps.";

const NOTES =
  `Search notes: ${SHORT_QUERIES} A subreddit:name search within the communities above often finds more relevant ` +
  "threads, in addition to this general search. FAQ and megathreads often answer best. The experiences are mostly " +
  "in the comments, which read_reddit_threads returns.";

const THIN_NOTES =
  `Search notes: ${SHORT_QUERIES} Other phrasings, nicknames or a wider time_range may find more, as can a ` +
  "subreddit:name search within a relevant community, in addition to a general search. Any relevant threads " +
  "here can be read in full with read_reddit_threads.";

function subredditLine(posts: PostSummary[]): string {
  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.subreddit, (counts.get(p.subreddit) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = sorted.slice(0, TOP_SUBREDDITS).map(([s, n]) => `r/${s} ${n}`);
  const other = sorted.slice(TOP_SUBREDDITS).reduce((sum, [, n]) => sum + n, 0);
  if (other) shown.push(`other ${other}`);
  return `By subreddit: ${shown.join(" · ")}`;
}

function entry(p: PostSummary, i: number): string {
  const meta = [`r/${p.subreddit}`];
  if (p.flair) meta.push(p.flair);
  const ratio = formatRatio(p.upvoteRatio);
  meta.push(`${formatScore(p.score)} points${ratio ? ` (${ratio})` : ""}`);
  meta.push(`${p.numComments} comments`, formatDate(p.createdUtc));
  if (!p.isSelf && p.domain) meta.push(`link: ${p.domain}`);
  const lines = [`${i + 1}. [${p.id}] ${p.over18 ? "[NSFW] " : ""}${redactUsernames(p.title)}`, `   ${meta.join(" · ")}`];
  const excerpt = collapse(redactUsernames(p.selftext));
  if (excerpt) lines.push(`   "${trimText(excerpt, EXCERPT_CHARS, "…")}"`);
  return lines.join("\n");
}

export function formatSearchResults(
  query: string,
  o: { sort: SearchSort; timeRange: TimeRange },
  posts: PostSummary[],
): string {
  if (posts.length === 0) return `No results for "${query}".\n\n${THIN_NOTES}`;
  const time = o.timeRange === "all" ? "all time" : `past ${o.timeRange}`;
  const parts = [
    SOURCE_NOTE,
    "",
    `Search "${query}" · ${o.sort} · ${time} · ${posts.length} results`,
    subredditLine(posts),
    "",
    posts.map(entry).join("\n"),
  ];
  parts.push("", posts.length <= 2 ? `Few results. ${THIN_NOTES}` : NOTES);
  return parts.join("\n");
}
