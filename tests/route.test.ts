import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { GET, POST } from "@/app/mcp/[secret]/route";

const SECRET = "s".repeat(43);
const ctx = (secret: string) => ({ params: Promise.resolve({ secret }) });

beforeEach(() => {
  vi.stubEnv("MCP_PATH_SECRET", SECRET);
  vi.stubEnv("REDDIT_CLIENT_ID", "");
  vi.stubEnv("REDDIT_CLIENT_SECRET", "");
  vi.stubEnv("REDDIT_USER_AGENT", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("gated MCP route", () => {
  it("returns a plain 404 for a wrong secret on GET and POST", async () => {
    for (const handler of [GET, POST]) {
      const res = await handler(new Request("http://localhost/mcp/nope", { method: "POST", body: "{}" }), ctx("nope"));
      expect(res.status).toBe(404);
      expect(res.headers.get("www-authenticate")).toBeNull();
    }
  });

  it("returns 404 for everything when MCP_PATH_SECRET is unset", async () => {
    vi.stubEnv("MCP_PATH_SECRET", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(new Request(`http://localhost/mcp/${SECRET}`, { method: "POST", body: "{}" }), ctx(SECRET));
    expect(res.status).toBe(404);
  });

  it("completes the MCP handshake with the right secret and lists exactly two tools", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`http://localhost/mcp/${SECRET}`), {
      fetch: (url, init) => POST(new Request(url, init), ctx(SECRET)),
    });
    const client = new Client({ name: "route-test", version: "0.0.0" });
    await client.connect(transport);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["read_reddit_threads", "search_reddit_opinions_reviews"]);
    for (const t of tools) expect(t.title ?? t.annotations?.title).toMatch(/Reddit/);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
    expect(client.getInstructions()).toMatch(/read_reddit_threads/);

    // Without Reddit credentials the tool reports the credentials message instead of crashing.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await client.callTool({ name: "search_reddit_opinions_reviews", arguments: { query: "XM5" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("rejected the app credentials");
    await client.close();
  });
});

describe("gated MCP route: every method (v1.1)", () => {
  it("returns 404, not 405, for DELETE, PUT and PATCH with a wrong secret", async () => {
    const route = await import("@/app/mcp/[secret]/route");
    for (const m of ["DELETE", "PUT", "PATCH"] as const) {
      const handler = (route as Record<string, unknown>)[m] as typeof POST | undefined;
      expect(handler, `${m} exported`).toBeTypeOf("function");
      const res = await handler!(new Request("http://localhost/mcp/nope", { method: m }), ctx("nope"));
      expect(res.status).toBe(404);
    }
  });
});

describe("gated MCP route: OPTIONS (v1.1 review)", () => {
  it("returns 404 for OPTIONS with a wrong secret", async () => {
    const route = (await import("@/app/mcp/[secret]/route")) as Record<string, unknown>;
    const handler = route.OPTIONS as typeof POST | undefined;
    expect(handler).toBeTypeOf("function");
    expect((await handler!(new Request("http://localhost/mcp/nope", { method: "OPTIONS" }), ctx("nope"))).status).toBe(404);
  });
});
