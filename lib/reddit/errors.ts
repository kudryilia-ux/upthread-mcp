/** Base class: every error the Reddit layer throws on purpose. Messages are shown to Claude. */
export class RedditError extends Error {
  override name = "RedditError";
}

export class CredentialsError extends RedditError {
  override name = "CredentialsError";
  constructor() {
    super("Reddit rejected the app credentials; the server owner needs to check them.");
  }
}

export class RateLimitedError extends RedditError {
  override name = "RateLimitedError";
  readonly resetSeconds: number;
  constructor(resetSeconds: number) {
    const s = Math.max(1, Math.ceil(resetSeconds));
    super(`Reddit rate limit reached; resets in ~${s}s.`);
    this.resetSeconds = s;
  }
}

export class UpstreamError extends RedditError {
  override name = "UpstreamError";
  constructor(reason: string) {
    super(`Reddit is not responding right now (${reason}). Try again shortly.`);
  }
}

export class AccessDeniedError extends RedditError {
  override name = "AccessDeniedError";
  constructor(status: number) {
    super(`Reddit refused the request (HTTP ${status}); the server owner should check the app's approval and User-Agent.`);
  }
}

export class ThreadUnavailableError extends RedditError {
  override name = "ThreadUnavailableError";
  constructor(id: string) {
    super(`Thread ${id} is unavailable (removed, private or quarantined).`);
  }
}

export class InvalidThreadRefError extends RedditError {
  override name = "InvalidThreadRefError";
  constructor(input: string) {
    super(`Couldn't read "${input}" as a Reddit thread. Pass a post ID or a reddit.com/redd.it URL.`);
  }
}

export class ShareLinkError extends RedditError {
  override name = "ShareLinkError";
  constructor(input: string) {
    super(`Couldn't resolve share link ${input}. Pass the full reddit.com URL.`);
  }
}
