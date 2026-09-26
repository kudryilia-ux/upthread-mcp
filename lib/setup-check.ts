import { MIN_SECRET_LENGTH } from "./gate";
import type { RedditClient } from "./reddit/client";

const REDDIT_VARS = ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USER_AGENT"] as const;

export interface SetupStatus {
  password: "ok" | "missing" | "too_short";
  redditSettings: "ok" | "missing";
  missing: string[];
  redditLogin: "ok" | "rejected" | "unreachable" | "skipped";
  ready: boolean;
}

/** Checks configuration for the setup page. Reports states only, never any configured value. */
export async function checkSetup(
  env: Record<string, string | undefined>,
  getClient: () => Pick<RedditClient, "checkCredentials">,
): Promise<SetupStatus> {
  const secret = env.MCP_PATH_SECRET ?? "";
  const password = !secret ? "missing" : secret.length < MIN_SECRET_LENGTH ? "too_short" : "ok";
  const missing = REDDIT_VARS.filter((name) => !env[name]);
  const redditSettings = missing.length ? "missing" : "ok";
  const redditLogin = missing.length ? "skipped" : await getClient().checkCredentials();
  return { password, redditSettings, missing, redditLogin, ready: password === "ok" && redditLogin === "ok" };
}
