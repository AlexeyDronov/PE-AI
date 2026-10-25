import { fmt } from "@/lib/format";
import styles from "./HeadroomMeter.module.css";

type Props = {
  label: string;
  /** Headroom as a fraction, e.g. 0.27 for 27%. */
  value: number;
  /** Comfort threshold as a fraction; below it the meter turns to warning. */
  threshold: number;
  /** Fraction at which the bar is full. */
  max?: number;
  testId?: string;
};

export function HeadroomMeter({ label, value, threshold, max = 0.5, testId = "headroom-meter" }: Props) {
  const tone = value < 0 ? "bad" : value < threshold ? "warn" : "good";
  const clamp = (x: number) => `${Math.min(100, Math.max(0, (x / max) * 100))}%`;
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={Math.round(max * 100)}
      aria-valuetext={fmt.pct(value, { dp: 0 })}
      className={styles.root}
      data-tone={tone}
      data-testid={testId}
    >
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: clamp(value) }} />
        <span className={styles.tick} style={{ left: clamp(threshold) }} />
      </span>
      <span className={styles.label}>{fmt.pct(value, { dp: 0 })}</span>
    </div>
  );
}
