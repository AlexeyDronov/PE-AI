import { ToolError } from "../errors";

export type CalcOp =
  | { op: "cagr"; start: number; end: number; years: number }
  | { op: "multiple"; numerator: number; denominator: number }
  | { op: "pct_change"; from: number; to: number }
  | { op: "share"; part: number; whole: number };

export interface CalcResult {
  value: number;
  formula: string;
}

const invalid = (message: string) => new ToolError("invalid_input", message);

/** Exact arithmetic for the agent: ratios are fractions (0.15 = 15%). */
export function calculate(op: CalcOp): CalcResult {
  switch (op.op) {
    case "cagr":
      if (op.start <= 0 || op.end <= 0 || op.years <= 0) throw invalid("cagr needs start > 0, end > 0 and years > 0");
      return { value: (op.end / op.start) ** (1 / op.years) - 1, formula: `(${op.end} / ${op.start}) ^ (1 / ${op.years}) - 1` };
    case "multiple":
      if (op.denominator === 0) throw invalid("multiple: denominator must not be zero");
      return { value: op.numerator / op.denominator, formula: `${op.numerator} / ${op.denominator}` };
    case "pct_change":
      if (op.from === 0) throw invalid("pct_change: from must not be zero");
      return { value: (op.to - op.from) / Math.abs(op.from), formula: `(${op.to} - ${op.from}) / |${op.from}|` };
    case "share":
      if (op.whole === 0) throw invalid("share: whole must not be zero");
      return { value: op.part / op.whole, formula: `${op.part} / ${op.whole}` };
  }
}

const CURRENCIES: Record<string, string> = { "£": "GBP", gbp: "GBP", $: "USD", usd: "USD", "€": "EUR", eur: "EUR" };
const UNITS: Record<string, number> = { k: 0.001, thousand: 0.001, m: 1, mn: 1, million: 1, bn: 1000, billion: 1000 };
const MONEY = /^\s*(£|\$|€|gbp|usd|eur)\s*([\d,]+(?:\.\d+)?)\s*(bn|billion|mn|million|m|k|thousand)?\s*$/i;

/** Parse "£9.1bn", "$450m", "GBP 1.2 billion" into millions plus an ISO currency. */
export function parseMoney(text: string): { amount_m: number; currency: string } {
  const match = MONEY.exec(text);
  const symbol = match?.[1];
  const digits = match?.[2];
  if (!symbol || !digits) throw invalid(`Cannot parse an amount of money from "${text}"`);
  const unit = UNITS[(match[3] ?? "").toLowerCase()] ?? 0.000001;
  const amount = Number(digits.replace(/,/g, "")) * unit;
  return { amount_m: Number(amount.toPrecision(12)), currency: CURRENCIES[symbol.toLowerCase()] ?? symbol.toUpperCase() };
}
