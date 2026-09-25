export type SearchSort = "relevance" | "top" | "new" | "comments";
export type TimeRange = "hour" | "day" | "week" | "month" | "year" | "all";
export type CommentSort = "best" | "top" | "controversial" | "new" | "qa";

export interface PostSummary {
  id: string;
  title: string;
  subreddit: string;
  flair: string | null;
  score: number;
  upvoteRatio: number | null;
  numComments: number;
  createdUtc: number; // seconds
  isSelf: boolean;
  selftext: string; // "" for link posts
  url: string; // external link for link posts
  domain: string; // e.g. "youtube.com" or "self.headphones"
  over18: boolean;
  permalink: string; // https://reddit.com/comments/<id>
}

export interface Comment {
  id: string;
  author: string; // used only for filtering (AutoModerator); never printed
  body: string;
  score: number;
  scoreHidden: boolean;
  createdUtc: number;
  isOp: boolean;
  isMod: boolean;
  stickied: boolean;
  replies: Comment[];
}

export interface Thread {
  post: PostSummary;
  comments: Comment[];
}
