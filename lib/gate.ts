import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_SECRET_LENGTH = 32;

let warnedMisconfigured = false;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Constant-time check of the URL path secret. Fails closed when unconfigured. */
export function isAuthorizedSecret(
  candidate: string | undefined,
  configured: string | undefined,
): boolean {
  if (!configured || configured.length < MIN_SECRET_LENGTH) {
    if (!warnedMisconfigured) {
      warnedMisconfigured = true;
      console.warn(
        `[upthread] MCP_PATH_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters; every request returns 404.`,
      );
    }
    return false;
  }
  if (!candidate) return false;
  return timingSafeEqual(digest(candidate), digest(configured));
}

/** Indistinguishable from an unknown path. Never a 401. */
export function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
