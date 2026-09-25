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
