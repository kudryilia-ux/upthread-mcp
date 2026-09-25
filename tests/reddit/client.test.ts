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
