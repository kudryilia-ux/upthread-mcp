import { describe, expect, it, vi } from "vitest";
import { RedditClient } from "@/lib/reddit/client";
import { CredentialsError, RateLimitedError, ThreadUnavailableError, UpstreamError } from "@/lib/reddit/errors";

type Call = { url: string; init: RequestInit };

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}
const token = (expires_in = 86400) => json({ access_token: "tok", token_type: "bearer", expires_in, scope: "*" });

function setup(responses: Array<Response | Error | (() => Response)>, clock = { t: 1_000_000 }) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fetchFn = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const next = queue.shift();
    if (!next) throw new Error("unexpected fetch " + String(url));
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next() : next;
  });
  const client = new RedditClient({
    clientId: "id", clientSecret: "sec", userAgent: "web:test:0.1 (by /u/test)",
    fetch: fetchFn as unknown as typeof fetch, now: () => clock.t, sleep: async () => {}, timeoutMs: 50,
  });
  return { client, calls, clock };
}

describe("RedditClient auth", () => {
  it("fetches a client_credentials token with basic auth and user agent", async () => {
    const { client, calls } = setup([token(), json({ ok: 1 })]);
    await client.get("/search", { q: "x" });
    const t = calls[0];
    expect(t.url).toBe("https://www.reddit.com/api/v1/access_token");
    expect(t.init.method).toBe("POST");
    const h = new Headers(t.init.headers);
    expect(h.get("authorization")).toBe("Basic " + Buffer.from("id:sec").toString("base64"));
    expect(h.get("user-agent")).toBe("web:test:0.1 (by /u/test)");
    expect(String(t.init.body)).toBe("grant_type=client_credentials");
  });

  it("sends bearer token, user agent and raw_json=1 on API calls", async () => {
    const { client, calls } = setup([token(), json({ ok: 1 })]);
    const body = await client.get("/search", { q: "XM5 OR x", limit: 5 });
    expect(body).toEqual({ ok: 1 });
    const u = new URL(calls[1].url);
    expect(u.origin + u.pathname).toBe("https://oauth.reddit.com/search");
    expect(u.searchParams.get("raw_json")).toBe("1");
    expect(u.searchParams.get("q")).toBe("XM5 OR x");
    expect(u.searchParams.get("limit")).toBe("5");
    const h = new Headers(calls[1].init.headers);
    expect(h.get("authorization")).toBe("Bearer tok");
    expect(h.get("user-agent")).toBe("web:test:0.1 (by /u/test)");
  });

  it("reuses the token until 5 minutes before expiry, then refreshes", async () => {
    const { client, calls, clock } = setup([token(3600), json({}), json({}), token(3600), json({})]);
    await client.get("/a");
    clock.t += (3600 - 301) * 1000;
    await client.get("/b");
    clock.t += 2 * 1000; // now inside the 5-minute window
    await client.get("/c");
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual([
      "/api/v1/access_token", "/a", "/b", "/api/v1/access_token", "/c",
    ]);
  });

  it("collapses concurrent token refreshes into one request (Review Focus 5)", async () => {
    const { client, calls } = setup([token(), json({ n: 1 }), json({ n: 2 })]);
    await Promise.all([client.get("/a"), client.get("/b")]);
    expect(calls.filter((c) => c.url.includes("access_token"))).toHaveLength(1);
  });

  it("throws CredentialsError when the token request is rejected", async () => {
    const { client } = setup([json({ error: "invalid_grant" }, 401)]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(CredentialsError);
  });

  it("on API 401, refreshes once and retries; a second 401 is CredentialsError", async () => {
    const ok = setup([token(), json({}, 401), token(), json({ ok: 1 })]);
    await expect(ok.client.get("/a")).resolves.toEqual({ ok: 1 });
    const bad = setup([token(), json({}, 401), token(), json({}, 401)]);
    await expect(bad.client.get("/a")).rejects.toBeInstanceOf(CredentialsError);
  });
});

describe("RedditClient errors and limits", () => {
  it("maps 403 and 404 to ThreadUnavailableError using the path id", async () => {
    const { client } = setup([token(), json({}, 404)]);
    await expect(client.get("/comments/abc")).rejects.toBeInstanceOf(ThreadUnavailableError);
  });

  it("maps 429 to RateLimitedError using x-ratelimit-reset", async () => {
    const { client } = setup([token(), json({}, 429, { "x-ratelimit-reset": "40" })]);
    const err = (await client.get("/a").catch((e) => e)) as RateLimitedError;
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.resetSeconds).toBe(40);
  });

  it("fails fast without calling Reddit when remaining <= 2 before reset", async () => {
    const { client, calls, clock } = setup([
      token(), json({}, 200, { "x-ratelimit-remaining": "2.0", "x-ratelimit-reset": "30" }), json({}),
    ]);
    await client.get("/a");
    await expect(client.get("/b")).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(2);
    clock.t += 31_000; // window reset: calls allowed again
    await expect(client.get("/c")).resolves.toEqual({});
  });

  it("retries a 5xx once, then throws UpstreamError with the status", async () => {
    const ok = setup([token(), json({}, 503), json({ ok: 1 })]);
    await expect(ok.client.get("/a")).resolves.toEqual({ ok: 1 });
    const bad = setup([token(), json({}, 502), json({}, 503)]);
    await expect(bad.client.get("/a")).rejects.toThrow("(HTTP 503)");
  });

  it("maps timeouts and network errors to UpstreamError", async () => {
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    const t = setup([token(), timeout]);
    await expect(t.client.get("/a")).rejects.toThrow("(timeout)");
    const n = setup([token(), new TypeError("fetch failed")]);
    await expect(n.client.get("/a")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("passes an AbortSignal to every request", async () => {
    const { client, calls } = setup([token(), json({})]);
    await client.get("/a");
    expect(calls.every((c) => c.init.signal instanceof AbortSignal)).toBe(true);
  });
});

describe("RedditClient.resolveShareLink", () => {
  it("returns the Location of a manual redirect via oauth.reddit.com", async () => {
    const loc = "https://www.reddit.com/r/x/comments/1abc2de/title/";
    const { client, calls } = setup([token(), new Response(null, { status: 301, headers: { location: loc } })]);
    await expect(client.resolveShareLink("/r/x/s/AbCd")).resolves.toBe(loc);
    expect(calls[1].url).toBe("https://oauth.reddit.com/r/x/s/AbCd");
    expect(calls[1].init.redirect).toBe("manual");
  });

  it("falls back to www.reddit.com, and returns null when neither redirects", async () => {
    const loc = "https://www.reddit.com/r/x/comments/1abc2de/";
    const ok = setup([token(), json({}, 404), new Response(null, { status: 302, headers: { location: loc } })]);
    await expect(ok.client.resolveShareLink("/r/x/s/AbCd")).resolves.toBe(loc);
    const none = setup([token(), json({}, 404), json({}, 403)]);
    await expect(none.client.resolveShareLink("/r/x/s/AbCd")).resolves.toBeNull();
  });
});

describe("RedditClient final-review fixes", () => {
  it("reports a 403 on a non-thread path as an access problem, not a missing thread", async () => {
    const { client } = setup([token(), json({ reason: "blocked" }, 403)]);
    const err = (await client.get("/search", { q: "x" }).catch((e) => e)) as Error;
    expect(err).not.toBeInstanceOf(ThreadUnavailableError);
    expect(err.message).toBe(
      "Reddit refused the request (HTTP 403); the server owner should check the app's approval and User-Agent.",
    );
  });

  it("still reports 403/404 on /comments/<id> as an unavailable thread", async () => {
    const { client } = setup([token(), json({}, 403)]);
    await expect(client.get("/comments/abc")).rejects.toThrow("Thread abc is unavailable");
  });

  it("maps a non-JSON 200 body to UpstreamError", async () => {
    const { client } = setup([token(), new Response("<html>interstitial</html>", { status: 200 })]);
    await expect(client.get("/search")).rejects.toThrow("(bad response)");
  });

  it("maps a body read that fails mid-stream to UpstreamError", async () => {
    const body = new ReadableStream({ start(c) { c.error(Object.assign(new Error("t"), { name: "TimeoutError" })); } });
    const { client } = setup([token(), new Response(body, { status: 200 })]);
    await expect(client.get("/search")).rejects.toBeInstanceOf(UpstreamError);
  });

  it("maps a 429 from the token endpoint to RateLimitedError, not CredentialsError", async () => {
    const { client } = setup([json({}, 429, { "x-ratelimit-reset": "20" })]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(RateLimitedError);
  });
});

describe("RedditClient v1.1 rate-limit and refresh fixes", () => {
  it("after a 429, the next call fails fast without hitting Reddit", async () => {
    const { client, calls } = setup([token(), json({}, 429, { "x-ratelimit-reset": "30" })]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(RateLimitedError);
    await expect(client.get("/b")).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(2);
  });

  it("counts calls locally so a batch can't overrun the remaining budget", async () => {
    const { client, calls } = setup([
      token(), json({}, 200, { "x-ratelimit-remaining": "4", "x-ratelimit-reset": "30" }), json({}), json({}),
    ]);
    await client.get("/a"); // remaining 4 -> Reddit says 4
    await client.get("/b"); // local count: 3
    await expect(client.get("/c")).resolves.toEqual({}); // local count: 2 after this call
    await expect(client.get("/d")).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls.filter((c) => !c.url.includes("access_token"))).toHaveLength(3);
  });

  it("share-link lookups respect the budget too", async () => {
    const { client, calls } = setup([token(), json({}, 429, { "x-ratelimit-reset": "30" })]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(RateLimitedError);
    await expect(client.resolveShareLink("/r/x/s/Ab")).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(2);
  });

  it("a failed token refresh doesn't poison later calls", async () => {
    const { client } = setup([json({}, 503), token(), json({ ok: 1 })]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(UpstreamError);
    await expect(client.get("/a")).resolves.toEqual({ ok: 1 });
  });
});

describe("RedditClient v1.1 review fixes", () => {
  it("ignores rate-limit headers from the anonymous www.reddit.com share-link fallback", async () => {
    const loc = "https://www.reddit.com/r/x/comments/1abc2de/";
    const { client } = setup([
      token(),
      json({}, 200, { "x-ratelimit-remaining": "50", "x-ratelimit-reset": "300" }), // OAuth API call
      json({}, 404), // OAuth share attempt: no redirect
      new Response(null, { status: 302, headers: { location: loc, "x-ratelimit-remaining": "0", "x-ratelimit-reset": "600" } }),
      json({ ok: 1 }),
    ]);
    await client.get("/a");
    await expect(client.resolveShareLink("/r/x/s/Ab")).resolves.toBe(loc);
    await expect(client.get("/b")).resolves.toEqual({ ok: 1 });
  });

  it("a 429 from the token endpoint also blocks the next call", async () => {
    const { client, calls } = setup([json({}, 429, { "x-ratelimit-reset": "30" })]);
    await expect(client.get("/a")).rejects.toBeInstanceOf(RateLimitedError);
    await expect(client.get("/b")).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(1);
  });

  it("treats a non-numeric reset header as unknown instead of disabling the budget check", async () => {
    const { client, calls } = setup([token(), json({}, 200, { "x-ratelimit-remaining": "1", "x-ratelimit-reset": "soon" })]);
    await client.get("/a");
    await expect(client.get("/b")).rejects.toBeInstanceOf(RateLimitedError);
    expect(calls).toHaveLength(2);
  });

  it("checkCredentials caches a failed login for 60s so the setup page can't hammer Reddit", async () => {
    const { client, calls, clock } = setup([json({}, 401), json({}, 401)]);
    expect(await client.checkCredentials()).toBe("rejected");
    expect(await client.checkCredentials()).toBe("rejected");
    expect(calls).toHaveLength(1);
    clock.t += 61_000;
    expect(await client.checkCredentials()).toBe("rejected");
    expect(calls).toHaveLength(2);
  });
});
