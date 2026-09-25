import { describe, expect, it, vi } from "vitest";
import { parseThreadRef, resolveThreadRef } from "@/lib/reddit/refs";
import { InvalidThreadRefError, ShareLinkError } from "@/lib/reddit/errors";

const id = (input: string) => parseThreadRef(input);

describe("parseThreadRef", () => {
  it.each([
    ["1abc2de", "1abc2de"],
    ["t3_1abc2de", "1abc2de"],
    ["  1ABC2DE  ", "1abc2de"],
    ["abcdefghij1234", "abcdefghij1234"], // long IDs are fine (no length assumptions)
    ["https://www.reddit.com/r/headphones/comments/1abc2de/xm5_vs_bose/", "1abc2de"],
    ["https://old.reddit.com/r/headphones/comments/1abc2de/xm5_vs_bose/", "1abc2de"],
    ["https://new.reddit.com/r/headphones/comments/1abc2de", "1abc2de"],
    ["https://np.reddit.com/r/headphones/comments/1abc2de/x/", "1abc2de"],
    ["https://m.reddit.com/r/headphones/comments/1abc2de/x/", "1abc2de"],
    ["https://reddit.com/comments/1abc2de", "1abc2de"],
    ["https://www.reddit.com/r/headphones/comments/1abc2de/xm5/k9x8y7z6w5v4u3/", "1abc2de"], // comment permalink
    ["https://redd.it/1abc2de", "1abc2de"],
    // Review Focus 1: tracking params, fragments, no scheme, trailing slashes
    ["https://www.reddit.com/r/x/comments/1abc2de/t/?utm_source=share&utm_medium=web2x#c", "1abc2de"],
    ["reddit.com/r/x/comments/1abc2de/t", "1abc2de"],
    ["www.reddit.com/r/x/comments/1abc2de///", "1abc2de"],
    ["redd.it/1abc2de?x=1", "1abc2de"],
  ])("%s -> %s", (input, expected) => {
    expect(id(input)).toEqual({ kind: "id", id: expected });
  });

  it("recognizes share links", () => {
    expect(id("https://www.reddit.com/r/movies/s/AbC123xyz")).toEqual({
      kind: "share", pathname: "/r/movies/s/AbC123xyz",
    });
  });

  it.each(["", "   ", "hello world", "https://example.com/r/x/comments/1abc2de", "https://www.reddit.com/r/movies/", "t3_", "abc-def"])(
    "rejects %j",
    (input) => {
      expect(() => id(input)).toThrow(InvalidThreadRefError);
    },
  );
});

describe("resolveThreadRef", () => {
  it("returns ids without network", async () => {
    const client = { resolveShareLink: vi.fn() };
    await expect(resolveThreadRef("t3_1abc2de", client)).resolves.toBe("1abc2de");
    expect(client.resolveShareLink).not.toHaveBeenCalled();
  });

  it("resolves share links through the client", async () => {
    const client = { resolveShareLink: vi.fn(async () => "https://www.reddit.com/r/movies/comments/1xyz9fg/t/") };
    await expect(resolveThreadRef("https://www.reddit.com/r/movies/s/AbC", client)).resolves.toBe("1xyz9fg");
    expect(client.resolveShareLink).toHaveBeenCalledWith("/r/movies/s/AbC");
  });

  it("throws ShareLinkError when the redirect is missing or not a thread", async () => {
    const none = { resolveShareLink: vi.fn(async () => null) };
    await expect(resolveThreadRef("https://www.reddit.com/r/m/s/A", none)).rejects.toBeInstanceOf(ShareLinkError);
    const odd = { resolveShareLink: vi.fn(async () => "https://www.reddit.com/r/m/") };
    await expect(resolveThreadRef("https://www.reddit.com/r/m/s/A", odd)).rejects.toBeInstanceOf(ShareLinkError);
  });
});
