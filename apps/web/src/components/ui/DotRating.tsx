import { useId } from "react";
import styles from "./DotRating.module.css";

export function DotRating({ value, max, label, testId = "dot-rating" }: { value: number; max: number; label: string; testId?: string }) {
  const nameId = useId();
  return (
    <span role="img" aria-labelledby={nameId} className={styles.root} data-testid={testId}>
      <span id={nameId} hidden>{`${label}: ${value} of ${max}`}</span>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={styles.dot} data-on={i < value ? "true" : undefined} />
      ))}
    </span>
  );
}
