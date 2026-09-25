import { describe, expect, it } from "vitest";
import { collapse, formatDate, formatRatio, formatScore, trimText } from "@/lib/format/common";

describe("common formatters", () => {
  it.each([[0, "0"], [999, "999"], [-5, "-5"], [1000, "1k"], [1234, "1.2k"], [9999, "10k"], [12_345, "12k"], [150_000, "150k"]])(
    "formatScore(%i) = %s", (n, s) => expect(formatScore(n)).toBe(s),
  );
  it("formatDate is UTC YYYY-MM-DD", () => expect(formatDate(1741910400)).toBe("2025-03-14"));
  it("formatRatio", () => {
    expect(formatRatio(0.964)).toBe("96%");
    expect(formatRatio(null)).toBe("");
  });
  it("collapse squeezes all whitespace to single spaces (Review Focus 4)", () => {
    expect(collapse("  a\n\n b\t c  ")).toBe("a b c");
  });
  it("trimText cuts at max and appends suffix only when needed", () => {
    expect(trimText("abcdef", 10)).toBe("abcdef");
    expect(trimText("abcdefghij", 4)).toBe("abcd…[trimmed]");
    expect(trimText("ab  cdefgh", 3, "…")).toBe("ab…");
  });
});
