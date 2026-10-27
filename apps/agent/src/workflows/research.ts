import { queriesFor, type QueryName } from "../queries";

const MAX_QUERIES = 4;

const INTENTS: [QueryName, RegExp][] = [
  ["marketSize", /size|market|grow|cagr/i],
  ["dealComps", /multiple|\bev\b|ebitda|valuation|acquisition|\bm&a\b|\bdeals?\b/i],
  ["sponsorActivity", /sponsor|private equity|buyout/i],
  ["regulation", /regulat|compliance deadline/i],
  ["aiDisruption", /\bai\b|automation/i],
];

/** The question itself, then template queries for the intents it mentions, interleaved and uncapped. */
export function allQueries(question: string, { segment, year }: { segment?: string; year: number }): string[] {
  if (!segment) return [question];
  const names = INTENTS.filter(([, re]) => re.test(question)).map(([name]) => name);
  const sets = (names.length ? names : (["marketSize"] as QueryName[])).map((n) => queriesFor(n, { segment, geography: "UK", year }));
  const out = [question];
  for (let i = 0; sets.some((s) => i < s.length); i++) {
    for (const s of sets) if (s[i] && !out.includes(s[i]!)) out.push(s[i]!);
  }
  return out;
}

/** The first few planned queries: what the initial search round runs. */
export const planQueries = (question: string, ctx: { segment?: string; year: number }): string[] => allQueries(question, ctx).slice(0, MAX_QUERIES);

const STOPWORDS = new Set(
  "the and for are was were with that this from have has had how what which who when where why does did can could would should will into over than then them they their there these those about between across been being its our your you not but any all out per via too very more most much many".split(" "),
);

/** Passages of a page that mention the question's terms or contain a figure, in page order, within maxChars. */
export function filterPassages(text: string, question: string, maxChars = 4500): string {
  const terms = new Set((question.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !STOPWORDS.has(w)));
  const kept = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p && (/\d/.test(p) || (p.toLowerCase().match(/[a-z]{3,}/g) ?? []).some((w) => terms.has(w))));
  const out: string[] = [];
  let length = 0;
  for (const p of kept) {
    const next = length + p.length + (out.length ? 2 : 0);
    if (next > maxChars) break;
    out.push(p);
    length = next;
  }
  return out.length ? out.join("\n\n") : (kept[0] ?? "").slice(0, maxChars);
}

/** True when the value appears in the text as written, as a whole number (not inside a bigger one). */
export function numberAppears(value: number, text: string): boolean {
  const forms = new Set([String(value), value.toFixed(1), value.toFixed(2), value.toLocaleString("en-US", { maximumFractionDigits: 2 })]);
  return [...forms].some((f) => new RegExp(`(?<!\\d)(?<!\\d[.,])${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)(?![.,]\\d)`).test(text));
}

export interface Finding {
  metric: string;
  value: number;
  unit: string;
  period: string;
  confidence: "low" | "medium" | "high";
  source_refs: number[];
  quote: string;
}

export interface NumberedSource {
  ref: number;
  url: string;
  title: string;
  publisher: string;
  excerpt: string;
}

export const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Keep only findings whose quote really occurs in a cited source and really contains the figure. */
export function verifyFindings<F extends Finding>(findings: F[], sources: NumberedSource[]): { kept: F[]; dropped: F[] } {
  const byRef = new Map(sources.map((s) => [s.ref, normalise(s.excerpt)]));
  const kept: F[] = [];
  const dropped: F[] = [];
  for (const f of findings) {
    const excerpts = f.source_refs.map((r) => byRef.get(r));
    const quote = normalise(f.quote);
    const ok = excerpts.every((e) => e !== undefined) && excerpts.some((e) => e!.includes(quote)) && numberAppears(f.value, f.quote);
    (ok ? kept : dropped).push(f);
  }
  return { kept, dropped };
}
