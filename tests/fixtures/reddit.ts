// Synthetic Reddit API shapes. All text and usernames are invented.
export function rawPost(o: Record<string, unknown> = {}) {
  return {
    kind: "t3",
    data: {
      id: "1abc2de", title: "XM5 vs QC Ultra after six months", subreddit: "headphones",
      link_flair_text: "Review", score: 1234, upvote_ratio: 0.96, num_comments: 340,
      created_utc: 1741910400, is_self: true,
      selftext: "I have used both daily for half a year.\n\nComfort goes to the QC, but the XM5 app is better.",
      url: "https://www.reddit.com/r/headphones/comments/1abc2de/xm5_vs_qc/", domain: "self.headphones",
      over_18: false, stickied: false, author: "example_user_1",
      ...o,
    },
  };
}

export function rawComment(o: Record<string, unknown> = {}, replies: unknown[] = []) {
  return {
    kind: "t1",
    data: {
      id: "c1", author: "example_user_2", body: "The ANC gap closed after the spring firmware update.",
      score: 2300, score_hidden: false, created_utc: 1741914000, is_submitter: false,
      distinguished: null, stickied: false,
      replies: replies.length ? listing(replies) : "",
      ...o,
    },
  };
}

export function moreStub() {
  return { kind: "more", data: { count: 12, children: ["x1", "x2"] } };
}

export function listing(children: unknown[]) {
  return { kind: "Listing", data: { after: null, children } };
}
