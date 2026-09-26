import { describe, expect, it } from "vitest";
import { SEARCH_REDDIT_DESCRIPTION } from "@/lib/tools/search-reddit";
import { READ_THREADS_DESCRIPTION } from "@/lib/tools/read-threads";
import { SERVER_INSTRUCTIONS } from "@/lib/server";

// Claude decides whether to call a connector from these texts, so each one must lead
// with when to use it and name the everyday words people use for these questions.
const TRIGGER_WORDS = [/experiences?/i, /opinions?/i, /reviews?/i, /recommendations?/i, /what people (think|say)/i];

describe("tool triggering", () => {
  it("search_reddit opens with when to use it, before what it returns", () => {
    expect(SEARCH_REDDIT_DESCRIPTION.split("\n")[0]).toMatch(/^Use (this )?(whenever|when|for)/);
    for (const w of TRIGGER_WORDS) expect(SEARCH_REDDIT_DESCRIPTION.split("\n\n")[0]).toMatch(w);
  });

  it("search_reddit says to use it alongside web search without being asked", () => {
    expect(SEARCH_REDDIT_DESCRIPTION.split("\n\n")[0]).toMatch(/alongside web search/i);
    expect(SEARCH_REDDIT_DESCRIPTION.split("\n\n")[0]).toMatch(/(even when|without) (the user|being asked)/i);
  });

  it("server instructions open with when to use Upthread and name the question types", () => {
    const first = SERVER_INSTRUCTIONS.split("\n\n")[0];
    expect(first).toMatch(/proactively|without being asked|even when the user doesn't mention Reddit/i);
    for (const w of TRIGGER_WORDS) expect(first).toMatch(w);
  });

  it("read_threads accepts links the user shares, and nothing tells Claude to find Reddit via web search", () => {
    expect(READ_THREADS_DESCRIPTION.split("\n\n")[0]).toMatch(/links? the user shares/i);
    for (const t of [SEARCH_REDDIT_DESCRIPTION, READ_THREADS_DESCRIPTION, SERVER_INSTRUCTIONS]) {
      expect(t).not.toMatch(/site:reddit\.com/);
      expect(t).not.toMatch(/web search (finds|to find)/i);
    }
  });

  it("the skill file doesn't send Claude to site:reddit.com either", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("skill/upthread/SKILL.md", "utf8")).not.toMatch(/site:reddit\.com/);
  });

  it("stays neutral: no consensus framing", () => {
    for (const t of [SEARCH_REDDIT_DESCRIPTION, READ_THREADS_DESCRIPTION, SERVER_INSTRUCTIONS]) expect(t).not.toMatch(/consensus/i);
  });
});
