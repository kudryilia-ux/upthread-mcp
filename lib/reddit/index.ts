import { RedditClient } from "./client";
import { CredentialsError } from "./errors";

let client: RedditClient | null = null;

/** Lazily builds the process-wide client from env. Throws CredentialsError if env is incomplete. */
export function getRedditClient(): RedditClient {
  if (client) return client;
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT } = process.env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USER_AGENT) throw new CredentialsError();
  client = new RedditClient({
    clientId: REDDIT_CLIENT_ID,
    clientSecret: REDDIT_CLIENT_SECRET,
    userAgent: REDDIT_USER_AGENT,
  });
  return client;
}
