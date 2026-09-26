import { describe, expect, it, vi } from "vitest";
import { checkSetup } from "@/lib/setup-check";
import { CredentialsError, UpstreamError } from "@/lib/reddit/errors";

const GOOD = {
  MCP_PATH_SECRET: "a".repeat(40),
  REDDIT_CLIENT_ID: "id",
  REDDIT_CLIENT_SECRET: "secret-value-xyz",
  REDDIT_USER_AGENT: "web:upthread:1.0 (by /u/someone)",
};
const okClient = () => ({ checkCredentials: vi.fn(async () => "ok" as const) });

describe("checkSetup", () => {
  it("reports everything OK for a complete setup", async () => {
    const r = await checkSetup(GOOD, okClient);
    expect(r).toEqual({ password: "ok", redditSettings: "ok", missing: [], redditLogin: "ok", ready: true });
  });

  it("flags a missing or too-short password", async () => {
    expect((await checkSetup({ ...GOOD, MCP_PATH_SECRET: "" }, okClient)).password).toBe("missing");
    const short = await checkSetup({ ...GOOD, MCP_PATH_SECRET: "short" }, okClient);
    expect(short.password).toBe("too_short");
    expect(short.ready).toBe(false);
  });

  it("lists missing Reddit settings by name and skips the login check", async () => {
    const client = okClient();
    const r = await checkSetup({ ...GOOD, REDDIT_CLIENT_SECRET: "", REDDIT_USER_AGENT: undefined }, () => client);
    expect(r.redditSettings).toBe("missing");
    expect(r.missing).toEqual(["REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"]);
    expect(r.redditLogin).toBe("skipped");
    expect(client.checkCredentials).not.toHaveBeenCalled();
  });

  it("reports rejected and unreachable Reddit logins", async () => {
    expect((await checkSetup(GOOD, () => ({ checkCredentials: async () => "rejected" as const }))).redditLogin).toBe("rejected");
    expect((await checkSetup(GOOD, () => ({ checkCredentials: async () => "unreachable" as const }))).redditLogin).toBe("unreachable");
  });

  it("never includes any configured value in its result", async () => {
    const r = JSON.stringify(await checkSetup(GOOD, okClient));
    for (const v of Object.values(GOOD)) expect(r).not.toContain(v);
  });
});

describe("RedditClient.checkCredentials", () => {
  it("maps token outcomes to ok / rejected / unreachable", async () => {
    const { RedditClient } = await import("@/lib/reddit/client");
    const mk = (res: Response | Error) =>
      new RedditClient({ clientId: "i", clientSecret: "s", userAgent: "u", fetch: (async () => { if (res instanceof Error) throw res; return res; }) as unknown as typeof fetch });
    const tok = new Response(JSON.stringify({ access_token: "t", expires_in: 3600 }), { status: 200 });
    expect(await mk(tok).checkCredentials()).toBe("ok");
    expect(await mk(new Response("{}", { status: 401 })).checkCredentials()).toBe("rejected");
    expect(await mk(new TypeError("fetch failed")).checkCredentials()).toBe("unreachable");
    void CredentialsError; void UpstreamError;
  });
});
