import type { ReactNode } from "react";
import styles from "./KeyValueList.module.css";

export type KeyValueItem = { label: string; value: ReactNode; emphasis?: boolean };

export function KeyValueList({ items, testId = "key-value-list" }: { items: KeyValueItem[]; testId?: string }) {
  return (
    <dl className={styles.root} data-testid={testId}>
      {items.map((item) => (
        <div key={item.label} className={styles.row} data-emphasis={item.emphasis ? "true" : undefined}>
          <dt className={styles.term}>{item.label}</dt>
          <dd className={styles.value} data-emphasis={item.emphasis ? "true" : undefined}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
