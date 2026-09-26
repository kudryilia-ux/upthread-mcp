export function formatScore(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) return String(n);
  const k = n / 1000;
  const s = Math.abs(k) < 9.95 ? k.toFixed(1).replace(/\.0$/, "") : String(Math.round(k));
  return `${s}k`;
}

export const formatDate = (utcSeconds: number) => new Date(utcSeconds * 1000).toISOString().slice(0, 10);

export const formatRatio = (r: number | null) => (r === null ? "" : `${Math.round(r * 100)}%`);

export const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

export function trimText(text: string, max: number, suffix = "…[trimmed]"): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + suffix;
}

/** Hides Reddit usernames mentioned inside text (we never print authors either). */
// Covers u/name, /u/name, U/name, /user/name (profile links) and markdown-escaped underscores (u/foo\_bar).
export const redactUsernames = (text: string) =>
  text.replace(/(^|[^A-Za-z0-9_])\/?(u|user)\/[A-Za-z0-9_\\-]{3,40}/gi, (_m, pre: string, kind: string) =>
    `${pre}${kind.toLowerCase() === "user" ? "user" : "u"}/[user]`);

/** Describes what kind of evidence Reddit is, so Claude can weigh it against other sources. Information, not orders. */
export const SOURCE_NOTE =
  "About this source: these are individual Reddit users' posts. They're strongest for first-hand experience, " +
  "real-world problems and ideas worth checking, and weaker for facts, specs, safety or medical questions, where " +
  "editorial or official sources are usually more reliable. When other sources are thin, these posts may be the " +
  "best evidence available.";
