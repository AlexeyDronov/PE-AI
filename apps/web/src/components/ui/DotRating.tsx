import styles from "./DotRating.module.css";

export function DotRating({ value, max, label, testId = "dot-rating" }: { value: number; max: number; label: string; testId?: string }) {
  return (
    <span role="img" aria-label={`${label}: ${value} of ${max}`} className={styles.root} data-testid={testId}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={styles.dot} data-on={i < value ? "true" : undefined} />
      ))}
    </span>
  );
}
