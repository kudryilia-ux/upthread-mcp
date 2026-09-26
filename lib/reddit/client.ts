import { AccessDeniedError, CredentialsError, RateLimitedError, ThreadUnavailableError, UpstreamError } from "./errors";

const TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
const API_ORIGIN = "https://oauth.reddit.com";
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const MIN_REMAINING = 2;

export interface RedditClientOptions {
  clientId: string;
  clientSecret: string;
  userAgent: string;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export class RedditClient {
  private readonly opts: Required<RedditClientOptions>;
  private token: { value: string; expiresAt: number } | null = null;
  private pendingToken: Promise<string> | null = null;
  private remaining: number | null = null;
  private resetAt = 0;

  constructor(opts: RedditClientOptions) {
    this.opts = {
      fetch: globalThis.fetch.bind(globalThis),
      now: Date.now,
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timeoutMs: 10_000,
      ...opts,
    };
  }

  async get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
    const url = new URL(API_ORIGIN + path);
    for (const [k, v] of Object.entries({ ...params, raw_json: 1 })) url.searchParams.set(k, String(v));

    let retried401 = false;
    let retried5xx = false;
    for (;;) {
      this.spendBudget();
      const res = await this.send(url.toString(), {
        headers: { authorization: `Bearer ${await this.getToken()}`, "user-agent": this.opts.userAgent },
      });
      this.recordRateLimit(res.headers);

      if (res.status === 401) {
        if (retried401) throw new CredentialsError();
        retried401 = true;
        this.token = null;
        continue;
      }
      if (res.status === 429) {
        const reset = this.headerSeconds(res.headers) ?? 60;
        this.remaining = 0;
        this.resetAt = this.opts.now() + reset * 1000;
        throw new RateLimitedError(reset);
      }
      if (res.status >= 500) {
        if (retried5xx) throw new UpstreamError(`HTTP ${res.status}`);
        retried5xx = true;
        await this.opts.sleep(500);
        continue;
      }
      if ((res.status === 403 || res.status === 404) && path.startsWith("/comments/")) {
        throw new ThreadUnavailableError(path.split("/").filter(Boolean).pop() ?? path);
      }
      if (res.status === 403) throw new AccessDeniedError(res.status);
      if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`);
      try {
        return await res.json();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        throw new UpstreamError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "bad response");
      }
    }
  }

  /** For the setup page: can we log in to Reddit with these credentials? */
  async checkCredentials(): Promise<"ok" | "rejected" | "unreachable"> {
    try {
      await this.getToken();
      return "ok";
    } catch (e) {
      return e instanceof CredentialsError ? "rejected" : "unreachable";
    }
  }

  /** Follows one redirect hop of a share link (/r/<sub>/s/<code>) and returns its Location, or null. */
  async resolveShareLink(pathname: string): Promise<string | null> {
    const bearer = { authorization: `Bearer ${await this.getToken()}`, "user-agent": this.opts.userAgent };
    const attempts: Array<[string, Record<string, string>]> = [
      [API_ORIGIN + pathname, bearer],
      ["https://www.reddit.com" + pathname, { "user-agent": this.opts.userAgent }],
    ];
    for (const [url, headers] of attempts) {
      this.spendBudget();
      const res = await this.send(url, { headers, redirect: "manual" });
      this.recordRateLimit(res.headers);
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) return location;
    }
    return null;
  }

  /** Fails fast when Reddit's budget is nearly used up; otherwise counts the call locally. */
  private spendBudget() {
    const now = this.opts.now();
    if (this.remaining !== null && this.remaining <= MIN_REMAINING && now < this.resetAt) {
      throw new RateLimitedError((this.resetAt - now) / 1000);
    }
    if (this.remaining !== null && now < this.resetAt) this.remaining -= 1;
  }

  private recordRateLimit(headers: Headers) {
    const remaining = headers.get("x-ratelimit-remaining");
    const reset = this.headerSeconds(headers);
    if (remaining !== null) this.remaining = Number(remaining);
    if (reset !== null) this.resetAt = this.opts.now() + reset * 1000;
  }

  private headerSeconds(headers: Headers): number | null {
    const v = headers.get("x-ratelimit-reset");
    return v === null ? null : Number(v);
  }

  private getToken(): Promise<string> {
    if (this.token && this.opts.now() < this.token.expiresAt - REFRESH_MARGIN_MS) {
      return Promise.resolve(this.token.value);
    }
    this.pendingToken ??= this.fetchToken().finally(() => {
      this.pendingToken = null;
    });
    return this.pendingToken;
  }

  private async fetchToken(): Promise<string> {
    const basic = Buffer.from(`${this.opts.clientId}:${this.opts.clientSecret}`).toString("base64");
    const res = await this.send(TOKEN_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": this.opts.userAgent,
      },
      body: "grant_type=client_credentials",
    });
    if (res.status === 429) throw new RateLimitedError(this.headerSeconds(res.headers) ?? 60);
    if (res.status >= 500) throw new UpstreamError(`HTTP ${res.status}`);
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (!res.ok || !body.access_token) throw new CredentialsError();
    this.token = { value: body.access_token, expiresAt: this.opts.now() + (body.expires_in ?? 3600) * 1000 };
    return this.token.value;
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.opts.fetch(url, { ...init, signal: AbortSignal.timeout(this.opts.timeoutMs) });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      throw new UpstreamError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network error");
    }
  }
}
