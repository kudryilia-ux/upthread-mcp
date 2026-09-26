import { describe, expect, it } from "vitest";
import {
  CredentialsError, InvalidThreadRefError, RateLimitedError, RedditError,
  ShareLinkError, ThreadUnavailableError, UpstreamError,
} from "@/lib/reddit/errors";

describe("Reddit errors", () => {
  it("carry the spec §7 messages", () => {
    expect(new CredentialsError().message).toBe(
      "Reddit rejected the app credentials; the server owner needs to check them.",
    );
    expect(new RateLimitedError(40).message).toBe("Reddit rate limit reached; resets in ~40s.");
    expect(new UpstreamError("HTTP 503").message).toBe(
      "Reddit is not responding right now (HTTP 503). Try again shortly.",
    );
    expect(new ThreadUnavailableError("abc").message).toBe(
      "Thread abc is unavailable (removed, private or quarantined).",
    );
    expect(new InvalidThreadRefError("nope").message).toBe(
      'Couldn\'t read "nope" as a Reddit thread. Pass a post ID or a reddit.com/redd.it URL.',
    );
    expect(new ShareLinkError("https://www.reddit.com/r/x/s/Ab").message).toBe(
      "Couldn't resolve share link https://www.reddit.com/r/x/s/Ab. Pass the full reddit.com URL.",
    );
  });

  it("are all RedditErrors with distinct names", () => {
    const errors = [
      new CredentialsError(), new RateLimitedError(1), new UpstreamError("timeout"),
      new ThreadUnavailableError("a"), new InvalidThreadRefError("a"), new ShareLinkError("a"),
    ];
    for (const e of errors) expect(e).toBeInstanceOf(RedditError);
    expect(new Set(errors.map((e) => e.name)).size).toBe(errors.length);
  });

  it("RateLimitedError exposes resetSeconds, rounded up and at least 1", () => {
    expect(new RateLimitedError(0.2).resetSeconds).toBe(1);
    expect(new RateLimitedError(12.1).resetSeconds).toBe(13);
  });
});

describe("error names survive minification (v1.1)", () => {
  it("each class has a fixed, readable name for logs", () => {
    expect([
      new CredentialsError().name, new RateLimitedError(1).name, new UpstreamError("x").name,
      new ThreadUnavailableError("a").name, new InvalidThreadRefError("a").name, new ShareLinkError("a").name,
    ]).toEqual(["CredentialsError", "RateLimitedError", "UpstreamError", "ThreadUnavailableError", "InvalidThreadRefError", "ShareLinkError"]);
    const src = require("node:fs").readFileSync("lib/reddit/errors.ts", "utf8") as string;
    expect(src).not.toContain("new.target.name");
  });
});
