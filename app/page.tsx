import { getRedditClient } from "@/lib/reddit";
import { checkSetup, type SetupStatus } from "@/lib/setup-check";

// Setup check for the person who deployed this. Shows whether each setting works, never any value.
export const dynamic = "force-dynamic";

const PASSWORD: Record<SetupStatus["password"], [boolean, string]> = {
  ok: [true, "Connector password is set."],
  missing: [false, "MCP_PATH_SECRET is not set. Add it in Vercel (Settings → Environment Variables), then redeploy."],
  too_short: [false, "MCP_PATH_SECRET is shorter than 32 characters, so the connector won't answer. Use a longer password, then redeploy and update the address in Claude."],
};

const LOGIN: Record<SetupStatus["redditLogin"], [boolean, string]> = {
  ok: [true, "Reddit accepted your app's credentials."],
  rejected: [false, "Reddit rejected your app's credentials. Check REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET, and that your app is a “script” or “web” app that is still active."],
  unreachable: [false, "Couldn't reach Reddit right now. Reload this page in a minute."],
  skipped: [false, "Reddit login not checked until the settings above are complete."],
};

export default async function SetupPage() {
  const s = await checkSetup(process.env, getRedditClient);
  const rows: [boolean, string][] = [
    PASSWORD[s.password],
    s.redditSettings === "ok"
      ? [true, "Reddit settings are set."]
      : [false, `Missing in Vercel: ${s.missing.join(", ")}. Add them (Settings → Environment Variables), then redeploy.`],
    LOGIN[s.redditLogin],
  ];
  return (
    <main>
      <h1>Upthread for Reddit</h1>
      <p>{s.ready ? "✅ Setup looks good." : "⚠️ Setup needs attention."}</p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {rows.map(([ok, text]) => (
          <li key={text} style={{ margin: "8px 0" }}>
            {ok ? "✅" : "❌"} {text}
          </li>
        ))}
      </ul>
      <p>
        Your connector address is this site’s address followed by <code>/mcp/</code> and your password. See the{" "}
        <a href="https://github.com/kudryilia-ux/upthread-mcp#setup">setup guide</a>.
      </p>
    </main>
  );
}
