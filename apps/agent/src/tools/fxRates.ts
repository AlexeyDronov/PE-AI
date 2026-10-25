import { ToolError } from "../errors";

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const TTL_MS = 60 * 60 * 1000;

interface Rates {
  asOf: string;
  perEur: Record<string, number>;
  fetchedAt: number;
}

let cache: Rates | null = null;

async function loadRates(): Promise<Rates> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;
  const res = await fetch(ECB_URL, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new ToolError("upstream_error", `ECB returned HTTP ${res.status}`);
  const xml = await res.text();
  const asOf = /<Cube\b[^>]*?\btime\s*=\s*["']([^"']+)["']/.exec(xml)?.[1];
  const perEur: Record<string, number> = { EUR: 1 };
  for (const m of xml.matchAll(/<Cube\b([^>]*)>/g)) {
    const currency = /\bcurrency\s*=\s*["']([A-Z]{3})["']/.exec(m[1] ?? "")?.[1];
    const rate = /\brate\s*=\s*["']([\d.]+)["']/.exec(m[1] ?? "")?.[1];
    if (currency && rate) perEur[currency] = Number(rate);
  }
  if (!asOf || Object.keys(perEur).length < 2) throw new ToolError("upstream_error", "ECB returned an unexpected response");
  cache = { asOf, perEur, fetchedAt: Date.now() };
  return cache;
}

/** Convert between currencies using ECB daily reference rates (EUR cross rates). */
export async function convertCurrency(input: { amount: number; from: string; to: string }): Promise<{ amount: number; rate: number; asOf: string }> {
  const rates = await loadRates();
  const from = input.from.toUpperCase();
  const to = input.to.toUpperCase();
  const fromRate = rates.perEur[from];
  const toRate = rates.perEur[to];
  if (!fromRate) throw new ToolError("unknown_currency", `No ECB reference rate for ${from}`);
  if (!toRate) throw new ToolError("unknown_currency", `No ECB reference rate for ${to}`);
  const rate = from === to ? 1 : toRate / fromRate;
  return { amount: input.amount * rate, rate, asOf: rates.asOf };
}
