// Live smoke test: node scripts/test-client.mjs http://localhost:3000
// Reads MCP_PATH_SECRET from env (run via: op run --env-file ~/.config/reddit-mcp/.env.op -- ...).
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const base = process.argv.slice(2).find((a) => a !== "--") ?? "http://localhost:3000";
const secret = process.env.MCP_PATH_SECRET;
if (!secret) throw new Error("MCP_PATH_SECRET is not set");

const text = (r) => r.content.map((c) => c.text ?? "").join("\n");

const client = new Client({ name: "upthread-smoke", version: "0.1.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(`/mcp/${secret}`, base)));
console.log("Connected to", base, "(secret hidden)");

const { tools } = await client.listTools();
console.log("Tools:", tools.map((t) => t.name).join(", "));

const search = await client.callTool({ name: "search_reddit_opinions_reviews", arguments: { query: 'XM5 OR "WH-1000XM5"', limit: 5 } });
console.log("\n--- search_reddit_opinions_reviews ---\n" + text(search));
if (search.isError) process.exit(1);

const firstId = text(search).match(/^\d+\. \[([a-z0-9]+)\]/m)?.[1];
const read = await client.callTool({ name: "read_reddit_threads", arguments: { threads: [firstId] } });
console.log("\n--- read_reddit_threads ---\n" + text(read));

const share = process.env.SHARE_LINK;
if (share) {
  const s = await client.callTool({ name: "read_reddit_threads", arguments: { threads: [share] } });
  console.log("\n--- share link ---\n" + text(s).split("\n").slice(0, 3).join("\n"));
}
await client.close();
if (read.isError) process.exit(1);
