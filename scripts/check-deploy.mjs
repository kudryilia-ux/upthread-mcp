// Production gate check: node scripts/check-deploy.mjs https://your-app.vercel.app
// Reads MCP_PATH_SECRET from env. Never prints it.
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const base = process.argv.slice(2).find((a) => a !== "--");
const secret = process.env.MCP_PATH_SECRET;
if (!base || !secret) throw new Error("usage: MCP_PATH_SECRET=... node scripts/check-deploy.mjs <base-url>");

let failed = false;
const paths = [
  "/mcp", "/mcp/not-the-secret", // (not "/mcp/": Next.js 308-redirects trailing slashes)
  "/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp",
  "/.well-known/oauth-authorization-server", "/.well-known/openid-configuration",
];
for (const p of paths) {
  for (const method of ["GET", "POST"]) {
    const res = await fetch(new URL(p, base), { method, headers: { "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
    const ok = res.status === 404 && !res.headers.has("www-authenticate");
    if (!ok) failed = true;
    console.log(`${ok ? "ok  " : "FAIL"} ${method} ${p} -> ${res.status}${res.headers.has("www-authenticate") ? " (WWW-Authenticate!)" : ""}`);
  }
}

try {
  const client = new Client({ name: "upthread-check", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`/mcp/${secret}`, base)));
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort().join(",");
  const ok = names === "read_threads,search_reddit";
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} handshake with secret -> tools: ${names}`);
  await client.close();
} catch (e) {
  failed = true;
  console.log(`FAIL handshake with secret -> ${e instanceof Error ? e.name : "error"}`);
}
process.exit(failed ? 1 : 0);
