import type { PostSummary, SearchSort, TimeRange } from "../reddit/types";
import { collapse, formatDate, formatRatio, formatScore, trimText } from "./common";

const EXCERPT_CHARS = 200;
const TOP_SUBREDDITS = 4;

const HINTS = [
  "Next steps:",
  '- Rephrase the way Redditors title posts: short names, "X vs Y", nicknames.',
  "- If a name is ambiguous, add a distinguishing word (brand, full model) or OR the variants.",
  "- Widen time_range.",
  "- Use web search with site:reddit.com and pass thread URLs to read_threads.",
].join("\n");

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
  const lines = [`${i + 1}. [${p.id}] ${p.over18 ? "[NSFW] " : ""}${p.title}`, `   ${meta.join(" · ")}`];
  const excerpt = p.isSelf ? collapse(p.selftext) : "";
  if (excerpt) lines.push(`   "${trimText(excerpt, EXCERPT_CHARS, "…")}"`);
  return lines.join("\n");
}

export function formatSearchResults(
  query: string,
  o: { sort: SearchSort; timeRange: TimeRange },
  posts: PostSummary[],
): string {
  if (posts.length === 0) return `No results for "${query}".\n\n${HINTS}`;
  const time = o.timeRange === "all" ? "all time" : `past ${o.timeRange}`;
  const parts = [
    `Search "${query}" · ${o.sort} · ${time} · ${posts.length} results`,
    subredditLine(posts),
    "",
    posts.map(entry).join("\n"),
  ];
  if (posts.length <= 2) parts.push("", `Few results. ${HINTS}`);
  return parts.join("\n");
}
