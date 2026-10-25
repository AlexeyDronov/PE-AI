import { fmt } from "@/lib/format";

/** A screening criterion's raw value as the reader expects to see it, chosen by criterion key. */
export function criterionValue(key: string, value: number): string {
  switch (key) {
    case "scale":
      return fmt.money(value);
    case "margin":
    case "growth":
    case "recurring":
    case "cash_conversion":
      return fmt.pct(value);
    case "moat":
    case "buy_and_build":
      return `${fmt.int(value)}/100`;
    case "entry_price":
      return value >= 0 ? `${fmt.pct(value)} below median` : `${fmt.pct(-value)} above median`;
    default:
      return fmt.int(value);
  }
}
