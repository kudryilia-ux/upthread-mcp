/** Base class: every error the Reddit layer throws on purpose. Messages are shown to Claude. */
export class RedditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CredentialsError extends RedditError {
  constructor() {
    super("Reddit rejected the app credentials; the server owner needs to check them.");
  }
}

export class RateLimitedError extends RedditError {
  readonly resetSeconds: number;
  constructor(resetSeconds: number) {
    const s = Math.max(1, Math.ceil(resetSeconds));
    super(`Reddit rate limit reached; resets in ~${s}s.`);
    this.resetSeconds = s;
  }
}

export class UpstreamError extends RedditError {
  constructor(reason: string) {
    super(`Reddit is not responding right now (${reason}). Try again shortly.`);
  }
}

export class ThreadUnavailableError extends RedditError {
  constructor(id: string) {
    super(`Thread ${id} is unavailable (removed, private or quarantined).`);
  }
}

export class InvalidThreadRefError extends RedditError {
  constructor(input: string) {
    super(`Couldn't read "${input}" as a Reddit thread. Pass a post ID or a reddit.com/redd.it URL.`);
  }
}

export class ShareLinkError extends RedditError {
  constructor(input: string) {
    super(`Couldn't resolve share link ${input}. Pass the full reddit.com URL.`);
  }
}
