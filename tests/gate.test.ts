import { describe, expect, it, vi } from "vitest";
import { isAuthorizedSecret, MIN_SECRET_LENGTH, notFound } from "@/lib/gate";

const SECRET = "a".repeat(MIN_SECRET_LENGTH);

describe("isAuthorizedSecret", () => {
  it("accepts the exact configured secret", () => {
    expect(isAuthorizedSecret(SECRET, SECRET)).toBe(true);
  });

  it("rejects a different secret of the same length", () => {
    expect(isAuthorizedSecret("b".repeat(MIN_SECRET_LENGTH), SECRET)).toBe(false);
  });

  it("rejects a prefix or a longer string", () => {
    expect(isAuthorizedSecret(SECRET.slice(0, -1), SECRET)).toBe(false);
    expect(isAuthorizedSecret(SECRET + "a", SECRET)).toBe(false);
  });

  it("rejects missing candidate", () => {
    expect(isAuthorizedSecret(undefined, SECRET)).toBe(false);
    expect(isAuthorizedSecret("", SECRET)).toBe(false);
  });

  it("fails closed when the configured secret is missing or too short, warning once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(isAuthorizedSecret("x", undefined)).toBe(false);
    expect(isAuthorizedSecret("tiny-secret-value", "tiny-secret-value")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).not.toContain("tiny-secret-value");
    warn.mockRestore();
  });
});

describe("notFound", () => {
  it("is a plain 404 with no auth challenge", async () => {
    const res = notFound();
    expect(res.status).toBe(404);
    expect(res.headers.get("www-authenticate")).toBeNull();
    expect(await res.text()).toBe("Not Found");
  });
});
