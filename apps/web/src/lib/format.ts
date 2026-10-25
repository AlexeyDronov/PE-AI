const DASH = "–";
const MINUS = "−";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Missing = number | null | undefined;

function missing(v: Missing): v is null | undefined {
  return v === null || v === undefined || Number.isNaN(v);
}

function group(abs: number, dp: number): string {
  return new Intl.NumberFormat("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(abs);
}

function money(v: Missing, opts: { style?: "financial" } = {}): string {
  if (missing(v)) return DASH;
  const neg = v < 0;
  const abs = Math.abs(v);
  if (opts.style === "financial") {
    const s = group(abs, 1);
    return neg ? `(${s})` : s;
  }
  const body = abs >= 1000 ? `£${group(abs / 1000, 1)}bn` : `£${group(abs, 1)}m`;
  return neg ? `${MINUS}${body}` : body;
}

function multiple(v: Missing, opts: { dp?: number } = {}): string {
  return missing(v) ? DASH : `${group(v, opts.dp ?? 1)}x`;
}

function pct(v: Missing, opts: { dp?: number; input?: "fraction" | "percent"; signed?: boolean } = {}): string {
  if (missing(v)) return DASH;
  const value = opts.input === "percent" ? v : v * 100;
  const body = `${group(Math.abs(value), opts.dp ?? 1)}%`;
  if (value < 0) return `${MINUS}${body}`;
  return opts.signed && value > 0 ? `+${body}` : body;
}

function bp(v: Missing): string {
  if (missing(v)) return DASH;
  const body = `${group(Math.abs(v), 0)}bp`;
  if (v < 0) return `${MINUS}${body}`;
  return v > 0 ? `+${body}` : body;
}

function int(v: Missing): string {
  if (missing(v)) return DASH;
  const body = group(Math.abs(v), 0);
  return v < 0 ? `${MINUS}${body}` : body;
}

function date(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} ${month} ${m[1]}` : DASH;
}

function quarter(key: string | null | undefined): string {
  const m = key ? /^(\d{4})Q([1-4])$/.exec(key) : null;
  return m && m[1] ? `Q${m[2]} ${m[1].slice(2)}` : DASH;
}

export const fmt = { money, multiple, pct, bp, int, date, quarter };
