import { Card, KeyValueList, Skeleton } from "@/components/ui";
import { fmt } from "@/lib/format";
import styles from "./DebtCapacityPanel.module.css";
import type { DebtCapacity } from "./types";

export function DebtCapacityPanel({ capacity, loading }: { capacity?: DebtCapacity; loading?: boolean }) {
  return (
    <Card title="At fund policy" description={capacity ? `Interest cover floor ${fmt.multiple(capacity.cover_floor)}` : undefined} testId="debt-capacity">
      {loading || !capacity ? (
        <Skeleton height={120} />
      ) : (
        <>
          {capacity.max_leverage < capacity.policy_leverage ? (
            <p className={styles.warning} role="note" data-tone="warn">
              Policy leverage of {fmt.multiple(capacity.policy_leverage)} is above the {fmt.multiple(capacity.max_leverage, { dp: 2 })} this business
              supports under stress
            </p>
          ) : null}
          <KeyValueList
          items={[
            { label: `Senior debt at ${fmt.multiple(capacity.senior_multiple)}`, value: fmt.money(capacity.senior_debt) },
            { label: `Total debt at policy ${fmt.multiple(capacity.policy_leverage)}`, value: fmt.money(capacity.total_debt) },
            { label: "Interest cover at policy", value: fmt.multiple(capacity.interest_cover, { dp: 2 }) },
            { label: `Cover with EBITDA ${fmt.pct(-capacity.stress_drop)}`, value: fmt.multiple(capacity.stressed_cover, { dp: 2 }) },
            { label: "Supportable total debt", value: `${fmt.money(capacity.max_debt)} (${fmt.multiple(capacity.max_leverage, { dp: 2 })})`, emphasis: true },
          ]}
          />
        </>
      )}
    </Card>
  );
}
