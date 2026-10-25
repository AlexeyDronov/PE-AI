import styles from "./Stat.module.css";
import { Skeleton } from "./States";

export type StatDelta = { text: string; direction: "up" | "down"; good?: boolean };

export type StatProps = {
  label: string;
  value: string;
  hint?: string;
  delta?: StatDelta;
  hero?: boolean;
  testId?: string;
};

function deltaTone(good: boolean | undefined): "good" | "bad" | "neutral" {
  if (good === undefined) return "neutral";
  return good ? "good" : "bad";
}

export function Stat({ label, value, hint, delta, hero, testId = "stat" }: StatProps) {
  return (
    <div className={styles.stat} data-hero={hero ? "true" : undefined} data-testid={testId}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {delta || hint ? (
        <span className={styles.note}>
          {delta ? (
            <span className={styles.delta} data-tone={deltaTone(delta.good)} data-testid="stat-delta">
              {delta.direction === "up" ? "▲" : "▼"} {delta.text}
            </span>
          ) : null}
          {hint ? <span>{hint}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

export function StatStrip({ items, loading = false, count = 4, testId = "stat-strip" }: { items: StatProps[]; loading?: boolean; count?: number; testId?: string }) {
  return (
    <ul className={styles.strip} data-testid={testId} aria-busy={loading || undefined}>
      {loading
        ? Array.from({ length: count }, (_, index) => (
            <li key={index} className={styles.cell} data-hero={index === 0 ? "true" : undefined}>
              <Skeleton height={52} />
            </li>
          ))
        : items.map((item, index) => (
            <li key={item.label} className={styles.cell} data-hero={index === 0 ? "true" : undefined}>
              <Stat {...item} hero={index === 0} />
            </li>
          ))}
    </ul>
  );
}
