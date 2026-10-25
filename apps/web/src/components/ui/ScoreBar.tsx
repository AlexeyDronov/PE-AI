import styles from "./ScoreBar.module.css";

type Props = {
  value: number;
  label: string;
  thresholds: { good: number; warn: number };
  max?: number;
  testId?: string;
};

export function ScoreBar({ value, label, thresholds, max = 100, testId = "score-bar" }: Props) {
  const tone = value >= thresholds.good ? "good" : value >= thresholds.warn ? "warn" : "bad";
  const width = `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
  return (
    <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} className={styles.root} data-tone={tone} data-testid={testId}>
      <span className={styles.figure}>{value}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width }} />
      </span>
    </div>
  );
}
