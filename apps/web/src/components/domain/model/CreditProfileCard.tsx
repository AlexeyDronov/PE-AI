import { Card, KeyValueList, Skeleton } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./CreditProfileCard.module.css";
import type { Benchmark, CreditStats } from "./types";

function range(b: Benchmark): string {
  return b.high === null || b.high === undefined
    ? `Benchmark at least ${fmt.multiple(b.low)}`
    : `Benchmark ${b.low.toFixed(1)}–${fmt.multiple(b.high)}`;
}

export function CreditProfileCard({ credit, benchmarks }: { credit?: CreditStats; benchmarks: Benchmark[] }) {
  const bench = (key: string) => benchmarks.find((b) => b.key === key);
  const stat = (label: string, value: string, key?: string) => {
    const b = key ? bench(key) : undefined;
    return { label, value: b ? <>{value}<small className={styles.caption}>{range(b)}</small></> : value };
  };
  return (
    <Card title="Credit profile" description="Against benchmarks" testId="credit-profile">
      {!credit ? (
        <Skeleton height={160} />
      ) : (
        <KeyValueList
          items={[
            stat("Total debt / EBITDA", fmt.multiple(credit.total_leverage, { dp: 2 }), "total_leverage"),
            stat("Senior debt / EBITDA", fmt.multiple(credit.senior_leverage, { dp: 2 }), "senior_leverage"),
            stat("Interest cover", fmt.multiple(credit.interest_cover, { dp: 2 }), "interest_cover"),
            stat("Cover under EBITDA stress", fmt.multiple(credit.stressed_cover, { dp: 2 })),
            stat("Debt share of sources", fmt.pct(credit.debt_share, { dp: 0 })),
          ]}
        />
      )}
    </Card>
  );
}
