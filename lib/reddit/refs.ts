import type { RedditClient } from "./client";
import { InvalidThreadRefError, ShareLinkError } from "./errors";

export type ParsedRef = { kind: "id"; id: string } | { kind: "share"; pathname: string };

const BASE36 = /^[a-z0-9]+$/;

function toUrl(input: string): URL | null {
  const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

export function parseThreadRef(input: string): ParsedRef {
  const raw = input.trim();
  const bare = raw.toLowerCase().replace(/^t3_/, "");
  if (bare && BASE36.test(bare)) return { kind: "id", id: bare };

  const url = raw.includes(".") ? toUrl(raw) : null;
  if (url) {
    const host = url.hostname.toLowerCase();
    const segs = url.pathname.split("/").filter(Boolean);
    if (host === "redd.it" && segs[0] && BASE36.test(segs[0].toLowerCase())) {
      return { kind: "id", id: segs[0].toLowerCase() };
    }
    if (host === "reddit.com" || host.endsWith(".reddit.com")) {
      const i = segs.indexOf("comments");
      const candidate = i >= 0 ? segs[i + 1]?.toLowerCase() : undefined;
      if (candidate && BASE36.test(candidate)) return { kind: "id", id: candidate };
      if (segs.length === 4 && segs[0] === "r" && segs[2] === "s") {
        return { kind: "share", pathname: `/r/${segs[1]}/s/${segs[3]}` };
      }
    }
  }
  throw new InvalidThreadRefError(input);
}

export async function resolveThreadRef(
  input: string,
  client: Pick<RedditClient, "resolveShareLink">,
): Promise<string> {
  const ref = parseThreadRef(input);
  if (ref.kind === "id") return ref.id;
  const location = await client.resolveShareLink(ref.pathname);
  if (location) {
    try {
      const resolved = parseThreadRef(new URL(location, "https://www.reddit.com").toString());
      if (resolved.kind === "id") return resolved.id;
    } catch {
      // fall through to ShareLinkError
    }
  }
  throw new ShareLinkError(input.trim());
}
